import React, {
  Suspense,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useMemo,
  useCallback,
} from "react";
import { Canvas, useFrame, useThree, ThreeElements } from "@react-three/fiber";
import {
  useGLTF,
  OrbitControls,
  Environment,
  MeshReflectorMaterial,
  Html,
  Lightformer,
} from "@react-three/drei";
import * as THREE from "three";
import { VolumetricHeadlight } from "./VolumetricHeadlight";
import WeatherEffects from "./WeatherEffects";
import type { SceneColors } from "../App";
import type { WeatherParams } from "../types";

// Fix: Definitions for R3F intrinsic elements to bypass JSX.IntrinsicElements errors
const Primitive = "primitive" as any;
const Group = "group" as any;
const Mesh = "mesh" as any;
const PlaneGeometry = "planeGeometry" as any;
const ShadowMaterial = "shadowMaterial" as any;
const AmbientLight = "ambientLight" as any;
const SpotLight = "spotLight" as any;
const DirectionalLight = "directionalLight" as any;
const BoxGeometry = "boxGeometry" as any;
const MeshStandardMaterial = "meshStandardMaterial" as any;

// Helper to convert Kelvin color temperature to THREE.Color
function kelvinToColor(kelvin: number): THREE.Color {
  const k = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r = 0, g = 0, b = 0;

  if (k <= 66) {
    r = 255;
    g = Math.max(0, Math.min(255, 99.4708025861 * Math.log(k) - 161.1195681661));
    if (k <= 19) {
      b = 0;
    } else {
      b = Math.max(0, Math.min(255, 138.5177312231 * Math.log(k - 10) - 305.0447927307));
    }
  } else {
    r = Math.max(0, Math.min(255, 329.698727446 * Math.pow(k - 60, -0.1332047592)));
    g = Math.max(0, Math.min(255, 288.1221695283 * Math.pow(k - 60, -0.0755148492)));
    b = 255;
  }

  return new THREE.Color(r / 255, g / 255, b / 255);
}

// Simple Error Boundary for the 3D model
interface ModelErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ModelErrorBoundaryState {
  hasError: boolean;
}

class ModelErrorBoundary extends React.Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
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
    console.error(
      "Error loading 3D Model, hiding it from the scene:",
      error,
      errorInfo,
    );
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

// URL del modello GLTF (Raw GitHub Link) - VOLVO EX30
const MODEL_URL =
  "https://raw.githubusercontent.com/vetrina72-byte/assets/main/volvo_ex30.glb";

// Interfaccia per la configurazione della scena
export interface SceneConfig {
  cameraPos: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
  modelPos: { x: number; y: number; z: number };
  modelRot: { x: number; y: number; z: number };
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

// Memoize Environment per evitare flash sulle riflessioni e impostare uno studio di luci professionali
const MemoizedEnvironment = React.memo(() => (
  <Environment resolution={512}>
    {/* Main Overhead Softbox Light Strip */}
    <Lightformer form="rect" intensity={3} position={[0, 10, 0]} scale={[10, 10, 1]} rotation={[Math.PI / 2, 0, 0]} />
    {/* Accent Soft Side Box for metallic highlights */}
    <Lightformer form="rect" intensity={1.5} position={[-10, 5, 5]} scale={[5, 15, 1]} rotation={[0, Math.PI / 4, 0]} />
    {/* Rim Light for vehicle silhouette highlight */}
    <Lightformer form="rect" intensity={2} position={[10, 4, -5]} scale={[5, 10, 1]} rotation={[0, -Math.PI / 4, 0]} />
  </Environment>
));

// Componente Model con emissive light e ombre
const Model = forwardRef<
  THREE.Group,
  {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
    isNight: boolean;
    aoMapIntensity?: number;
  }
>(({ position, rotation, scale, isNight, aoMapIntensity = 1.0 }, ref) => {
  const { scene } = useGLTF(MODEL_URL);
  const rearLightMats = useRef<Record<string, THREE.MeshStandardMaterial>>({});
  const frontLightMats = useRef<Record<string, THREE.MeshStandardMaterial>>({});

  useEffect(() => {
    rearLightMats.current = {};
    frontLightMats.current = {};
    scene.traverse((child: any) => {
      if (child.isMesh && child.name.toLowerCase().includes("shadow")) {
        child.visible = false;
        child.castShadow = false;
        child.receiveShadow = false;
      }
      if (child.isLight) child.castShadow = false;
      if (child.isMesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        child.castShadow = true;
        child.receiveShadow = true;

        materials.forEach((mat: THREE.MeshStandardMaterial) => {
          if (!mat) return;
          const matName = (mat.name || "").toLowerCase();
          const childName = (child.name || "").toLowerCase();
          const combinedName = `${matName} ${childName}`;

          // Boost environment reflections to better reflect the surroundings
          mat.envMapIntensity = 2.8;
          if (
            combinedName.includes("paint") ||
            combinedName.includes("body") ||
            combinedName.includes("car") ||
            combinedName.includes("metal") ||
            combinedName.includes("hood") ||
            combinedName.includes("door") ||
            combinedName.includes("bumper")
          ) {
            mat.metalness = Math.max(mat.metalness || 0, 0.7);
            mat.roughness = Math.min(mat.roughness || 1, 0.18);
            mat.envMapIntensity = 3.2;
          }

          // Lenti / Vetri protettivi dei fari anteriori e posteriori
          if (
            combinedName.includes("lens") ||
            combinedName.includes("cover_light") ||
            combinedName.includes("light_glass") ||
            combinedName.includes("lamp_glass")
          ) {
            mat.transparent = true;
            mat.opacity = 0.3;
            mat.roughness = 0.05;
            mat.metalness = 0.1;
            child.castShadow = false;
          }

          // Windows / Glass
          if (
            combinedName.includes("window") ||
            combinedName.includes("windshield") ||
            (combinedName.includes("glass") && !combinedName.includes("red") && !combinedName.includes("light"))
          ) {
            mat.transparent = true;
            mat.opacity = 0.5;
            mat.roughness = 0.1;
            mat.metalness = 0.9;
            mat.color.set("#111111");
            child.castShadow = false;
          }

          // Fari posteriori (luce rosso fiammante puro e saturo)
          const isRearLight =
            combinedName.includes("red") ||
            combinedName.includes("tail") ||
            combinedName.includes("rear") ||
            combinedName.includes("brake") ||
            combinedName.includes("stop") ||
            combinedName.includes("backlight");

          // Fari anteriori (luce bianca pura)
          const isFrontLight =
            combinedName.includes("headlight") ||
            combinedName.includes("front_light") ||
            combinedName.includes("drl") ||
            combinedName.includes("thor") ||
            combinedName.includes("daytime");

          const isGenericLight =
            combinedName.includes("light") ||
            combinedName.includes("lamp") ||
            combinedName.includes("emission") ||
            combinedName.includes("led");

          if (isRearLight) {
            mat.color.set("#cc000a");
            mat.emissive = new THREE.Color("#ff0014");
            mat.roughness = 0.1;
            mat.metalness = 0.0;
            mat.toneMapped = true; // Mantiene il rosso saturo e fiammante senza slavarsi o bruciarsi in arancione
            rearLightMats.current[mat.uuid] = mat;
          } else if (isFrontLight || isGenericLight) {
            mat.color.set("#ffffff");
            mat.emissive = new THREE.Color("#ffffff");
            mat.toneMapped = true;
            frontLightMats.current[mat.uuid] = mat;
          }
        });
      }
    });
  }, [scene]);

  useFrame((_, delta) => {
    const rearTarget = isNight ? 3.6 : 0.0;
    const frontTarget = isNight ? 4.0 : 0.0;
    const damp = 1 - Math.exp(-2 * delta);
    
    Object.values(rearLightMats.current).forEach(
      (mat: THREE.MeshStandardMaterial) => {
        mat.emissiveIntensity = THREE.MathUtils.lerp(
          mat.emissiveIntensity,
          rearTarget,
          damp,
        );
      },
    );

    Object.values(frontLightMats.current).forEach(
      (mat: THREE.MeshStandardMaterial) => {
        mat.emissiveIntensity = THREE.MathUtils.lerp(
          mat.emissiveIntensity,
          frontTarget,
          damp,
        );
      },
    );
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
Model.displayName = "Model";

function ContactShadow({
  shadowRef,
  carShadowWidth,
  carShadowLength,
  shadowPosition,
  shadowOpacity,
}: {
  shadowRef: React.RefObject<THREE.Mesh>;
  carShadowWidth: number;
  carShadowLength: number;
  shadowPosition: { x: number; y: number; z: number };
  shadowOpacity: number;
}) {
  const { scene, camera: mainCamera } = useThree();

  useEffect(() => {
    const originalOnBeforeRender = scene.onBeforeRender;

    scene.onBeforeRender = (...args: any[]) => {
      if (originalOnBeforeRender) {
        originalOnBeforeRender.apply(scene, args as any);
      }
      const camera = args[2];
      if (shadowRef.current) {
        // Safe check: hide the shadow if we are rendering for any camera other than the main viewport camera
        if (camera !== mainCamera) {
          shadowRef.current.visible = false;
        } else {
          shadowRef.current.visible = true;
        }
      }
    };

    return () => {
      scene.onBeforeRender = originalOnBeforeRender;
    };
  }, [scene, mainCamera, shadowRef]);

  return (
    <Mesh
      ref={shadowRef}
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[shadowPosition.x, shadowPosition.y, shadowPosition.z]}
    >
      <PlaneGeometry args={[carShadowWidth, carShadowLength]} />
      <ShadowMaterial
        transparent
        opacity={shadowOpacity}
        polygonOffset={true}
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-4}
      />
    </Mesh>
  );
}

function SceneController({
  isAppOpen,
  activeConfig,
  homeConfig,
  appOpenConfig,
  modelRef,
  floorRef,
  frontLightTarget,
  frontLightRef,
  directionalLightRef,
  spotLightPosX = 0.0,
  spotLightPosY = 5.0,
  spotLightPosZ = 0.0,
  dirLightPosX = -0.30,
  dirLightPosY = 40.0,
  dirLightPosZ = 7.70,
  onInteractionChange,
  dragProgress,
  sceneTransitionSpeed,
  carReflectionOffsetY = 0.0,
  redPanelOffsetX = -0.40,
  redPanelOffsetY = 2.70,
  redPanelLength = 10.0,
  redPanelWidth = 4.3,
  redPanelHeight = 5.0,
}: {
  isAppOpen: boolean;
  activeConfig: SceneConfig;
  homeConfig: SceneConfig;
  appOpenConfig: SceneConfig;
  modelRef: React.RefObject<THREE.Group>;
  floorRef: React.RefObject<THREE.Mesh>;
  frontLightTarget: THREE.Object3D;
  frontLightRef?: React.RefObject<THREE.SpotLight>;
  directionalLightRef?: React.RefObject<THREE.DirectionalLight>;
  spotLightPosX?: number;
  spotLightPosY?: number;
  spotLightPosZ?: number;
  dirLightPosX?: number;
  dirLightPosY?: number;
  dirLightPosZ?: number;
  onInteractionChange?: (isInteracting: boolean) => void;
  dragProgress: React.MutableRefObject<number | null>;
  sceneTransitionSpeed: number;
  carReflectionOffsetY?: number;
  redPanelOffsetX?: number;
  redPanelOffsetY?: number;
  redPanelLength?: number;
  redPanelWidth?: number;
  redPanelHeight?: number;
}) {
  const { camera, controls, gl, size } = useThree();
  const [interacting, setInteracting] = useState(false);
  const interactTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (camera) {
      camera.layers.enable(1);
    }
  }, [camera]);

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

  const initializedCamera = useRef(false);
  const isRestoringHome = useRef(false);
  const restoreAnimProgress = useRef(1.0);
  const snapshotHomePos = useRef(new THREE.Vector3());
  const snapshotHomeTarget = useRef(new THREE.Vector3());


  // Calcolo coefficiente di responsive e configurazioni locali dinamiche per evitare tagli
  // R3F size.width si riduce asincronamente d'un tratto all'apertura dell'app.
  // Usiamo window.innerWidth / window.innerHeight per avere un coefficiente stabile durante il resizing del Canvas splittato.
  const responsiveCoeff = useMemo(() => {
    const aspect = window.innerWidth / window.innerHeight;
    return Math.min(1.0, Math.max(0.0, (aspect - 1.0) / 0.77));
  }, [size.height]);

  // Aggiornamento dinamico del FOV per schermi stretti (Portrait/Mobile)
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const W = window.innerWidth;
      if (W < 768) {
        camera.fov = 68;
      } else if (W < 1024) {
        camera.fov = 58;
      } else {
        camera.fov = 48;
      }
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);

  const localHomeConfig = useMemo(() => {
    let baseModelScale = homeConfig.modelScale;
    let baseModelY = homeConfig.modelPos.y;
    
    const W = window.innerWidth;
    const H = window.innerHeight;
    
    if (W < 1024) {
      const scaleFactor = Math.max(0.55, W / 1024);
      baseModelScale = homeConfig.modelScale * scaleFactor;
      
      if (W < 768 && H > W) {
         // Sposta l'auto in alto per non farla coprire dal player musicale alla base
         baseModelY = homeConfig.modelPos.y + 1.2;
      }
    }

    const shiftX = homeConfig.modelPos.x * (responsiveCoeff - 1.0);
    return {
      ...homeConfig,
      modelScale: baseModelScale,
      modelPos: {
        ...homeConfig.modelPos,
        x: homeConfig.modelPos.x + shiftX,
        y: baseModelY,
      },
      cameraTarget: {
        ...homeConfig.cameraTarget,
        x: homeConfig.cameraTarget.x + shiftX,
        y: homeConfig.cameraTarget.y + (baseModelY - homeConfig.modelPos.y),
      },
      cameraPos: {
        ...homeConfig.cameraPos,
        x: homeConfig.cameraPos.x + shiftX,
        y: homeConfig.cameraPos.y + (baseModelY - homeConfig.modelPos.y),
      },
    };
  }, [homeConfig, responsiveCoeff]);

  const localAppOpenConfig = useMemo(() => {
    let baseModelX = appOpenConfig.modelPos.x; // default matches -4.90
    let baseModelY = appOpenConfig.modelPos.y;
    let baseModelScale = appOpenConfig.modelScale; // default matches 1.57

    const W = window.innerWidth;
    const H = window.innerHeight;
    
    if (W < 1024) {
      const scaleFactor = Math.max(0.40, W / 1024);
      baseModelScale = appOpenConfig.modelScale * scaleFactor;
      
      if (W < 768) {
        // Su mobile stretto, spostiamo ancora più a sinistra. L'app prende l'85% dello schermo a destra.
        // C'è solo un 15% a sinistra. Quindi dobbiamo "spingere" la camera molto a destra per far apparire la macchina a sinistra (oppure spingere la macchina a sinistra).
        baseModelX = appOpenConfig.modelPos.x - 3.5; 
        baseModelY = appOpenConfig.modelPos.y + (H > W ? 1.5 : 0); // Sposta leggermente in alto se portrait
      } else {
        baseModelX = appOpenConfig.modelPos.x - 1.5;
      }
    }

    const shiftX = baseModelX * (responsiveCoeff - 1.0);
    return {
      ...appOpenConfig,
      modelScale: baseModelScale,
      modelPos: {
        ...appOpenConfig.modelPos,
        x: baseModelX + shiftX,
        y: baseModelY,
      },
      cameraTarget: {
        ...appOpenConfig.cameraTarget,
        x: baseModelX + shiftX,
        y: appOpenConfig.cameraTarget.y + (baseModelY - appOpenConfig.modelPos.y),
      },
      cameraPos: {
        ...appOpenConfig.cameraPos,
        x: appOpenConfig.cameraPos.x + shiftX,
        y: appOpenConfig.cameraPos.y + (baseModelY - appOpenConfig.modelPos.y),
      },
    };
  }, [appOpenConfig, responsiveCoeff]);

  // Gestione interazione orbit controls
  useEffect(() => {
    const canvasEl = gl.domElement;
    if (!canvasEl) return;

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
      // Iniziamo il contatore per ripristinare la home (3 secondi)
      interactTimeout.current = window.setTimeout(() => {
        if (!isAppOpen) {
          snapshotHomePos.current.copy(camera.position);
          if (controls)
            snapshotHomeTarget.current.copy((controls as any).target);
          isRestoringHome.current = true;
          restoreAnimProgress.current = 0;
        }
      }, 3000);
    };

    canvasEl.addEventListener("pointerdown", onStart);
    canvasEl.addEventListener("pointerup", onEnd);
    canvasEl.addEventListener("pointercancel", onEnd);
    window.addEventListener("pointerup", onEnd); // cattura anche i rilasci fuori dal canvas

    return () => {
      canvasEl.removeEventListener("pointerdown", onStart);
      canvasEl.removeEventListener("pointerup", onEnd);
      canvasEl.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("pointerup", onEnd);
      if (interactTimeout.current) clearTimeout(interactTimeout.current);
    };
  }, [controls, gl.domElement, isAppOpen, onInteractionChange]);

  const prevIsAppOpen = useRef(isAppOpen);
  const transitionMode = useRef<"idle" | "auto" | "drag">("idle");
  const animStartTime = useRef(performance.now());

  const currentP = useRef<number>(isAppOpen ? 0 : 1);
  const autoStartP = useRef<number>(isAppOpen ? 0 : 1);
  const autoTargetP = useRef<number>(isAppOpen ? 0 : 1);
  const autoAnimDuration = useRef<number>(sceneTransitionSpeed);

  const frozenCamPos = useRef(new THREE.Vector3());
  const frozenCamTarget = useRef(new THREE.Vector3());
  const frozenModelPos = useRef(new THREE.Vector3());
  const frozenModelScale = useRef<number>(1);
  const frozenModelRot = useRef(new THREE.Quaternion());

  const syncLights = () => {
    if (modelRef.current) {
      frontLightTarget.position
        .copy(modelRef.current.position);
        
      if (frontLightRef && frontLightRef.current !== null) {
        frontLightRef.current.position.set(
          modelRef.current.position.x + (spotLightPosX || 0),
          modelRef.current.position.y + (spotLightPosY || 0),
          modelRef.current.position.z + (spotLightPosZ || 0)
        );
      }
      
      if (directionalLightRef && directionalLightRef.current !== null) {
        directionalLightRef.current.position.set(
          modelRef.current.position.x + (dirLightPosX || 0),
          modelRef.current.position.y + (dirLightPosY || 0),
          modelRef.current.position.z + (dirLightPosZ || 0)
        );
      }
    }
  };

  // Helper per interpolare tutto (Camera e Modello) con rispetto rigoroso dei lati della vettura
  const applyInterpolation = (
    startCamPos: THREE.Vector3,
    startCamTarget: THREE.Vector3,
    startModelPos: THREE.Vector3,
    startScale: number,
    startQuat: THREE.Quaternion,
    endCamPos: THREE.Vector3,
    endCamTarget: THREE.Vector3,
    endModelPos: THREE.Vector3,
    endScale: number,
    endQuat: THREE.Quaternion,
    t: number,
    ctrl: any
  ) => {
    // 1. Camera Target (Lineare)
    vec3C.lerpVectors(startCamTarget, endCamTarget, t);

    // 2. Camera Pos (Interpolazione cilindrica con Shortest Path su angolo XZ)
    vec3B.copy(startCamPos).sub(startCamTarget);
    vec3A.copy(endCamPos).sub(endCamTarget);

    const startRadius = Math.sqrt(vec3B.x * vec3B.x + vec3B.z * vec3B.z);
    const endRadius = Math.sqrt(vec3A.x * vec3A.x + vec3A.z * vec3A.z);
    const curRadius = THREE.MathUtils.lerp(startRadius, endRadius, t);
    const curY = THREE.MathUtils.lerp(vec3B.y, vec3A.y, t);

    const angleStart = Math.atan2(vec3B.z, vec3B.x);
    const angleEnd = Math.atan2(vec3A.z, vec3A.x);

    let curAngle: number;
    if (angleStart >= 0 && angleEnd >= 0) {
      // Entrambi sul lato destro: l'interpolazione rimane rigorosamente sul lato destro [0, PI]
      curAngle = angleStart + (angleEnd - angleStart) * t;
    } else if (angleStart < 0 && angleEnd < 0) {
      // Entrambi sul lato sinistro: rimane rigorosamente sul lato sinistro [-PI, 0]
      curAngle = angleStart + (angleEnd - angleStart) * t;
    } else if (angleStart < 0 && angleEnd >= 0) {
      // Da lato sinistro a lato destro:
      if (angleStart < -Math.PI / 2) {
        // Front-left: passa naturalmente dal davanti (attorno a -PI)
        const targetAngle = angleEnd - 2 * Math.PI;
        curAngle = angleStart + (targetAngle - angleStart) * t;
      } else {
        // Rear-left: passa naturalmente dal retro (attorno a 0)
        curAngle = angleStart + (angleEnd - angleStart) * t;
      }
    } else {
      // Da lato destro a lato sinistro:
      if (angleEnd < -Math.PI / 2) {
        // Verso front-left: passa dal davanti
        const targetAngle = angleEnd + 2 * Math.PI;
        curAngle = angleStart + (targetAngle - angleStart) * t;
      } else {
        // Verso rear-left: passa dal retro
        curAngle = angleStart + (angleEnd - angleStart) * t;
      }
    }

    const curOffsetX = curRadius * Math.cos(curAngle);
    const curOffsetZ = curRadius * Math.sin(curAngle);

    camera.position.set(vec3C.x + curOffsetX, vec3C.y + curY, vec3C.z + curOffsetZ);
    camera.lookAt(vec3C);

    if (ctrl) {
      ctrl.target.copy(vec3C);
      ctrl.enabled = false;
    }

    // 3. Modello 3D
    if (modelRef.current) {
      // Scala
      const s = THREE.MathUtils.lerp(startScale, endScale, t);
      modelRef.current.scale.set(s, s, s);

      // Posizione fluida
      modelRef.current.position.lerpVectors(startModelPos, endModelPos, t);

      // Rotazione
      modelRef.current.quaternion.slerpQuaternions(startQuat, endQuat, t);

      syncLights();
    }
  };

  // Pre-computiamo i target puri
  const quatTargetAppOpen = useMemo(
    () =>
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          localAppOpenConfig.modelRot.x,
          localAppOpenConfig.modelRot.y,
          localAppOpenConfig.modelRot.z,
        ),
      ),
    [localAppOpenConfig.modelRot],
  );
  const quatTargetHome = useMemo(
    () =>
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          localHomeConfig.modelRot.x,
          localHomeConfig.modelRot.y,
          localHomeConfig.modelRot.z,
        ),
      ),
    [localHomeConfig.modelRot],
  );

  // Animazione camera e modello
  useFrame((_, delta) => {
    const ctrl = typeof controls !== "undefined" ? (controls as any) : null;

    if (!initializedCamera.current && ctrl && modelRef.current) {
      const initConfig = isAppOpen ? localAppOpenConfig : localHomeConfig;

      camera.position.set(
        initConfig.cameraPos.x as number,
        initConfig.cameraPos.y as number,
        initConfig.cameraPos.z as number,
      );
      camera.updateProjectionMatrix();

      ctrl.target.set(
        initConfig.cameraTarget.x as number,
        initConfig.cameraTarget.y as number,
        initConfig.cameraTarget.z as number,
      );
      ctrl.update();

      modelRef.current.scale.set(
        initConfig.modelScale,
        initConfig.modelScale,
        initConfig.modelScale,
      );
      modelRef.current.quaternion.setFromEuler(
        new THREE.Euler(
          initConfig.modelRot.x,
          initConfig.modelRot.y,
          initConfig.modelRot.z,
        ),
      );
      modelRef.current.position.set(
        initConfig.modelPos.x,
        initConfig.modelPos.y,
        initConfig.modelPos.z,
      );
      syncLights();

      ctrl.enableRotate = !isAppOpen;

      initializedCamera.current = true;
    }

    // RILEVAMENTO EVENTI
    const clickOccurred = isAppOpen !== prevIsAppOpen.current;
    prevIsAppOpen.current = isAppOpen;
    const dragActive = dragProgress.current !== null;

    // SELEZIONE CANALE E GESTIONE TRANSIZIONI
    if (dragActive) {
      // CANALE 1: DRAG ATTIVO (Priorità assoluta al drag continuo / animazione del drawer)
      transitionMode.current = "drag";
      isRestoringHome.current = false;
      if (ctrl) ctrl.enableRotate = false;
    } else if (clickOccurred) {
      // CANALE 2: CAMBIO STATO DA CLICK (Transizione automatica morbida dal valore corrente)
      transitionMode.current = "auto";
      animStartTime.current = performance.now();
      isRestoringHome.current = false;
      if (ctrl) ctrl.enableRotate = false;

      // Congela istantaneamente la posizione reale prima di muoversi (CURRENT VISUAL STATE)
      frozenCamPos.current.copy(camera.position);
      if (ctrl) frozenCamTarget.current.copy(ctrl.target);
      if (modelRef.current) {
        frozenModelPos.current.copy(modelRef.current.position);
        frozenModelScale.current = modelRef.current.scale.x;
        frozenModelRot.current.copy(modelRef.current.quaternion);
      }

      // Il progresso parte esattamente dal frame visivo attuale
      autoStartP.current = currentP.current;
      autoTargetP.current = isAppOpen ? 0 : 1;
      autoAnimDuration.current = sceneTransitionSpeed;
    } else if (
      !clickOccurred &&
      !dragActive &&
      transitionMode.current === "drag"
    ) {
      // RILASCIO HANDLE / FINE DRAG STABILIZZATA
      transitionMode.current = "idle";
      const targetP = isAppOpen ? 0 : 1;
      currentP.current = targetP;

      if (!isAppOpen) {
        // FORZATURA DEI VALORI REALI HOME A SCHERMO INTERO E UPDATE DELLA MATRICE
        camera.position.set(
          localHomeConfig.cameraPos.x as number,
          localHomeConfig.cameraPos.y as number,
          localHomeConfig.cameraPos.z as number,
        );
        camera.updateProjectionMatrix();
        if (ctrl) {
          ctrl.target.set(
            localHomeConfig.cameraTarget.x as number,
            localHomeConfig.cameraTarget.y as number,
            localHomeConfig.cameraTarget.z as number,
          );
          ctrl.enableRotate = true;
          ctrl.update();
        }
        if (modelRef.current) {
          modelRef.current.scale.set(
            localHomeConfig.modelScale,
            localHomeConfig.modelScale,
            localHomeConfig.modelScale,
          );
          modelRef.current.quaternion.copy(quatTargetHome);
          vec3B.set(
            localHomeConfig.modelPos.x,
            localHomeConfig.modelPos.y,
            localHomeConfig.modelPos.z,
          );
          modelRef.current.position.copy(vec3B);
          syncLights();
        }
      }
    }

    // ESECUZIONE DEL CANALE ATTIVO
    let p = isAppOpen ? 0 : 1;

    if (interacting) {
      // UTENTE MANOVRA A SCHERMO INTERO CON ORBIT CONTROLS
      transitionMode.current = "idle";
      if (ctrl) {
        ctrl.enabled = true;
        ctrl.target.set(
          localHomeConfig.cameraTarget.x as number,
          localHomeConfig.cameraTarget.y as number,
          localHomeConfig.cameraTarget.z as number,
        );
        ctrl.update();
      }

      if (modelRef.current) {
        modelRef.current.scale.set(
          localHomeConfig.modelScale,
          localHomeConfig.modelScale,
          localHomeConfig.modelScale,
        );
        modelRef.current.quaternion.copy(quatTargetHome);
        vec3B.set(
          localHomeConfig.modelPos.x,
          localHomeConfig.modelPos.y,
          localHomeConfig.modelPos.z,
        );
        modelRef.current.position.copy(vec3B);
        syncLights();
      }
      p = 1;
      currentP.current = 1;
    } else if (transitionMode.current === "auto") {
      const now = performance.now();
      const elapsed = (now - animStartTime.current) / 1000;
      const duration = autoAnimDuration.current || sceneTransitionSpeed || 1.10;
      const normT = Math.min(elapsed / duration, 1.0);
      const easeT = 1 - Math.pow(1 - normT, 4);

      p = autoStartP.current + (autoTargetP.current - autoStartP.current) * easeT;
      currentP.current = p;

      const endTarget = new THREE.Vector3(
        isAppOpen ? localAppOpenConfig.cameraTarget.x : localHomeConfig.cameraTarget.x,
        isAppOpen ? localAppOpenConfig.cameraTarget.y : localHomeConfig.cameraTarget.y,
        isAppOpen ? localAppOpenConfig.cameraTarget.z : localHomeConfig.cameraTarget.z,
      );

      const endPos = new THREE.Vector3(
        isAppOpen ? localAppOpenConfig.cameraPos.x : localHomeConfig.cameraPos.x,
        isAppOpen ? localAppOpenConfig.cameraPos.y : localHomeConfig.cameraPos.y,
        isAppOpen ? localAppOpenConfig.cameraPos.z : localHomeConfig.cameraPos.z,
      );

      if (normT >= 1.0) {
        transitionMode.current = "idle";
        p = autoTargetP.current;
        currentP.current = p;
        if (!isAppOpen) {
          camera.position.copy(endPos);
          camera.updateProjectionMatrix();
          if (ctrl) {
            ctrl.target.copy(endTarget);
            ctrl.enableRotate = true;
            ctrl.enabled = true;
            ctrl.update();
          }
          if (modelRef.current) {
            modelRef.current.scale.set(
              localHomeConfig.modelScale,
              localHomeConfig.modelScale,
              localHomeConfig.modelScale,
            );
            modelRef.current.quaternion.copy(quatTargetHome);
            vec3B.set(
              localHomeConfig.modelPos.x,
              localHomeConfig.modelPos.y,
              localHomeConfig.modelPos.z,
            );
            modelRef.current.position.copy(vec3B);
            syncLights();
          }
        }
      }

      const endScale = isAppOpen
        ? localAppOpenConfig.modelScale
        : localHomeConfig.modelScale;
      const endQuat = isAppOpen ? quatTargetAppOpen : quatTargetHome;
      const endModelPos = new THREE.Vector3(
        isAppOpen ? localAppOpenConfig.modelPos.x : localHomeConfig.modelPos.x,
        isAppOpen ? localAppOpenConfig.modelPos.y : localHomeConfig.modelPos.y,
        isAppOpen ? localAppOpenConfig.modelPos.z : localHomeConfig.modelPos.z,
      );

      applyInterpolation(
        frozenCamPos.current,
        frozenCamTarget.current,
        frozenModelPos.current,
        frozenModelScale.current,
        frozenModelRot.current,
        endPos,
        endTarget,
        endModelPos,
        endScale,
        endQuat,
        easeT,
        ctrl
      );
    } else if (transitionMode.current === "drag") {
      let rawP = dragProgress.current as number;
      if (typeof rawP !== "number" || isNaN(rawP)) {
        rawP = isAppOpen ? 0 : 1;
      }
      rawP = Math.max(0, Math.min(1, rawP));

      const sPos = new THREE.Vector3(
        localAppOpenConfig.cameraPos.x,
        localAppOpenConfig.cameraPos.y,
        localAppOpenConfig.cameraPos.z,
      );
      const sTarget = new THREE.Vector3(
        localAppOpenConfig.cameraTarget.x,
        localAppOpenConfig.cameraTarget.y,
        localAppOpenConfig.cameraTarget.z,
      );
      const sModelPos = new THREE.Vector3(
        localAppOpenConfig.modelPos.x,
        localAppOpenConfig.modelPos.y,
        localAppOpenConfig.modelPos.z,
      );

      const ePos = new THREE.Vector3(
        localHomeConfig.cameraPos.x,
        localHomeConfig.cameraPos.y,
        localHomeConfig.cameraPos.z,
      );
      const eTarget = new THREE.Vector3(
        localHomeConfig.cameraTarget.x,
        localHomeConfig.cameraTarget.y,
        localHomeConfig.cameraTarget.z,
      );
      const eModelPos = new THREE.Vector3(
        localHomeConfig.modelPos.x,
        localHomeConfig.modelPos.y,
        localHomeConfig.modelPos.z,
      );

      applyInterpolation(
        sPos,
        sTarget,
        sModelPos,
        localAppOpenConfig.modelScale,
        quatTargetAppOpen,
        ePos,
        eTarget,
        eModelPos,
        localHomeConfig.modelScale,
        quatTargetHome,
        rawP,
        ctrl,
      );

      p = rawP;
      currentP.current = p;
      if (ctrl) {
        ctrl.enableRotate = (p >= 0.999 && !isAppOpen);
      }
    } else if (isRestoringHome.current) {
      const safeDelta = Math.min(delta, 0.05);
      restoreAnimProgress.current += safeDelta;
      const restoreDuration = 2.2;
      if (restoreAnimProgress.current < restoreDuration) {
        const t = Math.min(restoreAnimProgress.current / restoreDuration, 1.0);
        const easeT = 1 - Math.pow(1 - t, 3);

        const ePos = new THREE.Vector3(
          localHomeConfig.cameraPos.x,
          localHomeConfig.cameraPos.y,
          localHomeConfig.cameraPos.z,
        );
        const eTarget = new THREE.Vector3(
          localHomeConfig.cameraTarget.x,
          localHomeConfig.cameraTarget.y,
          localHomeConfig.cameraTarget.z,
        );
        const sModelPos = new THREE.Vector3(
          localHomeConfig.modelPos.x,
          localHomeConfig.modelPos.y,
          localHomeConfig.modelPos.z,
        );
        const eModelPos = new THREE.Vector3(
          localHomeConfig.modelPos.x,
          localHomeConfig.modelPos.y,
          localHomeConfig.modelPos.z,
        );

        applyInterpolation(
          snapshotHomePos.current,
          snapshotHomeTarget.current,
          sModelPos,
          localHomeConfig.modelScale,
          quatTargetHome,
          ePos,
          eTarget,
          eModelPos,
          localHomeConfig.modelScale,
          quatTargetHome,
          easeT,
          ctrl
        );
      } else {
        isRestoringHome.current = false;
        vec3A.set(
          localHomeConfig.cameraPos.x as number,
          localHomeConfig.cameraPos.y as number,
          localHomeConfig.cameraPos.z as number,
        );
        camera.position.copy(vec3A);
        camera.updateProjectionMatrix();
        if (ctrl) {
          vec3B.set(
            localHomeConfig.cameraTarget.x as number,
            localHomeConfig.cameraTarget.y as number,
            localHomeConfig.cameraTarget.z as number,
          );
          ctrl.target.copy(vec3B);
          ctrl.enableRotate = true;
          ctrl.enabled = true;
          ctrl.update();
        }
      }
      p = 1;
    } else {
      if (!isAppOpen && ctrl) {
        ctrl.enableRotate = true;
        ctrl.enabled = true;
      }
    }

    // 4. Viewport & Aspect Ratio dinamico dal DOM - Sincronizzato frame-per-frame con il pannello dell'app
    const canvas = gl.domElement;
    const container = canvas.parentElement;
    if (container) {
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      let visibleWidth = cw;

      if (cw >= 768) {
        // Cerca il pannello attivo/visibile nel DOM
        const panels = document.querySelectorAll('.spotify-app-panel');
        let activePanelRect: DOMRect | null = null;
        
        for (let i = 0; i < panels.length; i++) {
          const el = panels[i] as HTMLElement;
          const rect = el.getBoundingClientRect();
          // Il pannello è considerato visibile e sul lato destro se ha larghezza > 0 e rect.left < cw
          if (rect.width > 0 && rect.left < cw && rect.left > 0) {
            activePanelRect = rect;
            break;
          }
        }

        if (activePanelRect) {
          visibleWidth = Math.round(activePanelRect.left);
        } else if (isAppOpen) {
          // Fallback se il pannello non ha ancora calcolato il rect ma l'app è aperta
          let minWidthPercent = 0.40;
          if (cw < 1024) minWidthPercent = 0.50;
          else if (cw < 1280) minWidthPercent = 0.35;
          visibleWidth = Math.round(cw * minWidthPercent + cw * (1 - minWidthPercent) * p);
        } else {
          visibleWidth = cw;
        }
      }

      visibleWidth = Math.max(1, Math.min(cw, visibleWidth));

      // Forza il ridimensionamento fisico e l'aggiornamento degli stili CSS del Canvas ad ogni singolo frame
      if (canvas.width !== visibleWidth || canvas.height !== ch) {
        gl.setSize(visibleWidth, ch, true);
      }

      // Ricalcolo della matrice con FOV fisso per evitare distorsioni "a step"
      if (camera instanceof THREE.PerspectiveCamera) {
        const aspect = visibleWidth / ch;
        if (camera.aspect !== aspect) {
          camera.aspect = aspect;
          camera.fov = 48;
          camera.updateProjectionMatrix();
        }
      }

      gl.setViewport(0, 0, visibleWidth, ch);
      gl.setScissorTest(false);
    }

    if (floorRef.current && modelRef.current) {
      // Anchored to the car on the horizontal plane (X and Z) and preserves vertical offset
      floorRef.current.position.x = modelRef.current.position.x;
      floorRef.current.position.y = modelRef.current.position.y - carReflectionOffsetY;
      floorRef.current.position.z = modelRef.current.position.z;
      
      // Force immediate update of matrices so that MeshReflectorMaterial uses up-to-date world coordinates in the same frame render
      modelRef.current.updateMatrix();
      modelRef.current.updateMatrixWorld(true);
      floorRef.current.updateMatrix();
      floorRef.current.updateMatrixWorld(true);
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
  nightFogNear,
  nightFogFar,
  sceneColors,
  targetWeatherParams,
  carReflectionOpacity = 1.08,
  forceManualFog = false,
  dirLightIntensity = 1.0,
  spotLightIntensity = 1.0,
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
  nightFogNear: number;
  nightFogFar: number;
  sceneColors: SceneColors;
  targetWeatherParams: WeatherParams;
  carReflectionOpacity?: number;
  forceManualFog?: boolean;
  dirLightIntensity?: number;
  spotLightIntensity?: number;
}) {
  const { scene, gl } = useThree();
  const targetSky = useRef(new THREE.Color()).current;
  const targetFloor = useRef(new THREE.Color()).current;
  const currentEnvColor = useRef(new THREE.Color("#ffffff")).current;
  const currentFloorColor = useRef(new THREE.Color("#050608")).current;
  const nightFloorColor = useRef(new THREE.Color("#030406")).current;

  // Default Day Values
  const dayAmbientIntensity = 0.5;
  const dayFrontLightIntensity = 0.6;
  const dayDirectionalIntensity = 1.5;
  const dayEnvironmentIntensity = 2.8;

  useEffect(() => {
    // Sincronizziamo lo sfondo della scena dinamicamente in useFrame per nascondere i bordi del piano e garantire l'effetto di spazio infinito.
    // Inizializziamo subito scene.background con il colore corretto per evitare flash o ritardi al caricamento
    scene.background = new THREE.Color(isNight ? "#030406" : "#ffffff");
  }, [scene, isNight]);

  const getWeatherKey = useCallback((condition: string): string => {
    const lowerCond = condition.toLowerCase();
    if (lowerCond.includes("temporale")) return "Temporale";
    if (
      lowerCond.includes("pioggia") ||
      lowerCond.includes("rovescio") ||
      lowerCond.includes("pioggerella")
    )
      return "Pioggia";
    if (lowerCond.includes("grandine")) return "Grandine";
    if (lowerCond.includes("neve")) return "Neve";
    if (lowerCond.includes("nebbia")) return "Nebbia";
    return "Cielo sereno";
  }, []);

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-1.5 * delta);

    const weatherKey = getWeatherKey(weatherCondition);
    const timeKey = isNight ? "night" : "day";
    const colors =
      sceneColors[timeKey][weatherKey] || sceneColors[timeKey]["Cielo sereno"];

    targetSky.set(colors.sky);
    targetFloor.set(colors.floor);

    currentEnvColor.lerp(targetSky, t);
    
    const targetFloorColorVal = isNight ? nightFloorColor : targetFloor;
    currentFloorColor.lerp(targetFloorColorVal, t);

    // Sincronizza lo sfondo della scena con il colore del pavimento per fondere ed eliminare totalmente i bordi del piano (orizzonte infinito)
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(currentFloorColor);
    } else {
      scene.background = currentFloorColor.clone();
    }

    // Usa gl.setClearColor con il colore del pavimento
    gl.setClearColor(currentFloorColor, 1);

    // Costruisci il gradiente CSS che copia esattamente gli stessi identici colori e sfumature usati per il cielo 3D
    const hexColor = "#" + currentEnvColor.getHexString();
    let gradientCss = "";

    if (!isNight) {
      // Giorno (Day) sky shades - sfuma con i colori chiari del cielo diurno (colore bianco per il cielo sereno)
      if (weatherKey === "Cielo sereno") {
        gradientCss = `linear-gradient(to bottom, #ffffff 0%, ${hexColor} 100%)`;
      } else if (weatherKey === "Pioggia") {
        gradientCss = `linear-gradient(to bottom, #414347 0%, ${hexColor} 100%)`;
      } else if (weatherKey === "Temporale") {
        gradientCss = `linear-gradient(to bottom, #2e3137 0%, ${hexColor} 100%)`;
      } else if (weatherKey === "Neve") {
        gradientCss = `linear-gradient(to bottom, #8a8a8a 0%, ${hexColor} 100%)`;
      } else if (weatherKey === "Grandine") {
        gradientCss = `linear-gradient(to bottom, #7f7f85 0%, ${hexColor} 100%)`;
      } else if (weatherKey === "Nebbia") {
        gradientCss = `linear-gradient(to bottom, #949ca4 0%, ${hexColor} 100%)`;
      } else {
        gradientCss = `linear-gradient(to bottom, #ffffff 0%, ${hexColor} 100%)`;
      }
    } else {
      // Notte (Night) sky shades - sfuma con i colori scuri e profondi del cielo notturno
      if (weatherKey === "Cielo sereno") {
        gradientCss = `linear-gradient(to bottom, #030408 0%, ${hexColor} 100%)`;
      } else {
        gradientCss = `linear-gradient(to bottom, #010204 0%, ${hexColor} 100%)`;
      }
    }

    // Sync HTML background
    const container = document.getElementById("main-app-container");
    if (container) {
      container.style.background = gradientCss;
    }
    // Also sync the body background to prevent dark bars when container resizes
    document.body.style.background = gradientCss;
    const rootEl = document.getElementById("root");
    if (rootEl) {
      rootEl.style.background = gradientCss;
    }

    let targetAmbientIntensity: number,
      targetFrontLightIntensity: number,
      targetDirectionalIntensity: number,
      targetEnvIntensity: number,
      targetMirror: number;
    let targetFog: { near: number; far: number } | null = null;

    const isOvercast = /temporale|pioggia|rovescio|grandine|neve|nebbia/i.test(
      weatherKey,
    );

    if (isNight) {
      targetAmbientIntensity = Math.max(nightAmbientIntensity, 0.20);
      targetFrontLightIntensity = Math.max(nightFrontLightIntensity, 0.50);
      targetDirectionalIntensity = 0.0;
      targetEnvIntensity = Math.max(nightEnvironmentIntensity, 1.55);
      targetMirror = 0.35;
      targetFog = { near: nightFogNear, far: nightFogFar };
    } else {
      // Default DAY values
      targetAmbientIntensity = dayAmbientIntensity;
      targetFrontLightIntensity = dayFrontLightIntensity;
      targetDirectionalIntensity = dayDirectionalIntensity;
      targetEnvIntensity = dayEnvironmentIntensity;
      targetMirror = 0.8;

      const fogNear = (isOvercast && !forceManualFog) ? targetWeatherParams.fogNear : dayFogNear;
      const fogFar = (isOvercast && !forceManualFog) ? targetWeatherParams.fogFar : dayFogFar;
      targetFog = { near: fogNear, far: fogFar };

      if (weatherKey === "Temporale") {
        targetAmbientIntensity *= 0.5;
        targetDirectionalIntensity = 0.1;
        targetEnvIntensity = 0.6;
        targetMirror = 0;
      } else if (weatherKey === "Pioggia") {
        targetAmbientIntensity *= 0.4;
        targetDirectionalIntensity *= 0.1;
        targetEnvIntensity *= 0.5;
        targetMirror = 0;
      } else if (weatherKey === "Grandine") {
        targetAmbientIntensity *= 0.5;
        targetDirectionalIntensity *= 0.2;
        targetEnvIntensity *= 0.6;
        targetMirror = 0.1;
      } else if (weatherKey === "Neve") {
        targetAmbientIntensity *= 0.8;
        targetDirectionalIntensity *= 0.4;
        targetEnvIntensity *= 1.2;
        targetMirror = 0.2;
      } else if (weatherKey === "Nebbia") {
        targetAmbientIntensity *= 0.6;
        targetDirectionalIntensity *= 0.2;
        targetEnvIntensity *= 0.8;
        targetMirror = 0.1;
      }
    }

    targetDirectionalIntensity *= dirLightIntensity;
    targetFrontLightIntensity *= spotLightIntensity;

    targetMirror *= carReflectionOpacity;

    const floorMat = floorRef.current!.material as any;
    floorMat.color.copy(currentFloorColor);
    if ('mirror' in floorMat || floorMat.mirror !== undefined) {
      floorMat.mirror = THREE.MathUtils.lerp(floorMat.mirror || 0, targetMirror, t);
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = THREE.MathUtils.lerp(
        ambientLightRef.current.intensity,
        targetAmbientIntensity,
        t,
      );
      ambientLightRef.current.color.copy(currentEnvColor);
    }
    if (frontLightRef.current) {
      frontLightRef.current.intensity = THREE.MathUtils.lerp(
        frontLightRef.current.intensity,
        targetFrontLightIntensity,
        t,
      );
    }
    if (directionalLightRef.current) {
      directionalLightRef.current.intensity = THREE.MathUtils.lerp(
        directionalLightRef.current.intensity,
        targetDirectionalIntensity,
        t,
      );
      const blendedLightColor = new THREE.Color("#ffffff").lerp(
        currentEnvColor,
        0.4,
      );
      directionalLightRef.current.color.copy(blendedLightColor);
    }
    scene.environmentIntensity = THREE.MathUtils.lerp(
      scene.environmentIntensity,
      targetEnvIntensity,
      t,
    );

    if (targetFog) {
      if (!scene.fog) {
        scene.fog = new THREE.Fog(
          currentFloorColor,
          targetFog.near,
          targetFog.far,
        );
      }
      const fog = scene.fog as THREE.Fog;
      fog.color.copy(currentFloorColor);
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
  aoMapIntensity?: number;
  minOrbitDistance: number;
  maxOrbitDistance: number;
  sceneTransitionSpeed: number;
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
  nightFogNear: number;
  nightFogFar: number;
  targetWeatherParams: WeatherParams;
  uiScale: number;
  headlightConfig: HeadlightConfig;
  dragProgress: React.MutableRefObject<number | null>;
  carShadowOpacity?: number;
  carShadowWidth?: number;
  carShadowLength?: number;
  carShadowOffsetY?: number;
  carShadowOffsetX?: number;
  carShadowOffsetZ?: number;
  dirLightPosX?: number;
  dirLightPosY?: number;
  dirLightPosZ?: number;
  dirLightIntensity?: number;
  spotLightPosX?: number;
  spotLightPosY?: number;
  spotLightPosZ?: number;
  spotLightIntensity?: number;
  spotLightAngle?: number;
  spotLightPenumbra?: number;
  spotLightTemperature?: number;
  carReflectionOffsetY?: number;
  carReflectionOpacity?: number;
  carReflectionRoughness?: number;
  carReflectionBlur?: number;
  carReflectionMixStrength?: number;
  carReflectionMetalness?: number;
  forceManualFog?: boolean;
  showRedPanel?: boolean;
  redPanelLength?: number;
  redPanelHeight?: number;
  redPanelWidth?: number;
  redPanelOffsetY?: number;
  redPanelOffsetX?: number;
  redPanelOpacity?: number;
  redPanelColor?: string;
  redPanelOrientation?: 'longitudinal' | 'transverse' | 'horizontal';
}

export default function VehicleCanvas({
  isAppOpen,
  isNight,
  aoMapIntensity = 1.0,
  minOrbitDistance,
  maxOrbitDistance,
  sceneTransitionSpeed,
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
  nightFogNear,
  nightFogFar,
  targetWeatherParams,
  uiScale,
  headlightConfig,
  dragProgress,
  carShadowOpacity = 0.40,
  carShadowWidth = 20,
  carShadowLength = 20,
  carShadowOffsetY = 0.02,
  carShadowOffsetX = 0.0,
  carShadowOffsetZ = 0.0,
  dirLightPosX = -0.30,
  dirLightPosY = 40.00,
  dirLightPosZ = 7.70,
  dirLightIntensity = 2.40,
  spotLightPosX = 0.0,
  spotLightPosY = 5.0,
  spotLightPosZ = 0.0,
  spotLightIntensity = 1.0,
  spotLightAngle = 0.6,
  spotLightPenumbra = 0.5,
  spotLightTemperature = 6500,
  carReflectionOffsetY = 0.0,
  carReflectionOpacity = 1.08,
  carReflectionRoughness = 0.00,
  carReflectionBlur = 0,
  carReflectionMixStrength = 0.1,
  carReflectionMetalness = 0.00,
  forceManualFog = false,
  showRedPanel = true,
  redPanelLength = 10.0,
  redPanelHeight = 5.0,
  redPanelWidth = 4.3,
  redPanelOffsetY = 2.70,
  redPanelOffsetX = -0.40,
  redPanelOpacity = 0.0,
  redPanelColor = '#ff0000',
  redPanelOrientation = 'transverse',
}: VehicleCanvasProps) {
  const modelRef = useRef<THREE.Group>(null!);
  const floorRef = useRef<THREE.Mesh>(null!);
  const ambientLightRef = useRef<THREE.AmbientLight>(null!);
  const frontLightRef = useRef<THREE.SpotLight>(null!);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null!);
  const frontLightTarget = useMemo(() => new THREE.Object3D(), []);
  const shadowRef = useRef<THREE.Mesh>(null!);

  // Generate a procedural noise/grain texture to break up the perfect glass reflections
  const noiseTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(size, size);
      for (let i = 0; i < imgData.data.length; i += 4) {
        // High-frequency noise: val describes local surface roughness deviation
        const val = Math.floor(120 + Math.random() * 135);
        imgData.data[i] = val;     // R
        imgData.data[i + 1] = val; // G
        imgData.data[i + 2] = val; // B
        imgData.data[i + 3] = 255; // A
      }
      ctx.putImageData(imgData, 0, 0);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // Repeat many times to create a very fine micro-grain (e.g., asphalt/stone/satin resin)
    texture.repeat.set(150, 150);
    return texture;
  }, []);

  useEffect(() => {
    if (shadowRef.current) {
      shadowRef.current.layers.set(1);
    }
  }, []);

  const {
    x,
    y,
    z,
    angle,
    yaw,
    assemblyYaw,
    intensity,
    startWidth,
    endWidth,
    length,
    startHeight,
    endHeight,
    fade,
    separation,
    circular,
    linked,
  } = headlightConfig;

  const beamRoll = 0;

  const shadowPosition = { x: carShadowOffsetX, y: carShadowOffsetY, z: carShadowOffsetZ };
  const shadowOpacity = carShadowOpacity;

  const calculatedTemperatureColor = useMemo(
    () => kelvinToColor(spotLightTemperature),
    [spotLightTemperature]
  );

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

  const defaultOrbitTarget = useMemo(
    () =>
      [
        homeConfig.cameraTarget.x,
        homeConfig.cameraTarget.y,
        homeConfig.cameraTarget.z,
      ] as [number, number, number],
    [],
  );

  const [runtimeAppOpenConfig, setRuntimeAppOpenConfig] = useState<SceneConfig>(
    appOpenConfigFromProps,
  );

  useEffect(() => {
    if (isAppOpen) {
      setRuntimeAppOpenConfig(appOpenConfigFromProps);
    }
  }, [appOpenConfigFromProps, isAppOpen]);

  useEffect(() => {
    if (frontLightRef.current) frontLightRef.current.target = frontLightTarget;
    if (directionalLightRef.current) directionalLightRef.current.target = frontLightTarget;
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
        className="absolute inset-0"
        style={{ zIndex: 0, touchAction: "none" }}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        camera={{
          fov: 48,
          near: 0.5,
          far: 200,
          position: [
            initialConfig.cameraPos.x,
            initialConfig.cameraPos.y,
            initialConfig.cameraPos.z,
          ],
        }}
      >
        <SceneController
          isAppOpen={isAppOpen}
          activeConfig={activeConfig}
          homeConfig={initialConfig}
          appOpenConfig={runtimeAppOpenConfig}
          modelRef={modelRef}
          floorRef={floorRef}
          frontLightTarget={frontLightTarget}
          frontLightRef={frontLightRef}
          directionalLightRef={directionalLightRef}
          spotLightPosX={spotLightPosX}
          spotLightPosY={spotLightPosY}
          spotLightPosZ={spotLightPosZ}
          dirLightPosX={dirLightPosX}
          dirLightPosY={dirLightPosY}
          dirLightPosZ={dirLightPosZ}
          onInteractionChange={onInteractionChange}
          dragProgress={dragProgress}
          sceneTransitionSpeed={sceneTransitionSpeed}
          carReflectionOffsetY={carReflectionOffsetY}
          redPanelOffsetX={redPanelOffsetX}
          redPanelOffsetY={redPanelOffsetY}
          redPanelLength={redPanelLength}
          redPanelWidth={redPanelWidth}
          redPanelHeight={redPanelHeight}
        />
        <Suspense fallback={null}>
          <MemoizedEnvironment />
          <WeatherEffects
            targetParams={targetWeatherParams}
            effectiveWeatherCondition={effectiveWeatherCondition}
          />
        </Suspense>

        <ModelErrorBoundary>
          <Suspense
            fallback={
              <Html center>
                <div className="loading-spinner-border-dark w-12 h-12 rounded-full border-t-zinc-400 border-l-zinc-400"></div>
              </Html>
            }
          >
            {/* Fix: Replaced 'group' with locally defined 'Group' constant to fix JSX.IntrinsicElements error */}
            <Group ref={modelRef}>
              <Model
                position={{ x: 0, y: 0, z: 0 }}
                rotation={{ x: 0, y: 0, z: 0 }}
                scale={1}
                isNight={isNight}
                aoMapIntensity={aoMapIntensity}
              />

              {showRedPanel && (
                <Mesh position={[redPanelOffsetX, redPanelOffsetY, 0]} castShadow={false} receiveShadow={false}>
                  {redPanelOrientation === 'horizontal' ? (
                    <BoxGeometry args={[redPanelWidth, 0.02, redPanelLength]} />
                  ) : redPanelOrientation === 'transverse' ? (
                    <BoxGeometry args={[redPanelWidth, redPanelHeight, 0.02]} />
                  ) : (
                    <BoxGeometry args={[redPanelWidth, redPanelHeight, redPanelLength]} />
                  )}
                  <MeshStandardMaterial 
                    color={redPanelColor} 
                    transparent 
                    opacity={redPanelOpacity} 
                    roughness={0.1}
                    metalness={0.1}
                    side={THREE.DoubleSide} 
                  />
                </Mesh>
              )}

              {/* Fix: Replaced intrinsic elements with locally defined constants to fix JSX.IntrinsicElements error */}
              <ContactShadow
                shadowRef={shadowRef}
                carShadowWidth={carShadowWidth}
                carShadowLength={carShadowLength}
                shadowPosition={shadowPosition}
                shadowOpacity={shadowOpacity}
              />

              {/* Linked headlights follow the model's group rotation */}
              {linked && renderHeadlights()}
            </Group>
            
            {/* Target marker for lights, moved outside of modelRef so it doesn't double-transform */}
            {/* Fix: Replaced 'primitive' with locally defined 'Primitive' constant to fix JSX.IntrinsicElements error */}
            <Primitive object={frontLightTarget} />

            {/* Unlinked headlights stay fixed in world rotation while car spins */}
            {!linked && (
              // Fix: Replaced 'group' with locally defined 'Group' constant to fix JSX.IntrinsicElements error
              <Group
                position={[
                  activeConfig.modelPos.x,
                  activeConfig.modelPos.y,
                  activeConfig.modelPos.z,
                ]}
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
          maxPolarAngle={Math.PI / 2 - 0.035}
          minDistance={minOrbitDistance}
          maxDistance={maxOrbitDistance}
          enableDamping={true}
          dampingFactor={0.035}
          rotateSpeed={0.55}
          zoomSpeed={0.6}
          enableZoom={true}
          enableRotate={!isAppOpen && dragProgress.current === null}
        />

        {/* Fix: Replaced intrinsic elements with locally defined constants to fix JSX.IntrinsicElements error */}
        <AmbientLight ref={ambientLightRef} intensity={0.5} />
        <SpotLight
          ref={frontLightRef}
          position={[spotLightPosX, spotLightPosY, spotLightPosZ]}
          intensity={spotLightIntensity}
          angle={spotLightAngle}
          penumbra={spotLightPenumbra}
          color={calculatedTemperatureColor}
          distance={25}
          decay={1.5}
        />
        <DirectionalLight
          ref={directionalLightRef}
          position={[dirLightPosX, dirLightPosY, dirLightPosZ]}
          intensity={1}
          castShadow
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />

        {/* Fix: Replaced intrinsic elements with locally defined constants to fix JSX.IntrinsicElements error */}
        <Mesh
          ref={floorRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -carReflectionOffsetY, 0]}
        >
          {/* Dimensione ideale per precisione e ampiezza visiva senza distruggere lo Z-buffer */}
          <PlaneGeometry args={[250, 250]} />
          <MeshReflectorMaterial
            blur={[carReflectionBlur, carReflectionBlur]}
            resolution={1024}
            mixBlur={1}
            mixStrength={carReflectionMixStrength}
            roughness={carReflectionRoughness}
            depthScale={0} // Mantiene stabile il riflesso ed evita l'effetto TV vecchia raso terra
            minDepthThreshold={0.2}
            maxDepthThreshold={1.2}
            color="#101010"
            metalness={carReflectionMetalness}
            envMapIntensity={1.0} // Permette di catturare i riflessi speculari delle luci studio Lightformer
            mirror={carReflectionOpacity} // Utilizza l'opacità di riflesso configurata per la lucentezza desiderata
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
          nightFogNear={nightFogNear}
          nightFogFar={nightFogFar}
          sceneColors={sceneColors}
          targetWeatherParams={targetWeatherParams}
          carReflectionOpacity={carReflectionOpacity}
          forceManualFog={forceManualFog}
          dirLightIntensity={dirLightIntensity}
          spotLightIntensity={spotLightIntensity}
        />
      </Canvas>
    </>
  );
}
useGLTF.preload(MODEL_URL);
