export interface NavItem {
  href: string;
  label: string;
  /** false → rendered muted with «скоро», not a link */
  ready: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Аналитика",
    items: [
      { href: "/", label: "Обзор", ready: true },
      { href: "/posts", label: "Посты", ready: true },
      { href: "/audience", label: "Аудитория", ready: false },
      { href: "/sources", label: "Источники", ready: false },
      { href: "/people", label: "Люди", ready: false },
    ],
  },
  {
    title: "Работа",
    items: [
      { href: "/inbox", label: "Входящие", ready: true },
      { href: "/replies", label: "Ответы", ready: false },
      { href: "/signals", label: "Сигналы", ready: false },
      { href: "/drafts", label: "Черновики", ready: false },
      { href: "/schedule", label: "Расписание", ready: false },
      { href: "/challenges", label: "Челленджи", ready: false },
    ],
  },
  {
    title: "Управление",
    items: [
      { href: "/goals", label: "Цели", ready: false },
      { href: "/share", label: "Поделиться", ready: true },
      { href: "/settings/accounts", label: "Настройки", ready: true },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
