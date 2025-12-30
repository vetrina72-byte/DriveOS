
import React, { useRef, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';

// A self-contained component for the service button with 3D hover effects.
const ServiceButton = ({ service, isNight, onClick }: { 
    service: { name: string; logoUrl: string | { light: string; dark: string }; logoClassName: string; glowColor: string; };
    isNight: boolean; 
    onClick: () => void; 
}) => {
    const cardRef = useRef<HTMLButtonElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLImageElement>(null);
    
    const { logoUrl, name, glowColor } = service;

    // Check if logoUrl is an object; otherwise use the string
    let finalLogoUrl: string;
    if (typeof logoUrl === 'string') {
        finalLogoUrl = logoUrl;
    } else {
        finalLogoUrl = isNight ? logoUrl.dark : logoUrl.light;
    }

    const handlePointerMove = (x: number, y: number) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const mouseX = x - rect.left;
        const mouseY = y - rect.top;

        // Update CSS variables for glare effect
        cardRef.current.style.setProperty('--mouse-x', `${mouseX}px`);
        cardRef.current.style.setProperty('--mouse-y', `${mouseY}px`);

        // Calculate and apply 3D rotation
        const rotateX = (mouseY / rect.height - 0.5) * -20; // -10 to 10 degrees
        const rotateY = (mouseX / rect.width - 0.5) * 20;  // -10 to 10 degrees
        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;

        // Lift the logo towards the user
        if (logoRef.current) {
            logoRef.current.style.transform = `translateZ(40px)`;
        }
    };

    const handlePointerEnter = () => {
        if (glareRef.current) glareRef.current.style.opacity = '1';
    };

    const handlePointerLeave = () => {
        if (!cardRef.current) return;
        // Reset 3D transforms
        cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        
        // Reset logo position
        if (logoRef.current) {
            logoRef.current.style.transform = `translateZ(0px)`;
        }
        
        // Hide glare effect
        if (glareRef.current) {
            glareRef.current.style.opacity = '0';
        }
    };

    return (
        <button
            ref={cardRef}
            onClick={onClick}
            onMouseEnter={handlePointerEnter}
            onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
            onMouseLeave={handlePointerLeave}
            onTouchStart={(e) => {
                handlePointerEnter();
                handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchMove={(e) => handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={handlePointerLeave}
            className="service-button"
            style={{ '--glow-color': glowColor } as React.CSSProperties}
            aria-label={`Open ${service.name}`}
        >
            {/* Glare effect element */}
            <div
                ref={glareRef}
                className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 pointer-events-none"
                style={{
                    background: `radial-gradient(
                        350px circle at var(--mouse-x) var(--mouse-y),
                        rgba(148, 163, 184, 0.15),
                        transparent 80%
                    )`,
                }}
            />
            <img
                ref={logoRef}
                src={finalLogoUrl}
                alt={`${service.name} Logo`}
                className={`${service.logoClassName} h-auto object-contain max-h-20 transition-transform duration-300 ease-out pointer-events-none`}
                style={{ transformStyle: 'preserve-3d' }}
            />
        </button>
    );
};

// FIX: Explicitly type variants with the `Variants` type.
const driveOsHeaderVariant: Variants = {
    initial: { opacity: 0, y: 'calc(50vh - 150px)', scale: 1.5 },
    animate: {
        opacity: [0, 1, 1],
        y: ['calc(50vh - 150px)', 'calc(50vh - 150px)', '0px'],
        scale: [1.5, 1.5, 1],
        transition: { duration: 1.2, times: [0, 0.5, 1], delay: 0.5 }
    },
};

// FIX: Explicitly type variants with the `Variants` type.
const otherElementsVariant: Variants = {
    initial: { opacity: 0, y: 50 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      }
    }
};

// FIX: Explicitly type variants with the `Variants` type.
const gridContainerVariant: Variants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 1.7
      }
    },
};

const Theater = ({
    onClose,
    isNight,
    spotifyPlayerTop,
    spotifyPlayerBottom,
}: {
    onClose: () => void;
    isNight: boolean;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
}) => {
    const panelRef = useRef<HTMLDivElement>(null);

    // --- PHYSICS ENGINE (Unified) ---
    const physics = useRef({
        currentX: 100, // 0 = open, 100 = closed
        targetX: 100,
        isDragging: false,
        dragStartX: 0,
        dragStartCurrentX: 0,
        panelWidth: 0,
        animationId: 0
    });

    const ANIMATION_SPEED = 0.18; 
    const CLOSE_THRESHOLD_PERCENT = 25;

    // --- PHYSICS LOOP ---
    useEffect(() => {
        const update = () => {
            const state = physics.current;
            const panel = panelRef.current;

            // 1. Update Physics
            if (!state.isDragging) {
                const diff = state.targetX - state.currentX;
                if (Math.abs(diff) > 0.01) {
                    state.currentX += diff * ANIMATION_SPEED;
                } else {
                    state.currentX = state.targetX;
                }
            }

            // 2. Render
            if (panel) {
                let visualX = state.currentX;
                if (!state.isDragging) {
                    if (visualX < 0.01) visualX = 0;
                    if (visualX > 99.9) visualX = 100;
                }
                panel.style.transform = `translateX(${visualX}%)`;
            }

            state.animationId = requestAnimationFrame(update);
        };

        physics.current.animationId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(physics.current.animationId);
    }, []);

    // --- SYNC ON MOUNT ---
    useEffect(() => {
        // When mounted, trigger open animation
        const state = physics.current;
        if (!state.isDragging) {
            state.targetX = 0; // Open
        }
    }, []);

    // --- DRAG HANDLERS ---
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!panelRef.current) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        
        const state = physics.current;
        state.isDragging = true;
        state.dragStartX = e.clientX;
        state.dragStartCurrentX = state.currentX;
        state.panelWidth = panelRef.current.offsetWidth || window.innerWidth * 0.66;
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const state = physics.current;
        if (!state.isDragging) return;
        e.stopPropagation();

        const deltaPx = e.clientX - state.dragStartX;
        const deltaPercent = (deltaPx / state.panelWidth) * 100;
        
        let newPercent = state.dragStartCurrentX + deltaPercent;
        if (newPercent < 0) newPercent = 0; // Prevent widening
        
        state.currentX = newPercent;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.releasePointerCapture(e.pointerId);
        
        const state = physics.current;
        state.isDragging = false;

        if (state.currentX > CLOSE_THRESHOLD_PERCENT) {
            state.targetX = 100;
            onClose(); // Parent unmounts us
        } else {
            state.targetX = 0;
        }
    };

    const handleServiceClick = () => {
        // Functionality removed as per user request.
    };

    const services = [
        { name: 'Netflix', url: 'https://www.netflix.com', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', logoClassName: 'w-36', glowColor: '#E50914' },
        { name: 'Hulu', url: 'https://www.hulu.com', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Hulu_logo_%282018%29.svg', logoClassName: 'w-32', glowColor: '#1CE783' },
        { 
            name: 'YouTube', 
            url: 'https://www.youtube.com',
            logoUrl: {
                light: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg',
                dark: 'https://upload.wikimedia.org/wikipedia/commons/5/54/YouTube_dark_logo_2017.svg'
            }, 
            logoClassName: 'w-40',
            glowColor: '#FF0000'
        },
        { name: 'Twitch', url: 'https://www.twitch.tv', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Twitch_Glitch_Logo_Purple.svg', logoClassName: 'w-28', glowColor: '#9146FF' },
        { 
          name: 'Disney+',
          url: 'https://www.disneyplus.com',
          logoUrl: {
            light: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Disney%2B_2024.svg',
            dark: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Disney_Plus_logo.svg'
          },
          logoClassName: 'w-36',
          glowColor: '#3951DB'
        },
        { name: 'Prime Video', url: 'https://www.primevideo.com', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Prime_Video_logo_%282024%29.svg', logoClassName: 'w-36', glowColor: '#00A8E1' }
    ];

    const handleColorClass = isNight ? 'bg-zinc-300' : 'bg-zinc-600';

    return (
        <div
            ref={panelRef}
            className="spotify-app-panel w-2/3 shadow-2xl flex"
            style={{
                top: `${spotifyPlayerTop}px`,
                bottom: `${spotifyPlayerBottom}px`,
                willChange: 'transform',
                // Start initially closed (physics loop will open it)
                transform: 'translateX(100%)' 
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="theater-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="theater-container relative">
                {/* --- DRAG HANDLE --- */}
                <div
                    className="absolute top-0 bottom-0 -left-10 w-12 flex items-center justify-end pr-2 cursor-grab active:cursor-grabbing z-50 touch-none group"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    aria-label="Drag to close"
                >
                    <div 
                        className={`w-1 h-32 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-y-110 ${handleColorClass}`} 
                    />
                </div>
                {/* ------------------- */}

                <motion.header 
                    className="theater-header"
                    initial="initial"
                    animate="animate"
                    variants={{ animate: { transition: { delayChildren: 1.5 }}}}
                >
                    <motion.h1 
                        id="theater-app-title" 
                        className="driveos-title"
                        variants={driveOsHeaderVariant}
                    >
                        DRIVE OS
                    </motion.h1>
                    <motion.h2
                        variants={otherElementsVariant}
                        className="theater-title"
                    >
                        THEATER
                    </motion.h2>
                </motion.header>

                <motion.main 
                    variants={gridContainerVariant}
                    initial="initial"
                    animate="animate"
                    className="services-grid"
                >
                    {services.map((service) => (
                        <motion.div key={service.name} variants={otherElementsVariant}>
                            <ServiceButton
                                service={service}
                                isNight={isNight}
                                onClick={handleServiceClick}
                            />
                        </motion.div>
                    ))}
                </motion.main>
            </div>
        </div>
    );
};

export default React.memo(Theater);
