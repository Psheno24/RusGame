export type EducationTier = "secondary" | "higher";

export type EducationInstitution = {
  id: string;
  tier: EducationTier;
  title: string;
  direction: string;
  directionTitle: string;
  costRub: number;
  sessions: number;
  description: string;
};

export const EDUCATION_INSTITUTIONS: EducationInstitution[] = [
  {
    id: "sec_college_it",
    tier: "secondary",
    title: "Колледж информационных технологий",
    direction: "it",
    directionTitle: "Информационные технологии",
    costRub: 100_000,
    sessions: 30,
    description: "Программирование, сети, администрирование.",
  },
  {
    id: "sec_college_trade",
    tier: "secondary",
    title: "Строительный колледж",
    direction: "construction",
    directionTitle: "Строительство",
    costRub: 80_000,
    sessions: 30,
    description: "Отделочные и общестроительные специальности.",
  },
  {
    id: "sec_college_med",
    tier: "secondary",
    title: "Медицинский колледж",
    direction: "medicine",
    directionTitle: "Медицина",
    costRub: 120_000,
    sessions: 36,
    description: "Сестринское дело и лабораторная диагностика.",
  },
  {
    id: "sec_college_econ",
    tier: "secondary",
    title: "Колледж экономики и права",
    direction: "economics",
    directionTitle: "Экономика",
    costRub: 90_000,
    sessions: 30,
    description: "Бухучёт, документооборот, основы права.",
  },
  {
    id: "high_univ_engineering",
    tier: "higher",
    title: "Технический университет",
    direction: "engineering",
    directionTitle: "Инженерия",
    costRub: 500_000,
    sessions: 90,
    description: "Машиностроение, энергетика, производство.",
  },
  {
    id: "high_univ_econ",
    tier: "higher",
    title: "Экономический университет",
    direction: "economics",
    directionTitle: "Экономика и финансы",
    costRub: 480_000,
    sessions: 90,
    description: "Финансы, аналитика, управление.",
  },
  {
    id: "high_univ_law",
    tier: "higher",
    title: "Юридический институт",
    direction: "law",
    directionTitle: "Право",
    costRub: 550_000,
    sessions: 120,
    description: "Гражданское и административное право.",
  },
  {
    id: "high_univ_med",
    tier: "higher",
    title: "Медицинский университет",
    direction: "medicine",
    directionTitle: "Медицина",
    costRub: 800_000,
    sessions: 180,
    description: "Лечебное дело, клиническая подготовка.",
  },
  {
    id: "high_univ_it",
    tier: "higher",
    title: "Университет прикладной информатики",
    direction: "it",
    directionTitle: "Прикладная информатика",
    costRub: 520_000,
    sessions: 90,
    description: "Разработка ПО, данные, информационные системы.",
  },
];

export const EDUCATION_DIRECTION_LABELS: Record<string, string> = {
  it: "Информационные технологии",
  construction: "Строительство",
  medicine: "Медицина",
  economics: "Экономика",
  law: "Право",
  engineering: "Инженерия",
};

export const EDUCATION_TIER_LABELS: Record<string, string> = {
  none: "Без образования",
  secondary: "Среднее профессиональное",
  higher: "Высшее",
};

export function getInstitution(id: string): EducationInstitution | undefined {
  return EDUCATION_INSTITUTIONS.find((i) => i.id === id);
}

export function listInstitutionsByTier(tier: EducationTier): EducationInstitution[] {
  return EDUCATION_INSTITUTIONS.filter((i) => i.tier === tier);
}
