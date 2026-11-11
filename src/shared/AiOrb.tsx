import { useId } from 'react'

/**
 * The assistant's mark: a lit orb in the portal blue, with soft cyan and violet light drifting inside it and a gentle
 * float. `tone="mono"` draws a still, single-colour version for buttons and small places. Motion stops when the
 * person has asked their system for reduced motion.
 */
export function AiOrb({ size = 24, tone = 'color', still, className = '' }: { size?: number; tone?: 'color' | 'mono'; still?: boolean; className?: string }) {
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
  const spin = { transformBox: 'view-box', transformOrigin: '50% 50%' } as const
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false"
      className={`${still ? '' : 'motion-safe:animate-[ai-orb-float_5.5s_ease-in-out_infinite]'} ${className}`}>
      <defs>
        <radialGradient id={`${id}b`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#8fb0ff" />
          <stop offset="0.45" stopColor="#3a68ee" />
          <stop offset="1" stopColor="#14318f" />
        </radialGradient>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.5" />
        </radialGradient>
        <radialGradient id={`${id}h`} cx="34%" cy="26%" r="30%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}c`}><circle cx="50" cy="50" r="48" /></clipPath>
        <filter id={`${id}f`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}b)`} />
      <g clipPath={`url(#${id}c)`}>
        <g style={spin} className={still ? '' : 'motion-safe:animate-[ai-orb-spin_9s_linear_infinite]'}>
          <circle cx="30" cy="66" r="26" fill="#5fd4ff" opacity="0.85" filter={`url(#${id}f)`} />
        </g>
        <g style={spin} className={still ? '' : 'motion-safe:animate-[ai-orb-spin-back_13s_linear_infinite]'}>
          <circle cx="72" cy="36" r="22" fill="#9a7dff" opacity="0.8" filter={`url(#${id}f)`} />
        </g>
        <g style={spin} className={still ? '' : 'motion-safe:animate-[ai-orb-spin_17s_linear_infinite]'}>
          <circle cx="62" cy="76" r="14" fill="#ffffff" opacity="0.35" filter={`url(#${id}f)`} />
        </g>
      </g>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}g)`} />
      <circle cx="50" cy="50" r="46.5" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
      <ellipse cx="38" cy="30" rx="22" ry="15" fill={`url(#${id}h)`} />
    </svg>
  )
}
