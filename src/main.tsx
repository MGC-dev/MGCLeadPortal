import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import './styles/tokens.css'
import './styles/portal.css'
import './styles/theme.css'
import AppShell from './app/AppShell'
import Dashboard from './modules/dashboard/Dashboard'
import Pipeline from './modules/pipeline/Pipeline'
import Leads from './modules/leads/Leads'
import Contacts from './modules/contacts/Contacts'
import Calendar from './modules/calendar/Calendar'
import Tasks from './modules/tasks/Tasks'
import Messages from './modules/messages/Messages'
import Campaigns from './modules/campaigns/Campaigns'
import CampaignDetail from './modules/campaigns/CampaignDetail'
import Chat from './modules/chat/Chat'
import Bots from './modules/bots/Bots'
import BillingDashboard from './modules/billing/BillingDashboard'
import Invoices from './modules/billing/Invoices'
import InvoiceDetail from './modules/billing/InvoiceDetail'
import Payments from './modules/billing/Payments'
import PaymentPlans from './modules/billing/PaymentPlans'
import Installments from './modules/billing/Installments'
import Documents from './modules/documents/Documents'
import DocumentDetail from './modules/documents/DocumentDetail'
import Reports from './modules/reports/Reports'
import Integrations from './modules/integrations/Integrations'
import Services from './modules/services/Services'
import Settings from './modules/settings/Settings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="leads" element={<Leads />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="agenda" element={<Navigate to="/tasks" replace />} />
          <Route path="messages" element={<Messages />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
          <Route path="billing" element={<BillingDashboard />} />
          <Route path="billing/invoices" element={<Invoices />} />
          <Route path="billing/invoices/new" element={<Invoices openCreateOnLoad />} />
          <Route path="billing/invoices/:id" element={<InvoiceDetail />} />
          <Route path="billing/payments" element={<Payments />} />
          <Route path="billing/payment-plans" element={<PaymentPlans />} />
          <Route path="billing/installments" element={<Installments />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents/:id" element={<DocumentDetail />} />
          <Route path="reports" element={<Reports />} />
          <Route path="chat" element={<Chat />} />
          <Route path="chat/:id" element={<Chat />} />
          <Route path="agents" element={<Bots />} />
          {/* Bots were renamed Agents: old links still land in the right place. */}
          <Route path="bots/*" element={<Navigate to="/agents" replace />} />
          <Route path="agents/:id" element={<Bots />} />
          <Route path="agents/:id/settings" element={<Bots />} />
          <Route path="services" element={<Services />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
