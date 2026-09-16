with open('components/NavigationHUD.tsx', 'r') as f:
    content = f.read()

content = content.replace('className={`text-xl font-bold tracking-tight', 'className={`text-2xl font-black tracking-tight')
content = content.replace('text-[0.875rem]', 'text-[1rem]')
content = content.replace('w-12 h-12', 'w-14 h-14')

with open('components/NavigationHUD.tsx', 'w') as f:
    f.write(content)
