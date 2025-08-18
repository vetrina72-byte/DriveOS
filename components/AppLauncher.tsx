import React from 'react';
import { ICONS } from '../constants';

const APPS = [
    { name: 'Dashcam', icon: ICONS.dashcam },
    { name: 'Arcade', icon: ICONS.arcade },
    { name: 'Energy', icon: ICONS.energy },
    { name: 'Browser', icon: ICONS.browser },
    { name: 'Theater', icon: ICONS.theater },
    { name: 'Calendar', icon: ICONS.calendar },
    { name: 'Toybox', icon: ICONS.toybox },
    { name: 'Radio', icon: ICONS.radio },
    { name: 'Messages', icon: ICONS.messages },
    { name: 'Tidal', icon: ICONS.tidal },
];

const AppButton = ({ icon: Icon, name, isOpen, index }: { icon: React.ComponentType<any>, name: string, isOpen: boolean, index: number }) => {
    // Stagger animation for icons appearing, with a subtle pop-in effect.
    const delay = isOpen ? `${50 + index * 40}ms` : '0ms';
    
    return (
        <button 
            className="flex flex-col items-center justify-center gap-2 text-gray-300 hover:bg-white/10 rounded-lg p-3 w-24 h-24"
            style={{
                // Combine animations: color from hover, and opacity/transform from open/close state.
                transition: `background-color 150ms ease-out, opacity 300ms ease-out, transform 300ms ease-out`,
                transitionDelay: `${delay}, ${delay}, ${delay}`, // Apply delay to all animated properties
                transform: isOpen ? 'scale(1)' : 'scale(0.85)',
                opacity: isOpen ? 1 : 0,
            }}
            aria-label={`Open ${name}`}
            tabIndex={isOpen ? 0 : -1}
        >
            <Icon className="w-10 h-10" />
            <span className="text-xs font-medium">{name}</span>
        </button>
    );
};


export default function AppLauncher({ isOpen }: { isOpen: boolean }) {
    // Clicks inside the panel are stopped from propagating to the main wrapper,
    // which would otherwise close the launcher.
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    return (
        <div
            className={`
                absolute left-1/2 -translate-x-1/2 bottom-24 z-40
                w-11/12 max-w-lg
                bg-black/80 backdrop-blur-sm rounded-2xl shadow-2xl
                transition-all duration-300 ease-out
                ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}
            `}
            onClick={stopPropagation}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-launcher-title"
        >
            <h2 id="app-launcher-title" className="sr-only">App Launcher</h2>
            <div className="p-6 flex flex-wrap justify-center gap-x-2 gap-y-4">
                 {APPS.map((app, index) => (
                    <AppButton 
                        key={app.name} 
                        icon={app.icon} 
                        name={app.name} 
                        isOpen={isOpen} 
                        index={index} 
                    />
                ))}
            </div>
        </div>
    );
}