import re

with open('components/SearchPanel.tsx', 'r') as f:
    content = f.read()

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

content = re.sub(r'\s*const handleSearch = async[\s\S]*?finally \{\s*setIsLoading\(false\);\s*\}\s*\};', handle_search_replacement, content)

with open('components/SearchPanel.tsx', 'w') as f:
    f.write(content)
