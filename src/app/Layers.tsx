import { useEffect } from 'react'
import { leadsApi, servicesApi, useQuery } from '../api'
import { useUi } from './UiContext'
import { LeadInspector } from '../modules/lead/LeadInspector'
import { LeadProfile } from '../modules/lead/LeadProfile'
import { ServicePanel } from '../modules/services/ServicePanel'
import { SendDocumentsModal } from '../modules/lead/SendDocumentsModal'
import { PickServicesModal } from '../modules/lead/PickServicesModal'
import { RequestPaymentModal } from '../modules/lead/RequestPaymentModal'
import { ClientSignModal, ComposeModal, IntakeModal, LostModal, ReminderModal } from '../modules/lead/LeadModals'
import { CampaignBuilder } from '../modules/campaigns/CampaignBuilder'
import { AccountSheet } from './AccountSheets'

/** Everything that floats above the page: the lead inspector and the dialogs. */
export function Layers() {
  const { open, profile, service, serviceEdit, modal, openLead, openProfile, openService, openModal } = useUi()
  const leads = useQuery(() => leadsApi.list())
  const services = useQuery(() => servicesApi.list())
  const lead = (id?: string) => leads?.find(l => l.id === id)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (modal) openModal(null); else if (open) openLead(null); else if (profile) openProfile(null); else if (service) openService(null)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, profile, service, modal, openLead, openProfile, openService, openModal])

  // Keep the page behind from scrolling while a panel or dialog is open.
  const locked = open !== null || profile !== null || service !== null || modal !== null
  useEffect(() => {
    document.body.classList.toggle('portal-lock', locked)
    return () => document.body.classList.remove('portal-lock')
  }, [locked])

  const inspected = lead(open ?? undefined)
  const profiled = lead(profile ?? undefined)
  const serviced = services?.find(s => s.id === service)
  let sheet: React.ReactNode = null
  if (modal) {
    const l = 'id' in modal ? lead(modal.id) : undefined
    switch (modal.type) {
      case 'intake': sheet = <IntakeModal />; break
      case 'compose': sheet = l && <ComposeModal lead={l} />; break
      case 'reminder': sheet = l && <ReminderModal lead={l} />; break
      case 'lost': sheet = l && <LostModal lead={l} />; break
      case 'client': sheet = l && <ClientSignModal lead={l} />; break
      case 'send-docs': sheet = l && <SendDocumentsModal lead={l} />; break
      case 'request-payment': sheet = l && <RequestPaymentModal lead={l} />; break
      case 'pick-services': sheet = l && <PickServicesModal lead={l} next={modal.next} />; break
      case 'newcamp': sheet = <CampaignBuilder kind={modal.kind} />; break
      default: sheet = <AccountSheet kind={modal.type} />
    }
  }
  return <div>{serviced && <ServicePanel key={serviced.id} service={serviced} startEditing={serviceEdit} />}{profiled && <LeadProfile lead={profiled} />}{inspected && <LeadInspector lead={inspected} />}{sheet}</div>
}
