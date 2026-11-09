import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import PointCard from './PointCard';
import { CLUSTER_LAYER, POINT_LAYER, WORLD_VIEW, addPointLayers, createPointsMap, fitPoints, showPoints, showSelected, zoomIntoCluster } from './map';
import { groupLabel, plural } from './types';
import type { FilterLabels, MapPoint, NounForms, PointMapData } from './types';

interface Props {
  dataUrl: string;
  filter: FilterLabels;
  pointNoun: NounForms;
  note?: string;
}

// Выбранная группа хранится в адресе, чтобы ссылкой можно было поделиться
const GROUP_PARAM = 'group';
const DESKTOP_WIDTH = 768;
const CARD_WIDTH = 344;

const readGroupFromUrl = () => new URLSearchParams(window.location.search).get(GROUP_PARAM);

const writeGroupToUrl = (group: string | null) => {
  const url = new URL(window.location.href);
  if (group) url.searchParams.set(GROUP_PARAM, group);
  else url.searchParams.delete(GROUP_PARAM);
  window.history.replaceState(null, '', url);
};

const formatDate = (date: string) => new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function PointsMap({ dataUrl, filter, pointNoun, note }: Props) {
  const [data, setData] = useState<PointMapData | null>(null);
  const [failed, setFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(readGroupFromUrl);
  const [selected, setSelected] = useState<MapPoint | null>(null);

  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pointsById = useRef(new Map<string, MapPoint>());
  const zoomedToGroup = useRef(false);
  const selectedRef = useRef<MapPoint | null>(null);
  selectedRef.current = selected;

  useEffect(() => {
    let cancelled = false;
    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<PointMapData>;
      })
      .then((loaded) => {
        if (cancelled) return;
        pointsById.current = new Map(loaded.points.map((point) => [point.id, point]));
        setData(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  useEffect(() => {
    if (!container.current) return;
    const map = createPointsMap(container.current);
    mapRef.current = map;

    map.on('load', () => {
      addPointLayers(map);
      map.on('click', POINT_LAYER, (event: MapLayerMouseEvent) => {
        const point = pointsById.current.get(event.features?.[0]?.properties?.id);
        if (point) setSelected(point);
      });
      map.on('click', CLUSTER_LAYER, (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (feature?.geometry.type !== 'Point') return;
        zoomIntoCluster(map, feature.properties.cluster_id, feature.geometry.coordinates as [number, number]);
      });
      map.on('click', (event) => {
        if (!map.queryRenderedFeatures(event.point, { layers: [POINT_LAYER, CLUSTER_LAYER] }).length) setSelected(null);
      });
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    data?.points.forEach((point) => point.groups.forEach((id) => result.set(id, (result.get(id) ?? 0) + 1)));
    return result;
  }, [data]);

  // Группа из адреса могла исчезнуть из данных — тогда показываем всё
  const activeGroup = data?.groups.find((group) => group.id === groupId) ?? null;

  const visiblePoints = useMemo(
    () => (data ? data.points.filter((point) => !activeGroup || point.groups.includes(activeGroup.id)) : []),
    [data, activeGroup]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !data) return;
    showPoints(map, visiblePoints);
    // При открытии и так виден весь мир; к нему возвращаемся, когда группу сбросили
    if (!activeGroup) {
      if (zoomedToGroup.current) map.easeTo(WORLD_VIEW);
      zoomedToGroup.current = false;
      return;
    }
    zoomedToGroup.current = true;
    const desktopWithCard = selectedRef.current && map.getContainer().clientWidth >= DESKTOP_WIDTH;
    fitPoints(map, visiblePoints, desktopWithCard ? { top: 48, right: 48, bottom: 48, left: CARD_WIDTH + 24 } : 48);
  }, [mapReady, data, visiblePoints, activeGroup]);

  useEffect(() => {
    if (data) writeGroupToUrl(activeGroup?.id ?? null);
    // Карточка точки, которой больше нет на карте, закрывается
    if (activeGroup && selectedRef.current && !selectedRef.current.groups.includes(activeGroup.id)) setSelected(null);
  }, [data, activeGroup]);

  useEffect(() => {
    if (mapReady && mapRef.current) showSelected(mapRef.current, selected);
  }, [mapReady, selected]);

  const loading = !failed && (!data || !mapReady);

  return (
    <div className="points-map">
      <div className="mb-4 p-4 rounded-2xl bg-white shadow-lg flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-700">{filter.label}</span>
          <select
            value={activeGroup?.id ?? ''}
            onChange={(event) => setGroupId(event.target.value || null)}
            disabled={!data}
            className="w-full sm:max-w-md px-3 py-2 rounded-lg border border-slate-300 bg-white text-base text-slate-800 disabled:opacity-50"
          >
            <option value="">{filter.all}</option>
            {data?.groups.map((group) => {
              const count = counts.get(group.id) ?? 0;
              return (
                <option key={group.id} value={group.id} disabled={!count}>
                  {groupLabel(group)} — {count || 'нет данных'}
                </option>
              );
            })}
          </select>
        </label>
        {data && (
          <p className="m-0 text-sm text-slate-500 tabular-nums" aria-live="polite">
            На карте {visiblePoints.length} {plural(visiblePoints.length, pointNoun)}
          </p>
        )}
      </div>

      <div className="relative h-[65vh] min-h-[440px] md:h-[72vh] rounded-2xl overflow-hidden shadow-lg bg-slate-200">
        <div ref={container} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="px-4 py-2 rounded-lg bg-white/90 shadow text-sm text-slate-600">Загрузка…</span>
          </div>
        )}
        {failed && (
          <div className="absolute inset-x-4 top-4 p-4 rounded-xl bg-white shadow text-sm text-slate-800">
            Не удалось загрузить данные. Обновите страницу.
          </div>
        )}
        {selected && data && (
          <PointCard point={selected} groups={data.groups} onClose={() => setSelected(null)} onSelectGroup={setGroupId} />
        )}
      </div>

      {(note || data) && (
        <p className="mt-3 mb-0 text-xs text-slate-500">
          {note}
          {data && ` Данные выгружены ${formatDate(data.fetched)}.`}
        </p>
      )}
    </div>
  );
}

export default PointsMap;
