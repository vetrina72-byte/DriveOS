import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Points, PointMaterial } from '@react-three/drei';
import type { WeatherParams } from '../types';

const LERP_FACTOR = 0.05; // Smoothing factor for transitions

const Lightning = () => {
  const lightRef = useRef<THREE.PointLight>(null);
  const flashState = useRef({ active: false, flashes: 0 });
  const timeoutId = useRef<number | null>(null);

  const scheduleNextFlash = useCallback(() => {
    const randomDelay = Math.random() * 17000 + 8000; // 8 to 25 seconds
    timeoutId.current = window.setTimeout(() => {
      const numFlashes = Math.random() > 0.7 ? 1 : (Math.random() > 0.4 ? 2 : 3);
      flashState.current = { active: true, flashes: numFlashes };
      scheduleNextFlash();
    }, randomDelay);
  }, []);

  useEffect(() => {
    const initialDelay = Math.random() * 5000 + 5000; // First flash after 5-10s
    timeoutId.current = window.setTimeout(() => {
        scheduleNextFlash();
        const numFlashes = Math.random() > 0.7 ? 1 : (Math.random() > 0.4 ? 2 : 3);
        flashState.current = { active: true, flashes: numFlashes };
    }, initialDelay);
    
    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, [scheduleNextFlash]);

  useFrame(() => {
    if (!lightRef.current) return;

    if (flashState.current.active) {
      lightRef.current.intensity = 10 + Math.random() * 50;
      lightRef.current.power = (600 + Math.random() * 400) * 1000;
      lightRef.current.position.set(
        (Math.random() - 0.5) * 120,
        Math.random() * 60 + 40,
        (Math.random() - 0.5) * 120
      );
      flashState.current.flashes -= 1;
      
      if (flashState.current.flashes > 0) {
          flashState.current.active = false;
          setTimeout(() => {
              flashState.current.active = true;
          }, 100 + Math.random() * 150);
      } else {
          flashState.current.active = false;
      }
    } else {
        lightRef.current.intensity *= 0.88;
        lightRef.current.power *= 0.88;
    }
  });

  return <pointLight ref={lightRef} color={0xccccff} intensity={0} decay={2} distance={400} />;
};


const RainStreaks = ({ targetDensity, targetSpeed }: { targetDensity: number, targetSpeed: number }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const MAX_COUNT = 12000;

    const currentDensity = useRef(0);
    const currentSpeed = useRef(0);
    const currentLength = useRef(0.05);

    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < MAX_COUNT; i++) {
            temp.push({
                position: new THREE.Vector3(
                    (Math.random() - 0.5) * 100,
                    (Math.random() * 1.5 - 0.5) * 55, // Staggered start: range [-27.5, 82.5]
                    (Math.random() - 0.5) * 100
                ),
                velocityFactor: 0.75 + Math.random() * 0.5, // Individual speed multiplier
            });
        }
        return temp;
    }, []);

    const geometryRef = useRef<THREE.BoxGeometry>(null!);
    
    useEffect(() => {
        if (!meshRef.current) return;
        for (let i = 0; i < MAX_COUNT; i++) {
            dummy.position.copy(particles[i].position);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.count = 0;
    }, [particles, dummy]);


    useFrame((_, delta) => {
        if (!meshRef.current || !geometryRef.current) return;
        
        currentDensity.current = THREE.MathUtils.lerp(currentDensity.current, targetDensity, LERP_FACTOR);
        currentSpeed.current = THREE.MathUtils.lerp(currentSpeed.current, targetSpeed, LERP_FACTOR);
        
        const targetLength = THREE.MathUtils.lerp(0.05, 0.12, Math.min(1, currentSpeed.current / 15));
        currentLength.current = THREE.MathUtils.lerp(currentLength.current, targetLength, LERP_FACTOR);

        if (Math.abs(geometryRef.current.parameters.height - currentLength.current) > 0.001) {
             geometryRef.current.dispose();
             const newGeom = new THREE.BoxGeometry(0.02, currentLength.current, 0.02);
             meshRef.current.geometry = newGeom;
             geometryRef.current = newGeom;
        }

        const activeCount = Math.floor(currentDensity.current * MAX_COUNT);
        meshRef.current.count = activeCount;

        if (activeCount < 1) return;

        for (let i = 0; i < activeCount; i++) {
            const particle = particles[i];
            particle.position.y -= currentSpeed.current * particle.velocityFactor * delta;
            if (particle.position.y < -5) {
                particle.position.y = 50;
                particle.position.x = (Math.random() - 0.5) * 100;
                particle.position.z = (Math.random() - 0.5) * 100;
            }
            dummy.position.copy(particle.position);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_COUNT]}>
            <boxGeometry ref={geometryRef} args={[0.02, 0.05, 0.02]} />
            <meshBasicMaterial color="#a0b0f0" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false}/>
        </instancedMesh>
    );
};

const Snow = ({ targetDensity }: { targetDensity: number }) => {
    const pointsRef = useRef<THREE.Points>(null!);
    const MAX_COUNT = 10000;
    const velocitiesRef = useRef(new Float32Array(MAX_COUNT * 3));
    const currentDensity = useRef(0);

    const positions = useMemo(() => {
        const pos = new Float32Array(MAX_COUNT * 3);
        const vel = velocitiesRef.current;
        for (let i = 0; i < MAX_COUNT; i++) {
            const i3 = i * 3;
            pos[i3] = (Math.random() - 0.5) * 100;
            pos[i3 + 1] = (Math.random() * 1.5 - 0.5) * 55;
            pos[i3 + 2] = (Math.random() - 0.5) * 100;
            
            vel[i3] = (Math.random() - 0.5) * 0.4;
            vel[i3 + 1] = - (Math.random() * 1 + 1);
            vel[i3 + 2] = (Math.random() - 0.5) * 0.4;
        }
        return pos;
    }, []);
    
    useEffect(() => {
        if (pointsRef.current) {
            pointsRef.current.geometry.setDrawRange(0, 0);
        }
    }, []);

    useFrame((_, delta) => {
        if (!pointsRef.current || !velocitiesRef.current) return;
        
        currentDensity.current = THREE.MathUtils.lerp(currentDensity.current, targetDensity, LERP_FACTOR);
        const activeCount = Math.floor(currentDensity.current * MAX_COUNT);
        pointsRef.current.geometry.setDrawRange(0, activeCount);
        
        if (activeCount < 1) return;

        const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
        const velocities = velocitiesRef.current;
        
        for (let i = 0; i < activeCount; i++) {
            const i3 = i * 3;
            pos[i3] += velocities[i3] * delta;
            pos[i3 + 1] += velocities[i3 + 1] * delta;
            pos[i3 + 2] += velocities[i3 + 2] * delta;
            
            if (pos[i3 + 1] < -5) {
                pos[i3] = (Math.random() - 0.5) * 100;
                pos[i3 + 1] = 50;
                pos[i3 + 2] = (Math.random() - 0.5) * 100;
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
            <PointMaterial transparent color="#ffffff" size={0.18} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
        </Points>
    );
};

const Hail = ({ targetDensity }: { targetDensity: number }) => {
    const pointsRef = useRef<THREE.Points>(null!);
    const MAX_COUNT = 1500;
    const velocitiesRef = useRef(new Float32Array(MAX_COUNT * 3));
    const currentDensity = useRef(0);

    const positions = useMemo(() => {
        const pos = new Float32Array(MAX_COUNT * 3);
        const vel = velocitiesRef.current;
        for (let i = 0; i < MAX_COUNT; i++) {
            const i3 = i * 3;
            pos[i3] = (Math.random() - 0.5) * 100;
            pos[i3 + 1] = (Math.random() * 1.5 - 0.5) * 55;
            pos[i3 + 2] = (Math.random() - 0.5) * 100;
            
            vel[i3] = (Math.random() - 0.5) * 2;
            vel[i3 + 1] = - (Math.random() * 20 + 60);
            vel[i3 + 2] = (Math.random() - 0.5) * 2;
        }
        return pos;
    }, []);
    
    useEffect(() => {
        if (pointsRef.current) {
            pointsRef.current.geometry.setDrawRange(0, 0);
        }
    }, []);

    useFrame((_, delta) => {
        if (!pointsRef.current || !velocitiesRef.current) return;
        
        currentDensity.current = THREE.MathUtils.lerp(currentDensity.current, targetDensity, LERP_FACTOR);
        const activeCount = Math.floor(currentDensity.current * MAX_COUNT);
        pointsRef.current.geometry.setDrawRange(0, activeCount);
        
        if (activeCount < 1) return;

        const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
        const velocities = velocitiesRef.current;
        
        for (let i = 0; i < activeCount; i++) {
            const i3 = i * 3;
            pos[i3] += velocities[i3] * delta;
            pos[i3 + 1] += velocities[i3 + 1] * delta;
            pos[i3 + 2] += velocities[i3 + 2] * delta;
            
            if (pos[i3 + 1] < -5) {
                pos[i3] = (Math.random() - 0.5) * 100;
                pos[i3 + 1] = 50;
                pos[i3 + 2] = (Math.random() - 0.5) * 100;
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
            <PointMaterial transparent color="#e5e7eb" size={0.2} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
        </Points>
    );
};


export default function WeatherEffects({ targetParams }: { targetParams: WeatherParams }) {
    const isThunderstorm = targetParams.rainDensity > 0.8 && targetParams.rainSpeed > 10;
    
    return (
        <>
            <RainStreaks targetDensity={targetParams.rainDensity} targetSpeed={targetParams.rainSpeed} />
            <Snow targetDensity={targetParams.snowDensity} />
            <Hail targetDensity={targetParams.hailDensity} />
            {isThunderstorm && <Lightning />}
        </>
    )
}