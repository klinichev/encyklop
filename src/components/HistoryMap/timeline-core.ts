// Логика шкалы времени без импорта данных: редактор получает данные с dev-сервера,
// и статический импорт JSON перезагружал бы его страницу при каждом сохранении
import range from './data/range.json';

export type Confidence = 'high' | 'medium' | 'low';
export type LayerId = 'political' | 'religion' | 'language';

export interface Named {
  names: { from: number; name: string }[];
}

export interface Entity extends Named {
  id: string;
  color: string;
  group?: string;
  to?: number;
}

export interface HistoryEvent {
  year: number;
  note: string;
  confidence: Confidence;
  source?: string;
  changes: Record<string, string[]>;
}

export interface Holding {
  from: number;
  owner: string;
  event: HistoryEvent;
}

export interface LayerData {
  entities: Entity[];
  events: HistoryEvent[];
}

export interface Suzerainty {
  vassal: string;
  suzerain: string;
  from: number;
  to: number;
}

export interface CompiledLayer {
  holdings: Map<string, Holding[]>;
  entityById: Map<string, Entity>;
}

export const FIRST_YEAR = range.firstYear;
export const LAST_YEAR = range.lastYear;

export const LAYERS: { id: LayerId; label: string }[] = [
  { id: 'political', label: 'Политика' },
  { id: 'religion', label: 'Религия' },
  { id: 'language', label: 'Языки' },
];

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: 'высокая',
  medium: 'средняя',
  low: 'низкая',
};

export const clampYear = (value: number) => Math.min(LAST_YEAR, Math.max(FIRST_YEAR, value));

// События слоя сворачиваются в интервалы по провинциям, отсортированные по году
export const compileLayer = ({ entities, events }: LayerData): CompiledLayer => {
  const holdings = new Map<string, Holding[]>();
  for (const event of events) {
    for (const [owner, provinces] of Object.entries(event.changes)) {
      for (const province of provinces) {
        if (!holdings.has(province)) holdings.set(province, []);
        holdings.get(province)!.push({ from: event.year, owner, event });
      }
    }
  }
  return { holdings, entityById: new Map(entities.map((entity) => [entity.id, entity])) };
};

export const nameAt = ({ names }: Named, year: number) =>
  names.reduce((current, item) => (item.from <= year ? item : current), names[0]).name;

export const suzerainIn = (suzerainty: Suzerainty[], entity: string, year: number) =>
  suzerainty.find((item) => item.vassal === entity && item.from <= year && year < item.to)?.suzerain ?? null;

// Верхний сюзерен: граница внутри одной державы с её вассалами рисуется тоньше
export const realmIn = (suzerainty: Suzerainty[], entity: string, year: number) => {
  const visited = new Set([entity]);
  let current = entity;
  for (let next = suzerainIn(suzerainty, current, year); next && !visited.has(next); next = suzerainIn(suzerainty, current, year)) {
    visited.add(next);
    current = next;
  }
  return current;
};

export const holdingIn = (compiled: CompiledLayer, province: string, year: number): Holding | undefined => {
  const holdings = compiled.holdings.get(province);
  if (!holdings) return undefined;
  let low = 0;
  let high = holdings.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (holdings[middle].from <= year) low = middle;
    else high = middle - 1;
  }
  return holdings[low];
};
