import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus } from '@tabler/icons-react'
import { documentsApi, useQuery } from '../../api'
import { DOC_CATEGORIES, type PortalDocument } from '../../api/types'
import { type Col, DataTable, SortMenu, sortRows, useTableView } from '../../shared/DataTable'
import { HeaderActions } from '../../shared/HeaderActions'
import { ExpandingSearch, FilterMenu } from '../../shared/HeaderTools'
import { Icon } from '../../shared/Icon'
import { Empty, Tag } from '../../shared/ui'
import { when } from '../../shared/format'

// v3: Updated is no longer a default column, so choices saved before that are ignored
const STORE = 'unir-documents-columns-v3'

/** The document library: every document the firm can send, with its file and the inputs it needs. */
export default function Documents() {
  const docs = useQuery(() => documentsApi.list())
  const navigate = useNavigate()
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')

  const cols = useMemo<Col<PortalDocument>[]>(() => [
    { id: 'name', label: 'Document', locked: true, sort: d => d.name.toLowerCase(), render: d => (
      <span className="ltable__who">
        <span className="ltable__avatar ltable__avatar--doc" aria-hidden="true"><Icon name="doc" /></span>
        <span><b>{d.name}</b><small className="doclist__desc">{d.description || 'No description'}</small></span>
      </span>) },
    { id: 'category', label: 'Category', defaultOn: true, sort: d => d.category, render: d => <Tag tone="tint">{d.category}</Tag> },
    { id: 'status', label: 'Status', defaultOn: true, sort: d => (d.active ? 0 : 1), render: d => d.active ? <Tag tone="green" icon="check">Active</Tag> : <Tag>Draft</Tag> },
    { id: 'updated', label: 'Updated', firstDir: 'desc', sort: d => d.updatedAt, render: d => <span className="ltable__text">{when(d.updatedAt)}<small className="doclist__size">{d.updatedBy}</small></span> },
    { id: 'created', label: 'Created', firstDir: 'desc', sort: d => d.createdAt, render: d => <span className="ltable__text">{when(d.createdAt)}</span> },
  ], [])
  const view = useTableView<PortalDocument>(STORE, cols, { key: 'updated', dir: 'desc' })

  const term = q.trim().toLowerCase()
  const filtered = (docs ?? []).filter(d =>
    (category === 'all' || d.category === category) && (status === 'all' || (status === 'active') === d.active) &&
    (!term || `${d.name} ${d.description} ${d.category}`.toLowerCase().includes(term)))
  const rows = sortRows(filtered, view, (a, b) => b.updatedAt - a.updatedAt)

  const add = async () => { const d = await documentsApi.create(); navigate(`/documents/${d.id}`, { state: { edit: true } }) }

  return (
    <>
      <HeaderActions>
        <button type="button" className="iconbtn iconbtn--primary" aria-label="Add document" title="Add document" onClick={add}><IconPlus size={19} stroke={2.2} /></button>
        <ExpandingSearch value={q} onChange={setQ} />
        <span className="only-phone-inline"><SortMenu view={view} label="Sort documents" /></span>
        <FilterMenu label="Filter documents" activeLabel="Filters applied" sections={[
          { title: 'Category', value: category, onChange: setCategory, options: [{ value: 'all', label: 'All categories', badge: null }, ...DOC_CATEGORIES.map(c => ({ value: c, label: c, badge: null }))] },
          { title: 'Status', value: status, onChange: setStatus, options: [{ value: 'all', label: 'All', badge: null }, { value: 'active', label: 'Active', badge: null }, { value: 'draft', label: 'Draft', badge: null }] },
        ]} />
      </HeaderActions>

      {!docs ? null : !rows.length ? <Empty icon="folder">No documents match these filters.</Empty> : (
        <>
          <DataTable rows={rows} view={view} rowKey={d => d.id} onOpen={d => navigate(`/documents/${d.id}`)} sortLabel="Sort documents" />
          <ul className="lcards only-phone">{rows.map(d => (
            <li key={d.id}>
              <button type="button" className="lcard" onClick={() => navigate(`/documents/${d.id}`)}>
                <span className="lcard__top"><span className="ltable__avatar ltable__avatar--doc" aria-hidden="true"><Icon name="doc" /></span>
                  <span className="lcard__who"><b>{d.name}</b><small>{d.description || 'No description'}</small></span></span>
                <span className="lcard__meta"><Tag tone="tint">{d.category}</Tag>{d.active ? <Tag tone="green" icon="check">Active</Tag> : <Tag>Draft</Tag>}</span>
              </button>
            </li>
          ))}</ul>
        </>
      )}
    </>
  )
}
