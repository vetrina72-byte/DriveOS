/**
 * Single source of truth for drawer geometry and 3D scene synchronization.
 * Eliminates DOM queries (querySelector, getBoundingClientRect, offsetWidth)
 * from the high-frequency 60fps render loop.
 */

export type DrawerPhase = 'idle' | 'animating' | 'dragging';
export type DrawerAxis = 'x' | 'y';

export interface DrawerLayoutState {
  activeApp: string | null;
  axis: DrawerAxis;
  // Position in pixels of the drawer's left edge on screen (from 0 to window.innerWidth)
  // When closed / Home, currentLeftPx = window.innerWidth
  currentLeftPx: number;
  // Progress: 0 = fully open, 1 = fully closed (Home)
  progress: number;
  phase: DrawerPhase;
  panelWidth: number;
}

const getInitialWidth = () => (typeof window !== 'undefined' ? window.innerWidth : 1024);

export const drawerLayout: DrawerLayoutState = {
  activeApp: null,
  axis: 'x',
  currentLeftPx: getInitialWidth(),
  progress: 1,
  phase: 'idle',
  panelWidth: 0,
};

/**
 * Updates the shared drawer layout atomically from drawer animation loops.
 * @param activeApp Identifier of the active app (e.g. 'maps', 'spotify')
 * @param axis Direction of translation ('x' for horizontal, 'y' for layered vertical)
 * @param panelWidth Measured pixel width of the drawer
 * @param percentClosed Current percent (0 = fully open, 100 = fully closed)
 * @param phase Motion state: 'idle' | 'animating' | 'dragging'
 */
export function updateDrawerLayout(
  activeApp: string | null,
  axis: DrawerAxis,
  panelWidth: number,
  percentClosed: number,
  phase: DrawerPhase
) {
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  drawerLayout.activeApp = activeApp;
  drawerLayout.axis = axis;
  drawerLayout.phase = phase;
  drawerLayout.panelWidth = panelWidth;

  const normProgress = Math.max(0, Math.min(1, percentClosed / 100));
  drawerLayout.progress = normProgress;

  if (!activeApp || normProgress >= 0.999) {
    drawerLayout.currentLeftPx = winWidth;
    drawerLayout.progress = 1;
    return;
  }

  if (axis === 'y') {
    // When layered vertically over Maps, the horizontal boundary is fixed to Maps's width (2/3 of screen -> left edge at 1/3)
    drawerLayout.currentLeftPx = Math.round(winWidth * (1 / 3));
  } else {
    // Horizontal drawer: left edge moves in lockstep with percentClosed
    const effectiveWidth = panelWidth > 0 ? panelWidth : Math.round(winWidth * (2 / 3));
    drawerLayout.currentLeftPx = Math.round(winWidth - effectiveWidth * (1 - normProgress));
  }
}

/**
 * Resets the drawer layout to closed/Home state.
 */
export function resetDrawerLayout() {
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  drawerLayout.activeApp = null;
  drawerLayout.axis = 'x';
  drawerLayout.currentLeftPx = winWidth;
  drawerLayout.progress = 1;
  drawerLayout.phase = 'idle';
  drawerLayout.panelWidth = 0;
}
