import { Assets, Container, Graphics, Sprite, Text } from '../../vendor/pixi-8.22.0.min.mjs';
import { ACTIVITY } from '../game/activities.js';
import { displayedStateFor } from '../game/simulation/scoutingSystem.js';
import { LABEL_FONT_FAMILY, MAP_COLORS } from './mapStyle.js';
import { pulseWave } from './pulse.js';

const COIN_RADIUS = 27;
const COIN_RING_WIDTH = 4;
const COIN_FONT_SIZE = 18;
const RECALL_RING_RADIUS = COIN_RADIUS + 6;
const RECALL_RING_WIDTH = 3;
const RECALL_PULSE_SPEED = 0.006;
const RECALL_PULSE_MIN_ALPHA = 0.35;

// A coin per champion: the portrait in a ring of the team's colour, with a pulsing ring while recalling.
// Enemy coins only show while the player can see them.
export function updateChampionCoins(coinsByChampionState, gameState) {
  const recallPulseAlpha = RECALL_PULSE_MIN_ALPHA + (1 - RECALL_PULSE_MIN_ALPHA) * (0.5 + 0.5 * pulseWave(RECALL_PULSE_SPEED));
  for (const [championState, { coin, recallRing }] of coinsByChampionState) {
    const isOwnChampion = championState.team === gameState.playerSide;
    coin.visible = championState.isAlive && (isOwnChampion || championState.isVisibleToPlayer);
    coin.position.set(championState.position.x, championState.position.y);
    const displayedState = displayedStateFor(championState, gameState.playerSide);
    recallRing.visible = displayedState.activity === ACTIVITY.RECALLING;
    recallRing.alpha = recallPulseAlpha;
  }
}

export async function createChampionCoins(gameState, coinLayer) {
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
