import { DAY, HOUR } from '../api/mockData'

export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
export const ago = (t: number) => {
  const d = Date.now() - t
  if (d < 60e3) return 'Just now'
  if (d < HOUR) return Math.round(d / 60e3) + ' min ago'
  if (d < DAY) return Math.round(d / HOUR) + ' hr ago'
  return Math.round(d / DAY) + ' days ago'
}
export const when = (t: number) => {
  const d = new Date(t), today = new Date()
  const s = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return 'Today, ' + s
  if (d.toDateString() === new Date(today.getTime() + DAY).toDateString()) return 'Tomorrow, ' + s
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + s
}
export const timeOf = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
export const first = (n: string) => n.split(' ')[0]
export const initials = (n: string) => n.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
export const lower1 = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
export const dayAt = (d: number, hh = 0, mm = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(hh, mm, 0, 0); return +x }
export const endOfToday = () => { const x = new Date(); x.setHours(23, 59, 59, 999); return +x }
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }
