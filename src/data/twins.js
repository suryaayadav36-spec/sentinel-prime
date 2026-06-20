import { rand, pick } from "../utils/helpers.js";
import { USERS, DEPTS } from "./constants.js";

export const TWIN_LIST = USERS.map((u, i) => ({
  id: u,
  dept: DEPTS[i] || pick(DEPTS),
  risk: i === 0 ? 8.7 : parseFloat(rand(1, 4.5).toFixed(1)),
  anomaly: i === 0,
  hist: Array.from({ length: 48 }, (_, j) => {
    const base = rand(0.06, 0.26);
    if (i === 0 && j >= 44) return [0.58, 0.74, 0.88, 0.96][j - 44];
    return base;
  }),
  dims: [
    { label: "Access Pattern", v: i === 0 ? 0.93 : rand(0.1, 0.45) },
    { label: "Temporal Shift", v: i === 0 ? 0.89 : rand(0.05, 0.4) },
    { label: "Network Persona", v: i === 0 ? 0.77 : rand(0.1, 0.5) },
    { label: "Process DNA", v: i === 0 ? 0.82 : rand(0.08, 0.4) },
    { label: "Data Sensitivity", v: i === 0 ? 0.71 : rand(0.1, 0.45) },
  ],
}));
