import { Link } from 'react-router-dom'
import { activity, agenda as agendaApi, dashboard, invoices } from '../api'
import { AgendaRow } from '../components/contacts'
import { useQuery } from '../hooks'
import { Card, PageHeader, Stat, StatusBadge } from '../components/ui'
import { ago, dayDiff, money } from '../format'

export default function Dashboard() {
  const s = useQuery(() => dashboard.stats())
  const acts = useQuery(() => activity.recent(8))
  const invs = useQuery(() => invoices.list())
  const items = useQuery(() => agendaApi.list())
  const todays = (items ?? []).filter(a => !a.done && dayDiff(a.dueAt) <= 0)
  if (!s) return null
  const max = Math.max(...s.funnel.map(f => f.count), 1)
  const attention = (invs ?? []).filter(i => i.status === 'overdue')

  return (
    <>
      <PageHeader title="Dashboard" subtitle="From first inquiry to paying client" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open leads" value={s.openLeads} hint={`${money(s.pipelineValue)} pipeline value`} />
        <Stat label="Conversion rate" value={`${s.conversionRate}%`} hint="Retained vs. closed leads" />
        <Stat label="Active clients" value={s.activeClients} />
        <Stat label="Awaiting signature" value={s.awaitingSignature} hint="Documents out for e-sign" />
        <Stat label="Collected" value={money(s.collected)} />
        <Stat label="Outstanding" value={money(s.outstanding)} />
        <Stat label="Overdue invoices" value={s.overdueCount} tone={s.overdueCount ? 'red' : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Lead funnel</h2>
          <div className="space-y-3">
            {s.funnel.map(f => (
              <div key={f.label} className="flex items-center gap-3 text-sm">
                <span className="w-52 shrink-0 text-slate-600">{f.label}</span>
                <div className="h-6 flex-1 rounded bg-slate-100">
                  <div className="h-6 rounded bg-brand-500 px-2 text-xs leading-6 text-white" style={{ width: `${Math.max((f.count / max) * 100, 8)}%` }}>{f.count}</div>
                </div>
              </div>
            ))}
          </div>
          {attention.length > 0 && (
            <div className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <strong>Needs attention:</strong> {attention.map(i => i.number).join(', ')} overdue.{' '}
              <Link to="/payments" className="underline">Review payments</Link>
            </div>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-1">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Today & overdue</h2><Link to="/agenda" className="text-xs text-brand-600 hover:underline">Open agenda →</Link></div>
          {todays.length ? todays.slice(0, 6).map(a => <AgendaRow key={a.id} item={a} />) : <p className="text-sm text-slate-400">All clear for today.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Recent activity</h2>
          <ul className="space-y-3">
            {acts?.map(a => (
              <li key={a.id} className="text-sm">
                <p className="text-slate-700">{a.text}</p>
                <p className="text-xs text-slate-400">{ago(a.at)} · <StatusBadge status={a.entityType} /></p>
              </li>
            ))}
          </ul>
        </Card>
        </div>
      </div>
    </>
  )
}
