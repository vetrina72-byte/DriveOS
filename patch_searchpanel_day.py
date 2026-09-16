import re

with open('components/SearchPanel.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '''${query.length < 2 ? '!bg-zinc-800 !text-zinc-400' : ''}''',
    '''${query.length < 2 ? (isNight ? '!bg-zinc-800 !text-zinc-400' : '!bg-zinc-200 !text-zinc-600') : ''}'''
)

content = content.replace(
    'className="text-sm font-semibold text-white truncate"',
    'className={`text-[15px] font-bold truncate ${isNight ? "text-white" : "text-zinc-900"}`}'
)

content = content.replace(
    'className="text-[0.8125rem] text-zinc-400 truncate"',
    'className={`text-[14px] truncate ${isNight ? "text-zinc-400" : "text-zinc-500"}`}'
)

content = content.replace(
    'className="text-sm font-semibold text-white"',
    'className={`text-sm font-semibold ${isNight ? "text-white" : "text-zinc-900"}`}'
)

content = content.replace(
    'className="text-[0.75rem] text-zinc-400 leading-none mt-1"',
    'className={`text-[0.75rem] leading-none mt-1 ${isNight ? "text-zinc-400" : "text-zinc-500"}`}'
)

content = content.replace(
    'className="text-center p-4 text-zinc-400 text-sm"',
    'className={`text-center p-4 text-sm ${isNight ? "text-zinc-400" : "text-zinc-500"}`}'
)

content = content.replace(
    'className="flex border-t border-white/10 p-2 gap-2 justify-around"',
    'className={`flex border-t p-2 gap-2 justify-around ${isNight ? "border-white/10" : "border-black/5"}`}'
)

content = content.replace(
    'className="flex-1 flex justify-center items-center gap-2 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/10 hover:text-white rounded-lg transition-colors cursor-pointer"',
    'className={`flex-1 flex justify-center items-center gap-2 py-3 text-[15px] font-semibold rounded-xl transition-colors cursor-pointer ${isNight ? "text-zinc-300 hover:bg-white/10 hover:text-white" : "text-zinc-700 hover:bg-black/5 hover:text-zinc-900"}`}'
)

content = content.replace(
    '<Home className="w-4.5 h-4.5 text-zinc-400" />',
    '<Home className={`w-5 h-5 ${isNight ? "text-zinc-400" : "text-zinc-500"}`} />'
)

content = content.replace(
    '<Briefcase className="w-4.5 h-4.5 text-zinc-400" />',
    '<Briefcase className={`w-5 h-5 ${isNight ? "text-zinc-400" : "text-zinc-500"}`} />'
)

with open('components/SearchPanel.tsx', 'w') as f:
    f.write(content)
