import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapIcon, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MAX_BOUNDS, MapRenderer, ZOOM_LIMITS, createHistoricMap, loadTopology, provincesOf } from './historicMap';
import type { ProvinceProps, ProvinceTopology } from './historicMap';
import { CONFIDENCE_LABELS, FIRST_YEAR, LAST_YEAR, LAYERS, clampYear, nameAt } from './timeline-core';
import type { LayerId } from './timeline-core';
import { familyAt, getEntity, holdingAt, suzerainAt } from './timeline';

const START_YEAR = 1204;
const YEAR_STEPS = [-100, -10, -1];
const YEAR_BUTTON_CLASS =
  'px-1 sm:px-2.5 py-2 rounded-lg bg-slate-100 enabled:hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium tabular-nums text-slate-700 transition-colors';

const yearsLabel = (step: number) => (Math.abs(step) === 1 ? '1 год' : `${Math.abs(step)} лет`);

function HistoryMap() {
  const [year, setYear] = useState(START_YEAR);
  const [yearDraft, setYearDraft] = useState(String(START_YEAR));
  const [layer, setLayer] = useState<LayerId>('political');
  const [showOsm, setShowOsm] = useState(false);
  const [selected, setSelected] = useState<ProvinceProps | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const historicContainer = useRef<HTMLDivElement>(null);
  const osmContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const topologyRef = useRef<ProvinceTopology | null>(null);
  const rendererRef = useRef<MapRenderer | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;

    loadTopology()
      .then((topology) => {
        if (cancelled || !historicContainer.current) return;
        topologyRef.current = topology;

        const loadedMap = createHistoricMap(historicContainer.current, topology);
        map = loadedMap;
        mapRef.current = loadedMap;

        loadedMap.on('load', () => {
          rendererRef.current = new MapRenderer(loadedMap, topology);
          setReady(true);
        });
        loadedMap.on('click', 'province-fill', (event) => {
          const properties = event.features?.[0]?.properties as ProvinceProps | undefined;
          if (properties) setSelected({ id: properties.id, name: properties.name });
        });
        loadedMap.on('click', (event) => {
          if (!loadedMap.queryRenderedFeatures(event.point, { layers: ['province-fill'] }).length) setSelected(null);
        });
        loadedMap.on('mouseenter', 'province-fill', () => { loadedMap.getCanvas().style.cursor = 'pointer'; });
        loadedMap.on('mouseleave', 'province-fill', () => { loadedMap.getCanvas().style.cursor = ''; });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    rendererRef.current?.render({
      year,
      ownerOf: (province) => holdingAt(layer, province, year).owner,
      entityOf: (owner) => getEntity(layer, owner),
      familyOf: (owner) => familyAt(layer, owner, year),
    });
  }, [ready, year, layer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selected) return;
    const target = { source: 'provinces', id: selected.id };
    map.setFeatureState(target, { selected: true });
    return () => {
      if (mapRef.current) map.setFeatureState(target, { selected: false });
    };
  }, [ready, selected]);

  useEffect(() => {
    setYearDraft(String(year));
  }, [year]);

  // Обе карты двигаются вместе; флаг не даёт им бесконечно обновлять друг друга
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!showOsm || !osmContainer.current) {
      map.resize();
      return;
    }

    map.resize();
    const osm = new maplibregl.Map({
      container: osmContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: map.getCenter(),
      zoom: map.getZoom(),
      ...ZOOM_LIMITS,
      maxBounds: MAX_BOUNDS,
      renderWorldCopies: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    osm.touchZoomRotate.disableRotation();

    let syncing = false;
    const follow = (source: MapLibreMap, target: MapLibreMap) => () => {
      if (syncing) return;
      syncing = true;
      target.jumpTo({ center: source.getCenter(), zoom: source.getZoom() });
      syncing = false;
    };
    const followHistoric = follow(map, osm);
    const followOsm = follow(osm, map);
    map.on('move', followHistoric);
    osm.on('move', followOsm);

    return () => {
      map.off('move', followHistoric);
      osm.remove();
    };
  }, [ready, showOsm]);

  const shiftYear = (delta: number) => setYear((current) => clampYear(current + delta));

  // Год применяется по Enter или при потере фокуса, чтобы карта не прыгала на каждой цифре
  const commitYearDraft = () => {
    const typed = Number.parseInt(yearDraft, 10);
    const next = Number.isNaN(typed) ? year : clampYear(typed);
    setYear(next);
    setYearDraft(String(next));
  };

  const selectedHolding = selected ? holdingAt(layer, selected.id, year) : null;
  const selectedSuzerain = selectedHolding && layer === 'political' ? suzerainAt(selectedHolding.owner, year) : null;

  const legend = useMemo(() => {
    const topology = topologyRef.current;
    if (!ready || !topology) return [];
    const owners = new Map<string, number>();
    provincesOf(topology).forEach(({ id }) => {
      const { owner } = holdingAt(layer, id, year);
      owners.set(owner, (owners.get(owner) ?? 0) + 1);
    });
    return [...owners].sort((a, b) => b[1] - a[1]).map(([owner]) => getEntity(layer, owner));
  }, [ready, year, layer]);

  return (
    <div className="history-map">
      <div className="flex flex-col md:flex-row gap-1 rounded-2xl overflow-hidden shadow-lg bg-slate-200">
        <div className="relative w-full md:w-auto md:flex-1 min-w-0 h-[60vh] min-h-[420px] md:h-[72vh]">
          <div ref={historicContainer} className="w-full h-full" />
          <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-white/90 shadow font-semibold text-2xl tabular-nums text-slate-800 pointer-events-none">
            {year}
          </div>
          {failed && (
            <div className="absolute inset-x-4 top-20 p-4 rounded-xl bg-white shadow text-sm text-slate-800">
              Не удалось загрузить карту. Обновите страницу.
            </div>
          )}
          {selected && selectedHolding && (
            <div className="absolute left-3 bottom-8 w-72 max-w-[calc(100%-1.5rem)] p-4 rounded-xl bg-white/95 shadow-lg text-sm text-slate-700">
              <div className="flex items-start justify-between gap-2">
                <h2 className="m-0 text-base font-semibold text-slate-900">{selected.name}</h2>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Закрыть"
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-2 mb-1">
                <span className="font-medium">{nameAt(getEntity(layer, selectedHolding.owner), year)}</span>
                {selectedHolding.from > FIRST_YEAR && `, с ${selectedHolding.from} года`}
              </p>
              {selectedSuzerain && <p className="my-1">Сюзерен: {nameAt(getEntity(layer, selectedSuzerain), year)}</p>}
              <p className="mt-1 mb-0 text-slate-500">Достоверность: {CONFIDENCE_LABELS[selectedHolding.event.confidence]}</p>
            </div>
          )}
        </div>
        {showOsm && (
          <div className="relative w-full md:w-auto md:flex-1 min-w-0 h-[60vh] min-h-[420px] md:h-[72vh]">
            <div ref={osmContainer} className="w-full h-full" />
          </div>
        )}
      </div>

      <div className="mt-4 p-4 rounded-2xl bg-white shadow-lg">
        <div className="flex flex-col items-center gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <div role="group" aria-label="Слой карты" className="flex w-full sm:w-auto lg:justify-self-start p-1 rounded-lg bg-slate-100">
            {LAYERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setLayer(id)}
                aria-pressed={layer === id}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  layer === id ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-6 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
            {YEAR_STEPS.map((step) => (
              <button
                key={step}
                onClick={() => shiftYear(step)}
                disabled={year === FIRST_YEAR}
                aria-label={`Назад: ${yearsLabel(step)}`}
                className={YEAR_BUTTON_CLASS}
              >
                −{Math.abs(step)}
              </button>
            ))}
            <input
              type="text"
              inputMode="numeric"
              value={yearDraft}
              onChange={(e) => setYearDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onBlur={commitYearDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitYearDraft();
              }}
              aria-label={`Год, от ${FIRST_YEAR} до ${LAST_YEAR}`}
              className="col-span-6 order-first sm:order-none sm:w-20 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-center text-lg font-semibold tabular-nums text-slate-800"
            />
            {YEAR_STEPS.slice().reverse().map((step) => (
              <button
                key={step}
                onClick={() => shiftYear(-step)}
                disabled={year === LAST_YEAR}
                aria-label={`Вперёд: ${yearsLabel(step)}`}
                className={YEAR_BUTTON_CLASS}
              >
                +{Math.abs(step)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowOsm((current) => !current)}
            aria-pressed={showOsm}
            className={`flex items-center justify-center gap-2 w-full sm:w-auto lg:justify-self-end px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showOsm ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Современная карта
          </button>
        </div>

        <ul className="mt-3 mb-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {legend.map((entity) => (
            <li key={entity.id} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entity.color }} />
              {nameAt(entity, year)}
            </li>
          ))}
        </ul>

        <p className="mt-3 mb-0 text-xs text-slate-500">
          Доступны {FIRST_YEAR}–{LAST_YEAR} годы. Черновик: границы провинций схематичны, а данные не сверены с источниками. На картах религий и языков показано только преобладающее значение в провинции.
        </p>
      </div>
    </div>
  );
}

export default HistoryMap;
