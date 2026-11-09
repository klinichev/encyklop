// Общие запросы к Wikidata и Wikimedia Commons для тематических карт
const USER_AGENT = 'encyklop-point-maps/1.0 (https://encyklop.com)';
const HEADERS = { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Wikimedia отвечает 429 при частых запросах, соединение тоже иногда рвётся — повторяем с нарастающей паузой
export async function request(url, options = {}, attempt = 0) {
  let response;
  try {
    response = await fetch(url, { ...options, headers: { ...HEADERS, ...options.headers } });
  } catch (error) {
    if (attempt >= 6) throw error;
    await sleep(2 ** attempt * 1000);
    return request(url, options, attempt + 1);
  }
  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    const retryAfter = Number(response.headers.get('retry-after')) || 2 ** attempt;
    await sleep(retryAfter * 1000);
    return request(url, options, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response;
}

export async function sparql(query) {
  const response = await request('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
    body: new URLSearchParams({ query }),
  });
  const json = await response.json();
  return json.results.bindings.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, { value }]) => [key, value.replace('http://www.wikidata.org/entity/', '')]))
  );
}

const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

// Сущности целиком: подписи, утверждения, ссылки на статьи Википедии
export async function getEntities(ids, { languages = ['ru', 'en'], sites = ['ruwiki', 'enwiki'] } = {}) {
  const result = {};
  for (const batch of chunks([...new Set(ids)], 50)) {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'labels|claims|sitelinks/urls',
      languages: languages.join('|'),
      sitefilter: sites.join('|'),
      format: 'json',
    });
    const json = await (await request(`https://www.wikidata.org/w/api.php?${params}`)).json();
    for (const [id, entity] of Object.entries(json.entities ?? {})) {
      // Объединённые сущности приходят с перенаправлением — сохраняем под исходным id
      if (!entity.missing) result[id] = entity;
    }
  }
  return result;
}

// Значения утверждения: сначала предпочтительный ранг, устаревшие отбрасываем
export function claimValues(entity, property) {
  const claims = (entity?.claims?.[property] ?? []).filter((claim) => claim.rank !== 'deprecated' && claim.mainsnak.snaktype === 'value');
  const preferred = claims.filter((claim) => claim.rank === 'preferred');
  return (preferred.length ? preferred : claims).map((claim) => claim.mainsnak.datavalue.value);
}

export const claimIds = (entity, property) => claimValues(entity, property).map((value) => value.id).filter(Boolean);

export function claimYear(entity, property) {
  const [value] = claimValues(entity, property);
  // Точность 9 и выше — год, месяц или день; десятилетия и века не показываем
  if (!value?.time || value.precision < 9) return undefined;
  const year = Number.parseInt(value.time.slice(0, 5), 10);
  return Number.isFinite(year) ? year : undefined;
}

export const label = (entity, languages = ['ru', 'en']) => {
  for (const language of languages) {
    const value = entity?.labels?.[language]?.value;
    if (value) return value;
  }
  return Object.values(entity?.labels ?? {})[0]?.value;
};

// Сведения о файлах Commons: превью нужной ширины, автор и лицензия
export async function getCommonsFiles(fileNames, width) {
  const result = {};
  for (const batch of chunks([...new Set(fileNames)], 50)) {
    const params = new URLSearchParams({
      action: 'query',
      titles: batch.map((name) => `File:${name}`).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(width),
      iiextmetadatafilter: 'Artist|LicenseShortName|AttributionRequired',
      format: 'json',
      formatversion: '2',
    });
    const json = await (await request(`https://commons.wikimedia.org/w/api.php?${params}`)).json();
    const normalized = Object.fromEntries((json.query.normalized ?? []).map(({ from, to }) => [to, from]));
    for (const page of json.query.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const name = (normalized[page.title] ?? page.title).replace(/^File:/, '');
      const meta = info.extmetadata ?? {};
      result[name] = {
        thumbUrl: info.thumburl,
        pageUrl: info.descriptionurl,
        author: stripHtml(meta.Artist?.value),
        license: stripHtml(meta.LicenseShortName?.value),
      };
    }
  }
  return result;
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

export const stripHtml = (html) =>
  html
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity])
    .replace(/\s+/g, ' ')
    .trim() || undefined;

export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index], index);
      }
    })
  );
  return results;
}
