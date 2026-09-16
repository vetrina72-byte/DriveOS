with open('services/RadarService.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'getTileUrl(path: string, x: number, y: number, z: number): string',
    'getTileUrl(path: string, x: number | string, y: number | string, z: number | string): string'
)

with open('services/RadarService.ts', 'w') as f:
    f.write(content)
