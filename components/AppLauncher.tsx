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
                absolute left-1/2 -translate-x-1/2 bottom-24 z-40
                bg-black rounded-2xl border border-white/10
                transition-all duration-300 ease-out
                flex flex-col
                ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}
            `}
            style={{
                width: `${width}%`,
                maxWidth: '1200px',
                minHeight: `${height}px`,
                maxHeight: 'calc(100vh - 8rem)',
            }}
            onClick={stopPropagation}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-launcher-title"
        >
            <h2 id="app-launcher-title" className="sr-only">App Launcher</h2>
            <div className="flex-grow p-6 overflow-y-auto hide-scrollbar">
                {apps.length > 0 ? (
                    <div className="flex flex-wrap gap-6 justify-center items-start">
                        {apps.map(app => (
                            <div key={app.id} className="relative group">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isCustomizing) {
                                            onAppLaunch(app.id);
                                        }
                                    }}
                                    className={`flex flex-col items-center justify-center w-24 h-24 transition-transform duration-200 ${isCustomizing ? 'customizing-jiggle cursor-default' : 'cursor-pointer'}`}
                                >
                                    <app.icon className={`w-10 h-10 transition-transform group-hover:scale-110 ${app.colorClasses || (isNight ? 'text-gray-200' : 'text-gray-800')}`} />
                                </button>
                                {isCustomizing && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onCustomizeClick(app.id);
                                      }}
                                      className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded-full flex items-center justify-center border-2 border-black opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 cursor-pointer"
                                      aria-label={`Sposta ${app.label} sulla barra`}
                                    >
                                        <FiPlus className="w-4 h-4 text-white" strokeWidth={3}/>
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
