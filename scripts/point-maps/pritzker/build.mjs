// Собирает данные карты построек лауреатов Притцкеровской премии из Wikidata.
// Запуск: npm run point-maps:pritzker (сырые ответы кэшируются в .cache/, обновить: -- --refresh)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { claimIds, claimValues, claimYear, getEntities, label, sparql } from '../lib/wikidata.mjs';
import { createPlaceResolver } from '../lib/places.mjs';
import { worksFromCommonsCategories } from '../lib/commons-categories.mjs';
import { syncPhotos } from '../lib/photos.mjs';
import { loadAdditions } from '../lib/additions.mjs';
import { LAUREATES } from './laureates.mjs';
import { EXCLUDE, KEEP } from './overrides.mjs';

const ROOT = new URL('../../../', import.meta.url);
const CACHE = new URL('.cache/point-maps/pritzker/wikidata.json', ROOT);
const REVIEW = new URL('.cache/point-maps/pritzker/from-categories.tsv', ROOT);
const ADDITIONS = new URL('additions.json', import.meta.url);
const OUTPUT = new URL('src/data/point-maps/pritzker/points.json', ROOT);
const PHOTOS_DIR = new URL('public/images/point-maps/pritzker/', ROOT);
const PHOTOS_PATH = '/images/point-maps/pritzker';

// Снесённое, разрушенное, неосуществлённое и не являющееся постройкой
const EXCLUDED_TYPES = new Set([
  'Q19860854', // разрушенное здание или сооружение
  'Q57644089', // разрушенная церковь
  'Q56556915', // снесено или разрушено
  'Q109607', // руины
  'Q811683', // проектируемое здание
  'Q124835105', // проектируемая башня
  'Q124834912', // проектируемый жилой дом
  'Q64728694', // предлагаемая сущность
  'Q105821051', // непостроенное здание
  'Q21514702', // заброшенный проект
  'Q25447168', // архитектурный проект
  'Q170584', // проект
  'Q12377751', // строящееся здание
  'Q1570262', // незавершённое здание: башня «Россия», Tour Signal, Millennium Tower
  'Q2096123', // долгострой
  'Q1907895', // комплексное планирование
  'Q5266783', // план развития
  'Q18577275', // городской проект
  'Q9063445', // проект городского развития
  'Q841654', // конкурс
  'Q464980', // выставка
  'Q936821', // передвижная выставка
  'Q20437094', // инсталляция
]);
const EXCLUDED_STATES = new Set([
  'Q56556915', // снесено или разрушено
  'Q12377751', // строится
  'Q811683', // проектируется
  'Q97317113', // строительство приостановлено
]);
const DEMOLITION = 'Q331483';

// Классы, которые не описывают само сооружение: их не показываем как тип
const NON_PHYSICAL_TYPES = new Set([
  'Q210272', 'Q163740', 'Q43229', 'Q1081138', 'Q4830453', 'Q55097243', 'Q708676', 'Q11396960', 'Q783794', 'Q4167836',
]);

// Подписи на других языках нужны постройкам, у которых нет ни русской, ни английской
const LANGUAGES = ['ru', 'en', 'mul', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ca', 'ja', 'zh'];

const refresh = process.argv.includes('--refresh');

async function loadWikidata(extraIds) {
  if (!refresh && existsSync(CACHE)) {
    const cached = JSON.parse(readFileSync(CACHE, 'utf8'));
    // Новые записи из additions.json догружаем, не перезапрашивая всё остальное
    const missing = extraIds.filter((id) => !cached.items[id]);
    if (!missing.length) return cached;
    Object.assign(cached.items, await getEntities(missing, { languages: LANGUAGES }));
    writeFileSync(CACHE, JSON.stringify(cached));
    return cached;
  }

  const entities = LAUREATES.flatMap((laureate) => laureate.entities);
  const rows = await sparql(`SELECT DISTINCT ?work ?architect WHERE {
    VALUES ?architect { ${entities.map((id) => `wd:${id}`).join(' ')} }
    ?work wdt:P84 ?architect .
  }`);
  console.log(`Wikidata: ${rows.length} связей «постройка — архитектор»`);
  const { rows: categoryRows } = await worksFromCommonsCategories(
    Object.fromEntries(LAUREATES.map((laureate) => [laureate.id, laureate.entities]))
  );
  console.log(`Commons: ${categoryRows.length} связей «постройка — лауреат» из категорий`);
  const items = await getEntities([...rows, ...categoryRows].map((row) => row.work).concat(extraIds), { languages: LANGUAGES });

  const data = { fetched: new Date().toISOString().slice(0, 10), rows, categoryRows, items };
  mkdirSync(new URL('.', CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(data));
  return data;
}

function exclusionReason(item) {
  if (KEEP.has(item.id)) return null;
  if (EXCLUDE.has(item.id)) return 'исключено вручную';
  if (!itemName(item)) return 'нет названия';
  if (!coordinatesOf(item)) return 'нет координат';
  if (claimIds(item, 'P31').some((type) => EXCLUDED_TYPES.has(type))) return 'тип';
  if ([...claimIds(item, 'P5817'), ...claimIds(item, 'P5816')].some((state) => EXCLUDED_STATES.has(state))) return 'состояние';
  if (claimIds(item, 'P793').includes(DEMOLITION)) return 'снос';
  // Дата прекращения существования у здания означает снос; действующие оставлены в KEEP
  if (claimValues(item, 'P576').length) return 'прекратило существование';
  return null;
}

// Координаты из additions.json важнее Wikidata: там их либо нет, либо они неточные
let additions = { linked: new Map(), rows: [], manual: [] };
const coordinatesOf = (item) => {
  const override = additions.linked.get(item.id);
  if (override?.lat !== undefined) return { latitude: override.lat, longitude: override.lng };
  return claimValues(item, 'P625').find((value) => value.globe?.endsWith('Q2'));
};

const wikipediaTitle = (item) => item.sitelinks?.ruwiki?.title?.replace(/\s+\([^)]*\)$/, '');
// Последний вариант — категория на Commons: у некоторых построек нет подписи ни на одном языке
// Мягкие переносы (U+00AD) встречаются в русских подписях и ломают поиск по названию
const itemName = (item) =>
  (item.labels?.ru?.value ?? wikipediaTitle(item) ?? label(item, LANGUAGES) ?? claimValues(item, 'P373')[0])?.replace(/\u00AD/g, '');

async function main() {
  const groupIds = new Set(LAUREATES.map((laureate) => laureate.id));
  additions = loadAdditions(ADDITIONS, groupIds);
  const { fetched, rows, categoryRows = [], items: fetchedItems } = await loadWikidata([...additions.linked.keys()]);
  // Объединённые в Wikidata элементы приходят под новым id — сводим к нему
  const canonical = Object.fromEntries(Object.entries(fetchedItems).map(([id, item]) => [id, item.id]));
  const items = Object.fromEntries(Object.values(fetchedItems).map((item) => [item.id, item]));

  const groupsByEntity = new Map();
  for (const laureate of LAUREATES) {
    for (const entity of laureate.entities) groupsByEntity.set(entity, [...(groupsByEntity.get(entity) ?? []), laureate.id]);
  }
  const groupsByItem = new Map();
  for (const { work: requested, architect } of rows) {
    const work = canonical[requested];
    if (!work) continue;
    groupsByItem.set(work, new Set([...(groupsByItem.get(work) ?? []), ...(groupsByEntity.get(architect) ?? [])]));
  }
  // Постройки, известные только по категориям Commons, — для ручной проверки после сборки
  const fromCategoriesOnly = new Map();
  for (const { work: requested, group } of categoryRows) {
    const work = canonical[requested];
    if (!work) continue;
    if (!groupsByItem.get(work)?.has(group)) fromCategoriesOnly.set(`${work}|${group}`, { work, group });
    groupsByItem.set(work, new Set([...(groupsByItem.get(work) ?? []), group]));
  }

  for (const { work: requested, group } of additions.rows) {
    const work = canonical[requested];
    if (!work) throw new Error(`В Wikidata нет элемента ${requested} из additions.json`);
    groupsByItem.set(work, new Set([...(groupsByItem.get(work) ?? []), group]));
  }

  const reasons = {};
  const kept = Object.values(items).filter((item) => {
    const reason = exclusionReason(item);
    if (reason) reasons[reason] = (reasons[reason] ?? 0) + 1;
    return !reason;
  });
  console.log(`Постройки: ${kept.length} из ${Object.keys(items).length}; отброшено:`, reasons);

  const resolvePlace = await createPlaceResolver(Object.fromEntries(kept.map((item) => [item.id, item])));
  const typeIds = kept.flatMap((item) => claimIds(item, 'P31'));
  const types = await getEntities(typeIds, { sites: [] });

  const photoFiles = Object.fromEntries(
    [
      ...kept.map((item) => [item.id, additions.linked.get(item.id)?.photo ?? claimValues(item, 'P18')[0]]),
      ...additions.manual.map((entry) => [entry.id, entry.photo]),
    ].filter(([, file]) => file)
  );
  const photos = process.argv.includes('--no-photos') ? {} : await syncPhotos(photoFiles, PHOTOS_DIR, PHOTOS_PATH);

  // Год раньше 20-летия лауреата — это дата исходного сооружения, а не его работы (Бергизель у Хадид — 1927)
  const architects = await getEntities(LAUREATES.flatMap((laureate) => laureate.entities), { sites: [] });
  const careerStart = new Map(
    LAUREATES.map(({ id, entities }) => {
      const births = entities.map((entity) => claimYear(architects[entity], 'P569')).filter(Boolean);
      return [id, births.length ? Math.min(...births) + 20 : -Infinity];
    })
  );
  const plausibleYear = (year, groups) => (year && groups.some((group) => year >= careerStart.get(group)) ? year : undefined);

  const order = new Map(LAUREATES.map((laureate, index) => [laureate.id, index]));
  const points = kept
    .map((item) => {
      const coordinates = coordinatesOf(item);
      const typeId = claimIds(item, 'P31').find((type) => !NON_PHYSICAL_TYPES.has(type) && types[type]);
      const { place, country } = resolvePlace(item);
      const groups = [...groupsByItem.get(item.id)].sort((a, b) => order.get(a) - order.get(b));
      // Кириллица в адресе короче процентной записи, браузер закодирует её сам
      const link = decodeURI(item.sitelinks?.ruwiki?.url ?? item.sitelinks?.enwiki?.url ?? `https://www.wikidata.org/wiki/${item.id}`);
      return {
        id: item.id,
        name: additions.linked.get(item.id)?.name ?? itemName(item),
        lat: Number(coordinates.latitude.toFixed(5)),
        lng: Number(coordinates.longitude.toFixed(5)),
        groups,
        year: additions.linked.has(item.id) && 'year' in additions.linked.get(item.id)
          ? (additions.linked.get(item.id).year ?? undefined)
          : plausibleYear(claimYear(item, 'P1619') ?? claimYear(item, 'P571'), groups),
        type: typeId ? label(types[typeId]) : undefined,
        place,
        country,
        link,
        photo: photos[item.id],
      };
    })
    .concat(
      additions.manual.map(({ id, name, lat, lng, group, year, type, place, country, link }) => ({
        id,
        name,
        lat,
        lng,
        groups: [group],
        year,
        type,
        place,
        country,
        link,
        photo: photos[id],
      }))
    )
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

  const groups = LAUREATES.map(({ id, name, year }) => ({ id, name, year }));
  mkdirSync(new URL('.', OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify({ source: 'Wikidata', fetched, groups, points }, null, '\t')}\n`);

  const perGroup = groups.map(({ id, name }) => `${name}: ${points.filter((point) => point.groups.includes(id)).length}`);
  console.log(`Записано ${points.length} построек, с фото ${points.filter((point) => point.photo).length}`);
  console.log(perGroup.join('\n'));

  const byId = new Map(points.map((point) => [point.id, point]));
  const review = [...fromCategoriesOnly.values()]
    .filter(({ work }) => byId.has(work))
    .map(({ work, group }) => `${group}\t${work}\t${byId.get(work).name}\t${byId.get(work).type ?? ''}\t${byId.get(work).place ?? ''}`)
    .sort();
  writeFileSync(REVIEW, `${review.join('\n')}\n`);
  console.log(`Только из категорий Commons: ${review.length} связей, список для проверки — ${REVIEW.pathname}`);
}

await main();
