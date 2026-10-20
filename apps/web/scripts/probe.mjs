import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
p.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 500)));
p.on("console", (m) => { if (m.type() !== "log") console.log("console:", m.type(), m.text().slice(0, 300)); });
const r = await p.goto("http://127.0.0.1:3100/", { waitUntil: "load" });
console.log("status", r.status());
try { await p.waitForSelector(".recharts-wrapper", { timeout: 8000 }); console.log("wrapper ok"); } catch { console.log("no wrapper"); }
console.log(await p.evaluate(() => ({ fiber: Object.keys(document.querySelector("aside a") || {}).filter((k) => k.startsWith("__react")).length, rc: document.querySelector(".recharts-responsive-container")?.outerHTML.slice(0, 200) })));
await b.close();
