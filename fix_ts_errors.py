import re

with open("components/MapsContainer.tsx", "r") as f:
    content = f.read()

content = content.replace("if (typeof map.setBearingSnap === 'function') map.setBearingSnap(0);", "if (typeof (map as any).setBearingSnap === 'function') (map as any).setBearingSnap(0);")

with open("components/MapsContainer.tsx", "w") as f:
    f.write(content)
