import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconPencil, IconTrash } from '@tabler/icons-react'
import { botsApi, useQuery, type BotInput } from '../../api'
import { BOT_ACTIONS, BOT_MODELS, BOT_TOOLS, EXTERNAL_TOOLS, type Bot, type BotAction, type BotModel, type BotTool, type ExternalTool } from '../../api/types'
import { Icon } from '../../shared/Icon'
import { InfoTip } from '../../shared/InfoTip'
import { Select } from '../../shared/Select'
import { Tag } from '../../shared/ui'
import { when } from '../../shared/format'
import { BotAvatar } from './BotAvatar'

function Check({ on, editing, label, hint, onClick }: { on: boolean; editing: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className={'bottools__row' + (on ? ' is-on' : '')} role="checkbox" aria-checked={on} disabled={!editing} onClick={onClick}>
        <span className="pick__check">{on && <Icon name="check" small />}</span>
        <span className="bottools__text"><b>{label}</b><small>{hint}</small></span>
      </button>
    </li>
  )
}

const StatusTag = ({ a }: { a: Bot }) => (a.active ? <Tag tone="green" icon="check">Active</Tag> : <Tag>Draft</Tag>)

const toInput = (a: Bot): BotInput => ({ name: a.name, description: a.description, instructions: a.instructions, model: a.model, tools: [...a.tools], actions: [...a.actions], external: [...a.external], active: a.active })

/** One bot in full. The pencil switches the page to editing, like a document. */
export default function BotDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const bots = useQuery(() => botsApi.list())
  const bot = bots?.find(a => a.id === id)
  const [editing, setEditing] = useState(!!(location.state as { edit?: boolean } | null)?.edit)
  const [draft, setDraft] = useState<BotInput>()
  const [error, setError] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing && bot && !draft) setDraft(toInput(bot)) }, [editing, bot, draft])
  useEffect(() => { if (editing && draft) nameInput.current?.focus() }, [editing, !!draft]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!bots) return null
  if (!bot) return (
    <div className="docv">
      <button type="button" className="docv__back" onClick={() => navigate('/bots')}><IconArrowLeft size={16} stroke={2.2} />Bots</button>
      <div className="group empty"><Icon name="bot" /><p>This bot no longer exists.</p></div>
    </div>
  )

  const view = editing && draft ? draft : toInput(bot)
  const set = (patch: Partial<BotInput>) => setDraft(d => (d ? { ...d, ...patch } : d))
  const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  const startEdit = () => { setDraft(toInput(bot)); setError(''); setEditing(true) }
  const cancel = () => { setEditing(false); setDraft(undefined); setError('') }
  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) return setError('Give the bot a name.')
    if (draft.active && !draft.instructions.trim()) return setError('Write the instructions before switching the bot on.')
    await botsApi.update(bot.id, { ...draft, name: draft.name.trim() })
    setEditing(false); setDraft(undefined); setError('')
  }
  const remove = async () => {
    if (!confirm(`Delete “${bot.name}”? Chats with it keep their history and move to the assistant.`)) return
    await botsApi.remove(bot.id)
    navigate('/bots')
  }

  return (
    <div className="docv">
      <button type="button" className="docv__back" onClick={() => navigate(`/bots/${bot.id}`)}><IconArrowLeft size={16} stroke={2.2} />Back to chat</button>

      <section className="docv__head">
        <span className="docv__avatar"><BotAvatar bot={bot} size={46} /></span>
        <div className="docv__title">
          {editing
            ? <input ref={nameInput} className="docv__name" aria-label="Bot name" value={view.name} onChange={e => set({ name: e.target.value })} placeholder="Bot name" />
            : <h2>{bot.name}</h2>}
          <div className="docv__meta">
            <Tag tone="tint">{BOT_MODELS[view.model].label}</Tag>
            {editing ? (view.active ? <Tag tone="green" icon="check">Active</Tag> : <Tag>Draft</Tag>) : <StatusTag a={bot} />}
            <span className="caption">Updated {when(bot.updatedAt)} by {bot.updatedBy}</span>
          </div>
        </div>
        <div className="docv__actions">
          {editing ? (
            <>
              <button className="btn" type="button" onClick={cancel}>Cancel</button>
              <button className="btn btn--prominent" type="button" onClick={save}>Save changes</button>
            </>
          ) : (
            <>
              <button type="button" className="docv__edit" aria-label="Edit bot" title="Edit bot" onClick={startEdit}><IconPencil size={18} stroke={2} />Edit</button>
            </>
          )}
        </div>
      </section>
      {error && <p className="docv__error" role="alert">{error}</p>}

      <div className="docv__grid">
        <section className="docv__card">
          <h3 className="lead__label">Details</h3>
          <div className="docv__rows">
            <div className="docv__row docv__row--top">
              <span>Description</span>
              {editing
                ? <textarea className="docv__textarea" rows={3} value={view.description} onChange={e => set({ description: e.target.value })} placeholder="What is this bot for?" />
                : <p>{view.description || <em>No description</em>}</p>}
            </div>
            <div className="docv__row">
              <span>Model</span>
              {editing
                ? <Select aria-label="Model" value={view.model} onChange={v => set({ model: v as BotModel })} options={Object.entries(BOT_MODELS).map(([k, m]) => ({ value: k, label: m.label, hint: m.hint }))} />
                : <b>{BOT_MODELS[view.model].label}</b>}
            </div>
            <div className="docv__row">
              <span>Available in chat</span>
              <span className="docv__switch">
                <button type="button" className="switch" role="switch" aria-checked={view.active} aria-label="Available in chat" disabled={!editing} onClick={() => set({ active: !view.active })} />
                <em>{view.active ? 'On' : 'Off'}</em>
              </span>
            </div>
            <div className="docv__row"><span>Runs</span><b className="num">{bot.runs}</b></div>
          </div>
        </section>

        <section className="docv__card">
          <div className="titlerow"><h3 className="lead__label">Can look at</h3><InfoTip text="What the bot can read in the portal. If it is asked about something it cannot see, it says so." label="About what it can look at" /></div>
          <ul className="bottools">
            {(Object.entries(BOT_TOOLS) as [BotTool, { label: string; hint: string }][]).map(([k, t]) => (
              <Check key={k} on={view.tools.includes(k)} editing={editing} label={t.label} hint={t.hint} onClick={() => set({ tools: flip(view.tools, k) })} />
            ))}
          </ul>
        </section>

        <section className="docv__card">
          <div className="titlerow"><h3 className="lead__label">Can do in the portal</h3><InfoTip text="Changes the bot may make for you. In Chat it shows what it is about to do and waits for your approval first." label="About what it can do" /></div>
          <ul className="bottools">
            {(Object.entries(BOT_ACTIONS) as [BotAction, { label: string; hint: string }][]).map(([k, t]) => (
              <Check key={k} on={view.actions.includes(k)} editing={editing} label={t.label} hint={t.hint} onClick={() => set({ actions: flip(view.actions, k) })} />
            ))}
          </ul>
        </section>

        <section className="docv__card">
          <div className="titlerow"><h3 className="lead__label">Outside the portal</h3><InfoTip text="What the bot can reach beyond this portal. The general assistant in Chat only works inside the portal, so use a bot for anything online." label="About outside tools" /></div>
          <ul className="bottools">
            {(Object.entries(EXTERNAL_TOOLS) as [ExternalTool, { label: string; hint: string }][]).map(([k, t]) => (
              <Check key={k} on={view.external.includes(k)} editing={editing} label={t.label} hint={t.hint} onClick={() => set({ external: flip(view.external, k) })} />
            ))}
          </ul>
        </section>

        <section className="docv__card docv__card--wide">
          <div className="titlerow"><h3 className="lead__label">Instructions</h3><InfoTip text="The standing instructions this bot follows on every chat: its job, its tone and what it must never do." label="About instructions" /></div>
          {editing
            ? <textarea className="docv__textarea bot__instr" rows={8} aria-label="Instructions" value={view.instructions} onChange={e => set({ instructions: e.target.value })} placeholder="e.g. You help the intake team. Draft a warm first reply, suggest the next step, and never give legal advice." />
            : view.instructions ? <p className="bot__instr-read">{view.instructions}</p> : <p className="docv__empty">No instructions yet.{' '}Edit this bot to write them.</p>}
        </section>
      </div>

      {editing && (
        <div className="docv__foot">
          <button type="button" className="btn btn--destructive" onClick={remove}><IconTrash size={16} stroke={1.9} />Delete bot</button>
          <span className="docv__spacer" />
          <button className="btn" type="button" onClick={cancel}>Cancel</button>
          <button className="btn btn--prominent" type="button" onClick={save}>Save changes</button>
        </div>
      )}
    </div>
  )
}
