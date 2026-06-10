/** Типы эффектов городских событий и погоды. */
export type EventEffectType =
  | "taxiDemand"
  | "deliveryDemand"
  | "taxiBusinessPremium"
  | "fuelPrice"
  | "taxiSpeed"
  | "deliveryOrders"
  | "workSalary"
  | "cashierSalary"
  | "housingRent"
  | "usedCarLots"
  | "workReputation"
  | "promotionChance"
  | "educationCost"
  | "educationGrant"
  | "newCarPrice"
  | "housingSupply"
  | "mood"
  | "movementSpeed"
  | "energyCost"
  | "fineChance"
  | "foodPrice"
  | "rentalDemand"
  | "autoDemand"
  | "vacancies"
  | "careerOffer"
  | "careerSalary"
  | "itSalary"
  | "industrySalary"
  | "educationReputation"
  | "weatherAmplify";

export type EventEffectDef = {
  type: EventEffectType;
  min: number;
  max: number;
};

export type CityEventTemplate = {
  id: string;
  title: string;
  /** Шанс выпадения при генерации одного слота (в %). */
  weight: number;
  effects: EventEffectDef[];
  texts: string[];
  /** Считается городским праздником для коэффициента дохода. */
  isCityHoliday?: boolean;
  /** Только для конкретного города. */
  cityId?: string;
};

export type RolledEffect = {
  type: EventEffectType;
  value: number;
};

export type ActiveCityEvent = {
  id: string;
  templateId: string;
  title: string;
  text: string;
  unique: boolean;
  effects: RolledEffect[];
  isCityHoliday: boolean;
};

export const EVENTS_REFRESH_MS = 3 * 60 * 60 * 1000;
export const WEATHER_REFRESH_MS = 60 * 60 * 1000;

/** Распределение количества общих событий за обновление. */
export const EVENT_COUNT_WEIGHTS: { count: number; weight: number }[] = [
  { count: 1, weight: 25 },
  { count: 2, weight: 40 },
  { count: 3, weight: 25 },
  { count: 4, weight: 8 },
  { count: 5, weight: 2 },
];

function evt(
  id: string,
  title: string,
  weight: number,
  effects: EventEffectDef[],
  texts: string[],
  extra?: Partial<CityEventTemplate>,
): CityEventTemplate {
  return { id, title, weight, effects, texts, ...extra };
}

const pct = (type: EventEffectType, min: number, max: number): EventEffectDef => ({
  type,
  min,
  max,
});

/** Общий пул событий (не уникальные). */
export const COMMON_EVENTS: CityEventTemplate[] = [
  // Частые (5–10%)
  evt("fuel_up", "Подорожание бензина", 10, [pct("fuelPrice", 2, 15)], [
    "На АЗС {city} топливо подорожало на {v}%.",
    "Бензин в {city} снова дорожает — +{v}%.",
    "В {city} цены на заправках выросли на {v}%.",
  ]),
  evt("fuel_down", "Снижение цены бензина", 8, [pct("fuelPrice", -10, -2)], [
    "АЗС {city}: скидка на топливо {v}%.",
    "В {city} бензин подешевел на {v}%.",
  ]),
  evt("road_repair", "Ремонт дорог", 8, [pct("taxiSpeed", -30, -10)], [
    "В {city} ремонт дорог — пробки и медленное движение.",
    "Перекрытия в центре {city}: такси едет на {v}% медленнее.",
  ]),
  evt("road_new", "Новая дорожная развязка", 5, [pct("taxiSpeed", 5, 20)], [
    "В {city} открыли развязку — поездки быстрее на {v}%.",
    "Новая трасса в {city} ускорила движение на {v}%.",
  ]),
  evt("delivery_boom", "Большой спрос на доставку", 8, [pct("deliveryDemand", 0.3, 1.0)], [
    "В {city} ажиотажный спрос на курьеров — заказов больше обычного.",
    "Доставка в {city} на подъёме: коэффициент дохода курьера +{v}.",
  ]),
  evt("delivery_slump", "Низкий спрос на доставку", 8, [pct("deliveryDemand", -0.5, -0.1)], [
    "В {city} мало заказов на доставку — спрос упал.",
    "Курьерам в {city} сейчас тише обычного.",
  ]),
  evt("rush_hour", "Час пик", 10, [pct("taxiDemand", 0.2, 0.4)], [
    "Час пик в {city} — такси разбирают быстро.",
    "Пробки и спрос: такси в {city} +{v} к коэффициенту.",
  ]),
  evt("salary_up", "Рост зарплат", 6, [pct("workSalary", 5, 20)], [
    "Работодатели {city} подняли зарплаты на {v}%.",
    "В {city} зарплаты на подработках выросли на {v}%.",
  ]),
  evt("recession", "Экономический спад", 5, [pct("workSalary", -15, -5)], [
    "Экономический спад в {city}: зарплаты -{v}%.",
    "В {city} работодатели режут ставки на {v}%.",
  ]),
  evt("staff_shortage", "Дефицит кадров", 6, [pct("cashierSalary", 10, 30)], [
    "В {city} не хватает кассиров и охранников — зарплаты +{v}%.",
  ]),
  evt("rent_up", "Рост аренды", 5, [pct("housingRent", 5, 20)], [
    "Аренда жилья в {city} выросла на {v}%.",
  ]),
  evt("rent_down", "Снижение аренды", 5, [pct("housingRent", -15, -5)], [
    "В {city} аренда подешевела на {v}%.",
  ]),
  evt("used_cars_influx", "Большой привоз автомобилей", 7, [pct("usedCarLots", 50, 50)], [
    "На б/у рынок {city} завезли много машин — лотов +50%.",
  ]),
  evt("used_cars_shortage", "Дефицит автомобилей", 5, [pct("usedCarLots", -30, -30)], [
    "На б/у рынке {city} мало предложений — лотов -30%.",
  ]),
  evt("job_fair", "Ярмарка вакансий", 6, [pct("workReputation", 20, 20)], [
    "Ярмарка вакансий в {city}: репутация за работу +20%.",
  ]),
  evt("employer_check", "Проверка работодателей", 5, [pct("promotionChance", 10, 10)], [
    "Проверка работодателей в {city}: шанс повышения +10%.",
  ]),

  // Необычные (2–5%)
  evt("food_fest", "Фестиваль еды", 4, [pct("deliveryDemand", 0.5, 0.5)], [
    "Фестиваль еды в {city} — курьерские заказы +50%, чаевые щедрее.",
  ]),
  evt("courier_strike", "Забастовка курьеров", 2, [pct("deliveryOrders", 10, 40)], [
    "Забастовка курьеров в {city}: стоимость доставок +{v}%.",
  ]),
  evt("concert", "Концерт", 4, [pct("taxiDemand", 0.3, 0.8)], [
    "Концерт в {city} — такси на подъёме, коэффициент +{v}.",
    "После концерта в {city} высокий спрос на такси.",
  ]),
  evt("football", "Футбольный матч", 4, [pct("taxiDemand", 0.2, 0.6)], [
    "Футбольный матч в {city}: спрос на такси +{v}.",
    "Стадион {city} полон — такси разбирают.",
  ]),
  evt("club_night", "Ночь клубов", 3, [pct("taxiBusinessPremium", 0.3, 0.8)], [
    "Ночь клубов в {city} — Бизнес и Премиум такси +{v}.",
  ]),
  evt("construction_boom", "Бум строительства", 3, [pct("housingSupply", 50, 50)], [
    "Стройка в {city}: жилья на рынке +50%.",
  ]),
  evt("housing_crisis", "Жилищный кризис", 2, [pct("housingSupply", -30, -30)], [
    "Жилищный кризис в {city}: доступного жилья -30%.",
  ]),
  evt("dealer_closed", "Закрытие автосалона", 2, [pct("newCarPrice", 5, 15)], [
    "Автосалон закрылся — новые авто в {city} +{v}%.",
  ]),
  evt("car_sale_season", "Сезон скидок", 3, [pct("newCarPrice", -15, -5)], [
    "Сезон скидок в {city}: новые авто -{v}%.",
  ]),
  evt("student_intake", "Набор студентов", 4, [pct("educationCost", -10, -10)], [
    "Набор студентов: обучение в {city} -10%.",
  ]),
  evt("tuition_up", "Повышение стоимости обучения", 3, [pct("educationCost", 10, 25)], [
    "Обучение в {city} подорожало на {v}%.",
  ]),
  evt("grant_program", "Грантовая программа", 2, [pct("educationGrant", 20, 50)], [
    "Грантовая программа в {city}: шанс скидки на обучение {v}%.",
  ]),
  evt("city_day", "День города", 4, [pct("taxiDemand", 0.2, 0.2), pct("mood", 10, 10)], [
    "День города {city}! Настроение +10, такси +20%.",
  ], { isCityHoliday: true }),
  evt("city_holiday", "Городской праздник", 5, [pct("mood", 5, 15)], [
    "Городской праздник в {city} — настроение +{v}.",
  ], { isCityHoliday: true }),
  evt("fireworks", "Салют", 4, [pct("mood", 5, 5)], [
    "Салют над {city} — праздничное настроение.",
  ]),
  evt("power_outage", "Массовые отключения света", 2, [pct("mood", -15, -5), pct("deliveryDemand", -0.1, -0.1)], [
    "Отключения света в {city}: настроение -{v}, заказов меньше.",
  ]),
  evt("heating_break", "Прорыв теплотрассы", 2, [pct("mood", -5, -5), pct("movementSpeed", -10, -10)], [
    "Прорыв теплотрассы в {city}: движение замедлено.",
  ]),

  // Редкие (0.5–2%)
  evt("gibdd_checks", "Массовые проверки ГИБДД", 1.5, [pct("fineChance", 50, 50)], [
    "ГИБДД усилила проверки в {city}: шанс штрафов +50%.",
  ]),
  evt("harvest", "Урожайный сезон", 1, [pct("foodPrice", -20, -10)], [
    "Урожайный сезон: продукты в {city} дешевле на {v}%.",
  ]),
  evt("tourist_season", "Туристический сезон", 1, [pct("rentalDemand", 20, 40)], [
    "Туристический сезон в {city}: аренда +{v}%.",
  ]),
  evt("science_conf", "Научная конференция", 1, [pct("educationCost", -10, -10), pct("educationReputation", 20, 20)], [
    "Научная конференция: обучение -10%, репутация +20%.",
  ]),
  evt("industry_expo", "Промышленная выставка", 1, [pct("industrySalary", 10, 25)], [
    "Промышленная выставка в {city}: зарплаты промышленности +{v}%.",
  ]),
  evt("it_forum", "IT-форум", 1, [pct("itSalary", 15, 30)], [
    "IT-форум в {city}: зарплаты IT +{v}%.",
  ]),
  evt("auto_fest", "Автофестиваль", 1, [pct("autoDemand", 10, 30), pct("mood", 5, 5)], [
    "Автофестиваль в {city}: продажи авто +{v}%, настроение +5.",
  ]),
  evt("employer_forum", "Форум работодателей", 1, [pct("careerOffer", 25, 25)], [
    "Форум работодателей: шанс карьерного предложения +25%.",
  ]),
  evt("new_factory", "Запуск нового завода", 1, [pct("vacancies", 50, 50), pct("workSalary", 10, 10)], [
    "Новый завод в {city}: вакансии +50%, зарплаты +10%.",
  ]),
  evt("factory_closures", "Массовое закрытие предприятий", 0.8, [pct("vacancies", -30, -30)], [
    "Закрытие предприятий в {city}: вакансий -30%.",
  ]),
  evt("official_visit", "Визит федерального чиновника", 0.7, [pct("workReputation", 10, 10)], [
    "Визит чиновника в {city}: репутация за работу +10%.",
  ]),
  evt("weather_anomaly", "Погодная аномалия", 0.5, [pct("weatherAmplify", 2, 2)], [
    "Погодная аномалия в {city}: все погодные эффекты усилены вдвое.",
  ]),

  // Очень редкие (0.1–0.5%)
  evt("big_investor", "Крупный инвестор пришёл в город", 0.5, [pct("workSalary", 20, 50)], [
    "Крупный инвестор в {city}: все зарплаты +{v}%.",
  ]),
  evt("intl_forum", "Международный форум", 0.3, [pct("taxiBusinessPremium", 1.0, 1.0)], [
    "Международный форум в {city}: Бизнес и Премиум такси ×2.",
  ]),
  evt("olympics", "Олимпиада", 0.2, [pct("taxiDemand", 1.0, 1.0), pct("rentalDemand", 50, 50)], [
    "Олимпиада в {city}! Такси +100%, аренда +50%.",
  ]),
  evt("record_tourism", "Рекордный туристический сезон", 0.4, [pct("rentalDemand", 20, 20), pct("taxiDemand", 0.3, 0.3)], [
    "Рекордный туризм в {city}: аренда +20%, такси +30%.",
  ]),
  evt("flood", "Наводнение", 0.2, [pct("deliveryDemand", -0.4, -0.4), pct("taxiDemand", -0.3, -0.3), pct("mood", -20, -20)], [
    "Наводнение в {city}: курьер -40%, такси -30%, настроение -20.",
  ]),
  evt("heavy_snow", "Сильный снегопад", 0.4, [pct("movementSpeed", -30, -30), pct("taxiDemand", 0.4, 0.4)], [
    "Снегопад в {city}: движение -30%, спрос на такси +40%.",
  ]),
  evt("heat_wave", "Аномальная жара", 0.4, [pct("energyCost", 20, 20), pct("mood", -10, -10)], [
    "Жара в {city}: расход энергии +20%, настроение -10.",
  ]),
  evt("housing_crash", "Резкое падение цен на жильё", 0.1, [pct("housingRent", -25, -15)], [
    "Цены на жильё в {city} рухнули на {v}%.",
  ]),
  evt("auto_crisis", "Автомобильный кризис", 0.2, [pct("newCarPrice", 20, 40)], [
    "Автокризис: новые авто в {city} +{v}%.",
  ]),
  evt("state_support", "Государственная программа поддержки", 0.3, [pct("educationCost", -25, -25), pct("workReputation", 10, 10)], [
    "Госпрограмма: обучение -25%, репутация +10.",
  ]),
];

/** Уникальные события по городам (отдельный ролл, не влияет на общий пул). */
export const UNIQUE_EVENTS: CityEventTemplate[] = [
  evt("omsk_hockey", "Хоккейный матч Авангарда", 3, [pct("taxiDemand", 0.2, 0.4), pct("mood", 5, 5)], [
    "«Авангард» играет дома — такси +{v}, настроение +5.",
  ], { cityId: "omsk" }),
  evt("omsk_agro", "Выставка сельхозтехники", 2, [pct("deliveryOrders", 20, 20)], [
    "Выставка сельхозтехники в Омске: спрос на грузоперевозки +20%.",
  ], { cityId: "omsk" }),

  evt("samara_lada", "АвтоВАЗ увеличил производство", 2, [pct("newCarPrice", -15, -5)], [
    "АвтоВАЗ нарастил выпуск — Lada в Самаре -{v}%.",
  ], { cityId: "samara" }),
  evt("samara_autofest", "Автофестиваль", 2, [pct("autoDemand", 20, 20), pct("mood", 5, 5)], [
    "Автофестиваль в Самаре: продажи авто +20%, настроение +5.",
  ], { cityId: "samara" }),

  evt("kazan_student", "Студенческий фестиваль", 2, [pct("educationCost", -10, -10), pct("mood", 5, 5)], [
    "Студенческий фестиваль в Казани: обучение -10%, настроение +5.",
  ], { cityId: "kazan" }),
  evt("kazan_it", "IT-форум", 1, [pct("itSalary", 20, 20)], [
    "IT-форум в Казани: зарплаты IT +20%.",
  ], { cityId: "kazan" }),

  evt("ekb_metal", "Металлургический форум", 1, [pct("industrySalary", 20, 20)], [
    "Металлургический форум: зарплаты промышленности +20%.",
  ], { cityId: "ekb" }),
  evt("ekb_industry", "Промышленная выставка", 1, [pct("vacancies", 15, 15)], [
    "Промышленная выставка в Екатеринбурге: вакансии +15%.",
  ], { cityId: "ekb" }),

  evt("nsk_academ", "Форум Академгородка", 1, [pct("educationReputation", 20, 20)], [
    "Форум Академгородка: репутация за обучение +20%.",
  ], { cityId: "novosibirsk" }),
  evt("nsk_science", "Научная конференция", 1, [pct("educationCost", -10, -10)], [
    "Научная конференция в Новосибирске: обучение -10%.",
  ], { cityId: "novosibirsk" }),

  evt("krd_resort", "Курортный сезон", 2, [pct("rentalDemand", 20, 20), pct("taxiDemand", 0.3, 0.3)], [
    "Курортный сезон в Краснодаре: аренда +20%, такси +30%.",
  ], { cityId: "krasnodar" }),
  evt("krd_harvest", "Урожайный сезон", 2, [pct("foodPrice", -15, -15)], [
    "Урожайный сезон: продукты в Краснодаре -15%.",
  ], { cityId: "krasnodar" }),

  evt("spb_white_nights", "Белые ночи", 2, [pct("mood", 10, 10), pct("taxiDemand", 0.2, 0.2)], [
    "Белые ночи в Петербурге: настроение +10, такси +20%.",
  ], { cityId: "spb" }),
  evt("spb_forum", "Петербургский форум", 1, [pct("taxiBusinessPremium", 0.5, 0.5)], [
    "Петербургский форум: Бизнес такси +50%.",
  ], { cityId: "spb" }),

  evt("msk_econ", "Экономический форум", 1, [pct("careerSalary", 20, 20)], [
    "Экономический форум в Москве: зарплаты карьеры +20%.",
  ], { cityId: "moscow" }),
  evt("msk_expo", "Международная выставка", 1, [pct("taxiBusinessPremium", 0.5, 0.5)], [
    "Международная выставка: Бизнес и Премиум такси +50%.",
  ], { cityId: "moscow" }),
  evt("msk_parade", "Парад", 1, [pct("mood", 10, 10)], [
    "Парад в Москве — праздничное настроение +10.",
  ], { cityId: "moscow" }),
  evt("msk_concert", "Крупный концерт", 2, [pct("taxiDemand", 0.5, 0.5)], [
    "Крупный концерт в Москве: такси +50%.",
  ], { cityId: "moscow" }),
];

export function getUniqueEventsForCity(cityId: string): CityEventTemplate[] {
  return UNIQUE_EVENTS.filter((e) => e.cityId === cityId);
}
