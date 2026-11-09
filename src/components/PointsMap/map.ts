import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatBoundsLike, Map as MapLibreMap, PaddingOptions, StyleSpecification } from 'maplibre-gl';
import type { MapPoint } from './types';

export const SOURCE = 'points';
export const CLUSTER_LAYER = 'clusters';
export const POINT_LAYER = 'points';
const SELECTED_SOURCE = 'selected';

const ACCENT = '#db2777';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const style: StyleSpecification = {
  version: 8,
  // Шрифт нужен только для цифр на кластерах
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export const toFeatures = (points: MapPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }> => ({
  type: 'FeatureCollection',
  features: points.map((point) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
    properties: { id: point.id },
  })),
});

export const WORLD_VIEW = { center: [10, 30] as [number, number], zoom: 1.3 };

export function createPointsMap(container: HTMLElement) {
  const map = new maplibregl.Map({
    container,
    style,
    ...WORLD_VIEW,
    minZoom: 1,
    maxZoom: 18,
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  return map;
}

export function addPointLayers(map: MapLibreMap) {
  map.addSource(SOURCE, {
    type: 'geojson',
    data: toFeatures([]),
    cluster: true,
    clusterRadius: 42,
    clusterMaxZoom: 13,
  });
  map.addSource(SELECTED_SOURCE, { type: 'geojson', data: toFeatures([]) });

  map.addLayer({
    id: CLUSTER_LAYER,
    type: 'circle',
    source: SOURCE,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#f472b6', 10, '#ec4899', 50, '#be185d'],
      'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 23, 200, 28],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
      'circle-opacity': 0.92,
    },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: SOURCE,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#fff' },
  });
  map.addLayer({
    id: POINT_LAYER,
    type: 'circle',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ACCENT,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 5, 12, 8],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  });
  map.addLayer({
    id: 'selected',
    type: 'circle',
    source: SELECTED_SOURCE,
    paint: {
      'circle-color': '#fff',
      'circle-radius': 11,
      'circle-stroke-width': 4,
      'circle-stroke-color': ACCENT,
    },
  });

  for (const layer of [CLUSTER_LAYER, POINT_LAYER]) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  }
}

export const showPoints = (map: MapLibreMap, points: MapPoint[]) =>
  (map.getSource(SOURCE) as GeoJSONSource).setData(toFeatures(points));

export const showSelected = (map: MapLibreMap, point: MapPoint | null) =>
  (map.getSource(SELECTED_SOURCE) as GeoJSONSource).setData(toFeatures(point ? [point] : []));

export async function zoomIntoCluster(map: MapLibreMap, clusterId: number, center: [number, number]) {
  const zoom = await (map.getSource(SOURCE) as GeoJSONSource).getClusterExpansionZoom(clusterId);
  map.easeTo({ center, zoom });
}

// Показать все точки; при одной точке — приблизиться к ней
export function fitPoints(map: MapLibreMap, points: MapPoint[], padding: number | PaddingOptions) {
  if (!points.length) return;
  if (points.length === 1) {
    map.easeTo({ center: [points[0].lng, points[0].lat], zoom: 13 });
    return;
  }
  const bounds: LngLatBoundsLike = [
    [Math.min(...points.map((point) => point.lng)), Math.min(...points.map((point) => point.lat))],
    [Math.max(...points.map((point) => point.lng)), Math.max(...points.map((point) => point.lat))],
  ];
  map.fitBounds(bounds, { padding, maxZoom: 13, duration: 800 });
}
