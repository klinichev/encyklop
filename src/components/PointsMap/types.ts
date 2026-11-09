// Формат points.json; схема и проверки — в src/content/config.ts (коллекция pointMapData)
export interface PointGroup {
  id: string;
  name: string;
  year?: number;
}

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  groups: string[];
  year?: number;
  type?: string;
  place?: string;
  country?: string;
  link?: string;
  photo?: {
    src: string;
    author?: string;
    license?: string;
    source: string;
  };
}

export interface PointMapData {
  source: string;
  fetched: string;
  groups: PointGroup[];
  points: MapPoint[];
}

export interface FilterLabels {
  label: string;
  all: string;
}

export type NounForms = [string, string, string];

export const groupLabel = ({ name, year }: PointGroup) => (year ? `${name} (${year})` : name);

export const plural = (count: number, [one, few, many]: NounForms) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};
