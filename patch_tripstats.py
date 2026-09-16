import re

with open('components/TripStatsHUD.tsx', 'r') as f:
    content = f.read()

# Add useWeather import if not present
if "useWeather" not in content:
    content = re.sub(r'import React[^;]+;', lambda m: m.group(0) + '\nimport { useWeather } from "../context/WeatherContext";', content)

# Add hook call
content = re.sub(
    r'export default function TripStatsHUD\(\{\s*(.*?)\s*\}\: TripStatsHUDProps\) \{',
    r'export default function TripStatsHUD({\1}: TripStatsHUDProps) {\n  const { useDarkTheme: isNight } = useWeather();',
    content,
    flags=re.DOTALL
)

# Fix background
content = content.replace(
    'className="absolute bottom-[7.5rem] left-6 z-[1003] w-[22.5rem] max-w-[calc(100vw-48px)] bg-neutral-900/85 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg p-5 text-white animate-fade-in transition-all duration-500 pointer-events-auto"',
    'className={`absolute bottom-[7.5rem] left-6 z-[1003] w-[22.5rem] max-w-[calc(100vw-48px)] backdrop-blur-md border rounded-2xl shadow-lg p-5 animate-fade-in transition-all duration-500 pointer-events-auto ${isNight ? "bg-neutral-900/85 border-white/10 text-white" : "bg-white/90 border-black/10 text-zinc-900"}`}'
)

# text-white tracking-tight
content = content.replace(
    'className="text-3xl font-extrabold tracking-tight text-white"',
    'className={`text-3xl font-extrabold tracking-tight ${isNight ? "text-white" : "text-zinc-900"}`}'
)

content = content.replace(
    'className="text-sm font-medium text-zinc-400"',
    'className={`text-sm font-medium ${isNight ? "text-zinc-400" : "text-zinc-500"}`}'
)

content = content.replace(
    'className="text-zinc-200 font-semibold mr-2"',
    'className={`font-semibold mr-2 ${isNight ? "text-zinc-200" : "text-zinc-700"}`}'
)

content = content.replace(
    'className="text-zinc-200 font-semibold"',
    'className={`font-semibold ${isNight ? "text-zinc-200" : "text-zinc-700"}`}'
)

content = content.replace(
    'className="text-sm font-medium text-zinc-500 truncate mb-4"',
    'className={`text-sm font-medium truncate mb-4 ${isNight ? "text-zinc-500" : "text-zinc-500"}`}'
)

content = content.replace(
    'className="flex-1 bg-zinc-800/80 border border-white/5 hover:bg-zinc-700/80 active:scale-95 text-red-500 font-bold text-sm py-3.5 rounded-xl cursor-pointer transition-all"',
    'className={`flex-1 border active:scale-95 text-red-500 font-bold text-sm py-3.5 rounded-xl cursor-pointer transition-all ${isNight ? "bg-zinc-800/80 border-white/5 hover:bg-zinc-700/80" : "bg-zinc-100 border-black/5 hover:bg-zinc-200"}`}'
)


with open('components/TripStatsHUD.tsx', 'w') as f:
    f.write(content)

