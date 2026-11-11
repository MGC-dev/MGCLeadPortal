import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { IconArrowDown, IconArrowUp, IconCheck, IconChevronLeft, IconInfoCircle, IconInfoCircleFilled, IconPlus, IconSearch, IconX } from '@tabler/icons-react'
import { botsApi, chatApi, useQuery } from '../../api'
import { BOT_MODELS, type Bot, type ChatConversation, type ChatMessage } from '../../api/types'
import { usePhone } from '../../shared/useMedia'
import { timeOf, when } from '../../shared/format'
import { cn } from '@/lib/utils'
import { inline } from '../chat/richText'
import { ActionCard } from '../chat/ActionCard'
import { BotAvatar } from './BotAvatar'
import { AgentInspector } from './AgentInspector'

const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()
/** "6:43 PM" today, "Yesterday", then "Nov 8". */
function shortTime(t: number) {
  const now = Date.now()
  if (sameDay(t, now)) return timeOf(t)
  if (sameDay(t, now - 864e5)) return 'Yesterday'
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
/** The centred line between messages, as in Messages: "Today 6:43 PM". */
const stamp = (t: number) => (sameDay(t, Date.now()) ? `Today ${timeOf(t)}` : when(t))
const GAP_MS = 30 * 60_000

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-ios-accent/50'

/** Three dots rising and falling in turn: the agent is writing. */
function TypingBubble() {
  return (
    <div className="flex justify-start" aria-label="Writing a reply" role="status">
      <span className="inline-flex h-9 items-center gap-[4px] rounded-[18px] rounded-bl-md bg-ios-fill px-3.5">
        {[0, 160, 320].map(d => <span key={d} className="size-[7px] rounded-full bg-[#8e8e93] motion-safe:animate-[ai-wave_1.1s_ease-in-out_infinite]" style={{ animationDelay: `${d}ms` }} />)}
      </span>
    </div>
  )
}

/** The conversation, Messages style: grey for the agent, blue for you, a time line where the chat picks up again. */
function Thread({ conv, messages, pending }: { conv: ChatConversation; messages: ChatMessage[]; pending: boolean }) {
  const out: ReactNode[] = []
  messages.forEach((m, i) => {
    const prev = messages[i - 1], next = messages[i + 1]
    if (!prev || m.at - prev.at > GAP_MS) out.push(<p key={'t' + m.id} className="pt-3 pb-1 text-center text-[12px] font-medium text-ios-secondary">{stamp(m.at)}</p>)
    const mine = m.role === 'user'
    const lastOfRun = !next || next.role !== m.role || next.at - m.at > GAP_MS
    out.push(
      <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start', lastOfRun ? 'mb-2.5' : 'mb-0.5')}>
        {!mine && m.steps?.length ? <span className="mb-1 ml-3 flex items-center gap-1 text-[12px] text-ios-secondary"><IconCheck className="size-3" stroke={2.6} aria-hidden="true" />Checked {m.steps.join(', ').toLowerCase()}</span> : null}
        <div className={cn('max-w-[min(75%,560px)] rounded-[18px] px-3.5 py-2 text-[15px] leading-5 break-words',
          mine ? 'bg-ios-accent text-white' : 'bg-ios-fill text-ios-label',
          lastOfRun && (mine ? 'rounded-br-md' : 'rounded-bl-md'))}>
          {m.text.split('\n').filter(Boolean).map((line, j) => <p key={j} className={j ? 'mt-1' : ''}>{inline(line)}</p>)}
        </div>
        {m.action && <ActionCard convId={conv.id} m={m} />}
      </div>,
    )
  })
  if (pending) out.push(<TypingBubble key="typing" />)
  return <>{out}</>
}

/** The message field: a capsule with the send button inside it. Enter sends, Shift and Enter adds a line. */
function Composer({ placeholder, disabled, busy, focusKey, onSend }: { placeholder: string; disabled?: boolean; busy?: boolean; focusKey?: string; onSend: (text: string) => void }) {
  const [text, setText] = useState('')
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (!disabled) box.current?.focus({ preventScroll: true }) }, [focusKey, disabled])
  useEffect(() => { const el = box.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px' } }, [text])
  const send = () => { const v = text.trim(); if (!v || busy || disabled) return; setText(''); onSend(v) }
  const ready = !!text.trim() && !busy && !disabled
  return (
    <form onSubmit={e => { e.preventDefault(); send() }}
      className={cn('flex items-end gap-2 rounded-[20px] border border-[#d1d1d6] bg-white py-[3px] pr-[3px] pl-3.5 transition-colors focus-within:border-ios-accent/60 focus-within:ring-2 focus-within:ring-ios-accent/15', disabled && 'bg-white/60')}>
      <textarea ref={box} rows={1} value={text} disabled={disabled} aria-label="Message" placeholder={placeholder}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
        className="max-h-[140px] min-h-[30px] flex-1 resize-none bg-transparent py-[5px] text-[15px] leading-5 text-ios-label outline-none placeholder:text-[#8e8e93] disabled:cursor-not-allowed" />
      <button type="submit" aria-label="Send" disabled={!ready}
        className={cn('grid size-[30px] shrink-0 place-items-center rounded-full transition-colors', ready ? 'bg-ios-accent text-white' : 'bg-[#d1d1d6] text-white', focusRing)}>
        <IconArrowUp className="size-[18px]" stroke={2.6} />
      </button>
    </form>
  )
}

/** One agent in the list: its face, name, the last thing said and when. */
function AgentRow({ bot, conv, selected, onOpen }: { bot: Bot; conv?: ChatConversation; selected: boolean; onOpen: () => void }) {
  const last = conv?.messages[conv.messages.length - 1]
  const preview = !bot.active ? 'Draft · switch it on in settings' : last ? plain(last.text) : bot.description || 'Say hello'
  return (
    <li>
      <button type="button" onClick={onOpen} aria-current={selected ? 'true' : undefined}
        className={cn('relative flex w-full items-center gap-3 rounded-[10px] py-2.5 pr-3 pl-4 text-left', focusRing,
          selected ? 'bg-ios-accent' : 'hover:bg-black/[0.04]')}>
        {conv?.unread && !selected && <span className="absolute top-1/2 left-1 size-2 -translate-y-1/2 rounded-full bg-ios-accent" aria-label="Unread" />}
        <BotAvatar bot={bot} size={40} muted={!bot.active} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex items-baseline gap-2">
            <b className={cn('min-w-0 flex-1 truncate text-[15px] font-semibold leading-5', selected ? 'text-white' : 'text-ios-label')}>{bot.name}</b>
            {last && bot.active && <span className={cn('shrink-0 text-[12px]', selected ? 'text-ios-accent-soft' : 'text-ios-secondary')}>{shortTime(last.at)}</span>}
          </span>
          <span className={cn('truncate text-[13px] leading-[18px]', selected ? 'text-ios-accent-soft' : 'text-ios-secondary')}>{preview}</span>
        </span>
      </button>
    </li>
  )
}

/**
 * Agents, laid out like Messages: the agents on the left, the open conversation in the middle, and its settings in
 * an inspector on the right, opened with the info button. On a phone each of the three is its own screen.
 */
export default function Bots() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const phone = usePhone()
  const bots = useQuery(() => botsApi.list())
  const convs = useQuery(() => chatApi.list())
  const [q, setQ] = useState('')
  const [far, setFar] = useState(false)
  const thread = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const making = useRef('')
  const settings = location.pathname.endsWith('/settings')
  const isNew = !!(location.state as { edit?: boolean } | null)?.edit

  const threadOf = (b: Bot): ChatConversation | undefined => convs?.find(c => c.botId === b.id)
  const lastAt = (b: Bot) => threadOf(b)?.updatedAt ?? b.updatedAt
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (bots ?? []).filter(b => !term || `${b.name} ${b.description}`.toLowerCase().includes(term)).sort((a, b) => lastAt(b) - lastAt(a))
  }, [bots, convs, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const active = filtered.filter(b => b.active), drafts = filtered.filter(b => !b.active)
  const bot = bots?.find(b => b.id === id)
  const conv = bot ? threadOf(bot) : undefined
  const messages = conv?.messages ?? []
  const pending = !!conv?.pending

  // On a wide screen the most recent agent opens by itself.
  useEffect(() => { const first = active[0] ?? drafts[0]; if (!id && !phone && first) navigate(`/agents/${first.id}`, { replace: true }) }, [id, phone, filtered.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // An agent's thread is made the first time it is opened.
  useEffect(() => { if (bot && convs && !conv && making.current !== bot.id) { making.current = bot.id; chatApi.create(bot.id) } }, [bot?.id, convs, conv]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (conv?.unread) chatApi.markRead(conv.id) }, [conv?.unread, conv?.id, messages.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [messages.length, pending, id])

  const add = async () => { const b = await botsApi.create(); navigate(`/agents/${b.id}/settings`, { state: { edit: true } }) }
  const send = async (text: string) => { if (conv) await chatApi.send(conv.id, text) }
  const onScroll = () => { const el = thread.current; if (el) setFar(el.scrollHeight - el.scrollTop - el.clientHeight > 240) }
  const toggleSettings = () => bot && navigate(settings ? `/agents/${bot.id}` : `/agents/${bot.id}/settings`)

  if (!bots || !convs) return null

  // On a phone only one pane shows at a time: the list, then the chat, then its settings.
  const show = { list: !phone || !id, chat: !phone || (!!id && !settings), inspector: !!bot && settings }

  return (
    <div className={cn('ai-surface apple-type relative grid h-[calc(100vh-220px)] min-h-[520px] max-md:h-[calc(100vh-260px)]',
      phone ? 'grid-cols-1' : settings && bot ? 'grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_380px]' : 'grid-cols-[300px_minmax(0,1fr)]')}>

      {show.list && (
        <aside aria-label="Agents" className="flex min-h-0 flex-col border-r border-ios-separator max-md:border-r-0">
          <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
            <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-[10px] bg-ios-field px-2.5 text-[#8e8e93] focus-within:ring-2 focus-within:ring-ios-accent/40">
              <IconSearch className="size-4 shrink-0" stroke={2} aria-hidden="true" />
              <span className="sr-only">Search agents</span>
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ios-label outline-none placeholder:text-[#8e8e93] [&::-webkit-search-cancel-button]:hidden" />
              {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')} className={cn('grid size-5 place-items-center rounded-full bg-[#aeaeb2] text-white', focusRing)}><IconX className="size-3" stroke={3} /></button>}
            </label>
            <button type="button" aria-label="New agent" title="New agent" onClick={add}
              className={cn('grid size-9 shrink-0 place-items-center rounded-full text-ios-accent hover:bg-ios-accent/10', focusRing)}><IconPlus className="size-[22px]" stroke={2.2} /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-[14px] text-ios-secondary">{q ? `No agents match “${q.trim()}”.` : 'No agents yet. Press + to create one.'}</p>
            ) : (
              <>
                {active.length > 0 && <ul className="grid gap-px">{active.map(b => <AgentRow key={b.id} bot={b} conv={threadOf(b)} selected={b.id === id} onOpen={() => navigate(`/agents/${b.id}`)} />)}</ul>}
                {drafts.length > 0 && (
                  <>
                    <h3 className="px-4 pt-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-ios-secondary">Drafts</h3>
                    <ul className="grid gap-px">{drafts.map(b => <AgentRow key={b.id} bot={b} conv={threadOf(b)} selected={b.id === id} onOpen={() => navigate(`/agents/${b.id}`)} />)}</ul>
                  </>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      {show.chat && (
        <section aria-label="Conversation" className="relative flex min-h-0 min-w-0 flex-col">
          {!bot ? (
            <div className="m-auto grid max-w-sm justify-items-center gap-3 p-6 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-white text-ios-accent shadow-[0_1px_2px_rgba(0,0,0,0.05)]"><IconPlus className="size-7" stroke={2} /></span>
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ios-label">Create an agent</h2>
              <p className="text-[15px] leading-[21px] text-ios-secondary">An agent has its own instructions and tools, inside the portal and outside it.</p>
              <button type="button" onClick={add} className={cn('mt-1 h-9 rounded-full bg-ios-accent px-4 text-[15px] font-semibold text-white', focusRing)}>New agent</button>
            </div>
          ) : (
            <>
              <header className="grid h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center px-2">
                <span>{phone && <button type="button" onClick={() => navigate('/agents')} className={cn('flex h-9 items-center rounded-lg pr-2 text-[15px] text-ios-accent', focusRing)}><IconChevronLeft className="size-6" stroke={2.2} aria-hidden="true" />Agents</button>}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <BotAvatar bot={bot} size={28} muted={!bot.active} />
                  <span className="grid min-w-0 leading-tight">
                    <b className="truncate text-[15px] font-semibold text-ios-label">{bot.name}</b>
                    <small className="truncate text-[12px] text-ios-secondary">{bot.active ? `${BOT_MODELS[bot.model].label} model` : 'Draft'}</small>
                  </span>
                </span>
                <span className="flex justify-end">
                  <button type="button" onClick={toggleSettings} aria-label="Agent settings" aria-pressed={settings} title="Agent settings"
                    className={cn('grid size-9 place-items-center rounded-full text-ios-accent hover:bg-ios-accent/10', focusRing)}>
                    {settings ? <IconInfoCircleFilled className="size-[22px]" /> : <IconInfoCircle className="size-[22px]" stroke={1.8} />}
                  </button>
                </span>
              </header>

              <div ref={thread} onScroll={onScroll} role="log" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-3 [mask-image:linear-gradient(to_bottom,transparent,black_28px)]">
                {messages.length === 0 && !pending ? (
                  <div className="grid h-full content-center justify-items-center gap-2 text-center">
                    <BotAvatar bot={bot} size={72} muted={!bot.active} />
                    <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ios-label">{bot.name}</h2>
                    <p className="max-w-sm text-[15px] leading-[21px] text-ios-secondary">{bot.description || 'Say hello.'}</p>
                  </div>
                ) : conv && <Thread conv={conv} messages={messages} pending={pending} />}
                <div ref={end} />
              </div>

              {far && <button type="button" aria-label="Jump to the latest message" onClick={() => end.current?.scrollIntoView({ behavior: 'smooth' })}
                className={cn('absolute bottom-20 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full border border-ios-separator bg-white/90 text-ios-label shadow-md backdrop-blur', focusRing)}><IconArrowDown className="size-[18px]" stroke={2.2} /></button>}

              <div className="shrink-0 px-4 pb-3">
                {bot.active ? (
                  <Composer placeholder={`Message ${bot.name}`} disabled={!conv} busy={pending} focusKey={bot.id} onSend={send} />
                ) : (
                  <p className="flex flex-wrap items-center justify-center gap-x-1 rounded-[20px] border border-ios-separator bg-white px-4 py-2.5 text-center text-[14px] text-ios-secondary">
                    {bot.name} is a draft.
                    <button type="button" onClick={() => navigate(`/agents/${bot.id}/settings`)} className={cn('rounded font-medium text-ios-accent hover:underline', focusRing)}>Make it available in Chat</button>
                  </p>
                )}
                <p className="mt-1.5 text-center text-[11.5px] text-ios-secondary">Answers come from this portal’s sample data. Changes in the portal wait for your approval.</p>
              </div>
            </>
          )}
        </section>
      )}

      {show.inspector && bot && (
        <div className={cn('min-h-0 border-l border-ios-separator',
          phone ? '' : 'absolute inset-y-0 right-0 z-10 w-[380px] bg-ios-page shadow-[-12px_0_32px_rgba(0,0,0,0.10)] xl:static xl:w-auto xl:bg-transparent xl:shadow-none')}>
          <AgentInspector bot={bot} isNew={isNew} onClose={() => navigate(`/agents/${bot.id}`)} onDeleted={() => navigate('/agents')} />
        </div>
      )}
    </div>
  )
}
