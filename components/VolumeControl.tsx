import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiVolumeX, FiVolume1, FiVolume2 } from 'react-icons/fi';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

interface VolumeControlProps {
    iconSize: number;
    sliderOffsetY: number;
    sliderOffsetX: number;
}

const VolumeControl: React.FC<VolumeControlProps> = ({ iconSize, sliderOffsetY, sliderOffsetX }) => {
    const { volume, setVolume, isMuted } = useAuth();
    const [isSliderVisible, setIsSliderVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const autoCloseTimeoutRef = useRef<number | null>(null);

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
        }, 3000); // Auto-close after 3 seconds of inactivity
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

    const handleIconClick = () => {
        if (isSliderVisible) {
            handleClose();
        } else {
            setIsSliderVisible(true);
            resetAutoCloseTimer();
        }
    };

    const handleVolumeChange = (newVolume: number) => {
        setVolume(newVolume);
        if (isSliderVisible) {
            resetAutoCloseTimer();
        }
    };

    return (
        <div ref={containerRef} className="relative flex items-center gap-1 text-gray-400">
            {isSliderVisible && (
                <div
                    className={`absolute bottom-full ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
                    style={{
                        left: `calc(50% + ${sliderOffsetX}px)`,
                        transform: 'translateX(-50%)',
                        marginBottom: `${sliderOffsetY}px`,
                    }}
                >
                    <div className="volume-slider-popup-container">
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            className="volume-slider"
                            aria-label="Volume slider"
                            style={{ '--volume-progress': `${volume * 100}%` } as React.CSSProperties}
                        />
                    </div>
                </div>
            )}

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