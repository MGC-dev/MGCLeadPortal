import type { ReactNode } from 'react'

/** **bold** inside a line. Mid-stream, a bold run that has not closed yet is shown bold without its asterisks. */
export function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <b key={i} className="font-semibold">{p.slice(2, -2)}</b>
    const open = p.indexOf('**')
    return open === -1 ? p : <span key={i}>{p.slice(0, open)}<b className="font-semibold">{p.slice(open + 2)}</b></span>
  })
}
