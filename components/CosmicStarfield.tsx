import React, { useMemo } from 'react';

interface CosmicStarfieldProps {
  isNight?: boolean;
}

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  flickerSpeed: number;
  flickerDelay: number;
}

export const CosmicStarfield: React.FC<CosmicStarfieldProps> = () => {
  // Generate deterministic, static, pure white micro stars without 3D movement
  const stars = useMemo(() => {
    const list: Star[] = [];
    const count = 50;

    for (let i = 0; i < count; i++) {
      const seed = (i * 7919 + 104729) % 233280;
      const rnd1 = seed / 233280;
      const rnd2 = ((seed * 49297 + 9301) % 233280) / 233280;
      const rnd3 = ((seed * 179 + 31) % 1000) / 1000;
      const rnd4 = ((seed * 431 + 79) % 1000) / 1000;

      const size = rnd3 > 0.85 ? 1.6 : rnd3 > 0.45 ? 1.1 : 0.75;

      list.push({
        id: i,
        x: rnd1 * 100,
        y: rnd2 * 100,
        size,
        opacity: 0.3 + rnd2 * 0.5,
        flickerSpeed: 2.5 + rnd3 * 3.0,
        flickerDelay: rnd4 * 4.0
      });
    }
    return list;
  }, []);

  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 bg-[#000000]" 
      aria-hidden="true"
    >
      <svg className="w-full h-full absolute inset-0">
        {stars.map(star => (
          <circle
            key={star.id}
            cx={`${star.x}%`}
            cy={`${star.y}%`}
            r={star.size / 2}
            fill="#ffffff"
            opacity={star.opacity}
            style={{
              animation: `star-flicker ${star.flickerSpeed}s ease-in-out infinite alternate`,
              animationDelay: `${star.flickerDelay}s`
            }}
          />
        ))}
      </svg>

      <style>{`
        @keyframes star-flicker {
          0% { opacity: 0.25; }
          50% { opacity: 0.90; }
          100% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
};
