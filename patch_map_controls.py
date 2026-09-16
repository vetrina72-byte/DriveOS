import re

with open('components/MapControls.tsx', 'r') as f:
    content = f.read()

# Make sure isNight is passed as prop
# interface MapControlsProps { ... }
# Search for interface MapControlsProps
content = re.sub(r'interface MapControlsProps {', r'interface MapControlsProps {\n  isNight?: boolean;', content)

# function MapControls({ ... }: MapControlsProps)
# Add isNight to props destructing
content = re.sub(
    r'export default function MapControls\(\{',
    r'export default function MapControls({\n  isNight = true,',
    content
)

# Fix compass button background (remove inline style)
content = content.replace(
    'style={{ background: \'#eee\' }}',
    ''
)
content = content.replace(
    'className="w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all shadow-lg backdrop-blur-md active:scale-[0.92] p-0 select-none touch-none"',
    'className={`w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all shadow-lg backdrop-blur-md active:scale-[0.92] p-0 select-none touch-none ${isNight ? "bg-neutral-900/85 border-white/10 text-white" : "bg-white/90 border-black/10 text-zinc-800 hover:bg-zinc-100"}`}'
)
content = content.replace(
    'className={`w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all shadow-lg backdrop-blur-md active:scale-[0.92] p-0 select-none touch-none ${compassMode !== \'free\' ? \'bg-[#f0f0f0] border-transparent\' : \'bg-white border-transparent\'}`}',
    'className={`w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all shadow-lg backdrop-blur-md active:scale-[0.92] p-0 select-none touch-none ${isNight ? (compassMode !== "free" ? "bg-white text-black border-transparent" : "bg-neutral-900/85 border-white/10 text-white") : (compassMode !== "free" ? "bg-zinc-800 text-white border-transparent" : "bg-white/90 border-black/10 text-zinc-800 hover:bg-zinc-100")}`}'
)

# Fix recenter button
content = content.replace(
    'className="w-16 h-16 rounded-2xl border border-white/10 bg-neutral-900/85 hover:bg-neutral-800/85 flex items-center justify-center cursor-pointer transition-all active:scale-[0.92] shadow-lg backdrop-blur-md p-0 select-none touch-none text-[#f0f0f0]"',
    'className={`w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all active:scale-[0.92] shadow-lg backdrop-blur-md p-0 select-none touch-none ${isNight ? "border-white/10 bg-neutral-900/85 hover:bg-neutral-800/85 text-[#f0f0f0]" : "border-black/10 bg-white/90 hover:bg-zinc-100 text-zinc-800"}`}'
)

# Fix Mapmode
content = content.replace(
    'className={`w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all active:scale-[0.92] shadow-lg backdrop-blur-md p-0 select-none touch-none ${isSatellite ? \'bg-blue-600 border-blue-500 text-white\' : \'border-white/10 bg-neutral-900/85 hover:bg-neutral-800/85 text-[#f0f0f0]\'}`}',
    'className={`w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all active:scale-[0.92] shadow-lg backdrop-blur-md p-0 select-none touch-none ${isSatellite ? "bg-blue-600 border-blue-500 text-white" : (isNight ? "border-white/10 bg-neutral-900/85 hover:bg-neutral-800/85 text-[#f0f0f0]" : "border-black/10 bg-white/90 hover:bg-zinc-100 text-zinc-800")}`}'
)

content = content.replace(
    '<svg className={`w-8 h-8 fill-current ${isSatellite ? \'text-white\' : \'text-[#f0f0f0]\'}`}',
    '<svg className={`w-8 h-8 fill-current ${isSatellite ? "text-white" : (isNight ? "text-[#f0f0f0]" : "text-zinc-800")}`}'
)


# Fix Weather toggle
content = content.replace(
    'className={`w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all active:scale-[0.92] shadow-lg backdrop-blur-md p-0 select-none touch-none ${isWeatherActive ? \'bg-blue-600 border-blue-500 text-white\' : \'border-white/10 bg-neutral-900/85 hover:bg-neutral-800/85 text-[#f0f0f0]\'}`}',
    'className={`w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer transition-all active:scale-[0.92] shadow-lg backdrop-blur-md p-0 select-none touch-none ${isWeatherActive ? "bg-blue-600 border-blue-500 text-white" : (isNight ? "border-white/10 bg-neutral-900/85 hover:bg-neutral-800/85 text-[#f0f0f0]" : "border-black/10 bg-white/90 hover:bg-zinc-100 text-zinc-800")}`}'
)
content = content.replace(
    '<CloudRain className={`w-8 h-8 ${isWeatherActive ? \'text-white\' : \'text-[#f0f0f0]\'}`} strokeWidth={2} />',
    '<CloudRain className={`w-8 h-8 ${isWeatherActive ? "text-white" : (isNight ? "text-[#f0f0f0]" : "text-zinc-800")}`} strokeWidth={2} />'
)

# Fix Nowcast fake texts and logic
# In fetchRadar:
content = content.replace(
    'futureFrames = (d.radar?.nowcast || []).map((f: any) => ({ time: f.time, path: f.path }));',
    'futureFrames = (d.radar?.past || []).map((f: any) => ({ time: f.time, path: f.path }));'
)
# And remove the fallback logic since futureFrames is now past frames directly
content = re.sub(
    r'if\s*\(futureFrames\.length\s*===\s*0\)\s*\{\s*futureFrames\s*=\s*\(d\.radar\?\.past\s*\|\|\s*\[\]\)\.filter[^}]+\}\s*if\s*\(futureFrames\.length\s*===\s*0\s*&&\s*d\.radar\?\.past\?\.length\s*>\s*0\)\s*\{\s*futureFrames\s*=\s*d\.radar\.past\.map[^}]+\}',
    '',
    content
)

# Timeline panel UI
content = content.replace(
    'className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-3 bg-[#111111]/95 backdrop-blur-xl rounded-full shadow-2xl border border-white/10 pointer-events-auto z-[1002]"',
    'className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-3 backdrop-blur-md rounded-2xl shadow-lg border pointer-events-auto z-[1002] transition-colors ${isNight ? "bg-neutral-900/85 border-white/10" : "bg-white/90 border-black/10"}`}'
)

# Play/Pause button
content = content.replace(
    'className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full hover:bg-neutral-200 transition-colors active:scale-95"',
    'className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors active:scale-95"'
)

# Timeline texts
content = content.replace(
    '<span className="text-[10px] font-semibold text-white/50 tracking-widest uppercase mb-0.5">Nowcast</span>',
    '<span className={`text-[10px] font-semibold tracking-widest uppercase mb-0.5 ${isNight ? "text-white/50" : "text-zinc-500"}`}>Storico Radar</span>'
)
content = content.replace(
    '<span className="text-[13px] font-bold text-white tracking-wide">',
    '<span className={`text-[13px] font-bold tracking-wide ${isNight ? "text-white" : "text-zinc-800"}`}>'
)

# Slider background
content = content.replace(
    'style={{ background: `linear-gradient(to right, #409cff ${pct}%, rgba(255,255,255,0.1) ${pct}%)` }}',
    'style={{ background: `linear-gradient(to right, #2563eb ${pct}%, ${isNight ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} ${pct}%)` }}'
)

with open('components/MapControls.tsx', 'w') as f:
    f.write(content)

