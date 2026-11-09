// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Энциклоп';
export const SITE_DESCRIPTION = 'Заметки обо всём, что вижу вокруг. Максимально субъективное мнение, максимально субъективный опыт.';

export const AUTHOR = {
	'@type': 'Person',
	'@id': 'https://encyklop.com/about/#person',
	name: 'Арсений Клиничев',
	url: 'https://encyklop.com/about/',
	image: 'https://encyklop.com/images/me.jpg',
	sameAs: [
		'https://www.youtube.com/@encyklop',
		'https://www.youtube.com/@a_klinichev',
		'https://t.me/arsenponial',
	],
};

// Подраздел /tools/maps/: карты с метками, по одной на набор данных из src/data/point-maps/
export const POINT_MAPS_SECTION = {
	title: 'Тематические карты',
	description: 'Карты мира с метками на заданную тему: здания, места, события',
	image: '/images/point-maps/covers/section.webp',
	imageCredit: 'Roybb95, CC BY-SA 3.0',
};

export const WEB_APP_SCHEMA = {
	'@type': 'WebApplication',
	operatingSystem: 'Any',
	browserRequirements: 'Requires JavaScript',
	isAccessibleForFree: true,
	offers: { '@type': 'Offer', price: 0, priceCurrency: 'RUB' },
	author: AUTHOR,
};
