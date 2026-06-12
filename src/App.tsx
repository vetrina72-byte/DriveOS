import React, { useState } from 'react';
import ThreeScene from './components/ThreeScene';
import { Settings2, Camera, Sun, Layers, Minimize2, Move3D, Smartphone } from 'lucide-react';

export default function App() {
  const [shadowType, setShadowType] = useState('PCFSoft');
  const [bias, setBias] = useState(-0.0005);
  const [normalBias, setNormalBias] = useState(0.02);
  const [frustumSize, setFrustumSize] = useState(8);
  const [mapSize, setMapSize] = useState(2048);
  const [showHelper, setShowHelper] = useState(true);
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, 2));

  const applyTier = (tier: string) => {
    if (tier === 'Battery') {
      setDpr(1);
      setMapSize(512);
      setShadowType('Basic');
    } else if (tier === 'Balanced') {
      setDpr(Math.min(window.devicePixelRatio || 1, 1.5));
      setMapSize(1024);
      setShadowType('PCF');
    } else if (tier === 'High') {
      setDpr(Math.min(window.devicePixelRatio || 1, 2));
      setMapSize(2048);
      setShadowType('PCFSoft');
    }
  };

  // Auto-formatted code snippet dynamically bound to state
  const codeSnippet = `// Enable shadows on renderer, light, caster, receiver
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.${shadowType}ShadowMap;
renderer.setPixelRatio( ${dpr} );

const sun = new THREE.DirectionalLight( 0xffffff, 2 );
sun.castShadow = true;
sun.shadow.mapSize.set( ${mapSize}, ${mapSize} );
sun.shadow.bias = ${bias};
sun.shadow.normalBias = ${normalBias};
sun.shadow.radius = 4;

sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 30;
sun.shadow.camera.left = -${frustumSize};
sun.shadow.camera.right = ${frustumSize};
sun.shadow.camera.top = ${frustumSize};
sun.shadow.camera.bottom = -${frustumSize};

// Visualize the frustum while you tune
${showHelper ? `scene.add( new THREE.CameraHelper( sun.shadow.camera ) );` : `// helper disabled`}`;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-950 text-gray-200 font-sans overflow-hidden">
      
      {/* Interactive Sidebar Tutorial */}
      <div className="w-full md:w-[450px] flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-1/2 md:h-full z-10 shadow-2xl">
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Sun className="w-6 h-6 text-yellow-400" />
              Three.js Shadow Guide
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Shadows sell the illusion that objects occupy space. Three.js bakes them via a shadow map — a depth render from the light's point of view — and every common bug you'll hit (acne, peter panning, blocky edges, clipping) comes from a knob you can tune. This tutorial exposes all of them.
            </p>
          </div>

          <hr className="border-gray-800" />

          {/* Section 1: Types */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Shadow Map Types
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              <strong className="text-gray-200">BasicShadowMap</strong> samples the depth buffer once per pixel — hard pixelated edges, cheapest. <strong className="text-gray-200">PCFShadowMap</strong> averages multiple nearby samples, giving antialiased edges. <strong className="text-gray-200">PCFSoftShadowMap</strong> adds a Poisson-disk jitter per frame for realistic softness. <strong className="text-gray-200">VSMShadowMap</strong> uses a two-channel shadow map that can be blurred directly.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {['Basic', 'PCF', 'PCFSoft', 'VSM'].map((type) => (
                <button
                  key={type}
                  onClick={() => setShadowType(type)}
                  className={\`py-2 px-3 text-sm rounded-lg border transition-colors \${
                    shadowType === type 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg' 
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }\`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Acne / Bias */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-pink-400" />
              Bias — The Acne Dial
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              <strong className="text-pink-400 font-mono">light.shadow.bias</strong> nudges the depth comparison by a tiny amount. Too small (near 0) → ground samples itself and produces shadow acne (black speckles). Too large → shadow detaches (peter panning). <strong className="text-pink-400 font-mono">normalBias</strong> offsets the sample along the normal and usually helps more for curved objects.
            </p>
            
            <div className="bg-gray-800/50 p-4 rounded-lg space-y-4 border border-gray-800">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-300 flex justify-between">
                  Bias <span className="font-mono text-xs text-blue-400">{bias.toFixed(4)}</span>
                </span>
                <input 
                  type="range" min="-0.005" max="0.005" step="0.0001" 
                  value={bias} onChange={(e) => setBias(Number(e.target.value))}
                  className="accent-blue-500"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-300 flex justify-between">
                  Normal Bias <span className="font-mono text-xs text-blue-400">{normalBias.toFixed(3)}</span>
                </span>
                <input 
                  type="range" min="-0.05" max="0.1" step="0.001" 
                  value={normalBias} onChange={(e) => setNormalBias(Number(e.target.value))}
                  className="accent-blue-500"
                />
              </label>
            </div>
          </div>

          {/* Section 3: Frustum */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-green-400" />
              Shadow Camera Frustum
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              A DirectionalLight uses an orthographic camera. Its left / right / top / bottom box defines where shadows exist. Crank <strong className="text-gray-200">Ortho Size</strong> down to see clipping; toggle the helper to visualize.
            </p>

            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-800 space-y-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-300 flex justify-between">
                  Ortho Size (Frustum Bounds) <span className="font-mono text-xs text-green-400">±{frustumSize}</span>
                </span>
                <input 
                  type="range" min="2" max="25" step="0.5" 
                  value={frustumSize} onChange={(e) => setFrustumSize(Number(e.target.value))}
                  className="accent-green-500"
                />
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className={\`w-10 h-6 rounded-full transition-colors relative \${showHelper ? 'bg-green-500' : 'bg-gray-700'}\`}>
                  <div className={\`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform \${showHelper ? 'translate-x-5' : 'translate-x-1'}\`} />
                </div>
                <input 
                  type="checkbox" className="hidden"
                  checked={showHelper} onChange={(e) => setShowHelper(e.target.checked)}
                />
                <span className="text-sm font-medium text-gray-300">Show Camera Helper</span>
              </label>
            </div>
          </div>

          {/* Section 4: Resolution */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Minimize2 className="w-4 h-4 text-purple-400" />
              Map Resolution
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              <strong className="text-purple-400 font-mono">light.shadow.mapSize</strong> sets pixel resolution. 512 is low, 1024 is fine, 2048+ is worth it when Ortho Size is large. Every doubling quadruples memory!
            </p>
            
            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
              {[512, 1024, 2048, 4096].map((res) => (
                <button
                  key={res}
                  onClick={() => setMapSize(res)}
                  className={\`flex-1 py-1.5 text-xs font-mono rounded-md transition-colors \${
                    mapSize === res 
                      ? 'bg-purple-600 text-white shadow' 
                      : 'text-gray-400 hover:text-gray-200'
                  }\`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
          
          {/* Section 5: Mobile Performance */}
          <div className="space-y-4">
             <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-orange-400" />
              Mobile Performance
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Phones have high-DPR displays (2× or 3×). If you don't clamp, a 400×800 canvas renders at 1200×2400 pixels. Use <strong className="text-gray-200">Math.min(devicePixelRatio, 2)</strong>. Provide adaptive quality tiers so users can save battery or boost visuals. Also ensure <strong className="text-gray-200">touchAction = 'none'</strong> is on your canvas to allow gestures to work without scrolling the page.
            </p>

            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-800 space-y-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-300">Adaptive Quality Tiers</span>
                <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                  {['Battery', 'Balanced', 'High'].map((tier) => (
                    <button
                      key={tier}
                      onClick={() => applyTier(tier)}
                      className="flex-1 py-1.5 text-xs font-medium rounded-md transition-colors text-gray-300 hover:bg-gray-700 active:bg-gray-600"
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

               <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-300 flex justify-between">
                  devicePixelRatio (DPR) <span className="font-mono text-xs text-orange-400">{(Math.round(dpr * 10) / 10).toFixed(1)}</span>
                </span>
                <input 
                  type="range" min="0.5" max="3" step="0.1" 
                  value={dpr} onChange={(e) => setDpr(Number(e.target.value))}
                  className="accent-orange-500"
                />
              </label>
            </div>
          </div>

          <div className="pb-4"></div>
        </div>

        {/* Code Snippet Footer */}
        <div className="bg-black/80 border-t border-gray-800 p-4 backdrop-blur-md">
          <div className="flex justify-between items-center mb-2">
             <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Generated Code</span>
          </div>
          <pre className="text-[10px] sm:text-xs font-mono text-[#a3b1c6] overflow-x-auto custom-scrollbar leading-relaxed">
            <code>
{codeSnippet.split('\\n').map((line, i) => {
  // Simple bespoke highlighting for readability
  let formatted = line
    .replace(/THREE.([a-zA-Z]+)/g, 'THREE.<span class="text-yellow-300">$1</span>')
    .replace(/(= |\( |: )([0-9.-]+)/g, '$1<span class="text-blue-400">$2</span>')
    .replace(/true|false/g, '<span class="text-pink-400">$&</span>')
    .replace(/(sun\.[a-zA-Z.]+)/g, '<span class="text-green-300">$1</span>')
    .replace(/renderer\.[a-zA-Z.]+/g, '<span class="text-purple-300">$&</span>')
    .replace(/\\/\\/.*/, '<span class="text-gray-500">$&</span>'); // comments
  return <div key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
})}
            </code>
          </pre>
        </div>

      </div>

      {/* 3D Scene Wrapper */}
      <div className="flex-1 relative h-1/2 md:h-full bg-gray-800">
        <div className="absolute top-4 right-4 z-10 pointer-events-none flex items-center gap-2 bg-black/50 backdrop-blur-sm pl-3 pr-4 py-2 rounded-full border border-white/10 shadow-xl">
           <Move3D className="w-4 h-4 text-gray-300" />
           <span className="text-xs font-medium text-gray-300 tracking-wide">DRAG TO ROTATE SCENE</span>
        </div>
        <ThreeScene 
          shadowType={shadowType}
          bias={bias} 
          normalBias={normalBias}
          frustumSize={frustumSize}
          mapSize={mapSize}
          showHelper={showHelper}
          dpr={dpr}
        />
      </div>
    </div>
  );
}
