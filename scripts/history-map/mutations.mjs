// Правки данных из редактора. Каждая функция меняет переданный слой на месте; вызывающий код
// проверяет результат и записывает его на диск только при отсутствии ошибок.

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const eventMeta = ({ note, confidence, source }) => {
  const meta = { note: cleanText(note), confidence };
  const cleanSource = cleanText(source);
  if (cleanSource) meta.source = cleanSource;
  return meta;
};

const sameMeta = (event, meta) =>
  event.note === meta.note && event.confidence === meta.confidence && (event.source ?? '') === (meta.source ?? '');

const eventAt = (layer, index, year) => {
  const event = layer.events[index];
  // Файл могли поправить вручную, пока редактор был открыт
  if (!event || event.year !== year) throw new Error('Событие не найдено: обновите страницу редактора');
  return event;
};

const valueBefore = (layer, province, year) => {
  let value = null;
  for (const event of layer.events) {
    if (event.year >= year) break;
    for (const [entity, ids] of Object.entries(event.changes)) if (ids.includes(province)) value = entity;
  }
  return value;
};

// Запись за этот же год заменяется, а значение, совпавшее с предыдущим годом, просто снимает запись
export const applyPaint = (layer, { year, assignments, ...rest }) => {
  const meta = eventMeta(rest);
  const provinces = Object.keys(assignments);

  for (const event of layer.events) {
    if (event.year !== year) continue;
    for (const [entity, ids] of Object.entries(event.changes)) {
      event.changes[entity] = ids.filter((id) => !provinces.includes(id));
      if (!event.changes[entity].length) delete event.changes[entity];
    }
  }
  layer.events = layer.events.filter((event) => Object.keys(event.changes).length);

  const changes = {};
  for (const [province, value] of Object.entries(assignments)) {
    if (valueBefore(layer, province, year) === value) continue;
    (changes[value] ??= []).push(province);
  }
  if (!Object.keys(changes).length) return;

  const twin = layer.events.find((event) => event.year === year && sameMeta(event, meta));
  if (twin) {
    for (const [value, ids] of Object.entries(changes)) (twin.changes[value] ??= []).push(...ids);
    return;
  }
  const position = layer.events.findIndex((event) => event.year > year);
  layer.events.splice(position === -1 ? layer.events.length : position, 0, { year, ...meta, changes });
};

export const updateEvent = (layer, { index, year, ...rest }) => {
  const event = eventAt(layer, index, year);
  layer.events[index] = { year, ...eventMeta(rest), changes: event.changes };
};

export const deleteEvent = (layer, { index, year }) => {
  eventAt(layer, index, year);
  layer.events.splice(index, 1);
};

export const addEntity = (layer, { id, name, from, color, group }) => {
  const entity = { id: cleanText(id), color, names: [{ from, name: cleanText(name) }] };
  if (!entity.id || !entity.names[0].name) throw new Error('Укажите идентификатор и название');
  if (!/^[a-z0-9_]+$/.test(entity.id)) throw new Error('Идентификатор: только латиница, цифры и подчёркивание');
  if (cleanText(group)) entity.group = cleanText(group);
  layer.entities.push(entity);
};
