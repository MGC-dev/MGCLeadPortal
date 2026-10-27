import { useState } from 'react'
import { reports } from '../api'
import { useQuery } from '../hooks'
import { Card, PageHeader, Select, Stat, Table, Td } from '../components/ui'
import { money, pct } from '../format'

type Row = { name: string; leads: number; retained: number; lost: number; pipeline: number }

function BarList({ rows, fmt = String }: { rows: { label: string; value: number }[]; fmt?: (n: number) => string }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-44 shrink-0 truncate text-slate-600">{r.label}</span>
          <div className="h-5 flex-1 rounded bg-slate-100"><div className="h-5 rounded bg-brand-500" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0 }} /></div>
          <span className="w-20 text-right font-medium text-slate-700">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

function Breakdown({ title, rows, label }: { title: string; rows: Row[]; label: string }) {
  return (
    <Card>
      <h2 className="px-5 pt-4 font-semibold text-slate-900">{title}</h2>
      <Table head={[label, 'Leads', 'Retained', 'Lost', 'Conversion', 'Open pipeline']} empty={rows.length ? undefined : 'No data'}>
        {rows.map(r => (
          <tr key={r.name}>
            <Td className="font-medium text-slate-900">{r.name}</Td><Td>{r.leads}</Td><Td>{r.retained}</Td><Td>{r.lost}</Td>
            <Td>{pct(r.retained, r.retained + r.lost)}</Td><Td>{money(r.pipeline)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}

export default function Reports() {
  const [days, setDays] = useState(0)
  const r = useQuery(() => reports.summary(days), [days])
  if (!r) return null
  const t = r.totals

  return (
    <>
      <PageHeader title="Reports" subtitle="Where leads come from, what converts, and what it earns"
        actions={<Select value={days} onChange={e => setDays(Number(e.target.value))} className="!w-44">
          <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option><option value={0}>All time</option>
        </Select>} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="New leads" value={t.leads} />
        <Stat label="Retained" value={t.retained} hint={`${t.lost} lost`} />
        <Stat label="Conversion" value={`${t.conversion}%`} hint="Retained of closed" />
        <Stat label="Days to retain" value={t.avgDaysToRetain || '—'} hint="Lead created → client" />
        <Stat label="Open pipeline" value={money(t.pipeline)} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Pipeline by stage</h2>
          <BarList rows={r.stages.map(s => ({ label: s.label, value: s.count }))} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Revenue collected · last 6 months</h2>
          <BarList rows={r.revenueByMonth.map(m => ({ label: m.label, value: m.amount }))} fmt={money} />
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm">
            <div><p className="text-xs text-slate-500">Collected</p><p className="font-semibold">{money(r.money.collected)}</p></div>
            <div><p className="text-xs text-slate-500">Outstanding</p><p className="font-semibold">{money(r.money.outstanding)}</p></div>
            <div><p className="text-xs text-slate-500">Overdue</p><p className="font-semibold text-red-600">{money(r.money.overdue)}</p></div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Breakdown title="Lead sources" label="Source" rows={r.bySource} />
        <Breakdown title="Services" label="Service" rows={r.byService} />
        <Breakdown title="Practice areas" label="Practice area" rows={r.byArea} />
        <Breakdown title="Team" label="Attorney" rows={r.byAttorney} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Revenue by practice area</h2>
            <BarList rows={r.revenueByArea.map(a => ({ label: a.name, value: a.amount }))} fmt={money} />
          </Card>
          <Card>
            <h2 className="px-5 pt-4 font-semibold text-slate-900">Marketing campaigns</h2>
            <Table head={['Campaign', 'Enrolled', 'Open', 'Reply', 'Converted']} empty={r.campaigns.length ? undefined : 'No campaign activity'}>
              {r.campaigns.map(c => (
                <tr key={c.name}><Td className="font-medium text-slate-900">{c.name}</Td><Td>{c.enrolled}</Td><Td>{pct(c.opened, c.sent)}</Td><Td>{pct(c.replied, c.sent)}</Td><Td>{c.converted}</Td></tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </>
  )
}
