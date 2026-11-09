// Ручные дополнения к данным из Wikidata: additions.json рядом со скриптом карты.
// Запись с wikidata связывает объект с группой и может поправить lat/lng, name, photo, year (null — убрать год);
// запись без wikidata — целиком ручная точка (id, name, lat, lng, type, place, country, year, link, photo).
import { readFileSync } from 'node:fs';

const MANUAL_FIELDS = ['name', 'lat', 'lng'];

export function loadAdditions(file, groupIds) {
  const { points } = JSON.parse(readFileSync(file, 'utf8'));
  const errors = [];
  points.forEach((entry, index) => {
    const where = `${file.pathname}: points[${index}]`;
    if (!groupIds.has(entry.group)) errors.push(`${where}: нет группы ${entry.group}`);
    if (!entry.source) errors.push(`${where}: не указан источник (source)`);
    if ((entry.lat === undefined) !== (entry.lng === undefined)) errors.push(`${where}: нужны обе координаты`);
    if (!entry.wikidata) {
      if (!entry.id?.startsWith('manual-')) errors.push(`${where}: id ручной записи должен начинаться с manual-`);
      for (const field of MANUAL_FIELDS) if (entry[field] === undefined) errors.push(`${where}: нет поля ${field}`);
    }
  });
  if (errors.length) throw new Error(`Ошибки в дополнениях:\n${errors.join('\n')}`);

  const linked = points.filter((entry) => entry.wikidata);
  return {
    // id из Wikidata → поправки (координаты, название, фото) и группы
    linked: new Map(linked.map((entry) => [entry.wikidata, entry])),
    rows: linked.map(({ wikidata, group }) => ({ work: wikidata, group })),
    manual: points.filter((entry) => !entry.wikidata),
  };
}
