import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconPencil, IconTrash } from '@tabler/icons-react'
import { campaignsApi, useQuery, type CampaignInput } from '../../api'
import type { AudienceKey, Campaign, CampaignChannel, CampaignTag, Recipient, SurveyMetric } from '../../api/types'
import { Select } from '../../shared/Select'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Tag } from '../../shared/ui'
import { ago, lower1, when } from '../../shared/format'
import { InputsPicker } from './InputsPicker'
import { AUDIENCES, TRIGGERS, allInputs, insertTag, campStats, surveyStats, useCampaigns, useFirm } from './campaignUtils'
import { KindTag, StatusTag, reach } from './Campaigns'
import { InfoTip } from '../../shared/InfoTip'

const toInput = (c: Campaign): CampaignInput => ({ name: c.name, subject: c.subject ?? '', body: c.body, tags: (c.tags ?? []).map(g => ({ ...g })), channel: c.channel, audience: c.audience, trigger: c.trigger, metric: c.metric })

/** The message with its inputs shown as placeholders, e.g. {first}. */
const Tokens = ({ text, tags }: { text: string; tags?: CampaignTag[] }) => (
  <>{text.split(/(\{[a-z0-9_]+\})/).map((p, i) => (allInputs(tags).some(x => x.token === p) ? <mark className="ph" key={i}>{p}</mark> : p))}</>
)

/** A given score, coloured by what it means (NPS 9 to 10 promoter, 7 to 8 passive, 0 to 6 detractor; CSAT 4 to 5 satisfied, 3 neutral, 1 to 2 unhappy). */
const ScoreTag = ({ score, csat }: { score: number; csat?: boolean }) => {
  const tone = csat ? (score >= 4 ? 'green' : score === 3 ? 'orange' : 'red') : (score >= 9 ? 'green' : score >= 7 ? 'orange' : 'red')
  return <Tag tone={tone}>Scored {score}</Tag>
}

const RecipientTag = ({ r }: { r: Recipient }) =>
  r.score !== undefined ? <ScoreTag score={r.score} /> :
  r.status === 'skipped' ? <Tag>Skipped, opted out</Tag>
    : r.status === 'held' ? <Tag tone="orange">Held</Tag>
      : r.replied ? <Tag tone="green" icon="check">Replied</Tag>
        : r.opened ? <Tag tone="tint">Opened</Tag> : <Tag>Delivered</Tag>

/** One campaign in full: its message, who it reaches and the delivery results. The pencil switches the page to editing. */
export default function CampaignDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { openLead } = useUi()
  const camps = useCampaigns()
  const firm = useFirm()
  const sending = useQuery(() => campaignsApi.progress())
  const c = camps?.find(x => x.id === id)
  const [editing, setEditing] = useState(!!(location.state as { edit?: boolean } | null)?.edit)
  const [draft, setDraft] = useState<CampaignInput>()
  const [error, setError] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)
  const bodyInput = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<{ s: number; e: number } | null>(null)

  useEffect(() => { if (editing && c && !draft) setDraft(toInput(c)) }, [editing, c, draft])
  useEffect(() => { if (editing && draft) nameInput.current?.focus() }, [editing, !!draft]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!camps || !firm) return null
  if (!c) return (
    <div className="docv">
      <button type="button" className="docv__back" onClick={() => navigate('/campaigns')}><IconArrowLeft size={16} stroke={2.2} />Campaigns</button>
      <div className="group empty"><Icon name="campaigns" /><p>This campaign no longer exists.</p></div>
    </div>
  )

  const view = editing && draft ? draft : toInput(c)
  const set = (patch: Partial<CampaignInput>) => setDraft(d => (d ? { ...d, ...patch } : d))
  const isEmail = /Email/.test(view.channel)
  const st = campStats(c)
  const live = sending && sending.id === c.id
  const sv = c.kind === 'survey' ? surveyStats(c) : null
  const tiles: [string, string | number][] = [['Delivered', st.sent], ...(st.email ? [['Opened', Math.round(st.opened / st.email * 100) + '%'] as [string, string]] : []), ['Replied', st.replied], ['Held', st.held], ['Skipped', st.skipped]]

  const insert = (token: string) => {
    const r = insertTag(view.body, token, caret.current)
    set({ body: r.text }); caret.current = { s: r.caret, e: r.caret }
    requestAnimationFrame(() => { bodyInput.current?.focus(); bodyInput.current?.setSelectionRange(r.caret, r.caret) })
  }
  const startEdit = () => { setDraft(toInput(c)); setError(''); setEditing(true) }
  const cancel = () => { setEditing(false); setDraft(undefined); setError('') }
  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) return setError('Give the campaign a name.')
    if (!draft.body.trim()) return setError('The message cannot be empty.')
    await campaignsApi.update(c.id, { ...draft, name: draft.name.trim() })
    setEditing(false); setDraft(undefined); setError('')
  }
  const remove = async () => {
    if (!confirm(`Delete “${c.name}”? Its results are removed too.`)) return
    await campaignsApi.remove(c.id)
    navigate('/campaigns')
  }

  return (
    <div className="docv">
      <button type="button" className="docv__back" onClick={() => navigate('/campaigns')}><IconArrowLeft size={16} stroke={2.2} />Campaigns</button>

      <section className="docv__head">
        <span className="docv__icon" aria-hidden="true"><Icon name="campaigns" /></span>
        <div className="docv__title">
          {editing
            ? <input ref={nameInput} className="docv__name" aria-label="Campaign name" value={view.name} onChange={e => set({ name: e.target.value })} placeholder="Campaign name" />
            : <h2>{c.name}</h2>}
          <div className="docv__meta">
            <KindTag c={c} />
            <Tag>{c.channel}</Tag>
            <StatusTag c={c} />
            {c.sentAt && <span className="caption">Sent {when(c.sentAt)}</span>}
          </div>
        </div>
        <div className="docv__actions">
          {editing ? (
            <>
              <button className="btn" type="button" onClick={cancel}>Cancel</button>
              <button className="btn btn--prominent" type="button" onClick={save}>Save changes</button>
            </>
          ) : (
            <button type="button" className="docv__edit" aria-label="Edit campaign" title="Edit campaign" onClick={startEdit}><IconPencil size={18} stroke={2} />Edit</button>
          )}
        </div>
      </section>
      {error && <p className="docv__error" role="alert">{error}</p>}

      <div className="docv__grid">
        <section className="docv__card">
          <h3 className="lead__label">Message</h3>
          <div className="docv__rows">
            {isEmail && (
              <div className="docv__row">
                <span>Subject</span>
                {editing ? <input className="docv__input" aria-label="Subject" value={view.subject} onChange={e => set({ subject: e.target.value })} /> : <b>{view.subject ? <Tokens text={view.subject} tags={view.tags} /> : '—'}</b>}
              </div>
            )}
            <div className="docv__row docv__row--top">
              <span>Body</span>
              {editing
                ? <textarea ref={bodyInput} onBlur={e => { caret.current = { s: e.target.selectionStart, e: e.target.selectionEnd } }} className="docv__textarea" rows={6} aria-label="Message" value={view.body} onChange={e => set({ body: e.target.value })} />
                : <p style={{ whiteSpace: 'pre-wrap' }}><Tokens text={view.body} tags={view.tags} /></p>}
            </div>
          </div>
          {editing && <InputsPicker text={view.body + view.subject} tags={view.tags ?? []} onPick={insert} onCreate={g => set({ tags: [...(view.tags ?? []), g] })} />}
        </section>

        <section className="docv__card">
          <h3 className="lead__label">Details</h3>
          <div className="docv__rows">
            <div className="docv__row"><span>Type</span><b>{c.kind === 'survey' ? 'Survey' : c.kind === 'broadcast' ? 'One-off send' : 'Automatic'}</b></div>
            {c.kind === 'survey' && (
              <div className="docv__row"><span>Score</span>
                {editing
                  ? <Select aria-label="Score" value={view.metric ?? 'nps'} onChange={v => set({ metric: v as SurveyMetric })} options={[{ value: 'nps', label: 'NPS (0 to 10)' }, { value: 'csat', label: 'CSAT (1 to 5)' }]} />
                  : <b>{c.metric === 'csat' ? 'CSAT (1 to 5)' : 'NPS (0 to 10)'}</b>}
              </div>
            )}
            <div className="docv__row"><span>{c.kind !== 'auto' ? 'Sent to' : 'When'}</span>
              {editing
                ? c.kind === 'auto'
                  ? <Select aria-label="When" value={view.trigger ?? ''} onChange={v => set({ trigger: v })} options={TRIGGERS.map(t => ({ value: t, label: t }))} />
                  : <Select aria-label="Sent to" value={view.audience ?? 'open'} onChange={v => set({ audience: v as AudienceKey })} options={(Object.entries(AUDIENCES) as [AudienceKey, { label: string }][]).map(([v, a]) => ({ value: v, label: a.label }))} />
                : <b>{reach(c)}</b>}
            </div>
            <div className="docv__row"><span>Channel</span>
              {editing
                ? <Select aria-label="Channel" value={view.channel} onChange={v => set({ channel: v as CampaignChannel })} options={[{ value: 'Email', label: 'Email' }, { value: 'Text', label: 'Text' }, { value: 'Text and Email', label: 'Text and email' }]} />
                : <b>{c.channel}</b>}
            </div>
            {(
              <div className="docv__row">
                <span>{c.kind === 'survey' ? 'Collecting scores' : c.kind === 'auto' ? 'Running' : 'Active'}</span>
                <span className="docv__switch">
                  <button type="button" className="switch" role="switch" aria-checked={!!c.active} aria-label="Status" onClick={() => campaignsApi.toggle(c.id)} />
                  <em>{c.draft ? `Draft, turn on to ${c.kind === 'auto' ? 'start it' : 'send it'}` : c.active ? 'On' : 'Off'}</em>
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="docv__card docv__card--wide">
          <div className="docv__cardhead">
            <div className="titlerow"><h3 className="lead__label">Inputs</h3><InfoTip text="Placeholders in the message. Each is filled in for every person when it is sent." label="About inputs" /></div>
          </div>
          <div className="docv__fields">
            <div className="docv__fhead" aria-hidden="true"><span>Input</span><span>Placeholder</span><span>Filled from</span></div>
            {allInputs(view.tags).map(x => (
              <div className="docv__frow docv__frow--3" key={x.token}>
                <b>{x.label}</b>
                <span><mark className="ph">{x.token}</mark></span>
                <span><Tag tone="tint">{x.from}</Tag>{!(view.body + view.subject).includes(x.token) && <span className="caption"> not used</span>}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="docv__card docv__card--wide">
          <div className="docv__cardhead">
            <div className="titlerow"><h3 className="lead__label">Results</h3><InfoTip text={c.kind === 'auto' ? `Counts everyone it has sent to, each time ${lower1(c.trigger ?? '')}.` : 'Delivery for this send.'} label="About results" /></div>
          </div>
          {live && (
            <div className="sendbar">
              <div className="sendbar__track"><span style={{ width: `${Math.round(sending.done / sending.total * 100)}%` }} /></div>
              <span className="footnote num">Sending {sending.done} of {sending.total}…</span>
            </div>
          )}
          {sv && (
            <div className="survey">
              <div className="survey__score">
                <span>{c.metric === 'csat' ? 'CSAT score' : 'NPS'}</span>
                <b>{sv.n ? (c.metric === 'csat' ? sv.score.toFixed(1) : (sv.score > 0 ? '+' : '') + sv.score) : '—'}</b>
                <small>{c.metric === 'csat' ? 'average out of 5' : 'from -100 to +100'}</small>
              </div>
              <div className="survey__split">
                {(c.metric === 'csat'
                  ? [['Satisfied (4 to 5)', 'satisfied' in sv ? sv.satisfied : 0, 'good'], ['Neutral (3)', 'neutral' in sv ? sv.neutral : 0, 'mid'], ['Unhappy (1 to 2)', 'unhappy' in sv ? sv.unhappy : 0, 'bad']]
                  : [['Promoters (9 to 10)', 'promoters' in sv ? sv.promoters : 0, 'good'], ['Passives (7 to 8)', 'passives' in sv ? sv.passives : 0, 'mid'], ['Detractors (0 to 6)', 'detractors' in sv ? sv.detractors : 0, 'bad']]
                ).map(([label, n, tone]) => (
                  <div className="survey__row" key={label as string}>
                    <span>{label}</span>
                    <i className={'survey__bar survey__bar--' + tone}><em style={{ width: `${sv.n ? Math.round((n as number) / sv.n * 100) : 0}%` }} /></i>
                    <b className="num">{n}</b>
                  </div>
                ))}
                <p className="caption">{sv.n} of {sv.delivered} responded ({sv.rate}% response rate)</p>
              </div>
            </div>
          )}
          <div className="summary summary--sheet">{tiles.map(([t, v]) => <div className="tile" key={t}><span>{t}</span><b>{v}</b></div>)}</div>
          {c.recipients.length ? (
            <ul className="group rows">
              {c.recipients.slice(0, 40).map((r, i) => (
                <li key={i}><button type="button" className="row" onClick={() => openLead(r.id)}>
                  <span className="row__main"><b>{r.name}</b><span>{r.channel}{r.at ? ` · ${ago(r.at)}` : ''}</span></span>
                  <span className="row__end">{r.score !== undefined ? <ScoreTag score={r.score} csat={c.metric === 'csat'} /> : <RecipientTag r={r} />}</span>
                </button></li>
              ))}
            </ul>
          ) : (
            <p className="docv__empty">{c.kind === 'auto' ? `Nobody has received this yet. It sends by itself when ${lower1(c.trigger ?? '')}.` : 'No recipients yet.'}</p>
          )}
        </section>
      </div>

      {editing && (
        <div className="docv__foot">
          <button type="button" className="btn btn--destructive" onClick={remove}><IconTrash size={16} stroke={1.9} />Delete campaign</button>
          <span className="docv__spacer" />
          <button className="btn" type="button" onClick={cancel}>Cancel</button>
          <button className="btn btn--prominent" type="button" onClick={save}>Save changes</button>
        </div>
      )}
    </div>
  )
}
