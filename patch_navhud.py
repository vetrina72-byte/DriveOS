import re

with open('components/NavigationHUD.tsx', 'r') as f:
    content = f.read()

# Add useWeather import if not present
if "useWeather" not in content:
    content = re.sub(r'import React[^;]+;', lambda m: m.group(0) + '\nimport { useWeather } from "../context/WeatherContext";', content)

# Add hook call
content = re.sub(
    r'export default function NavigationHUD\(\{\s*(.*?)\s*\}\: NavigationHUDProps\) \{',
    r'export default function NavigationHUD({\1}: NavigationHUDProps) {\n  const { useDarkTheme: isNight } = useWeather();',
    content,
    flags=re.DOTALL
)

# Fix background
content = content.replace(
    'className="w-full bg-neutral-900/85 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg overflow-hidden cursor-pointer pointer-events-auto select-none transition-all duration-300"',
    'className={`w-full backdrop-blur-md border rounded-2xl shadow-lg overflow-hidden cursor-pointer pointer-events-auto select-none transition-all duration-300 ${isNight ? "bg-neutral-900/85 border-white/10" : "bg-white/90 border-black/10"}`}'
)

# Text color main
content = content.replace(
    'className="text-xl font-bold text-white tracking-tight"',
    'className={`text-xl font-bold tracking-tight ${isNight ? "text-white" : "text-zinc-900"}`}'
)

# Icon color main
content = content.replace(
    'className="w-10 h-10 fill-current text-white"',
    'className={`w-10 h-10 fill-current ${isNight ? "text-white" : "text-zinc-900"}`}'
)

content = content.replace(
    'className="text-[0.875rem] text-zinc-300 font-medium truncate leading-tight mt-0.5"',
    'className={`text-[0.875rem] font-medium truncate leading-tight mt-0.5 ${isNight ? "text-zinc-300" : "text-zinc-600"}`}'
)

content = content.replace(
    'className="text-zinc-400 p-1 hover:text-white transition-colors"',
    'className={`p-1 transition-colors ${isNight ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}'
)

content = content.replace(
    'className="border-t border-white/10 max-h-[18.125rem] overflow-y-auto overflow-x-hidden divide-y divide-white/5 bg-zinc-950/40 scrollbar-thin"',
    'className={`border-t max-h-[18.125rem] overflow-y-auto overflow-x-hidden divide-y scrollbar-thin ${isNight ? "border-white/10 divide-white/5 bg-zinc-950/40" : "border-black/10 divide-black/5 bg-zinc-50/80"}`}'
)

content = content.replace(
    'className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0"',
    'className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isNight ? "bg-zinc-800" : "bg-zinc-200"}`}'
)

content = content.replace(
    'className="w-6 h-6 fill-current text-zinc-300"',
    'className={`w-6 h-6 fill-current ${isNight ? "text-zinc-300" : "text-zinc-700"}`}'
)

content = content.replace(
    'className="text-[0.6875rem] font-bold text-blue-400 space-x-1 uppercase mb-0.5"',
    'className={`text-[0.6875rem] font-bold space-x-1 uppercase mb-0.5 ${isNight ? "text-blue-400" : "text-blue-600"}`}'
)

content = content.replace(
    'className="text-[0.8125rem] text-zinc-200 font-medium truncate"',
    'className={`text-[0.8125rem] font-medium truncate ${isNight ? "text-zinc-200" : "text-zinc-800"}`}'
)

content = content.replace(
    'className="flex gap-4 p-3.5 bg-zinc-950/20"',
    'className={`flex gap-4 p-3.5 ${isNight ? "bg-zinc-950/20" : "bg-black/5"}`}'
)


with open('components/NavigationHUD.tsx', 'w') as f:
    f.write(content)

