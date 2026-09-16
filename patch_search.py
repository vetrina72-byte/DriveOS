import re

with open('components/SearchPanel.tsx', 'r') as f:
    content = f.read()

# Update LocationInfo interface definition -> import
content = re.sub(
    r'interface LocationInfo \{[\s\S]*?\}',
    r"import { LocationInfo } from '../types/maps';\nimport { globalSearchService } from '../services/SearchService';",
    content,
    count=1
)

# Remove sGeo and sNom from SearchPanel
content = re.sub(r'const sGeo = async.*?catch \(e\) \{\s*return \[\];\s*\}\s*\};', '', content, flags=re.DOTALL)
content = re.sub(r'const sNom = async.*?catch \(e\) \{\s*return \[\];\s*\}\s*\};', '', content, flags=re.DOTALL)

# Update handleSearch
handle_search_replacement = """
  const handleSearch = async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await globalSearchService.search(q, rpos || undefined);
      if (res) {
        setResults(res.slice(0, 10)); // Top 10 for automotive
      }
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };
"""

content = re.sub(r'const handleSearch = async.*?finally \{\s*setIsLoading\(false\);\s*\}\s*\};', handle_search_replacement, content, flags=re.DOTALL)


# Update input and classes for automotive (taller, more legible)
content = content.replace(
    'className={`w-full border rounded-lg py-2.5 pl-11 pr-10 text-sm font-medium focus:outline-none focus:border-blue-500/50 transition-colors ${isNight ? "bg-zinc-800/80 border-transparent text-white placeholder:text-zinc-500" : "bg-zinc-100 border-zinc-300 text-zinc-800 placeholder:text-zinc-500"}`}',
    'className={`w-full border rounded-xl py-4 pl-12 pr-12 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors ${isNight ? "bg-zinc-800/80 border-white/5 text-white placeholder:text-zinc-500" : "bg-zinc-100 border-black/5 text-zinc-900 placeholder:text-zinc-500"}`}'
)

content = content.replace(
    'className="absolute left-6 text-zinc-400 w-5 h-5 pointer-events-none"',
    'className="absolute left-4 text-zinc-400 w-6 h-6 pointer-events-none"'
)

# Larger results
content = content.replace(
    'className="flex flex-col max-h-[17.5rem] overflow-y-auto px-2 pb-2 scrollbar-thin"',
    'className="flex flex-col max-h-[22rem] overflow-y-auto px-2 pb-2 scrollbar-thin"'
)

content = content.replace(
    'className="w-full flex items-center gap-4 p-2.5 hover:bg-white/10 rounded-lg text-left transition-colors active:scale-[0.98]"',
    'className={`w-full flex items-center gap-4 p-3.5 rounded-xl text-left transition-colors active:scale-[0.98] ${isNight ? "hover:bg-white/10" : "hover:bg-black/5"}`}'
)

content = content.replace(
    'className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isNight ? "bg-zinc-800" : "bg-zinc-200"}`}',
    'className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${isNight ? "bg-zinc-800/80 text-zinc-300" : "bg-zinc-200/80 text-zinc-600"}`}'
)

content = content.replace(
    'className={`text-sm font-semibold truncate ${isNight ? "text-white" : "text-zinc-800"}`}',
    'className={`text-[15px] font-bold truncate ${isNight ? "text-white" : "text-zinc-900"}`}'
)

content = content.replace(
    'className={`text-[0.8125rem] truncate ${isNight ? "text-zinc-400" : "text-zinc-500"}`}',
    'className={`text-sm truncate ${isNight ? "text-zinc-400" : "text-zinc-500"}`}'
)

with open('components/SearchPanel.tsx', 'w') as f:
    f.write(content)

