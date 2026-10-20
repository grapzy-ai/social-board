import type { GeneratedPackage } from "@/lib/claude/package";

export const fixturePackage: GeneratedPackage = {
  reels: Array.from({ length: 4 }, (_, i) => ({
    title: `Reels ${i + 1}`,
    hooks: ["Хук один", "Хук два", "Хук три"],
    script: "[0–2] хук\n[2–10] проблема\n[10–30] путь\n[30–40] урок\n[40–45] CTA",
    cover: "Каждое пятое размещение не окупается",
    angle: ["teach", "opinion", "mistake", "story"][i] as "teach" | "opinion" | "mistake" | "story",
    hookMechanic: ["number", "break", "confession", "peek"][i] as "number" | "break" | "confession" | "peek",
    funnel: "tofu",
  })),
  threads: ["т1", "т2", "т3", "т4", "т5"],
  carousel: { title: "Что показали 523 размещения", slides: Array.from({ length: 10 }, (_, i) => `слайд ${i + 1}`), caption: "подпись" },
  stories: ["с1", "с2", "с3"],
  tg: { title: "Мы посчитали", text: "Мы посчитали 523 размещения у блогеров до заказа на маркетплейсе.\n\nДва года назад я устал от разговора «блогеры не считаются». В общем, мы собрали каждое размещение в одну базу: 523 размещения, 6 брендов, 325 авторов.\n\n• На 1 рубль бюджета — 3,1 рубля заказов.\n• Все 8 кампаний окупились.\n\nКакой ДРР получался у вас?" },
};
