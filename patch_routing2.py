import re

with open("components/MapsContainer.tsx", "r") as f:
    content = f.read()

# I need to add state for routes
state_addition = """  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);"""

content = re.sub(r'const \[steps, setSteps\] = useState<StepInfo\[\]>\(\[\]\);', state_addition + '\n  const [steps, setSteps] = useState<StepInfo[]>([]);', content)

with open("components/MapsContainer.tsx", "w") as f:
    f.write(content)
