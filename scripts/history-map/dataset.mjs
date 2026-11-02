// Чтение, запись и проверка исторических данных. Общая логика для CLI и dev-сервера редактора.
import { readFileSync, renameSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const dataDir = new URL('src/components/HistoryMap/data/', root);
const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'));

export const LAYER_IDS = ['political', 'religion', 'language'];

export const loadDataset = () => ({
  layers: Object.fromEntries(LAYER_IDS.map((id) => [id, readJson(new URL(`${id}.json`, dataDir))])),
  suzerainty: readJson(new URL('suzerainty.json', dataDir)),
  range: readJson(new URL('range.json', dataDir)),
  provinceIds: readJson(new URL('scripts/history-map/seeds.json', root)).provinces.filter((p) => !p.context).map((p) => p.id),
  geometryIds: readJson(new URL('public/data/history-map/provinces.json', root)).objects.provinces.geometries.map((g) => g.properties.id),
});

// Запись через временный файл, чтобы сбой не оставил данные обрезанными
export const saveLayer = (layerId, layer) => {
  if (!LAYER_IDS.includes(layerId)) throw new Error(`Неизвестный слой: ${layerId}`);
  const target = new URL(`${layerId}.json`, dataDir);
  const temp = new URL(`${layerId}.json.tmp`, dataDir);
  writeFileSync(temp, `${JSON.stringify(layer, null, 2)}\n`);
  renameSync(temp, target);
};

const CONFIDENCES = new Set(['high', 'medium', 'low']);
const COLOR = /^#[0-9a-f]{6}$/i;

const validateLayer = (layerId, { entities, events }, { firstYear, lastYear }, provinceIds, errors, warnings) => {
  const fail = (message) => errors.push(`${layerId}: ${message}`);
  const warn = (message) => warnings.push(`${layerId}: ${message}`);
  const provinces = new Set(provinceIds);
  const entityById = new Map();

  for (const entity of entities) {
    if (entityById.has(entity.id)) fail(`значение ${entity.id} объявлено дважды`);
    entityById.set(entity.id, entity);
    if (!COLOR.test(entity.color ?? '')) fail(`у значения ${entity.id} неверный цвет ${entity.color}`);
    if (!entity.names?.length) {
      fail(`у значения ${entity.id} нет названия`);
      continue;
    }
    if (entity.names.some((item, i) => i > 0 && item.from <= entity.names[i - 1].from)) {
      fail(`названия значения ${entity.id} не отсортированы по годам`);
    }
    if (entity.to !== undefined && entity.to <= entity.names[0].from) fail(`значение ${entity.id} заканчивается раньше, чем начинается`);
  }

  const holdings = new Map();
  const used = new Set();
  let previousYear = -Infinity;
  let assignedThisYear = new Set();
  let missingSource = 0;

  for (const event of events) {
    const label = `${event.year}`;
    if (!Number.isInteger(event.year) || event.year < firstYear || event.year > lastYear) fail(`${label}: год вне диапазона ${firstYear}–${lastYear}`);
    if (event.year < previousYear) fail(`${label}: события должны идти по возрастанию года`);
    if (event.year !== previousYear) assignedThisYear = new Set();
    previousYear = event.year;
    if (!CONFIDENCES.has(event.confidence)) fail(`${label}: неверная достоверность ${event.confidence}`);
    if (!event.source) missingSource += 1;
    if (!Object.values(event.changes ?? {}).some((ids) => ids.length)) fail(`${label}: пустое событие`);

    for (const [entityId, ids] of Object.entries(event.changes ?? {})) {
      const entity = entityById.get(entityId);
      if (!entity) {
        fail(`${label}: нет значения ${entityId}`);
        continue;
      }
      used.add(entityId);
      if (event.year < entity.names?.[0]?.from) fail(`${label}: ${entityId} ещё не существует (с ${entity.names[0].from})`);
      for (const id of ids) {
        if (!provinces.has(id)) fail(`${label}: нет провинции ${id}`);
        if (assignedThisYear.has(id)) fail(`${label}: провинция ${id} назначена дважды за год`);
        assignedThisYear.add(id);
        if (!holdings.has(id)) holdings.set(id, []);
        holdings.get(id).push({ from: event.year, owner: entityId });
      }
    }
  }

  for (const id of provinces) {
    const own = holdings.get(id);
    if (!own) fail(`провинция ${id} без значения`);
    else if (own[0].from !== firstYear) fail(`у провинции ${id} нет значения на ${firstYear} год (первое с ${own[0].from})`);
  }

  // Интервалы владения: [from, to), последний тянется до конца шкалы
  const intervals = [];
  holdings.forEach((own, province) => {
    own.forEach((holding, i) => {
      const to = own[i + 1]?.from ?? lastYear + 1;
      intervals.push({ province, owner: holding.owner, from: holding.from, to });
      if (i > 0 && own[i - 1].owner === holding.owner) {
        warn(`${holding.from}: у ${province} значение ${holding.owner} уже было, запись лишняя`);
      }
    });
  });

  for (const { province, owner, to } of intervals) {
    const end = entityById.get(owner)?.to;
    if (end !== undefined && to > end) fail(`${province} остаётся у ${owner} до ${to - 1} года, хотя оно заканчивается в ${end}`);
  }

  for (const { id } of entities) if (!used.has(id)) warn(`значение ${id} нигде не используется`);
  if (missingSource) warn(`${missingSource} из ${events.length} событий без источника`);

  return { entityById, intervals, stats: { events: events.length, entities: entities.length, missingSource } };
};

const validateSuzerainty = (suzerainty, political, errors, warnings) => {
  const byVassal = new Map();
  for (const item of suzerainty) {
    const { vassal, suzerain, from, to } = item;
    const label = `Сюзеренитет ${vassal} → ${suzerain} (${from}–${to})`;
    if (!political.entityById.has(vassal) || !political.entityById.has(suzerain)) {
      errors.push(`${label}: нет такой державы`);
      continue;
    }
    if (from >= to) errors.push(`${label}: пустой интервал`);
    if (vassal === suzerain) errors.push(`${label}: держава не может быть своим вассалом`);
    for (const other of byVassal.get(vassal) ?? []) {
      if (from < other.to && other.from < to) errors.push(`${label}: пересекается с ${other.suzerain} (${other.from}–${other.to})`);
    }
    if (!byVassal.has(vassal)) byVassal.set(vassal, []);
    byVassal.get(vassal).push(item);

    const held = political.intervals.some((i) => i.owner === vassal && i.from < to && from < i.to);
    if (!held) warnings.push(`${label}: у вассала нет провинций за этот период`);
  }

  // Цепочка вассалитета не должна замыкаться ни в один из годов, где она меняется
  const years = new Set(suzerainty.map((item) => item.from));
  for (const year of years) {
    const parentOf = (entity) => (byVassal.get(entity) ?? []).find((item) => item.from <= year && year < item.to)?.suzerain;
    for (const start of byVassal.keys()) {
      const seen = new Set([start]);
      for (let next = parentOf(start); next; next = parentOf(next)) {
        if (seen.has(next)) {
          errors.push(`Сюзеренитет ${year}: цикл вассалитета через ${next}`);
          break;
        }
        seen.add(next);
      }
    }
  }
};

export const validateDataset = ({ layers, suzerainty, range, provinceIds, geometryIds }) => {
  const errors = [];
  const warnings = [];

  const seeds = new Set(provinceIds);
  const geometry = new Set(geometryIds);
  for (const id of seeds) if (!geometry.has(id)) errors.push(`Провинции ${id} нет в геометрии: пересоберите её через history-map:geometry`);
  for (const id of geometry) if (!seeds.has(id)) errors.push(`Провинции ${id} из геометрии нет в seeds.json: пересоберите геометрию`);

  const stats = {};
  let political;
  for (const id of LAYER_IDS) {
    const result = validateLayer(id, layers[id], { firstYear: range.firstYear, lastYear: range.lastYear }, provinceIds, errors, warnings);
    stats[id] = result.stats;
    if (id === 'political') political = result;
  }
  validateSuzerainty(suzerainty, political, errors, warnings);

  return { errors, warnings, stats };
};
