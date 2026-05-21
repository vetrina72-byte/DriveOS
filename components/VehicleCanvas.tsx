
import React, { Suspense, useEffect, useRef, useState, forwardRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { VolumetricHeadlight } from './VolumetricHeadlight';
import WeatherEffects from './WeatherEffects';
import type { SceneColors } from '../App';
import type { WeatherParams } from '../types';

// Fix: Definitions for R3F intrinsic elements to bypass JSX.IntrinsicElements errors
const Primitive = 'primitive' as any;
const Group = 'group' as any;
const Mesh = 'mesh' as any;
const PlaneGeometry = 'planeGeometry' as any;
const ShadowMaterial = 'shadowMaterial' as any;
const AmbientLight = 'ambientLight' as any;
const SpotLight = 'spotLight' as any;
const DirectionalLight = 'directionalLight' as any;

// Simple Error Boundary for the 3D model
interface ModelErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ModelErrorBoundaryState {
  hasError: boolean;
}

class ModelErrorBoundary extends React.Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  state: ModelErrorBoundaryState = { hasError: false };
  props: ModelErrorBoundaryProps; // Explicitly declared props

  constructor(props: ModelErrorBoundaryProps) {
    super(props);
    this.props = props;
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

// URL del modello GLTF (Raw GitHub Link) - VOLVO EX30
const MODEL_URL = 'https://raw.githubusercontent.com/vetrina72-byte/assets/main/volvo_ex30.glb';

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
    yaw: number; // Individual lateral tilt
    assemblyYaw: number; // Entire assembly rotation (360 deg)
    intensity: number;
    startWidth: number;
    endWidth: number;
    length: number;
    startHeight: number;
    endHeight: number;
    fade: number;
    separation: number;
    circular: boolean;
    linked: boolean; // Toggle rotation link with model
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
          
          // Boost environment reflections to better reflect the surroundings
          mat.envMapIntensity = 2.5;
          if (name.includes('paint') || name.includes('body') || name.includes('car') || name.includes('metal')) {
              mat.metalness = Math.max(mat.metalness || 0, 0.7);
              mat.roughness = Math.min(mat.roughness || 1, 0.2);
          }

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
    // Fix: Replaced 'primitive' with locally defined 'Primitive' constant to fix JSX.IntrinsicElements error
    <Primitive
      ref={ref}
      object={scene}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={scale}
    />
  );
});
Model.displayName = 'Model';



function SceneController({
  isAppOpen, activeConfig, homeConfig, appOpenConfig, modelRef,
  frontLightTarget, onInteractionChange, dragProgress
}: {
  isAppOpen: boolean;
  activeConfig: SceneConfig; // This is primarily used when NO drag is happening (auto mode)
  homeConfig: SceneConfig;
  appOpenConfig: SceneConfig;
  modelRef: React.RefObject<THREE.Group>;
  frontLightTarget: THREE.Object3D;
  onInteractionChange?: (isInteracting: boolean) => void;
  dragProgress: React.MutableRefObject<number | null>;
}) {
  const { camera, controls, gl, size } = useThree();
  const [interacting, setInteracting] = useState(false);
  const interactTimeout = useRef<number | null>(null);

  // Velocità di animazione fisse (Smooth 0.4 - 0.5s ease-out)
  const openingCameraSpeed = 6.0; 
  const closingCameraSpeed = 5.0; 

  // Helper vectors for interpolation
  const vec3A = useMemo(() => new THREE.Vector3(), []);
  const vec3B = useMemo(() => new THREE.Vector3(), []);
  const vec3C = useMemo(() => new THREE.Vector3(), []);
  const sphA = useMemo(() => new THREE.Spherical(), []);
  const sphB = useMemo(() => new THREE.Spherical(), []);
  const quatA = useMemo(() => new THREE.Quaternion(), []);
  const quatB = useMemo(() => new THREE.Quaternion(), []);
  const eulerA = useMemo(() => new THREE.Euler(), []);
  const eulerB = useMemo(() => new THREE.Euler(), []);

  const dynamicHomePos = useRef(new THREE.Vector3());
  const dynamicHomeTarget = useRef(new THREE.Vector3());
  const initializedDynamicHome = useRef(false);

  const isRestoringHome = useRef(false);
  const restoreAnimProgress = useRef(1.0);
  const snapshotHomePos = useRef(new THREE.Vector3());
  const snapshotHomeTarget = useRef(new THREE.Vector3());

  // Gestione interazione orbit controls
  useEffect(() => {
    const ctrl = (controls as any);
    if (!ctrl) return;
    
    // Se l'app è aperta blocchiamo le interazioni manuali del canvas 3D
    if (isAppOpen) {
        isRestoringHome.current = false;
        return;
    }

    const onStart = () => {
      setInteracting(true);
      onInteractionChange?.(true);
      isRestoringHome.current = false;
      if (interactTimeout.current) clearTimeout(interactTimeout.current);
    };
    const onEnd = () => {
      // Rilasciamo i controlli e le logiche immediatamente
      setInteracting(false);
      onInteractionChange?.(false);
      
      if (interactTimeout.current) clearTimeout(interactTimeout.current);
      // Iniziamo il contatore per ripristinare la home (10 secondi)
      interactTimeout.current = window.setTimeout(() => {
        if (!isAppOpen) {
            snapshotHomePos.current.copy(camera.position);
            if (controls) snapshotHomeTarget.current.copy((controls as any).target);
            isRestoringHome.current = true;
            restoreAnimProgress.current = 0;
        }
      }, 10000);
    };
    
    ctrl.addEventListener('start', onStart);
    ctrl.addEventListener('end', onEnd);
    return () => {
      ctrl.removeEventListener('start', onStart);
      ctrl.removeEventListener('end', onEnd);
      if (interactTimeout.current) clearTimeout(interactTimeout.current);
    };
  }, [controls, isAppOpen, onInteractionChange, camera.position]);

  const prevIsAppOpen = useRef(isAppOpen);
  const transitionMode = useRef<'idle' | 'auto' | 'drag'>('idle');
  const animTime = useRef(0);
  
  const frozenCamPos = useRef(new THREE.Vector3());
  const frozenCamTarget = useRef(new THREE.Vector3());
  const frozenModelScale = useRef<number>(1);
  const frozenModelRot = useRef(new THREE.Quaternion());

  // Inizializzazione home al primo avvio is now handled inside useFrame

  // Helper per interpolare tutto (Camera e Modello)
  const applyInterpolation = (
      startCamPos: THREE.Vector3, startCamTarget: THREE.Vector3, startScale: number, startQuat: THREE.Quaternion,
      endCamPos: THREE.Vector3, endCamTarget: THREE.Vector3, endScale: number, endQuat: THREE.Quaternion,
      t: number, ctrl: any
  ) => {
      // 1. Camera Target (Lineare)
      vec3C.lerpVectors(startCamTarget, endCamTarget, t);
      
      // 2. Camera Pos (Sferica)
      vec3A.copy(endCamPos).sub(endCamTarget);
      vec3B.copy(startCamPos).sub(startCamTarget);
      
      sphA.setFromVector3(vec3B); // Start
      sphB.setFromVector3(vec3A); // End
      
      let thetaA = sphA.theta;
      let thetaB = sphB.theta;
      
      let diff = thetaB - thetaA;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      const r = THREE.MathUtils.lerp(sphA.radius, sphB.radius, t);
      const t_path = thetaA + diff * t;
      const ph_path = THREE.MathUtils.lerp(sphA.phi, sphB.phi, t);

      camera.position.setFromSphericalCoords(r, ph_path, t_path).add(vec3C);
      
      if (ctrl) {
          ctrl.target.copy(vec3C);
          ctrl.update();
      }

      // 3. Modello 3D
      if (modelRef.current) {
          // Scala
          const s = THREE.MathUtils.lerp(startScale, endScale, t);
          modelRef.current.scale.set(s, s, s);
          
          // Posizione
          vec3A.set(appOpenConfig.modelPos.x, appOpenConfig.modelPos.y, appOpenConfig.modelPos.z);
          vec3B.set(homeConfig.modelPos.x, homeConfig.modelPos.y, homeConfig.modelPos.z);
          const pLinear = isAppOpen ? (1 - t) : t; // La posizione è legata alla modalità aperta/chiusa per semplicità (0: Open, 1: Home)
          // Se la destinazione è Home (endScale == homeConfig.modelScale), usa p=t ... wait
          // Compute a pure linear P per positions for simplicity
          let rawP = endScale === homeConfig.modelScale ? t : (1 - t); 
          if (isRestoringHome.current) rawP = 1;
          modelRef.current.position.lerpVectors(vec3A, vec3B, rawP);

          // Rotazione
          modelRef.current.quaternion.slerpQuaternions(startQuat, endQuat, t);
          
          frontLightTarget.position.copy(modelRef.current.position).add(new THREE.Vector3(0, 0.5, 0));
      }
  };

  // Pre-computiamo i target puri
  const quatTargetAppOpen = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(appOpenConfig.modelRot.x, appOpenConfig.modelRot.y, appOpenConfig.modelRot.z)), [appOpenConfig.modelRot]);
  const quatTargetHome = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(homeConfig.modelRot.x, homeConfig.modelRot.y, homeConfig.modelRot.z)), [homeConfig.modelRot]);

  // Animazione camera e modello
  useFrame((_, delta) => {
    const ctrl = typeof controls !== 'undefined' ? (controls as any) : null;
    
    if (!initializedDynamicHome.current && ctrl && modelRef.current) {
        const initConfig = isAppOpen ? appOpenConfig : homeConfig;
        
        dynamicHomePos.current.set(initConfig.cameraPos.x as number, initConfig.cameraPos.y as number, initConfig.cameraPos.z as number);
        dynamicHomeTarget.current.set(initConfig.cameraTarget.x as number, initConfig.cameraTarget.y as number, initConfig.cameraTarget.z as number);
        
        camera.position.set(initConfig.cameraPos.x as number, initConfig.cameraPos.y as number, initConfig.cameraPos.z as number);
        camera.updateProjectionMatrix();
        
        ctrl.target.set(initConfig.cameraTarget.x as number, initConfig.cameraTarget.y as number, initConfig.cameraTarget.z as number);
        ctrl.update();
        
        modelRef.current.scale.set(initConfig.modelScale, initConfig.modelScale, initConfig.modelScale);
        modelRef.current.quaternion.setFromEuler(new THREE.Euler(initConfig.modelRot.x, initConfig.modelRot.y, initConfig.modelRot.z));
        modelRef.current.position.set(initConfig.modelPos.x, initConfig.modelPos.y, initConfig.modelPos.z);
        frontLightTarget.position.copy(modelRef.current.position).add(new THREE.Vector3(0, 0.5, 0));
        
        // Se isAppOpen è true l'utente dovrebbe poter ruotare normalmente? No, a schermo intero rotea, ad app aperta no.
        ctrl.enableRotate = !isAppOpen;
        
        initializedDynamicHome.current = true;
    }

    // RILEVAMENTO EVENTI
    const clickOccurred = isAppOpen !== prevIsAppOpen.current;
    prevIsAppOpen.current = isAppOpen;
    const dragActive = dragProgress.current !== null;

    // SELEZIONE CANALE E GESTIONE TRANSIZIONI
    if (clickOccurred && !dragActive) {
        // CANALE 1: TRANSIZIONE DA CLICK
        transitionMode.current = 'auto';
        animTime.current = 0;
        isRestoringHome.current = false;
        if (ctrl) ctrl.enableRotate = false;

        // Congela istantaneamente la posizione reale prima di muoversi
        frozenCamPos.current.copy(camera.position);
        if (ctrl) frozenCamTarget.current.copy(ctrl.target);
        if (modelRef.current) {
            frozenModelScale.current = modelRef.current.scale.x;
            frozenModelRot.current.copy(modelRef.current.quaternion);
        }
    } 
    else if (dragActive) {
        // CANALE 2: TRANSIZIONE DA HANDLE (Drag)
        transitionMode.current = 'drag';
        isRestoringHome.current = false;
        if (ctrl) ctrl.enableRotate = false;
    } 
    else if (!clickOccurred && !dragActive && transitionMode.current === 'drag') {
        // RILASCIO HANDLE (o fine drag auto)
        transitionMode.current = 'idle'; 
        if (!isAppOpen) {
            // FORZATURA DEI VALORI REALI HOME A SCHERMO INTERO E UPDATE DELLA MATRICE
            camera.position.set(homeConfig.cameraPos.x as number, homeConfig.cameraPos.y as number, homeConfig.cameraPos.z as number);
            camera.updateProjectionMatrix();
            if (ctrl) {
                ctrl.target.set(homeConfig.cameraTarget.x as number, homeConfig.cameraTarget.y as number, homeConfig.cameraTarget.z as number);
                ctrl.enableRotate = true;
                ctrl.update();
            }
            if (modelRef.current) {
                modelRef.current.scale.set(homeConfig.modelScale, homeConfig.modelScale, homeConfig.modelScale);
                modelRef.current.quaternion.copy(quatTargetHome);
                vec3B.set(homeConfig.modelPos.x, homeConfig.modelPos.y, homeConfig.modelPos.z);
                modelRef.current.position.copy(vec3B);
                frontLightTarget.position.copy(vec3B).add(new THREE.Vector3(0, 0.5, 0));
            }
            // RISOLTO BUG B: Niente più copie da camera a riposo
            dynamicHomePos.current.set(homeConfig.cameraPos.x as number, homeConfig.cameraPos.y as number, homeConfig.cameraPos.z as number);
            dynamicHomeTarget.current.set(homeConfig.cameraTarget.x as number, homeConfig.cameraTarget.y as number, homeConfig.cameraTarget.z as number);
        }
    }

    // ESECUZIONE DEL CANALE ATTIVO
    let p = isAppOpen ? 0 : 1; // Default layout

    if (interacting) {
        // UTENTE MANOVRA A SCHERMO INTERO
        transitionMode.current = 'idle';
        // Forza l'orbit controls sul target di default
        if (ctrl) {
            ctrl.target.set(homeConfig.cameraTarget.x as number, homeConfig.cameraTarget.y as number, homeConfig.cameraTarget.z as number);
            ctrl.update();
        }
        dynamicHomePos.current.copy(camera.position);
        if (ctrl) dynamicHomeTarget.current.copy(ctrl.target);
        
        // Applica solo la rotazione di default al modello
        if (modelRef.current) {
            modelRef.current.scale.set(homeConfig.modelScale, homeConfig.modelScale, homeConfig.modelScale);
            modelRef.current.quaternion.copy(quatTargetHome);
            vec3B.set(homeConfig.modelPos.x, homeConfig.modelPos.y, homeConfig.modelPos.z);
            modelRef.current.position.copy(vec3B);
            frontLightTarget.position.copy(vec3B).add(new THREE.Vector3(0, 0.5, 0));
        }
    } 
    else if (transitionMode.current === 'auto') {
        // FLUSSO: CLICK - Forza la stessa identica durata (0.4s) e lo stesso easing delle app
        animTime.current += delta;
        let t = Math.min(animTime.current / 0.4, 1.0);
        const easeT = 1 - Math.pow(1 - t, 4); // power4.out

        if (t >= 1.0) {
            transitionMode.current = 'idle';
            if (!isAppOpen) {
                // FORZATURA DEI VALORI REALI HOME A SCHERMO INTERO E UPDATE DELLA MATRICE
                camera.position.set(homeConfig.cameraPos.x as number, homeConfig.cameraPos.y as number, homeConfig.cameraPos.z as number);
                camera.updateProjectionMatrix();
                if (ctrl) {
                    ctrl.target.set(homeConfig.cameraTarget.x as number, homeConfig.cameraTarget.y as number, homeConfig.cameraTarget.z as number);
                    ctrl.enableRotate = true;
                    ctrl.update();
                }
                if (modelRef.current) {
                    modelRef.current.scale.set(homeConfig.modelScale, homeConfig.modelScale, homeConfig.modelScale);
                    modelRef.current.quaternion.copy(quatTargetHome);
                    vec3B.set(homeConfig.modelPos.x, homeConfig.modelPos.y, homeConfig.modelPos.z);
                    modelRef.current.position.copy(vec3B);
                    frontLightTarget.position.copy(vec3B).add(new THREE.Vector3(0, 0.5, 0));
                }
                // RISOLTO BUG A riposo: niente overwrites da camera.position
                dynamicHomePos.current.set(homeConfig.cameraPos.x as number, homeConfig.cameraPos.y as number, homeConfig.cameraPos.z as number);
                dynamicHomeTarget.current.set(homeConfig.cameraTarget.x as number, homeConfig.cameraTarget.y as number, homeConfig.cameraTarget.z as number);
            } else {
                // App aperta
                dynamicHomePos.current.copy(camera.position);
                if (ctrl) dynamicHomeTarget.current.copy(ctrl.target);
            }
        }

        // Determina target fisso
        const endPos = new THREE.Vector3(
            isAppOpen ? appOpenConfig.cameraPos.x : homeConfig.cameraPos.x,
            isAppOpen ? appOpenConfig.cameraPos.y : homeConfig.cameraPos.y,
            isAppOpen ? appOpenConfig.cameraPos.z : homeConfig.cameraPos.z
        );
        const endTarget = new THREE.Vector3(
            isAppOpen ? appOpenConfig.cameraTarget.x : homeConfig.cameraTarget.x,
            isAppOpen ? appOpenConfig.cameraTarget.y : homeConfig.cameraTarget.y,
            isAppOpen ? appOpenConfig.cameraTarget.z : homeConfig.cameraTarget.z
        );
        const endScale = isAppOpen ? appOpenConfig.modelScale : homeConfig.modelScale;
        const endQuat = isAppOpen ? quatTargetAppOpen : quatTargetHome;

        applyInterpolation(
            frozenCamPos.current, frozenCamTarget.current, frozenModelScale.current, frozenModelRot.current,
            endPos, endTarget, endScale, endQuat,
            easeT, ctrl
        );
        
        p = isAppOpen ? (1 - easeT) : easeT;
    }
    else if (transitionMode.current === 'drag') {
        // FLUSSO: DRAG
        let rawP = dragProgress.current as number;
        rawP = Math.max(0, Math.min(1, rawP));

        // Partenza (App Aperta: p=0) / Destinazione (Home: p=1) rigida
        const sPos = new THREE.Vector3(appOpenConfig.cameraPos.x, appOpenConfig.cameraPos.y, appOpenConfig.cameraPos.z);
        const sTarget = new THREE.Vector3(appOpenConfig.cameraTarget.x, appOpenConfig.cameraTarget.y, appOpenConfig.cameraTarget.z);
        
        const ePos = new THREE.Vector3(homeConfig.cameraPos.x, homeConfig.cameraPos.y, homeConfig.cameraPos.z);
        const eTarget = new THREE.Vector3(homeConfig.cameraTarget.x, homeConfig.cameraTarget.y, homeConfig.cameraTarget.z);

        applyInterpolation(
            sPos, sTarget, appOpenConfig.modelScale, quatTargetAppOpen,
            ePos, eTarget, homeConfig.modelScale, quatTargetHome,
            rawP, ctrl
        );
        
        p = rawP;
    }
    else if (isRestoringHome.current) {
        // FLUSSO: RIPRISTINO AUTO DOPO INATTIVITÀ (8s)
        restoreAnimProgress.current += delta;
        if (restoreAnimProgress.current < 1.4) {
            const t = Math.min(restoreAnimProgress.current / 1.4, 1.0);
            const easeT = 1 - Math.pow(1 - t, 4);
            
            const ePos = new THREE.Vector3(homeConfig.cameraPos.x, homeConfig.cameraPos.y, homeConfig.cameraPos.z);
            const eTarget = new THREE.Vector3(homeConfig.cameraTarget.x, homeConfig.cameraTarget.y, homeConfig.cameraTarget.z);

            applyInterpolation(
                snapshotHomePos.current, snapshotHomeTarget.current, homeConfig.modelScale, quatTargetHome, // Parte dal vecchio home
                ePos, eTarget, homeConfig.modelScale, quatTargetHome,
                easeT, ctrl
            );
        } else {
            isRestoringHome.current = false;
            // Snappa
            vec3A.set(homeConfig.cameraPos.x as number, homeConfig.cameraPos.y as number, homeConfig.cameraPos.z as number);
            camera.position.copy(vec3A);
            camera.updateProjectionMatrix();
            if (ctrl) {
                 vec3B.set(homeConfig.cameraTarget.x as number, homeConfig.cameraTarget.y as number, homeConfig.cameraTarget.z as number);
                 ctrl.target.copy(vec3B);
                 ctrl.enableRotate = true;
                 ctrl.update();
            }
            dynamicHomePos.current.set(homeConfig.cameraPos.x as number, homeConfig.cameraPos.y as number, homeConfig.cameraPos.z as number);
            dynamicHomeTarget.current.set(homeConfig.cameraTarget.x as number, homeConfig.cameraTarget.y as number, homeConfig.cameraTarget.z as number);
        }
        p = 1;
    }
    else {
        // IDLE
        if (!isAppOpen && ctrl) ctrl.enableRotate = true;
    }

    // 4. Viewport & Aspect Ratio dinamico dal DOM - Forza gl.setSize esattamente alla larghezza corrente frame-per-frame
    const canvas = gl.domElement;
    const container = canvas.parentElement;
    if (container) {
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        
        // Calcola la porzione di schermo visibile in larghezza (da 1/3 a screen_width)
        const visibleWidth = Math.round(cw * (1 / 3) + cw * (2 / 3) * p);

        // Forza il ridimensionamento fisico e l'aggiornamento degli stili CSS del Canvas ad ogni singolo frame
        if (canvas.width !== visibleWidth || canvas.height !== ch) {
            gl.setSize(visibleWidth, ch, true);
        }

        // Ricalcolo della matrice con FOV fisso per evitare distorsioni "a step"
        if (camera instanceof THREE.PerspectiveCamera) {
            const aspect = visibleWidth / ch;
            if (camera.aspect !== aspect) {
                camera.aspect = aspect;
                // Manteniamo un FOV costante per una traiettoria fluida e naturale
                camera.fov = 48; 
                camera.updateProjectionMatrix();
            }
        }

        // Con il ridimensionamento fisico del Canvas, lo Scissor Test non serve più,
        // ma impostiamo comunque il viewport e disabilitiamo lo Scissor Test per prestazioni ottimali.
        gl.setViewport(0, 0, visibleWidth, ch);
        gl.setScissorTest(false);
    }
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
  const { scene, gl } = useThree();
  const targetSky = useRef(new THREE.Color()).current;
  const targetFloor = useRef(new THREE.Color()).current;
  const currentEnvColor = useRef(new THREE.Color('#ffffff')).current;

  // Default Day Values
  const dayAmbientIntensity = 0.5;
  const dayFrontLightIntensity = 0.6;
  const dayDirectionalIntensity = 1.5;
  const dayEnvironmentIntensity = 2.8;
  
  useEffect(() => {
    scene.background = null; // Disable scene background so clearColor and transparent canvas shows HTML background correctly when scissor is false
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

    currentEnvColor.lerp(targetSky, t);
    
    // Usa gl.setClearColor con clearAlpha = 0 (trasparente) in modo che il gradiente CSS nello sfondo mostri le sfumature in modo continuo
    gl.setClearColor(currentEnvColor, 0);

    // Costruisci il gradiente CSS che copia esattamente gli stessi identici colori e sfumature usati per il cielo 3D
    const hexColor = '#' + currentEnvColor.getHexString();
    let gradientCss = '';
    
    if (!isNight) {
        // Giorno (Day) sky shades - sfuma con i colori chiari del cielo diurno (colore bianco per il cielo sereno)
        if (weatherKey === 'Cielo sereno') {
            gradientCss = `linear-gradient(to bottom, #ffffff 0%, ${hexColor} 100%)`;
        } else if (weatherKey === 'Pioggia') {
            gradientCss = `linear-gradient(to bottom, #414347 0%, ${hexColor} 100%)`;
        } else if (weatherKey === 'Temporale') {
            gradientCss = `linear-gradient(to bottom, #2e3137 0%, ${hexColor} 100%)`;
        } else if (weatherKey === 'Neve') {
            gradientCss = `linear-gradient(to bottom, #8a8a8a 0%, ${hexColor} 100%)`;
        } else if (weatherKey === 'Grandine') {
            gradientCss = `linear-gradient(to bottom, #7f7f85 0%, ${hexColor} 100%)`;
        } else if (weatherKey === 'Nebbia') {
            gradientCss = `linear-gradient(to bottom, #949ca4 0%, ${hexColor} 100%)`;
        } else {
            gradientCss = `linear-gradient(to bottom, #ffffff 0%, ${hexColor} 100%)`;
        }
    } else {
        // Notte (Night) sky shades - sfuma con i colori scuri e profondi del cielo notturno
        if (weatherKey === 'Cielo sereno') {
            gradientCss = `linear-gradient(to bottom, #030408 0%, ${hexColor} 100%)`;
        } else {
            gradientCss = `linear-gradient(to bottom, #010204 0%, ${hexColor} 100%)`;
        }
    }

    // Sync HTML background
    const container = document.getElementById('main-app-container');
    if (container) {
        container.style.background = gradientCss;
    }
    // Also sync the body background to prevent dark bars when container resizes
    document.body.style.background = gradientCss;
    const rootEl = document.getElementById('root');
    if (rootEl) {
        rootEl.style.background = gradientCss;
    }

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
        targetFog = { near: 15, far: 800 }; 
    } else {
        // Default DAY values
        targetAmbientIntensity = dayAmbientIntensity;
        targetFrontLightIntensity = dayFrontLightIntensity;
        targetDirectionalIntensity = dayDirectionalIntensity;
        targetEnvIntensity = dayEnvironmentIntensity;
        targetMirror = 0.8;
        
        const fogNear = isOvercast ? targetWeatherParams.fogNear : dayFogNear;
        const fogFar = isOvercast ? targetWeatherParams.fogFar : dayFogFar;
        targetFog = { near: fogNear, far: fogFar };

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
    
    if (scene.background instanceof THREE.Color) {
        scene.background.lerp(targetSky, t);
    }
    
    const floorMat = floorRef.current!.material as any;
    floorMat.color.lerp(targetFloor, t);
    floorMat.mirror = THREE.MathUtils.lerp(floorMat.mirror, targetMirror, t);
    
    if (ambientLightRef.current) {
        ambientLightRef.current.intensity = THREE.MathUtils.lerp(ambientLightRef.current.intensity, targetAmbientIntensity, t);
        ambientLightRef.current.color.copy(currentEnvColor);
    }
    if (frontLightRef.current) {
        frontLightRef.current.intensity = THREE.MathUtils.lerp(frontLightRef.current.intensity, targetFrontLightIntensity, t);
    }
    if (directionalLightRef.current) {
        directionalLightRef.current.intensity = THREE.MathUtils.lerp(directionalLightRef.current.intensity, targetDirectionalIntensity, t);
        const blendedLightColor = new THREE.Color('#ffffff').lerp(currentEnvColor, 0.4);
        directionalLightRef.current.color.copy(blendedLightColor);
    }
    scene.environmentIntensity = THREE.MathUtils.lerp(scene.environmentIntensity, targetEnvIntensity, t);
    
    if (targetFog) {
        if (!scene.fog) {
            scene.fog = new THREE.Fog(currentEnvColor, targetFog.near, targetFog.far);
        }
        const fog = scene.fog as THREE.Fog;
        fog.color.copy(currentEnvColor);
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
  dragProgress: React.MutableRefObject<number | null>;
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
  dragProgress,
}: VehicleCanvasProps) {
  const modelRef = useRef<THREE.Group>(null!);
  const floorRef = useRef<THREE.Mesh>(null!);
  const ambientLightRef = useRef<THREE.AmbientLight>(null!);
  const frontLightRef = useRef<THREE.SpotLight>(null!);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null!);
  const frontLightTarget = useMemo(() => new THREE.Object3D(), []);
  
  const { x, y, z, angle, yaw, assemblyYaw, intensity, startWidth, endWidth, length, startHeight, endHeight, fade, separation, circular, linked } = headlightConfig;

  const beamRoll = 0;
  
  const shadowPosition = { x: 0, y: 0.02, z: 0 };
  const shadowOpacity = 0.8;

  const initialConfig = useMemo(() => {
    if (uiScale === 1.0) {
      return homeConfig;
    }
    const zoomFactor = 1 / uiScale;
    return {
      ...homeConfig,
      cameraPos: {
        x: homeConfig.cameraPos.x * zoomFactor,
        y: homeConfig.cameraPos.y,
        z: homeConfig.cameraPos.z * zoomFactor,
      },
    };
  }, [uiScale, homeConfig]);

  const defaultOrbitTarget = useMemo(() => [initialConfig.cameraTarget.x, initialConfig.cameraTarget.y, initialConfig.cameraTarget.z] as [number, number, number], [initialConfig]);

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

  // Headlight rendering extracted for clean conditional rendering
  // The assemblyYaw rotates the entire group of headlights as a single unit
  const renderHeadlights = () => (
    // Fix: Replaced 'group' with locally defined 'Group' constant to fix JSX.IntrinsicElements error
    <Group rotation={[0, assemblyYaw, 0]}>
      {separation > 0 ? (
        <>
            <VolumetricHeadlight
                position={[x - separation / 2, y, z]}
                beamLength={length}
                beamAngle={angle}
                beamYaw={yaw}
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
                beamYaw={yaw}
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
            beamYaw={yaw}
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
    </Group>
  );

  return (
    <>
      <Canvas 
        className="absolute inset-0" style={{ zIndex: 0 }}
        shadows={{ type: THREE.PCFSoftShadowMap }} camera={{ fov: 48, far: 8000, position: [initialConfig.cameraPos.x, initialConfig.cameraPos.y, initialConfig.cameraPos.z] }}>
        <Suspense fallback={null}>
          <MemoizedEnvironment />
          <WeatherEffects targetParams={targetWeatherParams} effectiveWeatherCondition={effectiveWeatherCondition} />
        </Suspense>

        <ModelErrorBoundary>
          <Suspense fallback={null}>
            {/* Fix: Replaced 'group' with locally defined 'Group' constant to fix JSX.IntrinsicElements error */}
            <Group ref={modelRef}>
              <Model
                position={{ x: 0, y: 0, z: 0 }}
                rotation={{ x: 0, y: 0, z: 0 }}
                scale={1}
                isNight={isNight}
              />

              {/* Fix: Replaced intrinsic elements with locally defined constants to fix JSX.IntrinsicElements error */}
              <Mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[shadowPosition.x, shadowPosition.y, shadowPosition.z]}>
                <PlaneGeometry args={[20, 20]} />
                <ShadowMaterial transparent opacity={shadowOpacity} />
              </Mesh>
              
              {/* Linked headlights follow the model's group rotation */}
              {linked && renderHeadlights()}

              {/* Fix: Replaced 'primitive' with locally defined 'Primitive' constant to fix JSX.IntrinsicElements error */}
              <Primitive object={frontLightTarget} position={[0, 0, 10]} />
            </Group>

            {/* Unlinked headlights stay fixed in world rotation while car spins */}
            {!linked && (
              // Fix: Replaced 'group' with locally defined 'Group' constant to fix JSX.IntrinsicElements error
              <Group 
                position={[activeConfig.modelPos.x, activeConfig.modelPos.y, activeConfig.modelPos.z]} 
                scale={activeConfig.modelScale}
              >
                {renderHeadlights()}
              </Group>
            )}
          </Suspense>
        </ModelErrorBoundary>

        
        <OrbitControls 
            makeDefault
            enablePan={false}
            target={defaultOrbitTarget}
            minPolarAngle={Math.PI / 2.8}
            maxPolarAngle={Math.PI / 2.1} 
            minDistance={minOrbitDistance}
            maxDistance={maxOrbitDistance}
            enableDamping={true}
            dampingFactor={0.05}
            enableZoom={true}
            enableRotate={!isAppOpen && dragProgress.current === null} 
        />

        {/* Fix: Replaced intrinsic elements with locally defined constants to fix JSX.IntrinsicElements error */}
        <AmbientLight ref={ambientLightRef} intensity={0.5} />
        <SpotLight
          ref={frontLightRef}
          position={[0, 5, 0]}
          angle={0.5}
          penumbra={0.5}
          intensity={1}
          castShadow
          shadow-bias={-0.0001}
        />
        <DirectionalLight
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
        
        {/* Fix: Replaced intrinsic elements with locally defined constants to fix JSX.IntrinsicElements error */}
        <Mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]} receiveShadow>
          <PlaneGeometry args={[8000, 8000]} />
          <MeshReflectorMaterial
            blur={[400, 400]}
            resolution={1024}
            mixBlur={1}
            mixStrength={1.5} 
            roughness={0.5} 
            depthScale={1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#101010"
            metalness={0.2}
            mirror={0.7} 
          />
        </Mesh>

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
            homeConfig={initialConfig}
            appOpenConfig={runtimeAppOpenConfig}
            modelRef={modelRef}
            frontLightTarget={frontLightTarget}
            onInteractionChange={onInteractionChange}
            dragProgress={dragProgress}
        />
      </Canvas>
    </>
  );
}
useGLTF.preload(MODEL_URL);
