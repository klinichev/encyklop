import type { APIRoute } from 'astro';
import { getPointMapData, pointMapPaths } from '../../../../lib/pointMaps';

export const getStaticPaths = pointMapPaths;

// Данные отдаются отдельным файлом: внутри HTML они бы задержали загрузку страницы
export const GET: APIRoute = async ({ params }) => Response.json(await getPointMapData(params.slug!));
