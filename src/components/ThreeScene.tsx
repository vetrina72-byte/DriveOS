import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface Props {
  shadowType: string;
  bias: number;
  normalBias: number;
  frustumSize: number;
  mapSize: number;
  showHelper: boolean;
  dpr: number;
}

export default function ThreeScene({
  shadowType,
  bias,
  normalBias,
  frustumSize,
  mapSize,
  showHelper,
  dpr
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    light: THREE.DirectionalLight;
    helper: THREE.CameraHelper;
  }>();

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Setup Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    // Default from prompt
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    mountRef.current.appendChild(renderer.domElement);

    // 2. Setup Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1f2937'); // match UI background closely
    scene.fog = new THREE.Fog('#1f2937', 10, 40);

    // 3. Setup Camera
    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 8, 18);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 4. Setup Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(5, 10, 5);
    sun.castShadow = true;

    // Configuration from user's snippet
    sun.shadow.radius = 4;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 30;

    scene.add(sun);

    // 5. Setup Objects
    // Receiver (Ground)
    const planeGeo = new THREE.PlaneGeometry(50, 50);
    const planeMat = new THREE.MeshStandardMaterial({ 
      color: '#4b5563',
      roughness: 0.8 
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    // Caster 1 (Complex self-shadowing to show Acne)
    const knotGeo = new THREE.TorusKnotGeometry(2.5, 0.8, 256, 64);
    const knotMat = new THREE.MeshStandardMaterial({ 
      color: '#f87171', // Red-ish
      roughness: 0.4,
      metalness: 0.1 
    });
    const knot = new THREE.Mesh(knotGeo, knotMat);
    knot.position.y = 4;
    knot.castShadow = true;
    knot.receiveShadow = true; // IMPORTANT for acne demonstration
    scene.add(knot);

    // Caster 2 (Pillar to show Peter Panning and Frustum limits clearly)
    const boxGeo = new THREE.BoxGeometry(1.5, 8, 1.5);
    const boxMat = new THREE.MeshStandardMaterial({ color: '#60a5fa' }); // Blue
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(-6, 4, 2);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);

    // Caster 3 (Small sphere for soft edges check)
    const sphereGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const sphereMat = new THREE.MeshStandardMaterial({ color: '#a78bfa' }); // Purple
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(5, 1.5, 4);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    scene.add(sphere);

    // 6. Camera Helper
    const helper = new THREE.CameraHelper(sun.shadow.camera);
    scene.add(helper);

    sceneRef.current = { renderer, scene, camera, light: sun, helper };

    // 7. Animation Loop
    let reqId: number;
    const animate = () => {
      // Gentle rotation
      knot.rotation.y += 0.003;
      knot.rotation.x += 0.001;

      controls.update();
      renderer.render(scene, camera);
      reqId = requestAnimationFrame(animate);
    };
    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(reqId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      planeGeo.dispose();
      planeMat.dispose();
      knotGeo.dispose();
      knotMat.dispose();
      boxGeo.dispose();
      boxMat.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
    };
  }, []);

  // Handle Updates to shadows bounds and biases
  useEffect(() => {
    if (!sceneRef.current) return;
    const { light, renderer, scene, helper } = sceneRef.current;

    // Type Change
    let typeEnum = THREE.PCFSoftShadowMap;
    if (shadowType === 'Basic') typeEnum = THREE.BasicShadowMap;
    if (shadowType === 'PCF') typeEnum = THREE.PCFShadowMap;
    if (shadowType === 'VSM') typeEnum = THREE.VSMShadowMap;

    if (renderer.shadowMap.type !== typeEnum) {
      renderer.shadowMap.type = typeEnum;
      // Re-compile materials when shadow type changes
      scene.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material.needsUpdate = true;
        }
      });
    }

    // Bias Tuning
    light.shadow.bias = bias;
    light.shadow.normalBias = normalBias;

    // Frustum Sizing
    light.shadow.camera.left = -frustumSize;
    light.shadow.camera.right = frustumSize;
    light.shadow.camera.top = frustumSize;
    light.shadow.camera.bottom = -frustumSize;
    light.shadow.camera.updateProjectionMatrix();

    // Map Resolution
    if (light.shadow.mapSize.width !== mapSize) {
      light.shadow.mapSize.set(mapSize, mapSize);
      if (light.shadow.map) {
        light.shadow.map.dispose();
        // @ts-ignore - Nulling out to force recreation
        light.shadow.map = null;
      }
    }

    // DPR Tuning
    if (renderer.getPixelRatio() !== dpr) {
      renderer.setPixelRatio(dpr);
    }

    // Helper Visibility
    helper.visible = showHelper;
    helper.update();

  }, [shadowType, bias, normalBias, frustumSize, mapSize, showHelper, dpr]);

  return (
    <div 
      ref={mountRef} 
      className="w-full h-full cursor-move" 
      style={{ touchAction: 'none' }} 
    />
  );
}
