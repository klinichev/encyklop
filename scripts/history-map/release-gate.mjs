// Пока карта не готова к публикации, она есть только в режиме разработки.
// Чтобы собрать сайт вместе с картой: HISTORY_MAP=1 npm run build
import { rmSync } from 'node:fs';

export const historyMapEnabled = (command) => command === 'dev' || process.env.HISTORY_MAP === '1';

export default function historyMapReleaseGate() {
  let enabled = false;
  return {
    name: 'history-map-release-gate',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        enabled = historyMapEnabled(command);
        if (!enabled) return;
        injectRoute({
          pattern: '/tools/history-map',
          entrypoint: './src/components/HistoryMap/page.astro',
        });
      },
      // Геоданные карты лежат в public/ и копируются в сборку целиком — убираем их, если карта выключена
      'astro:build:done': ({ dir, logger }) => {
        if (enabled) return;
        rmSync(new URL('data/history-map/', dir), { recursive: true, force: true });
        logger.info('Историческая карта выключена: страница и данные не попали в сборку (включить: HISTORY_MAP=1)');
      },
    },
  };
}
