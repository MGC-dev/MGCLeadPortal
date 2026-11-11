/** UNIR logo: a monogram (two strokes joined, for "unir" = to join) with a letter-spaced wordmark and a thin gold rule. */
const Mark = () => (
  <span className="unir-logo__mark" aria-hidden="true">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3.5v7.2a5.5 5.5 0 0 0 11 0V3.5" /></svg>
  </span>
)

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="unir-logo" role="img" aria-label="UNIR">
      <Mark />
      {!collapsed && <span className="unir-logo__stack" aria-hidden="true"><span className="unir-logo__word">UNIR</span><span className="unir-logo__rule" /></span>}
    </span>
  )
}
