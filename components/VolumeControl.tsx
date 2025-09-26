import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { FiVolumeX, FiVolume1, FiVolume2 } from 'react-icons/fi';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

interface VolumeControlProps {
    iconSize: number;
    sliderOffsetY: number;
    sliderOffsetX: number;
    sliderWidth: number;
    volumeSliderThickness: number;
    sliderThumbOffsetY: number;
    sliderPopupWidth: number;
    sliderPopupHeight: number;
    zIndex: number;
}

const VolumeControl: React.FC<VolumeControlProps> = ({ iconSize, sliderOffsetY, sliderOffsetX, sliderWidth, volumeSliderThickness, sliderThumbOffsetY, sliderPopupWidth, sliderPopupHeight, zIndex }) => {
    const { volume, setVolume, isMuted } = useAuth();
    const [isSliderVisible, setIsSliderVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const autoCloseTimeoutRef = useRef<number | null>(null);
    const [popupPosition, setPopupPosition] = useState({ bottom: 0, left: 0 });

    const VolumeIcon = volume === 0 || isMuted ? FiVolumeX : volume < 0.5 ? FiVolume1 : FiVolume2;

    const handleClose = () => {
        if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
        setIsClosing(true);
        setTimeout(() => {
            setIsSliderVisible(false);
            setIsClosing(false); // Reset for next open
        }, 300); // Must match fade-out animation duration
    };

    const resetAutoCloseTimer = () => {
        if (autoCloseTimeoutRef.current) {
            clearTimeout(autoCloseTimeoutRef.current);
        }
        autoCloseTimeoutRef.current = window.setTimeout(() => {
            handleClose();
        }, 4000); // Auto-close after 4 seconds of inactivity
    };

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
    }, [isSliderVisible, isClosing]); // Rerun if visibility or closing state changes

    const calculatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPopupPosition({
                bottom: window.innerHeight - rect.top + sliderOffsetY,
                left: rect.left + (rect.width / 2) + sliderOffsetX,
            });
        }
    };
    
    useEffect(() => {
        if (isSliderVisible) {
            calculatePosition();
            window.addEventListener('resize', calculatePosition);
            return () => window.removeEventListener('resize', calculatePosition);
        }
    }, [isSliderVisible, sliderOffsetX, sliderOffsetY]);

    const handleIconClick = () => {
        if (isSliderVisible) {
            handleClose();
        } else {
            calculatePosition(); // Calculate fresh position right before opening
            setIsSliderVisible(true);
            resetAutoCloseTimer();
        }
    };

    const handleVolumeChange = (newVolume: number) => {
        setVolume(newVolume);
        if (!isSliderVisible) {
            setIsSliderVisible(true);
        }
        resetAutoCloseTimer();
    };

    const thumbSize = volumeSliderThickness * 2.2;
    const thumbMarginTop = ((thumbSize - volumeSliderThickness) / -2) + sliderThumbOffsetY;
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
                    width: `${sliderPopupWidth}px`,
                    height: `${sliderPopupHeight}px`,
                }}
            >
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="volume-slider"
                    aria-label="Volume slider"
                    style={{
                        background: `linear-gradient(to right, var(--volume-slider-fill-bg) ${progressPercentage}%, var(--volume-slider-track-bg) ${progressPercentage}%)`,
                        '--volume-track-height': `${volumeSliderThickness}px`,
                        '--volume-thumb-size': `${thumbSize}px`,
                        '--volume-thumb-margin-top': `${thumbMarginTop}px`,
                        width: `${sliderWidth}px`,
                    } as React.CSSProperties}
                />
            </div>
        </div>
    );

    return (
        <div ref={containerRef} className="relative flex items-center gap-1 text-gray-400">
            {sliderPopup && ReactDOM.createPortal(sliderPopup, document.getElementById('portal-root')!)}

            <button onClick={() => handleVolumeChange(Math.max(0, volume - 0.1))} className="p-2 hover:text-white transition-colors" aria-label="Decrease volume">
                <IoChevronBack className="w-5 h-5" />
            </button>

            <button onClick={handleIconClick} className="p-2 hover:text-white transition-colors" aria-label="Open volume slider">
                <VolumeIcon style={{ width: `${iconSize}px`, height: `${iconSize}px` }} />
            </button>

            <button onClick={() => handleVolumeChange(Math.min(1, volume + 0.1))} className="p-2 hover:text-white transition-colors" aria-label="Increase volume">
                <IoChevronForward className="w-5 h-5" />
            </button>
        </div>
    );
};

export default VolumeControl;