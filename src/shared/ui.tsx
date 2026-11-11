import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { usePhone } from './useMedia'
import type { Lead } from '../api/types'
import { config } from '../api/mockData'

export const Tag = ({ tone, icon, children }: { tone?: 'tint' | 'green' | 'orange' | 'red' | 'accent'; icon?: string; children: ReactNode }) => (
  <span className={'tag' + (tone ? ' tag--' + tone : '')}>{icon && <Icon name={icon} />}{children}</span>
)

export function Seg<T extends string>({ value, options, onChange, label = 'Filter' }: { value: T; options: [T, string][]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, t]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{t}</button>)}
    </div>
  )
}

export const Empty = ({ icon, children }: { icon?: string; children: ReactNode }) => (
  <div className="group empty">{icon && <Icon name={icon} />}<p>{children}</p></div>
)

const STAGE_LABEL = Object.fromEntries(config.stages.map(s => [s.id, s.label]))
export const stageLabel = (id: string) => STAGE_LABEL[id]

/** Stage tag used across lead lists and the inspector. */
export function StageTag({ lead }: { lead: Lead }) {
  if (lead.stage === 'lost') return <Tag tone="red" icon="x">Lost</Tag>
  if (lead.stage === 'signed' || lead.stage === 'delivered') return <Tag tone="green" icon="check">{STAGE_LABEL[lead.stage]}</Tag>
  if (lead.stage === 'contract') return <Tag tone="orange" icon="doc">Contract Sent</Tag>
  if (lead.stage === 'payment') return <Tag tone="orange">Payment Pending</Tag>
  return <Tag tone="tint">{STAGE_LABEL[lead.stage]}</Tag>
}

/** Centered dialog on desktop, bottom sheet on phones. Closes on scrim click and Escape. */
export function Sheet({ title, sub, onClose, wide, children, onSubmit, foot, className = '', icon }: {
  title: ReactNode; sub?: ReactNode; onClose: () => void; wide?: boolean; children: ReactNode; className?: string; icon?: ReactNode
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void; foot?: ReactNode
}) {
  const inner = (
    <>
      <span className="grabber" aria-hidden="true" />
      <div className="sheet-head">
        {icon && <span className="sheet-head__icon" aria-hidden="true">{icon}</span>}
        <div className="sheet-head__title"><h2 id="m-title">{title}</h2>{sub && <span className="footnote">{sub}</span>}</div>
        <button className="closebtn" type="button" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className="sheet__body">{children}</div>
      {foot}
    </>
  )
  return (
    <>
      <div className="scrim scrim--sheet" onClick={onClose} />
      {onSubmit
        ? <form className={'sheet' + (wide ? ' wide' : '') + (className ? ' ' + className : '')} role="dialog" aria-modal="true" aria-labelledby="m-title" onSubmit={onSubmit}>{inner}</form>
        : <div className={'sheet' + (wide ? ' wide' : '') + (className ? ' ' + className : '')} role="dialog" aria-modal="true" aria-labelledby="m-title">{inner}</div>}
    </>
  )
}

export const SheetFoot = ({ onCancel, primary, danger, disabled }: { onCancel: () => void; primary: string; danger?: boolean; disabled?: boolean }) => (
  <div className="sheet__foot">
    <button className="btn" type="button" onClick={onCancel}>Cancel</button>
    <button className={'btn ' + (danger ? 'btn--danger' : 'btn--prominent')} type="submit" disabled={disabled}>{primary}</button>
  </div>
)

export const Field = ({ label, id, stack, children }: { label: string; id: string; stack?: boolean; children: ReactNode }) => (
  <div className={'field' + (stack ? ' field--stack' : '')}><label htmlFor={id}>{label}</label>{children}</div>
)

export { usePhone }
