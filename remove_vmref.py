import re

with open("components/MapsContainer.tsx", "r") as f:
    content = f.read()

content = content.replace("const vmRef = useRef<maplibregl.Marker | null>(null);", "")
content = content.replace("vmRef.current = { setLngLat: () => {}, setRotation: () => {} }; // Dummy object to satisfy types temporarily", "")

with open("components/MapsContainer.tsx", "w") as f:
    f.write(content)
