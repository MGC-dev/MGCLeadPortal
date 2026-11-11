import { useMemo, useState } from 'react'
import { tasksApi, leadsApi, servicesApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import type { Lead } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { type Col, DataTable, SortMenu, sortRows, useTableView } from '../../shared/DataTable'
import { HeaderActions } from '../../shared/HeaderActions'
import { ExpandingSearch, FilterMenu, OWNER_SECTION } from '../../shared/HeaderTools'
import { Empty, StageTag } from '../../shared/ui'
import { initials, money, when } from '../../shared/format'
import { SOURCES, STAGES, STAGE, isContact, nextStep, feeKnown } from '../lead/selectors'
import { PracticeTag } from '../../shared/PracticeTag'

// v2: the default columns changed (Email instead of Stage), so choices saved before that are ignored
const STORE = 'unir-leads-columns-v2'

export default function Leads() {
  const leads = useQuery(() => leadsApi.list())
  const tasks = useQuery(() => tasksApi.list()) ?? []
  const services = useQuery(() => servicesApi.list()) ?? []
  const { openProfile } = useUi()
  const [matter, setMatter] = useState('all')
  const [source, setSource] = useState('all')
  const [stage, setStage] = useState('all')
  const [owner, setOwner] = useState('all')
  const [q, setQ] = useState('')

  const serviceNames = (l: Lead) => (l.serviceIds ?? []).map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(', ')
  const cols = useMemo<Col<Lead>[]>(() => [
    { id: 'lead', label: 'Lead', locked: true, sort: l => l.name.toLowerCase(), render: l => (
      <span className="ltable__who">
        <span><b>{l.name}</b><small>{l.phone}</small></span>
      </span>) },
    { id: 'matter', label: 'Matter', defaultOn: true, sort: l => l.matter.toLowerCase(), render: l => <span className="ltable__matter"><b>{l.matter}</b><PracticeTag area={l.practice} /></span> },
    { id: 'email', label: 'Email', defaultOn: true, sort: l => l.email.toLowerCase(), render: l => { const [user, domain] = l.email.split('@'); return <span className="ltable__text">{user}@<wbr />{domain}</span> } },
    { id: 'fee', label: 'Fee', defaultOn: true, firstDir: 'desc', className: 'ltable__fee', sort: l => (feeKnown(l) ? l.value : -1), render: l => (feeKnown(l) ? money(l.value) : <span className="ltable__none">—</span>) },
    { id: 'owner', label: 'Owner', defaultOn: true, sort: l => l.owner.toLowerCase(), render: l => <span className="ltable__owner"><i aria-hidden="true">{initials(l.owner)}</i>{l.owner.split(' ')[0]}</span> },
    { id: 'stage', label: 'Stage', sort: l => (l.stage === 'lost' ? 99 : STAGE[l.stage].i), render: l => <StageTag lead={l} /> },
    { id: 'source', label: 'Source', sort: l => SOURCES[l.source].toLowerCase(), render: l => <span className="ltable__text">{SOURCES[l.source]}</span> },
    { id: 'service', label: 'Services', sort: l => serviceNames(l).toLowerCase() || '~', render: l => <span className="ltable__text">{serviceNames(l) || '—'}</span> },
    { id: 'next', label: 'Next step', firstDir: 'asc', sort: l => nextStep(l, tasks).due ?? Number.MAX_SAFE_INTEGER, render: l => <span className="ltable__text ltable__next">{nextStep(l, tasks).text}</span> },
    { id: 'received', label: 'Received', firstDir: 'desc', sort: l => l.created, render: l => <span className="ltable__text">{when(l.created)}</span> },
  ], [tasks, services])
  // "Received" first: newest enquiries on top
  const view = useTableView<Lead>(STORE, cols, { key: 'received', dir: 'desc' })

  const term = q.trim().toLowerCase()
  // a lead that has been provided a service is a contact now, so it is not listed here
  const filtered = (leads ?? []).filter(l => !isContact(l)).filter(l =>
    (matter === 'all' || l.practice === matter) && (source === 'all' || l.source === source) &&
    (stage === 'all' || l.stage === stage) && (owner === 'all' || l.owner === owner) &&
    (!term || `${l.name} ${l.email} ${l.phone} ${l.matter} ${l.practice} ${l.owner}`.toLowerCase().includes(term)))
  const rows = sortRows(filtered, view, (a, b) => b.created - a.created)

  return (
    <>
      <HeaderActions>
        <ExpandingSearch value={q} onChange={setQ} />
        <span className="only-phone-inline"><SortMenu view={view} label="Sort leads" /></span>
        <FilterMenu label="Filter leads" activeLabel="Filters applied" sections={[
          { title: 'Matter', value: matter, onChange: setMatter, options: [{ value: 'all', label: 'All matters', badge: null }, ...config.practiceAreas.map(m => ({ value: m, label: m, badge: null }))] },
          { title: 'Source', value: source, onChange: setSource, options: [{ value: 'all', label: 'All sources', badge: null }, ...Object.entries(SOURCES).map(([k, v]) => ({ value: k, label: v, badge: null }))] },
          { title: 'Stage', value: stage, onChange: setStage, options: [{ value: 'all', label: 'All stages', badge: null }, ...STAGES.filter(st => st.id !== 'delivered').map(st => ({ value: st.id, label: st.label, badge: null })), { value: 'lost', label: 'Lost', badge: null }] },
          OWNER_SECTION(owner, setOwner),
        ]} />
      </HeaderActions>

      {!leads ? null : !rows.length ? <Empty icon="leads">No leads match these filters.</Empty> : (
        <>
          <DataTable rows={rows} view={view} rowKey={l => l.id} onOpen={l => openProfile(l.id)} sortLabel="Sort leads" />
          <ul className="lcards only-phone">{rows.map(l => (
            <li key={l.id}>
              <button type="button" className="lcard" onClick={() => openProfile(l.id)}>
                <span className="lcard__top">
                  <span className="lcard__who"><b>{l.name}</b><small>{l.matter}</small></span>{feeKnown(l) && <span className="lcard__fee num">{money(l.value)}</span>}</span>
                <span className="lcard__meta"><StageTag lead={l} /><PracticeTag area={l.practice} /></span>
              </button>
            </li>
          ))}</ul>
        </>
      )}
    </>
  )
}
