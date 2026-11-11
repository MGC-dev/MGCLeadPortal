import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconHistory, IconPlus, IconTrash } from '@tabler/icons-react'
import { chatApi, useQuery } from '../../api'
import { Icon } from '../../shared/Icon'
import { InfoTip } from '../../shared/InfoTip'
import { ago } from '../../shared/format'
import { Bubble, Composer, Typing } from './parts'

const SUGGESTIONS = [
  'What needs my attention today?',
  'Summarise the pipeline',
  'Move Tom Alvarez to Consultation',
  'Book a call with Rachel Greene tomorrow',
  'Create a lead for Priya Shah',
  'Which contracts are waiting for a signature?',
]

/** Ask the UNIR assistant about the portal, or tell it to do something in it. Changes ask for approval first. */
export default function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const convs = (useQuery(() => chatApi.list()) ?? []).filter(c => !c.botId)
  const conv = convs.find(c => c.id === id)
  const [list, setList] = useState(false)
  const [folded, setFolded] = useState(() => { try { return localStorage.getItem('unir-chat-history') === 'closed' } catch { return false } })
  const fold = () => setFolded(f => { try { localStorage.setItem('unir-chat-history', f ? 'open' : 'closed') } catch { /* private window */ } return !f })
  const end = useRef<HTMLDivElement>(null)
  const pending = !!conv?.pending
  const messages = conv?.messages ?? []

  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [messages.length, pending, id])

  const send = async (value: string) => {
    const msg = value.trim()
    if (!msg || pending) return
    let cid = conv?.id
    if (!cid) { const c = await chatApi.create(null); cid = c.id; navigate(`/chat/${cid}`, { replace: true }) }
    await chatApi.send(cid, msg)
  }
  const newChat = () => { navigate('/chat'); setList(false) }
  const open = (cid: string) => { navigate(`/chat/${cid}`); setList(false) }
  const remove = async (cid: string) => { await chatApi.remove(cid); if (cid === id) navigate('/chat') }

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
              <InfoTip label="About this chat" text="Ask about your leads, tasks, documents and campaigns, or tell it to create a lead, move a ticket, book a task or send a text. Changes wait for your approval. For anything outside the portal, use a bot." /></span>
          </div>
        </header>

        <div className="chat__thread" role="log" aria-live="polite">
          {messages.length === 0 ? (
            <div className="chat__empty">
              <span className="chat__hero" aria-hidden="true"><Icon name="sparkle" /></span>
              <h2>How can I help you today?</h2>
              <p>Ask about your portal, or tell me to do something in it.</p>
              <div className="chat__suggest">{SUGGESTIONS.map(s => <button key={s} type="button" className="chip chip--add" onClick={() => send(s)}>{s}</button>)}</div>
            </div>
          ) : messages.map(m => <Bubble key={m.id} m={m} convId={conv!.id} />)}
          {pending && <Typing />}
          <div ref={end} />
        </div>

        <Composer placeholder="How can I help you today?" busy={pending} focusKey={id ?? 'new'} onSend={send} />
        <p className="chat__note">Answers are generated from this portal’s sample data. Press Enter to send, Shift and Enter for a new line.</p>
      </section>
    </div>
  )
}
