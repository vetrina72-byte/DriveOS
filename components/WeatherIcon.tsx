


import React from 'react';

export const HOT_TEMP = 30;
export const COLD_TEMP = 5;

// A custom SVG thermometer icon for displaying extreme temperature warnings.
export const ExtremeTemp = ({ type, className, 'aria-label': ariaLabel }: { type: 'hot' | 'cold', className?: string, 'aria-label'?: string }) => {
    const isHot = type === 'hot';
    // Hot: more intense orange-red. Cold: deeper, more intense blue.
    const color = isHot ? '#ea580c' : '#1d4ed8';
    // Mercury level: 90% for hot, 10% for cold, providing a clear visual distinction.
    const mercuryLevel = isHot ? 0.9 : 0.1; 
    const mercuryHeight = 28 * mercuryLevel;
    const mercuryY = 41 - mercuryHeight;

    return (
        <svg viewBox="0 0 24 64" className={className} xmlns="http://www.w3.org/2000/svg" aria-label={ariaLabel} role="img">
            {/* Casing with a subtle fill for a glassy effect */}
            <path d="M15,41.5V13A3,3,0,0,0,9,13V41.5A5,5,0,1,0,15,41.5Z" fill="rgba(200, 200, 210, 0.2)" stroke="#94a3b8" strokeWidth="2" strokeMiterlimit="10"/>
            {/* Bulb is always filled with the indicator color for impact */}
            <circle cx="12" cy="46" r="4" fill={color} />
            {/* Mercury in the stem, with height determined by the temperature type */}
            <rect x="10" y={mercuryY} width="4" height={mercuryHeight} fill={color} />
        </svg>
    );
};


const Sunny = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="sunny-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <radialGradient id="sunny-grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" style={{stopColor: '#ffec8b', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: '#fcd34d', stopOpacity: 1}} />
            </radialGradient>
        </defs>
        <g style={{ animation: 'spin 45s linear infinite', transformOrigin: 'center' }}>
            <circle cx="32" cy="32" r="11" fill="url(#sunny-grad)" filter="url(#sunny-glow)"/>
            <g transform="translate(32 32)">
                <line y1="-14" y2="-19" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round"/>
                <line y1="-14" y2="-19" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round" transform="rotate(45)"/>
                <line y1="-14" y2="-19" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round" transform="rotate(90)"/>
                <line y1="-14" y2="-19" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round" transform="rotate(135)"/>
                <line y1="-14" y2="-19" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round" transform="rotate(180)"/>
                <line y1="-14" y2="-19" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round" transform="rotate(225)"/>
                <line y1="-14" y2="-19" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round" transform="rotate(270)"/>
                <line y1="-14" y2="-19" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round" transform="rotate(315)"/>
            </g>
        </g>
    </svg>
);

const ClearNight = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="moon-grad-new-lighter" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="70%" style={{stopColor: '#e5e7eb', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: '#9ca3af', stopOpacity: 1}} />
            </radialGradient>
            <filter id="moon-glow-new" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <g style={{ animation: 'drift 20s ease-in-out infinite', transformOrigin: 'center' }}>
            <circle cx="32" cy="32" r="16" fill="url(#moon-grad-new-lighter)" filter="url(#moon-glow-new)"/>
            <circle cx="25" cy="28" r="3" fill="#9ca3af" opacity="0.6"/>
            <circle cx="38" cy="35" r="2" fill="#9ca3af" opacity="0.6"/>
            <circle cx="35" cy="25" r="1.5" fill="#6b7280" opacity="0.5"/>
        </g>
    </svg>
);

const Sunrise = ({ className, arrowYPosition = 10 }: { className?: string; arrowYPosition?: number; }) => {
    const arrowUpPoints = `28,${arrowYPosition + 4} 32,${arrowYPosition} 36,${arrowYPosition + 4}`;
    return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="sunrise-grad-animated" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fde047">
                     <animate attributeName="stop-color" values="#fde047; #facc15; #fde047" dur="6s" repeatCount="indefinite" />
                </stop>
                <stop offset="100%" stopColor="#facc15">
                     <animate attributeName="stop-color" values="#facc15; #fde047; #facc15" dur="6s" repeatCount="indefinite" />
                </stop>
            </linearGradient>
            <clipPath id="horizon-clip-sunrise">
                <rect x="0" y="0" width="64" height="42" />
            </clipPath>
        </defs>
        
        <g style={{ animation: 'arrow-move-rise 6s ease-in-out infinite', transformOrigin: 'center' }}>
            <polyline 
                points={arrowUpPoints}
                stroke="#64748b" strokeWidth="2.5" fill="none" 
                strokeLinecap="round" strokeLinejoin="round"
            />
        </g>

        <g clipPath="url(#horizon-clip-sunrise)">
            <g style={{ animation: 'sun-move-rise 6s ease-in-out infinite' }}>
                <circle cx="32" cy="38" r="11" fill="url(#sunrise-grad-animated)" />
                <g transform="translate(32 38)">
                    <g stroke="#fde047" strokeLinecap="round">
                        {[...Array(8)].map((_, i) => (
                            <line 
                                key={i} y1="-13" y2="-18" strokeWidth="2.5"
                                transform={`rotate(${i * 45})`}
                                strokeDasharray="5"
                                className="ray-rise"
                            />
                        ))}
                    </g>
                </g>
            </g>
        </g>

        <line x1="0" y1="42" x2="64" y2="42" stroke="#94a3b8" strokeWidth="2" />
    </svg>
    );
};

const Sunset = ({ className, arrowYPosition = 10 }: { className?: string; arrowYPosition?: number; }) => {
    const arrowDownPoints = `28,${arrowYPosition} 32,${arrowYPosition + 4} 36,${arrowYPosition}`;
    return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="sunset-grad-animated-clear" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fcd34d">
                    <animate attributeName="stop-color" values="#fcd34d; #fb923c; #fcd34d" dur="6s" repeatCount="indefinite" />
                </stop>
                <stop offset="100%" stopColor="#fb923c">
                    <animate attributeName="stop-color" values="#fb923c; #ef4444; #fb923c" dur="6s" repeatCount="indefinite" />
                </stop>
            </linearGradient>
            <clipPath id="horizon-clip-sunset">
                <rect x="0" y="0" width="64" height="42" />
            </clipPath>
        </defs>

        <g style={{ animation: 'arrow-move-set 6s ease-in-out infinite', transformOrigin: 'center' }}>
            <polyline 
                points={arrowDownPoints} 
                stroke="#64748b" 
                strokeWidth="2.5" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round"
            />
        </g>

        <g clipPath="url(#horizon-clip-sunset)">
            <g style={{ animation: 'sun-move-set 6s ease-in-out infinite' }}>
                <circle cx="32" cy="38" r="11" fill="url(#sunset-grad-animated-clear)" />
                <g transform="translate(32 38)">
                     <g stroke="#fcd34d" strokeLinecap="round">
                        {[...Array(8)].map((_, i) => (
                            <line 
                                key={i} y1="-13" y2="-18" strokeWidth="2.5"
                                transform={`rotate(${i * 45})`}
                                strokeDasharray="5"
                                className="ray-set"
                            />
                        ))}
                    </g>
                </g>
            </g>
        </g>
        
        <line x1="0" y1="42" x2="64" y2="42" stroke="#94a3b8" strokeWidth="2" />
    </svg>
    );
};

const Cloud = ({ className, id, fill = "#f1f5f9", stroke = "#94a3b8" }: { className?: string; id: string; fill?: string; stroke?: string; }) => (
     <g>
        <defs>
            <filter id={`cloud-shadow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.1"/>
            </filter>
        </defs>
        <path d="M46.5,31.5h-.32a10.49,10.49,0,0,0-19.11-8.43A8,8,0,0,0,22.5,35.5a8.15,8.15,0,0,0,.5,3H46.5a8,8,0,0,0,0-16Z" 
        fill={fill} stroke={stroke} strokeMiterlimit="10" strokeWidth="1.2" filter={`url(#cloud-shadow-${id})`} />
    </g>
)

const CloudySunrise = ({ className, arrowYPosition = 10 }: { className?: string; arrowYPosition?: number; }) => {
    const arrowUpPoints = `28,${arrowYPosition + 4} 32,${arrowYPosition} 36,${arrowYPosition + 4}`;
    return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
         <defs>
            <linearGradient id="sunrise-grad-animated-cloudy" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fde047">
                     <animate attributeName="stop-color" values="#fde047; #facc15; #fde047" dur="6s" repeatCount="indefinite" />
                </stop>
                <stop offset="100%" stopColor="#facc15">
                     <animate attributeName="stop-color" values="#facc15; #fde047; #facc15" dur="6s" repeatCount="indefinite" />
                </stop>
            </linearGradient>

            <clipPath id="horizon-clip-sunrise-cloudy">
                <rect x="0" y="0" width="64" height="42" />
            </clipPath>
        </defs>

        <g style={{ animation: 'arrow-move-rise 6s ease-in-out infinite', transformOrigin: 'center' }}>
            <polyline 
                points={arrowUpPoints} 
                stroke="#64748b" strokeWidth="2.5" fill="none" 
                strokeLinecap="round" strokeLinejoin="round"
            />
        </g>

        <g clipPath="url(#horizon-clip-sunrise-cloudy)">
            {/* Sun is rendered first, so it appears behind the cloud. */}
            <g style={{ animation: 'sun-move-rise 6s ease-in-out infinite' }}>
                <circle cx="32" cy="38" r="11" fill="url(#sunrise-grad-animated-cloudy)" />
                <g transform="translate(32 38)">
                    <g stroke="#fde047" strokeLinecap="round">
                         {[...Array(8)].map((_, i) => (
                            <line 
                                key={i} y1="-13" y2="-18" strokeWidth="2.5"
                                transform={`rotate(${i * 45})`}
                                strokeDasharray="5"
                                className="ray-rise"
                            />
                        ))}
                    </g>
                </g>
            </g>
            {/* Scattered clouds at the horizon */}
            <g style={{ animation: 'cloud-drift-subtle-sr 15s ease-in-out infinite' }}>
                <g transform="translate(-5, 25) scale(0.35)">
                    <Cloud id="cs-cloud-1" fill="#e2e8f0" stroke="#94a3b8" />
                </g>
                <g transform="translate(30, 28) scale(0.45)">
                    <Cloud id="cs-cloud-2" fill="#e2e8f0" stroke="#94a3b8" />
                </g>
            </g>
        </g>
        
        <line x1="0" y1="42" x2="64" y2="42" stroke="#94a3b8" strokeWidth="2" />
    </svg>
    );
};

const CloudySunset = ({ className, arrowYPosition = 10 }: { className?: string; arrowYPosition?: number; }) => {
    const arrowDownPoints = `28,${arrowYPosition} 32,${arrowYPosition + 4} 36,${arrowYPosition}`;
    return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="sunset-grad-animated-cloudy" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fcd34d">
                    <animate attributeName="stop-color" values="#fcd34d; #fb923c; #fcd34d" dur="6s" repeatCount="indefinite" />
                </stop>
                <stop offset="100%" stopColor="#fb923c">
                    <animate attributeName="stop-color" values="#fb923c; #ef4444; #fb923c" dur="6s" repeatCount="indefinite" />
                </stop>
            </linearGradient>

            <clipPath id="horizon-clip-sunset-cloudy">
                <rect x="0" y="0" width="64" height="42" />
            </clipPath>
        </defs>

        <g style={{ animation: 'arrow-move-set 6s ease-in-out infinite', transformOrigin: 'center' }}>
            <polyline 
                points={arrowDownPoints} 
                stroke="#64748b" strokeWidth="2.5" fill="none" 
                strokeLinecap="round" strokeLinejoin="round"
            />
        </g>
        
        <g clipPath="url(#horizon-clip-sunset-cloudy)">
             {/* Sun is rendered first, so it appears behind the cloud. */}
            <g style={{ animation: 'sun-move-set 6s ease-in-out infinite' }}>
                <circle cx="32" cy="38" r="11" fill="url(#sunset-grad-animated-cloudy)" />
                 <g transform="translate(32 38)">
                    <g stroke="#fcd34d" strokeLinecap="round">
                        {[...Array(8)].map((_, i) => (
                            <line 
                                key={i} y1="-13" y2="-18" strokeWidth="2.5"
                                transform={`rotate(${i * 45})`}
                                strokeDasharray="5"
                                className="ray-set"
                            />
                        ))}
                    </g>
                </g>
            </g>
            {/* Scattered clouds at the horizon */}
            <g style={{ animation: 'cloud-drift-subtle-ss 15s ease-in-out infinite' }}>
                <g transform="translate(-2, 26) scale(0.3)">
                    <Cloud id="css-cloud-1" fill="#d1d5db" stroke="#94a3b8"/>
                </g>
                <g transform="translate(38, 29) scale(0.4)">
                    <Cloud id="css-cloud-2" fill="#d1d5db" stroke="#94a3b8"/>
                </g>
            </g>
        </g>
        
        <line x1="0" y1="42" x2="64" y2="42" stroke="#94a3b8" strokeWidth="2" />
    </svg>
    );
};


const Cloudy = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <g style={{ animation: 'drift 8s ease-in-out infinite', animationDelay: '-2s' }}>
             <Cloud id="c1" fill="#e2e8f0" stroke="#94a3b8"/>
        </g>
        <g style={{ animation: 'drift 6s ease-in-out infinite', transformOrigin: 'center' }}>
            <path d="M29.5,24.5a10.49,10.49,0,0,0-19.11-8.43A8,8,0,0,0,5.5,28.5a8.15,8.15,0,0,0,.5,3h23.5a8,8,0,0,0,0-16Z" 
            fill="#d1d5db" stroke="#6b7280" strokeMiterlimit="10" strokeWidth="1.2" filter="url(#cloud-shadow-c2)"/>
        </g>
    </svg>
);

const Fog = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <style>{`
            .fog-mist-line { animation: mist-flow 3s ease-in-out infinite alternate; }
            @keyframes mist-flow {
                from { transform: translateX(-5px); opacity: 0.3; }
                to   { transform: translateX(5px); opacity: 0.8; }
            }
        `}</style>
        <g style={{ animation: 'drift 8s ease-in-out infinite' }}>
           <Cloud id="fog1" fill="#e2e8f0" stroke="#bdc3c7"/>
        </g>
        <g stroke="#bdc3c7" strokeWidth="2.5" strokeLinecap="round" transform="translate(0, 5)">
            <line className="fog-mist-line" x1="18" y1="48" x2="46" y2="48" style={{animationDelay: '0s'}}/>
            <line className="fog-mist-line" x1="22" y1="54" x2="42" y2="54" style={{animationDelay: '-1.5s'}}/>
        </g>
    </svg>
);

const PartlyCloudyDay = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <g style={{ transform: 'scale(0.8) translate(5px, 0)'}}>
            <Sunny />
        </g>
        <g style={{ animation: 'drift 6s ease-in-out infinite', transformOrigin: 'center' }}>
           <Cloud id="pc1" />
        </g>
    </svg>
);

const PartlyCloudyNight = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <g style={{ transform: 'scale(0.8) translate(5px, 0)'}}>
            <ClearNight />
        </g>
        <g style={{ animation: 'drift 6s ease-in-out infinite', transformOrigin: 'center' }}>
           <Cloud id="pcn1" fill="#9ca3af" stroke="#e5e7eb" />
        </g>
    </svg>
);

// Corrected Particle Components and Styles
const ParticleDefs = () => (
    <defs>
        <filter id="particle-shadow-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0.5" dy="0.5" stdDeviation="0.5" floodColor="#000" floodOpacity="0.4"/>
        </filter>
    </defs>
);

const ParticleStyles = () => (
    <style>{`
        @keyframes particle-fall {
            from { transform: translateY(-10px); }
            to { transform: translateY(15px); }
        }
        @keyframes particle-fade {
            0%, 100% { opacity: 0; }
            15%, 85% { opacity: 1; }
        }
        @keyframes hail-fall-fast {
            from { transform: translateY(-12px); }
            to { transform: translateY(25px); }
        }
        @keyframes hail-fade {
            0%, 100% { opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
        }
        @keyframes hail-trail-draw {
            from { stroke-dashoffset: 12; }
            to { stroke-dashoffset: 0; }
        }
        @keyframes gentle-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(45deg); }
        }
        @keyframes lightning-flash {
            0%, 40% { opacity: 0; } /* Pauses */

            /* --- Increased frequency --- */
            /* First quick flash */
            41.0% { opacity: 0.8; }
            41.5% { opacity: 0; }

            /* Main double flash */
            43.0% { opacity: 1; }
            43.5% { opacity: 0.1; }
            44.0% { opacity: 1; }
            44.5% { opacity: 0; }
            
            /* Third quick flash */
            48.0% { opacity: 0.7; }
            48.5%, 100% { opacity: 0; }
        }
    `}</style>
);

// REFACTORED: Raindrop component with corrected animation structure
const Raindrop = ({ x, y, delay, duration, length, strokeWidth }: { x: number, y: number, delay: string, duration: string, length: number, strokeWidth: number }) => (
    <g transform={`translate(${x}, ${y})`}>
        <g style={{ animation: `particle-fall ${duration} linear infinite, particle-fade ${duration} linear infinite`, animationDelay: delay }}>
            <line x1="0" y1="0" x2="0" y2={length} strokeLinecap="round" strokeWidth={strokeWidth} />
        </g>
    </g>
);

// REFACTORED: Snowflake component with corrected animation structure
const Snowflake = ({ x, y, scale, delay, duration }: { x: number, y: number, scale: number, delay: string, duration: string }) => (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
       <g style={{ animation: `particle-fall ${duration} linear infinite, particle-fade ${duration} linear infinite`, animationDelay: delay }}>
            <g style={{ animation: `gentle-spin ${parseFloat(duration) * 1.5}s linear infinite alternate` }}>
               <path d="M0 -5 L0 5 M-4.3 -2.5 L4.3 2.5 M-4.3 2.5 L4.3 -2.5" />
            </g>
       </g>
   </g>
);

const Snowdot = ({ x, y, delay, duration }: { x: number, y: number, delay: string, duration: string }) => (
    <g transform={`translate(${x}, ${y})`}>
       <g style={{ animation: `particle-fall ${duration} linear infinite, particle-fade ${duration} linear infinite`, animationDelay: delay }}>
            <circle cx="0" cy="0" r="1.5" />
       </g>
   </g>
);

const Hailstone = ({ x, y, delay, duration, scale }: { x: number, y: number, delay: string, duration: string, scale: number }) => (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
        <g style={{ animation: `hail-fall-fast ${duration} linear infinite, hail-fade ${duration} linear infinite`, animationDelay: delay }}>
            {/* Trail: A white path with dynamic drawing animation. */}
            <path 
                d="M0 -15 v12" 
                stroke="white" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeDasharray="12"
                style={{ animation: `hail-trail-draw ${duration} linear infinite`, animationDelay: delay }}
            />
            {/* Stone: A simple circle. */}
            <circle cx="0" cy="0" r="3" />
        </g>
    </g>
);


const Drizzle = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <ParticleDefs />
        <ParticleStyles />
        <g style={{ animation: 'drift 7s ease-in-out infinite', transformOrigin: 'center' }}>
            {/* The group of raindrops is rotated to give a slanted/windy effect */}
            <g stroke="#3b82f6" filter="url(#particle-shadow-filter)" transform="rotate(10 32 32)">
                {/* Faster duration (1.2s vs 1.8s) and varied lengths/positions */}
                <Raindrop x={27} y={45} delay="-1.2s" duration="1.2s" length={8} strokeWidth={1.5} />
                <Raindrop x={37} y={45} delay="-1.9s" duration="1.2s" length={4} strokeWidth={1.5} />
                <Raindrop x={47} y={45} delay="-1.5s" duration="1.2s" length={6} strokeWidth={1.5} />
            </g>
            <Cloud id="d1" fill="#e2e8f0" stroke="#bdc3c7" />
        </g>
    </svg>
);

const LightRain = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <ParticleDefs />
        <ParticleStyles />
        <g style={{ animation: 'drift 7s ease-in-out infinite', transformOrigin: 'center' }}>
            {/* Based on Drizzle, but with an extra, smaller drop for a slightly denser feel. Raindrops are repositioned to fall from under the cloud. */}
            <g stroke="#3b82f6" filter="url(#particle-shadow-filter)" transform="rotate(10 32 32)">
                <Raindrop x={27} y={45} delay="-1.3s" duration="1.3s" length={8} strokeWidth={1.5} />
                <Raindrop x={34} y={45} delay="-2.0s" duration="1.3s" length={4} strokeWidth={1.5} />
                <Raindrop x={41} y={45} delay="-1.6s" duration="1.3s" length={6} strokeWidth={1.5} />
                <Raindrop x={47} y={45} delay="-2.3s" duration="1.3s" length={3} strokeWidth={1.5} />
            </g>
            <Cloud id="lr1" fill="#e2e8f0" stroke="#bdc3c7" />
        </g>
    </svg>
);

const Rain = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <ParticleDefs />
        <ParticleStyles />
        <g style={{ animation: 'drift 6s ease-in-out infinite', transformOrigin: 'center' }}>
            <g stroke="#3b82f6" filter="url(#particle-shadow-filter)" transform="rotate(10 32 32)">
                {/* 5 drops, faster speed (1.1s), varied lengths, wider distribution under cloud */}
                <Raindrop x={28} y={45} delay="-1.1s" duration="1.1s" length={9} strokeWidth={2} /> 
                <Raindrop x={33} y={45} delay="-1.9s" duration="1.1s" length={6} strokeWidth={2} />
                <Raindrop x={38} y={45} delay="-1.5s" duration="1.1s" length={9} strokeWidth={2} />
                <Raindrop x={43} y={45} delay="-2.1s" duration="1.1s" length={5} strokeWidth={2} />
                <Raindrop x={48} y={45} delay="-1.3s" duration="1.1s" length={7} strokeWidth={2} />
            </g>
            {/* Darker cloud to signify more rain */}
            <Cloud id="r1" fill="#b0b8c0" stroke="#6b7280" />
        </g>
    </svg>
);

const HeavyRain = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <ParticleDefs />
        <ParticleStyles />
        <g style={{ animation: 'drift 6s ease-in-out infinite', transformOrigin: 'center' }}>
             {/* 6 drops, very fast speed (0.9s), with varied lengths and thicknesses for a more chaotic, strong downpour effect */}
            <g stroke="#3b82f6" filter="url(#particle-shadow-filter)" transform="rotate(10 32 32)">
                <Raindrop x={27} y={45} delay="-0.9s" duration="0.9s" length={10} strokeWidth={2.5} /> {/* Large */}
                <Raindrop x={31} y={45} delay="-1.4s" duration="0.9s" length={7}  strokeWidth={2} />   {/* Medium */}
                <Raindrop x={35} y={45} delay="-1.1s" duration="0.9s" length={10} strokeWidth={2.5} /> {/* Large */}
                <Raindrop x={39} y={45} delay="-1.6s" duration="0.9s" length={5}  strokeWidth={1.5} /> {/* Small */}
                <Raindrop x={43} y={45} delay="-1.3s" duration="0.9s" length={8}  strokeWidth={2} />   {/* Medium */}
                <Raindrop x={47} y={45} delay="-1.8s" duration="0.9s" length={6}  strokeWidth={1.5} /> {/* Small */}
            </g>
            {/* Darker cloud for more severe weather */}
            <Cloud id="hr1" fill="#9ca3af" stroke="#4b5563" />
        </g>
    </svg>
);

const Shower = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <ParticleDefs />
        <ParticleStyles />
        <g style={{ animation: 'drift 6s ease-in-out infinite', transformOrigin: 'center' }}>
            <g stroke="#3b82f6" filter="url(#particle-shadow-filter)" transform="rotate(10 32 32)">
                <Raindrop x={27} y={45} delay="-0.9s" duration="0.9s" length={10} strokeWidth={2.5} />
                <Raindrop x={31} y={45} delay="-1.4s" duration="0.9s" length={7}  strokeWidth={2} />
                <Raindrop x={35} y={45} delay="-1.1s" duration="0.9s" length={10} strokeWidth={2.5} />
                <Raindrop x={39} y={45} delay="-1.6s" duration="0.9s" length={5}  strokeWidth={1.5} />
                <Raindrop x={43} y={45} delay="-1.3s" duration="0.9s" length={8}  strokeWidth={2} />
                <Raindrop x={47} y={45} delay="-1.8s" duration="0.9s" length={6}  strokeWidth={1.5} />
            </g>
            {/* Even darker cloud for a shower, as requested */}
            <Cloud id="shower1" fill="#6b7280" stroke="#374151" />
        </g>
    </svg>
);


const Thunderstorm = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="lightning-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <filter id="particle-shadow-filter" x="-50%" y="-50%" width="200%" height="200%">
               <feDropShadow dx="0.5" dy="0.5" stdDeviation="0.5" floodColor="#000" floodOpacity="0.4"/>
            </filter>
        </defs>
        <ParticleStyles/>
        
        <g style={{ animation: 'drift 6s ease-in-out infinite', transformOrigin: 'center' }}>
            <g stroke="#3b82f6" filter="url(#particle-shadow-filter)" transform="rotate(10 32 32)">
                <Raindrop x={27} y={45} delay="-0.9s" duration="0.9s" length={10} strokeWidth={2.5} />
                <Raindrop x={31} y={45} delay="-1.4s" duration="0.9s" length={7}  strokeWidth={2} />
                <Raindrop x={35} y={45} delay="-1.1s" duration="0.9s" length={10} strokeWidth={2.5} />
                <Raindrop x={39} y={45} delay="-1.6s" duration="0.9s" length={5}  strokeWidth={1.5} />
                <Raindrop x={43} y={45} delay="-1.3s" duration="0.9s" length={8}  strokeWidth={2} />
                <Raindrop x={47} y={45} delay="-1.8s" duration="0.9s" length={6}  strokeWidth={1.5} />
            </g>
            <polygon 
                points="32,41 25,53 31,52 27,63 42,47 35,48 39,41"
                fill="#fef08a" 
                filter="url(#lightning-glow)"
                style={{
                    opacity: 0,
                    animation: 'lightning-flash 5s linear infinite', 
                    animationDelay: '0.2s',
                    transformOrigin: 'center'
                }}/>
            <Cloud id="t1" fill="#4b5563" stroke="#374151" />
        </g>
    </svg>
);


const LightSnow = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <ParticleDefs/>
        <ParticleStyles/>
        <g style={{ animation: 'drift 7s ease-in-out infinite', transformOrigin: 'center' }}>
            <g stroke="#e2e8f0" filter="url(#particle-shadow-filter)">
                <g fill="none" strokeWidth="2" strokeLinecap="round">
                    <Snowflake x={28} y={48} scale={0.9} delay="-4.0s" duration="4.0s" />
                    <Snowflake x={42} y={50} scale={0.9} delay="-6.0s" duration="4.0s" />
                </g>
                <g fill="#e2e8f0">
                     <Snowdot x={35} y={45} delay="-5.0s" duration="3.8s" />
                     <Snowdot x={48} y={52} delay="-4.5s" duration="4.2s" />
                </g>
            </g>
            <Cloud id="ls1" fill="#d1d5db" stroke="#9ca3af" />
        </g>
    </svg>
);

const Snow = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <ParticleDefs/>
        <ParticleStyles/>
        <g style={{ animation: 'drift 6s ease-in-out infinite', transformOrigin: 'center' }}>
            <g stroke="#e2e8f0" filter="url(#particle-shadow-filter)">
                <g fill="none" strokeWidth="2" strokeLinecap="round">
                    {/* Increased speed compared to light snow */}
                    <Snowflake x={28} y={48} scale={1.1} delay="-3.5s" duration="3.5s" />
                    <Snowflake x={48} y={50} scale={0.9} delay="-5.0s" duration="3.2s" />
                </g>
                 <g fill="#e2e8f0">
                    <Snowdot x={38} y={46} delay="-4.0s" duration="3.8s" />
                    <Snowdot x={22} y={51} delay="-4.5s" duration="3.0s" />
                </g>
            </g>
            <Cloud id="s1" fill="#b0b8c0" stroke="#6b7280" />
        </g>
    </svg>
);

const HeavySnow = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <ParticleDefs/>
        <ParticleStyles/>
        <g style={{ animation: 'drift 6s ease-in-out infinite', transformOrigin: 'center' }}>
            <g stroke="#e2e8f0" filter="url(#particle-shadow-filter)">
                <g fill="none" strokeWidth="2.5" strokeLinecap="round">
                    {/* Size of larger flakes reduced and all particles repositioned for better separation */}
                    <Snowflake x={24} y={47} scale={0.9} delay="-2.0s" duration="1.8s" />
                    <Snowflake x={50} y={48} scale={0.9} delay="-2.8s" duration="1.8s" />
                    <Snowflake x={42} y={52} scale={0.8} delay="-2.4s" duration="2.0s" />
                    <Snowflake x={31} y={51} scale={0.7} delay="-3.0s" duration="2.2s" />
                </g>
                <g fill="#e2e8f0">
                    {/* Dots are repositioned to avoid merging with flakes */}
                    <Snowdot x={20} y={53} delay="-2.2s" duration="1.9s" />
                    <Snowdot x={35} y={46} delay="-3.2s" duration="1.7s" />
                    <Snowdot x={46} y={50} delay="-3.5s" duration="1.9s" />
                </g>
            </g>
            <Cloud id="hs1" fill="#9ca3af" stroke="#4b5563" />
        </g>
    </svg>
);

const Hail = ({ className }: { className?: string }) => (
    <svg viewBox="-10 -10 84 84" className={className} xmlns="http://www.w3.org/2000/svg">
        <ParticleStyles/>
        <defs>
            <clipPath id="hail-clip-mask">
                <rect x="-10" y="38" width="84" height="84" />
            </clipPath>
            <filter id="particle-shadow-filter-hail" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0.5" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.3"/>
            </filter>
            <filter id="cloud-shadow-hail" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="2" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.25"/>
            </filter>
        </defs>
        <g style={{ animation: 'drift 7s ease-in-out infinite', transformOrigin: 'center' }}>
            <g filter="url(#cloud-shadow-hail)">
                 <path d="M46.5,31.5h-.32a10.49,10.49,0,0,0-19.11-8.43A8,8,0,0,0,22.5,35.5a8.15,8.15,0,0,0,.5,3H46.5a8,8,0,0,0,0-16Z" 
                    fill="#a1a1aa" stroke="#71717a" strokeMiterlimit="10" strokeWidth="1.2" style={{ animation: 'drift 9s ease-in-out infinite reverse' }} />
                <path d="M29.5,24.5a10.49,10.49,0,0,0-19.11-8.43A8,8,0,0,0,5.5,28.5a8.15,8.15,0,0,0,.5,3h23.5a8,8,0,0,0,0-16Z"
                    fill="#71717a" stroke="#52525b" strokeMiterlimit="10" strokeWidth="1.2" style={{ transform: 'translate(10px, 4px) scale(0.9)', opacity: 1 }}/>
            </g>
            {/* Hailstones are now a neutral icy color, with white trails. */}
            <g clipPath="url(#hail-clip-mask)" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1" filter="url(#particle-shadow-filter-hail)">
                <Hailstone x={24} y={48} delay="-0.6s" duration="0.6s" scale={0.7} />
                <Hailstone x={32} y={50} delay="-1.0s" duration="0.6s" scale={0.9} />
                <Hailstone x={41} y={49} delay="-0.8s" duration="0.6s" scale={0.8} />
                <Hailstone x={50} y={51} delay="-1.3s" duration="0.6s" scale={0.7} />
                <Hailstone x={18} y={52} delay="-1.5s" duration="0.6s" scale={0.6} />
                <Hailstone x={55} y={50} delay="-1.1s" duration="0.6s" scale={0.5} />
                <Hailstone x={28} y={52} delay="-0.9s" duration="0.6s" scale={0.6} />
                <Hailstone x={45} y={53} delay="-1.2s" duration="0.6s" scale={0.7} />
            </g>
        </g>
    </svg>
);


export default function WeatherIcon({ condition, isNight, className, arrowYPosition }: { condition: string; isNight: boolean; className?: string; arrowYPosition?: number; }) {
    const genericCondition = condition.toLowerCase();
    
    // Specific event icons take precedence over general weather conditions.
    if (genericCondition.includes('cloudy sunrise')) {
        return <CloudySunrise className={className} arrowYPosition={arrowYPosition} />;
    }
    if (genericCondition.includes('cloudy sunset')) {
        return <CloudySunset className={className} arrowYPosition={arrowYPosition} />;
    }
    if (genericCondition.includes('sunrise')) {
        return <Sunrise className={className} arrowYPosition={arrowYPosition} />;
    }
    if (genericCondition.includes('sunset')) {
        return <Sunset className={className} arrowYPosition={arrowYPosition} />;
    }
    if (genericCondition.includes('partly cloudy night')) { // Specific debug case
        return <PartlyCloudyNight className={className} />;
    }
    
    // Check for most specific/intense conditions first.
    if (genericCondition.includes('temporale')) {
        return <Thunderstorm className={className} />;
    }
    if (genericCondition.includes('rovescio')) {
        return <Shower className={className} />;
    }
    if (genericCondition.includes('pioggia forte')) {
        return <HeavyRain className={className} />;
    }
    if (genericCondition.includes('pioggia leggera')) {
        return <LightRain className={className} />;
    }
    if (genericCondition.includes('pioggia')) {
        return <Rain className={className} />;
    }
    if (genericCondition.includes('pioggerella')) {
        return <Drizzle className={className} />;
    }
    if (genericCondition.includes('neve forte')) {
        return <HeavySnow className={className} />;
    }
    if (genericCondition.includes('gragnola') || genericCondition.includes('grandine')) {
        return <Hail className={className} />;
    }
    if (genericCondition.includes('neve leggera')) {
        return <LightSnow className={className} />;
    }
    if (genericCondition.includes('neve')) {
        return <Snow className={className} />;
    }
    if (genericCondition.includes('nebbia')) {
        return <Fog className={className} />;
    }
    if (genericCondition.includes('parzialmente nuvoloso')) {
        return isNight ? <PartlyCloudyNight className={className} /> : <PartlyCloudyDay className={className} />;
    }
    if (genericCondition.includes('nuvoloso') || genericCondition.includes('coperto')) {
        return <Cloudy className={className} />;
    }
    if (genericCondition.includes('sereno')) {
        return isNight ? <ClearNight className={className} /> : <Sunny className={className} />;
    }

    // Fallbacks for English terms that might be used in debug
    if (genericCondition.includes('partly') && genericCondition.includes('cloud')) {
        return isNight ? <PartlyCloudyNight className={className} /> : <PartlyCloudyDay className={className} />;
    }
    if (genericCondition.includes('cloud')) {
        return <Cloudy className={className} />;
    }
    if (genericCondition.includes('sun') || genericCondition.includes('clear')) {
        return isNight ? <ClearNight className={className} /> : <Sunny className={className} />;
    }
    if (genericCondition.includes('rain') || genericCondition.includes('drizzle')) {
        return <Rain className={className} />;
    }
    if (genericCondition.includes('snow') || genericCondition.includes('sleet')) {
        return <Snow className={className} />;
    }
    
    // Ultimate fallback to a generic cloudy icon.
    return <Cloudy className={className} />;
}