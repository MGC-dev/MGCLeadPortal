import { useRef, useState } from 'react'
import { campaignsApi, useQuery } from '../../api'
import type { AudienceKey, CampaignChannel } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Select } from '../../shared/Select'
import { Field, Sheet } from '../../shared/ui'
import { toast } from '../../shared/toast'
import { AUDIENCES, TRIGGERS, fillIn, useFirm } from './campaignUtils'

/** New campaign dialog with a live preview of the text or email, as the recipient will see it. */
export function CampaignBuilder({ kind: initialKind }: { kind: 'auto' | 'broadcast' }) {
  const { openModal } = useUi()
  const firm = useFirm()
  const [kind, setKind] = useState(initialKind)
  const [name, setName] = useState(initialKind === 'auto' ? 'Lost Lead Check-In' : 'Free Consultation Week')
  const [audience, setAudience] = useState<AudienceKey>('open')
  const [trigger, setTrigger] = useState('A lead is marked as lost')
  const [channel, setChannel] = useState<CampaignChannel>('Text')
  const [subject, setSubject] = useState('A free 20-minute consultation, {first}')
  const [body, setBody] = useState(initialKind === 'auto'
    ? 'Hi {first}, we are sorry we could not help with your {matter} this time. If anything changes, we are here. {firm}'
    : 'Hi {first}, this week {firm} is offering free 20-minute consultations. Reply YES and we will call you to book a time.')
  const ta = useRef<HTMLTextAreaElement>(null)
  const aud = useQuery(() => campaignsApi.audience(audience), [audience])
  const counts = useQuery(async () => {
    const out = {} as Record<AudienceKey, number>
    for (const k of Object.keys(AUDIENCES) as AudienceKey[]) out[k] = (await campaignsApi.audience(k)).total
    return out
  })
  const close = () => openModal(null)
  const auto = kind === 'auto'
  const isText = /Text/.test(channel), isEmail = /Email/.test(channel)
  const people = auto ? 0 : (aud?.total ?? 0) - (aud?.optedOut ?? 0)
  const sample = aud?.sample
  const firmName = firm?.name ?? ''
  const text = fillIn(body, sample, firmName)
  const stop = isText && !/\bSTOP\b/i.test(body) ? ' Reply STOP to opt out.' : ''
  const segs = Math.max(1, Math.ceil((text + stop).length / 160))

  const merge = (field: string) => {
    const el = ta.current
    if (!el) return setBody(b => b.replace(/\s*$/, ' ') + field)
    const s = el.selectionStart ?? body.length, e = el.selectionEnd ?? body.length
    setBody(body.slice(0, s) + field + body.slice(e))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + field.length, s + field.length) })
  }

  return (
    <Sheet title="New Campaign" sub="Messages go out from your firm’s own domain and number." wide onClose={close}
      onSubmit={async e => {
        e.preventDefault()
        if (!name.trim() || !body.trim()) return
        const c = await campaignsApi.create({ kind, name: name.trim(), channel, subject: isEmail ? subject : '', body, audience, trigger })
        if (auto) close(); else openModal({ type: 'camp', id: c.id })
      }}
      foot={
        <div className="sheet__foot">
          <button className="btn" type="button" onClick={close}>Cancel</button>
          <button className="btn" type="button" onClick={() => toast('Test sent to you', [isText ? 'Text to your phone' : null, isEmail ? `email to sarah@${firm?.domain}` : null].filter(Boolean).join(' and '))}>Send Test to Me</button>
          <button className="btn btn--prominent" type="submit" disabled={!auto && people === 0}>
            {auto ? 'Turn On' : `Send to ${people} ${people === 1 ? 'Person' : 'People'}`}
          </button>
        </div>
      }>
      <div className="camp-builder">
        <div className="camp-builder__form">
          <div className="formgroup">
            <Field label="Name" id="nc-name"><input id="nc-name" required autoComplete="off" value={name} onChange={e => setName(e.target.value)} /></Field>
            <Field label="Type" id="nc-kind">
              <Select id="nc-kind" value={kind} onChange={v => setKind(v as 'auto' | 'broadcast')} options={[{ value: 'broadcast', label: 'One-off send, now' }, { value: 'auto', label: 'Automatic, when something happens' }]} />
            </Field>
            {!auto && (
              <Field label="Send To" id="nc-aud">
                <Select id="nc-aud" value={audience} onChange={v => setAudience(v as AudienceKey)} options={(Object.entries(AUDIENCES) as [AudienceKey, { label: string }][]).map(([v, a]) => ({ value: v, label: `${a.label} (${counts?.[v] ?? 0})` }))} />
              </Field>
            )}
            {auto && (
              <Field label="When" id="nc-trig">
                <Select id="nc-trig" value={trigger} onChange={setTrigger} options={TRIGGERS.map(t => ({ value: t, label: t }))} />
              </Field>
            )}
            <Field label="Channel" id="nc-chan">
              <Select id="nc-chan" value={channel} onChange={v => setChannel(v as CampaignChannel)} options={[{ value: 'Email', label: 'Email' }, { value: 'Text', label: 'Text' }, { value: 'Text and Email', label: 'Text and email' }]} />
            </Field>
          </div>
          {!auto && <p className="hint">{people} {people === 1 ? 'person' : 'people'}{aud?.optedOut ? `, ${aud.optedOut} opted out and skipped` : ''}</p>}
          <div className="formgroup">
            {isEmail && <Field label="Email Subject" id="nc-subj" stack><input id="nc-subj" value={subject} onChange={e => setSubject(e.target.value)} /></Field>}
            <Field label="Message" id="nc-body" stack><textarea id="nc-body" ref={ta} rows={5} value={body} onChange={e => setBody(e.target.value)} /></Field>
          </div>
          <div className="merge">
            <span className="caption">Insert</span>
            <button type="button" className="btn btn--sm" onClick={() => merge('{first}')}>First Name</button>
            <button type="button" className="btn btn--sm" onClick={() => merge('{matter}')}>Matter</button>
            <button type="button" className="btn btn--sm" onClick={() => merge('{firm}')}>Firm Name</button>
          </div>
        </div>
        <div className="camp-builder__preview" aria-live="polite">
          <p className="caption">Preview for {sample?.name}</p>
          {isText && (
            <div className="phone">
              <span className="caption">{firm?.number}</span>
              <p className="bubble">{text + stop}</p>
              <span className="caption">{(text + stop).length} characters · {segs} {segs === 1 ? 'text' : 'texts'}{stop ? ' · opt-out line added for you' : ''}</span>
            </div>
          )}
          {isEmail && (
            <div className="mail">
              <span className="caption">From intake@{firm?.domain}</span>
              <b>{fillIn(subject || '(No subject)', sample, firmName)}</b>
              <p>{text}</p>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}
