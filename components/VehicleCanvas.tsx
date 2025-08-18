

import React, { Suspense, useEffect, useRef, useState, forwardRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
// The DebugControls component is no longer rendered.
import { VolumetricHeadlight } from './VolumetricHeadlight';

// URL del modello GLTF
const MODEL_URL = 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/cybertruck/model.gltf';

// Interfaccia per la configurazione della scena, mantenuta per la logica di animazione interna
export interface SceneConfig {
    cameraPos: { x: number; y: number; z: number; };
    cameraTarget: { x: number; y: number; z: number; };
    modelPos: { x: number; y: number; z: number; };
    modelRot: { x: number; y: number; z: number; };
    modelScale: number;
}

// Memoize Environment per evitare flash sulle riflessioni
const MemoizedEnvironment = React.memo(() => <Environment preset="city" />);

// Componente Model con emissive light e ombre
const Model = forwardRef<THREE.Group, {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  isNight: boolean;
}>(({ position, rotation, scale, isNight }, ref) => {
  const { scene } = useGLTF(MODEL_URL);
  const lightMats = useRef<Record<string, THREE.MeshStandardMaterial>>({});

  useEffect(() => {
    lightMats.current = {};
    scene.traverse((child: any) => {
      if (child.isLight) child.castShadow = false;
      if (child.isMesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        child.castShadow = true;
        child.receiveShadow = true;
        if (mat) {
          const name = mat.name.toLowerCase();
          if (name.includes('window') || name.includes('glass')) {
            mat.color.set('black');
            mat.roughness = 0.05;
            mat.metalness = 0.1;
            mat.transparent = true;
            mat.opacity = 0.5;
            child.castShadow = false;
          }
          if (name === 'lights_emissive') {
            mat.emissive = new THREE.Color('#ffffff');
            mat.toneMapped = false;
            lightMats.current[mat.uuid] = mat;
            child.castShadow = false;
          }
        }
      }
    });
  }, [scene]);

  useFrame((_, delta) => {
    const target = isNight ? 5.0 : 0.0;
    const damp = 1 - Math.exp(-2 * delta);
    Object.values(lightMats.current).forEach(mat => {
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, target, damp);
    });
  });

  return (
    <primitive
      ref={ref}
      object={scene}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={scale}
    />
  );
});
Model.displayName = 'Model';
useGLTF.preload(MODEL_URL);

function SceneController({
  isAppOpen, activeConfig, setAppOpenConfig, modelRef,
  frontLightTarget, originalAppOpenConfig, onInteractionChange
}: {
  isAppOpen: boolean;
  activeConfig: SceneConfig;
  setAppOpenConfig: React.Dispatch<React.SetStateAction<SceneConfig>>;
  modelRef: React.RefObject<THREE.Group>;
  frontLightTarget: THREE.Object3D;
  originalAppOpenConfig: SceneConfig;
  onInteractionChange?: (isInteracting: boolean) => void;
}) {
  const { camera, controls, gl } = useThree();
  const [interacting, setInteracting] = useState(false);
  const interactTimeout = useRef<number | null>(null);
  const dragResetTimeout = useRef<number | null>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Velocità di animazione fisse
  const openingCameraSpeed = 4.5;
  const closingCameraSpeed = 3.1;

  // Gestione interazione orbit controls
  useEffect(() => {
    setInteracting(false);
    onInteractionChange?.(false);
    if (interactTimeout.current) clearTimeout(interactTimeout.current);
  }, [isAppOpen, onInteractionChange]);

  useEffect(() => {
    const ctrl = (controls as any);
    if (!ctrl || isAppOpen) return;
    const onStart = () => {
      setInteracting(true);
      onInteractionChange?.(true);
      if (interactTimeout.current) clearTimeout(interactTimeout.current);
    };
    const onEnd = () => {
      if (interactTimeout.current) clearTimeout(interactTimeout.current);
      interactTimeout.current = window.setTimeout(() => {
        setInteracting(false);
        onInteractionChange?.(false);
      }, 7000);
    };
    ctrl.addEventListener('start', onStart);
    ctrl.addEventListener('end', onEnd);
    return () => {
      ctrl.removeEventListener('start', onStart);
      ctrl.removeEventListener('end', onEnd);
      if (interactTimeout.current) clearTimeout(interactTimeout.current);
    };
  }, [controls, isAppOpen, onInteractionChange]);

  // Drag per ruotare il modello in app-open
  useEffect(() => {
    if (!isAppOpen) return;

    const dom = gl.domElement;

    const startDrag = (x: number) => {
        dragging.current = true;
        lastPos.current.x = x;
        if (dragResetTimeout.current) clearTimeout(dragResetTimeout.current);
    };

    const drag = (x: number) => {
        if (!dragging.current) return;
        const dx = x - lastPos.current.x;
        lastPos.current.x = x;
        setAppOpenConfig(prev => ({
            ...prev,
            modelRot: { ...prev.modelRot, y: prev.modelRot.y + dx * 0.005 },
        }));
    };

    const endDrag = () => {
        if (!dragging.current) return;
        dragging.current = false;
        if (dragResetTimeout.current) clearTimeout(dragResetTimeout.current);
        dragResetTimeout.current = window.setTimeout(() => {
            setAppOpenConfig(prev => ({
                ...prev,
                modelRot: originalAppOpenConfig.modelRot,
            }));
        }, 7000);
    };

    // Event handlers
    const handleMouseDown = (e: MouseEvent) => startDrag(e.clientX);
    const handleMouseMove = (e: MouseEvent) => drag(e.clientX);
    const handleTouchStart = (e: TouchEvent) => startDrag(e.touches[0].clientX);
    const handleTouchMove = (e: TouchEvent) => drag(e.touches[0].clientX);

    // Register event listeners
    dom.addEventListener('mousedown', handleMouseDown);
    dom.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', endDrag);

    dom.addEventListener('touchstart', handleTouchStart, { passive: true });
    dom.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', endDrag);

    // Cleanup
    return () => {
        dom.removeEventListener('mousedown', handleMouseDown);
        dom.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', endDrag);
        dom.removeEventListener('touchstart', handleTouchStart);
        dom.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', endDrag);
        if (dragResetTimeout.current) clearTimeout(dragResetTimeout.current);
    };
  }, [isAppOpen, gl, setAppOpenConfig, originalAppOpenConfig]);

  // Animazione camera e modello
  useFrame((_, delta) => {
    const speed = isAppOpen ? openingCameraSpeed : closingCameraSpeed;
    const damp = 1 - Math.exp(-speed * delta);

    if (!interacting && controls) {
      const ctrl = controls as any;
      const tgt = new THREE.Vector3(
        activeConfig.cameraTarget.x,
        activeConfig.cameraTarget.y,
        activeConfig.cameraTarget.z
      );
      ctrl.target.lerp(tgt, damp);

      // --- Unified Spherical Lerp for camera animation ---
      // This ensures the camera always moves around the car, not through it,
      // by interpolating its spherical coordinates (radius, phi, theta) instead of its cartesian (x,y,z) ones.
      const targetPosition = new THREE.Vector3(
        activeConfig.cameraPos.x,
        activeConfig.cameraPos.y,
        activeConfig.cameraPos.z
      );
      const offset = new THREE.Vector3().subVectors(targetPosition, tgt);

      // Target spherical coordinates
      const targetRadius = offset.length();
      const targetPhi = Math.acos(offset.y / targetRadius);
      const targetTheta = Math.atan2(offset.x, offset.z);

      // Current spherical coordinates from OrbitControls
      const currentRadius = ctrl.getDistance();
      const currentPhi = ctrl.getPolarAngle();
      const currentTheta = ctrl.getAzimuthalAngle();
      
      // Interpolate each spherical coordinate towards the target
      const newRadius = THREE.MathUtils.lerp(currentRadius, targetRadius, damp);
      const newPhi = THREE.MathUtils.lerp(currentPhi, targetPhi, damp);
      
      // Handle theta wrapping for the shortest rotation path
      let deltaTheta = targetTheta - currentTheta;
      if (deltaTheta > Math.PI) deltaTheta -= 2 * Math.PI;
      if (deltaTheta < -Math.PI) deltaTheta += 2 * Math.PI;
      const newTheta = currentTheta + deltaTheta * damp;
      
      // Calculate the new camera position from the interpolated spherical coordinates
      const newPosition = new THREE.Vector3()
        .setFromSphericalCoords(newRadius, newPhi, newTheta)
        .add(ctrl.target); // Add the interpolated target back to get the final world position

      camera.position.copy(newPosition);
    }

    if (modelRef.current) {
      modelRef.current.position.lerp(
        new THREE.Vector3(
          activeConfig.modelPos.x,
          activeConfig.modelPos.y,
          activeConfig.modelPos.z
        ),
        damp
      );
      modelRef.current.scale.lerp(
        new THREE.Vector3(
          activeConfig.modelScale,
          activeConfig.modelScale,
          activeConfig.modelScale
        ),
        damp
      );
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          activeConfig.modelRot.x,
          activeConfig.modelRot.y,
          activeConfig.modelRot.z
        )
      );
      modelRef.current.quaternion.slerp(q, damp);
      frontLightTarget
        .position.copy(modelRef.current.position)
        .add(new THREE.Vector3(0, 0.5, 0));
    }

    if (controls) (controls as any).update();
  });

  return null;
}

function EnvironmentController({
  isNight,
  floorRef,
  ambientLightRef,
  frontLightRef,
  directionalLightRef,
  nightAmbientIntensity,
  nightFrontLightIntensity,
  nightEnvironmentIntensity,
  nightFloorDarkness,
}: {
  isNight: boolean;
  floorRef: React.RefObject<THREE.Mesh>;
  ambientLightRef: React.RefObject<THREE.AmbientLight>;
  frontLightRef: React.RefObject<THREE.SpotLight>;
  directionalLightRef: React.RefObject<THREE.DirectionalLight>;
  nightAmbientIntensity: number;
  nightFrontLightIntensity: number;
  nightEnvironmentIntensity: number;
  nightFloorDarkness: number;
}) {
  const { scene } = useThree();
  const targetSky = useRef(new THREE.Color()).current;
  const targetFloor = useRef(new THREE.Color()).current;
  const environmentRotationY = 0;

  // Day values
  const dayAmbientIntensity = 0.8;
  const dayFrontLightIntensity = 0.8;
  const dayDirectionalIntensity = 0.8;
  const dayEnvironmentIntensity = 2.5;
  
  useEffect(() => {
    scene.background = new THREE.Color('#ffffff');
    scene.fog = new THREE.Fog('#ffffff', 18, 35);
  }, [scene]);

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-1.5 * delta);
    targetSky.set(isNight ? '#000000' : '#ffffff');

    // This logic removes the "focus mode" completely, as requested.
    // The floor appearance now only depends on isNight and the debug controls.
    if (isNight) {
        // nightFloorDarkness is a value from 0 (black) to 50 (dark grey)
        const hex = Math.round(nightFloorDarkness).toString(16).padStart(2, '0');
        targetFloor.set(`#${hex}${hex}${hex}`);
    } else {
        targetFloor.set('#ffffff');
    }
    
    if (scene.background instanceof THREE.Color) scene.background.lerp(targetSky, t);
    if (scene.fog) scene.fog.color.lerp(targetSky, t);

    const floorMat = floorRef.current!.material as any;
    floorMat.color.lerp(targetFloor, t);
    
    // Mirror effect is now independent of app state (focus mode).
    const targetMirror = isNight ? 0 : 0.8;
    floorMat.mirror = THREE.MathUtils.lerp(floorMat.mirror, targetMirror, t);
    
    let targetAmbientIntensity: number, 
        targetFrontLightIntensity: number, 
        targetDirectionalIntensity: number, 
        targetEnvIntensity: number;

    if (isNight) {
        targetAmbientIntensity = nightAmbientIntensity;
        targetFrontLightIntensity = nightFrontLightIntensity;
        targetDirectionalIntensity = 0; // The sun is off
        targetEnvIntensity = nightEnvironmentIntensity;
    } else { // Day mode
        targetAmbientIntensity = dayAmbientIntensity;
        targetFrontLightIntensity = dayFrontLightIntensity;
        targetDirectionalIntensity = dayDirectionalIntensity;
        targetEnvIntensity = dayEnvironmentIntensity;
    }

    if (ambientLightRef.current) {
        ambientLightRef.current.intensity = THREE.MathUtils.lerp(ambientLightRef.current.intensity, targetAmbientIntensity, t);
    }
    if (frontLightRef.current) {
        frontLightRef.current.intensity = THREE.MathUtils.lerp(frontLightRef.current.intensity, targetFrontLightIntensity, t);
    }
    if (directionalLightRef.current) {
        directionalLightRef.current.intensity = THREE.MathUtils.lerp(directionalLightRef.current.intensity, targetDirectionalIntensity, t);
    }

    scene.environmentIntensity = THREE.MathUtils.lerp(scene.environmentIntensity, targetEnvIntensity, t);
    scene.environmentRotation.y = THREE.MathUtils.lerp(scene.environmentRotation.y, environmentRotationY, t);
  });

  return null;
}

interface VehicleCanvasProps {
  isAppOpen: boolean;
  isNight: boolean;
  minOrbitDistance: number;
  maxOrbitDistance: number;
  appOpenConfig: SceneConfig;
  nightFloorDarkness: number;
  nightAmbientIntensity: number;
  nightFrontLightIntensity: number;
  nightEnvironmentIntensity: number;
  onInteractionChange?: (isInteracting: boolean) => void;
}

export default function VehicleCanvas({
  isAppOpen,
  isNight,
  minOrbitDistance,
  maxOrbitDistance,
  appOpenConfig: appOpenConfigFromProps,
  nightFloorDarkness,
  nightAmbientIntensity,
  nightFrontLightIntensity,
  nightEnvironmentIntensity,
  onInteractionChange,
}: VehicleCanvasProps) {
  const modelRef = useRef<THREE.Group>(null!);
  const floorRef = useRef<THREE.Mesh>(null!);
  const ambientLightRef = useRef<THREE.AmbientLight>(null!);
  const frontLightRef = useRef<THREE.SpotLight>(null!);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null!);
  const frontLightTarget = useMemo(() => new THREE.Object3D(), []);
  
  const beamLength = 5.0;
  const beamStartWidth = 1.86;
  const beamEndWidth = 2.60;
  const beamStartHeight = 0.03;
  const beamEndHeight = 0.01;
  const beamAngle = 2.92; // PITCH
  const beamRoll = 0; // ROLL
  const beamIntensity = 0.5;
  const beamFade = 3.30; // Falloff
  const headlightPosition = { x: 0.85, y: 1.09, z: 2.47 };
  
  const shadowPosition = { x: 0, y: 0.01, z: 0 };
  const shadowOpacity = 0.5;
  const shadowBlur = 2.5;

  const [initialConfig, ] = useState<SceneConfig>({
    cameraPos: { x: 8.30, y: 2.10, z: 8.80 },
    cameraTarget: { x: 0.95, y: 0, z: 0.65 },
    modelPos: { x: 0.95, y: -1.00, z: 0.65 },
    modelRot: { x: 0.0, y: 0.05, z: 0.0 },
    modelScale: 1.5,
  });

  const [runtimeAppOpenConfig, setRuntimeAppOpenConfig] = useState<SceneConfig>(appOpenConfigFromProps);

  useEffect(() => {
    // This effect ensures that any temporary changes (like from dragging the model)
    // are reset to the master configuration from the props whenever the app is opened
    // or when the master configuration itself is changed via debug controls.
    if (isAppOpen) {
      setRuntimeAppOpenConfig(appOpenConfigFromProps);
    }
  }, [appOpenConfigFromProps, isAppOpen]);
  

  useEffect(() => {
    if (frontLightRef.current) frontLightRef.current.target = frontLightTarget;
  }, [frontLightTarget]);

  const activeConfig = isAppOpen ? runtimeAppOpenConfig : initialConfig;

  return (
    <>
      <Canvas shadows={{ type: THREE.PCFSoftShadowMap }} camera={{ fov: 48, position: [initialConfig.cameraPos.x, initialConfig.cameraPos.y, initialConfig.cameraPos.z] }}>
        <Suspense fallback={null}>
          <group
            ref={modelRef}
            position={[initialConfig.modelPos.x, initialConfig.modelPos.y, initialConfig.modelPos.z]}
            rotation={[initialConfig.modelRot.x, initialConfig.modelRot.y, initialConfig.modelRot.z]}
            scale={initialConfig.modelScale}
          >
            <Model
              position={{ x: 0, y: 0, z: 0 }}
              rotation={{ x: 0, y: 0, z: 0 }}
              scale={1}
              isNight={isNight}
            />

            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[shadowPosition.x, shadowPosition.y, shadowPosition.z]}>
              <planeGeometry args={[10, 10]} />
              <shadowMaterial transparent opacity={shadowOpacity} />
            </mesh>
            
            {/* Headlight style is fixed to 'bar' */}
            <VolumetricHeadlight
              position={[0, headlightPosition.y, headlightPosition.z]}
              beamLength={beamLength}
              beamAngle={beamAngle}
              beamRoll={beamRoll}
              intensity={beamIntensity}
              fade={beamFade}
              visible={isNight}
              beamStartWidth={beamStartWidth}
              beamEndWidth={beamEndWidth}
              beamStartHeight={beamStartHeight}
              beamEndHeight={beamEndHeight}
            />
          </group>

          <MemoizedEnvironment />
        </Suspense>

        <ambientLight ref={ambientLightRef} />

        <directionalLight
          ref={directionalLightRef}
          castShadow
          position={[0.5, 10, 1]}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={30}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-radius={shadowBlur}
        />

        <primitive object={frontLightTarget} />
        <spotLight
          ref={frontLightRef}
          position={[0.95, 4, 7]}
          angle={0.9}
          penumbra={1}
          castShadow={false}
          distance={30}
          decay={2}
        />

        <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <planeGeometry args={[100, 100]} />
          <MeshReflectorMaterial
            resolution={1024}
            mixBlur={0}
            mixStrength={1.2}
            roughness={0.8}
            depthScale={1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#ffffff"
            metalness={0.6}
            mirror={0.8}
          />
        </mesh>

        <OrbitControls
          makeDefault
          enabled={!isAppOpen}
          enableZoom
          enablePan={false}
          enableDamping
          dampingFactor={0.05}
          minDistance={minOrbitDistance}
          maxDistance={maxOrbitDistance}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 1.9}
          autoRotate={false}
        />

        <SceneController
          isAppOpen={isAppOpen}
          activeConfig={activeConfig}
          setAppOpenConfig={setRuntimeAppOpenConfig}
          modelRef={modelRef}
          frontLightTarget={frontLightTarget}
          originalAppOpenConfig={appOpenConfigFromProps}
          onInteractionChange={onInteractionChange}
        />
        <EnvironmentController
          isNight={isNight}
          floorRef={floorRef}
          ambientLightRef={ambientLightRef}
          frontLightRef={frontLightRef}
          directionalLightRef={directionalLightRef}
          nightAmbientIntensity={nightAmbientIntensity}
          nightFrontLightIntensity={nightFrontLightIntensity}
          nightEnvironmentIntensity={nightEnvironmentIntensity}
          nightFloorDarkness={nightFloorDarkness}
        />
      </Canvas>
    </>
  );
}