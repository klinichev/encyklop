import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blogCollection = defineCollection({
	type: 'content',
	// Type-check frontmatter using a schema
	schema: ({ image }) => z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date().optional(),
		updatedDate: z.coerce.date().optional(),
		heroImage: image(),
		status: z.number().optional(),
	}),
});

// Тематические карты (/tools/maps/): у каждой карты папка src/data/point-maps/<slug>/
// с meta.json (пишется вручную) и points.json (собирается скриптом из scripts/point-maps/)
const POINT_MAPS_BASE = './src/data/point-maps';
const mapSlug = ({ entry }: { entry: string }) => entry.split('/')[0];

const pointMaps = defineCollection({
	loader: glob({ pattern: '*/meta.json', base: POINT_MAPS_BASE, generateId: mapSlug }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		// Подсказка под заголовком страницы
		lead: z.string(),
		// Обложка карточки в подразделе, путь от public/
		cover: z.string().startsWith('/'),
		coverCredit: z.string().optional(),
		// Сортировка карточек в подразделе
		order: z.number(),
		// Черновик виден только в режиме разработки
		draft: z.boolean().default(false),
		filter: z.object({
			label: z.string(),
			all: z.string(),
		}),
		// Формы слова для счётчика: «1 постройка», «2 постройки», «5 построек»
		pointNoun: z.tuple([z.string(), z.string(), z.string()]),
		// Пояснение к данным под картой
		note: z.string().optional(),
	}),
});

const pointMapData = defineCollection({
	loader: glob({ pattern: '*/points.json', base: POINT_MAPS_BASE, generateId: mapSlug }),
	schema: z
		.object({
			source: z.string(),
			fetched: z.string().date(),
			groups: z.array(z.object({
				id: z.string(),
				name: z.string(),
				year: z.number().int().optional(),
			})).min(1),
			points: z.array(z.object({
				id: z.string(),
				name: z.string(),
				lat: z.number().min(-90).max(90),
				lng: z.number().min(-180).max(180),
				groups: z.array(z.string()).min(1),
				year: z.number().int().optional(),
				type: z.string().optional(),
				place: z.string().optional(),
				country: z.string().optional(),
				link: z.string().url().optional(),
				photo: z.object({
					src: z.string().startsWith('/'),
					author: z.string().optional(),
					license: z.string().optional(),
					source: z.string().url(),
				}).optional(),
			})),
		})
		.superRefine(({ groups, points }, context) => {
			const groupIds = new Set(groups.map((group) => group.id));
			const pointIds = new Set<string>();
			points.forEach((point, index) => {
				if (pointIds.has(point.id)) context.addIssue({ code: 'custom', path: ['points', index, 'id'], message: `Повтор id ${point.id}` });
				pointIds.add(point.id);
				for (const group of point.groups) {
					if (!groupIds.has(group)) context.addIssue({ code: 'custom', path: ['points', index, 'groups'], message: `Нет группы ${group}` });
				}
			});
		}),
});

export const collections = {
	blog: blogCollection,
	pointMaps,
	pointMapData,
};
