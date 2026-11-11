import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Renders its children at the right end of the page heading (the slot in the app shell's toolbar). */
export function HeaderActions({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { setSlot(document.getElementById('toolbar-actions')) }, [])
  return slot ? createPortal(children, slot) : null
}
