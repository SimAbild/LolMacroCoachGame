import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from '../../vendor/pixi-8.22.0.min.mjs';
import { TEAM } from '../config/teams.js';
import {
  BARON_PIT, BASE_CENTERS, DRAGON_PIT, LANE_PATHS, MAP_SIZE, RIVER_PATH, STRUCTURE_TYPE,
} from '../game/mapLayout.js';
import { isPositionVisible, visionSourcesFor } from '../game/vision.js';
import { pointAtLaneDistance } from '../game/laneGeometry.js';
import { ACTIVITY } from '../game/activities.js';
import { isCampAlive } from '../game/simulation/jungleSystem.js';
import { directionTowardEnemy } from '../game/simulation/laneSystem.js';
import { displayedStateFor } from '../game/simulation/scoutingSystem.js';
import { WARD_VISION_RADIUS } from '../config/combatRules.js';
import { castVisionRay } from '../game/navigation.js';
import { prefersReducedMotion } from '../ui/reducedMotion.js';
import { OBJECTIVE_KEY } from '../config/objectiveRules.js';
import { formatGameTime } from '../ui/formatGameTime.js';
import { ELEMENT_COLORS, MAP_COLORS } from './mapStyle.js';

const BASE_TINT = Object.freeze({ [TEAM.BLUE]: 0x13304a, [TEAM.RED]: 0x3b1a21 });
const INITIAL_CANVAS_SIZE = 600;
const LANE_WIDTH = 34;
const RIVER_WIDTH = 64;
const PIT_RADIUS = 40;
const CAMP_RADIUS = 9;
const BASE_RADIUS = 250;
const MAP_FRAME_WIDTH = 10;
const TOWER_HALF_SIZE = 11;
const INHIBITOR_RADIUS = 12;
const NEXUS_HALF_SIZE = 20;
const COIN_RADIUS = 27;
const COIN_RING_WIDTH = 4;
const COIN_FONT_SIZE = 18;
const FOG_COLOR_RGBA = 'rgba(4, 7, 10, 0.66)';
const FOG_TEXTURE_SCALE = 0.5;
const FOG_SOFT_EDGE_START = 0.8;
const FULL_CIRCLE_RADIANS = Math.PI * 2;
const VISION_RAY_COUNT = 96;
const MAX_CACHED_VISION_SHAPES = 400;
const visionShapeCache = new Map();
const MINION_DOT_RADIUS = 5;
const MINION_DOT_SPACING = 11;
const RECALL_RING_RADIUS = COIN_RADIUS + 6;
const RECALL_RING_WIDTH = 3;
const RECALL_PULSE_SPEED = 0.006;
const RECALL_PULSE_MIN_ALPHA = 0.35;
const WARD_MARKER_SIZE = 7;
const DESTROYED_STRUCTURE_STROKE = 2;
const DRAGON_ICON_RADIUS = 17;
const BARON_ICON_RADIUS = 21;
const GRUB_ICON_RADIUS = 7;
const GRUB_ICON_SPACING = 16;
const FIGHT_RING_RADIUS = 46;
const FIGHT_RING_PULSE = 10;
const FIGHT_PULSE_SPEED = 0.01;
const FIGHT_RING_WIDTH = 3;
const WARD_RING_ALPHA = 0.35;
const CAMP_OUTLINE_WIDTH = 2;
const CAMP_RESPAWNING_ALPHA = 0.55;
const LABEL_FONT_FAMILY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
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

export async function createMapRenderer(hostElement, gameState, { mapImageUrl }) {
  const app = new Application();
  await app.init({
    width: INITIAL_CANVAS_SIZE,
    height: INITIAL_CANVAS_SIZE,
    background: MAP_COLORS.background,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  hostElement.append(app.canvas);
  await loadLabelFont();

  const world = new Container();
  const fog = createFogLayer();
  const campLayer = new Graphics();
  const minionLayer = new Graphics();
  const wardLayer = new Graphics();
  const structureLayer = new Graphics();
  const objectiveLayer = new Graphics();
  const fightLayer = new Graphics();
  let shownStructureSignature = '';
  const coinLayer = new Container();
  // Pit labels sit above the fog: objective timers are public knowledge, like in the real game.
  const pitMarkers = [
    createPitMarker(DRAGON_PIT, PIT_OBJECTIVE_KEYS.dragonPit),
    createPitMarker(BARON_PIT, PIT_OBJECTIVE_KEYS.baronPit),
  ];
  const pitLayer = new Container();
  pitLayer.addChild(...pitMarkers.map(marker => marker.container));
  world.addChild(await createTerrain(mapImageUrl), structureLayer, objectiveLayer, campLayer, minionLayer, fog.sprite, wardLayer, fightLayer, pitLayer, coinLayer);
  app.stage.addChild(world);

  const coinsByChampionState = await createChampionCoins(gameState, coinLayer);
  const resizeObserver = new ResizeObserver(() => fitToHost());
  resizeObserver.observe(hostElement);
  fitToHost();
  update(gameState);

  function fitToHost() {
    const size = Math.floor(Math.min(hostElement.clientWidth, hostElement.clientHeight));
    if (size <= 0) {
      return;
    }
    app.renderer.resize(size, size);
    world.scale.set(size / MAP_SIZE);
  }

  function update(currentGameState) {
    const playerVisionSources = visionSourcesFor(currentGameState, currentGameState.playerSide);
    fog.draw(playerVisionSources);
    drawJungleCamps(campLayer, currentGameState);
    drawMinionWaves(minionLayer, currentGameState, playerVisionSources);
    drawOwnWards(wardLayer, currentGameState);
    drawObjectives(objectiveLayer, currentGameState);
    for (const marker of pitMarkers) {
      marker.update(currentGameState);
    }
    drawFights(fightLayer, currentGameState, playerVisionSources);
    const structureSignature = structureSignatureOf(currentGameState);
    if (structureSignature !== shownStructureSignature) {
      shownStructureSignature = structureSignature;
      drawStructures(structureLayer, currentGameState);
    }
    const recallPulseAlpha = RECALL_PULSE_MIN_ALPHA + (1 - RECALL_PULSE_MIN_ALPHA) * (0.5 + 0.5 * pulseWave(RECALL_PULSE_SPEED));
    for (const [championState, { coin, recallRing }] of coinsByChampionState) {
      const isOwnChampion = championState.team === currentGameState.playerSide;
      coin.visible = championState.isAlive && (isOwnChampion || championState.isVisibleToPlayer);
      coin.position.set(championState.position.x, championState.position.y);
      const displayedState = displayedStateFor(championState, currentGameState.playerSide);
      recallRing.visible = displayedState.activity === ACTIVITY.RECALLING;
      recallRing.alpha = recallPulseAlpha;
    }
  }

  // Converts a map position to viewport pixels, e.g. to point the tutorial at the dragon pit.
  // Reads the canvas box each time, so it stays right after resizes and scrolling.
  function worldToClient({ x, y }) {
    const canvas = app.canvas;
    const box = canvas.getBoundingClientRect();
    const scale = canvas.clientWidth / MAP_SIZE;
    return {
      x: box.left + canvas.clientLeft + x * scale,
      y: box.top + canvas.clientTop + y * scale,
      scale,
    };
  }

  function destroy() {
    resizeObserver.disconnect();
    app.destroy(true, { children: true });
  }

  return { update, destroy, worldToClient };
}

async function createTerrain(mapImageUrl) {
  try {
    const minimapSprite = new Sprite(await Assets.load(mapImageUrl));
    minimapSprite.width = MAP_SIZE;
    minimapSprite.height = MAP_SIZE;
    return minimapSprite;
  } catch {
    return drawTerrain();
  }
}

function drawTerrain() {
  const terrain = new Graphics();
  terrain.rect(0, 0, MAP_SIZE, MAP_SIZE).fill(MAP_COLORS.jungle);
  for (const team of [TEAM.BLUE, TEAM.RED]) {
    terrain.circle(BASE_CENTERS[team].x, BASE_CENTERS[team].y, BASE_RADIUS).fill(BASE_TINT[team]);
  }
  strokePath(terrain, RIVER_PATH, RIVER_WIDTH, MAP_COLORS.river);
  terrain.circle(BARON_PIT.x, BARON_PIT.y, PIT_RADIUS).fill(MAP_COLORS.pit);
  terrain.circle(DRAGON_PIT.x, DRAGON_PIT.y, PIT_RADIUS).fill(MAP_COLORS.pit);
  for (const lanePath of Object.values(LANE_PATHS)) {
    strokePath(terrain, lanePath, LANE_WIDTH, MAP_COLORS.lane);
  }
  terrain.rect(0, 0, MAP_SIZE, MAP_SIZE).stroke({ width: MAP_FRAME_WIDTH, color: MAP_COLORS.jungleEdge, alignment: 1 });
  return terrain;
}

function strokePath(graphics, points, width, color) {
  const [[startX, startY], ...remainingPoints] = points;
  graphics.moveTo(startX, startY);
  for (const [x, y] of remainingPoints) {
    graphics.lineTo(x, y);
  }
  graphics.stroke({ width, color, cap: 'round', join: 'round' });
}

function structureSignatureOf(gameState) {
  return Object.values(gameState.teams)
    .flatMap(teamState => teamState.structures.map(structure => (structure.isStanding ? '1' : '0')))
    .join('');
}

function drawStructures(graphics, gameState) {
  graphics.clear();
  for (const teamState of Object.values(gameState.teams)) {
    for (const structure of teamState.structures) {
      drawStructure(graphics, structure, structure.isStanding ? MAP_COLORS[teamState.team] : MAP_COLORS.destroyedStructure);
    }
  }
}

function drawObjectives(graphics, gameState) {
  graphics.clear();
  const { dragon, elder, grubs, herald, baron } = gameState.objectives;
  if (dragon.isAlive) {
    graphics.circle(dragon.pit.x, dragon.pit.y, DRAGON_ICON_RADIUS).fill(ELEMENT_COLORS[dragon.element] ?? MAP_COLORS.elder);
  }
  if (elder.isAlive) {
    graphics.circle(elder.pit.x, elder.pit.y, DRAGON_ICON_RADIUS).fill(MAP_COLORS.elder);
  }
  if (baron.isAlive) {
    graphics.circle(baron.pit.x, baron.pit.y, BARON_ICON_RADIUS).fill(MAP_COLORS.voidCreature);
  }
  if (herald.isAlive) {
    graphics.circle(herald.pit.x, herald.pit.y, DRAGON_ICON_RADIUS).fill(MAP_COLORS.voidCreature);
  }
  if (grubs.isAlive) {
    for (const offset of [-GRUB_ICON_SPACING, 0, GRUB_ICON_SPACING]) {
      graphics.circle(grubs.pit.x + offset, grubs.pit.y, GRUB_ICON_RADIUS).fill(MAP_COLORS.voidCreature);
    }
  }
}

// A value between -1 and 1 that swings over real time (so it keeps moving while the game is paused).
// With reduced motion it stays at 0: rings keep their middle size and alpha instead of pulsing.
function pulseWave(speed) {
  return prefersReducedMotion() ? 0 : Math.sin(performance.now() * speed);
}

function drawDestroyedStructure(graphics, structure) {
  graphics.circle(structure.x, structure.y, INHIBITOR_RADIUS).stroke({ width: DESTROYED_STRUCTURE_STROKE, color: MAP_COLORS.destroyedStructure });
}

function drawFights(graphics, gameState, playerVisionSources) {
  graphics.clear();
  const pulse = pulseWave(FIGHT_PULSE_SPEED) * FIGHT_RING_PULSE;
  for (const fight of gameState.fights) {
    if (!isPositionVisible(fight.location, playerVisionSources)) {
      continue;
    }
    graphics.circle(fight.location.x, fight.location.y, FIGHT_RING_RADIUS + pulse).stroke({ width: FIGHT_RING_WIDTH, color: MAP_COLORS.fight });
  }
}

function drawStructure(graphics, structure, teamColor) {
  if (teamColor === MAP_COLORS.destroyedStructure) {
    drawDestroyedStructure(graphics, structure);
    return;
  }
  if (structure.type === STRUCTURE_TYPE.TOWER) {
    graphics.poly([
      structure.x, structure.y - TOWER_HALF_SIZE,
      structure.x + TOWER_HALF_SIZE, structure.y,
      structure.x, structure.y + TOWER_HALF_SIZE,
      structure.x - TOWER_HALF_SIZE, structure.y,
    ]).fill(teamColor);
    return;
  }
  if (structure.type === STRUCTURE_TYPE.INHIBITOR) {
    graphics.circle(structure.x, structure.y, INHIBITOR_RADIUS).stroke({ width: 4, color: teamColor });
    return;
  }
  graphics.roundRect(structure.x - NEXUS_HALF_SIZE, structure.y - NEXUS_HALF_SIZE, NEXUS_HALF_SIZE * 2, NEXUS_HALF_SIZE * 2, 6)
    .fill(teamColor);
}

function drawJungleCamps(graphics, gameState) {
  graphics.clear();
  for (const camp of gameState.jungleCamps) {
    const { x, y } = camp.position;
    if (isCampAlive(camp, gameState.gameSeconds)) {
      graphics.circle(x, y, CAMP_RADIUS).fill(MAP_COLORS.campAlive).stroke({ width: CAMP_OUTLINE_WIDTH, color: MAP_COLORS.campOutline });
    } else {
      graphics.circle(x, y, CAMP_RADIUS - 1).stroke({ width: CAMP_OUTLINE_WIDTH, color: MAP_COLORS.camp, alpha: CAMP_RESPAWNING_ALPHA });
    }
  }
}

function drawMinionWaves(graphics, gameState, playerVisionSources) {
  graphics.clear();
  for (const laneState of gameState.lanes) {
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      const visibleDots = Math.ceil(laneState.minions[team]);
      const stepTowardOwnBase = -directionTowardEnemy(team) * MINION_DOT_SPACING;
      for (let dotIndex = 0; dotIndex < visibleDots; dotIndex += 1) {
        const dotPosition = pointAtLaneDistance(laneState.lane, laneState.frontDistance + stepTowardOwnBase * (dotIndex + 0.5));
        const isOwnMinion = team === gameState.playerSide;
        if (isOwnMinion || isPositionVisible(dotPosition, playerVisionSources)) {
          graphics.circle(dotPosition.x, dotPosition.y, MINION_DOT_RADIUS).fill(MAP_COLORS[team]);
        }
      }
    }
  }
}

function drawOwnWards(graphics, gameState) {
  graphics.clear();
  for (const ward of gameState.wards.filter(candidate => candidate.team === gameState.playerSide)) {
    const { x, y } = ward.position;
    graphics.circle(x, y, WARD_VISION_RADIUS).stroke({ width: 2, color: MAP_COLORS.ward, alpha: WARD_RING_ALPHA });
    graphics.poly([x, y - WARD_MARKER_SIZE, x + WARD_MARKER_SIZE, y, x, y + WARD_MARKER_SIZE, x - WARD_MARKER_SIZE, y]).fill(MAP_COLORS.ward);
  }
}

function createFogLayer() {
  const fogCanvas = document.createElement('canvas');
  fogCanvas.width = MAP_SIZE * FOG_TEXTURE_SCALE;
  fogCanvas.height = MAP_SIZE * FOG_TEXTURE_SCALE;
  const context = fogCanvas.getContext('2d');
  const texture = Texture.from(fogCanvas);
  const sprite = new Sprite(texture);
  sprite.width = MAP_SIZE;
  sprite.height = MAP_SIZE;

  function draw(visionSources) {
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
    context.fillStyle = FOG_COLOR_RGBA;
    context.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
    context.globalCompositeOperation = 'destination-out';
    for (const source of visionSources) {
      cutVisionCircle(context, source);
    }
    texture.source.update();
  }

  return { sprite, draw };
}

function cutVisionCircle(context, source) {
  const x = source.x * FOG_TEXTURE_SCALE;
  const y = source.y * FOG_TEXTURE_SCALE;
  const radius = source.radius * FOG_TEXTURE_SCALE;
  const gradient = context.createRadialGradient(x, y, radius * FOG_SOFT_EDGE_START, x, y, radius);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.beginPath();
  visionShapeOf(source).forEach((point, index) => {
    const method = index === 0 ? 'moveTo' : 'lineTo';
    context[method](point.x * FOG_TEXTURE_SCALE, point.y * FOG_TEXTURE_SCALE);
  });
  context.closePath();
  context.fill();
}

function visionShapeOf(source) {
  const cacheKey = `${Math.round(source.x)},${Math.round(source.y)},${source.radius}`;
  const cachedShape = visionShapeCache.get(cacheKey);
  if (cachedShape) {
    return cachedShape;
  }
  const shape = Array.from({ length: VISION_RAY_COUNT }, (_, rayIndex) => (
    castVisionRay(source, (rayIndex / VISION_RAY_COUNT) * FULL_CIRCLE_RADIANS, source.radius)
  ));
  if (visionShapeCache.size >= MAX_CACHED_VISION_SHAPES) {
    visionShapeCache.clear();
  }
  visionShapeCache.set(cacheKey, shape);
  return shape;
}

async function createChampionCoins(gameState, coinLayer) {
  const coinsByChampionState = new Map();
  const championStates = Object.values(gameState.teams).flatMap(teamState => teamState.champions);
  const textures = await Promise.allSettled(championStates.map(championState => Assets.load(championState.champion.iconUrl)));
  championStates.forEach((championState, index) => {
    const textureResult = textures[index];
    const texture = textureResult.status === 'fulfilled' ? textureResult.value : null;
    const coin = createCoin(championState, texture);
    const recallRing = new Graphics().circle(0, 0, RECALL_RING_RADIUS).stroke({ width: RECALL_RING_WIDTH, color: MAP_COLORS.recallRing });
    recallRing.visible = false;
    coin.addChild(recallRing);
    coinLayer.addChild(coin);
    coinsByChampionState.set(championState, { coin, recallRing });
  });
  return coinsByChampionState;
}

function createCoin(championState, texture) {
  const coin = new Container();
  const innerRadius = COIN_RADIUS - COIN_RING_WIDTH;
  const ring = new Graphics().circle(0, 0, COIN_RADIUS).fill(MAP_COLORS[championState.team]);
  coin.addChild(ring);
  if (!texture) {
    coin.addChild(createInitialsLabel(championState.champion.name));
    return coin;
  }
  const iconMask = new Graphics().circle(0, 0, innerRadius).fill(MAP_COLORS.coinText);
  const icon = new Sprite(texture);
  icon.anchor.set(0.5);
  icon.width = innerRadius * 2;
  icon.height = innerRadius * 2;
  icon.mask = iconMask;
  coin.addChild(icon, iconMask);
  return coin;
}

function createInitialsLabel(championName) {
  const label = new Text({
    text: championName.slice(0, 2).toUpperCase(),
    style: { fill: MAP_COLORS.coinText, fontSize: COIN_FONT_SIZE, fontWeight: '700', fontFamily: LABEL_FONT_FAMILY },
  });
  label.anchor.set(0.5);
  return label;
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

  function update(gameState) {
    const focus = pitFocus(gameState, objectiveKeys);
    const signature = focus ? `${focus.objective.key}:${focus.objective.element ?? ''}:${focus.secondsLeft}` : '';
    if (signature === shownSignature) {
      return;
    }
    shownSignature = signature;
    container.visible = Boolean(focus);
    if (!focus) {
      return;
    }
    const { objective, secondsLeft } = focus;
    const color = objectiveColor(objective);
    nameLabel.text = pitLabelFor(objective);
    nameLabel.style.fill = color;
    const isComingUp = secondsLeft > 0;
    countdownLabel.visible = isComingUp;
    countdownLabel.text = isComingUp ? formatGameTime(secondsLeft) : '';
    ring.clear();
    if (isComingUp) {
      ring.circle(0, 0, PIT_RING_RADIUS).stroke({ width: PIT_RING_WIDTH, color, alpha: PIT_RING_ALPHA });
    }
  }

  return { container, update };
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
