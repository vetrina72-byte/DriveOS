
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const mapHtmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0">
<title>Tesla Navigation - UI Avanzata con Radar Meteo</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
<style>
:root {
--tesla-dark: #0a0a0a;
--tesla-darker: #050505;
--tesla-blue: #3B82F6;
--tesla-blue-light: #60A5FA;
--tesla-red: #EF4444;
--tesla-red-light: #F87171;
--tesla-border: rgba(255, 255, 255, 0.1);
--route-consumed-color: rgba(90, 90, 100, 0.6);
--route-upcoming-color: rgba(59, 130, 246, 0.9);
--route-glow-color: rgba(59, 130, 246, 0.4);
--timelapse-gradient: linear-gradient(to right, #ccc, #ccc);
--tile-placeholder-color: #1a1a1b; 
}
html, body {
overscroll-behavior: none;
position: fixed;
width: 100%;
height: 100%;
touch-action: none;
}
body {
font-family: 'Inter', sans-serif;
margin: 0;
padding: 0;
background: var(--tesla-darker);
color: white;
overflow: hidden;
}
.glass-effect {
background: rgba(10, 10, 10, 0.92);
backdrop-filter: blur(25px);
border: 1px solid var(--tesla-border);
border-radius: 16px;
box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
#map-container {
position: absolute;
width: 100%;
height: 100%;
background: var(--tesla-darker);
overflow: hidden;
cursor: grab;
}
#map-container.dragging { cursor: grabbing; }
#map-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; }
#marker-overlay {
position: absolute;
top:0;
left: 0;
width: 100%;
height: 100%;
pointer-events: none;
z-index: 999;
}

#vehicle-marker {
position: absolute;
width: 84px;
height: 84px;
transform: translate(-50%, -50%);
z-index: 1000;
pointer-events: none;
display: none;
transition: transform 0.2s linear;
}
#vehicle-marker svg {
width: 100%;
height: 100%;
overflow: visible;
filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6));
}

.destination-marker {
position: absolute;
background: linear-gradient(135deg, var(--tesla-red), var(--tesla-red-light));
border: 3px solid white;
border-radius: 50%;
width: 28px;
height: 28px;
box-shadow: 0 0 20px rgba(239, 68, 68, 0.8);
transform: translate(-50%, -50%);
transition: transform 0.3s ease-out;
}

.control-button {
background: rgba(0, 0, 0, 0.85);
backdrop-filter: blur(20px);
border: 1px solid var(--tesla-border);
border-radius: 14px;
padding: 14px;
color: white;
cursor: pointer;
transition: all 0.3s ease;
display: flex;
align-items: center;
justify-content: center;
box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}
.control-button:hover:not(:disabled) {
background: rgba(255, 255, 255, 0.15);
transform: scale(1.08);
}
.control-button.active {
background: linear-gradient(135deg, var(--tesla-blue), #60A5FA);
border-color: rgba(255, 255, 255, 0.3);
}
.map-controls {
position: absolute;
top: 20px;
right: 20px;
z-index: 1001;
display: flex;
flex-direction: column;
gap: 12px;
}
.search-panel {
position: absolute;
top: var(--maps-search-panel-top, 20px);
left: 20px;
z-index: 1001;
width: var(--maps-search-panel-width, 420px);
max-width: calc(100vw - 40px);
}
#search-input {
background: rgba(0, 0, 0, 0.6);
border: 2px solid rgba(255, 255, 255, 0.25);
border-radius: 16px;
padding: 14px 14px 14px 48px;
font-size: 16px;
transition: all 0.3s ease;
color: white;
}
#search-input:focus {
background: rgba(0, 0, 0, 0.8);
border-color: #3B82F6;
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
outline: none;
}
.info-toast {
position: fixed;
bottom: -100px;
left: 50%;
transform: translateX(-50%);
background: rgba(0,0,0,0.8);
backdrop-filter: blur(10px);
color: white;
padding: 12px 20px;
border-radius: 12px;
font-size: 14px;
font-weight: 500;
z-index: 10000;
border: 1px solid var(--tesla-border);
display: flex;
align-items: center;
gap: 10px;
opacity: 0;
transition: opacity 0.3s ease, bottom 0.4s ease-out;
}
.info-toast.show { opacity: 1; bottom: 20px; }

.compass-north-up { width: 48px; height: 48px; background: #E5E5E5; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; transition: all 0.3s ease; }
.compass-north-up .letter-n { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 24px; color: #FFFFFF; line-height: 1; margin-top: 4px; }
.compass-north-up .arrow-up { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 10px solid #FFFFFF; }
.compass-heading-up { width: 48px; height: 48px; position: relative; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
.compass-heading-up .central-arrow { width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-bottom: 32px solid #333333; z-index: 2; }
.compass-heading-up .compass-letters { position: absolute; width: 100%; height: 100%; transition: transform 0.2s linear; }
.compass-heading-up .compass-letter { position: absolute; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 12px; color: #222222; line-height: 1; }
.compass-heading-up .letter-n { top: 2px; left: 50%; transform: translateX(-50%); }
.compass-heading-up .letter-e { top: 50%; right: 2px; transform: translateY(-50%); }
.compass-heading-up .letter-s { bottom: 2px; left: 50%; transform: translateX(-50%); }
.compass-heading-up .letter-w { top: 50%; left: 2px; transform: translateY(-50%); }
.compass-button.active { background: rgba(59, 130, 246, 0.2); }

.search-results { max-height: 400px; overflow-y: auto; }
.search-results::-webkit-scrollbar { width: 6px; }
.search-results::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
.search-results::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.3); border-radius: 3px; }
#search-results-container .search-result-item { padding: 12px 16px; cursor: pointer; transition: background 0.2s; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
#search-results-container .search-result-item:hover { background: rgba(255, 255, 255, 0.1); }
#search-results-container .search-result-item:last-child { border-bottom: none; }
.search-result-name { font-weight: 500; color: white; }
.search-result-address { font-size: 13px; color: #aaa; margin-top: 4px; }

#trip-info-panel { position: absolute; bottom: 20px; left: 20px; transform: translateY(200%); z-index: 1002; width: 420px; max-width: calc(100vw - 40px); transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
#trip-info-panel.visible { transform: translateY(0); }
#trip-info-details { flex-grow: 1; }
#trip-info-duration { font-size: 24px; font-weight: 600; color: white; }
#trip-info-distance { font-size: 16px; color: #bbb; }
.trip-buttons { display: flex; gap: 10px; }
.trip-button { flex: 1; color: white; font-weight: 600; padding: 12px; border-radius: 12px; border: none; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; }
.trip-button:hover { transform: scale(1.05); }
#start-trip-btn { background: var(--tesla-blue); }
#cancel-trip-btn { background: var(--tesla-gray); }

#end-trip-container { position: absolute; bottom: 20px; left: 20px; z-index: 1001; }
#end-trip-btn { background: var(--tesla-red); color: white; font-weight: 600; padding: 14px 20px; border-radius: 16px; display: flex; align-items: center; gap: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.4); transition: all 0.3s ease; }
#end-trip-btn:hover { background: var(--tesla-red-light); transform: scale(1.05); }

#timelapse-controls {
position: absolute;
bottom: 20px;
left: 50%;
z-index: 1002;
width: 400px;
max-width: calc(100vw - 40px);
opacity: 0;
transform: translate(-50%, 20px);
pointer-events: none;
transition: opacity 0.3s ease, transform 0.3s ease;
}
#timelapse-controls.visible {
opacity: 1;
transform: translate(-50%, 0);
pointer-events: all;
}
#timelapse-slider {
-webkit-appearance: none;
width: 100%;
height: 8px;
border-radius: 4px;
outline: none;
transition: background .2s;
background: var(--timelapse-gradient);
}
#timelapse-slider::-webkit-slider-thumb {
-webkit-appearance: none;
appearance: none;
width: 20px;
height: 20px;
background: #fff;
cursor: pointer;
border-radius: 50%;
border: 2px solid var(--tesla-blue);
box-shadow: 0 0 5px rgba(0,0,0,0.5);
}
</style>
</head>
<body>
<div id="app">
    <div id="search-panel" class="search-panel">
        <div class="glass-effect rounded-2xl p-5">
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <i data-lucide="search" class="h-6 w-6 text-gray-300"></i>
                </div>
                <input type="text" id="search-input" placeholder="Dove vuoi andare?" class="w-full text-white placeholder-gray-400 focus:outline-none">
                <button id="clear-search" class="absolute inset-y-0 right-0 pr-5 flex items-center hidden">
                    <i data-lucide="x" class="h-6 w-6 text-gray-300 hover:text-white transition-colors"></i>
                </button>
            </div>
            <div id="search-results-container" class="hidden mt-4 rounded-xl overflow-hidden">
                <div id="search-results" class="search-results"></div>
                <div id="search-loading" class="hidden p-4 text-center text-gray-400">Ricerca...</div>
                <div id="no-results" class="hidden p-4 text-center text-gray-400">Nessun risultato trovato</div>
            </div>
        </div>
    </div>
    <div id="end-trip-container" class="hidden">
        <button id="end-trip-btn">
            <i data-lucide="x-circle"></i>
            <span>Termina Viaggio</span>
        </button>
    </div>
    <div id="map-container">
        <canvas id="map-canvas"></canvas>
        <div id="marker-overlay">
            <div id="vehicle-marker">
                <svg viewBox="0 0 1414 2000" style="shape-rendering: geometricPrecision;">
                    <path fill="#FDFCFC" d="M639.979065,551.815125 C645.168152,540.088928 650.026184,528.629089 655.273071,517.350159 C668.813538,488.243103 708.591675,477.322784 735.566650,494.553101 C749.156494,503.233704 756.313721,515.993591 762.405273,530.085083 C787.421509,587.954773 812.641113,645.736633 837.759827,703.562134 C862.019897,759.411072 886.220703,815.285706 910.497864,871.127136 C934.243469,925.745850 958.087769,980.321533 981.824341,1034.944092 C1007.415466,1093.834229 1032.934204,1152.755859 1058.479614,1211.665894 C1065.145508,1227.038086 1072.164307,1242.270264 1078.359985,1257.829956 C1086.983032,1279.485596 1080.075684,1304.759277 1061.833496,1320.765991 C1044.998657,1335.537842 1018.689575,1338.636230 998.807922,1327.514404 C973.012146,1313.083984 947.494507,1298.156738 921.845398,1283.463745 C896.915344,1269.182495 871.943359,1254.974487 847.039307,1240.648193 C818.390015,1224.167480 789.808044,1207.569946 761.171631,1191.066895 C743.616943,1180.949951 726.045654,1170.860352 708.373291,1160.952148 C707.027161,1160.197388 704.456543,1160.359009 703.057556,1161.154419 C677.210327,1175.849976 651.469910,1190.733276 625.675842,1205.522827 C600.896851,1219.730347 576.053467,1233.825806 551.291382,1248.062500 C526.381775,1262.384155 501.560059,1276.858398 476.657715,1291.192383 C455.215363,1303.535034 433.836731,1315.996338 412.205383,1328.000488 C388.054901,1341.402466 353.937225,1332.084717 339.430542,1308.918579 C327.287811,1289.527344 327.550873,1270.051636 336.589294,1249.539062 C360.004272,1196.398804 382.947418,1143.050781 406.116211,1089.801880 C430.474152,1033.819946 454.903503,977.869019 479.249084,921.881653 C499.687012,874.880615 520.035400,827.840698 540.448792,780.828918 C568.990845,715.096863 597.555237,649.374451 626.113342,583.649353 C630.675232,573.150452 635.254150,562.658875 639.979065,551.815125 M707.070129,571.954651 C703.108154,572.252441 698.969604,571.915771 695.215637,572.960754 C681.000549,576.917969 671.380615,586.191162 665.529053,599.665771 C624.699951,693.684204 583.817871,787.679565 542.963440,881.686951 C500.913940,978.444153 458.874298,1075.205688 416.835876,1171.967651 C408.560883,1191.014648 413.332520,1210.763794 429.660736,1225.171021 C442.888977,1236.842773 464.812622,1238.171875 481.153290,1228.615234 C503.680634,1215.440674 526.323425,1202.463379 548.939514,1189.440918 C582.601135,1170.058105 616.268066,1150.684448 649.961304,1131.356812 C669.273499,1120.278809 688.642273,1109.299561 708.541809,1098.628418 C734.360596,1113.440918 760.191284,1128.232910 785.995544,1143.070557 C833.427551,1170.344727 880.917236,1197.519775 928.216003,1225.023193 C940.130798,1231.951416 952.263794,1236.605469 966.153687,1233.567993 C994.624023,1227.342163 1008.930359,1198.113892 997.079346,1170.926025 C973.180847,1116.099487 949.338867,1061.248291 925.493591,1006.398438 C912.631531,976.812622 899.828613,947.201050 886.968018,917.614563 C855.015137,844.105225 823.043579,770.604004 791.081543,697.098694 C776.757996,664.157898 762.495178,631.190430 748.093933,598.283508 C740.974609,582.015869 723.690674,570.855591 707.070129,571.954651 z" />
                    <path fill="#F53C3F" d="M707.985596,1098.275757 C688.642273,1109.299561 669.273499,1120.278809 649.961304,1131.356812 C616.268066,1150.684448 582.601135,1170.058105 548.939514,1189.440918 C526.323425,1202.463379 503.680634,1215.440674 481.153290,1228.615234 C464.812622,1238.171875 442.888977,1236.842773 429.660736,1225.171021 C413.332520,1210.763794 408.560883,1191.014648 416.835876,1171.967651 C458.874298,1075.205688 500.913940,978.444153 542.963440,881.686951 C583.817871,787.679565 624.699951,693.684204 665.529053,599.665771 C671.380615,586.191162 681.000549,576.917969 695.215637,572.960754 C698.969604,571.915771 703.108154,572.252441 707.527222,572.474731 C707.984741,748.088440 707.985168,923.182068 707.985596,1098.275757 z" />
                    <path fill="#F56568" d="M708.263672,1098.452148 C707.985168,923.182068 707.984741,748.088440 707.981567,572.530945 C723.690674,570.855591 740.974609,582.015869 748.093933,598.283508 C762.495178,631.190430 776.757996,664.157898 791.081543,697.098694 C823.043579,770.604004 855.015137,844.105225 886.968018,917.614563 C899.828613,947.201050 912.631531,976.812622 925.493591,1006.398438 C949.338867,1061.248291 973.180847,1116.099487 997.079346,1170.926025 C1008.930359,1198.113892 994.624023,1227.342163 966.153687,1233.567993 C952.263794,1236.605469 940.130798,1231.951416 928.216003,1225.023193 C880.917236,1197.519775 833.427551,1170.344727 785.995544,1143.070557 C760.191284,1128.232910 734.360596,1113.440918 708.263672,1098.452148 z" />
                </svg>
            </div>
        </div>
    </div>
    <div class="map-controls">
        <button id="compass-btn" class="control-button compass-button" title="Modalità Bussola">
            <div id="compass-north-icon" class="compass-north-up">
                <div class="arrow-up"></div>
                <div class="letter-n">N</div>
            </div>
            <div id="compass-heading-icon" class="compass-heading-up" style="display: none;">
                <div class="central-arrow"></div>
                <div class="compass-letters" id="compass-letters-container">
                    <div class="compass-letter letter-n">N</div>
                    <div class="compass-letter letter-e">E</div>
                    <div class="compass-letter letter-s">S</div>
                    <div class="compass-letter letter-w">W</div>
                </div>
            </div>
        </button>
        <button id="recenter-btn" class="control-button" title="Centra Posizione">
            <i data-lucide="crosshair" class="w-6 h-6"></i>
        </button>
        <div class="w-full h-px bg-white/20 my-1"></div>
        <div class="flex flex-col gap-3">
            <button id="map-mode-toggle-btn" class="control-button" title="Vista Satellitare/Standard">
                <i data-lucide="earth" class="w-6 h-6"></i>
            </button>
            <button id="weather-toggle-btn" class="control-button" title="Radar Meteo">
                <i data-lucide="cloud-rain" class="w-6 h-6"></i>
            </button>
        </div>
    </div>
    <div id="info-toast" class="info-toast">
        <i id="info-toast-icon" data-lucide="info"></i>
        <span id="info-toast-text"></span>
    </div>
    <div id="trip-info-panel" class="glass-effect">
        <div class="p-4">
            <div id="trip-info-details" class="flex justify-between items-center">
                <div>
                    <div id="trip-info-duration">-- min</div>
                    <div id="trip-info-distance" class="text-sm text-gray-400">-- km</div>
                </div>
            </div>
            <div class="trip-buttons mt-4">
                <button id="start-trip-btn" class="trip-button"><i data-lucide="navigation"></i><span>Inizia</span></button>
                <button id="cancel-trip-btn" class="trip-button"><i data-lucide="x"></i><span>Annulla</span></button>
            </div>
        </div>
    </div>
    <div id="timelapse-controls" class="glass-effect p-4">
        <div class="flex items-center gap-4">
            <button id="timelapse-play-pause-btn" class="control-button !p-2 flex-shrink-0">
                <i data-lucide="play" class="w-5 h-5"></i>
            </button>
            <div class="flex-grow">
                <input type="range" id="timelapse-slider" min="0" value="0">
                <div id="timelapse-label" class="text-xs text-gray-400 text-center mt-2">Caricamento...</div>
            </div>
        </div>
    </div>
</div>

<script>
// Robust message queuing system
window.pendingNavMessage = null;
window.teslaNav = null; // Flag to indicate if the main class is instantiated

window.addEventListener('message', (event) => {
    // ORIGIN CHECK REMOVED
    if (event.data && event.data.type === 'SET_DESTINATION') {
        if (window.teslaNav) {
            // If nav is ready, process immediately
            const { lat, lng, name } = event.data.payload;
            window.teslaNav.setDestination({ lat, lng }, name, true);
        } else {
            // If nav is not ready, queue the message
            window.pendingNavMessage = event.data;
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    class TeslaNavigation {
        constructor() {
            this.stadiaApiKey = 'a09f6dcb-e401-4de9-9609-c4ab6ae1da10';
            this.geoapifyApiKey = '0d2c9c7f72c0477eb3260838db72a383';
            
            this.mapContainer = document.getElementById('map-container');
            this.canvas = document.getElementById('map-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.tileCanvas = document.createElement('canvas');
            this.tileCtx = this.tileCanvas.getContext('2d');
            this.weatherCanvas = document.createElement('canvas');
            this.weatherCtx = this.weatherCanvas.getContext('2d');
            this.vehicleMarkerEl = document.getElementById('vehicle-marker');
            this.markerOverlay = document.getElementById('marker-overlay');
            this.searchInput = document.getElementById('search-input');
            this.clearSearchBtn = document.getElementById('clear-search');
            this.searchResultsContainer = document.getElementById('search-results-container');
            this.searchResults = document.getElementById('search-results');
            this.searchLoading = document.getElementById('search-loading');
            this.noResults = document.getElementById('no-results');
            this.recenterBtn = document.getElementById('recenter-btn');
            this.tripInfoPanel = document.getElementById('trip-info-panel');
            this.tripDurationEl = document.getElementById('trip-info-duration');
            this.tripDistanceEl = document.getElementById('trip-info-distance');
            this.startTripBtn = document.getElementById('start-trip-btn');
            this.cancelTripBtn = document.getElementById('cancel-trip-btn');
            this.endTripContainer = document.getElementById('end-trip-container');
            this.mapModeToggleBtn = document.getElementById('map-mode-toggle-btn');
            this.weatherToggleBtn = document.getElementById('weather-toggle-btn');
            this.timelapseControls = document.getElementById('timelapse-controls');
            this.timelapsePlayPauseBtn = document.getElementById('timelapse-play-pause-btn');
            this.timelapseSlider = document.getElementById('timelapse-slider');
            this.timelapseLabel = document.getElementById('timelapse-label');

            this.imageCache = {};
            this.weatherImageCache = {};
            this.failedTiles = {};
            this.redrawRequested = false;

            this.tileQueue = [];
            this.loadingTiles = new Set();
            this.activeLoads = 0;
            this.MAX_CONCURRENT_LOADS = 8;
            
            this.TILE_RETRY_DELAY = 15000;
            this.weatherNeedsRedraw = false;
            
            this.TILE_SIZE = 256;
            this.MIN_ZOOM = 3;
            this.MAX_ZOOM = 19;
            this.MAX_LAT = 85.0511287798;
            this.DEFAULT_DRIVING_ZOOM = 17;
            this.FADE_DURATION = 350;
            
            this.tileProviders = {
                dark: \`https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=\${this.stadiaApiKey}\`,
                light: \`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=\${this.stadiaApiKey}\`,
                satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            };
            this.currentTileProvider = 'dark';

            this.userSelectedMapMode = 'auto';
            this.timeCheckInterval = null;
            this.zoom = 13;
            this.center = { lat: 41.9028, lng: 12.4964 };
            this.destination = null;
            this.destinationMarker = null;
            this.routeGeometry = null;
            this.tripInfo = null;
            this.currentPosition = null;
            this.vehicleOrientationBearing = 0;
            this.smoothedCompassIconBearing = 0;
            this.compassMode = 'north-up';
            this.trackingConfig = { bearingSmoothing: 0.3, compassIconSmoothing: 0.1 };
            this.isDragging = false;
            this.isUserInteracting = false;
            this.isViewingRoute = false;
            this.dragStart = { x: 0, y: 0 };
            this.centerOnDragStart = { lat: 0, lng: 0 };
            this.isFollowingUser = true;
            this.autoRecenterTimer = null;
            this.animation = null;
            this.frozenBearing = null;
            this.touchStartDist = 0;
            this.isNavigating = false;
            this.isRecalculating = false;
            this.currentStepIndex = 0;
            this.targetRotation = 0;
            this.currentRotation = 0;
            this.rotationSmoothing = 0.15;
            this.isWeatherLayerVisible = false;
            this.isWeatherOverviewActive = false;
            this.weatherOverviewRecenterTimer = null;
            this.WEATHER_ZOOM_OUT_LEVEL = 12;
            this.weatherTimestamps = [];
            this.currentWeatherFrame = 0;
            this.pastFramesCount = 0;
            this.isTimelapsePlaying = false;
            this.timelapseInterval = null;
            this.MAX_WEATHER_TILE_ZOOM = 7;
            this.wasInHeadingUpMode = false;
            this.externalTheme = null;
            this.pendingDestination = null;

            this.init();
        }

        init() {
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            this.initEventListeners();
            this.loadMapMode();
            this.startTimeOfDayChecker();
            this.startRenderLoop();
            lucide.createIcons();
            this.getCurrentPosition();
        }

        async setDestination(coords, name, startNavigating = false) {
            if (this.destination && this.destination.lat === coords.lat && this.destination.lng === coords.lng) {
                console.log("Destination is the same. Not recalculating.");
                if (this.isNavigating) {
                    this.updateUIVisibility();
                    this.recenterMap();
                } else {
                    this.isViewingRoute = true;
                    this.updateTripInfoPanel();
                    this.fitBounds();
                }
                return;
            }

            if (!this.currentPosition) {
                this.showInfoToast("In attesa della posizione GPS...", "loader");
                this.pendingDestination = { coords, name, startNavigating };
                return;
            }

            this._clearRouteInternals();
            this.destination = coords;
            this.searchInput.value = name;
            this.destinationMarker = document.createElement('div');
            this.destinationMarker.className = 'destination-marker';
            this.markerOverlay.appendChild(this.destinationMarker);
            this.showInfoToast('Calcolo percorso...', 'loader');
            const success = await this.fetchAndSetRoute(this.currentPosition, this.destination);
            if (success) {
                if (startNavigating) {
                    this.startNavigation();
                } else {
                    this.isViewingRoute = true;
                    this.updateTripInfoPanel();
                    this.fitBounds();
                }
            } else {
                this.showInfoToast("Impossibile calcolare il percorso", "route-off");
                this.clearRouteAndNotify();
            }
        }

        setExternalTheme(theme) {
            this.externalTheme = theme;
            this.setMapMode(this.userSelectedMapMode, false);
        }
        
        getTileUrl(x, y, z) {
            const numTiles = Math.pow(2, z);
            if (y < 0 || y >= numTiles) return null;
            const wrappedX = ((x % numTiles) + numTiles) % numTiles;
            const providerUrl = this.tileProviders[this.currentTileProvider] || this.tileProviders.dark;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            return providerUrl.replace('{z}', z).replace('{x}', wrappedX).replace('{y}', y).replace('{r}', dpr > 1.5 ? '@2x' : '');
        }

        getCurrentPosition() {
            navigator.geolocation.watchPosition(
                (position) => {
                    const firstFix = !this.currentPosition;
                    this.handlePositionUpdate(position);
                    if (firstFix) {
                        this.flyTo({ center: this.currentPosition, zoom: 16 });
                        this.showInfoToast("Posizione trovata!", "map-pin");
                    }
                    this.vehicleMarkerEl.style.display = 'block';
                },
                (geoError) => {
                    console.error("Errore di geolocalizzazione:", \`Code \${geoError.code}: \${geoError.message}\`);
                    let message = "Impossibile ottenere la posizione";
                    if (geoError.code === geoError.PERMISSION_DENIED) message = "Permesso di geolocalizzazione negato.";
                    if (geoError.code === geoError.POSITION_UNAVAILABLE) message = "Informazioni sulla posizione non disponibili.";
                    if (geoError.code === geoError.TIMEOUT) message = "Timeout nel trovare la posizione.";
                    this.showInfoToast(message, 'map-pin-off');
                },
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
            );
        }

        resizeCanvas() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const { offsetWidth: width, offsetHeight: height } = this.mapContainer;
            this.canvas.width = width * dpr;
            this.canvas.height = height * dpr;
            this.canvas.style.width = \`\${width}px\`;
            this.canvas.style.height = \`\${height}px\`;
            [this.tileCanvas, this.weatherCanvas].forEach(canvas => {
                canvas.width = this.canvas.width;
                canvas.height = this.canvas.height;
                canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
            });
            this.requestRedraw();
        }
        
        recenterMap(zoomLevel = this.DEFAULT_DRIVING_ZOOM) {
            if (this.currentPosition) {
                this.isUserInteracting = false;
                if (this.autoRecenterTimer) clearTimeout(this.autoRecenterTimer);
                this.isFollowingUser = true;
                this.flyTo({
                    center: this.currentPosition,
                    zoom: zoomLevel,
                    onComplete: () => {
                        if (this.wasInHeadingUpMode) {
                            this.setCompassMode('heading-up');
                            this.wasInHeadingUpMode = false;
                        }
                    }
                });
            }
        }
        
        updateAnimation(timestamp) {
            if (!this.animation) return;
            const t = Math.min(1, (timestamp - this.animation.startTime) / this.animation.duration);
            const easedT = t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
            
            this.zoom = this.animation.startZoom + (this.animation.endZoom - this.animation.startZoom) * easedT;
            this.center = {
                lat: this.animation.startCenter.lat + (this.animation.endCenter.lat - this.animation.startCenter.lat) * easedT,
                lng: this.animation.startCenter.lng + (this.animation.endCenter.lng - this.animation.startCenter.lng) * easedT,
            };
            this.clampCenter();
            this.requestRedraw();
            if (t === 1) {
                if (this.animation.onComplete) {
                    this.animation.onComplete();
                }
                this.animation = null;
            }
        }
        
        initEventListeners() { this.mapModeToggleBtn.addEventListener('click', () => this.setMapMode(this.userSelectedMapMode === 'auto' ? 'satellite' : 'auto')); this.weatherToggleBtn.addEventListener('click', () => this.toggleWeatherLayer()); this.timelapsePlayPauseBtn.addEventListener('click', () => this.playPauseTimelapse()); this.timelapseSlider.addEventListener('input', (e) => { this.stopTimelapse(); this.setTimelapseFrame(parseInt(e.target.value)); this.preloadWeatherFrames(5); }); document.getElementById('compass-btn').addEventListener('click', () => this.toggleCompassMode()); this.recenterBtn.addEventListener('click', () => this.manualRecenter()); this.startTripBtn.addEventListener('click', () => this.startNavigation()); this.cancelTripBtn.addEventListener('click', () => this.clearRouteAndNotify()); document.getElementById('end-trip-btn').addEventListener('click', () => this.clearRouteAndNotify()); this.searchInput.addEventListener('input', (e) => { const query = e.target.value.trim(); this.clearSearchBtn.style.display = query ? 'flex' : 'none'; if (this.searchDebounce) clearTimeout(this.searchDebounce); if (query.length < 3) { this.hideSearchResults(); this._clearRouteInternals(); return; } this.searchDebounce = setTimeout(() => this.searchLocations(query), 300); }); this.clearSearchBtn.addEventListener('click', () => { this.searchInput.value = ''; this.clearSearchBtn.style.display = 'none'; this.hideSearchResults(); this._clearRouteInternals(); }); this.mapContainer.addEventListener('mousedown', this.handleMouseDown.bind(this)); this.mapContainer.addEventListener('mousemove', this.handleMouseMove.bind(this)); this.mapContainer.addEventListener('mouseup', this.handleMouseUp.bind(this)); this.mapContainer.addEventListener('mouseleave', this.handleMouseUp.bind(this)); this.mapContainer.addEventListener('wheel', this.handleWheel.bind(this), { passive: false }); this.mapContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false }); this.mapContainer.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false }); this.mapContainer.addEventListener('touchend', this.handleTouchEnd.bind(this)); }
        
        requestRedraw() { if (!this.redrawRequested) { this.redrawRequested = true; requestAnimationFrame(() => { this.weatherNeedsRedraw = true; this.redrawRequested = false; }); } }
        
        clampCenter() { this.center.lng = ((this.center.lng + 180) % 360 + 360) % 360 - 180; const { offsetHeight: height } = this.mapContainer; const minTileY = this.lat2tile(this.MAX_LAT, this.zoom); const maxTileY = this.lat2tile(-this.MAX_LAT, this.zoom); const screenHalfHeightInTiles = (height / 2) / this.TILE_SIZE; const minCenterTileY = minTileY + screenHalfHeightInTiles; const maxCenterTileY = maxTileY - screenHalfHeightInTiles; const currentCenterTileY = this.lat2tile(this.center.lat, this.zoom); if (currentCenterTileY < minCenterTileY) { this.center.lat = this.tile2lat(minCenterTileY, this.zoom); } else if (currentCenterTileY > maxCenterTileY) { this.center.lat = this.tile2lat(maxCenterTileY, this.zoom); } }
        
        panMap(dx, dy) { let moveDx = dx, moveDy = dy; const currentBearing = this.frozenBearing ?? this.vehicleOrientationBearing; if (this.compassMode === 'heading-up' && currentBearing !== 0) { const θ = currentBearing * Math.PI / 180; moveDx = dx * Math.cos(θ) - dy * Math.sin(θ); moveDy = dx * Math.sin(θ) + dy * Math.cos(θ); } const startTileX = this.lon2tile(this.centerOnDragStart.lng, this.zoom); const startTileY = this.lat2tile(this.centerOnDragStart.lat, this.zoom); this.center = { lat: this.tile2lat(startTileY - (moveDy / this.TILE_SIZE), this.zoom), lng: this.tile2lon(startTileX - (moveDx / this.TILE_SIZE), this.zoom) }; this.clampCenter(); this.requestRedraw(); }
        
        zoomAtPoint(zoomChange, x, y) { const mouseGeoBefore = this.screenPxToGeo(x, y); this.zoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom + zoomChange)); const mouseGeoAfter = this.screenPxToGeo(x, y); this.center = { lat: this.center.lat - (mouseGeoAfter.lat - mouseGeoBefore.lat), lng: this.center.lng - (mouseGeoAfter.lng - mouseGeoBefore.lng) }; this.clampCenter(); this.requestRedraw(); }
        
        startRenderLoop() { const render = (timestamp) => { this.updateAnimation(timestamp); this.updateRotation(); this.drawMapToBuffer(); if (this.isWeatherLayerVisible && this.weatherNeedsRedraw) { this.drawWeatherToBuffer(); this.weatherNeedsRedraw = false; } this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.ctx.drawImage(this.tileCanvas, 0, 0); if (this.isWeatherLayerVisible) { this.ctx.globalAlpha = 0.8; this.ctx.drawImage(this.weatherCanvas, 0, 0); this.ctx.globalAlpha = 1.0; } this.updateUiElements(); requestAnimationFrame(render); }; requestAnimationFrame(render); }
        
        processTileQueue() { while (this.activeLoads < this.MAX_CONCURRENT_LOADS && this.tileQueue.length > 0) { const url = this.tileQueue.shift(); this.loadTile(url, this.imageCache); } }
        
        drawMapToBuffer() { const ctx = this.tileCtx; const { offsetWidth: width, offsetHeight: height } = this.mapContainer; ctx.save(); ctx.clearRect(0, 0, width, height); if (Math.abs(this.currentRotation) > 0.001) { ctx.translate(width / 2, height / 2); ctx.rotate(this.currentRotation); ctx.translate(-width / 2, -height / 2); } const tileZ = Math.round(this.zoom); const scale = Math.pow(2, this.zoom - tileZ); const scaledTileSize = this.TILE_SIZE * scale; const centerTileX = this.lon2tile(this.center.lng, tileZ); const centerTileY = this.lat2tile(this.center.lat, tileZ); const tilesToLoad = Math.ceil(Math.hypot(width, height) / scaledTileSize / 2) + 2; const newTileQueue = []; for (let i = Math.floor(centerTileX - tilesToLoad); i < Math.ceil(centerTileX + tilesToLoad); i++) { for (let j = Math.floor(centerTileY - tilesToLoad); j < Math.ceil(centerTileY + tilesToLoad); j++) { const url = this.getTileUrl(i, j, tileZ); if (url && !this.imageCache[url] && !this.loadingTiles.has(url) && !this.failedTiles[url]) { const tileScreenX = Math.round((i - centerTileX) * scaledTileSize + width / 2); const tileScreenY = Math.round((j - centerTileY) * scaledTileSize + height / 2); const distance = Math.hypot(tileScreenX - width / 2, tileScreenY - height / 2); newTileQueue.push({ url, distance }); } } } newTileQueue.sort((a, b) => a.distance - b.distance); this.tileQueue = newTileQueue.map(t => t.url); this.processTileQueue(); const drawWorld = () => { for (let i = Math.floor(centerTileX - tilesToLoad); i < Math.ceil(centerTileX + tilesToLoad); i++) { for (let j = Math.floor(centerTileY - tilesToLoad); j < Math.ceil(centerTileY + tilesToLoad); j++) { const tileScreenX = Math.round((i - centerTileX) * scaledTileSize + width / 2); const tileScreenY = Math.round((j - centerTileY) * scaledTileSize + height / 2); this.drawTile(ctx, i, j, tileZ, tileScreenX, tileScreenY, scaledTileSize); } } }; const worldWidthInPixels = Math.pow(2, this.zoom) * this.TILE_SIZE; drawWorld(); ctx.translate(-worldWidthInPixels, 0); drawWorld(); ctx.translate(2 * worldWidthInPixels, 0); drawWorld(); ctx.restore(); ctx.save(); if (Math.abs(this.currentRotation) > 0.001) { ctx.translate(width / 2, height / 2); ctx.rotate(this.currentRotation); ctx.translate(-width / 2, -height / 2); } this.drawRoute(ctx); ctx.restore(); }
        
        loadTile(url, cache, onLoadCallback = null) { if (!url || this.loadingTiles.has(url) || cache[url]) return; this.loadingTiles.add(url); this.activeLoads++; const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = () => { if (img.naturalWidth === 0) { img.onerror(); return; } img.loadTime = performance.now(); cache[url] = img; delete this.failedTiles[url]; this.loadingTiles.delete(url); this.activeLoads--; this.processTileQueue(); if (onLoadCallback) onLoadCallback(); this.requestRedraw(); }; img.onerror = () => { this.failedTiles[url] = { timestamp: performance.now() }; this.loadingTiles.delete(url); this.activeLoads--; this.processTileQueue(); }; img.src = url; }
        
        drawTile(ctx, x, y, z, canvasX, canvasY, size) { ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tile-placeholder-color'); ctx.fillRect(canvasX, canvasY, size + 1, size + 1); const fallbackData = this.findLoadedTile(x, y, z - 1, this.imageCache, (x,y,z) => this.getTileUrl(x,y,z)); if (fallbackData) { this.drawParentTile(ctx, fallbackData, x, y, z, canvasX, canvasY, size); } const idealUrl = this.getTileUrl(x, y, z); if (!idealUrl) return; const idealImage = this.imageCache[idealUrl]; if (idealImage?.complete && idealImage.naturalWidth > 0) { const elapsed = performance.now() - (idealImage.loadTime || 0); const opacity = Math.min(1, elapsed / this.FADE_DURATION); if (opacity < 1) ctx.globalAlpha = opacity; ctx.imageSmoothingEnabled = false; ctx.drawImage(idealImage, canvasX, canvasY, size + 1, size + 1); if (opacity < 1) ctx.globalAlpha = 1; }  }
        
        drawWeatherToBuffer() {
            const ctx = this.weatherCtx;
            const { offsetWidth: width, offsetHeight: height } = this.mapContainer;
            ctx.clearRect(0, 0, width, height);

            if (!this.isWeatherLayerVisible || !this.weatherTimestamps.length) return;

            ctx.save();
            if (Math.abs(this.currentRotation) > 0.001) {
                ctx.translate(width / 2, height / 2);
                ctx.rotate(this.currentRotation);
                ctx.translate(-width / 2, -height / 2);
            }

            const weatherZoom = Math.max(4, Math.min(this.MAX_WEATHER_TILE_ZOOM, Math.floor(this.zoom) - 1));

            const getWeatherTileUrl = (framePath, x, y, z) => {
                const maxTileIndex = Math.pow(2, z) - 1;
                if (y < 0 || y > maxTileIndex) return null;
                const wrappedX = ((x % (maxTileIndex + 1)) + (maxTileIndex + 1)) % (maxTileIndex + 1);
                return \`https://tilecache.rainviewer.com\${framePath}/512/\${z}/\${wrappedX}/\${y}/4/1_1.png\`;
            };

            const scaledTileSize = this.TILE_SIZE * Math.pow(2, this.zoom - weatherZoom);
            const centerTileX = this.lon2tile(this.center.lng, weatherZoom);
            const centerTileY = this.lat2tile(this.center.lat, weatherZoom);
            const tilesToLoad = Math.ceil(Math.hypot(width, height) / scaledTileSize / 2) + 1;

            for (let i = Math.floor(centerTileX - tilesToLoad); i <= Math.ceil(centerTileX + tilesToLoad); i++) {
                for (let j = Math.floor(centerTileY - tilesToLoad); j <= Math.ceil(centerTileY + tilesToLoad); j++) {
                    
                    const idealFrame = this.weatherTimestamps[this.currentWeatherFrame];
                    if (!idealFrame) continue;

                    const idealUrl = getWeatherTileUrl(idealFrame.path, i, j, weatherZoom);
                    if (!idealUrl) continue;
                    
                    const image = this.weatherImageCache[idealUrl];
                    let drawn = false;

                    if (image?.complete && image.naturalWidth > 0) {
                        const tileScreenX = Math.round((i - centerTileX) * scaledTileSize + width / 2);
                        const tileScreenY = Math.round((j - centerTileY) * scaledTileSize + height / 2);
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(image, tileScreenX, tileScreenY, scaledTileSize + 1, scaledTileSize + 1);
                        drawn = true;
                    } else {
                        this.loadTile(idealUrl, this.weatherImageCache, () => this.requestRedraw());
                        
                        // ANTI-FLICKER: Fallback to the previous frame's tile if available
                        const prevFrameIndex = (this.currentWeatherFrame - 1 + this.weatherTimestamps.length) % this.weatherTimestamps.length;
                        const prevFrame = this.weatherTimestamps[prevFrameIndex];
                        if (prevFrame) {
                            const prevUrl = getWeatherTileUrl(prevFrame.path, i, j, weatherZoom);
                            const prevImage = this.weatherImageCache[prevUrl];
                            if (prevImage?.complete && prevImage.naturalWidth > 0) {
                                const tileScreenX = Math.round((i - centerTileX) * scaledTileSize + width / 2);
                                const tileScreenY = Math.round((j - centerTileY) * scaledTileSize + height / 2);
                                ctx.imageSmoothingEnabled = true;
                                ctx.imageSmoothingQuality = 'high';
                                ctx.drawImage(prevImage, tileScreenX, tileScreenY, scaledTileSize + 1, scaledTileSize + 1);
                                drawn = true;
                            }
                        }
                    }
                }
            }
            ctx.restore();
        }

        drawParentTile(ctx, parentTile, x, y, z, canvasX, canvasY, size) { const { img, x: pX, y: pY, z: pZ } = parentTile; const tileRes = img.src.includes('@2x') || img.src.includes('/512/') ? 512 : 256; const tileSizeOnParent = tileRes / Math.pow(2, z - pZ); const clipX = (x - pX * Math.pow(2, z - pZ)) * tileSizeOnParent; const clipY = (y - pY * Math.pow(2, z - pZ)) * tileSizeOnParent; ctx.imageSmoothingEnabled = true; ctx.drawImage(img, clipX, clipY, tileSizeOnParent, tileSizeOnParent, canvasX, canvasY, size + 1, size + 1); }
        
        findLoadedTile(x, y, z, cache, urlBuilder) { let z_ = z; while (z_ >= this.MIN_ZOOM) { const pX = x >> (z - z_); const pY = y >> (z - z_); const url = urlBuilder(this.weatherTimestamps[this.currentWeatherFrame]?.path, pX, pY, z_); if(url && cache[url]?.complete && cache[url].naturalWidth > 0) { return { img: cache[url], x: pX, y: pY, z: z_ }; } z_--; } return null; }
        
        async toggleWeatherLayer() { this.isWeatherLayerVisible = !this.isWeatherLayerVisible; this.weatherToggleBtn.classList.toggle('active', this.isWeatherLayerVisible); this.timelapseControls.classList.toggle('visible', this.isWeatherLayerVisible); this.requestRedraw(); if (this.isWeatherLayerVisible) { this.isWeatherOverviewActive = true; this.isFollowingUser = false; if (this.autoRecenterTimer) clearTimeout(this.autoRecenterTimer); if (this.compassMode === 'heading-up') { this.wasInHeadingUpMode = true; this.setCompassMode('north-up'); this.showInfoToast('Modalità North Up per vista radar', 'compass'); } this.flyTo({ center: this.currentPosition ?? this.center, zoom: this.WEATHER_ZOOM_OUT_LEVEL }); this.startWeatherRecenterTimer(); this.stopTimelapse(); if (this.weatherTimestamps.length === 0) { this.showInfoToast("Caricamento dati radar...", "loader"); try { const response = await fetch('https://api.rainviewer.com/public/weather-maps.json'); const data = await response.json(); this.weatherTimestamps = [...data.radar.past, ...data.radar.nowcast]; this.pastFramesCount = data.radar.past.length; this.timelapseSlider.max = this.weatherTimestamps.length - 1; this.updateTimelapseSliderStyle(); this.setTimelapseFrame(this.pastFramesCount - 1); this.showInfoToast("Radar meteo caricato", "cloud-rain"); this.playPauseTimelapse(); } catch (weatherError) { console.error('Errore caricamento dati meteo:', weatherError); this.showInfoToast("Errore caricamento dati meteo", "alert-triangle"); this.toggleWeatherLayer(); } } else { this.playPauseTimelapse(); } } else { this.showInfoToast("Radar meteo disattivato", "cloud-off"); this.stopTimelapse(); if (this.isWeatherOverviewActive) { this.isWeatherOverviewActive = false; if (this.weatherOverviewRecenterTimer) clearTimeout(this.weatherOverviewRecenterTimer); this.recenterMap(); } } }
        
        setTimelapseFrame(frameIndex) { this.currentWeatherFrame = frameIndex; this.timelapseSlider.value = frameIndex; this.updateTimelapseLabel(); this.requestRedraw(); }

        flyTo({ center, zoom, duration = null, onComplete = null }) {
            const startCenter = { ...this.center };
            const endCenter = { ...center };

            let finalDuration = duration;
            if (finalDuration === null) {
                const distance = this.calculateGeoDistance(startCenter.lat, startCenter.lng, endCenter.lat, endCenter.lng);
                finalDuration = Math.max(800, Math.min(3000, Math.sqrt(distance) * 60));
            }
            
            this.animation = { 
                startZoom: this.zoom, 
                endZoom: zoom, 
                startCenter: startCenter, 
                endCenter: endCenter, 
                startTime: performance.now(), 
                duration: finalDuration, 
                onComplete: onComplete 
            };
        }
        
        updateRotation() { const currentBearing = this.frozenBearing ?? this.vehicleOrientationBearing; if (this.compassMode === 'heading-up' && this.currentPosition) { this.targetRotation = -currentBearing * Math.PI / 180; } else { this.targetRotation = 0; } let diff = this.targetRotation - this.currentRotation; if (diff > Math.PI) diff -= 2 * Math.PI; else if (diff < -Math.PI) diff += 2 * Math.PI; const oldRotation = this.currentRotation; this.currentRotation += diff * this.rotationSmoothing; if (Math.abs(this.currentRotation - oldRotation) > 0.0001) { this.requestRedraw(); this.weatherNeedsRedraw = true; } if (Math.abs(diff) < 0.001) { this.currentRotation = this.targetRotation; } }
        
        setMapMode(mode, save = true) {
            this.userSelectedMapMode = mode;
            let newProvider = '';
            if (mode === 'satellite') {
                newProvider = 'satellite';
                this.mapModeToggleBtn.classList.add('active');
            } else { // Handles 'auto', 'light', 'dark'
                this.mapModeToggleBtn.classList.remove('active');
                if (this.externalTheme) {
                    newProvider = this.externalTheme;
                } else {
                    const hour = new Date().getHours();
                    newProvider = (hour >= 6 && hour < 19) ? 'light' : 'dark';
                }
            }

            if (this.currentTileProvider !== newProvider) {
                this.currentTileProvider = newProvider;
                this.imageCache = {};
                this.failedTiles = {};
                this.loadingTiles.clear();
                this.requestRedraw();
            }

            if (save) {
                localStorage.setItem('teslaNavMapMode', this.userSelectedMapMode);
            }
        }
        
        loadMapMode() { const savedMode = localStorage.getItem('teslaNavMapMode') || 'auto'; this.setMapMode(savedMode, false); }
        
        startTimeOfDayChecker() {
            if (this.timeCheckInterval) clearInterval(this.timeCheckInterval);
            this.timeCheckInterval = setInterval(() => {
                if (this.userSelectedMapMode === 'auto' && !this.externalTheme) {
                    this.setMapMode('auto', false);
                }
            }, 300000);
        }
        
        startInteraction() { this.isFollowingUser = false; this.isUserInteracting = true; this.frozenBearing = this.vehicleOrientationBearing; if (this.animation) this.animation = null; if (this.compassMode === 'heading-up') { this.wasInHeadingUpMode = true; this.setCompassMode('north-up'); this.showInfoToast('Modalità North Up (automatica)', 'compass'); } this.requestRedraw(); if (this.isWeatherLayerVisible) { this.startWeatherRecenterTimer(); } else { this.startAutoRecenterTimer(); } }
        
        handleMouseDown(e) { this.startInteraction(); this.isDragging = true; this.dragStart = { x: e.clientX, y: e.clientY }; this.centerOnDragStart = { ...this.center }; this.mapContainer.classList.add('dragging'); }
        
        handleMouseMove(e) { if (this.isDragging) { const dx = e.clientX - this.dragStart.x; const dy = e.clientY - this.dragStart.y; this.panMap(dx, dy); } }
        
        handleMouseUp() { if(this.isDragging) { this.preloadWeatherFrames(5); } this.isDragging = false; this.mapContainer.classList.remove('dragging'); this.isUserInteracting = false; this.frozenBearing = null; }
        
        handleWheel(e) { e.preventDefault(); this.startInteraction(); const rect = this.mapContainer.getBoundingClientRect(); this.zoomAtPoint(e.deltaY > 0 ? -0.25 : 0.25, e.clientX - rect.left, e.clientY - rect.top); this.preloadWeatherFrames(5); }
        
        handleTouchStart(e) { e.preventDefault(); this.startInteraction(); if (e.touches.length === 2) { this.isDragging = false; this.touchStartDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY); } else if (e.touches.length === 1) { this.isDragging = true; this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; this.centerOnDragStart = { ...this.center }; } }
        
        handleTouchMove(e) { e.preventDefault(); if (e.touches.length === 2 && this.touchStartDist > 0) { const newDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY); const zoomFactor = (newDist / this.touchStartDist - 1) * 1.5; const rect = this.mapContainer.getBoundingClientRect(); const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left; const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top; this.zoomAtPoint(zoomFactor, midX, midY); this.touchStartDist = newDist; } else if (e.touches.length === 1 && this.isDragging) { const dx = e.touches[0].clientX - this.dragStart.x; const dy = e.touches[0].clientY - this.dragStart.y; this.panMap(dx, dy); } }
        
        handleTouchEnd(e) { if (e.touches.length < 2) { this.touchStartDist = 0; if (this.isDragging) this.preloadWeatherFrames(5); } if (e.touches.length === 0) { this.isDragging = false; this.isUserInteracting = false; this.frozenBearing = null; } }
        
        startWeatherRecenterTimer() { if (this.weatherOverviewRecenterTimer) clearTimeout(this.weatherOverviewRecenterTimer); this.weatherOverviewRecenterTimer = setTimeout(() => { if (!this.isUserInteracting && this.isWeatherOverviewActive) { this.showInfoToast("Tornando alla posizione...", "history"); this.isWeatherOverviewActive = false; this.recenterMap(); } }, 15000); }
        
        playPauseTimelapse() { this.isTimelapsePlaying ? this.stopTimelapse() : this.startTimelapse(); }
        
        startTimelapse() { if (this.timelapseInterval) clearInterval(this.timelapseInterval); this.isTimelapsePlaying = true; this.preloadWeatherFrames(5); this.timelapsePlayPauseBtn.innerHTML = \`<i data-lucide="pause" class="w-5 h-5"></i>\`; lucide.createIcons(); this.timelapseInterval = setInterval(() => { let nextFrame = this.currentWeatherFrame + 1; if (nextFrame >= this.weatherTimestamps.length) nextFrame = 0; this.setTimelapseFrame(nextFrame); this.preloadWeatherFrames(5); }, 500); }
        
        stopTimelapse() { clearInterval(this.timelapseInterval); this.timelapseInterval = null; this.isTimelapsePlaying = false; this.timelapsePlayPauseBtn.innerHTML = \`<i data-lucide="play" class="w-5 h-5"></i>\`; lucide.createIcons(); }

        preloadWeatherFrames(lookahead = 3) {
            if (!this.isWeatherLayerVisible || this.weatherTimestamps.length === 0) return;
            
            const { offsetWidth: width, offsetHeight: height } = this.mapContainer;
            const weatherZoom = Math.max(4, Math.min(this.MAX_WEATHER_TILE_ZOOM, Math.floor(this.zoom) - 1));
            
            const getWeatherTileUrl = (framePath, x, y, z) => {
                const maxTileIndex = Math.pow(2, z) - 1;
                if (y < 0 || y > maxTileIndex) return null;
                const wrappedX = ((x % (maxTileIndex + 1)) + (maxTileIndex + 1)) % (maxTileIndex + 1);
                return \`https://tilecache.rainviewer.com\${framePath}/512/\${z}/\${wrappedX}/\${y}/4/1_1.png\`;
            };

            const scaledTileSize = this.TILE_SIZE * Math.pow(2, this.zoom - weatherZoom);
            const centerTileX = this.lon2tile(this.center.lng, weatherZoom);
            const centerTileY = this.lat2tile(this.center.lat, weatherZoom);
            const tilesToLoad = Math.ceil(Math.hypot(width, height) / scaledTileSize / 2) + 1;

            for(let f = 0; f < lookahead; f++) {
                const frameIndex = (this.currentWeatherFrame + f) % this.weatherTimestamps.length;
                const frame = this.weatherTimestamps[frameIndex];
                if (!frame) continue;

                for (let i = Math.floor(centerTileX - tilesToLoad); i <= Math.ceil(centerTileX + tilesToLoad); i++) {
                    for (let j = Math.floor(centerTileY - tilesToLoad); j <= Math.ceil(centerTileY + tilesToLoad); j++) {
                        const url = getWeatherTileUrl(frame.path, i, j, weatherZoom);
                        if (url) {
                            this.loadTile(url, this.weatherImageCache);
                        }
                    }
                }
            }
        }
        
        updateTimelapseLabel() { if (!this.weatherTimestamps.length) { this.timelapseLabel.textContent = "Caricamento..."; return; } const frameTime = new Date(this.weatherTimestamps[this.currentWeatherFrame].time * 1000); const timeString = \`\${String(frameTime.getHours()).padStart(2, '0')}:\${String(frameTime.getMinutes()).padStart(2, '0')}\`; let status = (this.currentWeatherFrame < this.pastFramesCount - 1) ? 'Radar Passato' : (this.currentWeatherFrame === this.pastFramesCount - 1) ? 'Radar Ora' : 'Previsione'; this.timelapseLabel.innerHTML = \`\${status} <span class="font-semibold text-white">\${timeString}</span>\`; }
        
        updateTimelapseSliderStyle() { if (this.weatherTimestamps.length === 0) return; const totalFrames = this.weatherTimestamps.length - 1; const nowPosition = (this.pastFramesCount - 1) / totalFrames; const nowPercent = nowPosition * 100; const nowMarkerWidth = 1; const colorPast = '#4a6da7'; const colorNow = '#ffffff'; const colorFuture = '#3b82f6'; const gradient = \`linear-gradient(to right, \${colorPast} 0%, \${colorPast} \${nowPercent}%, \${colorNow} \${nowPercent}%, \${colorNow} \${nowPercent + nowMarkerWidth}%, \${colorFuture} \${nowPercent + nowMarkerWidth}%, \${colorFuture} 100%)\`; this.timelapseSlider.style.setProperty('--timelapse-gradient', gradient); }
        
        manualRecenter() { this.isViewingRoute = false; if (this.isWeatherOverviewActive) { this.isWeatherOverviewActive = false; if (this.weatherOverviewRecenterTimer) clearTimeout(this.weatherOverviewRecenterTimer); } if(this.autoRecenterTimer) clearTimeout(this.autoRecenterTimer); this.recenterMap(); }
        
        startAutoRecenterTimer() { if (this.autoRecenterTimer) clearTimeout(this.autoRecenterTimer); this.autoRecenterTimer = setTimeout(() => { if (!this.isFollowingUser && !this.isUserInteracting) { if (this.isViewingRoute) { this.fitBounds(); this.showInfoToast('Vista percorso ripristinata', 'route'); } else { this.recenterMap(); this.showInfoToast('Tracking riattivato', 'crosshair');}}}, 10000); }
        
        setCompassMode(mode) { if (this.compassMode === mode) return; this.vehicleMarkerEl.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.4, 1)'; this.compassMode = mode; const isHeadingUp = mode === 'heading-up'; document.getElementById('compass-north-icon').style.display = isHeadingUp ? 'none' : 'flex'; document.getElementById('compass-heading-icon').style.display = isHeadingUp ? 'flex' : 'none'; document.getElementById('compass-btn').classList.toggle('active', isHeadingUp); this.requestRedraw(); if (isHeadingUp) { this.recenterMap(); } void this.vehicleMarkerEl.offsetWidth; requestAnimationFrame(() => { this.vehicleMarkerEl.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.4, 1)'; }); }
        
        toggleCompassMode() { const newMode = this.compassMode === 'heading-up' ? 'north-up' : 'heading-up'; this.setCompassMode(newMode); this.showInfoToast(newMode === 'heading-up' ? 'Modalità Heading Up' : 'Modalità North Up', newMode === 'heading-up' ? 'navigation' : 'navigation-off'); }
        
        handlePositionUpdate(position) {
            const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
            if (this.currentPosition) {
                const bearing = this.calculateBearing(this.currentPosition.lat, this.currentPosition.lng, newPos.lat, newPos.lng);
                if (!this.isUserInteracting) {
                    this.vehicleOrientationBearing = this.smoothBearing(this.vehicleOrientationBearing, bearing);
                }
            }
            this.currentPosition = newPos;

            if (this.pendingDestination) {
                const { coords, name, startNavigating } = this.pendingDestination;
                this.pendingDestination = null; // Important: clear it
                this.setDestination(coords, name, startNavigating);
            }
            
            if (this.isFollowingUser && !this.isUserInteracting) {
                this.center = newPos;
                this.requestRedraw();
            }
            if (this.isNavigating && !this.isRecalculating) {
                this.checkRouteDeviation();
                this.updateRouteProgress();
            }
        }
        
        drawRoute(ctx) { if (!this.routeGeometry) return; const upcomingPath = new Path2D(); const consumedPath = new Path2D(); const worldWidthInPixels = Math.pow(2, this.zoom) * this.TILE_SIZE; for(let i = 0; i < this.routeGeometry.length - 1; i++) { const p1 = this.geoToScreenPx(this.routeGeometry[i][1], this.routeGeometry[i][0]); const p2 = this.geoToScreenPx(this.routeGeometry[i+1][1], this.routeGeometry[i+1][0]); if (Math.abs(p1.x - p2.x) > worldWidthInPixels / 2) continue; const path = (i < this.currentStepIndex) ? consumedPath : upcomingPath; path.moveTo(p1.x, p1.y); path.lineTo(p2.x, p2.y); } const lineWidth = Math.max(4, Math.min(10, 7 * Math.pow(2, this.zoom - 15))); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--route-consumed-color'); ctx.lineWidth = lineWidth; ctx.stroke(consumedPath); ctx.shadowColor = getComputedStyle(document.documentElement).getPropertyValue('--route-glow-color'); ctx.shadowBlur = 15; ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--route-upcoming-color'); ctx.lineWidth = lineWidth; ctx.stroke(upcomingPath); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
        
        updateUiElements() { if(this.currentPosition) { const currentBearing = this.frozenBearing ?? this.vehicleOrientationBearing; let diff = currentBearing - this.smoothedCompassIconBearing; if (diff > 180) diff -= 360; else if (diff < -180) diff += 360; this.smoothedCompassIconBearing = (this.smoothedCompassIconBearing + diff * this.trackingConfig.compassIconSmoothing + 360) % 360; document.getElementById('compass-letters-container').style.transform = \`rotate(\${this.smoothedCompassIconBearing}deg)\`; } this.updateVehicleMarkerPosition(); if (this.destination) this.updateDestinationMarkerPosition();}
        
        updateVehicleMarkerPosition() { if (!this.currentPosition) return; const currentBearing = this.frozenBearing ?? this.vehicleOrientationBearing; const markerPos = this.geoToScreenPxWithRotation(this.currentPosition.lat, this.currentPosition.lng); const iconRotation = this.compassMode === 'heading-up' ? 0 : currentBearing; this.vehicleMarkerEl.style.left = \`\${markerPos.x}px\`; this.vehicleMarkerEl.style.top = \`\${markerPos.y}px\`; this.vehicleMarkerEl.style.transform = \`translate(-50%, -50%) rotate(\${iconRotation}deg)\`; }
        
        updateDestinationMarkerPosition() { if (!this.destination || !this.destinationMarker) return; const markerPos = this.geoToScreenPxWithRotation(this.destination.lat, this.destination.lng); this.destinationMarker.style.left = \`\${markerPos.x}px\`; this.destinationMarker.style.top = \`\${markerPos.y}px\`; }
        
        lon2tile(lon, zoom) { return (lon + 180) / 360 * Math.pow(2, zoom); }
        
        lat2tile(lat, zoom) { return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom); }
        
        tile2lon(x, z) { return (x / Math.pow(2, z) * 360 - 180); }
        
        tile2lat(y, z) { const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))); }
        
        geoToScreenPxWithRotation(lat, lng) { const { offsetWidth, offsetHeight } = this.mapContainer; let p = this.geoToScreenPx(lat, lng); const currentBearing = this.frozenBearing ?? this.vehicleOrientationBearing; if (this.compassMode === 'heading-up' && this.currentPosition) { const angle = -currentBearing * Math.PI / 180; const cx = offsetWidth / 2, cy = offsetHeight / 2; const rotatedX = Math.cos(angle) * (p.x - cx) - Math.sin(angle) * (p.y - cy) + cx; const rotatedY = Math.sin(angle) * (p.x - cx) + Math.cos(angle) * (p.y - cy) + cy; return { x: rotatedX, y: rotatedY }; } return p;}
        
        geoToScreenPx(lat, lng) { const { offsetWidth, offsetHeight } = this.mapContainer; const centerTileX = this.lon2tile(this.center.lng, this.zoom); const centerTileY = this.lat2tile(this.center.lat, this.zoom); const pointTileX = this.lon2tile(lng, this.zoom); const pointTileY = this.lat2tile(lat, this.zoom); return { x: (pointTileX - centerTileX) * this.TILE_SIZE + offsetWidth / 2, y: (pointTileY - centerTileY) * this.TILE_SIZE + offsetHeight / 2 };}
        
        screenPxToGeo(px, py) { const { offsetWidth, offsetHeight } = this.mapContainer; let tdx = px - offsetWidth / 2, tdy = py - offsetHeight / 2; if (this.compassMode === 'heading-up' && this.currentPosition) { const angle = this.currentRotation; const rdx = tdx * Math.cos(-angle) - tdy * Math.sin(-angle); const rdy = tdx * Math.sin(-angle) + tdy * Math.cos(-angle); tdx = rdx; tdy = rdy;} const centerTileX = this.lon2tile(this.center.lng, this.zoom); const centerTileY = this.lat2tile(this.center.lat, this.zoom); return { lat: this.tile2lat(centerTileY + tdy / this.TILE_SIZE, this.zoom), lng: this.tile2lon(centerTileX + tdx / this.TILE_SIZE, this.zoom) };}
        
        calculateBearing(lat1, lon1, lat2, lon2){ const dLon = (lon2 - lon1) * Math.PI / 180; const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180); const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; }
        
        calculateGeoDistance(lat1, lon1, lat2, lon2) {
            const R = 6371; // Raggio della Terra in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        }

        smoothBearing(t,e){let i=e-t;if(i>180)i-=360;if(i<-180)i+=360;return(t+i*this.trackingConfig.bearingSmoothing+360)%360}
        
        normalizeString(str) { return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/'/g, "").trim(); }
        
        async searchLocations(query) { this.searchLoading.classList.remove('hidden'); this.searchResults.innerHTML = ''; this.noResults.classList.add('hidden'); this.searchResultsContainer.classList.remove('hidden'); try { const response = await fetch(\`https://api.geoapify.com/v1/geocode/search?text=\${encodeURIComponent(query)}&lang=it&apiKey=\${this.geoapifyApiKey}\`); const data = await response.json(); if (data.features?.length) { const normalizedQuery = this.normalizeString(query); data.features.sort((a, b) => { const nameA = this.normalizeString(a.properties.name || a.properties.formatted); const nameB = this.normalizeString(b.properties.name || b.properties.formatted); if (nameA.startsWith(normalizedQuery) && !nameB.startsWith(normalizedQuery)) return -1; if (!nameA.startsWith(normalizedQuery) && nameB.startsWith(normalizedQuery)) return 1; return 0; }); this.displaySearchResults(data.features);} else { this.noResults.classList.remove('hidden');}} catch (searchError) { console.error('Errore ricerca:', searchError); this.noResults.classList.remove('hidden');} finally { this.searchLoading.classList.add('hidden');}}
        
        displaySearchResults(results) { this.searchResults.innerHTML = ''; results.forEach(result => { const { name, formatted } = result.properties; const [lng, lat] = result.geometry.coordinates; const item = document.createElement('div'); item.className = 'search-result-item'; item.innerHTML = \`<div class="search-result-name">\${name || formatted}</div><div class="search-result-address">\${formatted}</div>\`; item.onclick = () => { this.setDestination({ lat, lng }, name || formatted); this.hideSearchResults(); }; this.searchResults.appendChild(item); }); }
        
        hideSearchResults() { this.searchResultsContainer.classList.add('hidden');}
        
        async fetchAndSetRoute(startCoords, endCoords) {
            const url = \`https://api.geoapify.com/v1/routing?waypoints=\${startCoords.lat},\${startCoords.lng}|\${endCoords.lat},\${endCoords.lng}&mode=drive&details=route_details&lang=it&apiKey=\${this.geoapifyApiKey}\`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data.features?.length) {
                    const route = data.features[0];
                    this.routeGeometry = route.geometry.coordinates[0];
                    this.tripInfo = route.properties;
                    this.requestRedraw();
                    try {
                        window.parent.postMessage({
                            type: 'ROUTE_UPDATED',
                            payload: {
                                geometry: this.routeGeometry,
                                info: this.tripInfo,
                                target: {
                                    lat: endCoords.lat,
                                    lng: endCoords.lng,
                                    name: this.searchInput.value
                                }
                            }
                        }, '*');
                    } catch (e) {
                        console.error("Map communication error (route update):", e);
                    }
                    return true;
                }
                return false;
            } catch (routeError) {
                console.error("Errore routing:", routeError);
                return false;
            }
        }
        
        startNavigation() { if (!this.routeGeometry) return; this.isNavigating = true; this.isViewingRoute = false; this.currentStepIndex = 0; this.updateUIVisibility(); this.recenterMap(); this.showInfoToast("Navigazione avviata!", "navigation");}
        
        _clearRouteInternals() {
            this.isNavigating = false;
            this.isViewingRoute = false;
            this.currentStepIndex = 0;
            this.destination = null;
            this.routeGeometry = null;
            this.tripInfo = null;
            if (this.destinationMarker) {
                this.destinationMarker.remove();
                this.destinationMarker = null;
            }
            this.updateUIVisibility();
            this.requestRedraw();
        }
        
        clearRouteAndNotify() { 
            this._clearRouteInternals(); 
            this.searchInput.value = ''; 
            this.clearSearchBtn.style.display = 'none'; 
            this.showInfoToast("Percorso annullato", "x-circle"); 
            this.recenterMap();
            try {
                window.parent.postMessage({ type: 'ROUTE_CLEARED' }, '*');
            } catch (e) {
                console.error("Map communication error (route clear):", e);
            }
        }
        
        updateUIVisibility() { if (this.isNavigating) { document.getElementById('search-panel').classList.add('hidden'); this.tripInfoPanel.classList.remove('visible'); this.endTripContainer.classList.remove('hidden');} else { document.getElementById('search-panel').classList.remove('hidden'); this.endTripContainer.classList.add('hidden'); if (this.routeGeometry) { this.tripInfoPanel.classList.add('visible'); } else { this.tripInfoPanel.classList.remove('visible'); }}}
        
        updateTripInfoPanel() { if (!this.tripInfo) return; const distance = (this.tripInfo.distance / 1000).toFixed(1); const hours = Math.floor(this.tripInfo.time / 3600); const minutes = Math.round((this.tripInfo.time % 3600) / 60); this.tripDurationEl.textContent = (hours > 0 ? \`\${hours} h \` : '') + \`\${minutes} min\`; this.tripDistanceEl.textContent = \`\${distance} km\`; this.updateUIVisibility();}
        
        fitBounds() { if (!this.currentPosition || !this.routeGeometry) return; this.isFollowingUser = false; this.isViewingRoute = true; if(this.autoRecenterTimer) clearTimeout(this.autoRecenterTimer); const points = [this.currentPosition, ...this.routeGeometry.map(p => ({lng: p[0], lat: p[1]}))]; let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180; points.forEach(p => { if(!p) return; minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng); }); const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }; const { offsetWidth, offsetHeight } = this.mapContainer; const dLng = maxLng - minLng, dLat = maxLat - minLat; if (dLng === 0 && dLat === 0) { this.flyTo({ center, zoom: 15 }); return; } const zoomX = dLng > 0 ? Math.log2((offsetWidth - 80) * 360 / (dLng * this.TILE_SIZE)) : this.MAX_ZOOM; const zoomY = dLat > 0 ? Math.log2((offsetHeight - 120) * 180 / (dLat * this.TILE_SIZE)) : this.MAX_ZOOM; const zoom = Math.max(this.MIN_ZOOM, Math.min(zoomX, zoomY, this.MAX_ZOOM - 0.5)); this.flyTo({ center, zoom: zoom - 0.3 }); }
        
        async recalculateRoute() { if (this.isRecalculating || !this.destination) return; this.isRecalculating = true; this.showInfoToast('Ricalcolo percorso...', 'refresh-cw'); const success = await this.fetchAndSetRoute(this.currentPosition, this.destination); if (success) { this.currentStepIndex = 0; this.updateTripInfoPanel(); this.showInfoToast('Percorso aggiornato!', 'check-circle');} else { this.showInfoToast("Errore nel ricalcolo", "alert-triangle"); this.clearRouteAndNotify();} this.isRecalculating = false;}
        
        checkRouteDeviation() { const { routeGeometry, currentPosition } = this; if (!routeGeometry || !currentPosition) return; const { distance } = this.findClosestPointOnRoute(currentPosition, routeGeometry); if (distance > 70) { this.recalculateRoute();}}
        
        updateRouteProgress() { const { routeGeometry, currentPosition } = this; if (!routeGeometry || !currentPosition) return; const { index } = this.findClosestPointOnRoute(currentPosition, routeGeometry); if (index > this.currentStepIndex) { this.currentStepIndex = index; this.requestRedraw();}}
        
        findClosestPointOnRoute(point, route) { let minDistance = Infinity; let closestIndex = 0; for (let i = 0; i < route.length - 1; i++) { const p1 = {lat: route[i][1], lng: route[i][0]}; const p2 = {lat: route[i+1][1], lng: route[i+1][0]}; const distance = this.pointToSegmentDistance(point, p1, p2); if (distance < minDistance) { minDistance = distance; closestIndex = i;}} return { distance: minDistance, index: closestIndex };}
        
        pointToSegmentDistance(p, p1, p2) { const latRad = p.lat * (Math.PI / 180); const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad); const mPerDegLon = 111320 * Math.cos(latRad); const dx = (p2.lng - p1.lng) * mPerDegLon; const dy = (p2.lat - p1.lat) * mPerDegLat; const lenSq = dx * dx + dy * dy; if (lenSq === 0) return Math.hypot((p.lng - p1.lng) * mPerDegLon, (p.lat - p1.lat) * mPerDegLat); let t = ((p.lng - p1.lng) * mPerDegLon * dx + (p.lat - p1.lat) * mPerDegLat * dy) / lenSq; t = Math.max(0, Math.min(1, t)); const closestLng = p1.lng + t * (p2.lng - p1.lng); const closestLat = p1.lat + t * (p2.lat - p1.lat); return Math.hypot((p.lng - closestLng) * mPerDegLon, (p.lat - closestLat) * mPerDegLat);}
        
        showInfoToast(text, icon = 'info', duration = 3000) { const toast = document.getElementById('info-toast'); toast.querySelector('#info-toast-icon').setAttribute('data-lucide', icon); toast.querySelector('#info-toast-text').textContent = text; toast.classList.add('show'); lucide.createIcons(); setTimeout(() => toast.classList.remove('show'), duration);}
    
    }

    window.teslaNav = new TeslaNavigation();
    
    // Process any queued message that arrived before initialization
    if (window.pendingNavMessage) {
        const { lat, lng, name } = window.pendingNavMessage.payload;
        window.teslaNav.setDestination({ lat, lng }, name, true);
        window.pendingNavMessage = null; // Clear it
    }
    // Signal to parent that the map is ready to receive commands
    window.parent.postMessage({ type: 'MAP_IFRAME_READY' }, '*');
});
</script>

</body>
</html>
`;

export default function MapsContainer({ 
    isOpen, 
    onClose,
    isNight,
    searchPanelWidth,
    searchPanelTop,
    navigationTarget,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    isNight: boolean;
    searchPanelWidth: number;
    searchPanelTop: number;
    navigationTarget: { lat: number, lng: number, name: string } | null;
}) {
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
  const [translateX, setTranslateX] = useState(100);
  const animationFrameId = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);

  const openingBoxSpeed = 4.5;
  const closingBoxSpeed = 8.6;

  const finalMapHtml = useMemo(() => {
    const dynamicStyles = `
      <style>
        :root {
          --maps-search-panel-width: ${searchPanelWidth}px;
          --maps-search-panel-top: ${searchPanelTop}px;
        }
      </style>
    `;
    return mapHtmlContent.replace('</head>', `${dynamicStyles}</head>`);
  }, [searchPanelWidth, searchPanelTop]);

  const postMessageToIframe = useCallback((message: object) => {
    if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(message, '*');
    }
  }, []);

  // Listen for the "ready" message from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
        // We now check if the map has already been marked as ready.
        // This prevents state updates if a 'ready' message is somehow sent multiple times.
        if (event.data?.type === 'MAP_IFRAME_READY' && !isIframeReady) {
            setIsIframeReady(true);
        }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isIframeReady]); // Dependency added to prevent re-subscribing unnecessarily.


  // This single, robust effect handles sending the destination to the iframe.
  // It triggers whenever the map is opened (`isOpen`), a new target is selected (`navigationTarget`),
  // or the iframe itself becomes ready. This solves the bug where re-selecting the same
  // destination would not work.
  useEffect(() => {
    if (isOpen && navigationTarget && isIframeReady) {
        postMessageToIframe({ type: 'SET_DESTINATION', payload: navigationTarget });
    }
  }, [isOpen, navigationTarget, isIframeReady, postMessageToIframe]);


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
    let lastTime = performance.now();
    const animate = (now: number) => {
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        setTranslateX(currentX => {
            const target = isOpen ? 0 : 100;
            const speed = isOpen ? openingBoxSpeed : closingBoxSpeed;
            const damp = 1 - Math.exp(-speed * delta);
            const newX = currentX + (target - currentX) * damp;
            if (Math.abs(target - newX) < 0.1) {
                if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
                return target;
            }
            return newX;
        });
        animationFrameId.current = requestAnimationFrame(animate);
    };
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    animationFrameId.current = requestAnimationFrame(animate);
    return () => {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isOpen, openingBoxSpeed, closingBoxSpeed]);

  return (
    <div 
        className={`fixed top-0 right-0 bottom-20 w-2/3 text-white shadow-2xl z-20 flex spotify-app-panel`}
        style={{ transform: `translateX(${translateX}%)` }}
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-labelledby="maps-player-title"
        onClick={stopPropagation}
    >
        <div className="w-full h-full flex flex-col relative bg-[#050505]">
            <h1 id="maps-player-title" className="sr-only">Maps Player</h1>
            
            <iframe
                ref={iframeRef}
                title="Tesla Navigation"
                srcDoc={finalMapHtml}
                allow="geolocation"
                className="w-full h-full border-none"
            ></iframe>
        </div>
    </div>
  );
}
