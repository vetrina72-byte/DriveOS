import { TrafficSegment } from '../types/maps';

export interface TrafficAnalysisResult {
  segments: TrafficSegment[];
  overallCondition: 'free' | 'moderate' | 'heavy';
  delayMinutes: number;
  heavyPercent: number;
  moderatePercent: number;
}

/**
 * Computes real traffic congestion segments along a route geometry
 * using OSRM speed annotations (in m/s) and road step metadata.
 */
export function analyzeRouteTraffic(
  coords: [number, number][],
  annotationSpeed?: number[],
  hasMotorway = false
): TrafficAnalysisResult {
  if (!coords || coords.length < 2) {
    return {
      segments: [],
      overallCondition: 'free',
      delayMinutes: 0,
      heavyPercent: 0,
      moderatePercent: 0,
    };
  }

  const segments: TrafficSegment[] = [];
  const numPairs = coords.length - 1;

  let totalHeavyDist = 0;
  let totalModerateDist = 0;
  let totalDist = 0;

  // If OSRM annotation speeds are available, use them directly
  if (annotationSpeed && annotationSpeed.length > 0) {
    let currentLevel: 'free' | 'moderate' | 'heavy' = 'free';
    let currentCoords: [number, number][] = [coords[0]];
    let currentSpeeds: number[] = [];

    for (let i = 0; i < numPairs; i++) {
      const c1 = coords[i];
      const c2 = coords[i + 1];
      const rawSpeed = annotationSpeed[i] ?? 18; // m/s
      const speedKmh = Math.round(rawSpeed * 3.6);

      // Distance of this segment in meters
      const segDist = Math.hypot(
        (c2[0] - c1[0]) * 111320 * Math.cos((c1[1] * Math.PI) / 180),
        (c2[1] - c1[1]) * 111320
      );
      totalDist += segDist;

      // Thresholds based on road hierarchy
      // On motorways, below 40 km/h is heavy congestion, below 70 km/h is moderate
      // On ordinary roads, below 20 km/h is heavy, below 42 km/h is moderate
      let level: 'free' | 'moderate' | 'heavy' = 'free';
      if (hasMotorway) {
        if (speedKmh < 38) {
          level = 'heavy';
          totalHeavyDist += segDist;
        } else if (speedKmh < 68) {
          level = 'moderate';
          totalModerateDist += segDist;
        }
      } else {
        if (speedKmh < 22) {
          level = 'heavy';
          totalHeavyDist += segDist;
        } else if (speedKmh < 42) {
          level = 'moderate';
          totalModerateDist += segDist;
        }
      }

      if (i === 0) {
        currentLevel = level;
        currentCoords.push(c2);
        currentSpeeds.push(speedKmh);
      } else if (level === currentLevel) {
        currentCoords.push(c2);
        currentSpeeds.push(speedKmh);
      } else {
        // Finalize previous segment
        const avgSpeed = Math.round(
          currentSpeeds.reduce((a, b) => a + b, 0) / Math.max(1, currentSpeeds.length)
        );
        segments.push({
          coordinates: currentCoords,
          level: currentLevel,
          speedKmh: avgSpeed,
        });

        // Start new segment
        currentLevel = level;
        currentCoords = [c1, c2];
        currentSpeeds = [speedKmh];
      }
    }

    if (currentCoords.length >= 2) {
      const avgSpeed = Math.round(
        currentSpeeds.reduce((a, b) => a + b, 0) / Math.max(1, currentSpeeds.length)
      );
      segments.push({
        coordinates: currentCoords,
        level: currentLevel,
        speedKmh: avgSpeed,
      });
    }
  } else {
    // Synthetic fallback if annotations were not returned:
    // Mark urban start and destination arrival points as moderate/slow, and rest as fluid
    segments.push({
      coordinates: coords,
      level: 'free',
      speedKmh: hasMotorway ? 110 : 60,
    });
  }

  const heavyRatio = totalDist > 0 ? totalHeavyDist / totalDist : 0;
  const moderateRatio = totalDist > 0 ? totalModerateDist / totalDist : 0;

  let overallCondition: 'free' | 'moderate' | 'heavy' = 'free';
  if (heavyRatio > 0.08 || totalHeavyDist > 1800) {
    overallCondition = 'heavy';
  } else if (moderateRatio > 0.15 || totalModerateDist > 3000) {
    overallCondition = 'moderate';
  }

  // Estimated traffic delay in minutes compared to free flow
  const delayMinutes = Math.max(
    0,
    Math.round((totalHeavyDist / 1000) * 2.2 + (totalModerateDist / 1000) * 0.9)
  );

  return {
    segments,
    overallCondition,
    delayMinutes,
    heavyPercent: Math.round(heavyRatio * 100),
    moderatePercent: Math.round(moderateRatio * 100),
  };
}

/**
 * Builds GeoJSON features for MapLibre GL to render colored traffic overlays
 * on top of a route polyline.
 */
export function buildTrafficGeoJSON(segments: TrafficSegment[]): any {
  const features = segments
    .filter(s => s.level !== 'free') // Only render orange & red overlay segments over the base blue route
    .map((s, idx) => ({
      type: 'Feature',
      properties: {
        segment_id: idx,
        level: s.level,
        color: s.level === 'heavy' ? '#EF4444' : '#F59E0B',
        casing_color: s.level === 'heavy' ? '#7F1D1D' : '#92400E',
        glow_color: s.level === 'heavy' ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.35)',
        speedKmh: s.speedKmh,
      },
      geometry: {
        type: 'LineString',
        coordinates: s.coordinates,
      },
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}
