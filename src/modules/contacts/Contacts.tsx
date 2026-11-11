import { useMemo, useState } from 'react'
import { leadsApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import type { Lead } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { type Col, DataTable, SortMenu, sortRows, useTableView } from '../../shared/DataTable'
import { HeaderActions } from '../../shared/HeaderActions'
import { ExpandingSearch, FilterMenu, OWNER_SECTION } from '../../shared/HeaderTools'
import { Empty } from '../../shared/ui'
import { initials, money, when } from '../../shared/format'
import { SOURCES, contactSince, isContact } from '../lead/selectors'
import { PracticeTag } from '../../shared/PracticeTag'

const STORE = 'unir-contacts-columns-v2'

/**
 * Contacts are leads that have been provided a service (they reached the success stage).
 * A record is either a lead or a contact, never both: see CONTACT_STAGE in lead/selectors.
 */
export default function Contacts() {
  const leads = useQuery(() => leadsApi.list())
  const { openProfile } = useUi()
  const [matter, setMatter] = useState('all')
  const [source, setSource] = useState('all')
  const [owner, setOwner] = useState('all')
  const [q, setQ] = useState('')

  const cols = useMemo<Col<Lead>[]>(() => [
    { id: 'contact', label: 'Contact', locked: true, sort: l => l.name.toLowerCase(), render: l => (
      <span className="ltable__who">
        <span><b>{l.name}</b><small>{l.email}</small></span>
      </span>) },
    { id: 'phone', label: 'Phone', defaultOn: true, sort: l => l.phone, render: l => <span className="ltable__text ltable__phone">{l.phone}</span> },
    { id: 'matter', label: 'Matter', defaultOn: true, sort: l => l.matter.toLowerCase(), render: l => <span className="ltable__matter"><b>{l.matter}</b><PracticeTag area={l.practice} /></span> },
    { id: 'owner', label: 'Owner', defaultOn: true, sort: l => l.owner.toLowerCase(), render: l => <span className="ltable__owner"><i aria-hidden="true">{initials(l.owner)}</i>{l.owner.split(' ')[0]}</span> },
    { id: 'since', label: 'Contact since', defaultOn: false, firstDir: 'desc', sort: l => contactSince(l), render: l => <span className="ltable__text">{when(contactSince(l))}</span> },
    { id: 'fee', label: 'Fee', firstDir: 'desc', className: 'ltable__fee', sort: l => l.value, render: l => money(l.value) },
    { id: 'source', label: 'Source', sort: l => SOURCES[l.source].toLowerCase(), render: l => <span className="ltable__text">{SOURCES[l.source]}</span> },
    { id: 'received', label: 'First enquiry', firstDir: 'desc', sort: l => l.created, render: l => <span className="ltable__text">{when(l.created)}</span> },
  ], [])
  // most recent contacts first
  const view = useTableView<Lead>(STORE, cols, { key: 'since', dir: 'desc' })

  const term = q.trim().toLowerCase()
  const filtered = (leads ?? []).filter(isContact).filter(l =>
    (matter === 'all' || l.practice === matter) && (source === 'all' || l.source === source) && (owner === 'all' || l.owner === owner) &&
    (!term || `${l.name} ${l.email} ${l.phone} ${l.matter} ${l.practice} ${l.owner}`.toLowerCase().includes(term)))
  const rows = sortRows(filtered, view, (a, b) => contactSince(b) - contactSince(a))

  return (
    <>
      <HeaderActions>
        <ExpandingSearch value={q} onChange={setQ} />
        <span className="only-phone-inline"><SortMenu view={view} label="Sort contacts" /></span>
        <FilterMenu label="Filter contacts" activeLabel="Filters applied" sections={[
          { title: 'Matter', value: matter, onChange: setMatter, options: [{ value: 'all', label: 'All matters', badge: null }, ...config.practiceAreas.map(m => ({ value: m, label: m, badge: null }))] },
          { title: 'Source', value: source, onChange: setSource, options: [{ value: 'all', label: 'All sources', badge: null }, ...Object.entries(SOURCES).map(([k, v]) => ({ value: k, label: v, badge: null }))] },
          OWNER_SECTION(owner, setOwner),
        ]} />
      </HeaderActions>

      {!leads ? null : !rows.length
        ? <Empty icon="contacts">{(leads ?? []).some(isContact) ? 'No contacts match these filters.' : 'No contacts yet. A lead becomes a contact once its services are provided.'}</Empty>
        : (
          <>
            <DataTable rows={rows} view={view} rowKey={l => l.id} onOpen={l => openProfile(l.id)} sortLabel="Sort contacts" />
            <ul className="lcards only-phone">{rows.map(l => (
              <li key={l.id}>
                <button type="button" className="lcard" onClick={() => openProfile(l.id)}>
                  <span className="lcard__top">
                    <span className="lcard__who"><b>{l.name}</b><small>{l.phone}</small></span></span>
                  <span className="lcard__meta"><PracticeTag area={l.practice} /><span className="caption">Contact since {when(contactSince(l))}</span></span>
                </button>
              </li>
            ))}</ul>
          </>
        )}
    </>
  )
}
