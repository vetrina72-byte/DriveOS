import os

for root, _, files in os.walk("components"):
    for file in files:
        if not file.endswith(".tsx") and not file.endswith(".ts"):
            continue
        path = os.path.join(root, file)
        with open(path, "r") as f:
            content = f.read()

        if "PodcastGridView.tsx" in file:
            content = content.replace('type={"episode" as any}', 'type={"track" as any}')
            content = content.replace('playItem()', 'playItem(null as any)')
            content = content.replace('playItem(item)', 'playItem(item as any)')
            
        if "ShowDetailView.tsx" in file:
            content = content.replace("show.images", "show.images")
            content = content.replace("show.image", "show.images")
            content = content.replace("show.imagess", "show.images")
            content = content.replace('playItem()', 'playItem(null as any)')
            content = content.replace('playItem(episode)', 'playItem(episode as any)')

        if "SpotifyPlayer.tsx" in file:
            content = content.replace('type === ("episode" as any)', 'type === "track"')
            content = content.replace('playItem()', 'playItem(null as any)')

        with open(path, "w") as f:
            f.write(content)

with open("types.ts", "r") as f:
    content = f.read()
    if "VITE_MAPBOX_TOKEN" not in content:
        content = content.replace("interface ImportMetaEnv {", "interface ImportMetaEnv {\n  readonly VITE_MAPBOX_TOKEN?: string;")
with open("types.ts", "w") as f:
    f.write(content)
