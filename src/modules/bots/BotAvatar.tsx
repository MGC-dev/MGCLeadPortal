import type { Bot } from '../../api/types'

/** One outline colour per bot, always the same for the same bot. */
const COLORS = ['#f97316', '#2563eb', '#7c3aed', '#059669', '#db2777', '#d97706', '#475569', '#e11d48']
const hash = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
export const botColor = (b: Pick<Bot, 'id'>) => COLORS[(hash(b.id) * 3) % COLORS.length]

/** The bot's face: a white robot with only its outline in colour. */
export function BotAvatar({ bot, size = 48 }: { bot: Pick<Bot, 'id'>; size?: number }) {
  const c = botColor(bot)
  return (
    <svg className="botav" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <g fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 14 L50 28" />
        <circle cx="50" cy="12" r="6" fill="#fff" />
        <rect x="7" y="48" width="9" height="22" rx="4" fill="#fff" />
        <rect x="84" y="48" width="9" height="22" rx="4" fill="#fff" />
        <rect x="13" y="28" width="74" height="64" rx="24" fill="#fff" />
        <rect x="24" y="44" width="52" height="30" rx="15" />
        <path d="M42 83 L58 83" />
      </g>
      <g fill={c}><circle cx="39" cy="59" r="5.5" /><circle cx="61" cy="59" r="5.5" /></g>
    </svg>
  )
}
