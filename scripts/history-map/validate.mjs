// Проверяет исторические данные всех слоёв: node scripts/history-map/validate.mjs
// Код выхода 1 только при ошибках; предупреждения не мешают сборке.
import { LAYER_IDS, loadDataset, validateDataset } from './dataset.mjs';

const dataset = loadDataset();
const { errors, warnings, stats } = validateDataset(dataset);

for (const id of LAYER_IDS) {
  const { events, entities, missingSource } = stats[id];
  console.log(`${id}: ${events} событий, ${entities} значений, без источника ${missingSource}`);
}
console.log(`Провинций: ${dataset.provinceIds.length}, годы ${dataset.range.firstYear}–${dataset.range.lastYear}`);

if (warnings.length) console.warn(`\nПредупреждения (${warnings.length}):\n${warnings.map((w) => `  ${w}`).join('\n')}`);
if (errors.length) {
  console.error(`\nОшибки (${errors.length}):\n${errors.map((e) => `  ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('\nОшибок нет');
