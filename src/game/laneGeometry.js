import { LANE_PATHS } from './mapLayout.js';

export const LANES = Object.freeze(Object.keys(LANE_PATHS));

const POLYLINES = Object.freeze(Object.fromEntries(
  Object.entries(LANE_PATHS).map(([lane, points]) => [lane, buildPolyline(points)]),
));

export function laneLength(lane) {
  return POLYLINES[lane].totalLength;
}

export function pointAtLaneDistance(lane, distance) {
  const { segments, totalLength } = POLYLINES[lane];
  const clampedDistance = Math.min(totalLength, Math.max(0, distance));
  const segment = segments.find(candidate => clampedDistance <= candidate.startDistance + candidate.length) ?? segments[segments.length - 1];
  const progress = segment.length === 0 ? 0 : (clampedDistance - segment.startDistance) / segment.length;
  return {
    x: segment.start.x + (segment.end.x - segment.start.x) * progress,
    y: segment.start.y + (segment.end.y - segment.start.y) * progress,
  };
}

export function laneDistanceOfPoint(lane, point) {
  let closest = { distanceToPoint: Infinity, laneDistance: 0 };
  for (const segment of POLYLINES[lane].segments) {
    const progress = projectionProgress(point, segment);
    const projected = {
      x: segment.start.x + (segment.end.x - segment.start.x) * progress,
      y: segment.start.y + (segment.end.y - segment.start.y) * progress,
    };
    const distanceToPoint = Math.hypot(point.x - projected.x, point.y - projected.y);
    if (distanceToPoint < closest.distanceToPoint) {
      closest = { distanceToPoint, laneDistance: segment.startDistance + segment.length * progress };
    }
  }
  return closest.laneDistance;
}

function buildPolyline(points) {
  const segments = [];
  let startDistance = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = { x: points[index][0], y: points[index][1] };
    const end = { x: points[index + 1][0], y: points[index + 1][1] };
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length, startDistance });
    startDistance += length;
  }
  return { segments, totalLength: startDistance };
}

function projectionProgress(point, segment) {
  const deltaX = segment.end.x - segment.start.x;
  const deltaY = segment.end.y - segment.start.y;
  const squaredLength = deltaX * deltaX + deltaY * deltaY;
  if (squaredLength === 0) {
    return 0;
  }
  const progress = ((point.x - segment.start.x) * deltaX + (point.y - segment.start.y) * deltaY) / squaredLength;
  return Math.min(1, Math.max(0, progress));
}
