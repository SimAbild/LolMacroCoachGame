import { WALK_GRID_ROWS, WALK_GRID_SIZE } from '../data/walkGrid.js';
import { MAP_SIZE } from './mapConstants.js';

const CELL_SIZE = MAP_SIZE / WALK_GRID_SIZE;
const WALKABLE_CHARACTER = '.';
const STRAIGHT_STEP_COST = 1;
const DIAGONAL_STEP_COST = Math.SQRT2;
const LINE_SAMPLE_FRACTION = 0.5;
const NEAREST_WALKABLE_MAX_RADIUS = 12;
const NEIGHBOR_OFFSETS = Object.freeze([
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
]);

const walkableCells = buildWalkableCells();

export function isWalkable(position) {
  const { column, row } = cellOf(position);
  return isWalkableCell(column, row);
}

export function nearestWalkable(position) {
  const { column, row } = cellOf(position);
  if (isWalkableCell(column, row)) {
    return { x: position.x, y: position.y };
  }
  for (let radius = 1; radius <= NEAREST_WALKABLE_MAX_RADIUS; radius += 1) {
    for (let deltaRow = -radius; deltaRow <= radius; deltaRow += 1) {
      for (let deltaColumn = -radius; deltaColumn <= radius; deltaColumn += 1) {
        const isOnRing = Math.max(Math.abs(deltaRow), Math.abs(deltaColumn)) === radius;
        if (isOnRing && isWalkableCell(column + deltaColumn, row + deltaRow)) {
          return centerOf(column + deltaColumn, row + deltaRow);
        }
      }
    }
  }
  return { x: position.x, y: position.y };
}

export function hasLineOfSight(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.ceil(distance / (CELL_SIZE * LINE_SAMPLE_FRACTION));
  for (let step = 1; step < steps; step += 1) {
    const progress = step / steps;
    const sample = { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
    if (!isWalkable(sample)) {
      return false;
    }
  }
  return true;
}

export function castVisionRay(origin, angle, radius) {
  const stepLength = CELL_SIZE * LINE_SAMPLE_FRACTION;
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  let travelled = 0;
  while (travelled < radius) {
    const next = Math.min(radius, travelled + stepLength);
    if (!isWalkable({ x: origin.x + directionX * next, y: origin.y + directionY * next })) {
      break;
    }
    travelled = next;
  }
  return { x: origin.x + directionX * travelled, y: origin.y + directionY * travelled };
}

export function findPath(from, to) {
  const start = cellOf(nearestWalkable(from));
  const goal = cellOf(nearestWalkable(to));
  const cellPath = aStar(start, goal);
  if (!cellPath) {
    return [nearestWalkable(to)];
  }
  const waypoints = cellPath.map(cell => centerOf(cell.column, cell.row));
  waypoints[waypoints.length - 1] = nearestWalkable(to);
  return smoothPath(from, waypoints);
}

function aStar(start, goal) {
  const startIndex = indexOf(start.column, start.row);
  const goalIndex = indexOf(goal.column, goal.row);
  const costSoFar = new Float32Array(WALK_GRID_SIZE * WALK_GRID_SIZE).fill(Infinity);
  const cameFrom = new Int32Array(WALK_GRID_SIZE * WALK_GRID_SIZE).fill(-1);
  const openHeap = new MinHeap();
  costSoFar[startIndex] = 0;
  openHeap.push(startIndex, octileDistance(start, goal));
  while (openHeap.size > 0) {
    const currentIndex = openHeap.pop();
    if (currentIndex === goalIndex) {
      return reconstructPath(cameFrom, goalIndex);
    }
    const column = currentIndex % WALK_GRID_SIZE;
    const row = Math.floor(currentIndex / WALK_GRID_SIZE);
    for (const [deltaColumn, deltaRow] of NEIGHBOR_OFFSETS) {
      const neighborColumn = column + deltaColumn;
      const neighborRow = row + deltaRow;
      if (!isWalkableCell(neighborColumn, neighborRow)) {
        continue;
      }
      const isDiagonal = deltaColumn !== 0 && deltaRow !== 0;
      if (isDiagonal && (!isWalkableCell(column + deltaColumn, row) || !isWalkableCell(column, row + deltaRow))) {
        continue;
      }
      const neighborIndex = indexOf(neighborColumn, neighborRow);
      const newCost = costSoFar[currentIndex] + (isDiagonal ? DIAGONAL_STEP_COST : STRAIGHT_STEP_COST);
      if (newCost < costSoFar[neighborIndex]) {
        costSoFar[neighborIndex] = newCost;
        cameFrom[neighborIndex] = currentIndex;
        openHeap.push(neighborIndex, newCost + octileDistance({ column: neighborColumn, row: neighborRow }, goal));
      }
    }
  }
  return null;
}

function reconstructPath(cameFrom, goalIndex) {
  const cells = [];
  for (let index = goalIndex; index !== -1; index = cameFrom[index]) {
    cells.push({ column: index % WALK_GRID_SIZE, row: Math.floor(index / WALK_GRID_SIZE) });
  }
  return cells.reverse();
}

function smoothPath(from, waypoints) {
  const smoothed = [];
  let anchor = from;
  let index = 0;
  while (index < waypoints.length) {
    let furthestVisible = index;
    while (furthestVisible + 1 < waypoints.length && hasLineOfSight(anchor, waypoints[furthestVisible + 1])) {
      furthestVisible += 1;
    }
    smoothed.push(waypoints[furthestVisible]);
    anchor = waypoints[furthestVisible];
    index = furthestVisible + 1;
  }
  return smoothed;
}

function octileDistance(first, second) {
  const deltaColumn = Math.abs(first.column - second.column);
  const deltaRow = Math.abs(first.row - second.row);
  return Math.max(deltaColumn, deltaRow) + (DIAGONAL_STEP_COST - 1) * Math.min(deltaColumn, deltaRow);
}

function buildWalkableCells() {
  const cells = new Uint8Array(WALK_GRID_SIZE * WALK_GRID_SIZE);
  WALK_GRID_ROWS.forEach((rowText, row) => {
    for (let column = 0; column < WALK_GRID_SIZE; column += 1) {
      cells[indexOf(column, row)] = rowText[column] === WALKABLE_CHARACTER ? 1 : 0;
    }
  });
  return cells;
}

function isWalkableCell(column, row) {
  return column >= 0 && row >= 0 && column < WALK_GRID_SIZE && row < WALK_GRID_SIZE && walkableCells[indexOf(column, row)] === 1;
}

function cellOf(position) {
  return {
    column: Math.min(WALK_GRID_SIZE - 1, Math.max(0, Math.floor(position.x / CELL_SIZE))),
    row: Math.min(WALK_GRID_SIZE - 1, Math.max(0, Math.floor(position.y / CELL_SIZE))),
  };
}

function centerOf(column, row) {
  return { x: (column + 0.5) * CELL_SIZE, y: (row + 0.5) * CELL_SIZE };
}

function indexOf(column, row) {
  return row * WALK_GRID_SIZE + column;
}

class MinHeap {
  #items = [];
  #priorities = [];

  get size() {
    return this.#items.length;
  }

  push(item, priority) {
    this.#items.push(item);
    this.#priorities.push(priority);
    this.#bubbleUp(this.#items.length - 1);
  }

  pop() {
    const top = this.#items[0];
    const lastItem = this.#items.pop();
    const lastPriority = this.#priorities.pop();
    if (this.#items.length > 0) {
      this.#items[0] = lastItem;
      this.#priorities[0] = lastPriority;
      this.#sinkDown(0);
    }
    return top;
  }

  #bubbleUp(index) {
    let childIndex = index;
    while (childIndex > 0) {
      const parentIndex = Math.floor((childIndex - 1) / 2);
      if (this.#priorities[parentIndex] <= this.#priorities[childIndex]) {
        return;
      }
      this.#swap(parentIndex, childIndex);
      childIndex = parentIndex;
    }
  }

  #sinkDown(index) {
    let parentIndex = index;
    for (;;) {
      const leftIndex = parentIndex * 2 + 1;
      const rightIndex = leftIndex + 1;
      let smallestIndex = parentIndex;
      if (leftIndex < this.#items.length && this.#priorities[leftIndex] < this.#priorities[smallestIndex]) {
        smallestIndex = leftIndex;
      }
      if (rightIndex < this.#items.length && this.#priorities[rightIndex] < this.#priorities[smallestIndex]) {
        smallestIndex = rightIndex;
      }
      if (smallestIndex === parentIndex) {
        return;
      }
      this.#swap(parentIndex, smallestIndex);
      parentIndex = smallestIndex;
    }
  }

  #swap(first, second) {
    [this.#items[first], this.#items[second]] = [this.#items[second], this.#items[first]];
    [this.#priorities[first], this.#priorities[second]] = [this.#priorities[second], this.#priorities[first]];
  }
}
