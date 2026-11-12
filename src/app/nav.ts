export interface View { id: string; path: string; label: string; icon: string; sub: string }

export const VIEWS: View[] = [
  { id: 'dashboard', path: '/', label: 'Dashboard', icon: 'dashboard', sub: 'What needs your attention today.' },
  { id: 'pipeline', path: '/pipeline', label: 'Pipeline', icon: 'pipeline', sub: 'Every lead from enquiry to services provided.' },
  { id: 'leads', path: '/leads', label: 'Leads', icon: 'leads', sub: 'Enquiries on their way to a service. Once services are provided, a lead becomes a contact.' },
  { id: 'contacts', path: '/contacts', label: 'Contacts', icon: 'contacts', sub: 'Clients who have been provided a service. A contact was a lead until its services were provided.' },
  { id: 'calendar', path: '/calendar', label: 'Calendar', icon: 'calendar', sub: 'Calls and follow-ups booked from the pipeline, alongside your firm’s own events.' },
  { id: 'tasks', path: '/tasks', label: 'Tasks', icon: 'tasks', sub: 'Every call, meeting, task and deadline in one place. Pipeline moves add the next step for you.' },
  { id: 'messages', path: '/messages', label: 'Messages', icon: 'messages', sub: 'Emails and texts, sent from your firm’s own domain and number.' },
  { id: 'campaigns', path: '/campaigns', label: 'Campaigns', icon: 'campaigns', sub: 'One-off and automatic emails and texts, from your firm’s own domain and number.' },
  { id: 'billing', path: '/billing', label: 'Billing & Payments', icon: 'reports', sub: 'Invoices, payments and financial activity for your organization.' },
  { id: 'documents', path: '/documents', label: 'Documents', icon: 'folder', sub: 'Engagement letters, their signing status, and the templates they come from.' },
  { id: 'reports', path: '/reports', label: 'Reports', icon: 'reports', sub: 'Where leads come from, what converts, and why leads are lost.' },
  { id: 'chat', path: '/chat', label: 'Chat', icon: 'orb', sub: 'Ask questions about your leads, tasks, documents and campaigns, or chat with one of your agents.' },
  { id: 'bots', path: '/agents', label: 'Agents', icon: 'bot', sub: 'AI agents that work for your firm. Each has its own instructions and only sees the tools you switch on.' },
  { id: 'services', path: '/services', label: 'Services', icon: 'services', sub: 'Everything the firm provides, with its default pricing. Pick a service when adding an enquiry to start from its price.' },
  { id: 'integrations', path: '/integrations', label: 'Integrations', icon: 'plug', sub: 'Connect your lead sources and calendars.' },
  { id: 'settings', path: '/settings', label: 'Settings', icon: 'gear', sub: 'Send from your own domain and number, with a separate reputation for every firm.' },
]
export const VIEW = Object.fromEntries(VIEWS.map(v => [v.id, v])) as Record<string, View>

export const NAV: { label: string; ids: string[] }[] = [
  { label: 'Workspace', ids: ['dashboard', 'pipeline', 'leads', 'contacts', 'calendar', 'tasks'] },
  { label: 'Outreach', ids: ['messages', 'campaigns'] },
  { label: 'Records', ids: ['documents', 'reports'] },
  { label: 'Finance', ids: ['billing'] },
  { label: 'Intelligence', ids: ['chat', 'bots'] },
  { label: 'Firm', ids: ['services', 'integrations', 'settings'] },
]
/** Phone tab bar. */
export const TABS = ['dashboard', 'pipeline', 'leads', 'tasks']
