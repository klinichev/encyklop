import { useState, useRef, useEffect } from 'react';
import { Globe, Minus, Plus } from 'lucide-react';
import L from 'leaflet';

interface ClickPoint {
  lat: number;
  lng: number;
}

type DisplayMode = 'longitude' | 'latitude' | 'circle' | null;

// Линия широты рисуется с запасом, чтобы не обрываться при прокрутке карты по копиям мира
const LATITUDE_LINE_HALF_LENGTH = 1080;

const formatCoordinates = ({ lat, lng }: ClickPoint) => {
  // При клике по копии мира Leaflet возвращает долготу за пределами ±180°
  const wrapped = L.latLng(lat, lng).wrap();
  return `${wrapped.lat.toFixed(4)}°, ${wrapped.lng.toFixed(4)}°`;
};

function GeoLines() {
  const [clickPoint, setClickPoint] = useState<ClickPoint | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(null);
  const [radius, setRadius] = useState<number>(200);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView([20, 0], 2);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    drawnItemsRef.current = L.featureGroup().addTo(map);

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setClickPoint({ lat: lat, lng: lng });
      setDisplayMode(null);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawnItemsRef.current = null;
    };
  }, []);

  const drawLongitudeLine = () => {
    if (!mapRef.current || !drawnItemsRef.current || !clickPoint) return;

    drawnItemsRef.current.clearLayers();
    const lng = clickPoint.lng;
    const line = L.polyline(
      [
        [90, lng],
        [-90, lng],
      ],
      {
        color: '#3b82f6',
        weight: 3,
        dashArray: '8, 4',
        opacity: 0.8,
      }
    );
    drawnItemsRef.current.addLayer(line);
  };

  const drawLatitudeLine = () => {
    if (!mapRef.current || !drawnItemsRef.current || !clickPoint) return;

    drawnItemsRef.current.clearLayers();
    const { lat, lng } = clickPoint;
    const line = L.polyline(
      [
        [lat, lng - LATITUDE_LINE_HALF_LENGTH],
        [lat, lng + LATITUDE_LINE_HALF_LENGTH],
      ],
      {
        color: '#10b981',
        weight: 3,
        dashArray: '8, 4',
        opacity: 0.8,
      }
    );
    drawnItemsRef.current.addLayer(line);
  };

  const drawCircle = () => {
    if (!mapRef.current || !drawnItemsRef.current || !clickPoint) return;

    drawnItemsRef.current.clearLayers();

    const circle = L.circle([clickPoint.lat, clickPoint.lng], {
      radius: radius * 1000,
      color: '#ef4444',
      weight: 3,
      fillColor: '#ef4444',
      fillOpacity: 0.1,
    });
    drawnItemsRef.current.addLayer(circle);

    const marker = L.circleMarker([clickPoint.lat, clickPoint.lng], {
      radius: 6,
      fillColor: '#fbbf24',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 1,
    });
    drawnItemsRef.current.addLayer(marker);
  };

  const drawClickMarker = () => {
    if (!mapRef.current || !drawnItemsRef.current || !clickPoint) return;

    const marker = L.circleMarker([clickPoint.lat, clickPoint.lng], {
      radius: 6,
      fillColor: '#fbbf24',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 1,
    });
    drawnItemsRef.current.addLayer(marker);
  };

  useEffect(() => {
    if (!displayMode) {
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
      }
      if (clickPoint) {
        drawClickMarker();
      }
    } else if (displayMode === 'longitude') {
      drawLongitudeLine();
      drawClickMarker();
    } else if (displayMode === 'latitude') {
      drawLatitudeLine();
      drawClickMarker();
    } else if (displayMode === 'circle') {
      drawCircle();
    }
  }, [displayMode, clickPoint, radius]);

  const handleClear = () => {
    setClickPoint(null);
    setDisplayMode(null);
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
  };

  return (
    <div className="max-w-[960px] mx-auto">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="relative">
          <div
            ref={containerRef}
            className="w-full h-[450px] md:h-[500px]"
            style={{ zIndex: 0 }}
          />

          {clickPoint && !displayMode && (
            <div className="absolute top-4 inset-x-4 mx-auto z-10 max-w-sm bg-white rounded-xl shadow-2xl p-6 border border-slate-200">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-slate-600" />
                  <h3 className="m-0 text-base font-semibold text-slate-800">Нарисовать:</h3>
                </div>
                <button
                  onClick={handleClear}
                  aria-label="Закрыть"
                  className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                {formatCoordinates(clickPoint)}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setDisplayMode('latitude')}
                  className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Линия широты
                </button>
                <button
                  onClick={() => setDisplayMode('longitude')}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Линия долготы
                </button>
                <button
                  onClick={() => setDisplayMode('circle')}
                  className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Окружность (200 км по умолчанию)
                </button>
              </div>
            </div>
          )}
        </div>

        {displayMode && clickPoint && (
          <div className="bg-slate-50 border-t border-slate-200 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="text-sm">
                  <span className="font-semibold text-slate-700">Координаты: </span>
                  <span className="text-slate-600">
                    {formatCoordinates(clickPoint)}
                  </span>
                </div>
                {displayMode === 'longitude' && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span className="text-sm font-medium text-slate-700">Линия долготы</span>
                  </div>
                )}
                {displayMode === 'latitude' && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                    <span className="text-sm font-medium text-slate-700">Линия широты</span>
                  </div>
                )}
                {displayMode === 'circle' && (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-medium text-slate-700">Окружность</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-300">
                      <button
                        onClick={() => setRadius(Math.max(10, radius - 50))}
                        aria-label="Уменьшить радиус"
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                      >
                        <Minus className="w-4 h-4 text-slate-600" />
                      </button>
                      <input
                        type="number"
                        value={radius}
                        aria-label="Радиус в километрах"
                        onChange={(e) => setRadius(Math.max(10, parseInt(e.target.value) || 10))}
                        className="w-20 text-center text-sm font-medium border-none focus:outline-none bg-transparent"
                      />
                      <span className="text-sm text-slate-600">км</span>
                      <button
                        onClick={() => setRadius(radius + 50)}
                        aria-label="Увеличить радиус"
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                      >
                        <Plus className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-medium text-sm"
              >
                Очистить
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-3">Как работать с гео-линейкой:</h2>
        <ol className="space-y-2 text-sm text-slate-700 list-none p-0 m-0">
          <li>1. Выберите место и нажмите на него на карте</li>
          <li>2. Выберите, что вы хотите нарисовать: линию широты, линию долготы или окружность</li>
          <li>3. Если вы выбрали окружность, настройте её радиус</li>
          <li>4. Нажмите "Очистить", чтобы начать заново</li>
        </ol>
      </div>
    </div>
  );
}

export default GeoLines;
