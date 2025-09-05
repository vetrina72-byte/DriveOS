import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiMic, FiArrowUp, FiDelete } from 'react-icons/fi';

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

    const isSpecialKey = ['Shift', 'Backspace', '?123', 'Mic', 'Space', 'Enter'].includes(key);
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
    const longPressTimer = useRef<number | null>(null);
    const longPressInterval = useRef<number | null>(null);

    useEffect(() => {
        if (!isVisible) {
            setShiftMode('off');
        }
    }, [isVisible]);

    const handleShiftPress = useCallback(() => {
        setShiftMode(prev => {
            if (prev === 'off') return 'shift';
            if (prev === 'shift') return 'caps';
            return 'off';
        });
    }, []);

    const handleKeyPress = useCallback((key: string) => {
        if (!targetElement) return;

        if (key === 'Shift') {
            handleShiftPress();
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
            case 'Enter':
                if (targetElement.form) {
                    targetElement.form.requestSubmit();
                }
                onClose();
                return;
            case 'Space':
                newValue = currentValue.substring(0, start) + ' ' + currentValue.substring(end);
                newCursorPos = start + 1;
                break;
            default:
                newValue = currentValue.substring(0, start) + key + currentValue.substring(end);
                newCursorPos = start + 1;
                break;
        }

        const isCharacterKey = key.length === 1;
        if (isCharacterKey && shiftMode === 'shift') {
            setShiftMode('off');
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
    }, [targetElement, onClose, shiftMode, handleShiftPress]);

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
    const currentLetterLayout = isUpperCase ? qwertyLayoutUpper : qwertyLayoutLower;
    
    const getShiftKeyStyle = () => {
        switch (shiftMode) {
            case 'shift':
                return isNight ? 'bg-blue-800 text-white' : 'bg-blue-300 text-blue-800';
            case 'caps':
                return 'bg-blue-500 text-white';
            default:
                return '';
        }
    };
    
    const getShiftIcon = () => {
        switch (shiftMode) {
            case 'shift':
                return <FiArrowUp style={{ strokeWidth: 3 }} />;
            case 'caps':
                return (
                    <div className="relative flex items-center justify-center h-full w-full">
                        <FiArrowUp />
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-[2.5px] bg-current rounded-full" />
                    </div>
                );
            default: // 'off'
                return <FiArrowUp />;
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

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    key="keyboard-backdrop"
                    className="fixed inset-0 z-[1000] flex items-end"
                    initial={{ backgroundColor: 'rgba(0,0,0,0)' }}
                    animate={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
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
                                {currentLetterLayout.map((row, rowIndex) => (
                                    <div key={rowIndex} className="flex justify-center w-full flex-1" style={{ gap: `${virtualKeyboardKeyGapX}px` }}>
                                        {rowIndex === 1 && <div style={{flex: 0.5}}/>}
                                        {rowIndex === 2 && (
                                             <Key key="left-shift" keyConfig={{ key: 'Shift', label: getShiftIcon(), flex: '1.5', className: getShiftKeyStyle() }} onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
                                        )}
                                        {row.map((key) => (
                                            <Key key={key} keyConfig={key} onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
                                        ))}
                                        {rowIndex === 1 && <div style={{flex: 0.5}}/>}
                                        {rowIndex === 2 && (
                                            <>
                                                <Key key="right-shift" keyConfig={{ key: 'Shift', label: getShiftIcon(), flex: '1.5', className: getShiftKeyStyle() }} onClick={handleKeyPress} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
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
                                    </div>
                                ))}
                                <div className="flex justify-center w-full flex-1" style={{ gap: `${virtualKeyboardKeyGapX}px` }}>
                                    <Key keyConfig={{ key: '?123', label: '?123', flex: '2' }} onClick={() => {}} isNight={isNight} fontSize={virtualKeyboardKeySize * 0.8} fontWeight={virtualKeyboardKeyFontWeight} />
                                    <Key keyConfig={{ key: 'Mic', label: <FiMic />, flex: '1.5' }} onClick={() => {}} isNight={isNight} fontSize={virtualKeyboardKeySize} fontWeight={virtualKeyboardKeyFontWeight} />
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