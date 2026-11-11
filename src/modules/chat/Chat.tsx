import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconCheck, IconChevronRight, IconEdit, IconLayoutSidebar, IconSearch, IconTrash, IconX } from '@tabler/icons-react'
import { chatApi, useQuery } from '../../api'
import { BOT_TOOLS, type ChatConversation, type ChatMessage } from '../../api/types'
import { timeOf } from '../../shared/format'
import { usePhone } from '../../shared/useMedia'
import { AiOrb } from '../../shared/AiOrb'
import { cn } from '@/lib/utils'
import { inline } from './richText'
import { ActionCard } from './ActionCard'
import { Suggestion, SuggestionList, Suggestions } from '@/components/ui/suggestions'
import { ThinkingPromptInput, type ThinkingStatus, type ThinkingStep, type ThinkingSubmitOptions } from '@/components/ui/thinking-prompt-input'

const SUGGESTIONS = [
  'What needs my attention today?',
  'Summarise the pipeline',
  'Move Tom Alvarez to Consultation',
  'Book a call with Rachel Greene tomorrow',
  'Create a lead for Priya Shah',
  'Which contracts are waiting for a signature?',
]

/** How long the "Thinking it through" phase lasts at minimum, so its steps can be read. */
const MIN_THINK_MS = 1500
const STEP_MS = 380
const STREAM_TICK_MS = 22
const STREAM_CHARS = 4

/** A question and the assistant's answer to it. */
type Turn = { user: ChatMessage; reply?: ChatMessage }
function turnsOf(messages: ChatMessage[]): Turn[] {
  const out: Turn[] = []
  for (const m of messages) {
    if (m.role === 'user') out.push({ user: m })
    else if (out.length && !out[out.length - 1].reply) out[out.length - 1].reply = m
  }
  return out
}

/** The tools the assistant used, as readable progress lines ("Checked leads and contacts"). */
const TOOL_LABELS = new Set(Object.values(BOT_TOOLS).map(t => t.label))
const stepText = (s: string) => (TOOL_LABELS.has(s) ? `Checked ${s.toLowerCase()}` : s)
const doneSteps = (steps: string[] = []): ThinkingStep[] => [
  { id: 'read', text: 'Read your question', status: 'complete' },
  ...steps.map((s, i) => ({ id: `s${i}`, text: stepText(s), status: 'complete' as const })),
]
const secondsBetween = (a: number, b: number) => Math.max(1, Math.round((b - a) / 1000))

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()
/** Chats grouped the way Messages and Notes do it: Today, Yesterday, This week, then older. */
function byDay(list: ChatConversation[]) {
  const now = Date.now(), groups: { label: string; items: ChatConversation[] }[] = []
  const label = (t: number) => sameDay(t, now) ? 'Today' : sameDay(t, now - 864e5) ? 'Yesterday' : now - t < 7 * 864e5 ? 'Previous 7 days' : 'Earlier'
  for (const c of list) { const l = label(c.updatedAt); const g = groups.find(x => x.label === l); if (g) g.items.push(c); else groups.push({ label: l, items: [c] }) }
  return groups
}
const rowTime = (t: number) => sameDay(t, Date.now()) ? timeOf(t) : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-ios-accent/50'

/** An earlier turn, drawn like the live one: the question, a folded "Thought for" line, then the answer. */
function PastTurn({ turn, convId }: { turn: Turn; convId: string }) {
  const [open, setOpen] = useState(false)
  const { user, reply } = turn
  const steps = reply?.steps?.length ? doneSteps(reply.steps) : []
  return (
    <>
      <div className="ml-auto w-fit max-w-[80%] rounded-[18px] rounded-br-md bg-primary px-3.5 py-2 text-[15px] leading-5 text-primary-foreground">
        <p className="break-words">{user.text}</p>
      </div>
      {reply && (
        <div className="min-w-0">
          {steps.length > 0 && (
            <>
              <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
                className="flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <span>Thought for {secondsBetween(user.at, reply.at)}s</span>
                <IconChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} aria-hidden="true" />
              </button>
              <div hidden={!open} className="pt-3">
                <ol className="relative ml-[7px] border-l border-border pl-5">
                  {steps.map(s => (
                    <li key={s.id} className="relative flex min-h-9 items-center gap-3 py-2 text-[13px] leading-5">
                      <span className="absolute -left-[26px] flex size-[11px] items-center justify-center rounded-full bg-background ring-4 ring-background"><IconCheck className="size-3 text-foreground" stroke={2.5} aria-label="Complete" /></span>
                      <span className="text-muted-foreground">{s.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
          <div className="mt-4 space-y-2 break-words text-[15px] leading-7 text-foreground">
            {reply.text.split('\n').filter(Boolean).map((p, i) => <p key={i}>{inline(p)}</p>)}
            {reply.action && <ActionCard convId={convId} m={reply} />}
          </div>
        </div>
      )}
    </>
  )
}

/** The turn being answered right now, as this browser animates it. */
type Live = {
  convId: string
  /** When the question was sent. */
  at: number
  think: boolean
  phase: Exclude<ThinkingStatus, 'idle'>
  steps: ThinkingStep[]
  /** How much of the answer has been revealed so far. */
  shown: string
  elapsed: number
  /** The answer being revealed, once it has arrived. */
  replyId?: string
}

/** Ask the UNIR assistant about the portal, or tell it to do something in it. Changes ask for approval first. */
export default function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const convs = (useQuery(() => chatApi.list()) ?? []).filter(c => !c.botId)
  const conv = convs.find(c => c.id === id)
  const [list, setList] = useState(false)
  const [folded, setFolded] = useState(() => { try { return localStorage.getItem('unir-chat-history') === 'closed' } catch { return false } })
  const fold = () => setFolded(f => { try { localStorage.setItem('unir-chat-history', f ? 'open' : 'closed') } catch { /* private window */ } return !f })
  const [think, setThink] = useState(true)
  const [query, setQuery] = useState('')
  const phone = usePhone()
  const [live, setLive] = useState<Live | null>(null)
  const liveRef = useRef(live)
  liveRef.current = live
  const stream = useRef(0)

  const messages = conv?.messages ?? []
  const turns = turnsOf(messages)
  const last = turns.at(-1)
  const reply = last?.reply

  // A different conversation was opened: whatever was animating belongs to the old one.
  useEffect(() => { if (liveRef.current && liveRef.current.convId !== id) { window.clearInterval(stream.current); setLive(null) } }, [id])

  // While waiting for the answer: count the seconds and show what it is doing.
  useEffect(() => {
    if (live?.phase !== 'thinking' || live.replyId) return
    const tick = window.setInterval(() => setLive(l => l && l.phase === 'thinking' ? { ...l, elapsed: (Date.now() - l.at) / 1000 } : l), 250)
    const look = window.setTimeout(() => setLive(l => l && !l.replyId ? { ...l, steps: [{ id: 'read', text: 'Read your question', status: 'complete' }, { id: 'look', text: 'Looking through your portal…', status: 'active' }] } : l), 600)
    return () => { window.clearInterval(tick); window.clearTimeout(look) }
  }, [live?.phase, live?.replyId])

  // The answer arrived: finish the thinking steps, then reveal the text a few characters at a time.
  useEffect(() => {
    const l = liveRef.current
    if (!l || !conv || !reply || l.convId !== conv.id || l.replyId || reply.at < l.at - 50) return
    const timers: number[] = []
    const later = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)) }
    const finalSteps = doneSteps(reply.steps)
    const hold = l.think ? Math.max(0, MIN_THINK_MS - (Date.now() - l.at)) : 0
    setLive({ ...l, replyId: reply.id })
    if (l.think) {
      // Each tool the assistant used appears as a step, then ticks off.
      finalSteps.slice(1).forEach((s, i) => later(Math.min(hold, i * STEP_MS), () => setLive(c => c && {
        ...c, steps: [finalSteps[0], ...finalSteps.slice(1, i + 1), { ...s, status: 'active' }],
      })))
    }
    later(hold, () => {
      setLive(c => c && { ...c, phase: 'answering', steps: l.think ? finalSteps : [], elapsed: l.think ? (Date.now() - l.at) / 1000 : 0 })
      let n = 0
      window.clearInterval(stream.current)
      stream.current = window.setInterval(() => {
        n += STREAM_CHARS
        if (n >= reply.text.length) {
          window.clearInterval(stream.current)
          setLive(c => c && { ...c, phase: 'done', shown: reply.text })
        } else setLive(c => c && c.phase === 'answering' ? { ...c, shown: reply.text.slice(0, n) } : c)
      }, STREAM_TICK_MS)
    })
    return () => timers.forEach(t => window.clearTimeout(t))
  }, [reply?.id, conv?.id])

  useEffect(() => () => window.clearInterval(stream.current), [])

  const send = async (value: string, options?: ThinkingSubmitOptions) => {
    const msg = value.trim()
    if (!msg || conv?.pending) return
    let cid = conv?.id
    if (!cid) { const c = await chatApi.create(null); cid = c.id; navigate(`/chat/${cid}`, { replace: true }) }
    const thinking = options?.think ?? think
    setLive({ convId: cid, at: Date.now(), think: thinking, phase: thinking ? 'thinking' : 'answering', steps: thinking ? [{ id: 'read', text: 'Reading your question…', status: 'active' }] : [], shown: '', elapsed: 0 })
    await chatApi.send(cid, msg)
  }
  const stop = () => {
    window.clearInterval(stream.current)
    setLive(l => l && { ...l, phase: 'done', shown: reply?.text ?? l.shown })
  }
  const newChat = () => { navigate('/chat'); setList(false) }
  const open = (cid: string) => { navigate(`/chat/${cid}`); setList(false) }
  const remove = async (cid: string) => { await chatApi.remove(cid); if (cid === id) navigate('/chat') }

  // What the conversation view shows for the latest turn.
  const isLive = !!live && !!conv && live.convId === conv.id && (!live.replyId || live.replyId === reply?.id)
  const empty = !last
  let status: ThinkingStatus = 'idle'
  let steps: ThinkingStep[] = []
  let answer = ''
  let elapsed = 0
  if (last && isLive) {
    status = live!.phase
    steps = live!.steps
    answer = live!.phase === 'done' ? reply?.text ?? live!.shown : live!.shown
    elapsed = live!.elapsed
  } else if (last) {
    status = reply ? 'done' : conv?.pending ? 'thinking' : 'done'
    steps = reply?.steps?.length ? doneSteps(reply.steps) : reply ? [] : [{ id: 'look', text: 'Looking through your portal…', status: 'active' }]
    answer = reply?.text ?? ''
    elapsed = reply ? secondsBetween(last.user.at, reply.at) : 0
  }

  const filtered = convs.filter(c => !query.trim() || c.title.toLowerCase().includes(query.trim().toLowerCase()))
  const showList = phone ? list : !folded

  const history = (
    <aside aria-label="Chat history" className={cn('flex min-h-0 flex-col border-r border-ios-separator',
      phone && 'absolute inset-0 z-20 border-r-0 bg-ios-page')}>
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-[10px] bg-ios-field px-2.5 text-[#8e8e93] focus-within:ring-2 focus-within:ring-ios-accent/40">
          <IconSearch className="size-4 shrink-0" stroke={2} aria-hidden="true" />
          <span className="sr-only">Search chats</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ios-label outline-none placeholder:text-[#8e8e93] [&::-webkit-search-cancel-button]:hidden" />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className={cn('grid size-5 place-items-center rounded-full bg-[#aeaeb2] text-white', focusRing)}><IconX className="size-3" stroke={3} /></button>}
        </label>
        {phone && <button type="button" onClick={() => setList(false)} className={cn('h-9 rounded-lg px-2 text-[15px] font-semibold text-ios-accent', focusRing)}>Done</button>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-[14px] text-ios-secondary">{query ? `No chats match “${query.trim()}”.` : 'Your chats will show up here.'}</p>
        ) : byDay(filtered).map(g => (
          <section key={g.label}>
            <h3 className="px-4 pt-3 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-ios-secondary">{g.label}</h3>
            <ul className="grid gap-px">
              {g.items.map(c => {
                const sel = c.id === id
                return (
                  <li key={c.id} className="group relative">
                    <button type="button" onClick={() => open(c.id)} aria-current={sel ? 'true' : undefined}
                      className={cn('flex w-full items-baseline gap-2 rounded-[10px] py-2.5 pr-9 pl-4 text-left', focusRing, sel ? 'bg-ios-accent' : 'hover:bg-black/[0.04]')}>
                      <b className={cn('min-w-0 flex-1 truncate text-[15px] font-medium leading-5', sel ? 'text-white' : 'text-ios-label')}>{c.title}</b>
                      <span className={cn('shrink-0 text-[12px]', sel ? 'text-ios-accent-soft' : 'text-ios-secondary')}>{rowTime(c.updatedAt)}</span>
                    </button>
                    <button type="button" aria-label={`Delete ${c.title}`} title="Delete chat" onClick={() => remove(c.id)}
                      className={cn('absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100', focusRing,
                        sel ? 'text-white/85 hover:bg-white/15' : 'text-ios-secondary hover:bg-black/[0.06] hover:text-ios-red')}>
                      <IconTrash className="size-4" stroke={1.9} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  )

  return (
    <div className={cn('ai-surface apple-type relative grid h-[calc(100vh-220px)] min-h-[520px] max-md:h-[calc(100vh-260px)]',
      !phone && !folded ? 'grid-cols-[280px_minmax(0,1fr)]' : 'grid-cols-1')}>
      {showList && history}

      <section aria-label="Conversation" className="flex min-h-0 min-w-0 flex-col">
        <header className="flex h-[52px] shrink-0 items-center justify-between gap-2 px-2">
          <span>
            <button type="button" onClick={() => (phone ? setList(true) : fold())} aria-label={phone ? 'Show chats' : folded ? 'Show chats' : 'Hide chats'} title={folded ? 'Show chats' : 'Hide chats'} aria-pressed={phone ? undefined : !folded}
              className={cn('grid size-9 place-items-center rounded-lg text-ios-accent hover:bg-ios-accent/10', focusRing)}><IconLayoutSidebar className="size-[21px]" stroke={1.8} /></button>
          </span>
          <span className="flex justify-end">
            <button type="button" onClick={newChat} aria-label="New chat" title="New chat" disabled={empty}
              className={cn('grid size-9 place-items-center rounded-lg text-ios-accent hover:bg-ios-accent/10 disabled:text-ios-tertiary disabled:hover:bg-transparent', focusRing)}><IconEdit className="size-[21px]" stroke={1.8} /></button>
          </span>
        </header>

        <div className={cn('flex min-h-0 flex-1 flex-col items-center px-4 pb-3', empty ? 'justify-center gap-6' : 'pt-3')}>
          {empty && (
            <div className="grid justify-items-center gap-2.5 text-center">
              <span className="rounded-full shadow-[0_10px_28px_rgba(31,79,216,0.32)]"><AiOrb size={60} className="block" /></span>
              <h2 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ios-label">How can I help you today?</h2>
              <p className="text-[15px] text-ios-secondary">Ask about your portal, or tell me to do something in it. Changes wait for your approval.</p>
            </div>
          )}
          {empty && (
            <Suggestions onSelect={value => send(value)} className="w-full max-w-[680px]">
              <SuggestionList className="max-w-[640px] self-center">
                {SUGGESTIONS.map(s => <Suggestion key={s} variant="filled" className="h-9 border border-ios-separator bg-white px-4 text-[14px] text-ios-label shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-[#fafafc]">{s}</Suggestion>)}
              </SuggestionList>
            </Suggestions>
          )}
          <ThinkingPromptInput
            className={cn('max-w-[680px]', empty ? 'h-auto flex-none' : 'flex-1')}
            status={status}
            prompt={last?.user.text}
            steps={think || !isLive ? steps : []}
            answer={answer}
            elapsedSeconds={elapsed}
            think={think}
            onThinkChange={setThink}
            onSubmit={send}
            onStop={isLive && live!.phase === 'answering' ? stop : undefined}
            placeholder="Ask about leads, tasks, documents or campaigns"
            followUpPlaceholder="Ask a follow-up"
            focusKey={id ?? 'new'}
            renderText={inline}
            history={conv && turns.slice(0, -1).map(t => <PastTurn key={t.user.id} turn={t} convId={conv.id} />)}
            answerFooter={conv && reply?.action ? <ActionCard convId={conv.id} m={reply} /> : undefined}
          />
          <p className="mt-1.5 text-center text-[11.5px] text-ios-secondary">Answers come from this portal’s sample data. For anything online, use an agent.</p>
        </div>
      </section>
    </div>
  )
}
