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

const MAP_COLORS = Object.freeze({
  background: 0x0b1116,
  jungle: 0x18241f,
  jungleEdge: 0x0f1814,
  lane: 0x3b4a42,
  river: 0x1c4a5e,
  pit: 0x24596e,
  camp: 0x2b3b33,
  campAlive: 0xc9a227,
  recallRing: 0x8fd3ff,
  coinText: 0xffffff,
  [TEAM.BLUE]: 0x3a9be8,
  [TEAM.RED]: 0xe0505b,
});

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
const MINION_DOT_RADIUS = 5;
const MINION_DOT_SPACING = 11;
const RECALL_RING_RADIUS = COIN_RADIUS + 6;
const RECALL_RING_WIDTH = 3;
const RECALL_PULSE_SPEED = 0.006;
const RECALL_PULSE_MIN_ALPHA = 0.35;

export async function createMapRenderer(hostElement, gameState) {
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

  const world = new Container();
  const fog = createFogLayer();
  const campLayer = new Graphics();
  const minionLayer = new Graphics();
  const coinLayer = new Container();
  world.addChild(drawTerrain(), drawStructures(gameState), campLayer, minionLayer, fog.sprite, coinLayer);
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
    const recallPulseAlpha = RECALL_PULSE_MIN_ALPHA + (1 - RECALL_PULSE_MIN_ALPHA) * (0.5 + 0.5 * Math.sin(performance.now() * RECALL_PULSE_SPEED));
    for (const [championState, { coin, recallRing }] of coinsByChampionState) {
      const isOwnChampion = championState.team === currentGameState.playerSide;
      coin.visible = championState.isAlive && (isOwnChampion || championState.isVisibleToPlayer);
      coin.position.set(championState.position.x, championState.position.y);
      const displayedState = displayedStateFor(championState, currentGameState.playerSide);
      recallRing.visible = displayedState.activity === ACTIVITY.RECALLING;
      recallRing.alpha = recallPulseAlpha;
    }
  }

  function destroy() {
    resizeObserver.disconnect();
    app.destroy(true, { children: true });
  }

  return { update, destroy };
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

function drawStructures(gameState) {
  const structuresGraphics = new Graphics();
  for (const teamState of Object.values(gameState.teams)) {
    const teamColor = MAP_COLORS[teamState.team];
    for (const structure of teamState.structures) {
      drawStructure(structuresGraphics, structure, teamColor);
    }
  }
  return structuresGraphics;
}

function drawStructure(graphics, structure, teamColor) {
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
    const color = isCampAlive(camp, gameState.gameSeconds) ? MAP_COLORS.campAlive : MAP_COLORS.camp;
    graphics.circle(camp.position.x, camp.position.y, CAMP_RADIUS).fill(color);
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
  context.arc(x, y, radius, 0, FULL_CIRCLE_RADIANS);
  context.fill();
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
    style: { fill: MAP_COLORS.coinText, fontSize: COIN_FONT_SIZE, fontWeight: '700', fontFamily: 'Arial' },
  });
  label.anchor.set(0.5);
  return label;
}
