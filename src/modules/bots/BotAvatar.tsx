import type { Bot } from '../../api/types'

/** One colour per agent, always the same for the same agent. */
const COLORS = ['#f97316', '#2563eb', '#7c3aed', '#059669', '#db2777', '#d97706', '#475569', '#e11d48']
const hash = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
export const botColor = (b: Pick<Bot, 'id'>) => COLORS[(hash(b.id) * 3) % COLORS.length]

/** The agent's face: a white robot on a circle of its colour, lit from the top like an app icon. */
export function BotAvatar({ bot, size = 48, muted }: { bot: Pick<Bot, 'id'>; size?: number; muted?: boolean }) {
  const c = muted ? '#8e8e93' : botColor(bot)
  const g = `botav-${bot.id}-${muted ? 'm' : 'c'}`
  return (
    <svg className="botav shrink-0" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.72" />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${g})`} />
      <g fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 22 L50 31" />
        <rect x="24" y="32" width="52" height="44" rx="17" />
        <path d="M44 66 L56 66" />
      </g>
      <g fill="#fff"><circle cx="50" cy="19" r="4.5" /><circle cx="41" cy="52" r="5" /><circle cx="59" cy="52" r="5" /><rect x="17" y="46" width="6" height="14" rx="3" /><rect x="77" y="46" width="6" height="14" rx="3" /></g>
    </svg>
  )
}
