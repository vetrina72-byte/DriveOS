import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Points, PointMaterial } from '@react-three/drei';
import type { WeatherParams } from '../types';

const PointLight = 'pointLight' as any;

const LERP_FACTOR = 0.05; // Fast smoothing factor

const Lightning = ({ isActive }: { isActive: boolean }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const flashState = useRef({ active: false, flashes: 0 });
  const timeoutId = useRef<number | null>(null);

  const scheduleNextFlash = useCallback(() => {
    if (!isActive) return;
    const randomDelay = Math.random() * 17000 + 8000;
    timeoutId.current = window.setTimeout(() => {
      const numFlashes = Math.random() > 0.7 ? 1 : (Math.random() > 0.4 ? 2 : 3);
      flashState.current = { active: true, flashes: numFlashes };
      scheduleNextFlash();
    }, randomDelay);
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      const initialDelay = Math.random() * 3000 + 3000;
      timeoutId.current = window.setTimeout(() => {
        const numFlashes = Math.random() > 0.7 ? 1 : (Math.random() > 0.4 ? 2 : 3);
        flashState.current = { active: true, flashes: numFlashes };
        scheduleNextFlash();
      }, initialDelay);
    }
    
    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, [isActive, scheduleNextFlash]);

  useFrame((_, delta) => {
    if (!lightRef.current) return;
    const cappedDelta = Math.min(delta, 0.05);
    const decayRate = 8;

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
              if (isActive) {
                flashState.current.active = true;
              }
          }, 100 + Math.random() * 150);
      } else {
          flashState.current.active = false;
      }
    } else {
        lightRef.current.intensity *= Math.exp(-decayRate * cappedDelta);
        lightRef.current.power *= Math.exp(-decayRate * cappedDelta);
    }
  });

  return <PointLight ref={lightRef} color={0xffffff} intensity={0} decay={2} distance={400} />;
};

// Ultra-lightweight Points rain system for maximum performance (0 lag, 60fps)
const RainStreaks = ({ targetDensity, targetSpeed }: { targetDensity: number; targetSpeed: number }) => {
    const pointsRef = useRef<THREE.Points>(null!);
    const MAX_COUNT = 800; // Ultra performant particle count
    const velocitiesRef = useRef(new Float32Array(MAX_COUNT * 3));
    const currentDensity = useRef(0);
    const currentSpeed = useRef(0);

    const positions = useMemo(() => {
        const pos = new Float32Array(MAX_COUNT * 3);
        const vel = velocitiesRef.current;
        for (let i = 0; i < MAX_COUNT; i++) {
            const i3 = i * 3;
            pos[i3] = (Math.random() - 0.5) * 80;
            pos[i3 + 1] = Math.random() * 45 - 5;
            pos[i3 + 2] = (Math.random() - 0.5) * 80;
            
            vel[i3] = -0.1 - Math.random() * 0.2; // slight wind angle
            vel[i3 + 1] = -(15 + Math.random() * 10); // fast drop speed
            vel[i3 + 2] = (Math.random() - 0.5) * 0.1;
        }
        return pos;
    }, []);

    useEffect(() => {
        if (pointsRef.current) {
            pointsRef.current.geometry.setDrawRange(0, 0);
        }
    }, []);

    useFrame((_, delta) => {
        if (!pointsRef.current) return;

        currentDensity.current = THREE.MathUtils.lerp(currentDensity.current, targetDensity, LERP_FACTOR);
        currentSpeed.current = THREE.MathUtils.lerp(currentSpeed.current, targetSpeed, LERP_FACTOR);

        const activeCount = Math.floor(currentDensity.current * MAX_COUNT);
        pointsRef.current.geometry.setDrawRange(0, activeCount);

        if (activeCount < 1) return;

        const cappedDelta = Math.min(delta, 0.05);
        const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
        const velocities = velocitiesRef.current;
        const speedMult = Math.max(0.8, currentSpeed.current / 10);

        for (let i = 0; i < activeCount; i++) {
            const i3 = i * 3;
            pos[i3] += velocities[i3] * cappedDelta * speedMult;
            pos[i3 + 1] += velocities[i3 + 1] * cappedDelta * speedMult;
            pos[i3 + 2] += velocities[i3 + 2] * cappedDelta * speedMult;

            if (pos[i3 + 1] < -5) {
                pos[i3] = (Math.random() - 0.5) * 80;
                pos[i3 + 1] = 40;
                pos[i3 + 2] = (Math.random() - 0.5) * 80;
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
            <PointMaterial
                transparent
                color="#a5c9ff"
                size={0.12}
                sizeAttenuation
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                opacity={0.65}
            />
        </Points>
    );
};

const Snow = ({ targetDensity, targetSpeed }: { targetDensity: number; targetSpeed: number }) => {
    const pointsRef = useRef<THREE.Points>(null!);
    const MAX_COUNT = 400;
    const velocitiesRef = useRef(new Float32Array(MAX_COUNT * 3));
    const currentDensity = useRef(0);
    const currentSpeed = useRef(0);

    const positions = useMemo(() => {
        const pos = new Float32Array(MAX_COUNT * 3);
        const vel = velocitiesRef.current;
        for (let i = 0; i < MAX_COUNT; i++) {
            const i3 = i * 3;
            pos[i3] = (Math.random() - 0.5) * 80;
            pos[i3 + 1] = Math.random() * 45 - 5;
            pos[i3 + 2] = (Math.random() - 0.5) * 80;
            
            vel[i3] = (Math.random() - 0.5) * 0.3;
            vel[i3 + 1] = -(Math.random() * 0.8 + 0.6);
            vel[i3 + 2] = (Math.random() - 0.5) * 0.3;
        }
        return pos;
    }, []);
    
    useEffect(() => {
        if (pointsRef.current) {
            pointsRef.current.geometry.setDrawRange(0, 0);
        }
    }, []);

    useFrame((_, delta) => {
        if (!pointsRef.current) return;
        
        currentDensity.current = THREE.MathUtils.lerp(currentDensity.current, targetDensity, LERP_FACTOR);
        currentSpeed.current = THREE.MathUtils.lerp(currentSpeed.current, targetSpeed, LERP_FACTOR);
        const activeCount = Math.floor(currentDensity.current * MAX_COUNT);
        pointsRef.current.geometry.setDrawRange(0, activeCount);
        
        if (activeCount < 1) return;

        const cappedDelta = Math.min(delta, 0.05);
        const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
        const velocities = velocitiesRef.current;
        
        for (let i = 0; i < activeCount; i++) {
            const i3 = i * 3;
            pos[i3] += velocities[i3] * cappedDelta;
            pos[i3 + 1] += velocities[i3 + 1] * (currentSpeed.current || 1) * cappedDelta;
            pos[i3 + 2] += velocities[i3 + 2] * cappedDelta;
            
            if (pos[i3 + 1] < -5) {
                pos[i3] = (Math.random() - 0.5) * 80;
                pos[i3 + 1] = 40;
                pos[i3 + 2] = (Math.random() - 0.5) * 80;
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
            <PointMaterial transparent color="#ffffff" size={0.18} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.8} />
        </Points>
    );
};

const Hail = ({ targetDensity }: { targetDensity: number }) => {
    const pointsRef = useRef<THREE.Points>(null!);
    const MAX_COUNT = 150;
    const velocitiesRef = useRef(new Float32Array(MAX_COUNT * 3));
    const currentDensity = useRef(0);

    const positions = useMemo(() => {
        const pos = new Float32Array(MAX_COUNT * 3);
        const vel = velocitiesRef.current;
        for (let i = 0; i < MAX_COUNT; i++) {
            const i3 = i * 3;
            pos[i3] = (Math.random() - 0.5) * 80;
            pos[i3 + 1] = Math.random() * 45 - 5;
            pos[i3 + 2] = (Math.random() - 0.5) * 80;
            
            vel[i3] = (Math.random() - 0.5) * 1.5;
            vel[i3 + 1] = -(Math.random() * 15 + 35);
            vel[i3 + 2] = (Math.random() - 0.5) * 1.5;
        }
        return pos;
    }, []);
    
    useEffect(() => {
        if (pointsRef.current) {
            pointsRef.current.geometry.setDrawRange(0, 0);
        }
    }, []);

    useFrame((_, delta) => {
        if (!pointsRef.current) return;
        
        currentDensity.current = THREE.MathUtils.lerp(currentDensity.current, targetDensity, LERP_FACTOR);
        const activeCount = Math.floor(currentDensity.current * MAX_COUNT);
        pointsRef.current.geometry.setDrawRange(0, activeCount);
        
        if (activeCount < 1) return;

        const cappedDelta = Math.min(delta, 0.05);
        const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
        const velocities = velocitiesRef.current;
        
        for (let i = 0; i < activeCount; i++) {
            const i3 = i * 3;
            pos[i3] += velocities[i3] * cappedDelta;
            pos[i3 + 1] += velocities[i3 + 1] * cappedDelta;
            pos[i3 + 2] += velocities[i3 + 2] * cappedDelta;
            
            if (pos[i3 + 1] < -5) {
                pos[i3] = (Math.random() - 0.5) * 80;
                pos[i3 + 1] = 40;
                pos[i3 + 2] = (Math.random() - 0.5) * 80;
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
            <PointMaterial transparent color="#e2e8f0" size={0.16} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.8} />
        </Points>
    );
};

export default function WeatherEffects({ targetParams, effectiveWeatherCondition }: { targetParams: WeatherParams; effectiveWeatherCondition: string; }) {
    const isThunderstorm = effectiveWeatherCondition === 'Temporale';
    
    return (
        <>
            <RainStreaks targetDensity={targetParams.rainDensity} targetSpeed={targetParams.rainSpeed} />
            <Snow targetDensity={targetParams.snowDensity} targetSpeed={targetParams.snowSpeed} />
            <Hail targetDensity={targetParams.hailDensity} />
            <Lightning isActive={isThunderstorm} />
        </>
    );
}
