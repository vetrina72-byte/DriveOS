# Implementation Plan - 3D Scene Animation Continuity & Squircle System

## User Objectives
1. **3D Scene Animation & Centering**:
   - Eliminate micro-jumps/steps during 3D scene transitions (open/close and handle drag).
   - Keep the 3D vehicle model centered in the newly available 3D area (`sceneCenter = availableWidth / 2`) without using arbitrary, hardcoded shifts (`modelPos.x -= ...`).
   - Achieve 1:1 real-time viewport and camera tracking during handle dragging.
   - Preserve current vehicle scale and high performance (no extra RAFs or per-frame DOM reads).

2. **Apple-Style Continuous Corners (Squircle Geometry)**:
   - Replace standard rounded corners with continuous superellipse/squircle geometry.
   - Implement CSS utility classes using `corner-shape: superellipse` with smooth continuous `border-radius` fallback and squircle mask profiles.
   - Apply concentric corner logic (`R_inner = R_outer - padding`) across all UI elements (cards, panels, modals, toasts, buttons, Music Player, Spotify player, maps overlay, navigation widgets).

---

## Proposed Changes

### 1. 3D Scene Controller & Viewport Alignment (`/components/VehicleCanvas.tsx` & `/context/UIConfigContext.tsx`)
- **Centered 3D Model Coordinates**: Update `DEFAULT_APP_OPEN_CONFIG` and `localAppOpenConfig` so `modelPos.x` and `cameraTarget.x` remain aligned with the model's natural center (`-1.40` and `-1.30`) rather than artificial offsets (`-4.60` / `-4.90`).
- **Continuous Viewport Sizing**: Calculate `availableWidth` deterministically:
  - During transitions: `availableWidth = cw - (1 - p) * appPanelWidth`.
  - During handle drag: `availableWidth = handleX` or `cw - dragProgress * appPanelWidth`.
- **Micro-Jump Elimination**: Ensure `t = 0` captures the exact current state, preventing snap frames or DOM layout lookups on frame 1.
- **Camera Aspect & Viewport**: On every viewport size update, update `gl.setSize(availableWidth, ch)`, `gl.setViewport(0, 0, availableWidth, ch)`, and `camera.aspect = availableWidth / ch` so that `(0, y, 0)` projects directly to `availableWidth / 2`.

### 2. Apple Continuous Corner System (`/index.css`)
- Define `.squircle-sm`, `.squircle-md`, `.squircle-lg`, `.squircle-xl`, `.squircle-2xl`, `.squircle-3xl`, `.squircle-card`, `.squircle-panel`, `.squircle-btn`, `.squircle-toast`.
- Include modern CSS `corner-shape: superellipse` with smooth continuous corner curvature and SVG mask fallbacks for C1/C2 curvature continuity.
- Define concentric rules for nested children.

### 3. UI Component Alignment (`/components/*` & `/App.tsx`)
- Apply continuous corner classes to SpotifyPlayer, MapsContainer, MusicPlayer, NavigateTool, TopStatusBar, RadioApp, Theater, WebAppViewer, WeatherModal, and toasts.

---

## Verification Plan

### Automated Verification
- Run `lint_applet` and `compile_applet` to confirm no TypeScript or build errors.

### Manual Verification Scenarios
1. **HOME → OPEN APP**: Verify smooth continuous camera movement, zero micro-jumps, car stays centered in left 3D area.
2. **APP → CLOSE**: Verify smooth reverse transition into full-screen view with zero jumps.
3. **HANDLE DRAG**: Drag handle slowly and quickly; verify 1:1 real-time viewport tracking.
4. **SQUIRCLE UI**: Verify continuous curves on panels, cards, buttons, modals, and toasts.
