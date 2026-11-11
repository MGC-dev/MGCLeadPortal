import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCheck, IconChevronDown } from '@tabler/icons-react'
import { Icon } from './Icon'

export interface SelectOption { value: string; label: string; icon?: string; hint?: string }

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Submitted with the surrounding form, like a native select. */
  name?: string
  id?: string
  'aria-label'?: string
  /** Shown when nothing is selected. */
  placeholder?: string
}

/** A styled dropdown (listbox) that matches the portal: icons, tick on the selected row, full keyboard support. */
export function Select({ value, onChange, options, name, id, 'aria-label': ariaLabel, placeholder = 'Select…' }: Props) {
  const auto = useId()
  const listId = `${auto}-list`
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null)
  const selected = options.find(o => o.value === value)

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect()
    if (!r) return
    const below = innerHeight - r.bottom - 12, above = r.top - 12
    const flip = below < 200 && above > below
    const room = flip ? above : below
    setPos({ left: r.left, width: r.width, maxH: Math.min(room, 320), ...(flip ? { bottom: innerHeight - r.top + 6 } : { top: r.bottom + 6 }) })
  }, [])

  useLayoutEffect(() => { if (open) place() }, [open, place])

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      const t = e.target as Node
      if (!trigger.current?.contains(t) && !list.current?.contains(t)) setOpen(false)
    }
    const move = () => setOpen(false)
    document.addEventListener('mousedown', down)
    window.addEventListener('resize', move)
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('resize', move) }
  }, [open])

  useEffect(() => { if (open) list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [open, active])

  const show = () => { setActive(Math.max(0, options.findIndex(o => o.value === value))); setOpen(true) }
  const pick = (v: string) => { onChange(v); setOpen(false); trigger.current?.focus() }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pick(options[active].value) }
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1) { // type-ahead
      const i = options.findIndex(o => o.label.toLowerCase().startsWith(e.key.toLowerCase()))
      if (i >= 0) setActive(i)
    }
  }

  const host = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.portal') : null
  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <button ref={trigger} id={id} type="button" className="select" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-label={ariaLabel} onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey}>
        {selected?.icon && <span className="select__icon"><Icon name={selected.icon} /></span>}
        <span className={'select__value' + (selected ? '' : ' is-placeholder')}>{selected?.label ?? placeholder}</span>
        <IconChevronDown className="select__chev" size={18} stroke={2.2} aria-hidden="true" />
      </button>
      {open && pos && host && createPortal(
        <ul ref={list} id={listId} role="listbox" className="select__list" onKeyDown={onKey}
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}>
          {options.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value} data-active={i === active}>
              <button type="button" tabIndex={-1} className="select__option" onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)}>
                {o.icon && <span className="select__icon"><Icon name={o.icon} /></span>}
                <span className="select__text"><b>{o.label}</b>{o.hint && <small>{o.hint}</small>}</span>
                {o.value === value && <IconCheck className="select__check" size={17} stroke={2.6} />}
              </button>
            </li>
          ))}
        </ul>,
        host,
      )}
    </>
  )
}
