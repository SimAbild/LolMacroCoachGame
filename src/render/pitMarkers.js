import { Container, Graphics, Text } from '../../vendor/pixi-8.22.0.min.mjs';
import { OBJECTIVE_KEY } from '../config/objectiveRules.js';
import { BARON_PIT, DRAGON_PIT } from '../game/mapLayout.js';
import { formatGameTime } from '../ui/formatGameTime.js';
import { ELEMENT_COLORS, LABEL_FONT_FAMILY, MAP_COLORS } from './mapStyle.js';

const PIT_LABEL_FONT_SIZE = 22;
const PIT_COUNTDOWN_FONT_SIZE = 20;
const PIT_LABEL_OFFSET = 30;
const PIT_RING_RADIUS = 24;
const PIT_RING_WIDTH = 2;
const PIT_RING_ALPHA = 0.7;
const LABEL_OUTLINE_WIDTH = 4;
// A pit shows its name and a countdown once its next objective is less than this far away.
const PIT_COUNTDOWN_SECONDS = 60;
// The objectives that share a pit, most important first.
const PIT_OBJECTIVE_KEYS = Object.freeze({
  dragonPit: [OBJECTIVE_KEY.ELDER, OBJECTIVE_KEY.DRAGON],
  baronPit: [OBJECTIVE_KEY.BARON, OBJECTIVE_KEY.HERALD, OBJECTIVE_KEY.GRUBS],
});
const PIT_LABELS = Object.freeze({
  [OBJECTIVE_KEY.ELDER]: 'ELDER',
  [OBJECTIVE_KEY.BARON]: 'BARON',
  [OBJECTIVE_KEY.HERALD]: 'HERALD',
  [OBJECTIVE_KEY.GRUBS]: 'GRUBS',
});

// The dragon and baron pit markers in one layer. Labels sit above the fog: objective timers
// are public knowledge, like in the real game.
export async function createPitMarkers() {
  await loadLabelFont();
  const markers = [
    createPitMarker(DRAGON_PIT, PIT_OBJECTIVE_KEYS.dragonPit),
    createPitMarker(BARON_PIT, PIT_OBJECTIVE_KEYS.baronPit),
  ];
  const layer = new Container();
  layer.addChild(...markers.map(marker => marker.container));
  return { layer, update: gameState => markers.forEach(marker => marker.update(gameState)) };
}

// Pixi draws text on its own canvas and never redraws when a web font arrives later,
// so the label font must be loaded before the first label is created.
async function loadLabelFont() {
  try {
    await document.fonts.load(`600 ${PIT_LABEL_FONT_SIZE}px 'Barlow Condensed'`);
  } catch {
    // The fallback font in LABEL_FONT_FAMILY is used instead.
  }
}

function createLabel(fontSize) {
  const label = new Text({
    text: '',
    style: {
      fill: MAP_COLORS.label,
      fontSize,
      fontWeight: '600',
      fontFamily: LABEL_FONT_FAMILY,
      letterSpacing: 1,
      stroke: { color: MAP_COLORS.labelShadow, width: LABEL_OUTLINE_WIDTH, join: 'round' },
    },
  });
  label.anchor.set(0.5);
  return label;
}

// One marker per pit: a ring and countdown while the next objective is coming up,
// and the objective's name under the pit while it is up or coming up.
function createPitMarker(pit, objectiveKeys) {
  const container = new Container();
  container.position.set(pit.x, pit.y);
  const ring = new Graphics();
  const nameLabel = createLabel(PIT_LABEL_FONT_SIZE);
  nameLabel.position.set(0, PIT_LABEL_OFFSET);
  const countdownLabel = createLabel(PIT_COUNTDOWN_FONT_SIZE);
  container.addChild(ring, countdownLabel, nameLabel);
  let shownSignature = null;

  // Redrawing Pixi text is costly, so the marker only changes when what it shows changes.
  function update(gameState) {
    const focus = pitFocus(gameState, objectiveKeys);
    const signature = focus ? `${focus.objective.key}:${focus.objective.element ?? ''}:${focus.secondsLeft}` : '';
    if (signature !== shownSignature) {
      shownSignature = signature;
      container.visible = Boolean(focus);
      if (focus) {
        showFocus({ ring, nameLabel, countdownLabel }, focus);
      }
    }
  }

  return { container, update };
}

function showFocus({ ring, nameLabel, countdownLabel }, { objective, secondsLeft }) {
  const color = objectiveColor(objective);
  const isComingUp = secondsLeft > 0;
  nameLabel.text = pitLabelFor(objective);
  nameLabel.style.fill = color;
  countdownLabel.visible = isComingUp;
  countdownLabel.text = isComingUp ? formatGameTime(secondsLeft) : '';
  ring.clear();
  if (isComingUp) {
    ring.circle(0, 0, PIT_RING_RADIUS).stroke({ width: PIT_RING_WIDTH, color, alpha: PIT_RING_ALPHA });
  }
}

// The objective a pit is about right now: one that is up, or the next one to spawn within a minute.
function pitFocus(gameState, objectiveKeys) {
  const objectives = objectiveKeys.map(key => gameState.objectives[key]);
  const aliveObjective = objectives.find(objective => objective.isAlive);
  if (aliveObjective) {
    return { objective: aliveObjective, secondsLeft: 0 };
  }
  const upcoming = objectives
    .filter(objective => objective.spawnAtSeconds !== null)
    .map(objective => ({ objective, secondsLeft: Math.ceil(objective.spawnAtSeconds - gameState.gameSeconds) }))
    .filter(({ secondsLeft }) => secondsLeft > 0 && secondsLeft <= PIT_COUNTDOWN_SECONDS)
    .sort((first, second) => first.secondsLeft - second.secondsLeft);
  return upcoming[0] ?? null;
}

function objectiveColor(objective) {
  if (objective.key === OBJECTIVE_KEY.DRAGON) {
    return ELEMENT_COLORS[objective.element] ?? MAP_COLORS.elder;
  }
  return objective.key === OBJECTIVE_KEY.ELDER ? MAP_COLORS.elder : MAP_COLORS.voidCreature;
}

function pitLabelFor(objective) {
  if (objective.key === OBJECTIVE_KEY.DRAGON) {
    return `${objective.element ?? ''} DRAKE`.trim().toUpperCase();
  }
  return PIT_LABELS[objective.key];
}
