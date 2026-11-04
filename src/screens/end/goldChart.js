import { createElement } from '../../ui/dom.js';
import { formatGameTime } from '../../ui/formatGameTime.js';
import { TEAM, TEAM_LABELS } from '../../config/teams.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const CHART_WIDTH = 800;
const CHART_HEIGHT = 240;
const PADDING = Object.freeze({ top: 16, right: 16, bottom: 34, left: 56 });
const SECONDS_PER_MINUTE = 60;
const MINUTE_TICK_STEP = 5;
const GOLD_PER_THOUSAND = 1000;
const MIN_GOLD_RANGE = 2000;
const CALL_MARKER_SIZE = 5;
const TOOLTIP_OFFSET = 12;
const LABEL_INSET = 8;
const LABEL_BASELINE_OFFSET = 12;
const TICK_LABEL_GAP = 22;
const TICK_LABEL_VERTICAL_CENTER = 4;
const FOCUS_DOT_RADIUS = 4;

export function createGoldChart(gameState) {
  const samples = gameState.goldHistory;
  const lastSeconds = samples[samples.length - 1]?.gameSeconds ?? 1;
  const differences = samples.map(sample => sample[TEAM.BLUE] - sample[TEAM.RED]);
  const goldRange = Math.max(MIN_GOLD_RANGE, ...differences.map(Math.abs));
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const xFor = seconds => PADDING.left + (seconds / lastSeconds) * plotWidth;
  const yFor = difference => PADDING.top + plotHeight / 2 - (difference / goldRange) * (plotHeight / 2);
  const zeroY = yFor(0);

  const svg = svgElement('svg', { viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`, class: 'gold-chart', role: 'img' });
  svg.append(svgElement('title', {}, 'Gold difference over time, positive means Blue is ahead'));
  svg.append(...gridAndAxes({ goldRange, lastSeconds, xFor, yFor, plotWidth }));

  const linePoints = samples.map((sample, index) => `${xFor(sample.gameSeconds)},${yFor(differences[index])}`).join(' ');
  const areaPath = `M ${xFor(0)} ${zeroY} L ${linePoints.replaceAll(' ', ' L ')} L ${xFor(lastSeconds)} ${zeroY} Z`;
  svg.append(
    svgElement('clipPath', { id: 'gold-above' }, svgElement('rect', { x: 0, y: 0, width: CHART_WIDTH, height: zeroY })),
    svgElement('clipPath', { id: 'gold-below' }, svgElement('rect', { x: 0, y: zeroY, width: CHART_WIDTH, height: CHART_HEIGHT - zeroY })),
    svgElement('path', { d: areaPath, class: 'gold-chart__area gold-chart__area--blue', 'clip-path': 'url(#gold-above)' }),
    svgElement('path', { d: areaPath, class: 'gold-chart__area gold-chart__area--red', 'clip-path': 'url(#gold-below)' }),
    svgElement('polyline', { points: linePoints, class: 'gold-chart__line' }),
    svgElement('text', { x: PADDING.left + LABEL_INSET, y: PADDING.top + LABEL_BASELINE_OFFSET, class: 'gold-chart__label' }, `${TEAM_LABELS.blue} ahead`),
    svgElement('text', { x: PADDING.left + LABEL_INSET, y: CHART_HEIGHT - PADDING.bottom - LABEL_INSET, class: 'gold-chart__label' }, `${TEAM_LABELS.red} ahead`),
  );

  for (const call of gameState.callLog) {
    const x = xFor(call.gameSeconds);
    const y = CHART_HEIGHT - PADDING.bottom;
    const marker = svgElement('path', {
      d: `M ${x} ${y - CALL_MARKER_SIZE} L ${x + CALL_MARKER_SIZE} ${y} L ${x} ${y + CALL_MARKER_SIZE} L ${x - CALL_MARKER_SIZE} ${y} Z`,
      class: 'gold-chart__call',
    });
    marker.append(svgElement('title', {}, `${formatGameTime(call.gameSeconds)} · ${call.label}`));
    svg.append(marker);
  }

  const crosshair = svgElement('line', { y1: PADDING.top, y2: CHART_HEIGHT - PADDING.bottom, class: 'gold-chart__crosshair' });
  const focusDot = svgElement('circle', { r: FOCUS_DOT_RADIUS, class: 'gold-chart__focus' });
  crosshair.style.display = 'none';
  focusDot.style.display = 'none';
  svg.append(crosshair, focusDot);

  const tooltip = createElement('div', { className: 'chart-tooltip' });
  tooltip.hidden = true;
  const wrapper = createElement('div', { className: 'gold-chart-wrapper' }, svg, tooltip);

  svg.addEventListener('pointermove', event => {
    if (samples.length === 0) {
      return;
    }
    const bounds = svg.getBoundingClientRect();
    const chartX = ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH;
    const hoveredSeconds = ((chartX - PADDING.left) / plotWidth) * lastSeconds;
    const nearestIndex = nearestSampleIndex(samples, hoveredSeconds);
    const sample = samples[nearestIndex];
    const difference = differences[nearestIndex];
    const x = xFor(sample.gameSeconds);
    crosshair.setAttribute('x1', x);
    crosshair.setAttribute('x2', x);
    focusDot.setAttribute('cx', x);
    focusDot.setAttribute('cy', yFor(difference));
    crosshair.style.display = '';
    focusDot.style.display = '';
    const leader = difference >= 0 ? TEAM_LABELS.blue : TEAM_LABELS.red;
    tooltip.textContent = `${formatGameTime(sample.gameSeconds)} · ${leader} +${formatThousands(Math.abs(difference))}`;
    tooltip.hidden = false;
    tooltip.style.left = `${event.clientX - bounds.left + TOOLTIP_OFFSET}px`;
    tooltip.style.top = `${event.clientY - bounds.top + TOOLTIP_OFFSET}px`;
  });
  svg.addEventListener('pointerleave', () => {
    crosshair.style.display = 'none';
    focusDot.style.display = 'none';
    tooltip.hidden = true;
  });

  return createElement('div', { className: 'gold-chart-block' }, wrapper, createDataTable(samples, differences));
}

function gridAndAxes({ goldRange, lastSeconds, xFor, yFor, plotWidth }) {
  const elements = [];
  for (const difference of [goldRange, goldRange / 2, 0, -goldRange / 2, -goldRange]) {
    const y = yFor(difference);
    elements.push(svgElement('line', {
      x1: PADDING.left, x2: PADDING.left + plotWidth, y1: y, y2: y,
      class: difference === 0 ? 'gold-chart__zero' : 'gold-chart__grid',
    }));
    elements.push(svgElement('text', {
      x: PADDING.left - LABEL_INSET, y: y + TICK_LABEL_VERTICAL_CENTER, class: 'gold-chart__tick', 'text-anchor': 'end',
    }, signedThousands(difference)));
  }
  const lastMinute = Math.floor(lastSeconds / SECONDS_PER_MINUTE);
  for (let minute = 0; minute <= lastMinute; minute += MINUTE_TICK_STEP) {
    elements.push(svgElement('text', {
      x: xFor(minute * SECONDS_PER_MINUTE), y: CHART_HEIGHT - PADDING.bottom + TICK_LABEL_GAP, class: 'gold-chart__tick', 'text-anchor': 'middle',
    }, `${minute}:00`));
  }
  return elements;
}

function createDataTable(samples, differences) {
  const rows = samples.map((sample, index) => createElement('tr', {},
    createElement('td', { text: formatGameTime(sample.gameSeconds) }),
    createElement('td', { text: formatThousands(sample[TEAM.BLUE]) }),
    createElement('td', { text: formatThousands(sample[TEAM.RED]) }),
    createElement('td', { text: signedThousands(differences[index]) }),
  ));
  return createElement('details', { className: 'chart-data' },
    createElement('summary', { text: 'Show data' }),
    createElement('table', {},
      createElement('thead', {}, createElement('tr', {},
        ...['Time', 'Blue gold', 'Red gold', 'Difference'].map(heading => createElement('th', { text: heading })),
      )),
      createElement('tbody', {}, ...rows),
    ),
  );
}

function nearestSampleIndex(samples, seconds) {
  let nearestIndex = 0;
  samples.forEach((sample, index) => {
    if (Math.abs(sample.gameSeconds - seconds) < Math.abs(samples[nearestIndex].gameSeconds - seconds)) {
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function signedThousands(gold) {
  const sign = gold > 0 ? '+' : gold < 0 ? '−' : '';
  return `${sign}${formatThousands(Math.abs(gold))}`;
}

function formatThousands(gold) {
  return `${(gold / GOLD_PER_THOUSAND).toFixed(1)}K`;
}

function svgElement(tagName, attributes = {}, ...children) {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  for (const child of children) {
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}
