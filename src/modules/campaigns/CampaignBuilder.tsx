import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { campaignsApi, servicesApi, useQuery } from '../../api'
import type { AudienceKey, CampaignChannel, CampaignTag, SurveyMetric } from '../../api/types'
import { surveyBody } from '../../api/mockData'
import { useUi } from '../../app/UiContext'
import { Select } from '../../shared/Select'
import { Sheet } from '../../shared/ui'
import { toast } from '../../shared/toast'
import { Icon } from '../../shared/Icon'
import { InputsPicker } from './InputsPicker'
import { AUDIENCES, TRIGGERS, fillIn, insertTag, useFirm } from './campaignUtils'

/** New campaign dialog with a live preview of the text or email, as the recipient will see it. */
export function CampaignBuilder({ kind: initialKind }: { kind: 'auto' | 'broadcast' | 'survey' }) {
  const { openModal } = useUi()
  const firm = useFirm()
  const catalog = useQuery(() => servicesApi.list())
  const navigate = useNavigate()
  const [kind, setKind] = useState(initialKind)
  const [metric, setMetric] = useState<SurveyMetric>('nps')
  const [tags, setTags] = useState<CampaignTag[]>([])
  const [name, setName] = useState(initialKind === 'auto' ? 'Lost Lead Check-In' : 'Free Consultation Week')
  const [audience, setAudience] = useState<AudienceKey>('open')
  const [trigger, setTrigger] = useState('A ticket moves to Lost')
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
  const auto = kind === 'auto', survey = kind === 'survey'
  const isText = /Text/.test(channel), isEmail = /Email/.test(channel)
  const people = auto ? 0 : (aud?.total ?? 0) - (aud?.optedOut ?? 0)
  const sample = aud?.sample
  const firmName = firm?.name ?? ''
  const svcNames = (sample?.serviceIds ?? []).map(id => catalog?.find(s => s.id === id)?.name).filter(Boolean).join(', ')
  const text = fillIn(body, sample, firmName, tags, svcNames)
  const stop = isText && !/\bSTOP\b/i.test(body) ? ' Reply STOP to opt out.' : ''
  const segs = Math.max(1, Math.ceil((text + stop).length / 160))

  const pickMetric = (m: SurveyMetric) => {
    setMetric(m)
    setName(m === 'nps' ? 'Client NPS Survey' : 'Client Satisfaction (CSAT)')
    setBody(surveyBody(m)); setSubject(m === 'nps' ? 'How likely are you to recommend us, {first}?' : 'How did we do, {first}?')
    setAudience('clients')
  }
  const pickKind = (k: 'auto' | 'broadcast' | 'survey') => { setKind(k); if (k === 'survey') pickMetric(metric) }

  const save = async (draft: boolean) => {
    if (!name.trim() || !body.trim()) return
    const c = await campaignsApi.create({ kind, metric: survey ? metric : undefined, name: name.trim(), channel, subject: isEmail ? subject : '', body, audience, trigger, draft, tags: tags.filter(g => (body + subject).includes(`{${g.id}}`)) })
    close(); navigate(`/campaigns/${c.id}`)
  }

  const caret = useRef<{ s: number; e: number } | null>(null)
  const merge = (field: string) => {
    const r = insertTag(body, field, caret.current)
    setBody(r.text); caret.current = { s: r.caret, e: r.caret }
    requestAnimationFrame(() => { ta.current?.focus(); ta.current?.setSelectionRange(r.caret, r.caret) })
  }

  return (
    <Sheet className="enq enq--camp" wide title="New campaign" info="Messages go out from your firm’s own domain and number." icon={<Icon name="campaigns" />} onClose={close}
      onSubmit={e => { e.preventDefault(); save(false) }}
      foot={
        <div className="enq__foot">
          <button className="btn" type="button" onClick={close}>Cancel</button>
          <button className="btn" type="button" onClick={() => toast('Test sent to you', [isText ? 'Text to your phone' : null, isEmail ? `email to sarah@${firm?.domain}` : null].filter(Boolean).join(' and '))}>Send test to me</button>
          <button className="btn" type="button" disabled={!name.trim() || !body.trim()} onClick={() => save(true)}>Save as draft</button>
          <button className="btn btn--prominent" type="submit" disabled={!auto && people === 0}>
            {auto ? 'Turn on' : `${survey ? 'Send survey to' : 'Send to'} ${people} ${people === 1 ? 'person' : 'people'}`}
          </button>
        </div>
      }>
      <div className="enq__split">
        <div className="enq__col">
          <fieldset className="enq__section">
            <legend>Campaign</legend>
            <div className="enq__grid">
              <label className="enq__field enq__field--wide"><span>Name</span><input id="nc-name" required autoComplete="off" value={name} onChange={e => setName(e.target.value)} /></label>
              <div className="enq__field"><label htmlFor="nc-kind">Type</label>
                <Select id="nc-kind" value={kind} onChange={v => pickKind(v as 'auto' | 'broadcast' | 'survey')} options={[{ value: 'broadcast', label: 'One-off send, now' }, { value: 'survey', label: 'Survey, NPS or CSAT' }, { value: 'auto', label: 'Automatic' }]} /></div>
              <div className="enq__field"><label htmlFor="nc-chan">Channel</label>
                <Select id="nc-chan" value={channel} onChange={v => setChannel(v as CampaignChannel)} options={[{ value: 'Email', label: 'Email' }, { value: 'Text', label: 'Text' }, { value: 'Text and Email', label: 'Text and email' }]} /></div>
              {survey && (
                <div className="enq__field enq__field--wide"><label htmlFor="nc-metric">Score</label>
                  <Select id="nc-metric" value={metric} onChange={v => pickMetric(v as SurveyMetric)} options={[{ value: 'nps', label: 'NPS, likelihood to recommend (0 to 10)' }, { value: 'csat', label: 'CSAT, satisfaction (1 to 5)' }]} /></div>
              )}
              {!auto && (
                <div className="enq__field enq__field--wide"><label htmlFor="nc-aud">Send to</label>
                  <Select id="nc-aud" value={audience} onChange={v => setAudience(v as AudienceKey)} options={(Object.entries(AUDIENCES) as [AudienceKey, { label: string }][]).map(([v, a]) => ({ value: v, label: `${a.label} (${counts?.[v] ?? 0})` }))} />
                  <span className="enq__hint">{people} {people === 1 ? 'person' : 'people'}{aud?.optedOut ? `, ${aud.optedOut} opted out and skipped` : ''}</span></div>
              )}
              {auto && (
                <div className="enq__field enq__field--wide"><label htmlFor="nc-trig">When</label>
                  <Select id="nc-trig" value={trigger} onChange={setTrigger} options={TRIGGERS.map(t => ({ value: t, label: t }))} /></div>
              )}
            </div>
          </fieldset>

          <InputsPicker text={body + (isEmail ? subject : '')} tags={tags} onPick={merge} onCreate={g => setTags(t => [...t, g])} />

          <fieldset className="enq__section">
            <legend>Message</legend>
            <div className="enq__grid">
              {isEmail && <label className="enq__field enq__field--wide"><span>Email subject</span><input id="nc-subj" value={subject} onChange={e => setSubject(e.target.value)} /></label>}
              <label className="enq__field enq__field--wide"><span className="vh">Message</span><textarea id="nc-body" ref={ta} onBlur={e => { caret.current = { s: e.target.selectionStart, e: e.target.selectionEnd } }} rows={5} value={body} onChange={e => setBody(e.target.value)} /></label>
            </div>
          </fieldset>
        </div>

        <div className="enq__section enq__preview" aria-live="polite">
          <p className="enq__legend">Preview for {sample?.name}</p>
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
              <b>{fillIn(subject || '(No subject)', sample, firmName, tags, svcNames)}</b>
              <p>{text}</p>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}
