import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiMic, FiArrowUp, FiDelete, FiAlertTriangle } from 'react-icons/fi';

const qwertyLayoutLower = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.'],
];

const qwertyLayoutUpper = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ';', ':'],
];

const symbolsLayout = [
    ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
    ['-', '_', '=', '+', '[', ']', '{', '}', '\\', '|'],
    [';', ':', '\'', '"', ',', '.', '/', '?'],
];


const Key = ({
    keyConfig,
    onClick,
    isNight,
    fontSize,
    fontWeight
}: {
    keyConfig: string | { key: string; label: React.ReactNode; flex?: string; className?: string; colSpan?: string; rowSpan?: string };
    onClick: (key: string) => void;
    isNight: boolean;
    fontSize: number;
    fontWeight: number;
}) => {
    const { key, label, flex, className, colSpan, rowSpan } = 
        typeof keyConfig === 'object' 
        ? keyConfig 
        : { key: keyConfig, label: keyConfig, flex: '1', className: '', colSpan: 'span 1', rowSpan: 'span 1' };

    if (!key) return <div className="w-full" style={{ flex }} />;

    const isSpecialKey = ['Shift', 'Backspace', '!?_', 'ABC', 'Mic', 'Space', 'Enter'].includes(key);
    const isActive = className?.includes('bg-blue');

    const baseStyle = `w-full h-full flex items-center justify-center transition-all duration-100 ease-out focus:outline-none select-none`;
    
    let themeStyle;
    if (isSpecialKey) {
        if (isNight) {
            themeStyle = `bg-zinc-700 text-gray-100 ${!isActive ? 'hover:bg-zinc-600' : ''}`;
        } else {
            themeStyle = `bg-zinc-200 text-black ${!isActive ? 'hover:bg-zinc-300' : ''}`;
        }
    } else {
        themeStyle = isNight ? 'text-gray-100 hover:bg-white/10' : 'text-black hover:bg-black/5';
    }

    const structuralStyle = isSpecialKey
        ? 'rounded-xl scale-[0.92] active:scale-[0.85]'
        : 'rounded-md scale-[0.95] active:scale-[0.90]';
    
    const finalClassName = `${baseStyle} ${themeStyle} ${structuralStyle} ${className || ''}`;

    return (
        <motion.button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick(key);
            }}
            className={finalClassName}
            style={{ 
                flex, 
                gridColumn: colSpan, 
                gridRow: rowSpan,
                fontSize: `${key === 'Enter' ? fontSize * 0.7 : fontSize}px`,
                fontWeight,
            }}
        >
            {label}
        </motion.button>
    );
};

type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'error';

const VirtualKeyboard = ({
    isVisible,
    targetElement,
    onClose,
    isNight,
    virtualKeyboardKeySize,
    virtualKeyboardHeight,
    virtualKeyboardPaddingX,
    virtualKeyboardKeyGapX,
    virtualKeyboardKeyGapY,
    virtualKeyboardKeyFontWeight,
}: {
    isVisible: boolean;
    targetElement: HTMLInputElement | HTMLTextAreaElement | null;
    onClose: () => void;
    isNight: boolean;
    virtualKeyboardKeySize: number;
    virtualKeyboardHeight: number;
    virtualKeyboardPaddingX: number;
    virtualKeyboardKeyGapX: number;
    virtualKeyboardKeyGapY: number;
    virtualKeyboardKeyFontWeight: number;
}) => {
    const [shiftMode, setShiftMode] = useState<'off' | 'shift' | 'caps'>('off');
    const [layoutMode, setLayoutMode] = useState<'letters' | 'symbols'>('letters');
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const longPressTimer = useRef<number | null>(null);
    const longPressInterval = useRef<number | null>(null);

    const voiceStatusRef = useRef(voiceStatus);
    useEffect(() => {
        voiceStatusRef.current = voiceStatus;
    }, [voiceStatus]);
    
    const stopRecognitionAndStream = useCallback(() => {
        if (recognitionRef.current) {
            // Detach all event handlers to prevent them from firing after a manual stop, avoiding race conditions.
            recognitionRef.current.onstart = null;
            recognitionRef.current.onspeechend = null;
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onend = null;
            
            recognitionRef.current.abort(); // Use abort() for a more immediate stop than stop().
            recognitionRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        // Directly set the state to idle, as this is a manual user action.
        setVoiceStatus('idle');
    }, []);


    // Cleanup effect to stop recognition and stream if the keyboard is closed or component unmounts.
    useEffect(() => {
        return () => {
            stopRecognitionAndStream();
        };
    }, [stopRecognitionAndStream]);
    
    const handleVoiceRecognition = useCallback(async () => {
        // If already listening or processing, stop the current instance.
        if (['connecting', 'listening', 'processing'].includes(voiceStatusRef.current)) {
            stopRecognitionAndStream();
            return;
        }
    
        // Set 'connecting' state immediately for instant user feedback.
        setVoiceStatus('connecting');
        
        // 1. Check for MediaDevices support first
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('MediaDevices API not supported by this browser.');
            setVoiceStatus('error');
            setTimeout(() => setVoiceStatus('idle'), 2000);
            return;
        }
        
        try {
            // 2. Explicitly request microphone permission AND STORE THE STREAM
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
    
            // 3. Now that permission is granted and the stream is active, check for the API.
            const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognitionAPI) {
                console.warn('Speech Recognition not supported by this browser.');
                stopRecognitionAndStream(); // Clean up stream
                setVoiceStatus('error');
                setTimeout(() => setVoiceStatus('idle'), 2000);
                return;
            }
    
            const recognition = new SpeechRecognitionAPI();
            recognitionRef.current = recognition;
    
            recognition.continuous = false;
            recognition.lang = 'it-IT';
            recognition.interimResults = false;
    
            recognition.onstart = () => setVoiceStatus('listening');
            recognition.onspeechend = () => setVoiceStatus('processing');
            
            recognition.onend = () => {
                // This 'onend' is for natural completion (e.g., after speech)
                if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach(track => track.stop());
                    mediaStreamRef.current = null;
                }
                recognitionRef.current = null;
                // Only change status if it wasn't an error, to let the error display for a moment
                 if (voiceStatusRef.current !== 'error') {
                    setVoiceStatus('idle');
                }
            };
            
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setVoiceStatus('error');
                // 'onend' will also fire, but we set a timeout to ensure the user sees the error state.
                setTimeout(() => setVoiceStatus('idle'), 2000);
            };

            recognition.onresult = (event) => {
                const transcript = event.results[event.results.length - 1][0].transcript.trim();
                if (targetElement && transcript) {
                    const start = targetElement.selectionStart ?? targetElement.value.length;
                    const end = targetElement.selectionEnd ?? targetElement.value.length;
                    const currentValue = targetElement.value;
                    
                    const textToInsert = (currentValue.length > 0 && !/\s$/.test(currentValue)) 
                        ? ' ' + transcript 
                        : transcript;
    
                    const newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
                    const newCursorPos = start + textToInsert.length;
    
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        targetElement.constructor.prototype, 'value'
                    )?.set;
    
                    if (nativeInputValueSetter) {
                        nativeInputValueSetter.call(targetElement, newValue);
                    } else {
                        targetElement.value = newValue;
                    }
    
                    targetElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                    targetElement.setSelectionRange(newCursorPos, newCursorPos);
                }
            };
    
            recognition.start();
    
        } catch (err: any) {
            console.error('Error requesting microphone permission:', err.name, err.message);
            stopRecognitionAndStream(); // Clean up stream on error
            setVoiceStatus('error');
            setTimeout(() => setVoiceStatus('idle'), 2000);
        }
    }, [stopRecognitionAndStream, targetElement]);


    useEffect(() => {
        if (!isVisible) {
            setShiftMode('off');
            setLayoutMode('letters');
            stopRecognitionAndStream();
        }
    }, [isVisible, stopRecognitionAndStream]);

    const handleShiftPress = useCallback(() => {
        setShiftMode(prev => {
            if (prev === 'off') return 'shift';
            if (prev === 'shift') return 'caps';
            return 'off';
        });
    }, []);

    const handleKeyPress = useCallback((key: string) => {
        if (!targetElement) return;

        switch (key) {
            case 'Shift':
                handleShiftPress();
                return;
            case '!?_':
                setLayoutMode('symbols');
                return;
            case 'ABC':
                setLayoutMode('letters');
                return;
            case 'Mic':
                handleVoiceRecognition();
                return;
            case 'Enter':
                targetElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, bubbles: true }));
                if (targetElement.form) {
                    targetElement.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
                onClose();
                return;
        }

        targetElement.focus();
        const start = targetElement.selectionStart ?? targetElement.value.length;
        const end = targetElement.selectionEnd ?? targetElement.value.length;
        const currentValue = targetElement.value;

        let newValue = currentValue;
        let newCursorPos = start;

        switch (key) {
            case 'Backspace':
                if (start === end && start > 0) {
                    newValue = currentValue.substring(0, start - 1) + currentValue.substring(end);
                    newCursorPos = start - 1;
                } else {
                    newValue = currentValue.substring(0, start) + currentValue.substring(end);
                    newCursorPos = start;
                }
                break;
            case 'Space':
                newValue = currentValue.substring(0, start) + ' ' + currentValue.substring(end);
                newCursorPos = start + 1;
                break;
            default: // Character keys
                newValue = currentValue.substring(0, start) + key + currentValue.substring(end);
                newCursorPos = start + 1;
                if (shiftMode === 'shift') {
                    setShiftMode('off');
                }
                break;
        }
        
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            targetElement.constructor.prototype,
            'value'
        )?.set;

        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(targetElement, newValue);
        } else {
            targetElement.value = newValue;
        }

        targetElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        targetElement.setSelectionRange(newCursorPos, newCursorPos);
    }, [targetElement, onClose, shiftMode, handleShiftPress, handleVoiceRecognition]);

    const handleBackspacePressStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        handleKeyPress('Backspace');

        longPressTimer.current = window.setTimeout(() => {
            longPressInterval.current = window.setInterval(() => {
                handleKeyPress('Backspace');
            }, 50);
        }, 500);
    }, [handleKeyPress]);

    const handleBackspacePressEnd = useCallback(() => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        if (longPressInterval.current) clearInterval(longPressInterval.current);
        longPressTimer.current = null;
        longPressInterval.current = null;
    }, []);
    
    const isUpperCase = shiftMode === 'shift' || shiftMode === 'caps';
    const currentMainLayout = layoutMode === 'letters'
        ? (isUpperCase ? qwertyLayoutUpper : qwertyLayoutLower)
        : symbolsLayout;
    
    const getShiftIcon = () => {
        const activeColor = isNight ? 'text-blue-400' : 'text-blue-500';
        const inactiveColor = isNight ? 'text-gray-100' : 'text-black';

        switch (shiftMode) {
            case 'shift':
                return <FiArrowUp style={{ strokeWidth: 3 }} className={activeColor} />;
            case 'caps':
                return (
                    <div className={`relative flex items-center justify-center h-full w-full font-bold ${activeColor}`}>
                        <FiArrowUp style={{ strokeWidth: 3 }} />
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-[3px] bg-current rounded-full" />
                    </div>
                );
            default: // 'off'
                return <FiArrowUp className={inactiveColor} />;
        }
    };

    const themeClasses = isNight
        ? 'bg-[#202225]'
        : 'bg-white';

    const backspaceBaseStyle = 'w-full h-full flex items-center justify-center font-medium transition-all duration-100 ease-out focus:outline-none select-none rounded-xl scale-[0.92] active:scale-[0.85]';
    const backspaceThemeStyle = isNight 
        ? 'bg-zinc-700 text-gray-100 hover:bg-zinc-600' 
        : 'bg-zinc-200 text-black hover:bg-zinc-300';
        
    const keyboardStyle = {
        height: `${virtualKeyboardHeight}vh`,
        minHeight: `${virtualKeyboardHeight * 8}px`,
        paddingLeft: `${virtualKeyboardPaddingX}px`,
        paddingRight: `${virtualKeyboardPaddingX}px`,
    } as React.CSSProperties;
    
    const layoutToggleKey = layoutMode === 'letters'
        ? { key: '!?_', label: '!?_', flex: '2', fontSize: virtualKeyboardKeySize * 0.8 }
        : { key: 'ABC', label: 'ABC', flex: '2', fontSize: virtualKeyboardKeySize * 0.8 };
        
    const getMicKeyConfig = () => {
        switch (voiceStatus) {
            case 'connecting':
                return { label: <div className="w-5 h-5 rounded-full loading-spinner-border" />, className: isNight ? 'text-white bg-zinc-600' : 'text-black bg-zinc-300' };
            case 'listening':
                return { label: <FiMic />, className: `mic-listening ${isNight ? 'bg-blue-600 text-white' : 'bg-blue-400 text-white'}` };
            case 'processing':
                return { label: <div className="w-5 h-5 rounded-full loading-spinner-border" />, className: isNight ? 'bg-blue-600 text-white' : 'bg-blue-400 text-white' };
            case 'error':
                 return { label: <FiAlertTriangle />, className: 'bg-red-600 text-white' };
            case 'idle':
            default:
                return { label: <FiMic />, className: '' };
        }
    };

    const micKeyConfig = getMicKeyConfig();

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    key="keyboard-backdrop"
                    className="fixed inset-0 z-[9000] flex items-end"
                    initial={{ backgroundColor: 'rgba(0,0,0,0)' }}
                    animate={{ backgroundColor: 'rgba(0,0,0,0)' }}
                    exit={{ backgroundColor: 'rgba(0,0,0,0)' }}
                    transition={{ duration: 0.3 }}
                    onClick={onClose}
                >
                    <motion.div
                        className={`w-full py-2 ${themeClasses}`}
                        initial={{ y: '100%' }}
                        animate={{ y: '0%' }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                        onClick={(e) => e.stopPropagation()}
                        style={keyboardStyle}
                    >
                        <div className="flex h-full w-full gap-6">
                            <div className="flex flex-col flex-[3.5] h-full" style={{ gap: `${virtualKeyboardKeyGapY}px` }}>
                                {currentMainLayout.map((row, rowIndex) => (
                                    <div key={rowIndex} className="flex justify-center w-full flex-1" style={{ gap: `${virtualKeyboardKeyGapX}px` }}>
                                        {layoutMode === 'letters' && rowIndex === 1 && <div style={{flex: 0.5}}/>}
                                        {layoutMode === 'letters' && rowIndex === 2 && (
                                             <Key key="left-shift" keyConfig={{ key: 'Shift', label: getShiftIcon(), flex: '1.5' }} onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
                                        )}
                                        {layoutMode === 'symbols' && rowIndex === 1 && <div style={{flex: 0.5}}/>}
                                        {layoutMode === 'symbols' && rowIndex === 2 && <div style={{flex: 1.5}}/>}

                                        {row.map((key) => (
                                            <Key key={key} keyConfig={key} onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
                                        ))}
                                        
                                        {layoutMode === 'letters' && rowIndex === 1 && <div style={{flex: 0.5}}/>}
                                        {layoutMode === 'letters' && rowIndex === 2 && (
                                            <>
                                                <Key key="right-shift" keyConfig={{ key: 'Shift', label: getShiftIcon(), flex: '1.5' }} onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
                                                <motion.button
                                                    onMouseDown={handleBackspacePressStart}
                                                    onMouseUp={handleBackspacePressEnd}
                                                    onMouseLeave={handleBackspacePressEnd}
                                                    onTouchStart={handleBackspacePressStart}
                                                    onTouchEnd={handleBackspacePressEnd}
                                                    className={`${backspaceBaseStyle} ${backspaceThemeStyle}`}
                                                    style={{ flex: '1.5', fontSize: `${virtualKeyboardKeySize}px`, fontWeight: virtualKeyboardKeyFontWeight }}
                                                    aria-label="Backspace"
                                                >
                                                    <FiDelete />
                                                </motion.button>
                                            </>
                                        )}
                                        {layoutMode === 'symbols' && rowIndex === 1 && <div style={{flex: 0.5}}/>}
                                        {layoutMode === 'symbols' && rowIndex === 2 && (
                                            <motion.button
                                                onMouseDown={handleBackspacePressStart}
                                                onMouseUp={handleBackspacePressEnd}
                                                onMouseLeave={handleBackspacePressEnd}
                                                onTouchStart={handleBackspacePressStart}
                                                onTouchEnd={handleBackspacePressEnd}
                                                className={`${backspaceBaseStyle} ${backspaceThemeStyle}`}
                                                style={{ flex: '1.5', fontSize: `${virtualKeyboardKeySize}px`, fontWeight: virtualKeyboardKeyFontWeight }}
                                                aria-label="Backspace"
                                            >
                                                <FiDelete />
                                            </motion.button>
                                        )}
                                    </div>
                                ))}
                                <div className="flex justify-center w-full flex-1" style={{ gap: `${virtualKeyboardKeyGapX}px` }}>
                                    <Key keyConfig={{ key: layoutToggleKey.key, label: layoutToggleKey.label, flex: layoutToggleKey.flex }} onClick={handleKeyPress} isNight={isNight} fontSize={layoutToggleKey.fontSize} fontWeight={virtualKeyboardKeyFontWeight} />
                                    <Key keyConfig={{ key: 'Mic', ...micKeyConfig, flex: '1.5' }} onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
                                    <Key keyConfig={{ key: 'Space', label: '', flex: '8' }} onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
                                    <Key keyConfig={{ key: 'Enter', label: 'Enter', flex: '2.5' }} onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 grid-rows-4 flex-[1] h-full" style={{ gap: `${virtualKeyboardKeyGapY}px ${virtualKeyboardKeyGapX}px` }}>
                                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(key => (
                                    <Key key={`num-${key}`} keyConfig={key} onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
                                ))}
                                <div />
                                <Key keyConfig="0" onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
                                <div />
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default VirtualKeyboard;