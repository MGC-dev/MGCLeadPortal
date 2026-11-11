import { useState } from 'react'
import { leadsApi, firmApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import type { Lead, SourceId } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Field, Sheet, SheetFoot } from '../../shared/ui'
import { Select } from '../../shared/Select'
import { SRC_ICON } from './selectors'
import { first, money } from '../../shared/format'

const data = (e: React.FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>

/** Add Enquiry: pick where it came from, then who they are and what they need. */
export function IntakeModal() {
  const { openModal, openLead } = useUi()
  const [source, setSource] = useState<SourceId>('web')
  const [practice, setPractice] = useState<string>(config.practiceAreas[0])
  const close = () => openModal(null)
  return (
    <Sheet className="enq" wide title="New enquiry" sub="Log who got in touch and where it came from." onClose={close}
      icon={<Icon name="plus" />}
      foot={
        <div className="enq__foot">
          <button className="btn" type="button" onClick={close}>Cancel</button>
          <button className="btn btn--prominent" type="submit"><Icon name="plus" small />Add enquiry</button>
        </div>
      }
      onSubmit={async e => {
        e.preventDefault()
        const d = data(e)
        if (!d.name.trim()) return
        const l = await leadsApi.create(source, { name: d.name.trim(), phone: d.phone, practice: d.practice, matter: d.matter || d.practice, note: d.note })
        openModal(null); openLead(l.id)
      }}>
      <fieldset className="enq__section">
        <legend>Who is it?</legend>
        <div className="enq__grid">
          <label className="enq__field"><span>Full name</span><input id="qi-name" name="name" required autoFocus autoComplete="off" placeholder="e.g. Priya Shah" /></label>
          <label className="enq__field"><span>Phone</span><input id="qi-phone" name="phone" type="tel" inputMode="tel" placeholder="(555) 014-2290" /></label>
        </div>
      </fieldset>

      <fieldset className="enq__section">
        <legend>What do they need?</legend>
        <div className="enq__grid">
          <div className="enq__field"><label htmlFor="qi-practice">Practice area</label>
            <Select id="qi-practice" name="practice" value={practice} onChange={setPractice} options={config.practiceAreas.map(p => ({ value: p, label: p }))} /></div>
          <label className="enq__field"><span>Matter</span><input id="qi-matter" name="matter" autoComplete="off" placeholder="e.g. Child support review" /></label>
          <div className="enq__field enq__field--wide"><label htmlFor="qi-source">Source</label>
            <Select id="qi-source" name="source" value={source} onChange={v => setSource(v as SourceId)}
              options={(Object.entries(config.sources) as [SourceId, string][]).map(([k, label]) => ({ value: k, label, icon: SRC_ICON[k] }))} /></div>
          <label className="enq__field enq__field--wide"><span>Notes <em>optional</em></span>
            <textarea id="qi-note" name="note" rows={3} placeholder="What did they say? Anything the attorney should know before calling back?" /></label>
        </div>
      </fieldset>
    </Sheet>
  )
}

export function ComposeModal({ lead: l }: { lead: Lead }) {
  const { openModal } = useUi()
  const firm = useQuery(() => firmApi.get())
  const close = () => openModal(null)
  return (
    <Sheet title={`Text ${first(l.name)}`} sub={`From ${firm?.number ?? ''}`} onClose={close} foot={<SheetFoot onCancel={close} primary="Send Text" />}
      onSubmit={async e => { e.preventDefault(); await leadsApi.sendText(l.id, data(e).body); openModal(null) }}>
      {firm && firm.textStatus !== 'registered' && <p className="hint hint--warn">Your texting number is not registered yet, so this text will be held.</p>}
      <div className="formgroup">
        <Field label="Message" id="tx" stack>
          <textarea id="tx" name="body" autoFocus defaultValue={`Hi ${first(l.name)}, this is ${first(l.owner)} from Example Family Law. Is now a good time for a quick call about your ${l.matter.toLowerCase()}?`} />
        </Field>
      </div>
    </Sheet>
  )
}

export function ReminderModal({ lead: l }: { lead: Lead }) {
  const { openModal } = useUi()
  const [when, setWhen] = useState('24')
  const close = () => openModal(null)
  return (
    <Sheet title="Add Reminder" sub={`It appears on ${first(l.owner)}’s task list.`} onClose={close} foot={<SheetFoot onCancel={close} primary="Add Reminder" />}
      onSubmit={async e => { e.preventDefault(); const d = data(e); await leadsApi.addReminder(l.id, d.title, +d.when); openModal(null) }}>
      <div className="formgroup">
        <Field label="Reminder" id="rm-t"><input id="rm-t" name="title" autoFocus defaultValue={`Follow up with ${first(l.name)}`} /></Field>
        <Field label="When" id="rm-w">
          <Select id="rm-w" name="when" value={when} onChange={setWhen} options={[{ value: '3', label: 'In 3 hours' }, { value: '24', label: 'Tomorrow' }, { value: '72', label: 'In 3 days' }]} />
        </Field>
      </div>
    </Sheet>
  )
}

export function LostModal({ lead: l }: { lead: Lead }) {
  const { openModal } = useUi()
  const [reason, setReason] = useState<string>(config.lostReasons[0])
  const close = () => openModal(null)
  return (
    <Sheet title={`Mark ${first(l.name)} as Lost`} sub="The reason is kept, so reports can show why leads are lost." onClose={close} foot={<SheetFoot onCancel={close} primary="Mark as Lost" danger />}
      onSubmit={async e => { e.preventDefault(); await leadsApi.markLost(l.id, data(e).reason); openModal(null) }}>
      <div className="formgroup">
        <Field label="Reason" id="lr"><Select id="lr" name="reason" value={reason} onChange={setReason} options={config.lostReasons.map(r => ({ value: r, label: r }))} /></Field>
      </div>
      <p className="hint">You can reopen the lead later.</p>
    </Sheet>
  )
}

/** What the client sees: the text with the signing link, and the letter to sign. */
export function ClientSignModal({ lead: l }: { lead: Lead }) {
  const { openModal } = useUi()
  const firm = useQuery(() => firmApi.get())
  const close = () => openModal(null)
  const signed = l.doc?.status === 'signed'
  return (
    <Sheet title={`What ${first(l.name)} Sees`} sub="A text with a link, then the letter to sign on any device." wide onClose={close}
      onSubmit={async e => { e.preventDefault(); const sig = (data(e).sig || '').trim(); if (!sig) return; await leadsApi.sign(l.id, sig) }}
      foot={
        <div className="sheet__foot">
          {signed
            ? <button className="btn btn--prominent" type="button" onClick={close}>Done</button>
            : <><button className="btn" type="button" onClick={close}>Not Now</button><button className="btn btn--prominent" type="submit">Sign as {first(l.name)}</button></>}
        </div>
      }>
      <div className="client">
        <div className="messages">
          <p className="messages__from"><b>Example Family Law</b>Text Message, Today</p>
          <p className="bubble">Hi {first(l.name)}, your engagement letter from Example Family Law is ready to sign: <a href="#" onClick={e => e.preventDefault()}>sign.example.com/{l.id}</a></p>
          {signed && <p className="bubble bubble--out">Signed, thank you!</p>}
          <p className="caption" style={{ textAlign: 'center' }}>Also sent by email from intake@{firm?.domain}</p>
        </div>
        <div className="letter">
          <span className="caption">Example Family Law LLP</span>
          <h3>{l.doc?.items?.[0]?.name ?? 'Engagement Letter'}</h3>
          <p>This letter confirms that Example Family Law LLP will represent {l.name} in the matter of {l.matter.toLowerCase()}. The estimated fee is {money(l.value)}, billed as described in the attached fee schedule.</p>
          {(l.doc?.items?.length ?? 0) > 1 && <p className="caption">Signing covers {l.doc!.items!.length} documents: {l.doc!.items!.map(i => i.name).join(', ')}.</p>}
          {signed
            ? <span className="signed"><Icon name="check" />Signed by {l.doc?.by}</span>
            : <div className="sig"><label htmlFor="sig" className="footnote">Type your full name to sign</label><input id="sig" name="sig" autoComplete="off" required autoFocus defaultValue={l.name} /></div>}
        </div>
      </div>
    </Sheet>
  )
}
