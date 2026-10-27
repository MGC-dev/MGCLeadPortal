import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Pipeline from './pages/Pipeline'
import Agenda from './pages/Agenda'
import Communication from './pages/Communication'
import Reports from './pages/Reports'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Services from './pages/Services'
import Documents from './pages/Documents'
import Payments from './pages/Payments'
import Marketing from './pages/Marketing'
import CampaignEditor from './pages/CampaignEditor'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="communication" element={<Communication />} />
          <Route path="reports" element={<Reports />} />
          <Route path="intake" element={<Navigate to="/pipeline" replace />} />
          <Route path="campaigns" element={<Navigate to="/marketing" replace />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="services" element={<Services />} />
          <Route path="documents" element={<Documents />} />
          <Route path="payments" element={<Payments />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="marketing/:id" element={<CampaignEditor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
