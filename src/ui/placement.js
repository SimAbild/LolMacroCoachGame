const DEFAULT_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;
const OPPOSITE_SIDE = Object.freeze({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' });

// Places a panel next to a target rectangle. Tries the preferred side, then the opposite side,
// then the remaining two, and keeps the result inside the viewport.
// Returns { left, top, side } in viewport pixels (for position: fixed).
export function placeNear(targetRect, panelSize, { preferredSide = 'top', gap = DEFAULT_GAP_PX } = {}) {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const sides = [preferredSide, OPPOSITE_SIDE[preferredSide], ...Object.keys(OPPOSITE_SIDE)];
  const side = sides.find(candidate => fitsAlongSide(candidate, targetRect, panelSize, gap, viewport)) ?? preferredSide;
  const position = positionOnSide(side, targetRect, panelSize, gap);
  return {
    left: clamp(position.left, VIEWPORT_MARGIN_PX, viewport.width - panelSize.width - VIEWPORT_MARGIN_PX),
    top: clamp(position.top, VIEWPORT_MARGIN_PX, viewport.height - panelSize.height - VIEWPORT_MARGIN_PX),
    side,
  };
}

function positionOnSide(side, rect, size, gap) {
  const centeredLeft = rect.left + rect.width / 2 - size.width / 2;
  const centeredTop = rect.top + rect.height / 2 - size.height / 2;
  switch (side) {
    case 'bottom': return { left: centeredLeft, top: rect.bottom + gap };
    case 'left': return { left: rect.left - gap - size.width, top: centeredTop };
    case 'right': return { left: rect.right + gap, top: centeredTop };
    default: return { left: centeredLeft, top: rect.top - gap - size.height };
  }
}

function fitsAlongSide(side, rect, size, gap, viewport) {
  const { left, top } = positionOnSide(side, rect, size, gap);
  if (side === 'top' || side === 'bottom') {
    return top >= VIEWPORT_MARGIN_PX && top + size.height <= viewport.height - VIEWPORT_MARGIN_PX;
  }
  return left >= VIEWPORT_MARGIN_PX && left + size.width <= viewport.width - VIEWPORT_MARGIN_PX;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
