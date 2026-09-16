import re

with open('components/SearchPanel.tsx', 'r') as f:
    content = f.read()

start_idx = content.find('const handleSearch = async (q: string) => {')
end_idx = content.find('useEffect(() => {', start_idx)

if start_idx != -1 and end_idx != -1:
    new_handle_search = """const handleSearch = async (q: string) => {
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
    content = content[:start_idx] + new_handle_search + content[end_idx:]

    with open('components/SearchPanel.tsx', 'w') as f:
        f.write(content)
else:
    print("Could not find handleSearch block")

