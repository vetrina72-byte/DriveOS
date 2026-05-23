
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import NavigateTool from './NavigateTool';
import { useNavigation } from '../context/NavigationContext';
import { useWeather } from '../context/WeatherContext';

const mapHtmlContent = `

<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0">
<title>Drive-OS Navigation</title>
<link rel="preconnect" href="https://api.protomaps.com" crossorigin>
<link rel="preconnect" href="https://unpkg.com" crossorigin>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.20.0/dist/maplibre-gl.css">
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; }
html { position: fixed; width: 100%; height: 100%; overflow: hidden; }
body { margin:0; padding:0; width:100%; height:100%; font-family:'Inter',sans-serif; background:#0a0a0a; overflow:hidden; overscroll-behavior:none; -webkit-overflow-scrolling:auto; }
#map { position:absolute; top:0; left:0; width:100%; height:100%; }

/* FIX TILE FADE */
.maplibregl-canvas { transition: opacity 0.35s ease-in-out; opacity: 1; }
.maplibregl-canvas.map-loading { opacity: 0.7; }

:root {
  --blue:#3B82F6; --dark-bg:rgba(20,20,20,0.98); --border:rgba(255,255,255,0.12);
  --btn-bg:rgba(30,30,30,0.95); --btn-r:16px; --btn-sz:64px;
}
body.theme-dark  { --nb:rgba(24,24,27,0.97); --nborder:rgba(63,63,70,0.8); --ni:#27272a; --nm:#fff; --ns:#a1a1aa; --nh:rgba(255,255,255,0.1); }
body.theme-light { --nb:rgba(255,255,255,0.95); --nborder:rgba(0,0,0,0.15); --ni:#f4f4f5; --nm:#111; --ns:#71717a; --nh:rgba(0,0,0,0.06); }

/* CONTROLS */
.map-controls { position:absolute; top:24px; right:24px; z-index:1001; display:flex; flex-direction:column; gap:16px; align-items:flex-end; transition: opacity 0.3s, transform 0.3s; }
.map-controls.hidden { opacity: 0; transform: translateX(20px); pointer-events: none; }

.ctrl-btn { width:var(--btn-sz); height:var(--btn-sz); border-radius:var(--btn-r); border:1px solid var(--border); background:var(--btn-bg); color:#f0f0f0; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:transform .1s,background .2s; box-shadow:0 8px 20px rgba(0,0,0,.4); backdrop-filter:blur(15px); padding:0; -webkit-tap-highlight-color:transparent; }
.ctrl-btn:active { transform:scale(.92); }
.ctrl-btn.active { background:var(--blue); color:white; border-color:var(--blue); }
.ctrl-btn svg { width:32px; height:32px; fill: currentColor; }
.dyn-ctrl { display:flex; flex-direction:column; gap:16px; opacity:0; transform:translateX(30px); transition:all .35s cubic-bezier(.175,.885,.32,1.275); pointer-events:none; }
.dyn-ctrl.visible,.dyn-ctrl.force-vis { opacity:1; transform:translateX(0); pointer-events:auto; }

#btn-compass { background:#eee; border:none; overflow:hidden; }
.cn-up { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.cn-up .arr { width:0; height:0; border-left:7px solid transparent; border-right:7px solid transparent; border-bottom:16px solid #c00; margin-bottom:3px; }
.cn-up .let { font-weight:900; font-size:22px; color:#222; line-height:1; }
.ch-up { width:100%; height:100%; position:relative; background:#f5f5f5; }
.cfade { position:absolute; top:0; left:0; width:100%; height:100%; mask-image:linear-gradient(to bottom,black 50%,transparent 95%); -webkit-mask-image:linear-gradient(to bottom,black 50%,transparent 95%); z-index:1; }
.cring { position:absolute; top:50%; left:50%; width:100%; height:100%; transition:transform .1s linear; }
.cltr { position:absolute; top:0; left:0; width:100%; height:100%; text-align:center; font-size:10px; font-weight:700; color:#777; }
.cltr span { display:block; padding-top:4px; }
.l-n{transform:rotate(0deg)} .l-ne{transform:rotate(45deg)} .l-e{transform:rotate(90deg)} .l-se{transform:rotate(135deg)} .l-s{transform:rotate(180deg)} .l-sw{transform:rotate(225deg)} .l-w{transform:rotate(270deg)} .l-nw{transform:rotate(315deg)}
.l-n span{color:#c00;font-weight:900;font-size:12px} .l-e span,.l-w span,.l-s span{color:#333;font-weight:800;font-size:11px}
.carr { position:absolute; top:50%; left:50%; transform:translate(-50%,-60%); width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-bottom:18px solid #111; z-index:2; }

/* UI LAYOUT */
.ui-top-left { position: absolute; top: 20px; left: 20px; z-index: 1002; width: 340px; max-width: calc(100vw - 40px); perspective: 1000px; }

#nav-box {
  width: 100%; background: var(--nb); backdrop-filter: blur(24px); border: 1px solid var(--nborder); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.3); overflow: hidden;
  transition: opacity 0.3s ease, transform 0.4s cubic-bezier(.19,1,.22,1); transform-origin: top left; opacity: 1; position: relative; z-index: 2;
}
#nav-box.hidden { opacity: 0; transform: scale(0.95) translateY(-20px); pointer-events: none; position: absolute; top:0; left:0; }

#nav-inner { padding:12px; display:flex; flex-direction:column; }
#nav-srow { position:relative; flex-shrink:0; }
#nav-sicon { position:absolute; left:14px; top:50%; transform:translateY(-50%); width:20px; height:20px; color:#71717a; pointer-events:none; }
#nav-inp { width:100%; padding:10px 40px 10px 42px; background:var(--ni); border:none; border-radius:8px; color:var(--nm); font-size:14px; font-weight:500; font-family:'Inter',sans-serif; outline:none; resize:none; overflow-y:hidden; line-height:1.4; min-height:38px; transition:box-shadow .15s; caret-color:#3B82F6; -webkit-appearance:none; }
#nav-inp::placeholder{color:#71717a} #nav-inp:focus{box-shadow:0 0 0 2px #3B82F6}
#nav-clr { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:#52525b; cursor:pointer; padding:2px; display:none; }
#nav-res { overflow-y:auto; overflow-x:hidden; max-height:0; opacity:0; margin-top:0; transition:max-height .4s cubic-bezier(.2,.8,.2,1),opacity .3s,margin-top .3s; }
#nav-res.show { max-height:280px; opacity:1; margin-top:8px; }
.nsh { padding:4px 8px 6px; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#71717a; }
.nri { width:100%; text-align:left; display:flex; align-items:center; gap:16px; padding:10px; border-radius:8px; border:none; background:none; cursor:pointer; transition:background .12s; -webkit-tap-highlight-color:transparent; }
.nri:hover,.nri:active{background:var(--nh)}
.nri-ico { flex-shrink:0; width:36px; height:36px; border-radius:50%; background:rgba(59,130,246,0.15); display:flex; align-items:center; justify-content:center; color:#3B82F6; }
.nri.shop .nri-ico { background:rgba(249,115,22,0.15); color:#f97316; }
.nri-inf { flex:1; min-width:0; }
.nri-name { font-size:15px; font-weight:600; color:var(--nm); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.nri-name strong{color:var(--nm);font-weight:900}
.nri-addr { font-size:13px; color:#71717a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
.nri-meta { flex-shrink:0; text-align:right; }
.nri-dist { font-size:14px; font-weight:600; color:var(--nm); opacity:.9; }
.nri-time { font-size:12px; color:#71717a; margin-top:1px; }
.nav-load { text-align:center; padding:12px 8px; font-size:14px; color:#71717a; }
#nav-footer { flex-shrink:0; margin-top:8px; padding-top:8px; border-top:1px solid var(--nborder); display:flex; justify-content:space-around; }
.nfb { display:flex; align-items:center; gap:8px; padding:8px 16px; border-radius:8px; border:none; background:none; cursor:pointer; font-size:14px; font-weight:700; color:#454545!important; transition:background .12s; -webkit-tap-highlight-color:transparent; }
.nfb svg{width:18px;height:18px;stroke:#454545!important;fill:none!important}
.nfb:hover{background:var(--nh)}

#nav-top {
  width: 100%; background: rgba(30,30,30,0.95); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; box-shadow: 0 15px 40px rgba(0,0,0,0.5); color: white;
  position: absolute; top:0; left:0; opacity: 0; transform: translateY(20px) scale(0.95); pointer-events: none; transition: opacity 0.4s ease, transform 0.4s cubic-bezier(.19,1,.22,1); z-index: 3; display: flex; flex-direction: column; max-height: 85vh;
}
#nav-top.active { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

#nav-row { display:flex; align-items:flex-start; gap:16px; padding:16px; cursor: pointer; flex-shrink: 0; }
#nav-arrow-box { flex-shrink:0; width:64px; height:64px; background: #333; border-radius:12px; display:flex; align-items:center; justify-content:center; }
#nav-svg { width:48px; height:48px; fill:white; }
#nav-col { flex:1; min-width:0; padding-top:2px; }
#nav-dist { font-size:32px; font-weight:800; color:white; line-height:1; letter-spacing:-0.5px; margin-bottom:4px; font-variant-numeric:tabular-nums; }
#nav-instr { font-size:18px; font-weight:600; color:#e0e0e0; line-height:1.25; }

#nav-chev { width:100%; height:20px; display:flex; align-items:center; justify-content:center; opacity:0.6; cursor:pointer; transition:transform .3s; flex-shrink: 0; }
#nav-top.exp #nav-chev { transform:rotate(180deg); }
#mnv-list { flex:1; overflow-y:auto; overflow-x:hidden; max-height:0; opacity:0; background:rgba(0,0,0,0.2); transition:max-height .4s cubic-bezier(.19,1,.22,1), opacity .3s; border-top:1px solid rgba(255,255,255,0.08); }
#mnv-list::-webkit-scrollbar{width:4px}
#mnv-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.25);border-radius:2px}
#nav-top.exp #mnv-list { max-height:50vh; opacity:1; }

.mi { display:flex; align-items:center; gap:16px; padding:12px 20px; border-bottom:1px solid rgba(255,255,255,.06); color:white; }
.mi:last-child{border-bottom:none}
.mi.done { opacity:0.4; }
.mi-box { flex-shrink:0; width:40px; height:40px; display:flex; align-items:center; justify-content:center; }
.mi-svg { width:32px; height:32px; display:block; overflow:visible; fill:#ccc; stroke:none; }
.mi-txt { flex:1; min-width:0; }
.mi-d { font-size:13px; font-weight:700; color:#3B82F6; line-height:1; margin-bottom:4px; }
.mi-n { font-size:15px; font-weight:500; color:#ddd; }
.mi-dest { display:flex; align-items:center; gap:16px; padding:16px 20px; background:rgba(255,255,255,0.02); }
.mi-dpin { flex-shrink:0; width:40px; height:40px; background:rgba(239,68,68,.15); border-radius:50%; display:flex; align-items:center; justify-content:center; }
.mi-dlbl { font-size:15px; font-weight:700; color:#EF4444; }

#nav-bottom {
  position: absolute; bottom: 24px; left: 24px; z-index: 1003; width: 360px; max-width: calc(100vw - 48px); background: rgba(20,20,20,0.95); backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); padding: 20px; transform: translateY(150%); opacity: 0; transition: transform 0.5s cubic-bezier(.19,1,.22,1), opacity 0.4s ease; color: white;
}
#nav-bottom.active { transform: translateY(0); opacity: 1; }

.nb-row-1 { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
#nb-eta { font-size: 28px; font-weight: 700; color: white; }
.nb-stats { font-size: 16px; font-weight: 500; color: #a1a1aa; }
.nb-stats span { color: #e4e4e7; font-weight: 600; margin-left: 6px; }
#nb-dest { font-size: 14px; color: #71717a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 16px; font-weight: 500; }

.nb-btns { display: flex; gap: 10px; }
#nb-stop { flex: 1; background: #333; border: none; border-radius: 8px; padding: 12px; color: #ef4444; font-weight: 700; font-size: 15px; cursor: pointer; transition: background 0.2s; }
#nb-stop:active { background: #444; }

.map-pin-arrow { width:52px; height:52px; border-radius:50%; background:#111; border:3px solid #3B82F6; box-shadow:0 6px 20px rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; pointer-events:none; transition:transform .3s; }
.map-pin-arrow.near { border-color:#f97316; transform:scale(1.1); }
.map-pin-arrow svg { width:32px; height:32px; display:block; overflow:visible; fill:#3B82F6; stroke:none; }
.map-pin-arrow.near svg { fill:#f97316; }

.toast { position:fixed; bottom:-100px; left:50%; transform:translateX(-50%); background:rgba(20,20,20,.95); backdrop-filter:blur(15px); color:white; padding:14px 24px; border-radius:50px; font-size:15px; font-weight:600; z-index:10000; border:1px solid var(--border); display:flex; align-items:center; gap:10px; opacity:0; transition:all .4s cubic-bezier(.175,.885,.32,1.275); white-space:nowrap; box-shadow:0 10px 30px rgba(0,0,0,.5); }
.toast.show{opacity:1;bottom:40px}

#tl-ctrl { position:absolute; bottom:140px; left:50%; z-index:1002; width:340px; transform:translate(-50%,20px); opacity:0; pointer-events:none; transition:all .3s; padding:14px; border-radius:30px; }
#tl-ctrl.vis{opacity:1;transform:translate(-50%,0);pointer-events:all}
#tl-slider { width:100%; height:6px; border-radius:3px; outline:none; background:#333; margin-top:6px; cursor:pointer; -webkit-appearance:none; }
#tl-slider::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;background:white;cursor:pointer;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.5);transform:translateY(-30%)}

#street-box { position:absolute; bottom:30px; right:30px; z-index:1001; padding:10px 20px; border-radius:12px; font-weight:600; font-size:15px; background:rgba(20,20,20,.95); border:1px solid var(--border); color:white; opacity:0; transform:translateY(10px); pointer-events:none; max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:all .3s; backdrop-filter:blur(10px); }
#street-box.vis{opacity:1;transform:translateY(0)}

.dest-pin { width:48px; height:64px; cursor:default; display: block; overflow: visible; }
.dest-pin svg { filter: drop-shadow(0 5px 10px rgba(0,0,0,.4)); }

#vm { width:76px; height:76px; display:block; z-index:500; filter:drop-shadow(0 6px 12px rgba(0,0,0,.5)); will-change:transform; }
.maplibregl-ctrl-logo,.maplibregl-ctrl-attrib{display:none!important}
</style>
</head>
<body class="theme-dark">
<div id="map"></div>

<!-- Top Left Container -->
<div class="ui-top-left">
  <div id="nav-box">
    <div id="nav-inner">
      <div id="nav-srow">
        <svg id="nav-sicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <textarea id="nav-inp" rows="1" placeholder="Cerca destinazione" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
        <button id="nav-clr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div id="nav-res"></div>
      <div id="nav-footer">
        <button class="nfb" id="btn-home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Casa</span></button>
        <button class="nfb" id="btn-work"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg><span>Lavoro</span></button>
      </div>
    </div>
  </div>

  <div id="nav-top">
    <div id="nav-row">
      <div id="nav-arrow-box">
        <svg id="nav-svg" viewBox="0 -960 960 960" fill="white" stroke="none"></svg>
      </div>
      <div id="nav-col">
        <div id="nav-dist">--</div>
        <div id="nav-instr">Calcolo...</div>
      </div>
    </div>
    <div id="nav-chev">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" width="20" height="20"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div id="mnv-list"></div>
  </div>
</div>

<!-- Bottom Left Stats Panel -->
<div id="nav-bottom">
  <div class="nb-row-1">
    <div id="nb-eta">--:--</div>
    <div class="nb-stats">
        <span id="nb-min">-- min</span>
        <span id="nb-km">-- km</span>
    </div>
  </div>
  <div id="nb-dest">Destinazione...</div>
  <div class="nb-btns">
    <button id="nb-stop">Esci</button>
  </div>
</div>

<!-- Map controls -->
<div class="map-controls" id="map-ctrls">
  <button id="btn-compass" class="ctrl-btn">
    <div id="cn-icon" class="cn-up"><div class="arr"></div><div class="let">N</div></div>
    <div id="ch-icon" class="ch-up" style="display:none">
      <div class="cfade"><div class="cring" id="cring">
        <div class="cltr l-n"><span>N</span></div><div class="cltr l-ne"><span>NE</span></div>
        <div class="cltr l-e"><span>E</span></div><div class="cltr l-se"><span>SE</span></div>
        <div class="cltr l-s"><span>S</span></div><div class="cltr l-sw"><span>SW</span></div>
        <div class="cltr l-w"><span>W</span></div><div class="cltr l-nw"><span>NW</span></div>
      </div></div>
      <div class="carr"></div>
    </div>
  </button>
  <div id="dyn-ctrl" class="dyn-ctrl">
    <button id="btn-recenter" class="ctrl-btn">
        <svg viewBox="0 -960 960 960"><path d="M439-57v-34q-139-15-235.5-111.5T93-437H59q-17.3 0-29.15-11.79Q18-460.58 18-477.79T29.85-507Q41.7-519 59-519h34q15-139 111.5-235.5T439-865v-34q0-17.3 11.79-29.15 11.79-11.85 29-11.85T509-928.15q12 11.85 12 29.15v34q138 14 234.5 110.5T867-519h34q17.3 0 29.15 11.79 11.85 11.79 11.85 29T930.15-449Q918.3-437 901-437h-34q-14 138-110.5 234.5T521-91v34q0 17.3-11.79 29.15Q497.42-16 480.21-16T451-27.85Q439-39.7 439-57Zm249.5-212.33q86.5-86.33 86.5-208.5T688.67-686.5Q602.34-773 480.17-773T271.5-686.67Q185-600.34 185-478.17t86.33 208.67q86.33 86.5 208.5 86.5t208.67-86.33Z"/></svg>
    </button>
    <button id="btn-mapmode" class="ctrl-btn">
        <svg viewBox="0 -960 960 960"><path d="M480.4-55q-88.87 0-166.12-33.08-77.25-33.09-135.18-91.02-57.93-57.93-91.02-135.12Q55-391.41 55-480.36q0-88.96 33.08-166.29 33.09-77.32 90.86-134.81 57.77-57.48 135.03-91.01Q391.24-906 480.28-906t166.49 33.45q77.44 33.46 134.85 90.81t90.89 134.87Q906-569.34 906-480.27q0 89.01-33.53 166.25t-91.01 134.86q-57.49 57.62-134.83 90.89Q569.28-55 480.4-55Zm-.4-94q125.38 0 216.19-80T805-427q0 2 .5 4.25t.5 2.75q-12 14-28.89 22T740-390h-75q-36.71 0-62.86-26.24Q576-442.48 576-479.33V-524H398v-82.58q0-37.78 26.24-63.6T487.33-696H532v-22q0-21.34 15-48.67Q562-794 582-795q-24.02-6.55-49.57-11.27-25.56-4.73-52.07-4.73Q342-811 245.5-714.69T149-480q0 4 .5 7.5t.5 7.5h104q74 0 126 52t52 125.47V-243H299v48q40 21 85.83 33.5Q430.65-149 480-149Z"/></svg>
    </button>
    <button id="btn-weather" class="ctrl-btn">
        <svg viewBox="0 -960 960 960"><path d="M457-13.64Q440-30.27 440-53q0-11.65 4.5-21.82Q449-85 457-93l26-23q6-6 14.27-6 8.28 0 15.73 6l26 23q7 8 11.5 18.13 4.5 10.12 4.5 21.72Q555-30 538.5-13.5T498 3q-24 0-41-16.64ZM325-101q-12-11.64-12-27.32T325-156l76-76q11-11 27-11t27 11.5q11 11.5 11 27T455-177l-77 77q-11.91 11-26.95 10.5Q336-90 325-101Zm292-47-37-38q-7-7.18-7-17.09t7-16.91l37-38q7.18-7 17.09-7t16.91 7l38 38q7 7.18 7 17.09T689-186l-38 38q-7.18 7-17.09 7T617-148Zm-332-38-38 38q-7.18 7-17.09 7T213-148l-38-38q-7-7.18-7-17.09t7-16.91l38-38q7.18-7 17.09-7t16.91 7l38 38q7 7.18 7 17.09T285-186Zm5-148q-93.52 0-160.26-67T63-561q0-84 58-150t145-75q35.36-56 90.74-89.5Q412.13-909 479.81-909 573-909 638-851t84 144q82 8 128.5 61.47T897-521.49Q897-444 842.75-389 788.5-334 710-334H290Zm0-95h420q38.52 0 65.76-27Q803-483 803-521q0-39-27.24-66T710-614h-77v-47q0-64.47-44.26-108.74Q544.47-814 480-814q-45.63 0-83.98 24.81Q357.68-764.38 340-723l-12.57 29H289q-55.48 2.09-93.74 40.32Q157-615.44 157-561q0 54.07 39 93.04Q235-429 290-429Zm190-192Z"/></svg>
    </button>
  </div>
</div>

<div id="toast" class="toast"><i id="toast-icon" data-lucide="info"></i><span id="toast-txt"></span></div>

<div id="tl-ctrl" style="background:rgba(18,18,18,.95);backdrop-filter:blur(25px);border:1px solid var(--border);">
  <div style="display:flex;align-items:center;gap:16px">
    <button id="tl-pp" style="background:none;border:none;color:white;cursor:pointer"><i data-lucide="play"></i></button>
    <div style="flex-grow:1;text-align:center">
      <div id="tl-lbl" style="font-size:13px;font-weight:600;color:white;margin-bottom:4px">Radar</div>
      <input type="range" id="tl-slider" min="0" value="0">
    </div>
  </div>
</div>

<div id="street-box"><span id="street-txt"></span></div>

<script>
window.pendingNavMsg=null; window.teslaNav=null;
window.addEventListener('message',function(e){
  if(!e.data)return; var d=e.data;
  if(d.type==='SET_DESTINATION'){if(window.teslaNav){var p=d.payload;window.teslaNav.setDest({lat:p.lat,lng:p.lng},p.name,false);}else{window.pendingNavMsg=d;}}
  if(d.type==='CLEAR_ROUTE_FROM_PARENT'&&window.teslaNav)window.teslaNav.clearRoute();
  if(d.type==='SET_HOME_LOCATION'&&window.teslaNav)window.teslaNav.homeLocation=d.payload;
  if(d.type==='SET_WORK_LOCATION'&&window.teslaNav)window.teslaNav.workLocation=d.payload;
  if(d.type==='SHOW_NAVIGATE_BOX'){var b=document.getElementById('nav-box');if(b)b.classList.remove('hidden');}
});
(function(){var s=document.createElement('script');s.src='https://unpkg.com/maplibre-gl@5.20.0/dist/maplibre-gl.js';s.onload=initApp;s.onerror=function(){document.body.innerHTML='<div style="color:red;font-size:20px;padding:20px;z-index:9999;position:absolute;background:black;">Failed to load maplibre-gl.js</div>';};document.head.appendChild(s);})();

function initApp(){
try {
var IMU=(function(){
  var g=null,gps=null,fused=null,lt=null,ok=false,A=0.97;
  function h(e){var n=performance.now();if(e.rotationRate&&e.rotationRate.alpha!==null){if(lt!==null){var dt=(n-lt)/1000;if(g===null)g=gps!==null?gps:0;g=(g+(e.rotationRate.alpha||0)*dt+360)%360;}lt=n;}ok=true;}
  function init(){if(typeof DeviceMotionEvent==='undefined')return;if(typeof DeviceMotionEvent.requestPermission==='function'){DeviceMotionEvent.requestPermission().then(s=>{if(s==='granted')window.addEventListener('devicemotion',h,{passive:true});}).catch(()=>{});}else{window.addEventListener('devicemotion',h,{passive:true});}}
  function updGPS(deg){gps=deg;if(g===null)g=deg;var d=deg-g;d=((d+540)%360)-180;g=(g+d*(1-A)+360)%360;fused=g;}
  function heading(){return(fused!==null&&ok)?fused:gps;}
  return{init,updGPS,heading,active:()=>ok};
})();

var DR=(function(){
  var p=null,t=null,s=0,h=0,d=null;
  function upd(la,lo,sp,hd){p={lat:la,lng:lo};t=performance.now();s=sp>=0?sp:s;h=hd;d={lat:la,lng:lo};}
  function est(){if(!d||!t)return d;var age=(performance.now()-t)/1000;if(age>2||s<0.5)return d;var dist=s*age*0.85,R=6371000,br=h*Math.PI/180,la=d.lat*Math.PI/180,lo=d.lng*Math.PI/180;var la2=Math.asin(Math.sin(la)*Math.cos(dist/R)+Math.cos(la)*Math.sin(dist/R)*Math.cos(br));var lo2=lo+Math.atan2(Math.sin(br)*Math.sin(dist/R)*Math.cos(la),Math.cos(dist/R)-Math.sin(la)*Math.sin(la2));return{lat:la2*180/Math.PI,lng:lo2*180/Math.PI};}
  return{upd,est,spd:()=>s,hdg:()=>h};
})();

function drawArrow(key){
  var paths={
    straight: "\\x3Cpath d=\"m435-688-59 59q-14 14-32.5 14T312-629q-14-13-14-31.5t14-32.5l136-137q12-12 32-12t33 12l136 137q13 14 13 32.5T649-629q-13 13-32 13.5T585-629l-59-59v543q0 21-13.5 33.5T480-99q-19 0-32-12.5T435-145v-543Z\"/>",
    right:"\\x3Cpath d=\"M263-182v-329q0-39 27.5-66.5T357-605h328l-56-57q-15-14-15-32.5t14.5-33Q643-742 662-742t33 14l137 136q14 14 14 34t-14 34L695-388q-14 15-32.5 14.5t-33-15Q615-403 615-422t14-33l56-56H357v329q0 20-13.5 33.5T310-135q-20 0-33.5-13.5T263-182Z\"/>",
    left:"\\x3Cpath d=\"m275-511 57 56q14 15 13.5 34t-15 33.5Q316-373 297.5-373T264-388L128-524q-14-14-14-34t14-34l137-136q14-15 33-15t33.5 14.5Q346-714 346-695t-14 33l-57 57h328q39 0 66.5 27.5T697-511v329q0 20-13.5 33.5T650-135q-20 0-33.5-13.5T603-182v-329H275Z\"/>",
    'slight-right':"\\x3Cpath d=\"M356.5-148.63Q343-162.25 343-182v-266q0-18.09 7.5-35.54Q358-501 371-514l216-217h-79q-20.75 0-34.37-13.68Q460-758.35 460-778.18 460-798 473.63-812q13.62-14 34.37-14h193q19.75 0 33.88 14.12Q749-797.75 749-778v193q0 20.75-14.18 34.37-14.17 13.63-34 13.63-19.82 0-33.32-13.63Q654-564.25 654-585v-79L437-448v266q0 19.75-13.68 33.37Q409.65-135 389.82-135q-19.82 0-33.32-13.63Z\"/>",
    'slight-left':"\\x3Cpath d=\"M542.5-148.63Q529-162.25 529-182v-266L312-664v79q0 20.75-13.68 34.37Q284.65-537 264.82-537q-19.82 0-33.32-13.63Q218-564.25 218-585v-193q0-19.75 13.63-33.88Q245.25-826 265-826h194q19.75 0 33.38 14.18 13.62 14.17 13.62 34 0 19.82-13.62 33.32Q478.75-731 459-731h-80l216 217q13 13 20.5 30.46Q623-466.09 623-448v266q0 19.75-13.68 33.37Q595.65-135 575.82-135q-19.82 0-33.32-13.63Z\"/>",
    'sharp-right':"\\x3Cpath d=\"M246.5-108.63Q233-122.25 233-142v-211q0-38.8 27.6-66.4Q288.2-447 327-447h306v-239l-57 57q-14 15-33 15t-33-14.43q-14-14.43-14-33T510-695l136-136q14.36-14 34.18-14T714-831l136 136q14 14.53 14 33.27 0 18.73-14 33.23-14 14.5-33 14.5t-33-15l-57-57v239q0 38.8-27.6 66.4Q671.8-353 633-353H327v211q0 19.75-13.68 33.37Q299.65-95 279.82-95 260-95 246.5-108.63Z\"/>",
    'sharp-left':"\\x3Cpath d=\"M633-142v-211H327q-38.77 0-66.39-27.61Q233-408.23 233-447v-239l-57 57q-14 15-33 15t-33-14.5Q96-643 96-661.73q0-18.74 14-33.27l136-136q14.73-14 34.36-14Q300-845 314-831l136 136q14 14.53 14 33.27 0 18.73-14 33.23-14 14.5-33 14.5t-33-15l-57-57v239h306q38.77 0 66.39 27.61Q727-391.77 727-353v211q0 19.75-13.68 33.37Q699.65-95 679.82-95 660-95 646.5-108.63 633-122.25 633-142Z\"/>",
    uturn:"\\x3Cpath d=\"M249.5-277q-8.5-4-15.5-11L98-424q-15-14-15-33t15-33q14-14 32.5-14t33.5 14l57 57v-172q0-108 76-184.5T481.5-866q108.5 0 185 76.5T743-605v434q0 20-14 33.5T695-124q-20 0-33.5-13.5T648-171v-434q0-69-48.5-117.5t-118-48.5q-69.5 0-118 48.5T315-605v172l59-58q14-14 31.5-13.5T437-490q15 15 15 33.5T438-424L302-288q-7 7-16 11t-18.5 4q-9.5 0-18-4Z\"/>",
    'uturn-right':"\\x3Cpath d=\"M234.5-137.5Q221-151 221-171v-434q0-108 76-184.5T481.5-866q108.5 0 185 76.5T743-605v172l57-57q14-14 32.5-14t33.5 14q14 14 14 33t-14 33L729-288q-7 7-15.5 11t-18 4q-9.5 0-18.5-4t-15-11L525-424q-14-14-14-32.5t15-33.5q14-14 31.5-14.5T590-491l58 58v-172q0-69-48.5-117.5t-118-48.5q-69.5 0-118 48.5T315-605v434q0 20-13.5 33.5T268-124q-20 0-33.5-13.5Z\"/>",
    roundabout:"\\x3Cpath d=\"M601-172v-198q0-29 17.58-51.1T665-448q63.14-7.28 104.57-52.67Q811-546.06 811-607.94q0-68.06-47.26-115.56Q716.47-771 648-771q-62.42 0-108.71 42Q493-687 487-624q-4.68 25.84-27.77 44.42Q436.14-561 409-561H234l57 57q13 14 13.5 33T292-438q-14 14-33.5 14T226-438L89-575q-7-6-11-15t-4-18.5q0-9.5 4.05-18.1Q82.09-635.2 89-642l137-137q14.25-14.17 33.13-13.58Q278-792 292-779q14 14.53 14 33.27Q306-727 292-713l-58 57h163q15-91 87-150.5T648.09-866q106.88 0 182.39 75.52Q906-714.97 906-608.09 906-516 846.5-444T696-357v185q0 20-14.09 33.5t-34 13.5q-19.91 0-33.41-13.5Q601-152 601-172Z\"/>",
    'roundabout-right':"\\x3Cpath d=\"M265-172v-185q-91-16-150.5-87T55-608q0-107 75-182.5T313-866q93 0 164 59.5T564-656h163l-57-57q-14-14-14-33t13-33q14-14 33-14t33 14l137 137q7 7 11 15.5t4 18q0 9.5-4 18.5t-11 15L735-438q-14 14-33 14t-33-14q-13-14-13-33t13-32l58-58H552q-29 0-51.5-17.5T474-624q-7-63-52.5-105T313-771q-68 0-115.5 47.5T150-608q0 62 41.5 107.5T296-448q28 5 46 27t18 51v198q0 20-13.5 33.5t-34 13.5q-20.5 0-34-13.5T265-172Z\"/>",
    arrive:"\\x3Cpath d=\"M480-334 274-128q-14 15-33 14.5T208-128q-14-14-14-32.5t14-33.5l190-190q21-21 28-38t7-53v-211l-57 57q-14 15-33 15t-33-15q-14-14-14-32.5t14-33.5l136-136q14-14 34-14t34 14l136 136q14 15 14 33.5T650-629q-14 15-33 15t-33-14l-57-58v211q0 36 7 53t28 38l190 190q14 15 14 34t-14 32q-14 15-33 15t-33-15L480-334Z\"/>",
    depart:"\\x3Cpath d=\"M326.5-198.62Q263-262.24 263-353.29q0-83.28 50.5-137.99Q364-546 433-565v-161l-50 50q-15.5 14-33.75 14.5T317-676q-15-14-15-33t15-33l130-131q7.16-6 15.68-10t17.4-4q8.88 0 17.4 4 8.52 4 15.52 10l130 131q15 14 15 32.97 0 18.98-14.09 33.5Q630-661 610.7-661T577-676l-50-50v161q69 19 119.5 73.72Q697-436.57 697-353.29q0 91.05-63.5 154.67Q570-135 480-135t-153.5-63.62ZM567-265.65q36-35.64 36-87 0-51.35-36-86.85-36-35.5-87-35.5t-87 35.65q-36 35.64-36 87 0 51.35 36 86.85 36 35.5 87 35.5t87-35.65ZM480-353Z\"/>",
    merge:"\\x3Cpath d=\"M480-334 274-128q-14 15-33 14.5T208-128q-14-14-14-32.5t14-33.5l190-190q21-21 28-38t7-53v-211l-57 57q-14 15-33 15t-33-15q-14-14-14-32.5t14-33.5l136-136q14-14 34-14t34 14l136 136q14 15 14 33.5T650-629q-14 15-33 15t-33-14l-57-58v211q0 36 7 53t28 38l190 190q14 15 14 34t-14 32q-14 15-33 15t-33-15L480-334Z\"/>",
    'merge-right':"\\x3Cpath d=\"M225-201.43Q225-220 239-235l192-191v-259l-72 72q-14.36 14-33.18 13.5T293-614q-14-14-14-33.3 0-19.3 14-33.7l151-152q7.16-6 16.18-10.5t17.9-4.5q8.88 0 17.9 4.5Q505-839 512-833l152 153q14 14.36 14 33.18T664-614q-14 14-33.3 14-19.3 0-33.7-14l-72-71v258q0 18.51-7.5 36.26Q510-373 497-359L305-168q-14 15-33 14.5t-33-14.93q-14-14.43-14-33Zm491.09 32.34Q702-155 682.5-155q-19.5 0-33.5-14l-96-95q-14-14-13.5-33.43t14.03-32.5q13.52-14.07 33-14.07Q606-344 620-330l96 95q14.17 14.75 13.58 33.37-.58 18.63-13.49 32.54Z\"/>",
    'ramp-right':"\\x3Cpath d=\"M444.5-108.5Q431-122 431-142v-189q-25 31-61 61.5T289-212q-19 13-40.5 11T211-218q-14-14-8.5-33t23.5-32q121-79 163-141.5T431-565v-121l-57 57q-14 15-33 14.5T308-629q-14-14-14-33t14-33l136-137q7-7 16-11t18-4q9 0 18 4t16 11l136 137q14 14 14 33t-14 33q-14 14-33 14t-33-14l-57-57v544q0 20-13.5 33.5T478-95q-20 0-33.5-13.5Z\"/>",
    'ramp-left':"\\x3Cpath d=\"M435-142v-544l-57 57q-14 14-33 14t-33-14q-14-14-14-33t14-33l136-137q7-7 16-11t18-4q9 0 18 4t16 11l136 137q14 14 14 33t-14 33q-14 14-33 14.5T586-629l-57-57v121q0 78 42 140.5T735-283q17 13 22.5 32t-8.5 33q-16 15-37.5 17T671-212q-45-27-81-57.5T529-331v189q0 20-13.5 33.5T482-95q-20 0-33.5-13.5T435-142Z\"/>",
    'keep-right':"\\x3Cpath d=\"M356.5-148.63Q343-162.25 343-182v-266q0-18.09 7.5-35.54Q358-501 371-514l216-217h-79q-20.75 0-34.37-13.68Q460-758.35 460-778.18 460-798 473.63-812q13.62-14 34.37-14h193q19.75 0 33.88 14.12Q749-797.75 749-778v193q0 20.75-14.18 34.37-14.17 13.63-34 13.63-19.82 0-33.32-13.63Q654-564.25 654-585v-79L437-448v266q0 19.75-13.68 33.37Q409.65-135 389.82-135q-19.82 0-33.32-13.63Z\"/>",
    'keep-left':"\\x3Cpath d=\"M542.5-148.63Q529-162.25 529-182v-266L312-664v79q0 20.75-13.68 34.37Q284.65-537 264.82-537q-19.82 0-33.32-13.63Q218-564.25 218-585v-193q0-19.75 13.63-33.88Q245.25-826 265-826h194q19.75 0 33.38 14.18 13.62 14.17 13.62 34 0 19.82-13.62 33.32Q478.75-731 459-731h-80l216 217q13 13 20.5 30.46Q623-466.09 623-448v266q0 19.75-13.68 33.37Q595.65-135 575.82-135q-19.82 0-33.32-13.63Z\"/>"
  };
  return paths[key]||paths.straight;
}

function getKey(step){
  if(!step||!step.maneuver)return'straight';
  var t=(step.maneuver.type||'').toLowerCase(), m=(step.maneuver.modifier||'').toLowerCase();
  if(t==='arrive')return'arrive'; 
  if(t==='depart')return'depart';
  
  if(t==='continue' || t==='new name' || t==='notification' || (t==='turn' && m==='straight')) return 'straight';

  if(t==='on ramp'||t==='off ramp'){return m.includes('left')?'ramp-left':'ramp-right';}
  if(t.includes('roundabout')||t.includes('rotary')){return m.includes('left')?'roundabout':'roundabout-right';}
  if(t==='merge'){return m.includes('right')?'merge-right':'merge';}
  if(m==='uturn'){return m.includes('right')?'uturn-right':'uturn';}
  if(m.includes('keep')||t==='fork'){if(m.includes('left'))return'keep-left';if(m.includes('right'))return'keep-right';return'keep-right';}
  if(m==='sharp right')return'sharp-right'; if(m==='right')return'right'; if(m==='slight right')return'slight-right';
  if(m==='sharp left')return'sharp-left'; if(m==='left')return'left'; if(m==='slight left')return'slight-left';
  return'straight';
}

function fd(m){if(m>=1000)return(m/1000).toFixed(1)+' km';if(m>=100)return Math.round(m/10)*10+' m';return Math.round(m)+' m';}
function ft(s){if(!s||isNaN(s))return'';var m=Math.round(s/60);return m<60?m+' min':Math.floor(m/60)+'h '+Math.round(m%60)+'min';}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

var NS={E:'e',R:'r',S:'s'};

class Nav {
  constructor(){
    this.gk='0d2c9c7f72c0477eb3260838db72a383';
    this.osrm='https://routing.openstreetmap.de/routed-car/route/v1/driving/';
    
    this.tgt=null; this.rpos=null; this.mbear=0; this.cbear=0; this.tbear=0;
    this.spd=0; this.lgps=performance.now(); this.lastGpsPos=null; this.flying=false;
    this.dest=null; this.destMark=null;
    this.follow=true; this.interact=false; this.naving=false;
    this.geo=null; this.steps=[]; this.si=0; this.tripInfo=null;
    this.pendDest=null; this.remDist=0; this.remTime=0;
    this.proxMark=null; this.proxStep=-1;
    this.izActive=false; this.ZN=17; this.ZH=16; this.ZI=18.5; this.IDIST=120;
    this.cmode='north-up'; this.savedMode=null;
    this.mapMode='auto'; this.extTheme=null;
    this.wVis=false; this.wTs=[]; this.wFr=0; this.wPlay=false; this.wInt=null;
    this.wSlot='A'; this.wSwitch=false; this.wNow=-1;
    this.recTimer=null; this.autoZoomed=false; this.sTimer=null;
    this.recents=this.loadR(); this.homeLocation=null; this.workLocation=null;
    this.lastRev=0; this.REV_INT=10000;
    this.navState=NS.S; this.lcUpd=0; this.devCnt=0; this.recalcCD=false; this.nearIdx=0;
    this.expanded=false;
    this.destName='Destinazione';
    this._tileCache = new Map();
    this.startTrackTimer = null;
    this.isPendingStart = false; 
    this.activeFetchId = 0;

    IMU.init(); this.initMap();
  }

  buildStyle(t){
    var K='c8deb6d53bc6a94d';
    if(t==='light') return 'https://api.protomaps.com/styles/v5/light/it.json?key='+K;
    if(t==='dark')  return 'https://api.protomaps.com/styles/v5/dark/it.json?key='+K;

    if(t==='satellite'){
      return {
        version: 8,
        glyphs: 'https://api.protomaps.com/fonts/v3/{fontstack}/{range}.pbf?key='+K,
        sprite: 'https://api.protomaps.com/sprites/v4/light/it',
        sources: {
          sat: { type:'raster', tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize:256, maxzoom:19, attribution:'Esri' },
          protomaps: { type:'vector', url:'https://api.protomaps.com/tiles/v4.json?key='+K, maxzoom:15 }
        },
        layers:[
          { id:'sat-layer', type:'raster', source:'sat', minzoom:0, maxzoom:24 },
          { id:'lbl-places', type:'symbol', source:'protomaps', 'source-layer':'places', minzoom:0,
            layout:{
              'text-field':['coalesce',['get','name:it'],['get','name']],
              'text-font':['case',['<=',['get','pmap:rank'],2],['literal',['Noto Sans Bold']],['literal',['Noto Sans Regular']]],
              'text-transform':['case',['<=',['get','pmap:rank'],2],'uppercase','none'],
              'text-size':['interpolate',['linear'],['zoom'],0,10,2,['case',['<=',['get','pmap:rank'],2],12,0],4,11,8,14,16,18],
              'text-max-width':8, 'text-anchor':'center', 'symbol-sort-key':['get','pmap:rank'],
              'text-allow-overlap':false, 'text-ignore-placement':false
            },
            paint:{'text-color':'#ffffff','text-halo-color':'rgba(0,0,0,0.7)','text-halo-width':2,'text-halo-blur':1}
          },
          { id:'lbl-roads', type:'symbol', source:'protomaps', 'source-layer':'roads', minzoom:13, layout:{'text-field':['coalesce',['get','name:it'],['get','name']],'text-font':['Noto Sans Regular'], 'text-size':['interpolate',['linear'],['zoom'],13,11,16,14], 'symbol-placement':'line', 'text-max-angle':30}, paint:{'text-color':'#f0f0f0','text-halo-color':'rgba(0,0,0,0.8)','text-halo-width':1.5}},
          { id:'lbl-poi', type:'symbol', source:'protomaps', 'source-layer':'pois', minzoom:14, layout:{'text-field':['coalesce',['get','name:it'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':11,'text-anchor':'top','text-offset':[0,0.5],'text-max-width':6}, paint:{'text-color':'#ffffff','text-halo-color':'rgba(0,0,0,0.9)','text-halo-width':1.5}}
        ]
      };
    }
    return 'https://api.protomaps.com/styles/v5/dark/it.json?key='+K;
  }

  ensureGlobalLabels(){
     if(this.mapMode!=='satellite'&&!this.map.getLayer('lbl-places-global')&&this.map.getSource('protomaps')){
        this.map.addLayer({
            id:'lbl-places-global', type:'symbol', source:'protomaps', 'source-layer':'places', minzoom:0, maxzoom:3,
            layout:{'text-field':['coalesce',['get','name:it'],['get','name']],'text-font':['Noto Sans Bold'],'text-transform':'uppercase','text-size':11,'symbol-sort-key':['get','pmap:rank']},
            paint:{'text-color':(this.mapMode==='auto'&&document.body.classList.contains('theme-light'))?'#333':'#fff','text-halo-color':(this.mapMode==='auto'&&document.body.classList.contains('theme-light'))?'#fff':'#000','text-halo-width':2}
        });
     }
  }

  initMap(){
    var h=new Date().getHours(); var th=h>=6&&h<19?'light':'dark';
    document.body.className='theme-'+th;

    this.map = new maplibregl.Map({
      container: 'map',
      style: this.buildStyle(th),
      center:[12.4964, 41.9028],
      zoom: 14,
      attributionControl: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      minPitch: 0,
      fadeDuration: 300,
      minZoom: 1.8,
      bearingSnap: 0,
      dragRotate: true,
      touchZoomRotate: true,
      maxTileCacheSize: 300,
      maxZoom: 20
    });

    new ResizeObserver(()=>this.map.resize()).observe(document.getElementById('map'));

    var el=document.createElement('div'); el.id='vm';
    el.innerHTML='<svg viewBox="0 0 1414 2000" style="width:100%;height:100%;overflow:visible"><path fill="#FDFCFC" d="M639.979065,551.815125 C645.168152,540.088928 650.026184,528.629089 655.273071,517.350159 C668.813538,488.243103 708.591675,477.322784 735.566650,494.553101 C749.156494,503.233704 756.313721,515.993591 762.405273,530.085083 C787.421509,587.954773 812.641113,645.736633 837.759827,703.562134 C862.019897,759.411072 886.220703,815.285706 910.497864,871.127136 C934.243469,925.745850 958.087769,980.321533 981.824341,1034.944092 C1007.415466,1093.834229 1032.934204,1152.755859 1058.479614,1211.665894 C1065.145508,1227.038086 1072.164307,1242.270264 1078.359985,1257.829956 C1086.983032,1279.485596 1080.075684,1304.759277 1061.833496,1320.765991 C1044.998657,1335.537842 1018.689575,1338.636230 998.807922,1327.514404 C973.012146,1313.083984 947.494507,1298.156738 921.845398,1283.463745 C896.915344,1269.182495 871.943359,1254.974487 847.039307,1240.648193 C818.390015,1224.167480 789.808044,1207.569946 761.171631,1191.066895 C743.616943,1180.949951 726.045654,1170.860352 708.373291,1160.952148 C707.027161,1160.197388 704.456543,1160.359009 703.057556,1161.154419 C677.210327,1175.849976 651.469910,1190.733276 625.675842,1205.522827 C600.896851,1219.730347 576.053467,1233.825806 551.291382,1248.062500 C526.381775,1262.384155 501.560059,1276.858398 476.657715,1291.192383 C455.215363,1303.535034 433.836731,1315.996338 412.205383,1328.000488 C388.054901,1341.402466 353.937225,1332.084717 339.430542,1308.918579 C327.287811,1289.527344 327.550873,1270.051636 336.589294,1249.539062 C360.004272,1196.398804 382.947418,1143.050781 406.116211,1089.801880 C430.474152,1033.819946 454.903503,977.869019 479.249084,921.881653 C499.687012,874.880615 520.035400,827.840698 540.448792,780.828918 C568.990845,715.096863 597.555237,649.374451 626.113342,583.649353 C630.675232,573.150452 635.254150,562.658875 639.979065,551.815125z"/><path fill="#F53C3F" d="M707.985596,1098.275757 C688.642273,1109.299561 669.273499,1120.278809 649.961304,1131.356812 C616.268066,1150.684448 582.601135,1170.058105 548.939514,1189.440918 C526.323425,1202.463379 503.680634,1215.440674 481.153290,1228.615234 C464.812622,1238.171875 442.888977,1236.842773 429.660736,1225.171021 C413.332520,1210.763794 408.560883,1191.014648 416.835876,1171.967651 C458.874298,1075.205688 500.913940,978.444153 542.963440,881.686951 C583.817871,787.679565 624.699951,693.684204 665.529053,599.665771 C671.380615,586.191162 681.000549,576.917969 695.215637,572.960754 C698.969604,571.915771 703.108154,572.252441 707.527222,572.474731 C707.984741,748.088440 707.985168,923.182068 707.985596,1098.275757z"/><path fill="#F56568" d="M708.263672,1098.452148 C707.985168,923.182068 707.984741,748.088440 707.981567,572.530945 C723.690674,570.855591 740.974609,582.015869 748.093933,598.283508 C762.495178,631.190430 776.757996,664.157898 791.081543,697.098694 C823.043579,770.604004 855.015137,844.105225 886.968018,917.614563 C899.828613,947.201050 912.631531,976.812622 925.493591,1006.398438 C949.338867,1061.248291 973.180847,1116.099487 997.079346,1170.926025 C1008.930359,1198.113892 994.624023,1227.342163 966.153687,1233.567993 C952.263794,1236.605469 940.130798,1231.951416 928.216003,1225.023193 C880.917236,1197.519775 833.427551,1170.344727 785.995544,1143.070557 C760.191284,1128.232910 734.360596,1113.440918 708.263672,1098.452148z"/></svg>';
    this.vmObj=new maplibregl.Marker({element:el,anchor:'center',pitchAlignment:'map',rotationAlignment:'map'}).setLngLat([12.4964,41.9028]);

    this.map.once('style.load', () => {
      this.map.setProjection({ type: 'globe' });
      this.ensureGlobalLabels();
    });

    this.map.on('dataloading', (e) => {
      if(e.dataType==='tile') this.map.getCanvas().classList.add('map-loading');
    });
    this.map.on('idle', () => {
       this.map.getCanvas().classList.remove('map-loading');
    });

    this.map.on('load', () => { this.onLoad(); this.startLoop(); });
    this.map.on('style.load', () => {
      this.map.setProjection({ type: 'globe' });
      this.ensureGlobalLabels();
    });

    ['mousedown','touchstart','dragstart'].forEach(e=>this.map.on(e,()=>this.startInt()));['mouseup','touchend','dragend'].forEach(e=>this.map.on(e,()=>this.startRecTimer()));
    this.map.on('wheel', () => { this.startInt(); this.startRecTimer(); });
    this.map.on('moveend', () => this.schedHide());
    this.map.on('rotate', () => this.updCompass());
    this.initEvents(); this.initSearch();
    lucide.createIcons(); this.startGPS();
    setInterval(() => { if(this.mapMode==='auto') this.setMapM('auto'); }, 300000);
  }

  startLoop(){var lt=performance.now();var lp=t=>{var dt=Math.min(t-lt,100)/1000;lt=t;this.frame(dt);requestAnimationFrame(lp);};requestAnimationFrame(lp);}

  frame(dt){
    if(!this.tgt)return;
    if(!this.rpos){this.rpos={lat:this.tgt.lat,lng:this.tgt.lng};this.mbear=this.tbear;this.cbear=this.tbear;}
    var ideal=DR.est()||this.tgt;
    var pa=1-Math.exp(-4*dt);
    var dl=ideal.lat-this.rpos.lat,dn=ideal.lng-this.rpos.lng,dm=Math.sqrt(dl*dl+dn*dn)*111320;
    if(dm>0.1||this.spd>0.3){this.rpos.lat+=dl*pa;this.rpos.lng+=dn*pa;}
    var fused=IMU.heading(); var tb=fused!==null?fused:this.tbear;
    var mk=this.spd>0.8?3.5:0;
    if(mk>0){var md=tb-this.mbear;md=((md+540)%360)-180;this.mbear=(this.mbear+md*(1-Math.exp(-mk*dt))+360)%360;}
    var ck=this.spd>0.8?1.0:0;
    if(ck>0){var cd=tb-this.cbear;cd=((cd+540)%360)-180;this.cbear=(this.cbear+cd*(1-Math.exp(-ck*dt))+360)%360;}
    this.vmObj.setLngLat([this.rpos.lng,this.rpos.lat]);
    this.vmObj.setRotation(this.mbear);
    this.updCompass();
    
    // JumpTo viene chiamato SOLO se la mappa non sta già volando/eseguendo un'animazione fluida
    if(this.follow&&!this.interact&&!this.flying&&!this.wVis){
      var b=this.cmode==='heading-up'?this.cbear:0;
      this.map.jumpTo({center:[this.rpos.lng,this.rpos.lat],bearing:b});
    }
    if(this.naving&&this.steps.length)this.updPanel();
    if(this.naving&&this.geo&&this.rpos)this.updConsumed();
  }

  onLoad(){
    try { this.map.setProjection({type:'globe'}); } catch(e){}

    if(!this.map.getSource('route'))this.map.addSource('route',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    if(!this.map.getLayer('r-glow'))this.map.addLayer({id:'r-glow',type:'line',source:'route',filter:['==',['get','consumed'],false],paint:{'line-color':'rgba(59,130,246,.3)','line-width':14,'line-blur':6},layout:{'line-cap':'round','line-join':'round'}});
    if(!this.map.getLayer('r-line'))this.map.addLayer({id:'r-line',type:'line',source:'route',filter:['==',['get','consumed'],false],paint:{'line-color':'#3B82F6','line-width':7},layout:{'line-cap':'round','line-join':'round'}});
    if(!this.map.getLayer('r-cons'))this.map.addLayer({id:'r-cons',type:'line',source:'route',filter:['==',['get','consumed'],true],paint:{'line-color':'rgba(90,90,100,.55)','line-width':7},layout:{'line-cap':'round','line-join':'round'}});
    ['A','B'].forEach(s=>{
      var si='w-'+s,li='wl-'+s;
      if(!this.map.getSource(si))this.map.addSource(si,{type:'raster',tiles:[],tileSize:256,minzoom:0,maxzoom:24});
      if(!this.map.getLayer(li)){
        var bef=this.map.getLayer('r-glow')?'r-glow':undefined;
        this.map.addLayer({id:li,type:'raster',source:si,paint:{'raster-opacity':0,'raster-fade-duration':400}},bef);
      }
    });

    if(this.map.getLayer('sat-layer')) {
      this.map.setPaintProperty('sat-layer', 'raster-fade-duration', 400);
    }
    this.ensureGlobalLabels();
    this.vmObj.addTo(this.map);
    try{window.parent.postMessage({type:'MAP_IFRAME_READY'},'*');}catch(e){}
  }

  startGPS(){
    var done=false;
    document.addEventListener('touchstart',()=>{if(!done){done=true;IMU.init();}},{once:true,passive:true});
    navigator.geolocation.watchPosition(p=>{
      var now=performance.now(),nla=p.coords.latitude,nlo=p.coords.longitude,gs=p.coords.speed,gh=p.coords.heading,df=0;
      if(this.lastGpsPos){df=this.dist(this.lastGpsPos.lat,this.lastGpsPos.lng,nla,nlo);var dts=(now-this.lastGpsPos.ts)/1000;if((gs===null||gs<0)&&dts>0)gs=df/dts;}
      var spd=gs||0;this.spd=spd;
      if(spd<0.5&&df<2&&this.tgt){this.lgps=now;return;}
      var nb=this.tbear;
      if(gh!==null&&!isNaN(gh)&&gh>=0)nb=gh;
      else if(this.tgt&&df>1.5&&spd>0.5)nb=this.bear(this.tgt.lat,this.tgt.lng,nla,nlo);
      this.tbear=nb;this.tgt={lat:nla,lng:nlo};this.lgps=now;this.lastGpsPos={lat:nla,lng:nlo,ts:now};
      DR.upd(nla,nlo,spd,nb);if(nb!==null&&!isNaN(nb))IMU.updGPS(nb);
      if(!this.autoZoomed){
        this.autoZoomed=true;this.follow=true;
        this.map.flyTo({center:[nlo,nla],zoom:this.ZN,duration:3500,speed:.6,essential:true});
        this.map.once('moveend',()=>{this.flying=false;});
        this.flying=true;
      }
      var dn=Date.now();if(dn-this.lastRev>this.REV_INT){this.lastRev=dn;this.updStreet(nla,nlo);}
      if(this.pendDest){var pd=this.pendDest;this.pendDest=null;this.setDest(pd.coords,pd.name,pd.sn);}
      if(this.naving&&this.dest)this.checkDev();
    },err=>{this.toast('Errore GPS','map-pin-off');},{enableHighAccuracy:true,timeout:5000,maximumAge:0});
  }

  updPanel(){
    if(!this.rpos||!this.steps.length)return;
    if(this.navState===NS.R){
      document.getElementById('nav-dist').textContent='---';
      document.getElementById('nav-instr').textContent='Ricalcolo percorso...';
      document.getElementById('nav-svg').innerHTML='';
      return;
    }
    this.updStepByPos();
    var step=this.steps[this.si];if(!step)return;
    var loc=step.maneuver.location;
    var dtm=this.dist(this.rpos.lat,this.rpos.lng,loc[1],loc[0]);
    var key=getKey(step); var instr=this.buildInstr(step);
    document.getElementById('nav-dist').textContent=fd(dtm);
    document.getElementById('nav-instr').textContent=instr;
    document.getElementById('nav-svg').innerHTML=drawArrow(key);
    
    if(this.remTime>0){
      var eta=new Date(Date.now()+this.remTime*1000);
      document.getElementById('nb-eta').textContent=eta.getHours().toString().padStart(2,'0')+':'+eta.getMinutes().toString().padStart(2,'0');
      document.getElementById('nb-min').textContent=Math.round(this.remTime/60)+' min';
      document.getElementById('nb-km').textContent=((this.remDist/1000).toFixed(1))+' km';
    }
    
    this.updProxMark(dtm,step,key);
    if(this.cmode==='heading-up'&&this.follow)this.handleIZoom(dtm,key);
    if(this.expanded) this.renderList();
  }

  handleIZoom(dist,key){
    var isInt=key!=='straight'&&key!=='depart'&&key!=='arrive';
    if(isInt&&dist<this.IDIST&&!this.izActive){this.izActive=true;this.map.easeTo({zoom:this.ZI,duration:1800,easing:t=>t<.5?2*t*t:-1+(4-2*t)*t});}
    else if((!isInt||dist>this.IDIST*1.6)&&this.izActive){this.izActive=false;this.map.easeTo({zoom:this.ZH,duration:2000,easing:t=>t<.5?2*t*t:-1+(4-2*t)*t});}
  }

  updProxMark(dist,step,key){
    var loc=step.maneuver.location;
    var show=dist<200&&dist>8&&key!=='straight'&&key!=='depart';
    if(show){
      var isNear=dist<80;
      if(this.proxMark&&this.proxStep===this.si){
        var el=this.proxMark.getElement();el.classList.toggle('near',isNear);return;
      }
      if(this.proxMark){this.proxMark.remove();this.proxMark=null;}
      var el=document.createElement('div');
      el.className='map-pin-arrow'+(isNear?' near':'');
      el.innerHTML="\\x3Csvg viewBox=\"0 -960 960 960\" fill=\"#3B82F6\" stroke=\"none\">"+drawArrow(key)+"\\x3C/svg>";
      this.proxMark=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([loc[0],loc[1]]).addTo(this.map);
      this.proxStep=this.si;
    } else {
      if(this.proxMark){this.proxMark.remove();this.proxMark=null;this.proxStep=-1;}
    }
  }

  toggleList(){
    this.expanded=!this.expanded;
    var p=document.getElementById('nav-top');
    if(this.expanded){this.renderList();p.classList.add('exp');}
    else{p.classList.remove('exp');}
  }

  renderList(){
    var list=document.getElementById('mnv-list');
    if(!this.steps||!this.steps.length){list.innerHTML='';return;}
    var html='';
    this.steps.forEach((step,idx)=>{
      if(!step||!step.maneuver||step.maneuver.type==='arrive') return;
      var k=getKey(step), instr=this.buildInstr(step,false);
      var done=idx<this.si;
      var cls='mi'+(done?' done':'');
      var distLbl='';
      if(!done){var cum=0;for(var s=this.si;s<idx;s++)if(this.steps[s])cum+=this.steps[s].distance||0;distLbl=fd(cum);}
      html+="<div class=\""+cls+"\"><div class=\"mi-box\">\\x3Csvg class=\"mi-svg\" viewBox=\"0 -960 960 960\" stroke=\"none\">"+drawArrow(k)+"\\x3C/svg></div><div class=\"mi-txt\">"+(distLbl?"<div class=\"mi-d\">"+distLbl+"</div>":"")+"<div class=\"mi-n\">"+esc(instr)+"</div></div></div>";
    });
    html+="<div class=\"mi-dest\"><div class=\"mi-dpin\">\\x3Csvg xmlns=\"http://www.w3.org/2000/svg\" enable-background=\"new 0 0 24 24\" height=\"24px\" viewBox=\"0 0 24 24\" width=\"24px\" fill=\"#e3e3e3\">\\x3Cg>\\x3Crect fill=\"none\" height=\"24\" width=\"24\"/>\\x3C/g>\\x3Cg>\\x3Cpath d=\"M12,2c-4.2,0-8,3.22-8,8.2c0,3.18,2.45,6.92,7.34,11.23c0.38,0.33,0.95,0.33,1.33,0C17.55,17.12,20,13.38,20,10.2 C20,5.22,16.2,2,12,2z M12,12c-1.1,0-2-0.9-2-2c0-1.1,0.9-2,2-2c1.1,0,2,0.9,2,2C14,11.1,13.1,12,12,12z\"/>\\x3C/g>\\x3C/svg></div><div><div class=\"mi-dlbl\">"+esc(this.destName)+"</div></div></div>";
    list.innerHTML=html;
  }

  updStepByPos(){
    if(!this.rpos||!this.steps.length||!this.geo||this.geo.length<2)return;
    var pos=this.rpos,g=this.geo,minD=Infinity,ni=0;
    var st=Math.max(0,this.nearIdx-10);
    for(var i=st;i<g.length;i++){var d=this.dist(pos.lat,pos.lng,g[i][1],g[i][0]);if(d<minD){minD=d;ni=i;}if(d>minD+300)break;}
    this.nearIdx=ni;
    var distTrav=0;for(var i=0;i<ni;i++)distTrav+=this.dist(g[i][1],g[i][0],g[i+1][1],g[i+1][0]);
    var best=this.si;
    for(var s=0;s<this.steps.length-1;s++){if((this.steps[s]._dfs||0)<distTrav-30)best=s+1;else break;}
    if(best!==this.si){var old=this.si;this.si=Math.min(best,this.steps.length-1);if(this.si!==old)this.speak();}
  }

  buildInstr(step,short=false){
    if(!step)return'';
    var t=(step.maneuver.type||'').toLowerCase(),m=(step.maneuver.modifier||'').toLowerCase();
    var name=step.name||'',ref=step.ref||'',road=name||(ref||'');
    var ex=step.maneuver.exit;
    var IT={right:'a destra','slight right':'leggermente a destra','sharp right':'nettamente a destra',left:'a sinistra','slight left':'leggermente a sinistra','sharp left':'nettamente a sinistra',straight:'dritto',uturn:'inversione a U'};
    if(t==='depart')return road?'Verso '+road:'Parti';
    if(t==='arrive')return'Arrivo';
    if(t==='roundabout'||t==='rotary'){var ex2=ex?' - '+ex+'ª uscita':'';return'Rotonda'+ex2+(road?' su '+road:'');}
    if(t==='exit roundabout'||t==='exit rotary')return'Esci'+(road?' su '+road:'');
    if(t==='merge')return'Immettiti'+(road?' su '+road:'');
    if(t==='on ramp')return'Rampa'+(road?' per '+road:'');
    if(t==='off ramp')return'Uscita'+(road?' per '+road:'');
    if(t==='fork'){var fd2=IT[m]?'Tieni '+IT[m]:'Tieni la destra/sinistra';return fd2+(road?' su '+road:'');}
    if(t==='turn'){if(m==='uturn')return'Inversione a U';if(m==='straight')return road?'Prosegui su '+road:'Prosegui dritto';var td=IT[m]||'';if(!td)return road?'Vai su '+road:'Svolta';return'Svolta '+td+(road?' su '+road:'');}
    if(t==='new name')return road?'Su '+road:'Prosegui';
    if(t==='continue')return road?'Continua su '+road:'Continua';
    return road?road:'Prosegui';
  }

  speak(){
    if(!window.speechSynthesis)return;
    var step=this.steps[this.si];if(!step)return;
    var u=new SpeechSynthesisUtterance(this.buildInstr(step,false));u.lang='it-IT';u.rate=.9;
    window.speechSynthesis.cancel();window.speechSynthesis.speak(u);
  }

  updConsumed(){
    if(!this.geo||!this.rpos||!this.map.getSource('route'))return;
    var now=performance.now();if(now-this.lcUpd<100)return;this.lcUpd=now;
    var g=this.geo,pos=this.rpos;
    var best=this.projLine(pos,g);if(!best)return;
    var pp=best.point,idx=best.idx,t=best.t;
    var con=g.slice(0,idx+1);if(t<1&&con.length>0)con[con.length-1]=pp;
    var upc=[pp,...g.slice(idx+1)];
    con=this.clean(con);upc=this.clean(upc);
    var f=[];
    if(con.length>=2)f.push({type:'Feature',properties:{consumed:true},geometry:{type:'LineString',coordinates:con}});
    if(upc.length>=2)f.push({type:'Feature',properties:{consumed:false},geometry:{type:'LineString',coordinates:upc}});
    this.map.getSource('route').setData({type:'FeatureCollection',features:f});
    var rem=0;for(var j=idx;j<g.length-1;j++)rem+=this.dist(g[j][1],g[j][0],g[j+1][1],g[j+1][0]);
    if(idx<g.length-1){var sd=this.dist(g[idx][1],g[idx][0],g[idx+1][1],g[idx+1][0]);rem-=sd*t;}
    this.remDist=rem;this.remTime=rem/Math.max(this.spd,8);
  }

  projLine(pos,line){
    var mn=Infinity,best=null;
    var st=Math.max(0,this.nearIdx-5),en=Math.min(line.length,this.nearIdx+40);
    for(var i=st;i<en-1;i++){var d=this.ptSeg(pos.lat,pos.lng,line[i][1],line[i][0],line[i+1][1],line[i+1][0]);if(d.dist<mn){mn=d.dist;best={point:[d.lng,d.lat],idx:i,t:d.t};}}
    if(mn>50)for(var i=0;i<line.length-1;i++){var d=this.ptSeg(pos.lat,pos.lng,line[i][1],line[i][0],line[i+1][1],line[i+1][0]);if(d.dist<mn){mn=d.dist;best={point:[d.lng,d.lat],idx:i,t:d.t};}}
    return best;
  }
  ptSeg(pLa,pLo,aLa,aLo,bLa,bLo){var x=pLo,y=pLa,x1=aLo,y1=aLa,x2=bLo,y2=bLa,A=x-x1,B=y-y1,C=x2-x1,D=y2-y1,dot=A*C+B*D,len=C*C+D*D,p=len?dot/len:0;var xx,yy;if(p<0){xx=x1;yy=y1;}else if(p>1){xx=x2;yy=y2;}else{xx=x1+p*C;yy=y1+p*D;}var dx=x-xx,dy=y-yy;return{dist:Math.sqrt(dx*dx+dy*dy)*111320,lat:yy,lng:xx,t:p};}
  clean(c){var r=[];for(var i=0;i<c.length;i++)if(i===0||c[i][0]!==c[i-1][0]||c[i][1]!==c[i-1][1])r.push(c[i]);return r;}

  checkDev(){
    if(!this.tgt||!this.geo||this.recalcCD)return;
    var pos=this.tgt,mn=Infinity;
    var st=Math.max(0,this.nearIdx-5),en=Math.min(this.geo.length,st+50);
    for(var i=st;i<en;i++){var d=this.dist(pos.lat,pos.lng,this.geo[i][1],this.geo[i][0]);if(d<mn)mn=d;}
    if(mn>50)for(var i=0;i<this.geo.length;i++){var d=this.dist(pos.lat,pos.lng,this.geo[i][1],this.geo[i][0]);if(d<mn)mn=d;}
    if(mn>35){this.devCnt=(this.devCnt||0)+1;if(this.devCnt>=2){this.devCnt=0;this.recalcCD=true;this.navState=NS.R;this.toast('Ricalcolo percorso...','refresh-cw');this.fetchRoute(this.tgt,this.dest);setTimeout(()=>{this.recalcCD=false;},15000);}}
    else{this.devCnt=0;if(this.navState===NS.R)this.navState=NS.E;}
  }

  async setDest(coords,name,sn){
    this.clearRoute(true); // Cancella i dati vecchi senza chiudere l'interfaccia
    this.activeFetchId++;
    this.dest=coords;this.destName=name||'Destinazione';
    
    document.getElementById('nav-box').classList.add('hidden');
    document.getElementById('nav-top').classList.add('active');
    document.getElementById('nav-bottom').classList.add('active');
    document.getElementById('nb-dest').textContent = this.destName;

    var el=document.createElement('div'); el.className='dest-pin';
    el.innerHTML = "\\x3Csvg width=\"48\" height=\"64\" viewBox=\"0 0 24 24\">\\x3Cellipse cx=\"12\" cy=\"22.5\" rx=\"5\" ry=\"1.5\" fill=\"rgba(0,0,0,.2)\"/>\\x3Cg>\\x3Cpath d=\"M12,2c-4.2,0-8,3.22-8,8.2c0,3.18,2.45,6.92,7.34,11.23c0.38,0.33,0.95,0.33,1.33,0C17.55,17.12,20,13.38,20,10.2 C20,5.22,16.2,2,12,2z M12,12c-1.1,0-2-0.9-2-2c0-1.1,0.9-2,2-2c1.1,0,2,0.9,2,2C14,11.1,13.1,12,12,12z\" fill=\"#EF4444\" stroke=\"#FFFFFF\" stroke-width=\"1.2\"/>\\x3C/g>\\x3C/svg>";
    this.destMark=new maplibregl.Marker({element:el,anchor:'bottom',offset:[0,0]}).setLngLat([coords.lng,coords.lat]).addTo(this.map);
    
    var start=this.tgt||this.rpos;
    if(start)this.fetchRoute(start,coords);else this.pendDest={coords,name,sn};
  }

  async fetchRoute(start,end){
    if(!start)return;
    var currentId = this.activeFetchId;
    var url=this.osrm+start.lng+','+start.lat+';'+end.lng+','+end.lat+'?overview=full&geometries=geojson&steps=true&annotations=false';
    try{
      var res=await fetch(url);var data=await res.json();
      if(this.activeFetchId !== currentId) return; // Ignora se nel frattempo l'utente ha cambiato destinazione
      
      if(!data.routes||!data.routes.length)throw new Error();
      var route=data.routes[0];
      this.geo=route.geometry.coordinates;
      this.tripInfo={distance:route.distance,duration:route.duration};
      this.steps=[];var dfs=0;
      route.legs.forEach(leg=>{leg.steps.forEach(step=>{this.steps.push({maneuver:step.maneuver,name:step.name||'',ref:step.ref||'',distance:step.distance||0,duration:step.duration||0,_dfs:dfs});dfs+=step.distance||0;});});
      this.si=0;this.nearIdx=0;this.remDist=route.distance;this.remTime=route.duration;
      this.updRouteMap();
      this.navState=NS.E;
      this.updPanel();

      if(this.geo){
        var bounds=this.geo.reduce((b,c)=>b.extend(c),new maplibregl.LngLatBounds(this.geo[0],this.geo[0]));
        this.map.fitBounds(bounds,{padding:{top:140,bottom:180,left:80,right:80}});
        this.follow=false;
        if(!this.expanded) this.toggleList();
      }

      this.isPendingStart = true;
      if(this.startTrackTimer) clearTimeout(this.startTrackTimer);
      this.startTrackTimer = setTimeout(() => {
          this.startTracking();
      }, 5000);

    }catch(e){
        document.getElementById('nav-instr').textContent='Errore percorso';
    }
  }

  startTracking(){
    if(!this.dest) return;
    this.isPendingStart = false;
    this.naving=true;
    this.toast('Navigazione avviata','navigation');
    if(this.expanded) this.toggleList();
    
    // Imposta lo stato dell'UI a heading-up senza chiamare doppi toggle
    this.cmode = 'heading-up';
    document.getElementById('cn-icon').style.display='none';
    document.getElementById('ch-icon').style.display='flex';
    document.getElementById('btn-compass').classList.add('active');
    document.getElementById('map-ctrls').classList.add('hidden'); // Nasconde i bottoni
    
    // Richiama l'animazione fluida di rientro unificata
    this.smoothRec(); 
  }

  clearRoute(isSoft=false){
    if(this.startTrackTimer) clearTimeout(this.startTrackTimer);
    this.isPendingStart = false;
    this.activeFetchId++; // Invalida le vecchie richieste
    
    this.dest=null;this.geo=null;this.steps=[];this.naving=false;this.si=0;
    this.navState=NS.S;this.nearIdx=0;this.izActive=false;
    if(this.expanded) this.toggleList();
    
    // Distruggi TUTTI i marker vecchi
    if(this.destMark){this.destMark.remove();this.destMark=null;}
    if(this.proxMark){this.proxMark.remove();this.proxMark=null;this.proxStep=-1;}
    if(this.map.getSource('route'))this.map.getSource('route').setData({type:'FeatureCollection',features:[]});
    
    if(!isSoft){
      document.getElementById('nav-top').classList.remove('active');
      document.getElementById('nav-bottom').classList.remove('active');
      document.getElementById('nav-box').classList.remove('hidden');
      document.getElementById('map-ctrls').classList.remove('hidden');
      
      if(this.rpos){
        this.flying=true;
        this.map.flyTo({center:[this.rpos.lng,this.rpos.lat],zoom:this.ZN,bearing:0,duration:1800,essential:true,easing:t=>t<.5?2*t*t:-1+(4-2*t)*t});
        this.map.once('moveend',()=>{
          this.flying=false;this.follow=true;this.cmode='north-up';
          document.getElementById('cn-icon').style.display='flex';
          document.getElementById('ch-icon').style.display='none';
          document.getElementById('btn-compass').classList.remove('active');
        });
      } else {this.follow=true;}
    }
  }

  updRouteMap(){if(!this.geo||!this.map.getSource('route'))return;this.map.getSource('route').setData({type:'FeatureCollection',features:[{type:'Feature',properties:{consumed:false},geometry:{type:'LineString',coordinates:this.geo}}]});}

  toggleCMode(){if(this.map)this.map.stop();this.flying=false;this.setCMode(this.cmode==='heading-up'?'north-up':'heading-up');}
  setCMode(m){
    this.cmode=m;var hu=m==='heading-up';
    document.getElementById('cn-icon').style.display=hu?'none':'flex';
    document.getElementById('ch-icon').style.display=hu?'flex':'none';
    document.getElementById('btn-compass').classList.toggle('active',hu);
    this.smoothRec();this.updCompass();
    this.toast(hu?'Heading Up':'North Up','compass');
  }

  /* Funzione Unificata e Rafforzata per il rientro al veicolo */
  smoothRec(){
    if(!this.rpos)return;
    this.map.stop(); // FIX: ferma ogni slancio/inerzia dell'utente prima di animare
    this.follow = true;
    this.flying = true;
    var tz=this.cmode==='heading-up'?this.ZH:this.ZN;
    var tb=this.cmode==='heading-up'?this.cbear:0;
    var tll=[this.rpos.lng,this.rpos.lat];
    var cc=this.map.getCenter();
    var cZoom=this.map.getZoom();
    
    var d=this.dist(cc.lat,cc.lng,tll[1],tll[0]);
    var zDiff=Math.abs(cZoom - tz);
    
    // FIX: Usa FlyTo (Volare) se sei lontano o se lo zoom è molto diverso (es. panoramica finita)
    var useFlyTo = (d > 2000 || zDiff > 2.5);
    var anim = useFlyTo ? this.map.flyTo : this.map.easeTo;
    var duration = useFlyTo ? Math.min(3500,Math.max(2000,d/10)) : 1500;
    
    anim.call(this.map, {
        center: tll,
        zoom: tz,
        bearing: tb,
        duration: duration,
        essential: true,
        easing: t=>t<.5?2*t*t:-1+(4-2*t)*t
    });
    
    this.map.once('moveend',()=>{this.flying=false;});
  }

  recenter(){
    if(!this.rpos)return;
    if(this.recTimer)clearTimeout(this.recTimer);
    this.smoothRec(); 
    if(this.naving) document.getElementById('map-ctrls').classList.add('hidden');
  }
  
  updCompass(){if(this.cmode==='heading-up'){var el=document.getElementById('cring');if(el)el.style.transform='translate(-50%,-50%) rotate('+(-this.cbear)+'deg)';}}

  startInt(){
    this.flying=false;if(this.follow)this.savedMode=this.cmode;
    this.follow=false;this.interact=true;
    
    if(this.recTimer)clearTimeout(this.recTimer);
    // FIX: Se interagisci durante i 5 secondi iniziali, cancella il timer
    if(this.isPendingStart && this.startTrackTimer) clearTimeout(this.startTrackTimer);
    
    if(this.cmode==='heading-up'){this.cmode='north-up';document.getElementById('cn-icon').style.display='flex';document.getElementById('ch-icon').style.display='none';document.getElementById('btn-compass').classList.remove('active');this.map.easeTo({bearing:0,pitch:0,duration:500,easing:t=>t*(2-t)});}
    
    document.getElementById('map-ctrls').classList.remove('hidden');
    this.showDyn();
  }

  startRecTimer(){
    if(this.recTimer)clearTimeout(this.recTimer);
    this.interact=false;
    
    // FIX: Se hai appena finito di toccare e doveva iniziare il viaggio, fai partire il viaggio dopo 3 sec
    if(this.isPendingStart) {
        this.startTrackTimer = setTimeout(() => this.startTracking(), 3000);
        return;
    }

    this.recTimer=setTimeout(()=>{
      if(this.wVis) return;
      this.follow=true;
      if(this.savedMode==='heading-up') {
          this.cmode='heading-up';
          document.getElementById('cn-icon').style.display='none';
          document.getElementById('ch-icon').style.display='flex';
          document.getElementById('btn-compass').classList.add('active');
      } else {
          this.cmode='north-up';
          document.getElementById('cn-icon').style.display='flex';
          document.getElementById('ch-icon').style.display='none';
          document.getElementById('btn-compass').classList.remove('active');
      }
      this.smoothRec(); // Usa la funzione rafforzata
      
      if(this.naving) document.getElementById('map-ctrls').classList.add('hidden');
      this.hideDyn();
      this.toast('Tracking riattivato','crosshair');
    },20000);
  }

  setMapM(mode){
    this.mapMode=mode;var isSat=mode==='satellite';
    document.getElementById('btn-mapmode').classList.toggle('active',isSat);
    if(isSat){this.map.setMaxZoom(19); if(this.map.getZoom()>19) this.map.easeTo({zoom:19,duration:600});}
    else {this.map.setMaxZoom(20);}
    var th;
    if(isSat){th='satellite';document.body.className='theme-dark';}
    else if(this.extTheme){th=this.extTheme;document.body.className='theme-'+th;}
    else{var h=new Date().getHours();th=h>=6&&h<19?'light':'dark';document.body.className='theme-'+th;}
    this.map.setStyle(this.buildStyle(th));
    this.map.once('style.load',()=>{
      this.map.setProjection({type:'globe'});
      this.ensureGlobalLabels();
      this.onLoad();
      if(this.geo)this.updRouteMap();
    });
  }

  showDyn(){document.getElementById('dyn-ctrl').classList.add('visible');if(this.ctTo)clearTimeout(this.ctTo);}
  hideDyn(){document.getElementById('dyn-ctrl').classList.remove('visible');}
  schedHide(){if(this.wVis)return;this.ctTo=setTimeout(()=>this.hideDyn(), 20000);}

  rUrl(fp){return'https://tilecache.rainviewer.com'+fp+'/256/{z}/{x}/{y}/2/1_1.webp';}
  async toggleWeather(){
    this.wVis=!this.wVis;
    document.getElementById('btn-weather').classList.toggle('active',this.wVis);
    document.getElementById('tl-ctrl').classList.toggle('vis',this.wVis);
    var dc=document.getElementById('dyn-ctrl');
    if(this.wVis)dc.classList.add('force-vis');else dc.classList.remove('force-vis');
    if(this.wVis){
      if(this.rpos){this.follow=false;this.map.flyTo({center:[this.rpos.lng,this.rpos.lat],zoom:6,duration:2000,essential:true});}
      this.stopTL();this.toast('Caricamento Radar...','cloud-rain');
      try{
        var r=await fetch('https://api.rainviewer.com/public/weather-maps.json');var d=await r.json();
        var past=d.radar&&d.radar.past?d.radar.past:[],fut=d.radar&&d.radar.nowcast?d.radar.nowcast:[];
        this.wTs=[...past,...fut];this.wNow=past.length;
        if(!this.wTs.length)throw new Error();
        document.getElementById('tl-slider').max=this.wTs.length-1;
        await this.setWFrame(past.length>0?past.length-1:0);
        this.toast('Radar Attivo','cloud-lightning');this.startTL();
      }catch(e){this.toast('Meteo non disponibile','cloud-off');this.toggleWeather();}
    } else {
      this.stopTL();['A','B'].forEach(s=>{if(this.map.getLayer('wl-'+s))this.map.setPaintProperty('wl-'+s,'raster-opacity',0);});
      this.recenter();
    }
  }
  async setWFrame(idx){
    if(!this.wTs[idx]||this.wSwitch)return;this.wSwitch=true;this.wFr=idx;
    document.getElementById('tl-slider').value=idx;
    var date=new Date(this.wTs[idx].time*1000),isFut=idx>=this.wNow;
    var tt=isFut?'<span style="color:#EF4444;font-weight:700">Previsione</span>':'<span style="color:#3B82F6;font-weight:700">Storico</span>';
    document.getElementById('tl-lbl').innerHTML=tt+' '+date.getHours()+':'+(date.getMinutes()<10?'0':'')+date.getMinutes();
    var tot=this.wTs.length-1,sp=(this.wNow/tot)*100;
    document.getElementById('tl-slider').style.background="linear-gradient(to right,#3B82F6 0%,#3B82F6 "+sp+"%,#EF4444 "+sp+"%,#EF4444 100%)";
    var ns=this.wSlot==='A'?'B':'A',src=this.map.getSource('w-'+ns);
    if(src)src.setTiles([this.rUrl(this.wTs[idx].path)]);
    await new Promise(res=>{if(this.map.isSourceLoaded('w-'+ns)){res();return;}var od=e=>{if(e.sourceId==='w-'+ns&&e.isSourceLoaded){this.map.off('sourcedata',od);res();}};this.map.on('sourcedata',od);setTimeout(()=>{this.map.off('sourcedata',od);res();},400);});
    if(this.map.getLayer('wl-'+ns))this.map.setPaintProperty('wl-'+ns,'raster-opacity',.8);
    if(this.map.getLayer('wl-'+this.wSlot))this.map.setPaintProperty('wl-'+this.wSlot,'raster-opacity',0);
    this.wSlot=ns;this.wSwitch=false;
  }
  startTL(){this.wPlay=true;document.getElementById('tl-pp').innerHTML='<i data-lucide="pause"></i>';lucide.createIcons();this.wInt=setInterval(()=>{this.setWFrame((this.wFr+1)%this.wTs.length);},700);}
  stopTL(){clearInterval(this.wInt);this.wPlay=false;document.getElementById('tl-pp').innerHTML='<i data-lucide="play"></i>';lucide.createIcons();}

  bear(la1,lo1,la2,lo2){var d=(lo2-lo1)*Math.PI/180,y=Math.sin(d)*Math.cos(la2*Math.PI/180),x=Math.cos(la1*Math.PI/180)*Math.sin(la2*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.cos(d);return(Math.atan2(y,x)*180/Math.PI+360)%360;}
  dist(la1,lo1,la2,lo2){var R=6371e3,p1=la1*Math.PI/180,p2=la2*Math.PI/180,dp=(la2-la1)*Math.PI/180,dl=(lo2-lo1)*Math.PI/180,a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
  async updStreet(lat,lng){try{var r=await fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json&zoom=18');var d=await r.json();var a=d.address||{},s=a.road||a.pedestrian||a.footway||a.path||'';var el=document.getElementById('street-box');if(s){document.getElementById('street-txt').textContent=s;el.classList.add('vis');}else el.classList.remove('vis');}catch(e){}}
  toast(text,icon){var t=document.getElementById('toast');document.getElementById('toast-txt').textContent=text;document.getElementById('toast-icon').setAttribute('data-lucide',icon);t.classList.add('show');lucide.createIcons();setTimeout(()=>t.classList.remove('show'),3000);}

  loadR(){try{var r=localStorage.getItem('rec_dest');return r?JSON.parse(r):[]}catch(e){return[];}}
  saveR(){try{localStorage.setItem('rec_dest',JSON.stringify(this.recents));}catch(e){}}
  addR(p){this.recents=[p,...this.recents.filter(r=>!(r.name===p.name&&Math.abs(r.lat-p.lat)<.0001))].slice(0,5);this.saveR();}
  hl(text,q){if(!text||!q)return esc(text||'');var e2=esc(text),pts=q.trim().split(/\s+/).filter(p=>p.length>0);if(!pts.length)return e2;var reg=pts.map(p=>p.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&')).join('|');return e2.replace(new RegExp('('+reg+')','gi'),'<strong>$1</strong>');}

  initSearch(){
    var inp=document.getElementById('nav-inp'),res=document.getElementById('nav-res'),clr=document.getElementById('nav-clr');
    var ar=()=>{inp.style.height='auto';inp.style.height=inp.scrollHeight+'px';};
    var sr=(show)=>{show?res.classList.add('show'):res.classList.remove('show');};
    inp.addEventListener('input',()=>{
      ar();var q=inp.value.trim();clr.style.display=q?'block':'none';
      if(q.length<2){sr(false);return;}
      if(this.sTimer)clearTimeout(this.sTimer);
      res.innerHTML='<div class="nav-load">Ricerca...</div>';sr(true);
      this.sTimer=setTimeout(()=>this.doSearch(q,res,inp.value.trim()),300);
    });
    inp.addEventListener('focus',()=>{sr(true);if(!inp.value.trim())this.rendRec(res);});
    inp.addEventListener('blur',()=>{setTimeout(()=>{if(!document.getElementById('nav-box').contains(document.activeElement))sr(false);},200);});
    inp.addEventListener('keydown',e=>e.stopPropagation());
    clr.addEventListener('mousedown',e=>{e.preventDefault();inp.value='';clr.style.display='none';ar();this.rendRec(res);sr(true);inp.focus();});
    
    document.getElementById('btn-home').addEventListener('mousedown',e=>{e.preventDefault();var h=this.homeLocation;if(h)this.selPlace(h.lat,h.lng,h.name,'');else this.toast('Home non impostata','home');});
    document.getElementById('btn-work').addEventListener('mousedown',e=>{e.preventDefault();var w=this.workLocation;if(w)this.selPlace(w.lat,w.lng,w.name,'');else this.toast('Work non impostato','briefcase');});
  }

  rendRec(container){
    if(!this.recents||!this.recents.length){container.innerHTML='';return;}
    var html='<div class="nsh">Recenti</div>';
    this.recents.forEach((r,i)=>{html+="<button class=\"nri\" data-idx=\""+i+"\" data-t=\"r\"><div class=\"nri-ico\">\\x3Ci data-lucide=\"clock\" style=\"width:20px;height:20px\">\\x3C/i></div><div class=\"nri-inf\"><div class=\"nri-name\">"+esc(r.name)+"</div>"+(r.address?"<div class=\"nri-addr\">"+esc(r.address)+"</div>":"")+"</div></button>";});
    container.innerHTML=html;lucide.createIcons();
    container.querySelectorAll('[data-t=r]').forEach(b=>{b.addEventListener('mousedown',e=>{e.preventDefault();var r=this.recents[parseInt(b.dataset.idx)];this.selPlace(r.lat,r.lng,r.name,r.address||'');});});
  }

  async doSearch(query,container,raw){
    try{
      if(raw.length<2){container.innerHTML='';return;}
      var results=await this.sGeo(raw);
      if(results.length<2){
        var nom=await this.sNom(raw);
        nom.forEach(n=>{
          if(n.name.length<2)return;
          if(!results.some(r=>Math.abs(r.lat-n.lat)<.001&&Math.abs(r.lng-n.lng)<.001))results.push(n);
        });
      }
      if(!results.length){container.innerHTML='<div class="nav-load">Nessun risultato</div>';return;}
      results.forEach(r=>{
        if(this.rpos){r.dk=this.dist(this.rpos.lat,this.rpos.lng,r.lat,r.lng)/1000;r.em=(r.dk/(r.dk>200?80:r.dk>30?60:40))*60;}
        r.isShop=r.address&&(r.address.includes('via')||r.address.includes('strada')||r.address.includes('piazza'));
      });
      if(this.rpos)results.sort((a,b)=>{var an=a.name&&a.name!==a.address,bn=b.name&&b.name!==b.address;if(an&&!bn)return-1;if(!an&&bn)return 1;return(a.dk||9999)-(b.dk||9999);});
      var html='';
      results.slice(0,10).forEach((r,i)=>{
        var dh=r.dk!==undefined?"<div class=\"nri-meta\"><div class=\"nri-dist\">"+r.dk.toFixed(1)+" km</div>"+(r.em?"<div class=\"nri-time\">~"+Math.round(r.em)+" min</div>":"")+"</div>":'';
        var iconC=r.isShop?'shop':'';
        var ico=r.isShop?'shopping-bag':'map-pin';
        html+="<button class=\"nri "+iconC+"\" data-idx=\""+i+"\"><div class=\"nri-ico\">\\x3Ci data-lucide=\""+ico+"\" style=\"width:20px;height:20px\">\\x3C/i></div><div class=\"nri-inf\"><div class=\"nri-name\">"+this.hl(r.name,raw)+"</div>"+(r.address?"<div class=\"nri-addr\">"+this.hl(r.address,raw)+"</div>":"")+"</div>"+dh+"</button>";
      });
      container.innerHTML=html;lucide.createIcons();
      var fins=results.slice(0,10);
      container.querySelectorAll('.nri').forEach(b=>{b.addEventListener('mousedown',e=>{e.preventDefault();var r=fins[parseInt(b.dataset.idx)];this.selPlace(r.lat,r.lng,r.name,r.address||'');});});
    }catch(e){container.innerHTML='<div class="nav-load">Errore ricerca</div>';}
  }

  async sGeo(q){
    try{var p=this.rpos,b=p?'&bias=proximity:'+p.lng+','+p.lat:'';var r=await fetch('https://api.geoapify.com/v1/geocode/autocomplete?text='+encodeURIComponent(q)+'&lang=it&limit=10&filter=countrycode:it'+b+'&apiKey='+this.gk);if(!r.ok)return[];var d=await r.json();return(d.features||[]).map(f=>{var p2=f.properties,nm=p2.name||(p2.street?p2.street+(p2.housenumber?' '+p2.housenumber:''):'')||p2.formatted||'',ad=p2.address_line2||[p2.city||p2.town||p2.village,p2.state].filter(Boolean).join(', ')||'';return{lat:p2.lat,lng:p2.lon,name:nm,address:ad};}).filter(r=>r.lat&&r.lng&&r.name);}catch(e){return[];}
  }
  async sNom(q){
    try{var p=this.rpos,v=p?'&viewbox='+(p.lng-.5)+','+(p.lat+.3)+','+(p.lng+.5)+','+(p.lat-.3)+'&bounded=0':'';var r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(q)+'&format=jsonv2&limit=6&addressdetails=1&countrycodes=it'+v);if(!r.ok)return[];var d=await r.json();return(d||[]).map(i=>{var a=i.address||{},nm=i.name||a.road||a.amenity||a.shop||i.display_name.split(',')[0]||'';var pts=[];if(a.house_number&&a.road)pts.push(a.road+' '+a.house_number);else if(a.road)pts.push(a.road);if(a.city||a.town||a.village)pts.push(a.city||a.town||a.village);return{lat:parseFloat(i.lat),lng:parseFloat(i.lon),name:nm,address:pts.join(', ')};}).filter(r=>r.lat&&r.lng&&r.name);}catch(e){return[];}
  }
  selPlace(lat,lng,name,addr){
    this.addR({lat,lng,name,address:addr});
    var inp=document.getElementById('nav-inp');inp.value='';inp.style.height='auto';
    document.getElementById('nav-clr').style.display='none';
    document.getElementById('nav-res').classList.remove('show');
    inp.blur();
    this.setDest({lat,lng},name,false);
  }

  initEvents(){
    document.getElementById('btn-compass').addEventListener('click',()=>this.toggleCMode());
    document.getElementById('btn-recenter').addEventListener('click',()=>this.recenter());
    document.getElementById('btn-mapmode').addEventListener('click',()=>this.setMapM(this.mapMode==='auto'?'satellite':'auto'));
    document.getElementById('btn-weather').addEventListener('click',()=>this.toggleWeather());
    document.getElementById('tl-pp').addEventListener('click',()=>this.wPlay?this.stopTL():this.startTL());
    document.getElementById('tl-slider').addEventListener('input',e=>{this.stopTL();this.setWFrame(parseInt(e.target.value));});
    document.getElementById('nb-stop').addEventListener('click',()=>this.clearRoute());
    document.getElementById('nav-chev').addEventListener('click',()=>this.toggleList());
    document.getElementById('nav-row').addEventListener('click',()=>this.toggleList());
  }
}

window.teslaNav=new Nav();
if(window.pendingNavMsg){var pm=window.pendingNavMsg;window.pendingNavMsg=null;var pp=pm.payload;setTimeout(()=>window.teslaNav.setDest({lat:pp.lat,lng:pp.lng},pp.name,false),500);}

} catch(e) {
  document.body.innerHTML = '<div style="color:red;font-size:20px;padding:20px;z-index:9999;position:absolute;background:black;">Error: ' + e.message + '<br/>' + e.stack + '</div>';
}
} // end initApp
</script>

</body>
</html>

`

const MapsContainer = React.memo(({ 
    isOpen, 
    onClose,
    searchPanelWidth,
    searchPanelTop,
    spotifyPlayerTop,
    spotifyPlayerBottom,
    satelliteLabelBrightness,
    satelliteLabelOutlineWidth,
    onDragProgress,
    onInteractionStart,
    width,
    widgetBgColor,
    dayPlayerButtonColor,
    nightPlayerButtonColor,
    darkNavigateInputBg,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    searchPanelWidth: number;
    searchPanelTop: number;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
    satelliteLabelBrightness: number;
    satelliteLabelOutlineWidth: number;
    onDragProgress?: (progress: number | null) => void;
    onInteractionStart?: () => void;
    width: number;
    widgetBgColor: string;
    dayPlayerButtonColor: string;
    nightPlayerButtonColor: string;
    darkNavigateInputBg: string;
}) => {
  const {
    navigationTarget,
    currentPosition,
    homeLocation,
    workLocation,
    handleSelectDestination: onSelectDestination,
  } = useNavigation();

  const { useDarkTheme: isNight } = useWeather();

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const physics = useRef({
      currentX: 100,
      targetX: 100,
      startX: 100,
      animStartTime: 0,
      isDragging: false,
      isInteracting: false,
      dragStartX: 0,
      dragStartCurrentX: 0,
      panelWidth: 0,
      animationId: 0
  });

  const ANIMATION_SPEED = 0.18; 
  const CLOSE_THRESHOLD_PERCENT = 25;

  const finalMapHtml = useMemo(() => {
    const dynamicStyles = `
      <style>
        /* DYNAMIC LABEL OVERRIDE */
        #labels-canvas {
            filter: brightness(${satelliteLabelBrightness}) saturate(0) drop-shadow(0 0 ${satelliteLabelOutlineWidth}px rgba(0,0,0,1)) !important;
        }
      </style>
    `;
    return mapHtmlContent.replace('</head>', `${dynamicStyles}</head>`);
  }, [satelliteLabelBrightness, satelliteLabelOutlineWidth]);

  const postMessageToIframe = useCallback((message: object) => {
    if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(message, '*');
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'MAP_IFRAME_READY' && !isIframeReady) {
            setIsIframeReady(true);
        }
        if (event.data?.type === 'MAP_CLICKED') {
             // Blur any active input (Close keyboard)
             if (document.activeElement instanceof HTMLElement) {
                 document.activeElement.blur();
             }
        }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isIframeReady]);

  useEffect(() => {
    if (isOpen && navigationTarget && isIframeReady) {
        postMessageToIframe({ type: 'SET_DESTINATION', payload: navigationTarget });
    }
  }, [isOpen, navigationTarget, isIframeReady, postMessageToIframe]);

  // Sync effect: When navigation ends (navigationTarget becomes null), ensure iframe clears route.
  useEffect(() => {
    if (navigationTarget === null && isIframeReady) {
        postMessageToIframe({ type: 'CLEAR_ROUTE_FROM_PARENT' });
    }
  }, [navigationTarget, isIframeReady, postMessageToIframe]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!isOpen || !iframe) return;

    const applyTheme = () => {
        const navInstance = (iframe.contentWindow as any)?.teslaNav;
        if (navInstance?.setExternalTheme) {
            navInstance.setExternalTheme(isNight ? 'dark' : 'light');
        }
    };

    if (iframe.contentDocument?.readyState === 'complete') {
        applyTheme();
    } else {
        const handleLoad = () => applyTheme();
        iframe.addEventListener('load', handleLoad, { once: true });
        return () => iframe.removeEventListener('load', handleLoad);
    }
  }, [isOpen, isNight]);

  useEffect(() => {
    const update = () => {
        const state = physics.current;
        const panel = panelRef.current;

        if (!state.isDragging) {
            if (state.animStartTime > 0) {
                const elapsed = performance.now() - state.animStartTime;
                const duration = 400; // ms
                const t = Math.min(elapsed / duration, 1.0);
                // power4.out easing
                const easeT = 1 - Math.pow(1 - t, 4);
                state.currentX = state.startX + (state.targetX - state.startX) * easeT;
            } else {
                state.currentX = state.targetX;
            }
        }

        if (state.isInteracting) {
            let visualProgress = state.currentX / 100;
            visualProgress = Math.max(0, Math.min(1, visualProgress));
            
            onDragProgress?.(visualProgress);

            if (!state.isDragging && Math.abs(state.targetX - state.currentX) < 0.5) {
                state.isInteracting = false;
                onDragProgress?.(null);
            }
        }

        if (panel) {
            let visualX = state.currentX;
            if (!state.isDragging) {
                if (visualX < 0.01) visualX = 0;
                if (visualX > 99.9) visualX = 100;
            }
            panel.style.transform = `translateX(${visualX}%)`;
        }

        state.animationId = requestAnimationFrame(update);
    };

    physics.current.animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(physics.current.animationId);
  }, [onDragProgress]);

  useEffect(() => {
    const state = physics.current;
    if (!state.isDragging) {
        const newTargetX = isOpen ? 0 : 100;
        if (state.targetX !== newTargetX || state.animStartTime === 0) {
            state.startX = state.currentX;
            state.targetX = newTargetX;
            state.animStartTime = performance.now();
            // state.isInteracting = true; // REMOVED
        }
    }
  }, [isOpen]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!panelRef.current) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    
    onInteractionStart?.();

    const state = physics.current;
    state.isDragging = true;
    state.isInteracting = true;
    state.dragStartX = e.clientX;
    state.dragStartCurrentX = state.currentX;
    state.panelWidth = panelRef.current.offsetWidth || window.innerWidth * 0.66;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = physics.current;
    if (!state.isDragging) return;
    e.stopPropagation();

    const deltaPx = e.clientX - state.dragStartX;
    const deltaPercent = (deltaPx / state.panelWidth) * 100;
    
    let newPercent = state.dragStartCurrentX + deltaPercent;
    if (newPercent < 0) newPercent = 0; 
    
    state.currentX = newPercent;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const state = physics.current;
    state.isDragging = false;

    if (state.currentX > CLOSE_THRESHOLD_PERCENT) {
        state.startX = state.currentX;
        state.targetX = 100;
        state.animStartTime = performance.now();
        if (isOpen) onClose();
    } else {
        state.startX = state.currentX;
        state.targetX = 0;
        state.animStartTime = performance.now();
    }
  };

  const handleColorClass = isNight ? 'bg-zinc-300' : 'bg-zinc-600';

  return (
    <div 
        ref={panelRef}
        className={`fixed top-0 right-0 bottom-20 w-2/3 text-white shadow-2xl z-20 flex spotify-app-panel`}
        style={{ 
            willChange: 'transform',
        }}
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-labelledby="maps-player-title"
        onClick={stopPropagation}
    >
        <div className="w-full h-full flex flex-col relative bg-[#050505]">
            <div
                className={`absolute top-0 bottom-0 -left-12 w-12 flex items-center justify-end pr-2 cursor-grab active:cursor-grabbing z-50 touch-none group transition-opacity duration-300 ${isOpen ? 'opacity-100 bubble-handle' : 'opacity-0 pointer-events-none'}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                aria-label="Drag to close"
            >
                <div 
                    className={`w-1.5 h-16 rounded-full shadow-sm transition-all duration-300 opacity-70 group-hover:opacity-100 group-active:scale-y-110 ${handleColorClass}`} 
                />
            </div>

            <h1 id="maps-player-title" className="sr-only">Maps Player</h1>
            
            <div id="maps-anchored-container" className="absolute inset-0 z-50 pointer-events-none"></div>

            <iframe
                ref={iframeRef}
                title="Tesla Navigation"
                srcDoc={finalMapHtml}
                allow="geolocation"
                className="w-full h-full border-none"
            ></iframe>

            {/* Overlay NavigateTool inside the Map App */}
            {!navigationTarget && (
                <div 
                    className="absolute z-40 pointer-events-auto"
                    style={{
                        top: '20px',
                        left: '20px',
                    }}
                >
                    <NavigateTool 
                        isNight={true} // Always dark theme over map usually looks best
                        onSelectDestination={onSelectDestination}
                        currentPosition={currentPosition}
                        width={width} // Use the specific width prop passed from App.tsx
                        widgetBgColor={widgetBgColor}
                        dayPlayerButtonColor={dayPlayerButtonColor}
                        nightPlayerButtonColor={nightPlayerButtonColor}
                        homeLocation={homeLocation}
                        workLocation={workLocation}
                        darkNavigateInputBg={darkNavigateInputBg}
                        isHome={true} // Maps container is essentially full-screen "home" for navigation
                        showRecentsOnFocus={false} // Disable auto-expansion on focus
                    />
                </div>
            )}
        </div>
    </div>
  );
});

export default MapsContainer;
