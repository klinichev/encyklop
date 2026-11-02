import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker, StyleSpecification } from 'maplibre-gl';
import { feature, merge } from 'topojson-client';
import type { GeometryCollection, Polygon, Topology } from 'topojson-specification';
import polylabel from 'polylabel';
import citiesData from './data/cities.json';
import { nameAt } from './timeline-core';
import type { Entity, Named } from './timeline-core';

const DATA_URL = '/data/history-map';
const INITIAL_BOUNDS: [[number, number], [number, number]] = [[14, 34.7], [31, 48.8]];
const MINOR_CITY_ZOOM = 5.6;
const MIN_LABEL_AREA_PX = 2600;

export const MAX_BOUNDS: [[number, number], [number, number]] = [[8, 32], [36, 52]];
export const ZOOM_LIMITS = { minZoom: 4, maxZoom: 11 };

export type ProvinceProps = { id: string; name: string };
type BorderProps = { bid: string; a: string; b: string | null };
export type ProvinceTopology = Topology<{
  provinces: GeometryCollection<ProvinceProps>;
  borders: GeometryCollection<BorderProps>;
}>;

type City = Named & { at: [number, number]; major?: boolean };
type RealmLabel = { marker: Marker; element: HTMLDivElement; key: string; box: [number, number, number, number] };

// Что показать на карте: сам рендерер не знает, откуда берутся данные
export interface MapView {
  year: number;
  ownerOf: (province: string) => string | null;
  entityOf: (owner: string) => Entity;
  familyOf: (owner: string) => string;
}

const cities = citiesData as City[];

const ringArea = (ring: number[][]) =>
  Math.abs(ring.reduce((sum, [x, y], i) => {
    const [nextX, nextY] = ring[(i + 1) % ring.length];
    return sum + x * nextY - nextX * y;
  }, 0)) / 2;

export const loadTopology = async () => {
  const response = await fetch(`${DATA_URL}/provinces.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<ProvinceTopology>;
};

export const provincesOf = (topology: ProvinceTopology) =>
  topology.objects.provinces.geometries.map((geometry) => geometry.properties as ProvinceProps);

const historicStyle = (topology: ProvinceTopology): StyleSpecification => ({
  version: 8,
  sources: {
    land: { type: 'geojson', data: `${DATA_URL}/land.json`, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Natural Earth' },
    rivers: { type: 'geojson', data: `${DATA_URL}/rivers.json` },
    lakes: { type: 'geojson', data: `${DATA_URL}/lakes.json` },
    provinces: {
      type: 'geojson',
      data: feature(topology, topology.objects.provinces),
      promoteId: 'id',
    },
    borders: {
      type: 'geojson',
      data: feature(topology, topology.objects.borders),
      promoteId: 'bid',
    },
  },
  layers: [
    { id: 'sea', type: 'background', paint: { 'background-color': '#a9bdc1' } },
    { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': '#d9d3c3' } },
    {
      id: 'province-fill',
      type: 'fill',
      source: 'provinces',
      paint: { 'fill-color': ['coalesce', ['feature-state', 'color'], '#d9d3c3'] },
    },
    {
      id: 'lakes',
      type: 'fill',
      source: 'lakes',
      paint: { 'fill-color': '#a9bdc1' },
    },
    {
      id: 'rivers',
      type: 'line',
      source: 'rivers',
      paint: { 'line-color': '#5f8a99', 'line-width': 0.8, 'line-opacity': 0.75 },
    },
    {
      id: 'coast',
      type: 'line',
      source: 'land',
      paint: { 'line-color': '#5b6660', 'line-width': 0.6 },
    },
    {
      id: 'borders',
      type: 'line',
      source: 'borders',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'match', ['coalesce', ['feature-state', 'level'], 0],
          2, '#2b211c',
          1, '#4a3d35',
          '#000000',
        ],
        'line-opacity': [
          'match', ['coalesce', ['feature-state', 'level'], 0],
          2, 0.95,
          1, 0.8,
          0.13,
        ],
        'line-width': [
          'match', ['coalesce', ['feature-state', 'level'], 0],
          2, 2,
          1, 1.1,
          0.6,
        ],
      },
    },
    {
      id: 'province-selected',
      type: 'line',
      source: 'provinces',
      paint: {
        'line-color': '#ffffff',
        'line-width': 2.5,
        'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0],
      },
    },
  ],
});

export const createHistoricMap = (container: HTMLElement, topology: ProvinceTopology) => {
  const map = new maplibregl.Map({
    container,
    style: historicStyle(topology),
    bounds: INITIAL_BOUNDS,
    fitBoundsOptions: { padding: 12 },
    ...ZOOM_LIMITS,
    maxBounds: MAX_BOUNDS,
    renderWorldCopies: false,
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  return map;
};

const createCityMarker = (city: City) => {
  const element = document.createElement('div');
  element.className = 'history-map-city';
  element.style.pointerEvents = 'none';
  const dot = document.createElement('span');
  dot.className = 'history-map-city-dot';
  const label = document.createElement('span');
  label.className = 'history-map-city-label';
  element.append(dot, label);
  const marker = new maplibregl.Marker({ element, anchor: 'left', offset: [-3, 0] }).setLngLat(city.at);
  return { city, marker, element, label };
};

// Создаётся после события load карты: перекрашивает провинции и ведёт подписи
export class MapRenderer {
  private labels = new Map<string, RealmLabel>();
  private cityMarkers: ReturnType<typeof createCityMarker>[];
  private readonly onZoomEnd = () => this.fitLabels();

  constructor(private map: MapLibreMap, private topology: ProvinceTopology) {
    this.cityMarkers = cities.map(createCityMarker);
    this.cityMarkers.forEach(({ marker }) => marker.addTo(map));
    map.on('zoomend', this.onZoomEnd);
  }

  // Смена данных меняет только раскраску и подписи: геометрия провинций остаётся той же
  render({ year, ownerOf, entityOf, familyOf }: MapView) {
    const { map, topology, labels } = this;
    const owners = new Map<string, string | null>();
    const provincesByOwner = new Map<string, Polygon[]>();

    topology.objects.provinces.geometries.forEach((geometry) => {
      const { id } = geometry.properties as ProvinceProps;
      const owner = ownerOf(id);
      owners.set(id, owner);
      map.setFeatureState({ source: 'provinces', id }, { color: owner ? entityOf(owner).color : null });
      if (!owner) return;
      if (!provincesByOwner.has(owner)) provincesByOwner.set(owner, []);
      provincesByOwner.get(owner)!.push(geometry as unknown as Polygon);
    });

    topology.objects.borders.geometries.forEach((geometry) => {
      const { bid, a, b } = geometry.properties as BorderProps;
      const ownerA = owners.get(a) ?? null;
      const ownerB = b ? owners.get(b) ?? null : null;
      let level = 2;
      if (ownerA === ownerB && b) level = 0;
      else if (ownerA && ownerB && familyOf(ownerA) === familyOf(ownerB)) level = 1;
      map.setFeatureState({ source: 'borders', id: bid }, { level });
    });

    labels.forEach((label, owner) => {
      if (!provincesByOwner.has(owner)) {
        label.marker.remove();
        labels.delete(owner);
      }
    });
    provincesByOwner.forEach((owned, owner) => {
      const key = owned.map((geometry) => (geometry as unknown as { properties: ProvinceProps }).properties.id).join();
      let label = labels.get(owner);
      if (!label || label.key !== key) {
        const merged = merge(topology, owned as never) as unknown as GeoJSON.MultiPolygon;
        const largest = merged.coordinates.reduce((best, polygon) =>
          ringArea(polygon[0]) > ringArea(best[0]) ? polygon : best
        );
        const position = polylabel(largest, 0.02) as [number, number];
        const xs = largest[0].map((point) => point[0]);
        const ys = largest[0].map((point) => point[1]);
        const box: RealmLabel['box'] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        label?.marker.remove();
        const element = document.createElement('div');
        element.className = 'history-map-realm';
        element.style.pointerEvents = 'none';
        const marker = new maplibregl.Marker({ element }).setLngLat(position).addTo(map);
        label = { marker, element, key, box };
        labels.set(owner, label);
      }
      label.element.textContent = nameAt(entityOf(owner), year);
    });

    this.cityMarkers.forEach(({ city, label }) => {
      label.textContent = nameAt(city, year);
    });
    this.fitLabels();
  }

  // Подпись показываем, только если она помещается в свои границы при текущем масштабе
  private fitLabels() {
    const { map } = this;
    const zoom = map.getZoom();
    const realms = [...this.labels.values()].map(({ element, box }) => {
      const [west, south, east, north] = box;
      const a = map.project([west, north]);
      const b = map.project([east, south]);
      return { element, area: Math.abs(b.x - a.x) * Math.abs(b.y - a.y) };
    });

    // При наложении остаётся подпись более крупной державы, а города уступают державам
    const placed: DOMRect[] = [];
    const overlaps = (rect: DOMRect) => placed.some((other) =>
      rect.left < other.right && other.left < rect.right && rect.top < other.bottom && other.top < rect.bottom
    );
    realms.sort((x, y) => y.area - x.area).forEach(({ element, area }) => {
      element.style.fontSize = `${Math.max(10, Math.min(18, 7 + Math.sqrt(area) / 16))}px`;
      element.style.display = area > MIN_LABEL_AREA_PX ? 'block' : 'none';
      if (element.style.display === 'none') return;
      const rect = element.getBoundingClientRect();
      if (overlaps(rect)) element.style.display = 'none';
      else placed.push(rect);
    });
    this.cityMarkers
      .slice()
      .sort((x, y) => Number(Boolean(y.city.major)) - Number(Boolean(x.city.major)))
      .forEach(({ city, element }) => {
        element.style.display = city.major || zoom >= MINOR_CITY_ZOOM ? 'flex' : 'none';
        if (element.style.display === 'none') return;
        const rect = element.getBoundingClientRect();
        if (overlaps(rect)) element.style.display = 'none';
        else placed.push(rect);
      });
  }

  destroy() {
    this.map.off('zoomend', this.onZoomEnd);
    this.labels.forEach(({ marker }) => marker.remove());
    this.labels.clear();
    this.cityMarkers.forEach(({ marker }) => marker.remove());
  }
}
