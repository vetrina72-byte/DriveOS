const fs = require('fs');

const fixApp = (file) => {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Add ReactDOM import if missing
    if (!content.includes('react-dom')) {
        content = content.replace("from 'react';", "from 'react';\nimport ReactDOM from 'react-dom';");
    }

    // 2. We already added isMapsLayered to Props and destructured it.
    // However, if we didn't, let's verify.
    // In DebugControls it's already there in props.
    // Let's find the physics ref declaration.
    const stateHook = `  const [renderLayered, setRenderLayered] = React.useState(isMapsLayered);
  const isVerticalRef = React.useRef(isMapsLayered);

  React.useEffect(() => {
    if (isOpen) {
      setRenderLayered(!!isMapsLayered);
      isVerticalRef.current = !!isMapsLayered;
    }
  }, [isMapsLayered, isOpen]);`;
    
    // Check if we already have it
    if (!content.includes('renderLayered')) {
        content = content.replace(/const physics = useRef/, `${stateHook}\n\n  const physics = useRef`);
    }

    // 4. Update Physics Loop (currentX -> currentPercent, X -> Percent)
    content = content.replace(/currentX:/g, 'currentPercent:');
    content = content.replace(/targetX:/g, 'targetPercent:');
    content = content.replace(/startX:/g, 'startPercent:');
    content = content.replace(/dragStartX:/g, 'dragStart:');
    content = content.replace(/dragStartCurrentX:/g, 'dragStartPercent:');
    content = content.replace(/panelWidth:/g, 'panelDimension:');
    
    content = content.replace(/state\.currentX /g, 'state.currentPercent ');
    content = content.replace(/state\.targetX /g, 'state.targetPercent ');
    content = content.replace(/state\.startX /g, 'state.startPercent ');
    content = content.replace(/state\.dragStartX/g, 'state.dragStart');
    content = content.replace(/state\.dragStartCurrentX/g, 'state.dragStartPercent');
    content = content.replace(/state\.panelWidth/g, 'state.panelDimension');
    
    content = content.replace(/state\.currentX=/g, 'state.currentPercent=');
    content = content.replace(/state\.targetX=/g, 'state.targetPercent=');
    content = content.replace(/state\.startX=/g, 'state.startPercent=');
    content = content.replace(/state\.currentX =/g, 'state.currentPercent =');
    content = content.replace(/state\.targetX =/g, 'state.targetPercent =');
    content = content.replace(/state\.startX =/g, 'state.startPercent =');

    content = content.replace(/let visualX = state\.currentX;/g, 'let visualPercent = state.currentPercent;');
    content = content.replace(/visualX < /g, 'visualPercent < ');
    content = content.replace(/visualX = /g, 'visualPercent = ');
    content = content.replace(/visualX > /g, 'visualPercent > ');

    // 5. Transform logic
    const transformLogic = `        if (isVerticalRef.current) {
          panel.style.transform = \`translateY(\${visualPercent}%)\`;
        } else {
          panel.style.transform = \`translateX(\${visualPercent}%)\`;
        }`;

    // There are multiple forms of this string in DebugControls:
    content = content.replace(/panel\.style\.transform = \`translateX\(\$\{visualX\}%\)\`;/, transformLogic);
    content = content.replace(/panel\.style\.transform = \`translateX\(\$\{visualPercent\}%\)\`;/, transformLogic);

    // 6. Handle pointer down
    const pointerDownLogic = `    if (renderLayered) {
      state.dragStart = e.clientY;
      state.panelDimension = panelRef.current.offsetHeight || window.innerHeight;
    } else {
      state.dragStart = e.clientX;
      state.panelDimension = panelRef.current.offsetWidth || window.innerWidth * 0.66;
    }
    state.dragStartPercent = state.currentPercent;`;
    
    // In DebugControls:
    // state.dragStartX = e.clientX;
    // state.dragStartCurrentX = state.currentX;
    // state.panelWidth = panelRef.current.offsetWidth || window.innerWidth * 0.66;
    content = content.replace(/state\.dragStart = e\.clientX;\n\s*state\.dragStartPercent = state\.currentPercent;\n\s*state\.panelDimension = panelRef\.current\.offsetWidth \|\| window\.innerWidth \* 0\.66;/, pointerDownLogic);
    
    // 7. Handle pointer move
    const pointerMoveLogic = `    const currentPos = renderLayered ? e.clientY : e.clientX;
    const deltaPx = currentPos - state.dragStart;`;
    content = content.replace(/const deltaPx = e\.clientX - state\.dragStart;/, pointerMoveLogic);

    // JSX updates:
    const handleRegex = /<div\s+className=\{\`absolute top-0 bottom-0 -left-12 w-12 flex items-center justify-end pr-2 cursor-grab active:cursor-grabbing z-50 touch-none group transition-opacity duration-300 \$\{isOpen \? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'\}\`\}\s*onPointerDown=\{handlePointerDown\}\s*onPointerMove=\{handlePointerMove\}\s*onPointerUp=\{handlePointerUp\}\s*onPointerLeave=\{handlePointerUp\}\s*aria-label="Drag to close"\s*>\s*<div\s+className=\{\`w-1\.5 h-16 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-y-110 \$\{handleColorClass\}\`\}\s*\/>\s*<\/div>/;
    
    const replacementJSX = `
    {/* --- CONDITIONAL HANDLE STYLES --- */}
    <div
      className={renderLayered
        ? \`absolute -top-12 left-0 right-0 h-12 flex items-end justify-center pb-2 cursor-grab active:cursor-grabbing z-50 touch-none group transition-opacity duration-300 \${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}\`
        : \`absolute top-0 bottom-0 -left-12 w-12 flex items-center justify-end pr-2 cursor-grab active:cursor-grabbing z-50 touch-none group transition-opacity duration-300 \${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}\`
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      aria-label="Drag to close"
    >
      <div 
        className={renderLayered
          ? \`w-16 h-1.5 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-x-110 \${handleColorClass}\`
          : \`w-1.5 h-16 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-y-110 \${handleColorClass}\`
        }
      />
    </div>`;
    content = content.replace(handleRegex, replacementJSX);
    
    // 9. Update render element and Portal
    content = content.replace(/className="[^"]*?(?:spotify-app-panel|bg-zinc[^"]*)[^"]*?w-2\/3[^"]*?"/, "className={`spotify-app-panel shadow-2xl flex ${renderLayered ? 'absolute w-full right-0 pointer-events-auto' : 'fixed w-2/3'}`}");
    content = content.replace(/className=\{\`spotify-app-panel[^\}]*\`\}/, "className={`spotify-app-panel shadow-2xl flex ${renderLayered ? 'absolute w-full right-0 pointer-events-auto' : 'fixed w-2/3'}`}");
    
    // Custom fix for DebugControls that has a fixed bg
    content = content.replace(/className="fixed top-0 bottom-0 right-0 w-2\/3 bg-zinc-900 border-l border-zinc-800 flex flex-col z-50 shadow-2xl overflow-hidden"/, "className={`spotify-app-panel bg-zinc-900 border-zinc-800 flex flex-col z-50 shadow-2xl overflow-hidden ${renderLayered ? 'absolute w-full right-0 pointer-events-auto border-t' : 'fixed top-0 bottom-0 right-0 w-2/3 border-l'}`}");
    
    // Change return to use portal
    const returnRegex = /return \(\s*<div \n\s*ref(?:erence)?=\{panelRef\}/;
    const portalTargetDeclaration = `
  const portalTarget = renderLayered ? document.getElementById('maps-anchored-container') : null;

  const mainContent = (`;
    
    if (content.match(returnRegex)) {
        content = content.replace(returnRegex, `${portalTargetDeclaration}\n    <div \n      ref={panelRef}`);
    } else {
         content = content.replace(/return \(\s*<div\s*ref=\{panelRef\}/, `${portalTargetDeclaration}\n    <div ref={panelRef}`);
    }
    
    // Replace final closing div
    content = content.replace(/<\/div>\n\s*\);\n\};\n\nexport default/, 
`</div>
  );

  if (renderLayered && portalTarget) {
    return ReactDOM.createPortal(mainContent, portalTarget);
  }

  return mainContent;
};

export default`);

    fs.writeFileSync(file, content);
};

fixApp('components/DebugControls.tsx');
