const API_URL = 'https://www.googleapis.com/youtube/v3';
const VIDEOS_PER_CHANNEL = 4;
// С запасом: часть записей из плейлиста может отсеяться (например, идущие и запланированные трансляции)
const PLAYLIST_ITEMS_TO_CHECK = 15;

// Служебные плейлисты YouTube, которых нет в документации: их id получается заменой «UC» в id канала.
// Только в них обычные видео отделены от Shorts и трансляций, у самого API такого признака нет
const PLAYLIST_PREFIXES = {
	videos: 'UULF',
	streams: 'UULV',
};

type VideoKind = keyof typeof PLAYLIST_PREFIXES;

interface Thumbnail {
	url: string;
	width: number;
	height: number;
}

type Thumbnails = Partial<Record<'default' | 'medium' | 'high' | 'standard' | 'maxres', Thumbnail>>;

export interface YouTubeVideo {
	url: string;
	title: string;
	thumbnail: Thumbnail;
	duration: string;
	views: string;
}

export interface YouTubeChannel {
	url: string;
	handle: string;
	title: string;
	avatar: Thumbnail;
	subscribers: string;
	videos: YouTubeVideo[];
}

async function request(endpoint: string, params: Record<string, string>) {
	const query = new URLSearchParams({ ...params, key: import.meta.env.YOUTUBE_API_KEY });
	const response = await fetch(`${API_URL}/${endpoint}?${query}`);
	if (!response.ok) {
		const { error } = await response.json().catch(() => ({ error: null }));
		throw new Error(`YouTube API, ${endpoint}: ${response.status} ${error?.message ?? response.statusText}`);
	}
	return (await response.json()).items ?? [];
}

// 1299 → «1,2 тыс. просмотров», как на YouTube: округляем только вниз, а после тысячи слово всегда в родительном падеже
function formatCount(count: number, [one, few, many]: string[], maximumSignificantDigits?: number) {
	const number = new Intl.NumberFormat('ru', {
		notation: 'compact',
		roundingMode: 'trunc',
		maximumSignificantDigits,
	} as Intl.NumberFormatOptions).format(count);
	if (count >= 1000) return `${number} ${many}`;
	const forms: Partial<Record<Intl.LDMLPluralRule, string>> = { one, few };
	return `${number} ${forms[new Intl.PluralRules('ru').select(count)] ?? many}`;
}

// PT1H2M3S → 1:02:03
function formatDuration(duration: string) {
	const [, days, hours, minutes, seconds] = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/) ?? [];
	const totalHours = Number(days ?? 0) * 24 + Number(hours ?? 0);
	const paddedSeconds = (seconds ?? '0').padStart(2, '0');
	return totalHours
		? `${totalHours}:${(minutes ?? '0').padStart(2, '0')}:${paddedSeconds}`
		: `${minutes ?? 0}:${paddedSeconds}`;
}

function largestThumbnail({ maxres, standard, high, medium, default: small }: Thumbnails) {
	return (maxres ?? standard ?? high ?? medium ?? small) as Thumbnail;
}

async function getLatestVideos(channelId: string, kind: VideoKind): Promise<YouTubeVideo[]> {
	const playlistItems = await request('playlistItems', {
		part: 'contentDetails',
		playlistId: channelId.replace(/^UC/, PLAYLIST_PREFIXES[kind]),
		maxResults: String(PLAYLIST_ITEMS_TO_CHECK),
	});
	const videoIds: string[] = playlistItems.map((item: any) => item.contentDetails.videoId);
	if (!videoIds.length) return [];

	const videos = await request('videos', {
		part: 'snippet,contentDetails,statistics,liveStreamingDetails',
		id: videoIds.join(','),
	});

	return videos
		.filter((video: any) =>
			video.snippet.liveBroadcastContent === 'none'
			// У записи трансляции, которую YouTube ещё обрабатывает, длительность нулевая
			&& video.contentDetails.duration !== 'P0D'
			&& (kind !== 'streams' || video.liveStreamingDetails?.actualEndTime)
		)
		.sort((a: any, b: any) => videoIds.indexOf(a.id) - videoIds.indexOf(b.id))
		.slice(0, VIDEOS_PER_CHANNEL)
		.map((video: any) => ({
			url: `https://www.youtube.com/watch?v=${video.id}`,
			title: video.snippet.title,
			thumbnail: largestThumbnail(video.snippet.thumbnails),
			duration: formatDuration(video.contentDetails.duration),
			views: formatCount(Number(video.statistics.viewCount ?? 0), ['просмотр', 'просмотра', 'просмотров']),
		}));
}

export async function getChannel(handle: string, kind: VideoKind): Promise<YouTubeChannel | null> {
	if (!import.meta.env.YOUTUBE_API_KEY) {
		const message = 'Не задан YOUTUBE_API_KEY';
		if (!import.meta.env.DEV) throw new Error(message);
		console.warn(`${message}: блок канала ${handle} не показан`);
		return null;
	}

	const [channel] = await request('channels', {
		part: 'snippet,statistics',
		forHandle: handle,
	});
	if (!channel) throw new Error(`YouTube API: канал ${handle} не найден`);

	return {
		url: `https://www.youtube.com/${handle}`,
		handle,
		title: channel.snippet.title,
		avatar: largestThumbnail(channel.snippet.thumbnails),
		// Подписчиков YouTube показывает точнее, чем просмотры: «1,29 млн»
		subscribers: formatCount(Number(channel.statistics.subscriberCount), ['подписчик', 'подписчика', 'подписчиков'], 3),
		videos: await getLatestVideos(channel.id, kind),
	};
}
