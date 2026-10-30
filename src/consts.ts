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

export const WEB_APP_SCHEMA = {
	'@type': 'WebApplication',
	operatingSystem: 'Any',
	browserRequirements: 'Requires JavaScript',
	isAccessibleForFree: true,
	offers: { '@type': 'Offer', price: 0, priceCurrency: 'RUB' },
	author: AUTHOR,
};
