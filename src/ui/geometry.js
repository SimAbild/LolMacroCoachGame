// Rectangles are { left, top, right, bottom, width, height } in viewport pixels, like getBoundingClientRect().

export function rectFrom({ left, top, width, height }) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

export function paddedRect({ left, top, width, height }, padding) {
  return rectFrom({ left: left - padding, top: top - padding, width: width + padding * 2, height: height + padding * 2 });
}

// An SVG path for a rectangle with rounded corners. Several of these inside a full-screen
// rectangle with fill-rule="evenodd" cut holes out of it.
export function roundedRectPath({ left, top, width, height }, radius) {
  const corner = Math.min(radius, width / 2, height / 2);
  const right = left + width;
  const bottom = top + height;
  return `M${left + corner},${top} H${right - corner} Q${right},${top} ${right},${top + corner}`
    + ` V${bottom - corner} Q${right},${bottom} ${right - corner},${bottom}`
    + ` H${left + corner} Q${left},${bottom} ${left},${bottom - corner}`
    + ` V${top + corner} Q${left},${top} ${left + corner},${top} Z`;
}
