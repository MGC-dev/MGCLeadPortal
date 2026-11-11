/**
 * A practice area as a solid tag, one colour per area, the same on every page. White text on each colour is 4.9:1
 * or better. Areas a firm adds later get a stable colour from the same set.
 */
const COLORS: Record<string, string> = {
  'Family law': '#7c3aed',
  'Personal injury': '#c2410c',
  'Immigration': '#0f766e',
  'Estate planning': '#4d7c0f',
  'Employment': '#a16207',
  'Criminal defense': '#b91c1c',
  'Business law': '#1d4ed8',
  'Real estate': '#be185d',
}
const SPARE = Object.values(COLORS).concat('#475569')
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
export const practiceColor = (area: string) => COLORS[area] ?? SPARE[hash(area) % SPARE.length]

export function PracticeTag({ area }: { area: string }) {
  return <span className="chip chip--practice" style={{ background: practiceColor(area) }}>{area}</span>
}
