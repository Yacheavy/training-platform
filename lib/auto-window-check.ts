import { withinAutoWindow } from "./email/activity-analysis";
const now = new Date("2026-10-13T12:00:00Z");
const h = (n: number) => new Date(now.getTime() - n * 3600_000);
const cases: [string, boolean, boolean][] = [["1 h", withinAutoWindow(h(1), now), true], ["47 h", withinAutoWindow(h(47), now), true], ["48 h", withinAutoWindow(h(48), now), true], ["49 h", withinAutoWindow(h(49), now), false], ["domingo→martes", withinAutoWindow(new Date("2026-10-11T13:00:00Z"), new Date("2026-10-13T22:00:00Z")), false]];
let p = 0; for (const [n, g, w] of cases) if (g !== w) { p++; console.log("FALLA", n); }
console.log({ checks: cases.length, problems: p }); process.exit(p ? 1 : 0);
