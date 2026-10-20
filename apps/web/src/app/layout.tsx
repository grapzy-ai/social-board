import type { Metadata } from "next";
import { cookies } from "next/headers";
import { htmlThemeAttr, resolveTheme, THEME_COOKIE } from "@/lib/ui/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Board",
  description: "Дашборд соцсетей Вадима Бордияна",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="ru" data-theme={htmlThemeAttr(theme)}>
      <body>{children}</body>
    </html>
  );
}
