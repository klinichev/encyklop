import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

import sitemap from '@astrojs/sitemap';

import tailwind from '@astrojs/tailwind';
import react from "@astrojs/react";

import { readdirSync, readFileSync } from 'node:fs';

import historyMapEditor from './scripts/history-map/editor-integration.mjs';
import historyMapReleaseGate from './scripts/history-map/release-gate.mjs';

// Даты правок заметок для sitemap: коллекции в конфиге недоступны, поэтому читаем frontmatter напрямую
const blogDir = new URL('./src/content/blog/', import.meta.url);
const blogLastmod = Object.fromEntries(
	readdirSync(blogDir).map((file) => {
		const frontmatter = readFileSync(new URL(file, blogDir), 'utf8').split('---')[1];
		const date = frontmatter.match(/^updatedDate: '(.+)'/m) ?? frontmatter.match(/^pubDate: '(.+)'/m);
		return [file.replace(/\.mdx?$/, ''), date && new Date(date[1]).toISOString()];
	})
);

// https://astro.build/config
export default defineConfig({
	site: 'https://encyklop.com',
	vite: {
		// Острова client:only Vite не сканирует при старте и находит их зависимости только на первом
		// запросе страницы: пересборка зависимостей на лету роняет первую загрузку карты
		optimizeDeps: {
			include: ['maplibre-gl', 'lucide-react', 'react', 'react-dom', 'react-dom/client'],
		},
	},
	image: {
		// Превью видео и аватары каналов для страницы «Видео»
		domains: ['i.ytimg.com', 'yt3.ggpht.com', 'yt3.googleusercontent.com'],
	},
	integrations: [tailwind(), react(), mdx(), historyMapEditor(), historyMapReleaseGate(), sitemap({
		serialize(item) {
			const slug = item.url.match(/\/blog\/([^/]+)\/$/)?.[1];
			const lastmod = slug && blogLastmod[slug];
			return lastmod ? { ...item, lastmod } : item;
		},
	})],
});
