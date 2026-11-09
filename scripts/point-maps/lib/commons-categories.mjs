// Постройки архитектора по категориям Wikimedia Commons («Buildings by Zaha Hadid» и т. п.).
// Нужны там, где в Wikidata у постройки не указан архитектор (P84): так на Commons разложены
// работы Лю Цзякуня, Радича и других, у кого в Wikidata почти пусто.
import { claimIds, claimValues, getEntities, request } from './wikidata.mjs';

const WORKS_CATEGORY = /^Category:(Buildings|Architectural works|Building works|Works|Structures) (by|of) /i;
// Группировки внутри категории построек: «… in Germany», «Bridges by …»; глубже трёх уровней не идём
const MAX_DEPTH = 3;
const CATEGORY_ITEM = 'Q4167836';

const commons = async (params) =>
  (await request(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`)).json();

// Подкатегории вместе с привязанными к ним элементами Wikidata
async function subcategories(title) {
  const result = [];
  let next = {};
  do {
    const json = await commons({
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: title,
      gcmtype: 'subcat',
      gcmlimit: '500',
      prop: 'pageprops',
      ppprop: 'wikibase_item',
      ...next,
    });
    for (const page of json.query?.pages ?? []) result.push({ title: page.title, item: page.pageprops?.wikibase_item });
    next = json.continue ?? null;
  } while (next);
  return result;
}

// Категория-элемент Wikidata (Q4167836) указывает на постройку через «основная тема категории» (P301)
async function resolveCategoryItems(ids) {
  const entities = await getEntities(ids, { languages: ['en'], sites: [] });
  return Object.fromEntries(
    ids.map((id) => {
      const entity = entities[id];
      if (!entity) return [id, null];
      if (claimIds(entity, 'P31').includes(CATEGORY_ITEM)) return [id, claimIds(entity, 'P301')[0] ?? null];
      return [id, entity.id];
    })
  );
}

async function collectWorks(title, depth, found, seen) {
  if (depth > MAX_DEPTH || seen.has(title)) return;
  seen.add(title);
  for (const child of await subcategories(title)) {
    if (child.item) found.add(child.item);
    else await collectWorks(child.title, depth + 1, found, seen);
  }
}

/**
 * @param {Record<string, string[]>} entitiesByGroup группа → элементы Wikidata архитектора и его бюро
 * @returns {Promise<{ rows: {work: string, group: string, category: string}[], categories: Record<string, string> }>}
 */
export async function worksFromCommonsCategories(entitiesByGroup) {
  const architects = await getEntities(Object.values(entitiesByGroup).flat(), { languages: ['en'], sites: [] });
  const rows = [];
  const categories = {};

  for (const [group, entities] of Object.entries(entitiesByGroup)) {
    const own = entities.map((id) => claimValues(architects[id], 'P373')[0]).filter(Boolean).map((name) => `Category:${name}`);
    const worksCategories = [];
    for (const title of own) {
      worksCategories.push(...(await subcategories(title)).map((child) => child.title).filter((child) => WORKS_CATEGORY.test(child)));
    }
    // Нет отдельной категории построек — берём прямые подкатегории самого архитектора
    const roots = worksCategories.length ? worksCategories : own;
    const depth = worksCategories.length ? 0 : MAX_DEPTH;
    categories[group] = roots.join(', ');

    const found = new Set();
    const seen = new Set();
    for (const root of roots) await collectWorks(root, depth, found, seen);
    const resolved = await resolveCategoryItems([...found]);
    const ownEntities = new Set(entities);
    for (const [id, work] of Object.entries(resolved)) {
      if (work && !ownEntities.has(work)) rows.push({ work, group, category: id });
    }
    console.log(`Commons: ${group} — ${found.size} категорий (${categories[group] || 'нет категории'})`);
  }
  return { rows, categories };
}
