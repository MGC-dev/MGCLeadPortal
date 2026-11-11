import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconBolt, IconCheck, IconChevronRight, IconHistory, IconPlus, IconSparkles, IconTrash } from '@tabler/icons-react'
import { chatApi, useQuery } from '../../api'
import { BOT_TOOLS, type ChatMessage } from '../../api/types'
import { InfoTip } from '../../shared/InfoTip'
import { ago } from '../../shared/format'
import { cn } from '@/lib/utils'
import { inline } from './richText'
import { Button } from '@/components/ui/button'
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

/** A change the assistant wants to make in the portal. Nothing happens until it is approved. */
function ActionCard({ convId, m }: { convId: string; m: ChatMessage }) {
  const a = m.action!
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<void>) => { setBusy(true); await fn(); setBusy(false) }
  return (
    <div className={cn('grid gap-3 rounded-2xl border p-3.5 text-sm',
      a.status === 'done' ? 'border-emerald-200 bg-emerald-50/60' : 'border-border bg-card shadow-sm',
      (a.status === 'cancelled' || a.status === 'failed') && 'opacity-80')}>
      <span className="flex items-start gap-2.5 font-semibold leading-5">
        <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><IconBolt className="size-3" stroke={2.4} aria-hidden="true" /></span>
        {a.summary}
      </span>
      {a.status === 'proposed' ? (
        <span className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3.5" disabled={busy} onClick={() => act(() => chatApi.decline(convId, m.id))}>Cancel</Button>
          <Button type="button" size="sm" className="h-8 rounded-full px-3.5" disabled={busy} onClick={() => act(() => chatApi.approve(convId, m.id))}>Approve</Button>
        </span>
      ) : (
        <span className={cn('flex items-center gap-1.5 text-[13px]', a.status === 'done' ? 'font-medium text-emerald-700' : 'text-muted-foreground')}>
          {a.status === 'done' && <IconCheck className="size-3.5" stroke={2.5} aria-hidden="true" />}{a.result}
        </span>
      )}
    </div>
  )
}

/** An earlier turn, drawn like the live one: the question, a folded "Thought for" line, then the answer. */
function PastTurn({ turn, convId }: { turn: Turn; convId: string }) {
  const [open, setOpen] = useState(false)
  const { user, reply } = turn
  const steps = reply?.steps?.length ? doneSteps(reply.steps) : []
  return (
    <>
      <div className="ml-auto w-fit max-w-[94%] rounded-2xl rounded-br-sm bg-muted px-4 py-2.5 text-[15px] leading-6 text-foreground">
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

  return (
    <div className={'chat chat--claude' + (folded ? ' is-folded' : '')}>
      <aside className={'chat__side' + (list ? ' is-open' : '')} aria-label="Chat history">
        <button type="button" className="btn btn--prominent chat__new" onClick={newChat}><IconPlus size={17} stroke={2.4} />New chat</button>
        {convs.length === 0 ? <p className="chat__none">Your chats will show up here.</p> : (
          <ul>
            {convs.map(c => (
              <li key={c.id} className={c.id === id ? 'is-current' : ''}>
                <button type="button" className="chat__item" onClick={() => open(c.id)} aria-current={c.id === id ? 'true' : undefined}>
                  <b>{c.title}</b><small>{ago(c.updatedAt)}</small>
                </button>
                <button type="button" className="chat__del" aria-label={`Delete ${c.title}`} title="Delete chat" onClick={() => remove(c.id)}><IconTrash size={16} stroke={1.9} /></button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="chat__main" aria-label="Conversation">
        <header className="chat__head">
          <button type="button" className={'iconbtn chat__collapse' + (folded ? '' : ' is-on')} aria-label={folded ? 'Show chat history' : 'Hide chat history'} title={folded ? 'Show chat history' : 'Hide chat history'} aria-pressed={!folded} onClick={fold}><IconHistory size={17} stroke={1.9} /></button>
          <button type="button" className="iconbtn chat__history" aria-label="Chat history" aria-expanded={list} onClick={() => setList(o => !o)}><IconHistory size={17} stroke={1.9} /></button>
          <div className="chat__title">
            <b>{conv?.title ?? 'New chat'}</b>
            <span className="titlerow"><small>UNIR Assistant</small>
              <InfoTip label="About this chat" text="Ask about your leads, tasks, documents and campaigns, or tell it to create a lead, move a ticket, book a task or send a text. Changes wait for your approval. For anything outside the portal, use an agent." /></span>
          </div>
          {!empty && <Button type="button" variant="ghost" size="sm" className="ai-surface h-8 gap-1.5 rounded-full px-3 text-[13px] text-muted-foreground hover:text-foreground" onClick={newChat}><IconPlus className="size-4" stroke={2} aria-hidden="true" />New chat</Button>}
        </header>

        <div className={cn('ai-surface flex min-h-0 flex-1 flex-col items-center px-4 pb-2', empty ? 'justify-center gap-6' : 'pt-2')}>
          {empty && (
            <div className="grid justify-items-center gap-3 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20" aria-hidden="true"><IconSparkles className="size-[22px]" stroke={1.8} /></span>
              <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] text-foreground">How can I help you today?</h2>
              <p className="text-[15px] text-muted-foreground">Ask about your portal, or tell me to do something in it.</p>
            </div>
          )}
          {empty && (
            <Suggestions onSelect={value => send(value)} className="w-full max-w-[720px]">
              <SuggestionList className="max-w-[640px] self-center">
                {SUGGESTIONS.map(s => <Suggestion key={s} variant="outline">{s}</Suggestion>)}
              </SuggestionList>
            </Suggestions>
          )}
          <ThinkingPromptInput
            className={cn('max-w-[720px]', empty ? 'h-auto flex-none' : 'flex-1')}
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
          <p className="mt-2 text-center text-xs text-muted-foreground/80">Answers come from this portal’s sample data. Enter sends, Shift and Enter adds a line.</p>
        </div>
      </section>
    </div>
  )
}
