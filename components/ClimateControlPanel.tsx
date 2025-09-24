

import React from 'react';
import { useVehicle } from '../context/VehicleContext';
import { FiChevronUp, FiChevronDown, FiPower } from 'react-icons/fi';
import { ICONS } from '../constants';
import type { ClimateState } from '../types';

const TempControl = ({
  label,
  temperature,
  onIncrease,
  onDecrease,
}: {
  label: string;
  temperature: number;
  onIncrease: () => void;
  onDecrease: () => void;
}) => (
  <div className="flex flex-col items-center gap-4 text-center">
    <button
      onClick={onIncrease}
      className="p-3 text-gray-400 rounded-full hover:bg-white/10 transition-colors"
      aria-label={`Increase ${label} temperature`}
    >
      <FiChevronUp size={32} />
    </button>
    <div className="font-bold text-6xl tracking-tighter">
      {temperature}°
    </div>
    <button
      onClick={onDecrease}
      className="p-3 text-gray-400 rounded-full hover:bg-white/10 transition-colors"
      aria-label={`Decrease ${label} temperature`}
    >
      <FiChevronDown size={32} />
    </button>
     <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
  </div>
);

const SeatHeaterControl = ({
    level,
    onClick
}: {
    level: number;
    onClick: () => void;
}) => {
    const heatColors = ['text-gray-500', 'text-red-400', 'text-red-500', 'text-red-600'];
    const heatBg = ['bg-white/5', 'bg-red-500/10', 'bg-red-500/20', 'bg-red-500/30'];

    return (
        <button 
            onClick={onClick}
            className={`relative p-4 rounded-full transition-all duration-200 ${heatBg[level]}`}
            aria-label={`Seat heater level ${level}`}
        >
            <ICONS.seat className={`w-8 h-8 transition-colors ${heatColors[level]}`} />
            {level > 0 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {Array.from({ length: level }).map((_, i) => (
                         <div key={i} className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    ))}
                </div>
            )}
        </button>
    );
};


const ClimateToggleButton = ({
    icon: Icon,
    label,
    isActive,
    onClick
}: {
    icon: React.ComponentType<any>;
    label: string;
    isActive: boolean;
    onClick: () => void;
}) => (
     <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-1.5 w-20 p-2 rounded-lg transition-colors ${isActive ? 'text-blue-400 bg-blue-500/20' : 'text-gray-400 hover:bg-white/10'}`}
        aria-pressed={isActive}
    >
        <Icon className="w-7 h-7" />
        <span className="text-xs font-semibold">{label}</span>
    </button>
);


export default function ClimateControlPanel({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
    const { state, dispatch } = useVehicle();
    const { climate } = state;

    const setClimate = (payload: Partial<ClimateState>) => {
        dispatch({ type: 'SET_CLIMATE', payload });
    };

    const handleTempChange = (side: 'driver' | 'passenger', direction: 'up' | 'down') => {
        const currentTemp = side === 'driver' ? climate.insideTemp : 22; // Assuming passenger temp is separate
        const newTemp = direction === 'up' ? currentTemp + 1 : currentTemp - 1;
        setClimate({ insideTemp: newTemp });
    };

    const handleSeatHeaterClick = (side: 'driver' | 'passenger') => {
        const currentLevel = side === 'driver' ? climate.driverSeatHeater : climate.passengerSeatHeater;
        const nextLevel = (currentLevel + 1) % 4;
        if (side === 'driver') {
            setClimate({ driverSeatHeater: nextLevel });
        } else {
            setClimate({ passengerSeatHeater: nextLevel });
        }
    };
    
    return (
        <div
            className={`absolute bottom-0 left-0 right-0 z-[3000] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                ${isOpen ? 'translate-y-0' : 'translate-y-full'}`
            }
            onClick={stopPropagation}
            role="dialog"
            aria-modal="true"
            aria-labelledby="climate-panel-title"
        >
            <div className="mx-auto w-full max-w-4xl bg-black/80 backdrop-blur-md rounded-t-3xl shadow-2xl p-6 text-white border-t border-white/10">
                <h2 id="climate-panel-title" className="sr-only">Climate Controls</h2>
                
                <div className="flex justify-between items-start">
                    {/* Driver Controls */}
                    <div className="flex flex-col items-center gap-4">
                        <TempControl 
                            label="Driver"
                            temperature={climate.insideTemp}
                            onIncrease={() => handleTempChange('driver', 'up')}
                            onDecrease={() => handleTempChange('driver', 'down')}
                        />
                        <SeatHeaterControl 
                            level={climate.driverSeatHeater}
                            onClick={() => handleSeatHeaterClick('driver')}
                        />
                    </div>
                    
                    {/* Center Controls */}
                    <div className="flex flex-col items-center gap-6 pt-6">
                        <div className="flex items-center gap-3">
                           <ICONS.fan className="w-6 h-6 text-gray-400" />
                           <input 
                                type="range" 
                                min="0" 
                                max="5"
                                value={climate.fanSpeed}
                                onChange={(e) => setClimate({ fanSpeed: parseInt(e.target.value, 10) })}
                                className="w-64 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                aria-label="Fan speed"
                           />
                        </div>
                         <div className="flex gap-3">
                            <ClimateToggleButton 
                                icon={ICONS.ac}
                                label="A/C"
                                isActive={climate.acOn}
                                onClick={() => setClimate({ acOn: !climate.acOn })}
                            />
                             <ClimateToggleButton 
                                icon={ICONS.frontDefrost}
                                label="Front"
                                isActive={climate.frontDefrost}
                                onClick={() => setClimate({ frontDefrost: !climate.frontDefrost })}
                            />
                             <ClimateToggleButton 
                                icon={ICONS.rearDefrost}
                                label="Rear"
                                isActive={climate.rearDefrost}
                                onClick={() => setClimate({ rearDefrost: !climate.rearDefrost })}
                            />
                        </div>
                        <button 
                            onClick={() => setClimate({ autoOn: !climate.autoOn })}
                            className={`px-8 py-2.5 rounded-full font-bold transition-colors ${climate.autoOn ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-gray-300'}`}
                        >
                            AUTO
                        </button>
                    </div>

                    {/* Passenger Controls */}
                     <div className="flex flex-col items-center gap-4">
                        <TempControl 
                            label="Passenger"
                            temperature={climate.insideTemp} // For now, sync with driver
                            onIncrease={() => handleTempChange('passenger', 'up')}
                            onDecrease={() => handleTempChange('passenger', 'down')}
                        />
                        <SeatHeaterControl 
                             level={climate.passengerSeatHeater}
                             onClick={() => handleSeatHeaterClick('passenger')}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}