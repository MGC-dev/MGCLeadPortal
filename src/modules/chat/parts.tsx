import { useEffect, useRef, useState } from 'react'
import { IconArrowUp } from '@tabler/icons-react'
import { chatApi } from '../../api'
import type { ChatMessage } from '../../api/types'
import { Icon } from '../../shared/Icon'
import { ago } from '../../shared/format'

/** **bold** in an answer, and line breaks. */
export const Rich = ({ text }: { text: string }) => (
  <>{text.split('\n').map((line, i) => (
    <span className="chat__line" key={i}>{line.split(/(\*\*[^*]+\*\*)/).map((p, j) => (p.startsWith('**') ? <b key={j}>{p.slice(2, -2)}</b> : p))}</span>
  ))}</>
)

/** A change the assistant wants to make in the portal. Nothing happens until it is approved. */
function ActionCard({ convId, m }: { convId: string; m: ChatMessage }) {
  const a = m.action!
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<void>) => { setBusy(true); await fn(); setBusy(false) }
  return (
    <div className={'chat__action chat__action--' + a.status}>
      <span className="chat__action-title"><Icon name="bolt" small />{a.summary}</span>
      {a.status === 'proposed' ? (
        <span className="chat__action-btns">
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => act(() => chatApi.decline(convId, m.id))}>Cancel</button>
          <button type="button" className="btn btn--sm btn--prominent" disabled={busy} onClick={() => act(() => chatApi.approve(convId, m.id))}>Approve</button>
        </span>
      ) : (
        <span className="chat__action-result">{a.status === 'done' && <Icon name="check" small />}{a.result}</span>
      )}
    </div>
  )
}

/** One message. `avatar` adds the assistant mark beside it (the plain messenger style leaves it out). */
export function Bubble({ m, convId, avatar }: { m: ChatMessage; convId: string; avatar?: boolean }) {
  return (
    <div className={'chat__msg chat__msg--' + m.role}>
      {m.role === 'assistant' && avatar && <span className="chat__avatar" aria-hidden="true"><Icon name="orb" /></span>}
      <div className="chat__bubble">
        {m.steps?.length ? <span className="chat__steps">{m.steps.map(s => <span key={s}><Icon name="check" small />{s}</span>)}</span> : null}
        <Rich text={m.text} />
        {m.action && <ActionCard convId={convId} m={m} />}
        <time className="chat__time">{ago(m.at)}</time>
      </div>
    </div>
  )
}

export function Typing({ avatar }: { avatar?: boolean }) {
  return (
    <div className="chat__msg chat__msg--assistant" aria-label="Thinking">
      {avatar && <span className="chat__avatar" aria-hidden="true"><Icon name="orb" /></span>}
      <div className="chat__bubble chat__typing"><i /><i /><i /></div>
    </div>
  )
}

/** The message box: Enter sends, Shift and Enter adds a line. */
export function Composer({ placeholder, disabled, busy, focusKey, onSend }: { placeholder: string; disabled?: boolean; busy?: boolean; focusKey?: string; onSend: (text: string) => void }) {
  const [text, setText] = useState('')
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (!disabled) box.current?.focus() }, [focusKey, disabled])
  useEffect(() => {
    const el = box.current
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px' }
  }, [text])
  const send = () => { const v = text.trim(); if (!v || busy || disabled) return; setText(''); onSend(v) }
  return (
    <form className="chat__composer" onSubmit={e => { e.preventDefault(); send() }}>
      <textarea ref={box} rows={1} value={text} disabled={disabled} aria-label="Message" placeholder={placeholder}
        onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
      <button type="submit" className="chat__send" aria-label="Send" disabled={!text.trim() || busy || disabled}><IconArrowUp size={19} stroke={2.4} /></button>
    </form>
  )
}
