// Город и страна объекта по цепочке «административная единица» (P131) из Wikidata
import { claimIds, getEntities, label, sparql } from './wikidata.mjs';

// Агломерации и районы тоже числятся населёнными пунктами, но подпись нужна на уровне города
const NOT_A_CITY = new Set(['Q702492', 'Q1907114', 'Q123705', 'Q2983893', 'Q188509', 'Q1394476', 'Q159313']);
// Прямо указанный тип «город», «крупный город», «столица», «мегаполис»: на нём и останавливаемся
const CITY_TYPES = new Set(['Q515', 'Q1549591', 'Q1637706', 'Q200250', 'Q5119', 'Q208511', 'Q174844']);
const COUNTRY_TYPES = new Set(['Q6256', 'Q3624078', 'Q7275', 'Q3024240']);
// Части города, которые Wikidata не связывает с ним самим: Большой Лондон, Вестминстер и Сити → Лондон
const CITY_ALIASES = { Q23306: 'Q84', Q179351: 'Q84', Q23311: 'Q84' };
const MAX_DEPTH = 8;

export async function createPlaceResolver(items) {
  const settlementTypes = new Set(
    (await sparql('SELECT ?c WHERE { ?c wdt:P279* wd:Q486972 }')).map((row) => row.c).filter((id) => !NOT_A_CITY.has(id))
  );

  const places = await getEntities(Object.values(CITY_ALIASES), { sites: [] });
  let frontier = Object.values(items).flatMap((item) => [...claimIds(item, 'P131'), ...claimIds(item, 'P17')]);
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const fresh = [...new Set(frontier)].filter((id) => !places[id]);
    Object.assign(places, await getEntities(fresh, { sites: [] }));
    frontier = fresh.flatMap((id) => [...claimIds(places[id], 'P131'), ...claimIds(places[id], 'P17')]);
  }

  const hasType = (entity, types) => claimIds(entity, 'P31').some((type) => types.has(type));

  return (item) => {
    const chain = [];
    const seen = new Set();
    for (let id = claimIds(item, 'P131')[0]; id && places[id] && !seen.has(id) && chain.length < MAX_DEPTH; id = claimIds(places[id], 'P131')[0]) {
      seen.add(id);
      if (CITY_ALIASES[id]) {
        chain.push(places[CITY_ALIASES[id]]);
        break;
      }
      chain.push(places[id]);
      // Город-государство (Сингапур, Монако) остаётся в цепочке как город
      if (hasType(places[id], COUNTRY_TYPES)) break;
    }
    const city =
      chain.find((entity) => hasType(entity, CITY_TYPES)) ??
      chain.find((entity) => hasType(entity, settlementTypes) && !hasType(entity, COUNTRY_TYPES)) ??
      chain.find((entity) => !hasType(entity, COUNTRY_TYPES));
    const countryId = claimIds(item, 'P17')[0] ?? claimIds(chain[0], 'P17')[0];
    return { place: label(city), country: label(places[countryId]) };
  };
}
