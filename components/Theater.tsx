import React, { useRef } from 'react';
import { motion } from 'framer-motion';

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


// Framer Motion Variants for the choreographed entry animation
const panelVariant = {
    initial: { x: '100%' },
    animate: { x: '0%', transition: { type: 'spring', stiffness: 200, damping: 25 } },
    exit: { x: '100%', transition: { type: 'spring', stiffness: 300, damping: 30 } },
};

const driveOsHeaderVariant = {
    initial: { opacity: 0, y: 'calc(50vh - 150px)', scale: 1.5 },
    animate: {
        opacity: [0, 1, 1],
        y: ['calc(50vh - 150px)', 'calc(50vh - 150px)', '0px'],
        scale: [1.5, 1.5, 1],
        transition: { duration: 1.2, times: [0, 0.5, 1], delay: 0.5 }
    },
};

const otherElementsVariant = {
    initial: { opacity: 0, y: 50 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      }
    }
};

const gridContainerVariant = {
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

    return (
        <motion.div
            variants={panelVariant}
            initial="initial"
            animate="animate"
            exit="exit"
            className="spotify-app-panel shadow-2xl flex"
            style={{
                top: `${spotifyPlayerTop}px`,
                bottom: `${spotifyPlayerBottom}px`,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="theater-app-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div
                className="theater-container"
            >
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
        </motion.div>
    );
};

export default React.memo(Theater);