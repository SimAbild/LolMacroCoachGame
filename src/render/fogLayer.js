import { Sprite, Texture } from '../../vendor/pixi-8.22.0.min.mjs';
import { MAP_SIZE } from '../game/mapLayout.js';
import { castVisionRay } from '../game/navigation.js';

const FOG_COLOR_RGBA = 'rgba(4, 7, 10, 0.66)';
// The fog is drawn at half resolution: it is soft-edged anyway, and this halves the work per frame.
const FOG_TEXTURE_SCALE = 0.5;
const FOG_SOFT_EDGE_START = 0.8;
const FULL_CIRCLE_RADIANS = Math.PI * 2;
const VISION_RAY_COUNT = 96;
const MAX_CACHED_VISION_SHAPES = 400;
// Vision shapes only depend on position and radius, and wards and towers stand still, so they are cached.
const visionShapeCache = new Map();

// A dark layer over the map with the player's vision cut out of it. Walls block vision:
// each vision circle is traced with rays that stop at the first wall.
export function createFogLayer() {
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
