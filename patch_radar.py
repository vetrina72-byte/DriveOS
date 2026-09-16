import re

with open('components/MapControls.tsx', 'r') as f:
    content = f.read()

# Add import
content = re.sub(
    r'import React[^;]+;',
    lambda m: m.group(0) + '\nimport { globalRadarService, WeatherFrame } from "../services/RadarService";',
    content
)

# Remove local WeatherFrame
content = re.sub(r'interface WeatherFrame \{[\s\S]*?\}', '', content, count=1)

# Update fetchRadar
fetch_radar_replacement = """
      const fetchRadar = async () => {
        try {
          const { past, nowcast } = await globalRadarService.fetchFrames();
          
          let frames = [...past, ...nowcast];
          if (frames.length === 0) {
            console.warn("Nessun fotogramma radar disponibile.");
            return;
          }
          
          setWTs(frames);
          setWNow(past.length > 0 ? past.length - 1 : 0); 
          
          const initialIdx = past.length > 0 ? past.length - 1 : 0;
          setWFr(initialIdx);
          updateFrameInfo(frames, initialIdx, past.length);
          
          startPlayback(frames, initialIdx, past.length);
        } catch (e) {
          console.error('[WEATHER] Failed to load radar config', e);
        }
      };
"""
content = re.sub(r'const fetchRadar = async.*?\};(?=\s*fetchRadar\(\);)', fetch_radar_replacement, content, flags=re.DOTALL)

with open('components/MapControls.tsx', 'w') as f:
    f.write(content)


with open('components/MapsContainer.tsx', 'r') as f:
    maps_content = f.read()

maps_content = re.sub(
    r'import React[^;]+;',
    lambda m: m.group(0) + '\nimport { globalRadarService, WeatherFrame } from "../services/RadarService";',
    maps_content
)

maps_content = re.sub(r'interface WeatherFrame \{[\s\S]*?\}', '', maps_content, count=1)

maps_content = maps_content.replace(
    'const tileUrl = `https://tilecache.rainviewer.com${frame.path}/512/{z}/{x}/{y}/4/1_1.webp`;',
    'const tileUrl = globalRadarService.getTileUrl(frame.path, "{x}" as any, "{y}" as any, "{z}" as any).replace("{x}", "{x}").replace("{y}", "{y}").replace("{z}", "{z}");'
)

with open('components/MapsContainer.tsx', 'w') as f:
    f.write(maps_content)
