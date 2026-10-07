import React from 'react';
import { FiPlus } from 'react-icons/fi';

interface AppDefinition {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  colorClasses?: string;
}

interface AppLauncherProps {
  isOpen: boolean;
  width: number;
  height: number;
  apps: AppDefinition[];
  isCustomizing: boolean;
  onCustomizeClick: (appId: string) => void;
  onAppLaunch: (appId: string) => void;
  isNight: boolean;
}

export default function AppLauncher({ isOpen, width, height, apps, isCustomizing, onCustomizeClick, onAppLaunch, isNight }: AppLauncherProps) {
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    return (
        <div
            className={`
                absolute left-1/2 -translate-x-1/2 bottom-24 z-[7000]
                bg-black/80 backdrop-blur-xl squircle-panel rounded-3xl border border-white/20 shadow-2xl
                transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]
                flex flex-col
                ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto visible' : 'opacity-0 translate-y-8 pointer-events-none invisible'}
            `}
            style={{
                width: `${width}%`,
                maxWidth: '48rem',
                minHeight: `${(height) / 16}rem`,
                maxHeight: 'calc(100vh - 8rem)',
            }}
            onClick={stopPropagation}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-launcher-title"
        >
            <h2 id="app-launcher-title" className="sr-only">App Launcher</h2>
            <div className="flex-grow p-5 sm:p-7 overflow-y-auto hide-scrollbar">
                {apps.length > 0 ? (
                    <div className="flex flex-wrap gap-4 sm:gap-6 justify-center items-start">
                        {[...apps].sort((a, b) => {
                            const priority = ['spotify', 'radio', 'youtube-music', 'theater', 'maps', 'debug'];
                            const idxA = priority.indexOf(a.id);
                            const idxB = priority.indexOf(b.id);
                            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                        }).map(app => (
                            <div key={app.id} className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isCustomizing) {
                                            onAppLaunch(app.id);
                                        }
                                    }}
                                    className={`flex flex-col items-center justify-center w-22 h-22 sm:w-24 sm:h-24 p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition-all duration-200 group gap-2 ${isCustomizing ? 'customizing-jiggle cursor-default' : 'cursor-pointer'}`}
                                >
                                    <app.icon className={`w-9 h-9 sm:w-10 sm:h-10 transition-transform group-hover:scale-110 drop-shadow-sm ${app.colorClasses || (isNight ? 'text-gray-200' : 'text-zinc-800')}`} />
                                    <span className="text-xs sm:text-[13px] font-bold tracking-tight truncate w-full px-1 text-center text-white drop-shadow-sm">
                                        {app.label}
                                    </span>
                                </button>
                                {isCustomizing && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onCustomizeClick(app.id);
                                      }}
                                      className="absolute -top-1 -right-1 w-6 h-6 bg-zinc-700 hover:bg-zinc-600 rounded-full flex items-center justify-center border-2 border-black transition-all duration-200 hover:scale-110 cursor-pointer shadow-md"
                                      aria-label={`Sposta ${app.label} sulla barra`}
                                    >
                                        <FiPlus className="w-3.5 h-3.5 text-white" strokeWidth={3}/>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                         <p className="text-gray-500">Nessuna applicazione disponibile</p>
                    </div>
                )}
            </div>
        </div>
    );
}