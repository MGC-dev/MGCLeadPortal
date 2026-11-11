import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { firmApi, leadsApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import type { Lead } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Tag, usePhone } from '../../shared/ui'
import { tourStore, useTour } from './tourStore'

const IDX = Object.fromEntries(config.stages.map((s, i) => [s.id, i]))
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Step { title: string; body: string; go: string; done: (c: Ctx) => boolean; run: (c: Ctx) => Promise<void> | void }
interface Ctx { lead?: Lead; firmReady: boolean; pathname: string; navigate: (p: string) => void; ui: ReturnType<typeof useUi> }

/** Fresh lead helper: the tour creates one enquiry and walks it through the pipeline. */
async function tourLead(): Promise<Lead> {
  const cur = tourStore.get().leadId ? await leadsApi.get(tourStore.get().leadId!) : undefined
  if (cur) return cur
  const l = await leadsApi.create('web')
  tourStore.set({ leadId: l.id })
  return l
}
const reached = (c: Ctx, n: number) => !!c.lead && c.lead.stage !== 'lost' && IDX[c.lead.stage] >= n

const STEPS: Step[] = [
  { title: 'Onboard the Firm', body: 'Each firm sends from its own domain and number. Verify the email domain, then register texting with US carriers.', go: 'Do It for Me', done: c => c.firmReady,
    run: async c => { c.navigate('/settings'); const f = await firmApi.get(); if (f.domainStatus !== 'verified') { await firmApi.verifyDomain(); await wait(1700) } if (f.textStatus !== 'registered') { await firmApi.submitTexting(); await wait(900); await firmApi.approveTexting() } } },
  { title: 'An Enquiry Arrives', body: 'A visitor fills in the website form. The lead is created, assigned, and gets an instant text reply from the firm’s number.', go: 'Send an Enquiry', done: c => !!c.lead,
    run: async c => { c.navigate('/pipeline'); const l = await leadsApi.create('web'); tourStore.set({ leadId: l.id }); setTimeout(() => c.ui.openLead(l.id), 700) } },
  { title: 'The Team Works It', body: 'The owner calls, then books a consultation. Each stage books its next step, and the reminder goes out by text and email.', go: 'Call and Book', done: c => reached(c, 2),
    run: async c => { const l = await tourLead(); c.ui.openLead(l.id); if (l.stage === 'new') { await leadsApi.logCall(l.id); await wait(900) } await leadsApi.setStage(l.id, 'consult') } },
  { title: 'The Contract Goes Out', body: 'After attorney review, the engagement letter is sent by email and text link. The lead moves to Contract Sent.', go: 'Send the Letter', done: c => reached(c, 3),
    run: async c => { const l = await tourLead(); if (IDX[l.stage] < 2) await leadsApi.setStage(l.id, 'consult'); await leadsApi.sendContract(l.id); c.ui.openLead(l.id) } },
  { title: 'The Client Signs', body: 'This is the client’s side. They tap the link and sign on their phone. The stage updates by itself, nobody moves the card.', go: 'Show the Client’s View', done: c => c.lead?.doc?.status === 'signed',
    run: async c => { let l = await tourLead(); if (!l.doc) { await leadsApi.sendContract(l.id); l = await tourLead() } c.ui.openLead(l.id); c.ui.openModal({ type: 'client', id: l.id }) } },
  { title: 'Services Provided', body: 'The retainer is requested and collected, the work is delivered and the matter is closed. Any lead can also be marked as lost, with a reason.', go: 'Close the Matter', done: c => c.lead?.stage === 'delivered',
    run: async c => { let l = await tourLead(); if (l.doc?.status !== 'signed') { if (!l.doc) await leadsApi.sendContract(l.id); await leadsApi.sign(l.id, l.name); l = await tourLead() } await leadsApi.setStage(l.id, 'payment'); await wait(800); await leadsApi.setStage(l.id, 'delivered'); c.ui.openModal(null); c.ui.openLead(l.id) } },
  { title: 'Prove What Converts', body: 'Reports update as you work: leads by source, what signed, and why leads were lost.', go: 'Open Reports', done: c => c.pathname === '/reports',
    run: c => { c.ui.closeAll(); c.navigate('/reports') } },
]

/** Floating, dismissible product tour that drives the real app through the lead journey. */
export function Tour() {
  const t = useTour()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const ui = useUi()
  const phone = usePhone()
  const [busy, setBusy] = useState(false)
  const leads = useQuery(() => leadsApi.list())
  const firm = useQuery(() => firmApi.get())
  if (!leads || !firm) return null
  if (t.dismissed || (t.min && phone && (ui.open || ui.modal))) return null

  const ctx: Ctx = { lead: leads.find(l => l.id === t.leadId), firmReady: firm.domainStatus === 'verified' && firm.textStatus === 'registered', pathname, navigate, ui }
  const st = STEPS[t.step]
  const done = st.done(ctx)
  const last = t.step === STEPS.length - 1
  return (
    <section className={'tour' + (t.min ? ' is-min' : '')} aria-label="Guided tour">
      <div className="tour__head"><b>Guided Tour, Step {t.step + 1} of {STEPS.length}</b>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <button className="btn btn--plain btn--sm" type="button" onClick={() => tourStore.set({ min: !t.min })} aria-expanded={!t.min}>{t.min ? 'Show' : 'Hide'}</button>
          <button className="closebtn" type="button" onClick={() => tourStore.set({ dismissed: true })} aria-label="Close tour"><Icon name="x" /></button>
        </div></div>
      <div className="tour__body">
        <div className="tour__dots" aria-hidden="true">{STEPS.map((s, k) => <span key={k} className={k === t.step ? 'now' : s.done(ctx) ? 'done' : ''} />)}</div>
        <p className="tour__title">{st.title}{done && <> <span style={{ verticalAlign: 'middle' }}><Tag tone="green" icon="check">Done</Tag></span></>}</p>
        <p className="footnote">{st.body}</p>
        <div className="tour__nav">
          <button className="btn btn--sm" type="button" disabled={t.step === 0} onClick={() => { ui.openModal(null); tourStore.set({ step: Math.max(0, t.step - 1) }) }}>Back</button>
          {done && !last ? <button key="next" className="btn btn--prominent btn--sm" type="button" onClick={() => { ui.openModal(null); tourStore.set({ step: t.step + 1 }) }}>Next Step</button>
            : last && done ? <button key="again" className="btn btn--sm" type="button" onClick={async () => { const { systemApi } = await import('../../api'); tourStore.set({ leadId: null, step: 0 }); await systemApi.reset() }}>Start Over</button>
              : <button key="run" className="btn btn--prominent btn--sm" type="button" disabled={busy} onClick={async () => { setBusy(true); try { await st.run(ctx) } finally { setBusy(false) } }}>{st.go}</button>}
        </div>
      </div>
    </section>
  )
}
