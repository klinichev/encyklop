interface LocationTranslations {
  city: {
    en: string;
    fr: string;
    it: string;
    ru: string;
  };
  country: {
    en: string;
    fr: string;
    it: string;
    ru: string;
  };
}

interface Location {
  id: number;
  translations: LocationTranslations;
  timezone: string;
  image: string;
}

export const locations: Location[] = [
  {
    id: 1,
    translations: {
      city: {
        en: "Tokyo",
        fr: "Tokyo",
        it: "Tokyo",
        ru: "Токио",
      },
      country: {
        en: "Japan",
        fr: "Japon",
        it: "Giappone",
        ru: "Япония",
      },
    },
    timezone: "Asia/Tokyo",
    image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 2,
    translations: {
      city: {
        en: "Paris",
        fr: "Paris",
        it: "Parigi",
        ru: "Париж",
      },
      country: {
        en: "France",
        fr: "France",
        it: "Francia",
        ru: "Франция",
      },
    },
    timezone: "Europe/Paris",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 3,
    translations: {
      city: {
        en: "New York",
        fr: "New York",
        it: "New York",
        ru: "Нью-Йорк",
      },
      country: {
        en: "United States",
        fr: "États-Unis",
        it: "Stati Uniti",
        ru: "США",
      },
    },
    timezone: "America/New_York",
    image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 4,
    translations: {
      city: {
        en: "Sydney",
        fr: "Sydney",
        it: "Sydney",
        ru: "Сидней",
      },
      country: {
        en: "Australia",
        fr: "Australie",
        it: "Australia",
        ru: "Австралия",
      },
    },
    timezone: "Australia/Sydney",
    image: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 5,
    translations: {
      city: {
        en: "Dubai",
        fr: "Dubaï",
        it: "Dubai",
        ru: "Дубай",
      },
      country: {
        en: "United Arab Emirates",
        fr: "Émirats Arabes Unis",
        it: "Emirati Arabi Uniti",
        ru: "ОАЭ",
      },
    },
    timezone: "Asia/Dubai",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 6,
    translations: {
      city: {
        en: "Rio de Janeiro",
        fr: "Rio de Janeiro",
        it: "Rio de Janeiro",
        ru: "Рио-де-Жанейро",
      },
      country: {
        en: "Brazil",
        fr: "Brésil",
        it: "Brasile",
        ru: "Бразилия",
      },
    },
    timezone: "America/Sao_Paulo",
    image: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 7,
    translations: {
      city: {
        en: "Cape Town",
        fr: "Le Cap",
        it: "Città del Capo",
        ru: "Кейптаун",
      },
      country: {
        en: "South Africa",
        fr: "Afrique du Sud",
        it: "Sudafrica",
        ru: "ЮАР",
      },
    },
    timezone: "Africa/Johannesburg",
    image: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 8,
    translations: {
      city: {
        en: "Singapore",
        fr: "Singapour",
        it: "Singapore",
        ru: "Сингапур",
      },
      country: {
        en: "Singapore",
        fr: "Singapour",
        it: "Singapore",
        ru: "Сингапур",
      },
    },
    timezone: "Asia/Singapore",
    image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 9,
    translations: {
      city: {
        en: "London",
        fr: "Londres",
        it: "Londra",
        ru: "Лондон",
      },
      country: {
        en: "United Kingdom",
        fr: "Royaume-Uni",
        it: "Regno Unito",
        ru: "Великобритания",
      },
    },
    timezone: "Europe/London",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 10,
    translations: {
      city: {
        en: "Moscow",
        fr: "Moscou",
        it: "Mosca",
        ru: "Москва",
      },
      country: {
        en: "Russia",
        fr: "Russie",
        it: "Russia",
        ru: "Россия",
      },
    },
    timezone: "Europe/Moscow",
    image: "https://images.unsplash.com/photo-1513326738677-b964603b136d?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 11,
    translations: {
      city: {
        en: "Vancouver",
        fr: "Vancouver",
        it: "Vancouver",
        ru: "Ванкувер",
      },
      country: {
        en: "Canada",
        fr: "Canada",
        it: "Canada",
        ru: "Канада",
      },
    },
    timezone: "America/Vancouver",
    image: "https://images.unsplash.com/photo-1559511260-66a654ae982a?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 12,
    translations: {
      city: {
        en: "Mumbai",
        fr: "Bombay",
        it: "Mumbai",
        ru: "Мумбаи",
      },
      country: {
        en: "India",
        fr: "Inde",
        it: "India",
        ru: "Индия",
      },
    },
    timezone: "Asia/Kolkata",
    image: "https://images.unsplash.com/photo-1566552881560-0be862a7c445?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 13,
    translations: {
      city: {
        en: "Istanbul",
        fr: "Istanbul",
        it: "Istanbul",
        ru: "Стамбул",
      },
      country: {
        en: "Turkey",
        fr: "Turquie",
        it: "Turchia",
        ru: "Турция",
      },
    },
    timezone: "Europe/Istanbul",
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 14,
    translations: {
      city: {
        en: "Mexico City",
        fr: "Mexico",
        it: "Città del Messico",
        ru: "Мехико",
      },
      country: {
        en: "Mexico",
        fr: "Mexique",
        it: "Messico",
        ru: "Мексика",
      },
    },
    timezone: "America/Mexico_City",
    image: "https://images.unsplash.com/photo-1518659526054-190340b32735?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 15,
    translations: {
      city: {
        en: "Bangkok",
        fr: "Bangkok",
        it: "Bangkok",
        ru: "Бангкок",
      },
      country: {
        en: "Thailand",
        fr: "Thaïlande",
        it: "Thailandia",
        ru: "Таиланд",
      },
    },
    timezone: "Asia/Bangkok",
    image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 16,
    translations: {
      city: {
        en: "Cairo",
        fr: "Le Caire",
        it: "Il Cairo",
        ru: "Каир",
      },
      country: {
        en: "Egypt",
        fr: "Égypte",
        it: "Egitto",
        ru: "Египет",
      },
    },
    timezone: "Africa/Cairo",
    image: "https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 17,
    translations: {
      city: {
        en: "Auckland",
        fr: "Auckland",
        it: "Auckland",
        ru: "Окленд",
      },
      country: {
        en: "New Zealand",
        fr: "Nouvelle-Zélande",
        it: "Nuova Zelanda",
        ru: "Новая Зеландия",
      },
    },
    timezone: "Pacific/Auckland",
    image: "https://images.unsplash.com/photo-1507699622108-4be3abd695ad?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 18,
    translations: {
      city: {
        en: "Seoul",
        fr: "Séoul",
        it: "Seul",
        ru: "Сеул",
      },
      country: {
        en: "South Korea",
        fr: "Corée du Sud",
        it: "Corea del Sud",
        ru: "Южная Корея",
      },
    },
    timezone: "Asia/Seoul",
    image: "https://images.unsplash.com/photo-1533577116850-9cc66cad8a9b?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 19,
    translations: {
      city: {
        en: "Buenos Aires",
        fr: "Buenos Aires",
        it: "Buenos Aires",
        ru: "Буэнос-Айрес",
      },
      country: {
        en: "Argentina",
        fr: "Argentine",
        it: "Argentina",
        ru: "Аргентина",
      },
    },
    timezone: "America/Argentina/Buenos_Aires",
    image: "https://images.unsplash.com/photo-1706170421190-48b12aa10f5e?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 20,
    translations: {
      city: {
        en: "Stockholm",
        fr: "Stockholm",
        it: "Stoccolma",
        ru: "Стокгольм",
      },
      country: {
        en: "Sweden",
        fr: "Suède",
        it: "Svezia",
        ru: "Швеция",
      },
    },
    timezone: "Europe/Stockholm",
    image: "https://images.unsplash.com/photo-1509356843151-3e7d96241e11?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 21,
    translations: {
      city: {
        en: "Petropavlovsk-Kamchatsky",
        fr: "Petropavlovsk-Kamtchatski",
        it: "Petropavlovsk-Kamčatskij",
        ru: "Петропавловск-Камчатский",
      },
      country: {
        en: "Russia",
        fr: "Russie",
        it: "Russia",
        ru: "Россия",
      },
    },
    timezone: "Asia/Kamchatka",
    image: "https://images.unsplash.com/photo-1634745189232-469c67012923?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 22,
    translations: {
      city: {
        en: "Beijing",
        fr: "Pékin",
        it: "Pechino",
        ru: "Пекин",
      },
      country: {
        en: "China",
        fr: "Chine",
        it: "Cina",
        ru: "Китай",
      },
    },
    timezone: "Asia/Shanghai",
    image: "https://images.unsplash.com/photo-1713173642147-30cbbdb176d5?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 23,
    translations: {
      city: {
        en: "Baghdad",
        fr: "Bagdad",
        it: "Baghdad",
        ru: "Багдад",
      },
      country: {
        en: "Iraq",
        fr: "Irak",
        it: "Iraq",
        ru: "Ирак",
      },
    },
    timezone: "Asia/Baghdad",
    image: "https://images.unsplash.com/photo-1709659693787-81ef6a25fa98?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 24,
    translations: {
      city: {
        en: "Lima",
        fr: "Lima",
        it: "Lima",
        ru: "Лима",
      },
      country: {
        en: "Peru",
        fr: "Pérou",
        it: "Perù",
        ru: "Перу",
      },
    },
    timezone: "America/Lima",
    image: "https://images.unsplash.com/photo-1729625616173-bfc0ac7f78b7?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 25,
    translations: {
      city: {
        en: "Denver",
        fr: "Denver",
        it: "Denver",
        ru: "Денвер",
      },
      country: {
        en: "United States",
        fr: "États-Unis",
        it: "Stati Uniti",
        ru: "США",
      },
    },
    timezone: "America/Denver",
    image: "https://images.unsplash.com/photo-1519424187720-db6d0fc5a5d2?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: 26,
    translations: {
      city: {
        en: "Honolulu",
        fr: "Honolulu",
        it: "Honolulu",
        ru: "Гонолулу",
      },
      country: {
        en: "United States",
        fr: "États-Unis",
        it: "Stati Uniti",
        ru: "США",
      },
    },
    timezone: "Pacific/Honolulu",
    image: "https://images.unsplash.com/photo-1684727906248-b36353278801?auto=format&fit=crop&q=80&w=1200",
  },
];