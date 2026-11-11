import { useId } from 'react'
import { IconInfoCircle } from '@tabler/icons-react'

/** A small (i) icon that shows a short explanation on hover, keyboard focus or tap. */
export function InfoTip({ text, label = 'More information' }: { text: string; label?: string }) {
  const id = useId()
  return (
    <span className="infotip">
      <button type="button" className="infotip__btn" aria-label={label} aria-describedby={id}><IconInfoCircle size={16} stroke={2} /></button>
      <span id={id} role="tooltip" className="infotip__bubble">{text}</span>
    </span>
  )
}
