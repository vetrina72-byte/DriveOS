with open('components/TripStatsHUD.tsx', 'r') as f:
    content = f.read()

content = content.replace('text-3xl font-extrabold', 'text-4xl font-black')
content = content.replace('text-sm font-medium', 'text-base font-medium')
content = content.replace('text-sm py-3.5', 'text-base py-4')

with open('components/TripStatsHUD.tsx', 'w') as f:
    f.write(content)
