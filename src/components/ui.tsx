import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export function Button({ variant = 'primary', size = 'md', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md' }) {
  const v = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant]
  const s = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 ${v} ${s} ${className}`} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  )
}

const tones: Record<string, string> = {
  gray: 'bg-slate-100 text-slate-700', blue: 'bg-blue-100 text-blue-700', green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-700', purple: 'bg-violet-100 text-violet-700',
}
export function Badge({ tone = 'gray', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tones[tone]}`}>{children}</span>
}

const statusTone: Record<string, keyof typeof tones> = {
  new: 'blue', contacted: 'purple', consultation: 'amber', proposal: 'amber', retained: 'green', lost: 'gray',
  draft: 'gray', sent: 'blue', viewed: 'amber', signed: 'green', declined: 'red',
  paid: 'green', overdue: 'red', active: 'green', paused: 'amber', open: 'green', pending: 'amber', closed: 'gray',
}
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={statusTone[status] ?? 'gray'}>{status}</Badge>

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
export const Label = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>{children}</label>
)
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${field} ${p.className ?? ''}`} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={`${field} ${p.className ?? ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${field} ${p.className ?? ''}`} />

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`w-full rounded-xl bg-white shadow-xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          {head.map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-100 [&>tr:hover]:bg-slate-50">{children}</tbody>
      </table>
      {empty && <p className="p-8 text-center text-sm text-slate-400">{empty}</p>}
    </div>
  )
}
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => <td className={`px-4 py-3 ${className}`}>{children}</td>

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'red' }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === 'red' ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${value === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{t.label}</button>
      ))}
    </div>
  )
}
