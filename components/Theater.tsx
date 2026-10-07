
import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, Variants } from 'framer-motion';
import { useUIConfig, APP_TRANSITION_DURATION } from '../context/UIConfigContext';
import DrawerHandle, { HANDLE_GAP_FROM_PANEL, HANDLE_PILL_THICKNESS, HANDLE_MIN_MARGIN_FROM_VIEWPORT } from './DrawerHandle';
import { cubicBezierEase } from './VehicleCanvas';

// A self-contained component for the service button with 3D hover effects.
const ServiceButton = ({ service, isNight, onClick }: { 
    service: { name: string; logoUrl: string | { light: string; dark: string }; logoClassName: string; glowColor: string; };
    isNight: boolean; 
    onClick: () => void; 
}) => {
    const cardRef = useRef<HTMLButtonElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLImageElement>(null);
    const cachedRectRef = useRef<DOMRect | null>(null);
    
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
        let rect = cachedRectRef.current;
        if (!rect) {
            rect = cardRef.current.getBoundingClientRect();
            cachedRectRef.current = rect;
        }
        const mouseX = x - rect.left;
        const mouseY = y - rect.top;

        // Update CSS variables for glare effect
        cardRef.current.style.setProperty('--mouse-x', `${(mouseX) / 16}rem`);
        cardRef.current.style.setProperty('--mouse-y', `${(mouseY) / 16}rem`);

        // Calculate and apply 3D rotation
        const rotateX = (mouseY / (rect.height || 1) - 0.5) * -20; // -10 to 10 degrees
        const rotateY = (mouseX / (rect.width || 1) - 0.5) * 20;  // -10 to 10 degrees
        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;

        // Lift the logo towards the user
        if (logoRef.current) {
            logoRef.current.style.transform = `translateZ(40px)`;
        }
    };

    const handlePointerEnter = () => {
        if (cardRef.current) {
            cachedRectRef.current = cardRef.current.getBoundingClientRect();
        }
        if (glareRef.current) glareRef.current.style.opacity = '1';
    };

    const handlePointerLeave = () => {
        cachedRectRef.current = null;
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
                if (e.touches[0]) {
                    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
                }
            }}
            onTouchMove={(e) => {
                if (e.touches[0]) {
                    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
                }
            }}
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
        y: ['calc(50vh - 150px)', 'calc(50vh - 150px)', '0rem'],
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
    isOpen,
    onClose,
    isNight,
    spotifyPlayerTop,
    spotifyPlayerBottom,
    onDragProgress,
    isMapsLayered,
    layeredAppTopOffset = 0,
}: {
    isOpen: boolean;
    onClose: () => void;
    isNight: boolean;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
    isMapsLayered?: boolean;
    onDragProgress?: (progress: number | null) => void;
    layeredAppTopOffset?: number;
}) => {
    const { sceneTransitionSpeed = 1.10 } = useUIConfig();
    const panelRef = useRef<HTMLDivElement>(null);

    const [renderLayered, setRenderLayered] = useState(isMapsLayered);
    const isVerticalRef = useRef(isMapsLayered);

    useEffect(() => {
        if (isOpen) {
            setRenderLayered(!!isMapsLayered);
            isVerticalRef.current = !!isMapsLayered;
        }
    }, [isMapsLayered, isOpen]);

    // --- PHYSICS ENGINE (Unified) ---
    const physics = useRef({
        currentPercent: isOpen ? 0 : 100, // 0 = open, 100 = closed
        targetPercent: isOpen ? 0 : 100,
        startPercent: isOpen ? 0 : 100,
        animStartTime: 0,
        isDragging: false,
        isInteracting: false, // NEW: Interaction sequence tracking
        dragStart: 0,
        dragStartPercent: 0,
        panelDimension: 0,
        animationId: 0
    });

    const ANIMATION_SPEED = 0.18; 
    const CLOSE_THRESHOLD_PERCENT = 25;

    const updateRef = useRef<() => void>(() => {});

    const startAnimation = useCallback(() => {
        if (!physics.current.animationId) {
            physics.current.animationId = requestAnimationFrame(() => {
                physics.current.animationId = 0;
                updateRef.current();
            });
        }
    }, []);

    // --- PHYSICS LOOP ---
    useEffect(() => {
        const update = () => {
            const state = physics.current;
            const panel = panelRef.current;

            // 1. Update Physics
            let isSettled = false;
            if (!state.isDragging) {
                if (state.animStartTime > 0) {
                    const elapsed = performance.now() - state.animStartTime;
                    const duration = APP_TRANSITION_DURATION; // 580ms unified transition duration
                    const t = Math.min(elapsed / duration, 1.0);
                    const easeT = cubicBezierEase(t);
                    state.currentPercent = state.startPercent + (state.targetPercent - state.startPercent) * easeT;
                    if (t >= 1.0) {
                        state.currentPercent = state.targetPercent;
                        state.animStartTime = 0;
                        isSettled = true;
                    }
                } else {
                    state.currentPercent = state.targetPercent;
                    isSettled = true;
                }
            }

            // 2. Report Progress to 3D Scene (Seamless Handoff)
            if (state.isInteracting) {
                let visualProgress = state.currentPercent / 100;
                visualProgress = Math.max(0, Math.min(1, visualProgress));
                
                onDragProgress?.(visualProgress);

                // Check if settled
                if (!state.isDragging && (isSettled || Math.abs(state.targetPercent - state.currentPercent) < 0.5)) {
                    state.isInteracting = false;
                    onDragProgress?.(null);
                }
            }

            // 3. Render
            if (panel) {
                let visualPercent = state.currentPercent;
                if (!state.isDragging) {
                    if (visualPercent < 0.01) visualPercent = 0;
                    if (visualPercent > 99.9) visualPercent = 100;
                }
                if (isVerticalRef.current) {
                    panel.style.transform = `translateY(${visualPercent}%)`;
                } else {
                    panel.style.transform = `translateX(${visualPercent}%)`;
                }

                if (visualPercent >= 100) {
                    panel.style.visibility = 'hidden';
                } else {
                    panel.style.visibility = 'visible';
                }
            }

            // 4. Schedule next frame ONLY if active
            if (!isSettled || state.isDragging || state.isInteracting) {
                state.animationId = requestAnimationFrame(() => {
                    state.animationId = 0;
                    updateRef.current();
                });
            } else {
                state.animationId = 0;
            }
        };

        updateRef.current = update;
    });

    useEffect(() => {
        // Initial positioning render
        updateRef.current();
        return () => {
            if (physics.current.animationId) {
                cancelAnimationFrame(physics.current.animationId);
                physics.current.animationId = 0;
            }
            if (physics.current.isInteracting) {
                onDragProgress?.(null);
            }
        };
    }, [onDragProgress]);

    // --- SYNC REACT PROP TO PHYSICS TARGET ---
    useEffect(() => {
        const state = physics.current;
        if (!state.isDragging) {
            const newTargetPercent = isOpen ? 0 : 100;
            if (state.targetPercent !== newTargetPercent || state.animStartTime === 0 || Math.abs(state.currentPercent - newTargetPercent) > 0.01) {
                state.startPercent = state.currentPercent;
                state.targetPercent = newTargetPercent;
                state.animStartTime = performance.now();
                startAnimation();
            }
        }
    }, [isOpen, startAnimation]);

    // --- DRAG HANDLERS ---
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!panelRef.current) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        
        const state = physics.current;
        state.isDragging = true;
        state.isInteracting = true; // Start interaction sequence
        if (renderLayered) {
             state.dragStart = e.clientY;
             state.panelDimension = panelRef.current.offsetHeight || window.innerHeight;
        } else {
             state.dragStart = e.clientX;
             state.panelDimension = panelRef.current.offsetWidth || window.innerWidth * 0.66;
        }
        state.dragStartPercent = state.currentPercent;
        startAnimation();
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const state = physics.current;
        if (!state.isDragging) return;
        e.stopPropagation();

        const currentPos = renderLayered ? e.clientY : e.clientX;
        const deltaPx = currentPos - state.dragStart;
        const deltaPercent = (deltaPx / state.panelDimension) * 100;
        
        let newPercent = state.dragStartPercent + deltaPercent;
        if (newPercent < 0) newPercent = 0; // Prevent widening
        
        state.currentPercent = newPercent;
        startAnimation();
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.releasePointerCapture(e.pointerId);
        
        const state = physics.current;
        // CRITICAL FIX: Only process drop logic if we were actually dragging.
        // Prevents premature close trigger on startup/mount.
        if (!state.isDragging) return;

        state.isDragging = false;
        // DO NOT call onDragProgress(null) here.

        if (state.currentPercent > CLOSE_THRESHOLD_PERCENT) {
            state.startPercent = state.currentPercent;
            state.targetPercent = 100;
            state.animStartTime = performance.now();
            if (isOpen) onClose();
        } else {
            state.startPercent = state.currentPercent;
            state.targetPercent = 0;
            state.animStartTime = performance.now();
        }
        startAnimation();
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

    const effectiveLayeredTop = Math.max(layeredAppTopOffset ?? 18, HANDLE_GAP_FROM_PANEL + HANDLE_PILL_THICKNESS + HANDLE_MIN_MARGIN_FROM_VIEWPORT);

    const portalTarget = renderLayered ? document.getElementById('maps-anchored-container') : null;

    const mainContent = (
        <div
            ref={panelRef}
            data-app-id="theater"
            className={`theater-app-panel overflow-visible flex ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'} ${renderLayered ? 'absolute left-0 right-0 w-full' : 'relative w-full h-full'}`}
            style={{
                top: renderLayered ? `${effectiveLayeredTop}px` : `${(spotifyPlayerTop) / 16}rem`,
                bottom: renderLayered ? 0 : `${(spotifyPlayerBottom) / 16}rem`,
                willChange: 'transform',
                // Start initially closed (physics loop will open it)
                transform: 'translateX(100%)' 
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="theater-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            {/* --- DRAG HANDLE (OUTSIDE CLIPPING) --- */}
            <DrawerHandle
                orientation={renderLayered ? 'vertical' : 'horizontal'}
                isOpen={isOpen}
                isNight={isNight}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                ariaLabel="Trascina per chiudere Theater"
            />

            <div className="theater-container relative squircle-panel rounded-tl-3xl rounded-tr-none rounded-b-none overflow-hidden pt-10 px-8 sm:px-12 pb-10 shadow-2xl">

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

    if (renderLayered && portalTarget) {
        return ReactDOM.createPortal(mainContent, portalTarget);
    }

    return mainContent;
};

export default React.memo(Theater);
