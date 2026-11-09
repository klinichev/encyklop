import { getCollection, getEntry } from 'astro:content';

// Черновики карт видны только в режиме разработки
export const getPublishedPointMaps = async () =>
	(await getCollection('pointMaps', ({ data }) => import.meta.env.DEV || !data.draft)).sort((a, b) => a.data.order - b.data.order);

export const pointMapPaths = async () =>
	(await getPublishedPointMaps()).map((map) => ({ params: { slug: map.id }, props: { map } }));

export const getPointMapData = async (slug: string) => {
	const entry = await getEntry('pointMapData', slug);
	if (!entry) throw new Error(`Нет данных для карты ${slug}: src/data/point-maps/${slug}/points.json`);
	return entry.data;
};
