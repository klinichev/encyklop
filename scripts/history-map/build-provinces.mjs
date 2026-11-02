// Собирает геометрию карты: node scripts/history-map/build-provinces.mjs
//
// Провинции «растут» из точек seeds.json по карте стоимости: склоны, крупные реки и море пересекать
// дорого, поэтому границы сами ложатся на хребты и реки. Результат обрезается по суше.
// Исходные данные скачиваются один раз в .cache/history-map/:
//   береговая линия — OpenStreetMap (ODbL), реки и озёра — Natural Earth, рельеф — Terrain Tiles на AWS.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import polygonClipping from 'polygon-clipping';
import { PNG } from 'pngjs';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';

const root = new URL('../../', import.meta.url);
const path = (relative) => fileURLToPath(new URL(relative, root));
const cacheDir = path('.cache/history-map/');
const outDir = path('public/data/history-map/');
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const { bounds, provinces } = JSON.parse(readFileSync(path('scripts/history-map/seeds.json'), 'utf8'));
const [west, south, east, north] = bounds;
const bbox = bounds.join(',');

const CELL_DEGREES = 0.015;
const TERRAIN_ZOOM = 7;
const SEA_COST = 7;
const RIVER_COST = { major: 30, medium: 14, minor: 6 };
const COAST_KEEP = '22%';
const MIN_ISLAND = 'min-area=1.5km2';
const STAIR_TOLERANCE = 0.017;

const download = async (url, target) => {
  if (existsSync(target)) return;
  console.log(`Скачиваю ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
};

const neUrl = (name) => `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/${name}.geojson`;
const NE_FILES = ['ne_10m_rivers_lake_centerlines', 'ne_10m_lakes'];
const OSM_ZIP = join(cacheDir, 'simplified-land-polygons-complete-3857.zip');
await Promise.all(NE_FILES.map((name) => download(neUrl(name), join(cacheDir, `${name}.geojson`))));
await download('https://osmdata.openstreetmap.de/download/simplified-land-polygons-complete-3857.zip', OSM_ZIP);

const mapshaper = (input, commands, output) => {
  execFileSync(
    process.execPath,
    [path('node_modules/mapshaper/bin/mapshaper'), input, ...commands, '-o', output, 'format=geojson', 'precision=0.0001'],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
};

const landPath = join(outDir, 'land.json');
mapshaper(OSM_ZIP, ['-target', 'simplified_land_polygons', '-proj', 'wgs84', '-clip', `bbox=${bbox}`, '-explode', '-simplify', COAST_KEEP, 'keep-shapes', '-filter-islands', MIN_ISLAND, 'remove-empty'], landPath);
mapshaper(join(cacheDir, 'ne_10m_rivers_lake_centerlines.geojson'), ['-clip', `bbox=${bbox}`, '-filter', 'scalerank <= 7', '-filter-fields', 'name,scalerank', '-simplify', '40%'], join(outDir, 'rivers.json'));
mapshaper(join(cacheDir, 'ne_10m_lakes.geojson'), ['-clip', `bbox=${bbox}`, '-filter', 'scalerank <= 8', '-filter-fields', 'name', '-simplify', '50%'], join(outDir, 'lakes.json'));

const land = JSON.parse(readFileSync(landPath, 'utf8'));
land.features = land.features.filter(({ geometry }) => geometry);
writeFileSync(landPath, JSON.stringify(land));
const landPolygons = land.features.flatMap(({ geometry }) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates));
const boxOf = (ring) => {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const landBoxes = landPolygons.map((polygon) => boxOf(polygon[0]));

const cols = Math.round((east - west) / CELL_DEGREES);
const rows = Math.round((north - south) / CELL_DEGREES);
const cellOf = (lon, lat) => [Math.floor((lon - west) / CELL_DEGREES), Math.floor((north - lat) / CELL_DEGREES)];
const lonOf = (col) => west + col * CELL_DEGREES;
const latOf = (row) => north - row * CELL_DEGREES;
const index = (col, row) => row * cols + col;

// Маска суши: заливка полигонов построчно
const isLand = new Uint8Array(cols * rows);
for (const polygon of landPolygons) {
  polygon.forEach((ring, ringIndex) => {
    const value = ringIndex === 0 ? 1 : 0;
    const crossings = new Map();
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      if (y1 === y2) continue;
      const [, r1] = cellOf(x1, y1);
      const [, r2] = cellOf(x2, y2);
      for (let row = Math.max(0, Math.min(r1, r2) - 1); row <= Math.min(rows - 1, Math.max(r1, r2) + 1); row += 1) {
        const lat = latOf(row) - CELL_DEGREES / 2;
        if ((y1 > lat) === (y2 > lat)) continue;
        if (!crossings.has(row)) crossings.set(row, []);
        crossings.get(row).push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    crossings.forEach((xs, row) => {
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const from = Math.max(0, Math.ceil((xs[i] - west) / CELL_DEGREES - 0.5));
        const to = Math.min(cols - 1, Math.floor((xs[i + 1] - west) / CELL_DEGREES - 0.5));
        for (let col = from; col <= to; col += 1) isLand[index(col, row)] = value;
      }
    });
  });
}

// Рельеф
const tileX = (lon) => ((lon + 180) / 360) * 2 ** TERRAIN_ZOOM;
const tileY = (lat) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** TERRAIN_ZOOM;
};
const tileRange = { x0: Math.floor(tileX(west)), x1: Math.floor(tileX(east)), y0: Math.floor(tileY(north)), y1: Math.floor(tileY(south)) };
const tiles = new Map();
const terrainDir = join(cacheDir, `terrain-${TERRAIN_ZOOM}`);
mkdirSync(terrainDir, { recursive: true });
const tileRequests = [];
for (let x = tileRange.x0; x <= tileRange.x1; x += 1) {
  for (let y = tileRange.y0; y <= tileRange.y1; y += 1) {
    const target = join(terrainDir, `${x}-${y}.png`);
    tileRequests.push({ x, y, target, url: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${TERRAIN_ZOOM}/${x}/${y}.png` });
  }
}
for (let i = 0; i < tileRequests.length; i += 8) {
  await Promise.all(tileRequests.slice(i, i + 8).map(({ url, target }) => download(url, target)));
}
for (const { x, y, target } of tileRequests) tiles.set(`${x}/${y}`, PNG.sync.read(readFileSync(target)));

const elevationAt = (lon, lat) => {
  const fx = tileX(lon);
  const fy = tileY(lat);
  const tile = tiles.get(`${Math.floor(fx)}/${Math.floor(fy)}`);
  if (!tile) return 0;
  const px = Math.min(255, Math.floor((fx % 1) * 256));
  const py = Math.min(255, Math.floor((fy % 1) * 256));
  const offset = (py * tile.width + px) * 4;
  return tile.data[offset] * 256 + tile.data[offset + 1] + tile.data[offset + 2] / 256 - 32768;
};

const elevation = new Float32Array(cols * rows);
for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) elevation[index(col, row)] = elevationAt(lonOf(col) + CELL_DEGREES / 2, latOf(row) - CELL_DEGREES / 2);
}

// Плавный шум: на равнинах граница иначе вышла бы прямой линией
const random = (x, y) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const noiseAt = (x, y) => {
  const [x0, y0] = [Math.floor(x), Math.floor(y)];
  const [tx, ty] = [x - x0, y - y0];
  const [sx, sy] = [tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)];
  const top = random(x0, y0) * (1 - sx) + random(x0 + 1, y0) * sx;
  const bottom = random(x0, y0 + 1) * (1 - sx) + random(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bottom * sy;
};

// Ячейки шума выровнены по осям, и граница шла бы по их краям: поворачиваем и искривляем сетку
const organicNoise = (x, y) => {
  const warpX = x + (noiseAt(x * 0.6 + 17, y * 0.6 + 5) - 0.5) * 2.5;
  const warpY = y + (noiseAt(x * 0.6 + 3, y * 0.6 + 29) - 0.5) * 2.5;
  return noiseAt(warpX * 0.8 - warpY * 0.6 + 500, warpX * 0.6 + warpY * 0.8 + 500);
};

const kmPerCellY = CELL_DEGREES * 111;
const cost = new Float32Array(cols * rows);
for (let row = 0; row < rows; row += 1) {
  const kmPerCellX = kmPerCellY * Math.cos((latOf(row) * Math.PI) / 180);
  for (let col = 0; col < cols; col += 1) {
    const i = index(col, row);
    if (!isLand[i]) {
      cost[i] = SEA_COST;
      continue;
    }
    const left = elevation[index(Math.max(0, col - 1), row)];
    const right = elevation[index(Math.min(cols - 1, col + 1), row)];
    const up = elevation[index(col, Math.max(0, row - 1))];
    const down = elevation[index(col, Math.min(rows - 1, row + 1))];
    const slope = Math.hypot((right - left) / (2 * kmPerCellX), (down - up) / (2 * kmPerCellY));
    const noise = organicNoise(col / 18, row / 18) * 0.7 + organicNoise(col / 5 + 40, row / 5 + 90) * 0.3;
    cost[i] = 1 + noise * 2.2 + Math.min(slope / 45, 5) + Math.max(0, elevation[i]) / 1200;
  }
}

// Реки: линия утолщается, чтобы через неё нельзя было пройти по диагонали
const rivers = JSON.parse(readFileSync(join(outDir, 'rivers.json'), 'utf8'));
const markRiver = (a, b, penalty) => {
  const [c0, r0] = cellOf(a[0], a[1]);
  const [c1, r1] = cellOf(b[0], b[1]);
  const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0), 1);
  for (let s = 0; s <= steps; s += 1) {
    const col = Math.round(c0 + ((c1 - c0) * s) / steps);
    const row = Math.round(r0 + ((r1 - r0) * s) / steps);
    for (const [dc, dr] of [[0, 0], [1, 0], [0, 1]]) {
      const [cc, rr] = [col + dc, row + dr];
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
      const i = index(cc, rr);
      if (isLand[i]) cost[i] = Math.max(cost[i], penalty);
    }
  }
};
for (const { geometry, properties } of rivers.features) {
  if (!geometry) continue;
  const rank = properties.scalerank ?? 7;
  const penalty = rank <= 4 ? RIVER_COST.major : rank <= 6 ? RIVER_COST.medium : RIVER_COST.minor;
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  for (const line of lines) for (let i = 0; i + 1 < line.length; i += 1) markRiver(line[i], line[i + 1], penalty);
}

// Рост провинций: алгоритм Дейкстры сразу от всех точек
const label = new Int16Array(cols * rows).fill(-1);
const distance = new Float32Array(cols * rows).fill(Infinity);
const heapKeys = [];
const heapCells = [];
const push = (key, cell) => {
  let i = heapKeys.length;
  heapKeys.push(key);
  heapCells.push(cell);
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heapKeys[parent] <= key) break;
    heapKeys[i] = heapKeys[parent];
    heapCells[i] = heapCells[parent];
    i = parent;
  }
  heapKeys[i] = key;
  heapCells[i] = cell;
};
const pop = () => {
  const cell = heapCells[0];
  const lastKey = heapKeys.pop();
  const lastCell = heapCells.pop();
  const size = heapKeys.length;
  if (size) {
    let i = 0;
    while (true) {
      let child = 2 * i + 1;
      if (child >= size) break;
      if (child + 1 < size && heapKeys[child + 1] < heapKeys[child]) child += 1;
      if (heapKeys[child] >= lastKey) break;
      heapKeys[i] = heapKeys[child];
      heapCells[i] = heapCells[child];
      i = child;
    }
    heapKeys[i] = lastKey;
    heapCells[i] = lastCell;
  }
  return cell;
};

// Точка у берега могла попасть в море: сдвигаем её на ближайшую сушу, чтобы рост начинался с земли
const snapToLand = (at) => {
  const [col, row] = cellOf(at[0], at[1]);
  if (isLand[index(col, row)]) return index(col, row);
  for (let radius = 1; radius <= 8; radius += 1) {
    let best = null;
    let bestDistance = Infinity;
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
        const i = index(col + dc, row + dr);
        const d = dc * dc + dr * dr;
        if (isLand[i] && d < bestDistance) {
          best = i;
          bestDistance = d;
        }
      }
    }
    if (best !== null) return best;
  }
  return index(col, row);
};

const seedCells = provinces.map(({ at }) => snapToLand(at));
seedCells.forEach((cell, i) => {
  if (label[cell] !== -1) throw new Error(`Точки ${provinces[i].id} и ${provinces[label[cell]].id} попали в одну клетку`);
  label[cell] = i;
  distance[cell] = 0;
  push(0, cell);
});

// Отдельные участки суши: на участок со своей точкой чужая провинция зайти не может,
// иначе остров дотягивается через узкий пролив до материка, которому дороже идти через горы
const landmass = new Int32Array(cols * rows).fill(-1);
let landmassCount = 0;
for (let start = 0; start < landmass.length; start += 1) {
  if (!isLand[start] || landmass[start] !== -1) continue;
  const stack = [start];
  landmass[start] = landmassCount;
  while (stack.length) {
    const cell = stack.pop();
    const row = Math.floor(cell / cols);
    const col = cell - row * cols;
    for (const [nc, nr] of [[col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]]) {
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const next = index(nc, nr);
      if (isLand[next] && landmass[next] === -1) {
        landmass[next] = landmassCount;
        stack.push(next);
      }
    }
  }
  landmassCount += 1;
}
const seededLandmass = new Set(seedCells.map((cell) => landmass[cell]));
const seedLandmass = seedCells.map((cell) => landmass[cell]);

// Ходы конём убирают прямые границы по осям, которые дают только восемь направлений
const NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1],
  [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2],
];
const settled = new Uint8Array(cols * rows);
while (heapKeys.length) {
  const cell = pop();
  if (settled[cell]) continue;
  settled[cell] = 1;
  const row = Math.floor(cell / cols);
  const col = cell - row * cols;
  const scaleX = Math.cos((latOf(row) * Math.PI) / 180);
  for (const [dc, dr] of NEIGHBORS) {
    const [nc, nr] = [col + dc, row + dr];
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
    const next = index(nc, nr);
    if (settled[next]) continue;
    const mass = landmass[next];
    if (mass !== -1 && seededLandmass.has(mass) && mass !== seedLandmass[label[cell]]) continue;
    const step = Math.hypot(dc * scaleX, dr);
    let passed = cost[next];
    // Длинный ход не должен перепрыгивать реку: считаем самую дорогую из пройденных клеток
    if (Math.abs(dc) + Math.abs(dr) === 3) {
      const [mc, mr] = Math.abs(dc) === 2 ? [col + Math.sign(dc), nr] : [nc, row + Math.sign(dr)];
      const [oc, or] = Math.abs(dc) === 2 ? [col + Math.sign(dc), row] : [col, row + Math.sign(dr)];
      passed = Math.max(passed, cost[index(mc, mr)], cost[index(oc, or)]);
    }
    const candidate = distance[cell] + passed * step;
    if (candidate < distance[next]) {
      distance[next] = candidate;
      label[next] = label[cell];
      push(candidate, next);
    }
  }
}

// Контуры областей по рёбрам клеток: у соседних областей вершины совпадают, поэтому общие границы точны
const rawFeatures = provinces.map(() => new Map());
const addEdge = (owner, from, to) => {
  const edges = rawFeatures[owner];
  if (!edges.has(from)) edges.set(from, []);
  edges.get(from).push(to);
};
const vertex = (col, row) => row * (cols + 1) + col;
for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) {
    const owner = label[index(col, row)];
    if (col + 1 >= cols || label[index(col + 1, row)] !== owner) addEdge(owner, vertex(col + 1, row + 1), vertex(col + 1, row));
    if (col === 0 || label[index(col - 1, row)] !== owner) addEdge(owner, vertex(col, row), vertex(col, row + 1));
    if (row + 1 >= rows || label[index(col, row + 1)] !== owner) addEdge(owner, vertex(col, row + 1), vertex(col + 1, row + 1));
    if (row === 0 || label[index(col, row - 1)] !== owner) addEdge(owner, vertex(col + 1, row), vertex(col, row));
  }
}
const vertexPoint = (v) => {
  const row = Math.floor(v / (cols + 1));
  const col = v - row * (cols + 1);
  return [+lonOf(col).toFixed(5), +latOf(row).toFixed(5)];
};
const signedArea = (ring) => ring.reduce((sum, [x, y], i) => {
  if (i + 1 === ring.length) return sum;
  return sum + x * ring[i + 1][1] - ring[i + 1][0] * y;
}, 0) / 2;
const pointInRing = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const traceRings = (edges) => {
  const rings = [];
  while (edges.size) {
    const start = edges.keys().next().value;
    const ring = [start];
    let current = start;
    while (true) {
      const options = edges.get(current);
      const next = options.pop();
      if (!options.length) edges.delete(current);
      ring.push(next);
      current = next;
      if (current === start) break;
    }
    rings.push(ring.map(vertexPoint));
  }
  return rings;
};

const rawCollection = {
  type: 'FeatureCollection',
  features: provinces.map((province, i) => {
    const rings = traceRings(rawFeatures[i]);
    const outers = rings.filter((ring) => signedArea(ring) > 0).map((ring) => [ring]);
    for (const hole of rings.filter((ring) => signedArea(ring) <= 0)) {
      const parent = outers.find(([outer]) => pointInRing(hole[0], outer));
      if (parent) parent.push(hole);
    }
    return { type: 'Feature', properties: { id: province.id }, geometry: { type: 'MultiPolygon', coordinates: outers } };
  }),
};

// Лестницу клеток сглаживаем по общим дугам, поэтому у соседей граница остаётся одной и той же
const simplifyLine = (line, tolerance) => {
  if (line.length < 3) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = line[a];
    const [bx, by] = line[b];
    const length = Math.hypot(bx - ax, by - ay);
    let farthest = -1;
    let max = tolerance;
    for (let i = a + 1; i < b; i += 1) {
      const [x, y] = line[i];
      const d = length ? Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / length : Math.hypot(x - ax, y - ay);
      if (d > max) {
        max = d;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([a, farthest], [farthest, b]);
    }
  }
  return line.filter((_, i) => keep[i]);
};
const chaikin = (line, iterations) => {
  let current = line;
  for (let n = 0; n < iterations; n += 1) {
    const next = [current[0]];
    for (let i = 0; i + 1 < current.length; i += 1) {
      const [x0, y0] = current[i];
      const [x1, y1] = current[i + 1];
      next.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
};
const rawTopology = topology({ all: rawCollection });
rawTopology.arcs = rawTopology.arcs.map((arc) => {
  const closed = arc[0][0] === arc[arc.length - 1][0] && arc[0][1] === arc[arc.length - 1][1];
  if (closed && arc.length < 5) return arc;
  const simplified = closed
    ? [...simplifyLine(arc.slice(0, Math.ceil(arc.length / 2) + 1), STAIR_TOLERANCE), ...simplifyLine(arc.slice(Math.ceil(arc.length / 2)), STAIR_TOLERANCE).slice(1)]
    : simplifyLine(arc, STAIR_TOLERANCE);
  return chaikin(simplified, 2).map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
});
const smooth = feature(rawTopology, rawTopology.objects.all);

// Обрезка по суше
const features = smooth.features.flatMap((item, i) => {
  const province = provinces[i];
  const polygons = item.geometry.type === 'Polygon' ? [item.geometry.coordinates] : item.geometry.coordinates;
  const coordinates = [];
  for (const polygon of polygons) {
    if (polygon[0].length < 4) continue;
    const [x0, y0, x1, y1] = boxOf(polygon[0]);
    const nearby = landPolygons.filter((_, n) => {
      const box = landBoxes[n];
      return box[0] <= x1 && box[2] >= x0 && box[1] <= y1 && box[3] >= y0;
    });
    if (nearby.length) coordinates.push(...polygonClipping.intersection([polygon], nearby));
  }
  if (!coordinates.length) {
    if (!province.context) throw new Error(`Провинция без суши: ${province.id}`);
    return [];
  }
  return [{
    type: 'Feature',
    properties: { id: province.id, ...(province.name && { name: province.name }), ...(province.context && { context: true }) },
    geometry: { type: 'MultiPolygon', coordinates },
  }];
});

const topo = topology({ all: { type: 'FeatureCollection', features } }, 2e5);
const geometries = topo.objects.all.geometries;

// Край между двумя провинциями принадлежит обеим; край с одним владельцем — это берег
const arcOwners = new Map();
const walk = (arcs, visit) => (typeof arcs[0] === 'number' ? arcs.forEach(visit) : arcs.forEach((part) => walk(part, visit)));
geometries.forEach((geometry) => {
  walk(geometry.arcs, (arc) => {
    const key = arc < 0 ? ~arc : arc;
    if (!arcOwners.has(key)) arcOwners.set(key, new Set());
    arcOwners.get(key).add(geometry.properties.id);
  });
});

const isContext = new Set(features.filter((f) => f.properties.context).map((f) => f.properties.id));
const borderArcs = [...arcOwners].flatMap(([arc, owners]) => {
  const [a, b] = [...owners];
  if (owners.size !== 2 || (isContext.has(a) && isContext.has(b))) return [];
  const [inner, outer] = isContext.has(a) ? [b, null] : [a, isContext.has(b) ? null : b];
  return [{ arc, a: inner, b: outer }];
});

// Контекстные провинции нужны только для разбиения: на карте вместо них серая суша
const kept = geometries.filter((g) => !g.properties.context);
const used = new Set(borderArcs.map((b) => b.arc));
kept.forEach((g) => walk(g.arcs, (arc) => used.add(arc < 0 ? ~arc : arc)));
const order = [...used].sort((x, y) => x - y);
const remap = new Map(order.map((arc, i) => [arc, i]));
const remapArcs = (arcs) => (typeof arcs[0] === 'number'
  ? arcs.map((arc) => (arc < 0 ? ~remap.get(~arc) : remap.get(arc)))
  : arcs.map(remapArcs));

const result = {
  type: 'Topology',
  transform: topo.transform,
  bbox: topo.bbox,
  arcs: order.map((arc) => topo.arcs[arc]),
  objects: {
    provinces: {
      type: 'GeometryCollection',
      geometries: kept.map((g) => ({ ...g, arcs: remapArcs(g.arcs) })),
    },
    borders: {
      type: 'GeometryCollection',
      geometries: borderArcs.map(({ arc, a, b }, i) => ({
        type: 'LineString',
        arcs: [remap.get(arc)],
        properties: { bid: `b${i}`, a, b },
      })),
    },
  },
};
writeFileSync(join(outDir, 'provinces.json'), JSON.stringify(result));

// Отчёт о качестве
const ringAreaKm = (ring, lat) => Math.abs(signedArea(ring)) * 111 * 111 * Math.cos((lat * Math.PI) / 180);
const polygonArea = (polygon) => ringAreaKm(polygon[0], polygon[0][0][1]) - polygon.slice(1).reduce((sum, hole) => sum + ringAreaKm(hole, hole[0][1]), 0);
const snappedPoint = (i) => {
  const row = Math.floor(seedCells[i] / cols);
  const col = seedCells[i] - row * cols;
  return [lonOf(col) + CELL_DEGREES / 2, latOf(row) - CELL_DEGREES / 2];
};
const snappedFar = provinces
  .map((seed, i) => [seed.id, Math.hypot((snappedPoint(i)[0] - seed.at[0]) * 111 * Math.cos((seed.at[1] * Math.PI) / 180), (snappedPoint(i)[1] - seed.at[1]) * 111)])
  .filter(([id, km]) => km > 3 && !id.startsWith('ctx_'));
console.log('Точка сдвинута к суше больше чем на 3 км:', snappedFar.map(([id, km]) => `${id} ${km.toFixed(1)}`).join(', ') || 'нет');
const report = features.filter((f) => !f.properties.context).map((f) => {
  const seedIndex = provinces.findIndex((p) => p.id === f.properties.id);
  const seed = provinces[seedIndex];
  const parts = f.geometry.coordinates.map(polygonArea);
  const total = parts.reduce((a, b) => a + b, 0);
  const home = f.geometry.coordinates.findIndex((polygon) => pointInRing(snappedPoint(seedIndex), polygon[0]));
  return { id: seed.id, island: Boolean(seed.island), total, parts: parts.length, home, homeShare: home === -1 ? 0 : parts[home] / total };
});
report.sort((a, b) => a.total - b.total);
console.log(`Провинций: ${kept.length}, отрезков границ: ${borderArcs.length}, дуг: ${result.arcs.length}`);
console.log('Самые маленькие:', report.slice(0, 8).map((r) => `${r.id} ${r.total.toFixed(0)}`).join(', '));
console.log('Самые большие:', report.slice(-8).map((r) => `${r.id} ${r.total.toFixed(0)}`).join(', '));
const median = report[Math.floor(report.length / 2)].total;
console.log(`Медиана: ${median.toFixed(0)} км²`);
console.log('Точка вне своего полигона:', report.filter((r) => r.home === -1).map((r) => r.id).join(', ') || 'нет');
console.log('Основная часть не вокруг точки:', report.filter((r) => r.home !== -1 && r.homeShare < 0.7).map((r) => `${r.id} ${(r.homeShare * 100).toFixed(0)}%`).join(', ') || 'нет');
