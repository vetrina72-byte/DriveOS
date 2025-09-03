

import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Deforms a unit box into a frustum along the Z-axis.
// Roll logic has been removed from the shader and is now handled in the component.
const VolumetricVertexShader = `
    uniform float uBeamLength;
    uniform float uStartWidth;
    uniform float uEndWidth;
    uniform float uStartHeight;
    uniform float uEndHeight;

    varying vec3 vPos;

    void main() {
        vec3 p = position; // Vertex position from the unit box, range [-0.5, 0.5]

        // 1. Remap Z to [0, 1] for interpolation
        float lengthFactor = 0.5 - p.z; 

        // 2. Interpolate width and height
        float currentWidth = mix(uStartWidth, uEndWidth, lengthFactor);
        float currentHeight = mix(uStartHeight, uEndHeight, lengthFactor);

        // 3. Apply scaling to X and Y
        p.x *= currentWidth;
        p.y *= currentHeight;
        
        // 4. Scale the Z coordinate to match the desired beam length.
        p.z = lengthFactor * uBeamLength;

        vPos = p; // Pass the final, deformed position to the fragment shader.

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
`;

// Renders the volumetric effect for the frustum geometry.
const VolumetricFragmentShader = `
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uFade; // This now controls the exponent of the length-based fade.
    varying vec3 vPos;
    uniform float uBeamLength;

    void main() {
        // Calculate a fade factor based on the vertex's distance along the beam (Z-axis).
        float lengthFade = pow(1.0 - clamp(vPos.z / uBeamLength, 0.0, 1.0), uFade);

        // The final color's alpha is determined by the combination of the
        // length-based fade and the overall beam intensity.
        gl_FragColor = vec4(uColor, lengthFade * uIntensity);
    }
`;


export const VolumetricHeadlight = ({
    position,
    beamLength,
    beamAngle, // Pitch
    beamRoll,  // Roll
    intensity,
    fade,
    visible,
    beamStartWidth,
    beamEndWidth,
    beamStartHeight,
    beamEndHeight
}: {
    position: [number, number, number];
    beamLength: number;
    beamAngle: number;
    beamRoll: number;
    intensity: number;
    fade: number;
    visible: boolean;
    beamStartWidth: number;
    beamEndWidth: number;
    beamStartHeight: number;
    beamEndHeight: number;
}) => {
    const groupRef = useRef<THREE.Group>(null!);
    const materialRef = useRef<THREE.ShaderMaterial>(null!);

    // The original code passed a new Euler object via the `rotation` prop on every `beamAngle`/`beamRoll`
    // change, causing a "Cannot assign to read only property" error in three.js.
    // We now manage rotation internally. This effect sets the *initial* state to avoid the
    // "roll-in" animation on mount. All subsequent changes are animated smoothly by useFrame.
    useEffect(() => {
        if (groupRef.current) {
            const initialEuler = new THREE.Euler(beamAngle, Math.PI, beamRoll, 'YXZ');
            groupRef.current.quaternion.setFromEuler(initialEuler);
        }
    // This effect is intentionally run only once to set the initial state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Memoize reusable THREE objects to avoid recreating them on every render
    const targetQuat = useMemo(() => new THREE.Quaternion(), []);
    const targetEuler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);
    
    const shaderArgs = useMemo(() => ({
        uniforms: {
            uColor: { value: new THREE.Color('white') },
            uIntensity: { value: 0 },
            uFade: { value: 1.5 },
            uBeamLength: { value: 10 },
            uStartWidth: { value: 0 },
            uEndWidth: { value: 0 },
            uStartHeight: { value: 0 },
            uEndHeight: { value: 0 },
        },
        vertexShader: VolumetricVertexShader,
        fragmentShader: VolumetricFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    }), []);

    useFrame((_, delta) => {
        if (!groupRef.current || !materialRef.current) return;

        const group = groupRef.current;
        const material = materialRef.current;
        const animationSpeed = 2.0;
        const dampFactor = 1 - Math.exp(-animationSpeed * delta);
        
        // We set the rotation using Quaternions for smooth interpolation (slerp)
        // and to avoid gimbal lock. The Euler order 'YXZ' is crucial:
        // 1. Yaw: Point the beam forward.
        // 2. Pitch: Tilt the beam up/down.
        // 3. Roll: Rotate the beam around its own forward axis.
        targetEuler.set(beamAngle, Math.PI, beamRoll);
        targetQuat.setFromEuler(targetEuler);
        group.quaternion.slerp(targetQuat, dampFactor);

        // Animate visibility by fading intensity and shrinking the beam dimensions to zero.
        const targetIntensity = visible ? intensity : 0;
        material.uniforms.uIntensity.value = THREE.MathUtils.lerp(material.uniforms.uIntensity.value, targetIntensity, dampFactor);
        material.uniforms.uStartWidth.value = THREE.MathUtils.lerp(material.uniforms.uStartWidth.value, visible ? beamStartWidth : 0, dampFactor);
        material.uniforms.uEndWidth.value = THREE.MathUtils.lerp(material.uniforms.uEndWidth.value, visible ? beamEndWidth : 0, dampFactor);
        material.uniforms.uStartHeight.value = THREE.MathUtils.lerp(material.uniforms.uStartHeight.value, visible ? beamStartHeight : 0, dampFactor);
        material.uniforms.uEndHeight.value = THREE.MathUtils.lerp(material.uniforms.uEndHeight.value, visible ? beamEndHeight : 0, dampFactor);
        
        // Update uniforms from props
        material.uniforms.uFade.value = fade;
        material.uniforms.uBeamLength.value = beamLength;
        
        // Hide the entire object when it's not visible to save performance.
        group.visible = material.uniforms.uIntensity.value > 0.001;
    });

    return (
        <group
            ref={groupRef}
            position={position}
            // The problematic `rotation` prop is now removed. All rotation is handled by the `useFrame` loop.
        >
            <mesh
                castShadow={false}
                receiveShadow={false}
            >
                {/* A unit box is used as the base geometry. The vertex shader deforms it into a frustum. */}
                <boxGeometry args={[1, 1, 1]} />
                <shaderMaterial ref={materialRef} args={[shaderArgs]} />
            </mesh>
        </group>
    );
};
