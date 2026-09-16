import re

with open("types.ts", "r") as f:
    content = f.read()

if "VITE_MAPBOX_TOKEN" not in content and "interface ImportMetaEnv" in content:
    content = content.replace("interface ImportMetaEnv {", "interface ImportMetaEnv {\n  readonly VITE_MAPBOX_TOKEN: string;")
elif "VITE_MAPBOX_TOKEN" not in content:
    content += "\ninterface ImportMetaEnv {\n  readonly VITE_MAPBOX_TOKEN?: string;\n}\ninterface ImportMeta {\n  readonly env: ImportMetaEnv;\n}\n"

with open("types.ts", "w") as f:
    f.write(content)

with open("server.ts", "r") as f:
    server_content = f.read()

server_content = server_content.replace("deleteSession(", "await deleteSession(")
# Wait, if deleteSession is not defined, we should check if it's imported.
