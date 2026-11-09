// Скачивает превью фотографий с Wikimedia Commons и сохраняет их в webp рядом с сайтом
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { getCommonsFiles, mapLimit, request } from './wikidata.mjs';

// Commons отдаёт превью стандартных ширин быстрее и без лимитов на генерацию
const SOURCE_WIDTH = 500;
const WIDTH = 480;
const QUALITY = 70;
const MAX_CREDIT_LENGTH = 100;

const shorten = (text) => (text && text.length > MAX_CREDIT_LENGTH ? `${text.slice(0, MAX_CREDIT_LENGTH - 1).trimEnd()}…` : text);

/**
 * @param {Record<string, string>} files id объекта → имя файла на Commons
 * @param {URL} dir папка в public/, куда сохранять превью
 * @param {string} publicPath путь к этой папке на сайте
 * @returns {Promise<Record<string, {src: string, author?: string, license?: string, source: string}>>}
 */
export async function syncPhotos(files, dir, publicPath) {
  mkdirSync(dir, { recursive: true });
  const info = await getCommonsFiles(Object.values(files), SOURCE_WIDTH);
  const photos = {};
  let downloaded = 0;
  let failed = 0;

  await mapLimit(Object.entries(files), 4, async ([id, fileName]) => {
    const meta = info[fileName];
    if (!meta?.thumbUrl) return;
    const target = new URL(`${id}.webp`, dir);
    if (!existsSync(target)) {
      try {
        const buffer = Buffer.from(await (await request(meta.thumbUrl)).arrayBuffer());
        writeFileSync(target, await sharp(buffer).rotate().resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer());
        downloaded++;
      } catch (error) {
        failed++;
        console.warn(`Не удалось скачать ${fileName}: ${error.message}`);
        return;
      }
    }
    photos[id] = { src: `${publicPath}/${id}.webp`, author: shorten(meta.author), license: meta.license, source: meta.pageUrl };
  });

  // Фото объектов, которых больше нет в данных, удаляем
  let removed = 0;
  for (const file of readdirSync(dir)) {
    if (!photos[file.replace(/\.webp$/, '')]) {
      rmSync(new URL(file, dir));
      removed++;
    }
  }

  console.log(`Фото: ${Object.keys(photos).length} всего, скачано ${downloaded}, ошибок ${failed}, удалено ${removed}`);
  return photos;
}
