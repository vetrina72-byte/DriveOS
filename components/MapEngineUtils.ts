export const GK = '0d2c9c7f72c0477eb3260838db72a383';
export const OSRM_URL = 'https://routing.openstreetmap.de/routed-car/route/v1/driving/';

export function buildMapStyle(theme: 'light' | 'dark' | 'satellite'): any {
    const K = 'c8deb6d53bc6a94d';
    if (theme === 'light') return `https://api.protomaps.com/styles/v5/white/it.json?key=${K}`;
    if (theme === 'dark') return `https://api.protomaps.com/styles/v5/black/it.json?key=${K}`;

    return {
        version: 8,
        glyphs: `https://api.protomaps.com/fonts/v3/{fontstack}/{range}.pbf?key=${K}`,
        sprite: 'https://api.protomaps.com/sprites/v4/light/it',
        sources: {
            sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Esri' },
            protomaps: { type: 'vector', tiles: [`https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=${K}`], maxzoom: 15 }
        },
        layers: [
            { id: 'sat-layer', type: 'raster', source: 'sat', minzoom: 0, maxzoom: 24 },
            {
                id: 'lbl-places', type: 'symbol', source: 'protomaps', 'source-layer': 'places', minzoom: 0,
                layout: {
                    'text-field': ['coalesce', ['get', 'name:it'], ['get', 'name']],
                    'text-font': ['case', ['<=', ['get', 'pmap:rank'], 2], ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]],
                    'text-transform': ['case', ['<=', ['get', 'pmap:rank'], 2], 'uppercase', 'none'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 0, 10, 2, ['case', ['<=', ['get', 'pmap:rank'], 2], 12, 0], 4, 11, 8, 14, 16, 18],
                    'text-max-width': 8, 'text-anchor': 'center', 'symbol-sort-key': ['get', 'pmap:rank'],
                    'text-allow-overlap': false, 'text-ignore-placement': false
                },
                paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.7)', 'text-halo-width': 2, 'text-halo-blur': 1 }
            },
            { id: 'lbl-roads', type: 'symbol', source: 'protomaps', 'source-layer': 'roads', minzoom: 13, layout: { 'text-field': ['coalesce', ['get', 'name:it'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 16, 14], 'symbol-placement': 'line', 'text-max-angle': 30 }, paint: { 'text-color': '#f0f0f0', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5 } },
            { id: 'lbl-poi', type: 'symbol', source: 'protomaps', 'source-layer': 'pois', minzoom: 14, layout: { 'text-field': ['coalesce', ['get', 'name:it'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, 0.5], 'text-max-width': 6 }, paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.5 } }
        ]
    };
}

export function drawArrow(key: string) {
    const paths: Record<string, string> = {
        straight: `<path d="m435-688-59 59q-14 14-32.5 14T312-629q-14-13-14-31.5t14-32.5l136-137q12-12 32-12t33 12l136 137q13 14 13 32.5T649-629q-13 13-32 13.5T585-629l-59-59v543q0 21-13.5 33.5T480-99q-19 0-32-12.5T435-145v-543Z"/>`,
        right: `<path d="M263-182v-329q0-39 27.5-66.5T357-605h328l-56-57q-15-14-15-32.5t14.5-33Q643-742 662-742t33 14l137 136q14 14 14 34t-14 34L695-388q-14 15-32.5 14.5t-33-15Q615-403 615-422t14-33l56-56H357v329q0 20-13.5 33.5T310-135q-20 0-33.5-13.5T263-182Z"/>`,
        left: `<path d="m275-511 57 56q14 15 13.5 34t-15 33.5Q316-373 297.5-373T264-388L128-524q-14-14-14-34t14-34l137-136q14-15 33-15t33.5 14.5Q346-714 346-695t-14 33l-57 57h328q39 0 66.5 27.5T697-511v329q0 20-13.5 33.5T650-135q-20 0-33.5-13.5T603-182v-329H275Z"/>`,
        'slight-right': `<path d="M356.5-148.63Q343-162.25 343-182v-266q0-18.09 7.5-35.54Q358-501 371-514l216-217h-79q-20.75 0-34.37-13.68Q460-758.35 460-778.18 460-798 473.63-812q13.62-14 34.37-14h193q19.75 0 33.88 14.12Q749-797.75 749-778v193q0 20.75-14.18 34.37-14.17 13.63-34 13.63-19.82 0-33.32-13.63Q654-564.25 654-585v-79L437-448v266q0 19.75-13.68 33.37Q409.65-135 389.82-135q-19.82 0-33.32-13.63Z"/>`,
        'slight-left': `<path d="M542.5-148.63Q529-162.25 529-182v-266L312-664v79q0 20.75-13.68 34.37Q284.65-537 264.82-537q-19.82 0-33.32-13.63Q218-564.25 218-585v-193q0-19.75 13.63-33.88Q245.25-826 265-826h194q19.75 0 33.38 14.18 13.62 14.17 13.62 34 0 19.82-13.62 33.32Q478.75-731 459-731h-80l216 217q13 13 20.5 30.46Q623-466.09 623-448v266q0 19.75-13.68 33.37Q595.65-135 575.82-135q-19.82 0-33.32-13.63Z"/>`,
        'sharp-right': `<path d="M246.5-108.63Q233-122.25 233-142v-211q0-38.8 27.6-66.4Q288.2-447 327-447h306v-239l-57 57q-14 15-33 15t-33-14.43q-14-14.43-14-33T510-695l136-136q14.36-14 34.18-14T714-831l136 136q14 14.53 14 33.27 0 18.73-14 33.23-14 14.5-33 14.5t-33-15l-57-57v239q0 38.8-27.6 66.4Q671.8-353 633-353H327v211q0 19.75-13.68 33.37Q299.65-95 279.82-95 260-95 246.5-108.63Z"/>`,
        'sharp-left': `<path d="M633-142v-211H327q-38.77 0-66.39-27.61Q233-408.23 233-447v-239l-57 57q-14 15-33 15t-33-14.5Q96-643 96-661.73q0-18.74 14-33.27l136-136q14.73-14 34.36-14Q300-845 314-831l136 136q14 14.53 14 33.27 0 18.73-14 33.23-14 14.5-33 14.5t-33-15l-57-57v239h306q38.77 0 66.39 27.61Q727-391.77 727-353v211q0 19.75-13.68 33.37Q699.65-95 679.82-95 660-95 646.5-108.63 633-122.25 633-142Z"/>`,
        uturn: `<path d="M249.5-277q-8.5-4-15.5-11L98-424q-15-14-15-33t15-33q14-14 32.5-14t33.5 14l57 57v-172q0-108 76-184.5T481.5-866q108.5 0 185 76.5T743-605v434q0 20-14 33.5T695-124q-20 0-33.5-13.5T648-171v-434q0-69-48.5-117.5t-118-48.5q-69.5 0-118 48.5T315-605v172l59-58q14-14 31.5-13.5T437-490q15 15 15 33.5T438-424L302-288q-7 7-16 11t-18.5 4q-9.5 0-18-4Z"/>`,
        'uturn-right': `<path d="M234.5-137.5Q221-151 221-171v-434q0-108 76-184.5T481.5-866q108.5 0 185 76.5T743-605v172l57-57q14-14 32.5-14t33.5 14q14 14 14 33t-14 33L729-288q-7 7-15.5 11t-18 4q-9.5 0-18.5-4t-15-11L525-424q-14-14-14-32.5t15-33.5q14-14 31.5-14.5T590-491l58 58v-172q0-69-48.5-117.5t-118-48.5q-69.5 0-118 48.5T315-605v434q0 20-13.5 33.5T268-124q-20 0-33.5-13.5Z"/>`,
        roundabout: `<path d="M601-172v-198q0-29 17.58-51.1T665-448q63.14-7.28 104.57-52.67Q811-546.06 811-607.94q0-68.06-47.26-115.56Q716.47-771 648-771q-62.42 0-108.71 42Q493-687 487-624q-4.68 25.84-27.77 44.42Q436.14-561 409-561H234l57 57q13 14 13.5 33T292-438q-14 14-33.5 14T226-438L89-575q-7-6-11-15t-4-18.5q0-9.5 4.05-18.1Q82.09-635.2 89-642l137-137q14.25-14.17 33.13-13.58Q278-792 292-779q14 14.53 14 33.27Q306-727 292-713l-58 57h163q15-91 87-150.5T648.09-866q106.88 0 182.39 75.52Q906-714.97 906-608.09 906-516 846.5-444T696-357v185q0 20-14.09 33.5t-34 13.5q-19.91 0-33.41-13.5Q601-152 601-172Z"/>`,
        'roundabout-right': `<path d="M265-172v-185q-91-16-150.5-87T55-608q0-107 75-182.5T313-866q93 0 164 59.5T564-656h163l-57-57q-14-14-14-33t13-33q14-14 33-14t33 14l137 137q7 7 11 15.5t4 18q0 9.5-4 18.5t-11 15L735-438q-14 14-33 14t-33-14q-13-14-13-33t13-32l58-58H552q-29 0-51.5-17.5T474-624q-7-63-52.5-105T313-771q-68 0-115.5 47.5T150-608q0 62 41.5 107.5T296-448q28 5 46 27t18 51v198q0 20-13.5 33.5t-34 13.5q-20.5 0-34-13.5T265-172Z"/>`,
        arrive: `<path d="M480-334 274-128q-14 15-33 14.5T208-128q-14-14-14-32.5t14-33.5l190-190q21-21 28-38t7-53v-211l-57 57q-14 15-33 15t-33-15q-14-14-14-32.5t14-33.5l136-136q14-14 34-14t34 14l136 136q14 15 14 33.5T650-629q-14 15-33 15t-33-14l-57-58v211q0 36 7 53t28 38l190 190q14 15 14 34t-14 32q-14 15-33 15t-33-15L480-334Z"/>`,
        depart: `<path d="M326.5-198.62Q263-262.24 263-353.29q0-83.28 50.5-137.99Q364-546 433-565v-161l-50 50q-15.5 14-33.75 14.5T317-676q-15-14-15-33t15-33l130-131q7.16-6 15.68-10t17.4-4q8.88 0 17.4 4 8.52 4 15.52 10l130 131q15 14 15 32.97 0 18.98-14.09 33.5Q630-661 610.7-661T577-676l-50-50v161q69 19 119.5 73.72Q697-436.57 697-353.29q0 91.05-63.5 154.67Q570-135 480-135t-153.5-63.62ZM567-265.65q36-35.64 36-87 0-51.35-36-86.85-36-35.5-87-35.5t-87 35.65q-36 35.64-36 87 0 51.35 36 86.85 36 35.5 87 35.5t87-35.65ZM480-353Z"/>`,
        merge: `<path d="M480-334 274-128q-14 15-33 14.5T208-128q-14-14-14-32.5t14-33.5l190-190q21-21 28-38t7-53v-211l-57 57q-14 15-33 15t-33-15q-14-14-14-32.5t14-33.5l136-136q14-14 34-14t34 14l136 136q14 15 14 33.5T650-629q-14 15-33 15t-33-14l-57-58v211q0 36 7 53t28 38l190 190q14 15 14 34t-14 32q-14 15-33 15t-33-15L480-334Z"/>`,
        'merge-right': `<path d="M225-201.43Q225-220 239-235l192-191v-259l-72 72q-14.36 14-33.18 13.5T293-614q-14-14-14-33.3 0-19.3 14-33.7l151-152q7.16-6 16.18-10.5t17.9-4.5q8.88 0 17.9 4.5Q505-839 512-833l152 153q14 14.36 14 33.18T664-614q-14 14-33.3 14-19.3 0-33.7-14l-72-71v258q0 18.51-7.5 36.26Q510-373 497-359L305-168q-14 15-33 14.5t-33-14.93q-14-14.43-14-33Zm491.09 32.34Q702-155 682.5-155q-19.5 0-33.5-14l-96-95q-14-14-13.5-33.43t14.03-32.5q13.52-14.07 33-14.07Q606-344 620-330l96 95q14.17 14.75 13.58 33.37-.58 18.63-13.49 32.54Z"/>`,
        'ramp-right': `<path d="M444.5-108.5Q431-122 431-142v-189q-25 31-61 61.5T289-212q-19 13-40.5 11T211-218q-14-14-8.5-33t23.5-32q121-79 163-141.5T431-565v-121l-57 57q-14 15-33 14.5T308-629q-14-14-14-33t14-33l136-137q7-7 16-11t18-4q9 0 18 4t16 11l136 137q14 14 14 33t-14 33q-14 14-33 14t-33-14l-57-57v544q0 20-13.5 33.5T478-95q-20 0-33.5-13.5Z"/>`,
        'ramp-left': `<path d="M435-142v-544l-57 57q-14 14-33 14t-33-14q-14-14-14-33t14-33l136-137q7-7 16-11t18-4q9 0 18 4t16 11l136 137q14 14 14 33t-14 33q-14 14-33 14.5T586-629l-57-57v121q0 78 42 140.5T735-283q17 13 22.5 32t-8.5 33q-16 15-37.5 17T671-212q-45-27-81-57.5T529-331v189q0 20-13.5 33.5T482-95q-20 0-33.5-13.5T435-142Z"/>`,
        'keep-right': `<path d="M356.5-148.63Q343-162.25 343-182v-266q0-18.09 7.5-35.54Q358-501 371-514l216-217h-79q-20.75 0-34.37-13.68Q460-758.35 460-778.18 460-798 473.63-812q13.62-14 34.37-14h193q19.75 0 33.88 14.12Q749-797.75 749-778v193q0 20.75-14.18 34.37-14.17 13.63-34 13.63-19.82 0-33.32-13.63Q654-564.25 654-585v-79L437-448v266q0 19.75-13.68 33.37Q409.65-135 389.82-135q-19.82 0-33.32-13.63Z"/>`,
        'keep-left': `<path d="M542.5-148.63Q529-162.25 529-182v-266L312-664v79q0 20.75-13.68 34.37Q284.65-537 264.82-537q-19.82 0-33.32-13.63Q218-564.25 218-585v-193q0-19.75 13.63-33.88Q245.25-826 265-826h194q19.75 0 33.38 14.18 13.62 14.17 13.62 34 0 19.82-13.62 33.32Q478.75-731 459-731h-80l216 217q13 13 20.5 30.46Q623-466.09 623-448v266q0 19.75-13.68 33.37Q595.65-135 575.82-135q-19.82 0-33.32-13.63Z"/>`
    };
    return paths[key] || paths.straight;
}

export function getKey(step: any) {
    if (!step || !step.maneuver) return 'straight';
    const t = (step.maneuver.type || '').toLowerCase();
    const m = (step.maneuver.modifier || '').toLowerCase();
    if (t === 'arrive') return 'arrive';
    if (t === 'depart') return 'depart';

    if (t === 'continue' || t === 'new name' || t === 'notification' || (t === 'turn' && m === 'straight')) return 'straight';

    if (t === 'on ramp' || t === 'off ramp') { return m.includes('left') ? 'ramp-left' : 'ramp-right'; }
    if (t.includes('roundabout') || t.includes('rotary')) { return m.includes('left') ? 'roundabout' : 'roundabout-right'; }
    if (t === 'merge') { return m.includes('right') ? 'merge-right' : 'merge'; }
    if (m === 'uturn') { return m.includes('right') ? 'uturn-right' : 'uturn'; }
    if (m.includes('keep') || t === 'fork') { if (m.includes('left')) return 'keep-left'; if (m.includes('right')) return 'keep-right'; return 'keep-right'; }
    if (m === 'sharp right') return 'sharp-right'; if (m === 'right') return 'right'; if (m === 'slight right') return 'slight-right';
    if (m === 'sharp left') return 'sharp-left'; if (m === 'left') return 'left'; if (m === 'slight left') return 'slight-left';
    return 'straight';
}

export function formatDist(m: number) {
    if (m >= 1000) return (m / 1000).toFixed(1) + ' km';
    if (m >= 100) return Math.round(m / 10) * 10 + ' m';
    return Math.round(m) + ' m';
}

export function buildInstr(step: any) {
    if (!step) return '';
    const t = (step.maneuver.type || '').toLowerCase();
    const m = (step.step_modifier || step.maneuver.modifier || '').toLowerCase();
    const name = step.name || '';
    const ref = step.ref || '';
    const road = name || ref || '';
    const ex = step.maneuver.exit;
    const IT: any = { right: 'a destra', 'slight right': 'leggermente a destra', 'sharp right': 'nettamente a destra', left: 'a sinistra', 'slight left': 'leggermente a sinistra', 'sharp left': 'nettamente a sinistra', straight: 'dritto', uturn: 'inversione a U' };
    if (t === 'depart') return road ? 'Verso ' + road : 'Parti';
    if (t === 'arrive') return 'Arrivo';
    if (t === 'roundabout' || t === 'rotary') { const ex2 = ex ? ' - ' + ex + 'ª uscita' : ''; return 'Rotonda' + ex2 + (road ? ' su ' + road : ''); }
    if (t === 'exit roundabout' || t === 'exit rotary') return 'Esci' + (road ? ' su ' + road : '');
    if (t === 'merge') return 'Immettiti' + (road ? ' su ' + road : '');
    if (t === 'on ramp') return 'Rampa' + (road ? ' per ' + road : '');
    if (t === 'off ramp') return 'Uscita' + (road ? ' per ' + road : '');
    if (t === 'fork') { const fd2 = IT[m] ? 'Tieni ' + IT[m] : 'Tieni la destra/sinistra'; return fd2 + (road ? ' su ' + road : ''); }
    if (t === 'turn') { if (m === 'uturn') return 'Inversione a U'; if (m === 'straight') return road ? 'Prosegui su ' + road : 'Prosegui dritto'; const td = IT[m] || ''; if (!td) return road ? 'Vai su ' + road : 'Svolta'; return 'Svolta ' + td + (road ? ' su ' + road : ''); }
    if (t === 'new name') return road ? 'Su ' + road : 'Prosegui';
    if (t === 'continue') return road ? 'Continua su ' + road : 'Continua';
    return road ? road : 'Prosegui';
}

export function bear(la1: number, lo1: number, la2: number, lo2: number) {
    const d = (lo2 - lo1) * Math.PI / 180;
    const y = Math.sin(d) * Math.cos(la2 * Math.PI / 180);
    const x = Math.cos(la1 * Math.PI / 180) * Math.sin(la2 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.cos(d);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function dist(la1: number, lo1: number, la2: number, lo2: number) {
    const R = 6371e3;
    const p1 = la1 * Math.PI / 180;
    const p2 = la2 * Math.PI / 180;
    const dp = (la2 - la1) * Math.PI / 180;
    const dl = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
