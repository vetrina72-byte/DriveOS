
import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Deforms a unit geometry into a frustum along the Z-axis.
// Works for both BoxGeometry and CylinderGeometry (via coordinate swizzle).
const VolumetricVertexShader = `
    uniform float uBeamLength;
    uniform float uStartWidth;
    uniform float uEndWidth;
    uniform float uStartHeight;
    uniform float uEndHeight;
    uniform bool uCircular;

    varying vec3 vPos;
    varying vec2 vUv; 

    void main() {
        vec3 p = position; // Local vertex position

        // Coordinate Swizzle for CylinderGeometry
        // Cylinder is Y-up by default. We want it Z-forward to match logic.
        // Box is Z-aligned (after we scale it, but logically p.z is the length axis in this shader).
        if (uCircular) {
            // Swap Y and Z so that p.z becomes the length axis (originally p.y in cylinder)
            float temp = p.z;
            p.z = p.y; 
            p.y = temp;
            // Now p.z is [-0.5, 0.5] (length), p.x, p.y are radius
        }

        vUv = p.xy; 

        // 1. Remap Z to [0, 1] for interpolation. 
        // For Box: front is +0.5, back is -0.5. 
        // For Cylinder (rotated via swizzle): top is +0.5, bottom is -0.5.
        float lengthFactor = 0.5 - p.z; 

        // 2. Interpolate width and height
        float currentWidth = mix(uStartWidth, uEndWidth, lengthFactor);
        float currentHeight = mix(uStartHeight, uEndHeight, lengthFactor);

        // 3. Apply scaling to X and Y
        p.x *= currentWidth;
        p.y *= currentHeight;
        
        // 4. Scale the Z coordinate to match the desired beam length.
        // We position the start at 0 and end at uBeamLength.
        p.z = lengthFactor * uBeamLength;

        vPos = p; 

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
`;

// Renders the volumetric effect.
const VolumetricFragmentShader = `
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uFade;
    // uniform bool uCircular; // Removed, geometry handles shape now

    varying vec3 vPos;
    varying vec2 vUv;
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
    beamEndHeight,
    circular = false
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
    circular?: boolean;
}) => {
    const groupRef = useRef<THREE.Group>(null!);
    const materialRef = useRef<THREE.ShaderMaterial>(null!);

    useEffect(() => {
        if (groupRef.current) {
            const initialEuler = new THREE.Euler(beamAngle, Math.PI, beamRoll, 'YXZ');
            groupRef.current.quaternion.setFromEuler(initialEuler);
        }
    }, []);

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
            uCircular: { value: circular },
        },
        vertexShader: VolumetricVertexShader,
        fragmentShader: VolumetricFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide, // Visible from inside and out
    }), []);

    useFrame((_, delta) => {
        if (!groupRef.current || !materialRef.current) return;

        const group = groupRef.current;
        const material = materialRef.current;
        const animationSpeed = 2.0;
        const dampFactor = 1 - Math.exp(-animationSpeed * delta);
        
        targetEuler.set(beamAngle, Math.PI, beamRoll);
        targetQuat.setFromEuler(targetEuler);
        group.quaternion.slerp(targetQuat, dampFactor);

        // Animate visibility by fading intensity and shrinking the beam dimensions.
        const targetIntensity = visible ? intensity : 0;
        material.uniforms.uIntensity.value = THREE.MathUtils.lerp(material.uniforms.uIntensity.value, targetIntensity, dampFactor);
        
        material.uniforms.uStartWidth.value = THREE.MathUtils.lerp(material.uniforms.uStartWidth.value, visible ? beamStartWidth : 0, dampFactor);
        material.uniforms.uEndWidth.value = THREE.MathUtils.lerp(material.uniforms.uEndWidth.value, visible ? beamEndWidth : 0, dampFactor);
        material.uniforms.uStartHeight.value = THREE.MathUtils.lerp(material.uniforms.uStartHeight.value, visible ? beamStartHeight : 0, dampFactor);
        material.uniforms.uEndHeight.value = THREE.MathUtils.lerp(material.uniforms.uEndHeight.value, visible ? beamEndHeight : 0, dampFactor);
        
        material.uniforms.uFade.value = fade;
        material.uniforms.uBeamLength.value = beamLength;
        material.uniforms.uCircular.value = circular;
        
        group.visible = material.uniforms.uIntensity.value > 0.001;
    });

    return (
        <group
            ref={groupRef}
            position={position}
        >
            <mesh castShadow={false} receiveShadow={false}>
                {circular ? (
                    // Radius 0.5 matches Box size 1 (from -0.5 to 0.5)
                    <cylinderGeometry args={[0.5, 0.5, 1, 32, 1, true]} />
                ) : (
                    <boxGeometry args={[1, 1, 1]} />
                )}
                <shaderMaterial ref={materialRef} args={[shaderArgs]} />
            </mesh>
        </group>
    );
};
