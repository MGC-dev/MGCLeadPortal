import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowDown, IconArrowLeft, IconPlus, IconSearch, IconSettings } from '@tabler/icons-react'
import { botsApi, chatApi, useQuery } from '../../api'
import type { Bot, ChatConversation } from '../../api/types'
import { usePhone } from '../../shared/useMedia'
import { ago } from '../../shared/format'
import { Bubble, Composer, Typing } from '../chat/parts'
import { BotAvatar } from './BotAvatar'

const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()

/**
 * Bots, as a messenger: every bot is a conversation on the left, the open one on the right. Create a bot with the plus,
 * and open its settings from the header. Bots can work inside the portal and, with the right tools, outside it.
 */
export default function Bots() {
  const { id } = useParams()
  const navigate = useNavigate()
  const phone = usePhone()
  const bots = useQuery(() => botsApi.list())
  const convs = useQuery(() => chatApi.list())
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [far, setFar] = useState(false)
  const thread = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const making = useRef('')

  const threadOf = (b: Bot): ChatConversation | undefined => convs?.find(c => c.botId === b.id)
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (bots ?? []).filter(b => !term || `${b.name} ${b.description}`.toLowerCase().includes(term))
      .sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1) || ((convs?.find(c => c.botId === b.id)?.updatedAt ?? b.updatedAt) - (convs?.find(c => c.botId === a.id)?.updatedAt ?? a.updatedAt)))
  }, [bots, convs, q])
  const bot = bots?.find(b => b.id === id)
  const conv = bot ? threadOf(bot) : undefined
  const messages = conv?.messages ?? []
  const pending = !!conv?.pending

  // on a wide screen the first bot opens by itself
  useEffect(() => { if (!id && !phone && list.length) navigate(`/bots/${list[0].id}`, { replace: true }) }, [id, phone, list.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // a bot's thread is made the first time it is opened
  useEffect(() => {
    if (bot && convs && !conv && making.current !== bot.id) { making.current = bot.id; chatApi.create(bot.id) }
  }, [bot?.id, convs, conv]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (conv?.unread) chatApi.markRead(conv.id) }, [conv?.unread, conv?.id, messages.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [messages.length, pending, id])

  const add = async () => { const b = await botsApi.create(); navigate(`/bots/${b.id}/settings`, { state: { edit: true } }) }
  const send = async (text: string) => { if (conv) await chatApi.send(conv.id, text) }
  const onScroll = () => { const el = thread.current; if (el) setFar(el.scrollHeight - el.scrollTop - el.clientHeight > 240) }

  if (!bots || !convs) return null

  return (
    <div className={'bm' + (id ? ' has-thread' : '')}>
      <aside className="bm__list" aria-label="Bots">
        <div className="bm__tools">
          {searching
            ? <label className="bm__search"><IconSearch size={17} stroke={1.9} /><span className="vh">Search bots</span><input autoFocus type="search" value={q} onChange={e => setQ(e.target.value)} onBlur={() => { if (!q) setSearching(false) }} placeholder="Search bots" /></label>
            : <><span className="bm__heading">Bots</span>
              <button type="button" className="iconbtn" aria-label="Search bots" title="Search bots" onClick={() => setSearching(true)}><IconSearch size={19} stroke={1.9} /></button></>}
          <button type="button" className="iconbtn iconbtn--primary" aria-label="New bot" title="New bot" onClick={add}><IconPlus size={19} stroke={2.2} /></button>
        </div>
        {list.length === 0 ? <p className="chat__none">{q ? 'No bots match.' : 'No bots yet. Press + to create one.'}</p> : (
          <ul>
            {list.map(b => {
              const t = threadOf(b), last = t?.messages[t.messages.length - 1]
              return (
                <li key={b.id}>
                  <button type="button" className={'bm__item' + (b.id === id ? ' is-current' : '')} aria-current={b.id === id ? 'true' : undefined} onClick={() => navigate(`/bots/${b.id}`)}>
                    <BotAvatar bot={b} size={38} />
                    <span className="bm__text">
                      <b>{b.name}</b>
                      <small>{!b.active ? 'Draft, switch it on in Settings' : last ? plain(last.text) : b.description || 'Say hello'}</small>
                    </span>
                    {t?.unread && <i className="bm__dot" aria-label="Unread" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <section className="bm__main" aria-label="Conversation">
        {!bot ? (
          <div className="chat__empty"><span className="bm__hero"><IconPlus size={26} stroke={2} /></span><h2>Create a bot</h2><p>A bot has its own instructions and tools, inside the portal and outside it. Press + to make your first one.</p></div>
        ) : (
          <>
            <header className="bm__head">
              <button type="button" className="iconbtn bm__back" aria-label="All bots" onClick={() => navigate('/bots')}><IconArrowLeft size={19} stroke={2} /></button>
              <span className="bm__pill"><BotAvatar bot={bot} size={24} />{bot.name}</span>
              <button type="button" className="bm__settings" onClick={() => navigate(`/bots/${bot.id}/settings`)}><IconSettings size={17} stroke={1.9} />Settings</button>
            </header>
            <div className="chat__thread bm__thread" ref={thread} onScroll={onScroll} role="log" aria-live="polite">
              {messages.length === 0 && !pending ? (
                <div className="chat__empty"><BotAvatar bot={bot} size={60} /><h2>{bot.name}</h2><p>{bot.description || 'Say hello.'}</p></div>
              ) : messages.map(m => <Bubble key={m.id} m={m} convId={conv!.id} />)}
              {pending && <Typing />}
              <div ref={end} />
            </div>
            {far && <button type="button" className="bm__down" aria-label="Jump to the latest message" onClick={() => end.current?.scrollIntoView({ behavior: 'smooth' })}><IconArrowDown size={19} stroke={2} /></button>}
            <Composer placeholder={bot.active ? `Message ${bot.name}` : 'Switch this bot on in Settings to chat'} disabled={!bot.active || !conv} busy={pending} focusKey={bot.id} onSend={send} />
            <p className="chat__note">{bot.active ? 'Answers are generated from this portal’s sample data. Changes in the portal wait for your approval.' : `${bot.name} is a draft. Open Settings, switch it on and save.`}</p>
          </>
        )}
      </section>
    </div>
  )
}
