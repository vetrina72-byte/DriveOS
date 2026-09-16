import re

with open("components/MapsContainer.tsx", "r") as f:
    content = f.read()

# Delete from 641
content = content.replace("  const destRef = useRef<{ lat: number; lng: number } | null>(null);\n", "")
content = content.replace("  const isRoutePreviewRef = useRef(false);\n", "")
content = content.replace("  const startTrackTimerRef = useRef<any>(null);\n", "")
content = content.replace("  const isPendingStartRef = useRef(false);\n", "")

# Add to 150
add_refs = """  const destRef = useRef<{ lat: number; lng: number } | null>(null);
  const isRoutePreviewRef = useRef(false);
"""
content = content.replace("  const isPendingStartRef = useRef<boolean>(false);\n", "  const isPendingStartRef = useRef<boolean>(false);\n" + add_refs)

with open("components/MapsContainer.tsx", "w") as f:
    f.write(content)
