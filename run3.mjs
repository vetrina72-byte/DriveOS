import fs from 'fs';

let code = fs.readFileSync('components/MusicPlayer.tsx', 'utf8');

// 1. Add states at the top of the component
const stateTarget = "const [isOverflowing, setIsOverflowing] = useState(false);";
const stateNew = `const [isOverflowing, setIsOverflowing] = useState(false);
    const [observerWidth, setObserverWidth] = useState(0);

    // Performance Emulation State
    const [perfTier, setPerfTier] = useState<'high' | 'balanced' | 'low-end'>('balanced');
    const renderCountRef = useRef(0);
    renderCountRef.current += 1; // Track atomic repaints

    // Modify layout engine styles dynamically based on the active forced performance tier
    const isLowEndMode = perfTier === 'low-end';`;
code = code.replace(stateTarget, stateNew);

// 2. Update ResizeObserver
const observerTarget = `const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                // Detect when the music player container width is less than 440px (threshold where items start overflow-clipping)
                setIsOverflowing(width < 440);
            }
        });`;
const observerNew = `const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                setObserverWidth(Math.round(width));
                // isPlayerNarrow triggers naturally at < 580px
                setIsOverflowing(width < 580);
            }
        });`;
code = code.replace(observerTarget, observerNew);

// 3. Update effectiveControlsGap computation
const gapTarget = `const effectiveControlsGap = isMobileOrTablet 
        ? (isAnyAppOpen 
            ? (isOverflowing ? 33 : 18) 
            : 100) 
        : 100;`;
const gapNew = `const effectiveControlsGap = isLowEndMode ? 33 : (isMobileOrTablet 
        ? (isAnyAppOpen 
            ? (isOverflowing ? 33 : 18) 
            : 100) 
        : 100);`;
code = code.replace(gapTarget, gapNew);

// 4. Update the main container className
const containerTarget = "className={`touch-none fixed z-[2000] rounded-xl overflow-hidden max-w-[calc(100vw-32px)] @container transform-gpu ${themeClasses} ${isPlayerNarrow ? 'bg-opacity-95 shadow-md' : 'backdrop-blur-md shadow-lg'}`}";
const containerNew = "className={`touch-none fixed z-[2000] rounded-xl overflow-hidden max-w-[calc(100vw-32px)] @container transform-gpu ${themeClasses} ${isLowEndMode ? 'bg-[var(--player-bg)] bg-opacity-100 shadow-none border-0' : (perfTier === 'high' ? 'backdrop-blur-md shadow-lg' : (isPlayerNarrow ? 'bg-opacity-95 shadow-md' : 'backdrop-blur-md shadow-lg'))}`}";
code = code.replace(containerTarget, containerNew);

// 5. Inject Telemetry Panel
const returnTarget = "return (\n        <>\n            <div \n                ref={playerContainerRef}";
const returnNew = `return (
        <>
            {/* PERFORMANCE TELEMETRY OVERLAY */}
            <div className="fixed top-4 right-4 z-[9999] bg-black/80 backdrop-blur text-green-400 font-mono text-xs p-3 rounded-lg border border-green-500/30 flex flex-col gap-2 w-64 shadow-2xl pointer-events-auto">
                <div className="flex justify-between border-b border-green-500/30 pb-1 mb-1">
                    <span className="font-bold">X-RAY TELEMETRY</span>
                    <span>[v1.0]</span>
                </div>
                
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <span className="opacity-70">Render Count:</span>
                    <span>{renderCountRef.current}</span>
                    
                    <span className="opacity-70">Observer W:</span>
                    <span>{observerWidth}px</span>
                    
                    <span className="opacity-70">Input Mode:</span>
                    <span>touch-none</span>
                    
                    <span className="opacity-70">Active Gap:</span>
                    <span>{effectiveControlsGap}px</span>
                </div>

                <div className="mt-2 border-t border-green-500/30 pt-2 flex flex-col gap-1">
                    <span className="opacity-70 mb-1">Force Simulator Tier:</span>
                    <div className="flex flex-col gap-1">
                        <button 
                            onClick={() => setPerfTier('high')}
                            className={\`text-left px-2 py-1 rounded \${perfTier === 'high' ? 'bg-green-500/20 text-green-300' : 'hover:bg-white/10'}\`}
                        >
                            🟢 High (Desktop)
                        </button>
                        <button 
                            onClick={() => setPerfTier('balanced')}
                            className={\`text-left px-2 py-1 rounded \${perfTier === 'balanced' ? 'bg-yellow-500/20 text-yellow-300' : 'hover:bg-white/10'}\`}
                        >
                            🟡 Balanced (Tablet)
                        </button>
                        <button 
                            onClick={() => setPerfTier('low-end')}
                            className={\`text-left px-2 py-1 rounded \${perfTier === 'low-end' ? 'bg-red-500/20 text-red-300' : 'hover:bg-white/10'}\`}
                        >
                            🔴 Low-End (Mobile)
                        </button>
                    </div>
                </div>
            </div>
            <div 
                ref={playerContainerRef}`;
code = code.replace(returnTarget, returnNew);

fs.writeFileSync('components/MusicPlayer.tsx', code, 'utf8');
console.log('Update complete');
