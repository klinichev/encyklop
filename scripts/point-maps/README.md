# Тематические карты

Карты мира с метками на одну тему — раздел «Тематические карты» (`/tools/maps/`).
У всех карт общий интерфейс: фильтр по группе («Лауреат»), кластеры меток, карточка точки с фото.
Различаются только данные, поэтому новая карта — это папка с данными, а не новый код.

## Как это устроено

| Что | Где |
|---|---|
| Данные карты | `src/data/point-maps/<slug>/meta.json` и `points.json` |
| Схема и проверка данных | `src/content/config.ts`, коллекции `pointMaps` и `pointMapData` |
| Страница карты | `src/pages/tools/maps/[slug]/index.astro` — создаётся сама для каждой папки |
| Точки для страницы | `/tools/maps/<slug>/points.json` (`src/pages/tools/maps/[slug]/points.json.ts`) |
| Список карт | `/tools/maps/` — карточки строятся из всех `meta.json` |
| Интерфейс карты | `src/components/PointsMap/` (MapLibre, тайлы OpenStreetMap) |
| Фото точек | `public/images/point-maps/<slug>/` — **не в git**, скачиваются скриптом |
| Обложки карточек | `public/images/point-maps/covers/` — в git |
| Скрипты сбора данных | `scripts/point-maps/<slug>/`, общие модули — `scripts/point-maps/lib/` |

## Новая карта по шагам

### 1. `meta.json` — описание карты (пишется вручную)

```json
{
	"title": "Здания лауреатов Притцкеровской премии",
	"description": "Описание для поисковиков и карточки в разделе",
	"lead": "Подсказка под заголовком: «Выберите лауреата и нажимайте на метки»",
	"cover": "/images/point-maps/covers/<slug>.webp",
	"coverCredit": "Автор, лицензия",
	"order": 2,
	"draft": true,
	"filter": { "label": "Лауреат", "all": "Все лауреаты" },
	"pointNoun": ["постройка", "постройки", "построек"],
	"note": "Пояснение под картой: откуда данные, что не попало"
}
```

- `order` — место карточки в разделе.
- `draft: true` — карта видна только в `npm run dev`, в сборку не попадает. Снять, когда данные готовы.
- `pointNoun` — формы слова для счётчика «На карте 5 построек».
- `coverCredit` нужен, если обложка под лицензией CC BY / CC BY-SA.

### 2. `points.json` — точки

```json
{
	"source": "Wikidata",
	"fetched": "2026-11-09",
	"groups": [
		{ "id": "zaha-hadid", "name": "Заха Хадид", "year": 2004 }
	],
	"points": [
		{
			"id": "Q43928",
			"name": "Культурный центр Гейдара Алиева",
			"lat": 40.39528,
			"lng": 49.86694,
			"groups": ["zaha-hadid"],
			"year": 2012,
			"type": "культурный центр",
			"place": "Баку",
			"country": "Азербайджан",
			"link": "https://ru.wikipedia.org/wiki/Центр_Гейдара_Алиева",
			"photo": {
				"src": "/images/point-maps/<slug>/Q43928.webp",
				"author": "Robot8A",
				"license": "CC BY-SA 4.0",
				"source": "https://commons.wikimedia.org/wiki/File:..."
			}
		}
	]
}
```

- `groups` — значения фильтра; в списке показываются как «Заха Хадид (2004)», `year` необязателен.
- У точки обязательны `id`, `name`, `lat`, `lng`, `groups`; остальное показывается, если есть.
- Точка может входить в несколько групп (совместные проекты).
- Если у фото есть автор и лицензия, их нужно указать: карточка показывает подпись со ссылкой на источник.

Небольшую карту можно собрать вручную. Если точек много, файл лучше генерировать скриптом (шаг 3).

### 3. Скрипт сбора данных

Удобнее всего скопировать `scripts/point-maps/pritzker/` в `scripts/point-maps/<slug>/` и поменять:

- `laureates.mjs` → свой список групп и связанных с ними элементов Wikidata;
- SPARQL-запрос в `build.mjs` (у Притцкера — «постройки, где архитектор (P84) — лауреат или его бюро»);
- правила отбора в `build.mjs` (`EXCLUDED_TYPES`, `EXCLUDED_STATES`) — у Притцкера отсекаются снесённые, недостроенные и непостроенные здания;
- пути `CACHE`, `OUTPUT`, `PHOTOS_DIR`, `PHOTOS_PATH` — заменить `pritzker` на свой `<slug>`.

Скрипт добавить в `package.json`: `"point-maps:<slug>": "node scripts/point-maps/<slug>/build.mjs"`.

Общие модули в `lib/`:

| Модуль | Что делает |
|---|---|
| `wikidata.mjs` | SPARQL, загрузка элементов и файлов Commons, повтор запросов при 429 и обрывах |
| `places.mjs` | город и страна по цепочке административных единиц (P131) |
| `photos.mjs` | скачивает превью с Commons в webp 480 px и удаляет фото пропавших точек |
| `commons-categories.mjs` | ищет объекты по категориям Commons («Buildings by …») — там, где в Wikidata нет связи |
| `additions.mjs` | читает ручные дополнения (`additions.json`) |

Запуск:

```sh
npm run point-maps:<slug>               # из кэша (.cache/point-maps/<slug>/)
npm run point-maps:<slug> -- --refresh  # заново запросить Wikidata и Commons
npm run point-maps:<slug> -- --no-photos  # без скачивания фото
```

### 4. Обложка

```sh
node scripts/point-maps/cover.mjs "<имя файла на Commons>" <slug>
```

Скрипт сохранит `public/images/point-maps/covers/<slug>.webp` и напечатает автора и лицензию для `coverCredit`.

### 5. Проверка

```sh
npx astro sync   # проверяет meta.json и points.json по схеме: повторы id, несуществующие группы, координаты
npm run dev      # карта на http://localhost:4321/tools/maps/<slug>/
```

Когда всё готово — `draft: false` в `meta.json`.

## Ручные поправки (на примере Притцкера)

Wikidata неполна, поэтому у скрипта есть два файла ручных поправок.

**`overrides.mjs`** — что исключить или оставить вопреки правилам отбора. У каждого id — комментарий с причиной.

**`additions.json`** — чего в Wikidata нет. Записи двух видов:

```json
{ "group": "smiljan-radic", "wikidata": "Q99767422", "name": "Винодельня Viña Vik",
  "photo": "Bodega y viñedos VIK.jpg", "year": null, "source": "..." }
```

Объект есть в Wikidata, но без связи с группой: остальное берётся оттуда, а `lat`/`lng`/`name`/`photo`/`year` поправляют его (`"year": null` убирает год).

```json
{ "group": "glenn-murcutt", "id": "manual-kempsey-museum", "name": "Музей и туристический центр Кемпси",
  "lat": -31.09651, "lng": 152.83493, "type": "музей", "place": "Кемпси", "country": "Австралия",
  "photo": "KempseyMuseum01.jpg", "source": "координаты снимка на Commons" }
```

Объекта в Wikidata нет: всё задаётся вручную, `id` начинается с `manual-`, `photo` — имя файла на Commons.

`source` обязателен: откуда взяты координаты (Wikidata, OSM, статья Википедии, координаты снимка). Координаты по памяти не вписывать; приблизительные помечать в `source`.

После сборки в `.cache/point-maps/pritzker/from-categories.tsv` лежит список связей, найденных только по категориям Commons, — его стоит просмотреть: туда попадают события, скульптуры и здания, где лауреат делал лишь пристройку.

## Что стоит знать

- **Фото не в git.** На новом клоне перед `npm run build` запустить скрипт карты — он докачает недостающие фото. Без этого сборка пройдёт, но карточки будут без фотографий.
- **Wikidata неполна и иногда ошибается.** Отменённые проекты бывают без пометки (небоскрёб Tulip), вместо здания бывает научная статья о нём, вместо фото — логотип. Новые точки стоит просматривать.
- **Год.** Берётся дата открытия (P1619) или основания (P571). У реконструкций это часто год исходного здания; у Притцкера год раньше 20-летия лауреата отбрасывается.
- **Лицензии.** Тайлы и данные OpenStreetMap требуют подписи «© OpenStreetMap contributors» (она есть на карте); фото с Commons — автора и лицензии.
- **Dev-сервер.** Если карта не показывается после `npm install`, перезапустить `npm run dev -- --force`: у Vite устаревает кэш зависимостей.
