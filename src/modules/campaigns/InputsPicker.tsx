import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconPlus } from '@tabler/icons-react'
import type { CampaignTag, FieldSource } from '../../api/types'
import { Select } from '../../shared/Select'
import { TAG_SOURCES, allInputs, tagId } from './campaignUtils'

/**
 * "Inputs +": the plus opens a menu of the inputs this message can use. Pick one to add its tag to the message,
 * or add a new input: give it a name and say what it is filled from (the ticket, the firm or the date).
 * Tags already in the message are shown beside the plus.
 */
export function InputsPicker({ text, tags, onPick, onCreate }: {
  text: string
  tags: CampaignTag[]
  onPick: (token: string) => void
  onCreate: (tag: CampaignTag) => void
}) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [source, setSource] = useState<FieldSource>('phone')
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxH: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const host = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.portal') : null
  const inputs = allInputs(tags)
  const used = inputs.filter(x => text.includes(x.token))

  const close = () => { setOpen(false); setAdding(false); setLabel('') }

  useLayoutEffect(() => {
    if (!open) return
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const below = innerHeight - r.bottom - 12, above = r.top - 12
    const up = below < 320 && above > below
    setPos({ left: Math.min(r.left, innerWidth - 300), maxH: Math.max(160, Math.min(up ? above : below, 420)), ...(up ? { bottom: innerHeight - r.top + 6 } : { top: r.bottom + 6 }) })
  }, [open, adding])

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (btn.current?.contains(t) || menu.current?.contains(t) || t.closest('.select__list')) return
      close()
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true) }
  }, [open])

  const create = () => {
    const name = label.trim()
    if (!name) return
    const tag: CampaignTag = { id: tagId(name, tags.map(g => g.id)), label: name, source }
    onCreate(tag); onPick(`{${tag.id}}`); close()
  }

  return (
    <div className="inputsbar">
      <span className="inputsbar__title">Inputs</span>
      <button ref={btn} type="button" className="svcs__add" aria-label="Add input" title="Add input" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}><IconPlus size={16} stroke={2.2} /></button>
      {used.map(x => <mark className="ph" key={x.token}>{x.token}</mark>)}
      {open && pos && host && createPortal(
        <div ref={menu} className="inputsbar__menu" role="menu" style={{ left: pos.left, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}>
          {!adding ? (
            <>
              <ul>
                {inputs.map(x => (
                  <li key={x.token} role="none">
                    <button type="button" role="menuitem" onClick={() => { onPick(x.token); close() }}>
                      <b>{x.label}</b><span>{x.token} · {x.from}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="inputsbar__new" onClick={() => setAdding(true)}><IconPlus size={15} stroke={2.4} />New input</button>
            </>
          ) : (
            <form className="inputsbar__form" onSubmit={e => { e.preventDefault(); e.stopPropagation(); create() }}>
              <label><span>Input name</span><input autoFocus value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Client phone" autoComplete="off" /></label>
              <div className="inputsbar__field"><span>Filled from</span>
                <Select aria-label="Filled from" contain value={source} onChange={v => setSource(v as FieldSource)}
                  options={TAG_SOURCES.map(o => ({ value: o.value, label: o.group === 'Ticket' ? `Ticket · ${o.label}` : o.label }))} /></div>
              <div className="inputsbar__actions">
                <button type="button" className="btn btn--sm" onClick={() => setAdding(false)}>Back</button>
                <button type="submit" className="btn btn--sm btn--prominent" disabled={!label.trim()}>Add and insert</button>
              </div>
            </form>
          )}
        </div>,
        host,
      )}
    </div>
  )
}
