import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Modal =
  | { type: 'intake' }
  | { type: 'compose' | 'reminder' | 'lost' | 'client' | 'send-docs' | 'request-payment'; id: string }
  | { type: 'pick-services'; id: string; next?: 'send-docs' | 'request-payment' }
  | { type: 'newcamp'; kind: 'auto' | 'broadcast' }
  | { type: 'camp'; id: string }
  | { type: 'more' | 'help' | 'account' | 'team' }

export interface Filters { inbox: string; calmode: 'day' | 'week' }

interface Ui {
  /** Lead open in the side inspector. */
  /** Lead whose ticket (actions + activity) is open in the side panel. */
  open: string | null
  /** Lead whose profile (contact and enquiry details) is open in the side panel. */
  profile: string | null
  /** Service open in the side panel, and whether it opens in edit mode. */
  service: string | null
  serviceEdit: boolean
  modal: Modal | null
  filter: Filters
  openLead: (id: string | null) => void
  openProfile: (id: string | null) => void
  openService: (id: string | null, edit?: boolean) => void
  openModal: (m: Modal | null) => void
  closeAll: () => void
  setFilter: (key: keyof Filters, val: string) => void
}
const Ctx = createContext<Ui | null>(null)
export const useUi = () => { const c = useContext(Ctx); if (!c) throw new Error('useUi outside UiProvider'); return c }

export function UiProvider({ children }: { children: ReactNode }) {
  const [open, openLead] = useState<string | null>(null)
  const [profile, openProfile] = useState<string | null>(null)
  const [service, setService] = useState<{ id: string; edit: boolean } | null>(null)
  const openService = useCallback((id: string | null, edit = false) => setService(id ? { id, edit } : null), [])
  const [modal, openModal] = useState<Modal | null>(null)
  const [filter, setFilters] = useState<Filters>({ inbox: 'all', calmode: matchMedia('(max-width: 760px)').matches ? 'day' : 'week' })
  const setFilter = useCallback((key: keyof Filters, val: string) => setFilters(f => ({ ...f, [key]: val })), [])
  const closeAll = useCallback(() => { openLead(null); openProfile(null); setService(null); openModal(null) }, [])
  const value = useMemo(() => ({ open, profile, service: service?.id ?? null, serviceEdit: !!service?.edit, modal, filter, openLead, openProfile, openService, openModal, closeAll, setFilter }), [open, profile, service, modal, filter, closeAll, setFilter, openService])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
