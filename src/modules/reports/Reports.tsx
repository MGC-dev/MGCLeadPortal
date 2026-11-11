import { campaignsApi, leadsApi, useQuery } from '../../api'
import type { Lead } from '../../api/types'
import { money } from '../../shared/format'
import { SOURCES, STAGES, isWon } from '../lead/selectors'
import { InfoTip } from '../../shared/InfoTip'

const Bar = ({ label, n, max, tone }: { label: string; n: number; max: number; tone?: 'green' | 'red' }) => (
  <div className="bar"><span>{label}</span><div className="bar__track"><div className={'bar__fill' + (tone ? ' ' + tone : '')} style={{ transform: `scaleX(${n / max})` }} /></div><b>{n}</b></div>
)

export default function Reports() {
  const leads = useQuery(() => leadsApi.list())
  const camps = useQuery(() => campaignsApi.list())
  if (!leads || !camps) return null

  const bySource: Record<string, Lead[]> = {}
  leads.forEach(l => { (bySource[l.source] ||= []).push(l) })
  const entries = Object.entries(bySource).sort((a, b) => b[1].length - a[1].length)
  const maxN = Math.max(1, ...entries.map(e => e[1].length))
  const conv = (ls: Lead[]) => { const won = ls.filter(isWon).length, closed = ls.filter(l => isWon(l) || l.stage === 'lost').length; return { won, pct: closed ? Math.round(won / closed * 100) : null } }

  const stageMax = Math.max(1, ...STAGES.map(s => leads.filter(l => l.stage === s.id).length))
  const reasons: Record<string, number> = {}
  leads.filter(l => l.stage === 'lost').forEach(l => { const r = l.lostReason ?? 'No reason given'; reasons[r] = (reasons[r] || 0) + 1 })
  const rmax = Math.max(1, ...Object.values(reasons))
  const auto = leads.reduce((a, l) => a + l.activities.filter(x => x.cls === 'auto').length, 0)

  return (
    <>
      <div className="summary">
        <div className="tile"><span>Leads</span><b>{leads.length}</b></div>
        <div className="tile"><span>Signed Value</span><b>{money(leads.filter(isWon).reduce((a, l) => a + l.value, 0))}</b></div>
        <div className="tile"><span>Lost</span><b>{leads.filter(l => l.stage === 'lost').length}</b></div>
        <div className="tile"><span>Automatic Actions</span><b>{auto}</b></div>
        <div className="tile"><span>Campaign Messages</span><b>{camps.reduce((a, c) => a + c.sent, 0)}</b></div>
      </div>
      <section className="group">
        <div className="group__head"><div className="titlerow"><h2>What Converts by Source</h2><InfoTip text="Of the leads that were closed (signed or lost), the share that signed." label="About conversion" /></div></div>
        <div className="table-wrap only-desk"><table style={{ minWidth: 600 }}>
          <thead><tr><th>Source</th><th>Leads</th><th>Signed</th><th>Lost</th><th>Conversion</th><th style={{ width: '30%' }}>Share of Leads</th></tr></thead>
          <tbody>{entries.map(([k, ls]) => { const c = conv(ls); return (
            <tr key={k}><td><b>{SOURCES[k as keyof typeof SOURCES]}</b></td><td className="num">{ls.length}</td><td className="num">{c.won}</td>
              <td className="num">{ls.filter(l => l.stage === 'lost').length}</td><td className="num">{c.pct === null ? '–' : c.pct + '%'}</td>
              <td><div className="bar__track" style={{ minWidth: 80 }}><div className="bar__fill" style={{ transform: `scaleX(${ls.length / maxN})` }} /></div></td></tr>
          ) })}</tbody>
        </table></div>
        <div className="group__body bars only-phone">{entries.map(([k, ls]) => { const c = conv(ls); return (
          <div key={k} style={{ display: 'grid', gap: 4 }}><Bar label={SOURCES[k as keyof typeof SOURCES]} n={ls.length} max={maxN} />
            <p className="caption">{c.won} signed, {c.pct === null ? 'none closed yet' : c.pct + '% of closed'}</p></div>
        ) })}</div>
      </section>
      <div className="grid2">
        <section className="group"><div className="group__head"><h2>Leads by Stage</h2></div>
          <div className="group__body bars">{STAGES.map((s, i) => <Bar key={s.id} label={s.label} n={leads.filter(l => l.stage === s.id).length} max={stageMax} tone={i >= 4 ? 'green' : undefined} />)}</div></section>
        <section className="group"><div className="group__head"><h2>Why Leads Are Lost</h2></div>
          <div className="group__body bars">{Object.keys(reasons).length ? Object.entries(reasons).map(([r, n]) => <Bar key={r} label={r} n={n} max={rmax} tone="red" />) : <p className="footnote">No lost leads yet.</p>}</div></section>
      </div>
    </>
  )
}
