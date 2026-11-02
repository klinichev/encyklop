import { useEffect, useMemo, useRef, useState } from 'react';
import { Brush, Hand, Trash2, X } from 'lucide-react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MapRenderer, createHistoricMap, loadTopology, provincesOf } from '../HistoryMap/historicMap';
import type { ProvinceProps, ProvinceTopology } from '../HistoryMap/historicMap';
import {
  CONFIDENCE_LABELS,
  FIRST_YEAR,
  LAST_YEAR,
  LAYERS,
  clampYear,
  compileLayer,
  holdingIn,
  nameAt,
  realmIn,
} from '../HistoryMap/timeline-core';
import type { Confidence, HistoryEvent, LayerData, LayerId, Suzerainty } from '../HistoryMap/timeline-core';

const API_URL = '/__history-map';
const START_YEAR = 1204;
const YEAR_STEPS = [100, 10, 1];
const CONFIDENCES = Object.keys(CONFIDENCE_LABELS) as Confidence[];
const FIELD_CLASS = 'w-full px-2 py-1.5 rounded-md border border-slate-300 bg-white text-sm text-slate-800';
const SMALL_BUTTON_CLASS =
  'px-2 py-1.5 rounded-md bg-slate-100 enabled:hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium tabular-nums text-slate-700 transition-colors';
const PRIMARY_BUTTON_CLASS =
  'px-3 py-2 rounded-md bg-slate-800 enabled:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors';

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

type Mode = 'brush' | 'pan';

interface Dataset {
  layers: Record<LayerId, LayerData>;
  suzerainty: Suzerainty[];
  errors: string[];
  warnings: string[];
}

class ApiError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
  }
}

const request = async (action: string, body?: unknown): Promise<Dataset> => {
  const response = await fetch(`${API_URL}/${action}`, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new ApiError(payload.message ?? `HTTP ${response.status}`, payload.errors);
  return payload;
};

const slugify = (name: string, taken: (id: string) => boolean) => {
  const base = [...name.toLowerCase()]
    .map((char) => TRANSLIT[char] ?? (/[a-z0-9]/.test(char) ? char : '_'))
    .join('')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!base || !taken(base)) return base;
  let suffix = 2;
  while (taken(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
};

function EventRow({
  event,
  index,
  names,
  provinceName,
  busy,
  onUpdate,
  onDelete,
}: {
  event: HistoryEvent;
  index: number;
  names: (entity: string) => string;
  provinceName: (id: string) => string;
  busy: boolean;
  onUpdate: (index: number, event: HistoryEvent, meta: Partial<HistoryEvent>) => void;
  onDelete: (index: number, event: HistoryEvent) => void;
}) {
  return (
    <li className="p-2 rounded-md border border-slate-200 text-xs text-slate-700">
      <ul className="m-0 mb-2 p-0 list-none">
        {Object.entries(event.changes).map(([entity, ids]) => (
          <li key={entity}>
            <span className="font-medium">{names(entity)}:</span> {ids.map(provinceName).join(', ')}
          </li>
        ))}
      </ul>
      <div className="grid gap-1.5">
        <input
          defaultValue={event.note}
          placeholder="Описание"
          aria-label="Описание события"
          className={FIELD_CLASS}
          onBlur={(e) => e.target.value.trim() !== event.note && onUpdate(index, event, { note: e.target.value })}
        />
        <input
          defaultValue={event.source ?? ''}
          placeholder="Источник"
          aria-label="Источник события"
          className={FIELD_CLASS}
          onBlur={(e) => e.target.value.trim() !== (event.source ?? '') && onUpdate(index, event, { source: e.target.value })}
        />
        <div className="flex gap-1.5">
          <select
            value={event.confidence}
            aria-label="Достоверность события"
            className={FIELD_CLASS}
            onChange={(e) => onUpdate(index, event, { confidence: e.target.value as Confidence })}
          >
            {CONFIDENCES.map((item) => <option key={item} value={item}>{CONFIDENCE_LABELS[item]}</option>)}
          </select>
          <button
            onClick={() => onDelete(index, event)}
            disabled={busy}
            aria-label="Удалить событие"
            className={SMALL_BUTTON_CLASS}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

function HistoryMapEditor() {
  const [data, setData] = useState<Dataset | null>(null);
  const [year, setYear] = useState(START_YEAR);
  const [yearDraft, setYearDraft] = useState(String(START_YEAR));
  const [layer, setLayer] = useState<LayerId>('political');
  const [value, setValue] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('brush');
  const [pending, setPending] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [confidence, setConfidence] = useState<Confidence>('medium');
  const [source, setSource] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#7a8b99');
  const [newGroup, setNewGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; details: string[] } | null>(null);
  const [notice, setNotice] = useState('');
  const [topology, setTopology] = useState<ProvinceTopology | null>(null);
  const [ready, setReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const paintRef = useRef<(province: string) => void>(() => {});
  const pickRef = useRef<(province: string) => void>(() => {});
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const pendingKeys = Object.keys(pending);
  const locked = pendingKeys.length > 0;

  const provinces = useMemo(() => (topology ? provincesOf(topology) : []), [topology]);
  const provinceNames = useMemo(() => new Map(provinces.map(({ id, name }: ProvinceProps) => [id, name])), [provinces]);
  const provinceName = (id: string) => provinceNames.get(id) ?? id;

  const compiled = useMemo(() => (data ? compileLayer(data.layers[layer]) : null), [data, layer]);

  const savedOwner = (province: string) => (compiled ? holdingIn(compiled, province, year)?.owner ?? null : null);
  const ownerOf = (province: string) => {
    const owner = pending[province] ?? savedOwner(province);
    return owner && compiled?.entityById.has(owner) ? owner : null;
  };
  const entityName = (id: string) => {
    const entity = compiled?.entityById.get(id);
    return entity ? nameAt(entity, year) : id;
  };

  paintRef.current = (province) => {
    if (!value) {
      setNotice('Сначала выберите значение в палитре');
      return;
    }
    setNotice('');
    const saved = savedOwner(province);
    setPending((current) => {
      const next = { ...current };
      delete next[province];
      if (saved !== value) next[province] = value;
      return next;
    });
  };
  pickRef.current = (province) => {
    const owner = ownerOf(province);
    if (owner) setValue(owner);
  };

  useEffect(() => {
    request('data')
      .then(setData)
      .catch((error) => setFailure({ message: `Данные не загрузились: ${error.message}`, details: [] }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let painting = false;
    let lastPainted: string | null = null;
    const stopPainting = () => {
      painting = false;
      lastPainted = null;
    };

    loadTopology()
      .then((loaded) => {
        if (cancelled || !containerRef.current) return;
        setTopology(loaded);
        const created = createHistoricMap(containerRef.current, loaded);
        map = created;
        mapRef.current = created;
        const provinceAt = (point: { x: number; y: number }) =>
          created.queryRenderedFeatures([point.x, point.y], { layers: ['province-fill'] })[0]?.properties?.id as string | undefined;

        created.on('load', () => {
          rendererRef.current = new MapRenderer(created, loaded);
          setReady(true);
        });
        created.on('mousedown', (event) => {
          if (modeRef.current !== 'brush') return;
          const province = provinceAt(event.point);
          if (!province) return;
          if (event.originalEvent.altKey) {
            pickRef.current(province);
            return;
          }
          painting = true;
          lastPainted = province;
          paintRef.current(province);
        });
        created.on('mousemove', (event) => {
          const province = provinceAt(event.point) ?? null;
          setHover(province);
          if (painting && province && province !== lastPainted) {
            lastPainted = province;
            paintRef.current(province);
          }
        });
        created.on('mouseout', () => setHover(null));
      })
      .catch((error) => setFailure({ message: `Карта не загрузилась: ${error.message}`, details: [] }));

    window.addEventListener('mouseup', stopPainting);
    return () => {
      cancelled = true;
      window.removeEventListener('mouseup', stopPainting);
      rendererRef.current?.destroy();
      rendererRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // В режиме кисти перетаскивание красит, поэтому двигать карту можно только в режиме руки
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (mode === 'brush') {
      map.dragPan.disable();
      map.boxZoom.disable();
      map.doubleClickZoom.disable();
    } else {
      map.dragPan.enable();
      map.boxZoom.enable();
      map.doubleClickZoom.enable();
    }
    map.getCanvas().style.cursor = mode === 'brush' ? 'crosshair' : 'grab';
  }, [ready, mode]);

  useEffect(() => {
    if (!ready || !data || !compiled) return;
    rendererRef.current?.render({
      year,
      ownerOf,
      entityOf: (owner) => compiled.entityById.get(owner)!,
      familyOf: (owner) => (layer === 'political'
        ? realmIn(data.suzerainty, owner, year)
        : compiled.entityById.get(owner)?.group ?? owner),
    });
  }, [ready, data, compiled, year, layer, pending]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    provinces.forEach(({ id }) => {
      map.setFeatureState({ source: 'provinces', id }, { selected: id in pending });
    });
  }, [ready, provinces, pending]);

  useEffect(() => {
    setYearDraft(String(year));
  }, [year]);

  useEffect(() => {
    setValue(null);
    setFilter('');
  }, [layer]);

  useEffect(() => {
    if (!locked) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [locked]);

  useEffect(() => {
    const undo = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, select, textarea')) return;
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
        event.preventDefault();
        setPending((current) => {
          const keys = Object.keys(current);
          if (!keys.length) return current;
          const next = { ...current };
          delete next[keys[keys.length - 1]];
          return next;
        });
      }
    };
    window.addEventListener('keydown', undo);
    return () => window.removeEventListener('keydown', undo);
  }, []);

  const run = async (action: string, body: object, successNotice: string) => {
    setBusy(true);
    setFailure(null);
    setNotice('');
    try {
      setData(await request(action, { layer, ...body }));
      setNotice(successNotice);
      return true;
    } catch (error) {
      if (error instanceof ApiError) setFailure({ message: error.message, details: error.details });
      else setFailure({ message: 'Сервер редактора недоступен', details: [] });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const saved = await run('paint', { year, assignments: pending, note, confidence, source }, 'Сохранено');
    if (saved) {
      setPending({});
      setNote('');
    }
  };

  const updateEvent = (index: number, event: HistoryEvent, meta: Partial<HistoryEvent>) => {
    run('update-event', {
      index,
      year: event.year,
      note: event.note,
      confidence: event.confidence,
      source: event.source ?? '',
      ...meta,
    }, 'Событие обновлено');
  };

  const deleteEvent = (index: number, event: HistoryEvent) => {
    if (!window.confirm(`Удалить событие ${event.year} года?`)) return;
    run('delete-event', { index, year: event.year }, 'Событие удалено');
  };

  const taken = (id: string) => Boolean(compiled?.entityById.has(id));
  const newId = slugify(newName, taken);

  const addEntity = async () => {
    const added = await run(
      'add-entity',
      { id: newId, name: newName, from: year, color: newColor, group: newGroup },
      `Добавлено: ${newName}`,
    );
    if (added) {
      setValue(newId);
      setNewName('');
      setNewGroup('');
    }
  };

  const commitYearDraft = () => {
    const typed = Number.parseInt(yearDraft, 10);
    const next = Number.isNaN(typed) || locked ? year : clampYear(typed);
    setYear(next);
    setYearDraft(String(next));
  };

  const shiftYear = (delta: number) => setYear((current) => clampYear(current + delta));

  const layerEvents = data?.layers[layer].events ?? [];
  const eventYears = [...new Set(layerEvents.map((event) => event.year))];
  const previousEventYear = [...eventYears].reverse().find((item) => item < year);
  const nextEventYear = eventYears.find((item) => item > year);
  const yearEvents = layerEvents
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.year === year);

  const counts = new Map<string, number>();
  provinces.forEach(({ id }) => {
    const owner = ownerOf(id);
    if (owner) counts.set(owner, (counts.get(owner) ?? 0) + 1);
  });

  const palette = (data?.layers[layer].entities ?? [])
    .filter((entity) => entity.names[0].from <= year && (entity.to === undefined || entity.to > year))
    .filter((entity) => nameAt(entity, year).toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || nameAt(a, year).localeCompare(nameAt(b, year), 'ru'));

  const hoverOwner = hover ? ownerOf(hover) : null;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="relative h-[60vh] lg:h-[calc(100vh-7rem)] rounded-xl overflow-hidden shadow-lg bg-slate-200">
        <div ref={containerRef} className="w-full h-full" />
        <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-white/90 shadow text-slate-800 pointer-events-none">
          <span className="font-semibold text-xl tabular-nums">{year}</span>
          {hover && (
            <span className="ml-2 text-sm">
              {provinceName(hover)}{hoverOwner && <> — {entityName(hoverOwner)}</>}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 content-start lg:h-[calc(100vh-7rem)] lg:overflow-y-auto pr-1 text-sm text-slate-700">
        <section className="p-3 rounded-xl bg-white shadow">
          <div role="group" aria-label="Слой карты" className="flex p-1 mb-2 rounded-lg bg-slate-100">
            {LAYERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setLayer(id)}
                disabled={locked}
                aria-pressed={layer === id}
                className={`flex-1 px-2 py-1 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                  layer === id ? 'bg-slate-800 text-white' : 'text-slate-700 enabled:hover:bg-slate-200 disabled:opacity-40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {YEAR_STEPS.map((step) => (
              <button key={step} onClick={() => shiftYear(-step)} disabled={locked || year === FIRST_YEAR} className={`flex-1 ${SMALL_BUTTON_CLASS}`}>
                −{step}
              </button>
            ))}
            <input
              type="text"
              inputMode="numeric"
              value={yearDraft}
              disabled={locked}
              onChange={(e) => setYearDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onBlur={commitYearDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitYearDraft();
              }}
              aria-label={`Год, от ${FIRST_YEAR} до ${LAST_YEAR}`}
              className="w-16 px-1 py-1 rounded-md border border-slate-300 bg-white text-center font-semibold tabular-nums text-slate-800 disabled:opacity-40"
            />
            {YEAR_STEPS.slice().reverse().map((step) => (
              <button key={step} onClick={() => shiftYear(step)} disabled={locked || year === LAST_YEAR} className={`flex-1 ${SMALL_BUTTON_CLASS}`}>
                +{step}
              </button>
            ))}
          </div>

          <div className="flex gap-1 mt-1">
            <button
              onClick={() => previousEventYear !== undefined && setYear(previousEventYear)}
              disabled={locked || previousEventYear === undefined}
              className={`flex-1 ${SMALL_BUTTON_CLASS}`}
            >
              ← Событие{previousEventYear !== undefined && ` ${previousEventYear}`}
            </button>
            <button
              onClick={() => nextEventYear !== undefined && setYear(nextEventYear)}
              disabled={locked || nextEventYear === undefined}
              className={`flex-1 ${SMALL_BUTTON_CLASS}`}
            >
              Событие{nextEventYear !== undefined && ` ${nextEventYear}`} →
            </button>
          </div>
          {locked && <p className="mt-2 mb-0 text-xs text-amber-700">Сохраните или сбросьте изменения, чтобы сменить год или слой.</p>}
        </section>

        <section className="p-3 rounded-xl bg-white shadow">
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => setMode('brush')}
              aria-pressed={mode === 'brush'}
              className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium ${mode === 'brush' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <Brush className="w-4 h-4" /> Кисть
            </button>
            <button
              onClick={() => setMode('pan')}
              aria-pressed={mode === 'pan'}
              className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium ${mode === 'pan' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <Hand className="w-4 h-4" /> Рука
            </button>
          </div>
          <p className="mt-0 mb-2 text-xs text-slate-500">
            Кисть: клик или протяжка красит. Alt+клик берёт значение с карты, Ctrl+Z отменяет последнюю провинцию.
          </p>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Поиск значения"
            aria-label="Поиск значения"
            className={`mb-2 ${FIELD_CLASS}`}
          />
          <ul className="m-0 p-0 list-none max-h-56 overflow-y-auto">
            {palette.map((entity) => (
              <li key={entity.id}>
                <button
                  onClick={() => setValue(entity.id)}
                  aria-pressed={value === entity.id}
                  className={`flex w-full items-center gap-2 px-2 py-1 rounded-md text-left ${value === entity.id ? 'bg-slate-200 font-medium' : 'hover:bg-slate-100'}`}
                >
                  <span className="w-3.5 h-3.5 flex-none rounded-sm" style={{ backgroundColor: entity.color }} />
                  <span className="flex-1">{nameAt(entity, year)}</span>
                  <span className="text-xs tabular-nums text-slate-500">{counts.get(entity.id) ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-600">Новое значение (с {year} года)</summary>
            <div className="grid gap-1.5 mt-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название" aria-label="Название значения" className={FIELD_CLASS} />
              {layer !== 'political' && (
                <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Группа (необязательно)" aria-label="Группа значения" className={FIELD_CLASS} />
              )}
              <div className="flex items-center gap-2">
                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} aria-label="Цвет значения" className="w-10 h-8 p-0 border border-slate-300 rounded" />
                <code className="flex-1 min-w-0 truncate text-xs text-slate-500">{newId}</code>
                <button onClick={addEntity} disabled={busy || !newName.trim() || !newId} className={SMALL_BUTTON_CLASS}>Добавить</button>
              </div>
            </div>
          </details>
        </section>

        <section className="p-3 rounded-xl bg-white shadow">
          <h2 className="m-0 mb-2 text-sm font-semibold text-slate-900">Новое событие {year} года: {pendingKeys.length}</h2>
          {locked && (
            <ul className="m-0 mb-2 p-0 list-none text-xs">
              {pendingKeys.map((province) => (
                <li key={province} className="flex items-center justify-between gap-2 py-0.5">
                  <span>{provinceName(province)} → {entityName(pending[province])}</span>
                  <button
                    onClick={() => setPending((current) => {
                      const next = { ...current };
                      delete next[province];
                      return next;
                    })}
                    aria-label={`Убрать ${provinceName(province)}`}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-1.5">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Описание" aria-label="Описание нового события" className={FIELD_CLASS} />
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Источник" aria-label="Источник нового события" className={FIELD_CLASS} />
            <select value={confidence} onChange={(e) => setConfidence(e.target.value as Confidence)} aria-label="Достоверность нового события" className={FIELD_CLASS}>
              {CONFIDENCES.map((item) => <option key={item} value={item}>Достоверность: {CONFIDENCE_LABELS[item]}</option>)}
            </select>
            <div className="flex gap-1.5">
              <button onClick={save} disabled={busy || !locked} className={`flex-1 ${PRIMARY_BUTTON_CLASS}`}>Сохранить</button>
              <button onClick={() => setPending({})} disabled={busy || !locked} className={SMALL_BUTTON_CLASS}>Сбросить</button>
            </div>
          </div>
          <div aria-live="polite">
            {notice && <p className="mt-2 mb-0 text-xs text-emerald-700">{notice}</p>}
            {failure && (
              <div className="mt-2 text-xs text-red-700">
                <p className="m-0 font-medium">{failure.message}</p>
                {failure.details.length > 0 && (
                  <ul className="m-0 mt-1 pl-4">{failure.details.map((item) => <li key={item}>{item}</li>)}</ul>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="p-3 rounded-xl bg-white shadow">
          <h2 className="m-0 mb-2 text-sm font-semibold text-slate-900">События {year} года: {yearEvents.length}</h2>
          <ul className="grid gap-2 m-0 p-0 list-none">
            {yearEvents.map(({ event, index }) => (
              <EventRow
                key={`${layer}:${index}:${event.year}:${event.note}:${event.source ?? ''}`}
                event={event}
                index={index}
                names={entityName}
                provinceName={provinceName}
                busy={busy || locked}
                onUpdate={updateEvent}
                onDelete={deleteEvent}
              />
            ))}
          </ul>
        </section>

        {data && (
          <section className="p-3 rounded-xl bg-white shadow">
            <h2 className="m-0 text-sm font-semibold text-slate-900">Проверка данных</h2>
            {data.errors.length > 0 && (
              <ul className="m-0 mt-2 pl-4 text-xs text-red-700">{data.errors.map((item) => <li key={item}>{item}</li>)}</ul>
            )}
            {data.errors.length === 0 && <p className="mt-1 mb-0 text-xs text-emerald-700">Ошибок нет</p>}
            {data.warnings.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-600">Предупреждения: {data.warnings.length}</summary>
                <ul className="m-0 mt-1 pl-4 text-xs text-slate-600">{data.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
              </details>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default HistoryMapEditor;
