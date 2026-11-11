import { useId } from 'react'

/**
 * The assistant's mark: a lit orb in the portal blue. `tone="mono"` draws it in the current text colour for
 * buttons and small places; the full-colour orb is for the assistant's own moments, like the Chat start screen.
 */
export function AiOrb({ size = 24, tone = 'color', className = '' }: { size?: number; tone?: 'color' | 'mono'; className?: string }) {
  const id = useId().replace(/:/g, '')
  if (tone === 'mono') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
        <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.8" fill="currentColor" fillOpacity="0.32" />
        <path d="M8.6 10.5a3.8 3.8 0 0 1 2.6-2.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <radialGradient id={`${id}b`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#9db7ff" />
          <stop offset="0.45" stopColor="#3f6df0" />
          <stop offset="1" stopColor="#14318f" />
        </radialGradient>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id={`${id}h`} cx="34%" cy="26%" r="30%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}b)`} />
      <circle cx="50" cy="50" r="48" fill={`url(#${id}g)`} />
      <circle cx="50" cy="50" r="46.5" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
      <ellipse cx="38" cy="30" rx="22" ry="15" fill={`url(#${id}h)`} />
    </svg>
  )
}
