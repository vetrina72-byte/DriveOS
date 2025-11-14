import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { FiVolumeX, FiVolume1, FiVolume2 } from 'react-icons/fi';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

interface VolumeControlProps {
    iconSize: number;
    volumeSliderOffsetY: number;
    volumeSliderOffsetX: number;
    volumeSliderWidth: number;
    volumeSliderThickness: number;
    volumeSliderThumbOffsetY: number;
    volumeSliderPopupWidth: number;
    volumeSliderPopupHeight: number;
    zIndex: number;
}

const useHoldRepeat = (callback: () => void, delay = 300, interval = 120) => {
    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const savedCallback = useRef(callback);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    const stop = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
        timeoutRef.current = null;
        intervalRef.current = null;
    }, []);

    const start = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        savedCallback.current();
        
        timeoutRef.current = window.setTimeout(() => {
            intervalRef.current = window.setInterval(() => savedCallback.current(), interval);
        }, delay);
    }, [delay, interval]);

    return {
        onPointerDown: start,
        onPointerUp: stop,
        onPointerLeave: stop,
        onTouchEnd: stop, // For mobile
    };
};


const VolumeControl: React.FC<VolumeControlProps> = ({ iconSize, volumeSliderOffsetY, volumeSliderOffsetX, volumeSliderWidth, volumeSliderThickness, volumeSliderThumbOffsetY, volumeSliderPopupWidth, volumeSliderPopupHeight, zIndex }) => {
    const { volume, setVolumeLive, setVolumeFinal, isMuted } = useAuth();
    const [isSliderVisible, setIsSliderVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const autoCloseTimeoutRef = useRef<number | null>(null);
    const [popupPosition, setPopupPosition] = useState({ bottom: 0, left: 0 });

    const volumeRef = useRef(volume);
    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);

    const VolumeIcon = volume === 0 || isMuted ? FiVolumeX : volume < 0.5 ? FiVolume1 : FiVolume2;

    const handleClose = useCallback(() => {
        if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
        setIsClosing(true);
        setTimeout(() => {
            setIsSliderVisible(false);
            setIsClosing(false); // Reset for next open
        }, 300); // Must match fade-out animation duration
    }, []);

    const resetAutoCloseTimer = useCallback(() => {
        if (autoCloseTimeoutRef.current) {
            clearTimeout(autoCloseTimeoutRef.current);
        }
        autoCloseTimeoutRef.current = window.setTimeout(() => {
            handleClose();
        }, 5000); // Auto-close after 5 seconds of inactivity
    }, [handleClose]);

    const calculatePosition = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPopupPosition({
                bottom: window.innerHeight - rect.top + volumeSliderOffsetY,
                left: rect.left + (rect.width / 2) + volumeSliderOffsetX,
            });
        }
    }, [volumeSliderOffsetX, volumeSliderOffsetY]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const debugPanel = document.getElementById('debug-panel');
            if (
                isSliderVisible &&
                !isClosing &&
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                (!debugPanel || !debugPanel.contains(event.target as Node))
            ) {
                handleClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
        };
    }, [isSliderVisible, isClosing, handleClose]); 

    useEffect(() => {
        if (isSliderVisible) {
            calculatePosition();
            window.addEventListener('resize', calculatePosition);
            resetAutoCloseTimer();
            return () => window.removeEventListener('resize', calculatePosition);
        }
    }, [isSliderVisible, calculatePosition, resetAutoCloseTimer]);

    const handleIconClick = () => {
        if (isSliderVisible) {
            handleClose();
        } else {
            calculatePosition(); // Calculate fresh position right before opening
            setIsSliderVisible(true);
        }
    };
    
    const handleVolumeInput = (newVolume: number) => {
        setVolumeLive(newVolume);
        resetAutoCloseTimer();
    };
    
    const handleVolumeChange = (newVolume: number) => {
        setVolumeFinal(newVolume);
        resetAutoCloseTimer();
    };

    const STEP = 0.05;
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));

    const changeVolume = useCallback((direction: 'up' | 'down') => {
        const currentVol = volumeRef.current;
        const newVol = clamp(currentVol + (direction === 'up' ? STEP : -STEP), 0, 1);
        setVolumeFinal(newVol);
    }, [setVolumeFinal]);

    const handleArrowPress = useCallback((direction: 'up' | 'down') => {
        if (!isSliderVisible) {
            calculatePosition();
            setIsSliderVisible(true);
        }
        resetAutoCloseTimer();
        changeVolume(direction);
    }, [isSliderVisible, resetAutoCloseTimer, changeVolume, calculatePosition]);
    
    const upHandlers = useHoldRepeat(() => handleArrowPress('up'));
    const downHandlers = useHoldRepeat(() => handleArrowPress('down'));

    const thumbSize = volumeSliderThickness * 2.2;
    const thumbMarginTop = ((thumbSize - volumeSliderThickness) / -2) + volumeSliderThumbOffsetY;
    const progressPercentage = volume * 100;

    const sliderPopup = isSliderVisible && (
        <div
            className={`fixed ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            style={{
                left: `${popupPosition.left}px`,
                bottom: `${popupPosition.bottom}px`,
                transform: 'translateX(-50%)',
                zIndex,
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div 
                className="volume-slider-popup-container"
                style={{
                    width: `${volumeSliderPopupWidth}px`,
                    height: `${volumeSliderPopupHeight}px`,
                }}
            >
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onInput={(e) => handleVolumeInput(parseFloat((e.target as HTMLInputElement).value))}
                    onChange={(e) => handleVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
                    onPointerUp={(e) => handleVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
                    className="volume-slider"
                    aria-label="Volume slider"
                    style={{
                        background: `linear-gradient(to right, var(--volume-slider-fill-bg) ${progressPercentage}%, var(--volume-slider-track-bg) ${progressPercentage}%)`,
                        '--volume-track-height': `${volumeSliderThickness}px`,
                        '--volume-thumb-size': `${thumbSize}px`,
                        '--volume-thumb-margin-top': `${thumbMarginTop}px`,
                        width: `${volumeSliderWidth}px`,
                    } as React.CSSProperties}
                />
            </div>
        </div>
    );

    return (
        <div ref={containerRef} className="relative flex items-center gap-1 text-gray-400">
            {sliderPopup && ReactDOM.createPortal(sliderPopup, document.getElementById('portal-root')!)}

            <button {...downHandlers} className="p-2 hover:text-white transition-colors" aria-label="Decrease volume">
                <IoChevronBack className="w-5 h-5" />
            </button>

            <button onClick={handleIconClick} className="p-2 hover:text-white transition-colors" aria-label="Open volume slider">
                <VolumeIcon style={{ width: `${iconSize}px`, height: `${iconSize}px` }} />
            </button>

            <button {...upHandlers} className="p-2 hover:text-white transition-colors" aria-label="Increase volume">
                <IoChevronForward className="w-5 h-5" />
            </button>
        </div>
    );
};

export default VolumeControl;