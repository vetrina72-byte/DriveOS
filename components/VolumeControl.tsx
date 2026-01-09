
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

    // --- VISUAL VOLUME INTERPOLATION ---
    const [visualVolume, setVisualVolume] = useState(volume);
    const lastInputValue = useRef(volume);
    
    // Smoothly animate visualVolume towards the actual volume prop
    useEffect(() => {
        let animationFrameId: number;
        
        const animate = () => {
            setVisualVolume(current => {
                const diff = volume - current;
                // Snap if very close to target
                if (Math.abs(diff) < 0.005) return volume;
                // Interpolate (adjust 0.2 for speed/fluidity)
                return current + diff * 0.2;
            });
            
            // Keep animating if we haven't reached target
            if (Math.abs(volume - visualVolume) > 0.005) {
                animationFrameId = requestAnimationFrame(animate);
            }
        };
        
        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [volume, visualVolume]);

    const volumeRef = useRef(volume);
    useEffect(() => {
        volumeRef.current = volume;
        // Only sync ref if we are not actively dragging, to avoid fighting the user
        // However, we rely on handleVolumeInput to update lastInputValue during interaction.
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
    
    // When user drags/clicks
    const handleVolumeInput = (newVolume: number) => {
        lastInputValue.current = newVolume;
        setVolumeLive(newVolume);
        
        // VISUAL TRICK:
        // If the change is small (drag), update visualVolume immediately for responsiveness.
        // If the change is large (click on empty space), do NOT update visualVolume immediately.
        // This forces the input thumb (bound to visualVolume) to stay put for a frame,
        // allowing the useEffect above to interpolate it smoothly to the new target.
        const diff = Math.abs(newVolume - visualVolume);
        
        // Threshold: 0.05 (5%) allows fast dragging to feel responsive, 
        // while anything larger triggers the smooth animation.
        if (diff < 0.05) {
            setVisualVolume(newVolume); // Snap for drag
        }
        // Else: let interpolation handle the slide for click/jump
        
        resetAutoCloseTimer();
    };
    
    const handleVolumeChange = (newVolume: number) => {
        lastInputValue.current = newVolume;
        setVolumeFinal(newVolume);
        
        const diff = Math.abs(newVolume - visualVolume);
        if (diff < 0.05) {
            setVisualVolume(newVolume);
        }
        resetAutoCloseTimer();
    };

    const STEP = 0.05;
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));

    const changeVolume = useCallback((direction: 'up' | 'down') => {
        const currentVol = volumeRef.current;
        const newVol = clamp(currentVol + (direction === 'up' ? STEP : -STEP), 0, 1);
        setVolumeFinal(newVol);
        // We let the useEffect handle the visual animation for button presses
    }, [setVolumeFinal]);

    const handleArrowPress = useCallback((direction: 'up' | 'down') => {
        if (!isSliderVisible) {
            calculatePosition();
            setIsSliderVisible(true);
        } else {
            resetAutoCloseTimer();
        }
        changeVolume(direction);
    }, [isSliderVisible, resetAutoCloseTimer, changeVolume, calculatePosition]);
    
    const upHandlers = useHoldRepeat(() => handleArrowPress('up'));
    const downHandlers = useHoldRepeat(() => handleArrowPress('down'));

    const thumbSize = volumeSliderThickness * 2.2;
    const thumbMarginTop = ((thumbSize - volumeSliderThickness) / -2) + volumeSliderThumbOffsetY;
    
    // Use visualVolume for the gradient background to animate it
    const progressPercentage = visualVolume * 100;

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
                    // Bind value to visualVolume so the thumb moves with the animation (ball follows bar)
                    value={visualVolume} 
                    onInput={(e) => handleVolumeInput(parseFloat((e.target as HTMLInputElement).value))}
                    // IMPORTANT: DO NOT use onChange. It conflicts with the animation on single clicks.
                    // We rely on onPointerUp/onTouchEnd to commit the final value tracked in lastInputValue.
                    onPointerUp={() => handleVolumeChange(lastInputValue.current)}
                    onTouchEnd={() => handleVolumeChange(lastInputValue.current)}
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
