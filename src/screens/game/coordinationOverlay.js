const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const CURVE_BULGE_PX = 70;

export function createCoordinationOverlay(containerElement) {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.classList.add('coordination-overlay');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  svg.append(path);

  function showLink(fromElement, toElement, isLeftColumn) {
    const containerRect = containerElement.getBoundingClientRect();
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();
    const edgeX = rect => (isLeftColumn ? rect.right : rect.left) - containerRect.left;
    const centerY = rect => rect.top + rect.height / 2 - containerRect.top;
    const bulge = isLeftColumn ? CURVE_BULGE_PX : -CURVE_BULGE_PX;
    const startX = edgeX(fromRect);
    const startY = centerY(fromRect);
    const endX = edgeX(toRect);
    const endY = centerY(toRect);
    path.setAttribute('d', `M ${startX} ${startY} C ${startX + bulge} ${startY}, ${endX + bulge} ${endY}, ${endX} ${endY}`);
    svg.classList.add('is-visible');
  }

  function clear() {
    svg.classList.remove('is-visible');
  }

  return { element: svg, showLink, clear };
}
