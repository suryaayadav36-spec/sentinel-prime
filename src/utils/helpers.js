import { TECHNIQUES, USERS, DEVICES, ACTORS } from "../data/constants.js";

export const rand = (a, b) => Math.random() * (b - a) + a;
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[randInt(0, arr.length - 1)];
export const f1 = n => Number(n).toFixed(1);
export const f2 = n => Number(n).toFixed(2);
export const pct = n => (Number(n) * 100).toFixed(1) + "%";

export function mkAlert(sev) {
  const t = pick(TECHNIQUES);
  const score = sev === "Critical"
    ? rand(8.5, 10)
    : sev === "High"
    ? rand(6.5, 8.4)
    : sev === "Medium"
    ? rand(4, 6.4)
    : rand(1, 3.9);
  const conf = sev === "Critical" ? rand(0.91, 0.99) : rand(0.72, 0.93);
  return {
    id: Date.now() + Math.random(),
    sev,
    score,
    conf,
    user: pick(USERS),
    device: pick(DEVICES),
    tech: t,
    time: new Date(),
    actor: conf > 0.88 ? pick(ACTORS) : null,
    phase: pick(["Recon", "Initial Access", "Lateral Movement", "Privilege Escalation", "Exfiltration"]),
    delta: rand(0.4, 0.98),
    status: "Open",
  };
}
