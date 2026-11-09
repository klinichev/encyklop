// Обложка для карточки тематической карты из файла на Wikimedia Commons.
// Запуск: node scripts/point-maps/cover.mjs "<имя файла на Commons>" <имя обложки>
// Результат: public/images/point-maps/covers/<имя обложки>.webp; автора и лицензию скрипт печатает
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { getCommonsFiles, request } from './lib/wikidata.mjs';

const [fileName, coverName] = process.argv.slice(2);
if (!fileName || !coverName) {
  console.error('Использование: node scripts/point-maps/cover.mjs "<файл на Commons>" <имя обложки>');
  process.exit(1);
}

const dir = new URL('../../public/images/point-maps/covers/', import.meta.url);
const info = (await getCommonsFiles([fileName], 1280))[fileName];
if (!info?.thumbUrl) throw new Error(`Файл не найден на Commons: ${fileName}`);

const buffer = Buffer.from(await (await request(info.thumbUrl)).arrayBuffer());
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${coverName}.webp`, dir), await sharp(buffer).rotate().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer());
console.log(`Готово: /images/point-maps/covers/${coverName}.webp\nФото: ${info.author ?? '—'}, ${info.license ?? '—'}\n${info.pageUrl}`);
