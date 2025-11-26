
import React, { Suspense, useEffect, useRef, useState, forwardRef, useMemo, useCallback, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { VolumetricHeadlight } from './VolumetricHeadlight';
import WeatherEffects from './WeatherEffects';
import type { SceneColors } from '../App';
import type { WeatherParams } from '../types';

// Simple Error Boundary for the 3D model
interface ModelErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ModelErrorBoundaryState {
  hasError: boolean;
}

class ModelErrorBoundary extends Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  constructor(props: ModelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Error loading 3D Model, hiding it from the scene:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

// URL del modello GLTF (Raw GitHub Link)
const MODEL_URL = 'https://raw.githubusercontent.com/vetrina72-byte/assets/main/land_rover_defender_90_lowpoly.glb';

// Interfaccia per la configurazione della scena
export interface SceneConfig {
    cameraPos: { x: number; y: number; z: number; };
    cameraTarget: { x: number; y: number; z: number; };
    modelPos: { x: number; y: number; z: number; };
    modelRot: { x: number; y: number; z: number; };
    modelScale: number;
}

export interface HeadlightConfig {
    x: number;
    y: number;
    z: number;
    angle: number;
    intensity: number;
    startWidth: number;
    endWidth: number;
    length: number;
    startHeight: number;
    endHeight: number;
    fade: number;
    separation: number;
    circular: boolean;
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
          // Attempt to handle windows/glass
          if (name.includes('window') || name.includes('glass') || name.includes('windshield')) {
            mat.transparent = true;
            mat.opacity = 0.5;
            mat.roughness = 0.1;
            mat.metalness = 0.9;
            mat.color.set('#111111');
            child.castShadow = false; // Usually looks better if glass doesn't cast hard shadows
          }
          // Attempt to handle lights
          if (name.includes('light') || name.includes('lamp') || name.includes('emission')) {
            // Basic heuristic for tail lights vs headlights based on name or position could go here
            // For now, make them all emissive
            if (name.includes('red') || name.includes('tail') || name.includes('rear') || name.includes('brake')) {
                 mat.color.set('#ff0000');
                 mat.emissive = new THREE.Color('#ff0000');
            } else {
                 mat.emissive = new THREE.Color('#ffffff');
            }
            mat.toneMapped = false;
            lightMats.current[mat.uuid] = mat;
          }
        }
      }
    });
  }, [scene]);

  useFrame((_, delta) => {
    const target = isNight ? 5.0 : 0.0;
    const damp = 1 - Math.exp(-2 * delta);
    Object.values(lightMats.current).forEach((mat: THREE.MeshStandardMaterial) => {
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

// This component adjusts the camera's Field of View based on the aspect ratio
// to ensure the scene composition remains consistent across different screen sizes.
function CameraController() {
    const { camera, size } = useThree();
    useEffect(() => {
        if (camera instanceof THREE.PerspectiveCamera) {
            const aspect = size.width / size.height;
            // On tall/narrow screens (portrait), widen the FOV to prevent the scene
            // from feeling too zoomed in. On wide screens, use the default FOV.
            camera.fov = aspect < 1 ? 48 / aspect : 48;
            camera.updateProjectionMatrix();
        }
    }, [size, camera]);
    return null;
}


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
            modelRot: { ...prev.modelRot, y: prev.modelRot.y + dx * 0.0012 },
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
      const targetPosition = new THREE.Vector3(
        activeConfig.cameraPos.x,
        activeConfig.cameraPos.y,
        activeConfig.cameraPos.z
      );
      const offset = new THREE.Vector3().subVectors(targetPosition, tgt);

      const targetRadius = offset.length();
      const targetPhi = Math.acos(offset.y / targetRadius);
      const targetTheta = Math.atan2(offset.x, offset.z);

      const currentRadius = ctrl.getDistance();
      const currentPhi = ctrl.getPolarAngle();
      const currentTheta = ctrl.getAzimuthalAngle();
      
      const newRadius = THREE.MathUtils.lerp(currentRadius, targetRadius, damp);
      const newPhi = THREE.MathUtils.lerp(currentPhi, targetPhi, damp);
      
      let deltaTheta = targetTheta - currentTheta;
      if (deltaTheta > Math.PI) deltaTheta -= 2 * Math.PI;
      if (deltaTheta < -Math.PI) deltaTheta += 2 * Math.PI;
      const newTheta = currentTheta + deltaTheta * damp;
      
      const newPosition = new THREE.Vector3()
        .setFromSphericalCoords(newRadius, newPhi, newTheta)
        .add(ctrl.target);

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
  weatherCondition,
  dayFogNear,
  dayFogFar,
  sceneColors,
  targetWeatherParams,
}: {
  isNight: boolean;
  floorRef: React.RefObject<THREE.Mesh>;
  ambientLightRef: React.RefObject<THREE.AmbientLight>;
  frontLightRef: React.RefObject<THREE.SpotLight>;
  directionalLightRef: React.RefObject<THREE.DirectionalLight>;
  nightAmbientIntensity: number;
  nightFrontLightIntensity: number;
  nightEnvironmentIntensity: number;
  weatherCondition: string;
  dayFogNear: number;
  dayFogFar: number;
  sceneColors: SceneColors;
  targetWeatherParams: WeatherParams;
}) {
  const { scene } = useThree();
  const targetSky = useRef(new THREE.Color()).current;
  const targetFloor = useRef(new THREE.Color()).current;

  // Default Day Values
  const dayAmbientIntensity = 0.8;
  const dayFrontLightIntensity = 0.8;
  const dayDirectionalIntensity = 0.8;
  const dayEnvironmentIntensity = 2.5;
  
  useEffect(() => {
    if (!scene.background) {
        scene.background = new THREE.Color('#ffffff');
    }
  }, [scene]);

  const getWeatherKey = useCallback((condition: string): string => {
    const lowerCond = condition.toLowerCase();
    if (lowerCond.includes('temporale')) return 'Temporale';
    if (lowerCond.includes('pioggia') || lowerCond.includes('rovescio') || lowerCond.includes('pioggerella')) return 'Pioggia';
    if (lowerCond.includes('grandine')) return 'Grandine';
    if (lowerCond.includes('neve')) return 'Neve';
    if (lowerCond.includes('nebbia')) return 'Nebbia';
    return 'Cielo sereno';
  }, []);

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-1.5 * delta);
    
    const weatherKey = getWeatherKey(weatherCondition);
    const timeKey = isNight ? 'night' : 'day';
    const colors = sceneColors[timeKey][weatherKey] || sceneColors[timeKey]['Cielo sereno'];
    
    targetSky.set(colors.sky);
    targetFloor.set(colors.floor);

    let targetAmbientIntensity: number, 
        targetFrontLightIntensity: number, 
        targetDirectionalIntensity: number, 
        targetEnvIntensity: number, 
        targetMirror: number;
    let targetFog: { near: number; far: number } | null = null;
    
    const isOvercast = /temporale|pioggia|rovescio|grandine|neve|nebbia/i.test(weatherKey);

    if (isNight) {
        targetAmbientIntensity = nightAmbientIntensity;
        targetFrontLightIntensity = nightFrontLightIntensity;
        targetDirectionalIntensity = 0;
        targetEnvIntensity = nightEnvironmentIntensity;
        targetMirror = 0;
        targetFog = { near: 15, far: 70 }; // Blending fog for all night conditions
    } else {
        // Default DAY values
        targetAmbientIntensity = dayAmbientIntensity;
        targetFrontLightIntensity = dayFrontLightIntensity;
        targetDirectionalIntensity = dayDirectionalIntensity;
        targetEnvIntensity = dayEnvironmentIntensity;
        targetMirror = 0.8;
        
        // Use debug controls for clear day, otherwise use weather config
        const fogNear = isOvercast ? targetWeatherParams.fogNear : dayFogNear;
        const fogFar = isOvercast ? targetWeatherParams.fogFar : dayFogFar;
        targetFog = { near: fogNear, far: fogFar };

        // DAY WEATHER OVERRIDES for lighting
        if (weatherKey === 'Temporale') {
            targetAmbientIntensity *= 0.5;
            targetDirectionalIntensity = 0.1;
            targetEnvIntensity = 0.6;
            targetMirror = 0;
        } else if (weatherKey === 'Pioggia') {
            targetAmbientIntensity *= 0.4;
            targetDirectionalIntensity *= 0.1;
            targetEnvIntensity *= 0.5;
            targetMirror = 0;
        } else if (weatherKey === 'Grandine') {
            targetAmbientIntensity *= 0.5;
            targetDirectionalIntensity *= 0.2;
            targetEnvIntensity *= 0.6;
            targetMirror = 0.1;
        } else if (weatherKey === 'Neve') {
            targetAmbientIntensity *= 0.8;
            targetDirectionalIntensity *= 0.4;
            targetEnvIntensity *= 1.2;
            targetMirror = 0.2;
        } else if (weatherKey === 'Nebbia') {
            targetAmbientIntensity *= 0.6;
            targetDirectionalIntensity *= 0.2;
            targetEnvIntensity *= 0.8;
            targetMirror = 0.1;
        }
    }
    
    // --- LERP VALUES TO APPLY ---
    if (scene.background instanceof THREE.Color) scene.background.lerp(targetSky, t);
    
    const floorMat = floorRef.current!.material as any;
    floorMat.color.lerp(targetFloor, t);
    floorMat.mirror = THREE.MathUtils.lerp(floorMat.mirror, targetMirror, t);
    
    if (ambientLightRef.current) ambientLightRef.current.intensity = THREE.MathUtils.lerp(ambientLightRef.current.intensity, targetAmbientIntensity, t);
    if (frontLightRef.current) frontLightRef.current.intensity = THREE.MathUtils.lerp(frontLightRef.current.intensity, targetFrontLightIntensity, t);
    if (directionalLightRef.current) directionalLightRef.current.intensity = THREE.MathUtils.lerp(directionalLightRef.current.intensity, targetDirectionalIntensity, t);
    scene.environmentIntensity = THREE.MathUtils.lerp(scene.environmentIntensity, targetEnvIntensity, t);
    
    // FOG MUST BE APPLIED LAST
    if (targetFog) {
        if (!scene.fog) {
            scene.fog = new THREE.Fog(targetSky, targetFog.near, targetFog.far);
        }
        const fog = scene.fog as THREE.Fog;
        // CRASH FIX: Use a reliable THREE.Color object for the fog color, not the scene background
        // which could be a texture or null, causing a 'Cannot read properties of null' error.
        fog.color.copy(targetSky); 
        fog.near = THREE.MathUtils.lerp(fog.near, targetFog.near, t);
        fog.far = THREE.MathUtils.lerp(fog.far, targetFog.far, t);
    } else {
        if (scene.fog) {
            scene.fog = null;
        }
    }
  });

  return null;
}

interface VehicleCanvasProps {
  isAppOpen: boolean;
  isNight: boolean;
  minOrbitDistance: number;
  maxOrbitDistance: number;
  appOpenConfig: SceneConfig;
  homeConfig: SceneConfig;
  sceneColors: SceneColors;
  nightAmbientIntensity: number;
  nightFrontLightIntensity: number;
  nightEnvironmentIntensity: number;
  onInteractionChange?: (isInteracting: boolean) => void;
  effectiveWeatherCondition: string;
  dayFogNear: number;
  dayFogFar: number;
  targetWeatherParams: WeatherParams;
  uiScale: number;
  headlightConfig: HeadlightConfig;
}

export default function VehicleCanvas({
  isAppOpen,
  isNight,
  minOrbitDistance,
  maxOrbitDistance,
  appOpenConfig: appOpenConfigFromProps,
  homeConfig,
  sceneColors,
  nightAmbientIntensity,
  nightFrontLightIntensity,
  nightEnvironmentIntensity,
  onInteractionChange,
  effectiveWeatherCondition,
  dayFogNear,
  dayFogFar,
  targetWeatherParams,
  uiScale,
  headlightConfig,
}: VehicleCanvasProps) {
  const modelRef = useRef<THREE.Group>(null!);
  const floorRef = useRef<THREE.Mesh>(null!);
  const ambientLightRef = useRef<THREE.AmbientLight>(null!);
  const frontLightRef = useRef<THREE.SpotLight>(null!);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null!);
  const frontLightTarget = useMemo(() => new THREE.Object3D(), []);
  
  const { x, y, z, angle, intensity, startWidth, endWidth, length, startHeight, endHeight, fade, separation, circular } = headlightConfig;

  const beamRoll = 0;
  
  const shadowPosition = { x: 0, y: 0.02, z: 0 };
  const shadowOpacity = 0.8;

  const initialConfig = useMemo(() => {
    if (uiScale === 1.0) {
      return homeConfig;
    }
    // As scale decreases (e.g., 0.8), zoomFactor increases (1.25), moving camera further away.
    const zoomFactor = 1 / uiScale;
    return {
      ...homeConfig,
      cameraPos: {
        x: homeConfig.cameraPos.x * zoomFactor,
        y: homeConfig.cameraPos.y, // Keep Y the same to avoid weird angles
        z: homeConfig.cameraPos.z * zoomFactor,
      },
    };
  }, [uiScale, homeConfig]);

  const [runtimeAppOpenConfig, setRuntimeAppOpenConfig] = useState<SceneConfig>(appOpenConfigFromProps);

  useEffect(() => {
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
          <MemoizedEnvironment />
          <WeatherEffects targetParams={targetWeatherParams} effectiveWeatherCondition={effectiveWeatherCondition} />
        </Suspense>

        <ModelErrorBoundary>
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
                <planeGeometry args={[20, 20]} />
                <shadowMaterial transparent opacity={shadowOpacity} />
              </mesh>
              
              {separation > 0 ? (
                <>
                    <VolumetricHeadlight
                        position={[x - separation / 2, y, z]}
                        beamLength={length}
                        beamAngle={angle}
                        beamRoll={beamRoll}
                        intensity={intensity}
                        fade={fade}
                        visible={isNight} 
                        beamStartWidth={startWidth}
                        beamEndWidth={endWidth}
                        beamStartHeight={startHeight}
                        beamEndHeight={endHeight}
                        circular={circular}
                    />
                     <VolumetricHeadlight
                        position={[x + separation / 2, y, z]}
                        beamLength={length}
                        beamAngle={angle}
                        beamRoll={beamRoll}
                        intensity={intensity}
                        fade={fade}
                        visible={isNight} 
                        beamStartWidth={startWidth}
                        beamEndWidth={endWidth}
                        beamStartHeight={startHeight}
                        beamEndHeight={endHeight}
                        circular={circular}
                    />
                </>
              ) : (
                 <VolumetricHeadlight
                    position={[x, y, z]}
                    beamLength={length}
                    beamAngle={angle}
                    beamRoll={beamRoll}
                    intensity={intensity}
                    fade={fade}
                    visible={isNight} 
                    beamStartWidth={startWidth}
                    beamEndWidth={endWidth}
                    beamStartHeight={startHeight}
                    beamEndHeight={endHeight}
                    circular={circular}
                />
              )}

              <primitive object={frontLightTarget} position={[0, 0, 10]} />
            </group>
          </Suspense>
        </ModelErrorBoundary>

        <CameraController />
        <OrbitControls 
            makeDefault
            enablePan={false} 
            minPolarAngle={Math.PI / 2.8} // Limit vertical rotation to avoid going under the floor
            maxPolarAngle={Math.PI / 2.1} 
            minDistance={minOrbitDistance}
            maxDistance={maxOrbitDistance}
            enableZoom={true}
            enableRotate={!isAppOpen} // Disable manual rotation when app is open (locked view)
        />

        <ambientLight ref={ambientLightRef} intensity={0.5} />
        <spotLight
          ref={frontLightRef}
          position={[0, 5, 0]}
          angle={0.5}
          penumbra={0.5}
          intensity={1}
          castShadow
          shadow-bias={-0.0001}
        />
        <directionalLight
            ref={directionalLightRef}
            position={[-5, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
        />
        
        {/* Reflective Floor */}
        <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]} receiveShadow>
          <planeGeometry args={[300, 300]} />
          <MeshReflectorMaterial
            blur={[400, 400]}
            resolution={1024}
            mixBlur={1}
            mixStrength={1.5} // Reduced strength to avoid over-bright reflections
            roughness={0.5} // Increased roughness for a matte-like floor
            depthScale={1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#101010"
            metalness={0.2}
            mirror={0.7} // Controlled by EnvironmentController
          />
        </mesh>

        <EnvironmentController 
            isNight={isNight} 
            floorRef={floorRef}
            ambientLightRef={ambientLightRef}
            frontLightRef={frontLightRef}
            directionalLightRef={directionalLightRef}
            nightAmbientIntensity={nightAmbientIntensity}
            nightFrontLightIntensity={nightFrontLightIntensity}
            nightEnvironmentIntensity={nightEnvironmentIntensity}
            weatherCondition={effectiveWeatherCondition}
            dayFogNear={dayFogNear}
            dayFogFar={dayFogFar}
            sceneColors={sceneColors}
            targetWeatherParams={targetWeatherParams}
        />
        <SceneController 
            isAppOpen={isAppOpen} 
            activeConfig={activeConfig}
            setAppOpenConfig={setRuntimeAppOpenConfig}
            modelRef={modelRef}
            frontLightTarget={frontLightTarget}
            originalAppOpenConfig={initialConfig}
            onInteractionChange={onInteractionChange}
        />
      </Canvas>
    </>
  );
}
useGLTF.preload(MODEL_URL);
