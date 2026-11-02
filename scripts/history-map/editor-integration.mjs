// Редактор карты существует только в режиме разработки: страница и API не попадают в сборку сайта
import { LAYER_IDS, loadDataset, saveLayer, validateDataset } from './dataset.mjs';
import { addEntity, applyPaint, deleteEvent, updateEvent } from './mutations.mjs';

const MAX_BODY_BYTES = 1024 * 1024;
const mutations = { paint: applyPaint, 'update-event': updateEvent, 'delete-event': deleteEvent, 'add-entity': addEntity };

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const dataResponse = (dataset, validation) => ({
  layers: dataset.layers,
  suzerainty: dataset.suzerainty,
  errors: validation.errors,
  warnings: validation.warnings,
});

const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) reject(new Error('Слишком большой запрос'));
    else chunks.push(chunk);
  });
  req.on('end', () => {
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
      reject(new Error('Неверный JSON'));
    }
  });
  req.on('error', reject);
});

// Страницы с других сайтов не должны иметь возможности менять файлы через локальный сервер
const isSameOrigin = (req) => {
  const { origin, host } = req.headers;
  if (!origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

const handle = async (req, res) => {
  const action = (req.url ?? '').split('?')[0].replace(/^\//, '');

  if (req.method === 'GET' && action === 'data') {
    const dataset = loadDataset();
    send(res, 200, dataResponse(dataset, validateDataset(dataset)));
    return;
  }

  const mutate = Object.hasOwn(mutations, action) ? mutations[action] : null;
  if (req.method !== 'POST' || !mutate) {
    send(res, 404, { message: 'Не найдено' });
    return;
  }
  if (!isSameOrigin(req) || !req.headers['content-type']?.startsWith('application/json')) {
    send(res, 403, { message: 'Запрос отклонён' });
    return;
  }

  const body = await readBody(req);
  if (!LAYER_IDS.includes(body.layer)) {
    send(res, 400, { message: 'Неизвестный слой' });
    return;
  }

  const dataset = loadDataset();
  const before = validateDataset(dataset);
  mutate(dataset.layers[body.layer], body);
  const after = validateDataset(dataset);

  // Отклоняем только новые ошибки: уже сломанный вручную файл не должен блокировать его исправление
  const introduced = after.errors.filter((error) => !before.errors.includes(error));
  if (introduced.length) {
    send(res, 422, { message: 'Изменение не сохранено', errors: introduced });
    return;
  }

  saveLayer(body.layer, dataset.layers[body.layer]);
  send(res, 200, dataResponse(dataset, after));
};

export default function historyMapEditor() {
  return {
    name: 'history-map-editor',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        injectRoute({
          pattern: '/tools/history-map/editor',
          entrypoint: './src/components/HistoryMapEditor/page.astro',
        });
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use('/__history-map', (req, res) => {
          handle(req, res).catch((error) => send(res, 400, { message: error.message }));
        });
      },
    },
  };
}
