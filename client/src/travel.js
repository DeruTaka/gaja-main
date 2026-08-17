import { clamp } from './utils.js';

/* ---------- travel estimate (notes: "estimates the traffic") ---------- */
export function travelMinutes(miles, startMin) {
  if (!miles) return 0;
  const rush = (startMin >= 420 && startMin <= 555) || (startMin >= 960 && startMin <= 1110);
  const mph = miles > 12 ? (rush ? 34 : 52) : (rush ? 17 : 26);
  return clamp(Math.round(miles / mph * 60 / 5) * 5, 5, 240);
}
export function entryTravel(e, startMin) {
  if (e.mode === 'In person') return travelMinutes(Number(e.miles) || 0, startMin);
  return Number(e.vmin) || 0; // virtual: optional walk/setup time
}
