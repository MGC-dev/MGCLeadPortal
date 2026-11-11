import { useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import { chatApi } from '../../api'
import type { ChatMessage } from '../../api/types'
import { cn } from '@/lib/utils'

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-ios-accent/50'

/** A change the assistant or an agent wants to make. Nothing happens until it is approved. */
export function ActionCard({ convId, m }: { convId: string; m: ChatMessage }) {
  const a = m.action!
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<void>) => { setBusy(true); await fn(); setBusy(false) }
  return (
    <div className="mt-1.5 w-full max-w-[340px] overflow-hidden rounded-2xl border border-ios-separator bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="px-3.5 pt-3 pb-2.5 text-[14px] font-semibold leading-5 text-ios-label">{a.summary}</p>
      {a.status === 'proposed' ? (
        <div className="grid grid-cols-2 border-t border-ios-separator text-[15px]">
          <button type="button" disabled={busy} onClick={() => act(() => chatApi.decline(convId, m.id))} className={cn('h-11 text-ios-accent hover:bg-black/[0.03] disabled:opacity-40', focusRing)}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => act(() => chatApi.approve(convId, m.id))} className={cn('h-11 border-l border-ios-separator font-semibold text-ios-accent hover:bg-black/[0.03] disabled:opacity-40', focusRing)}>Approve</button>
        </div>
      ) : (
        <p className={cn('flex items-center gap-1.5 border-t border-ios-separator px-3.5 py-2.5 text-[13px]', a.status === 'done' ? 'text-[#1a7f37]' : 'text-ios-secondary')}>
          {a.status === 'done' && <IconCheck className="size-3.5" stroke={2.6} aria-hidden="true" />}{a.result}
        </p>
      )}
    </div>
  )
}

