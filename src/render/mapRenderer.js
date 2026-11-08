import { Application, Container, Graphics } from '../../vendor/pixi-8.22.0.min.mjs';
import { MAP_SIZE } from '../game/mapLayout.js';
import { visionSourcesFor } from '../game/vision.js';
import { MAP_COLORS } from './mapStyle.js';
import { createTerrain } from './terrain.js';
import { createFogLayer } from './fogLayer.js';
import { createChampionCoins, updateChampionCoins } from './championCoins.js';
import { createPitMarkers } from './pitMarkers.js';
import { drawMinionWaves } from './minionWaves.js';
import {
  drawFights, drawJungleCamps, drawObjectives, drawOwnWards, drawStructures, structureSignatureOf,
} from './mapLayers.js';

const INITIAL_CANVAS_SIZE = 600;

// Draws the game on a Pixi canvas inside hostElement. The world is in map units (MAP_SIZE square)
// and scaled to fit the host; layers are stacked bottom to top in the order they are added.
export async function createMapRenderer(hostElement, gameState, { mapImageUrl }) {
  const app = await createPixiApp(hostElement);
  const layers = await createLayers(gameState, mapImageUrl);
  const world = new Container();
  world.addChild(layers.terrain, layers.structures, layers.objectives, layers.camps, layers.minions,
    layers.fog.sprite, layers.wards, layers.fights, layers.pits.layer, layers.coins);
  app.stage.addChild(world);
  const fitToHost = () => fitWorldToHost(app, world, hostElement);
  const resizeObserver = new ResizeObserver(fitToHost);
  resizeObserver.observe(hostElement);
  fitToHost();
  let shownStructureSignature = '';

  function update(currentGameState) {
    drawFrame(layers, currentGameState);
    const structureSignature = structureSignatureOf(currentGameState);
    if (structureSignature !== shownStructureSignature) {
      shownStructureSignature = structureSignature;
      drawStructures(layers.structures, currentGameState);
    }
  }

  function destroy() {
    resizeObserver.disconnect();
    app.destroy(true, { children: true });
  }

  update(gameState);
  return { update, destroy, worldToClient: point => worldToClient(app.canvas, point) };
}

async function createPixiApp(hostElement) {
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
  return app;
}

async function createLayers(gameState, mapImageUrl) {
  const coins = new Container();
  return {
    terrain: await createTerrain(mapImageUrl),
    structures: new Graphics(),
    objectives: new Graphics(),
    camps: new Graphics(),
    minions: new Graphics(),
    fog: createFogLayer(),
    wards: new Graphics(),
    fights: new Graphics(),
    pits: await createPitMarkers(),
    coins,
    coinsByChampionState: await createChampionCoins(gameState, coins),
  };
}

// Everything that can change from one frame to the next, as the player sees it (fog of war applies).
function drawFrame(layers, gameState) {
  const playerVisionSources = visionSourcesFor(gameState, gameState.playerSide);
  layers.fog.draw(playerVisionSources);
  drawJungleCamps(layers.camps, gameState);
  drawMinionWaves(layers.minions, gameState, playerVisionSources);
  drawOwnWards(layers.wards, gameState);
  drawObjectives(layers.objectives, gameState);
  layers.pits.update(gameState);
  drawFights(layers.fights, gameState, playerVisionSources);
  updateChampionCoins(layers.coinsByChampionState, gameState);
}

// The map is always square: as large as the host's shorter side.
function fitWorldToHost(app, world, hostElement) {
  const size = Math.floor(Math.min(hostElement.clientWidth, hostElement.clientHeight));
  if (size <= 0) {
    return;
  }
  app.renderer.resize(size, size);
  world.scale.set(size / MAP_SIZE);
}

// Converts a map position to viewport pixels, e.g. to point the tutorial at the dragon pit.
// Reads the canvas box each time, so it stays right after resizes and scrolling.
function worldToClient(canvas, { x, y }) {
  const box = canvas.getBoundingClientRect();
  const scale = canvas.clientWidth / MAP_SIZE;
  return {
    x: box.left + canvas.clientLeft + x * scale,
    y: box.top + canvas.clientTop + y * scale,
    scale,
  };
}
