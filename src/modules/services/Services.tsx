import { useMemo, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { servicesApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import { PRICING_MODELS, type PricingModel, type Service } from '../../api/types'
import { type Col, DataTable, SortMenu, sortRows, useTableView } from '../../shared/DataTable'
import { useUi } from '../../app/UiContext'
import { HeaderActions } from '../../shared/HeaderActions'
import { ExpandingSearch, FilterMenu } from '../../shared/HeaderTools'
import { Icon } from '../../shared/Icon'
import { Empty, Tag } from '../../shared/ui'
import { when } from '../../shared/format'
import { priceLabel, retainerLabel } from './pricing'

const STORE = 'unir-services-columns-v1'

/** Everything the firm provides, with default pricing. Picking one when adding an enquiry starts from these numbers. */
export default function Services() {
  const services = useQuery(() => servicesApi.list())
  const { openService } = useUi()
  const [practice, setPractice] = useState('all')
  const [pricing, setPricing] = useState('all')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')

  const cols = useMemo<Col<Service>[]>(() => [
    { id: 'name', label: 'Service', locked: true, sort: s => s.name.toLowerCase(), render: s => (
      <span className="ltable__who">
        <span className="ltable__avatar ltable__avatar--doc" aria-hidden="true"><Icon name="services" /></span>
        <span><b>{s.name}</b><small className="doclist__desc">{s.description || 'No description'}</small></span>
      </span>) },
    { id: 'practice', label: 'Practice area', defaultOn: true, sort: s => s.practice, render: s => <Tag tone="tint">{s.practice}</Tag> },
    { id: 'pricing', label: 'Pricing', defaultOn: true, sort: s => s.pricingModel, render: s => <span className="ltable__text">{PRICING_MODELS[s.pricingModel]}</span> },
    { id: 'price', label: 'Default price', defaultOn: true, firstDir: 'desc', className: 'ltable__fee', sort: s => s.price, render: s => priceLabel(s) },
    { id: 'retainer', label: 'Retainer', defaultOn: true, firstDir: 'desc', className: 'ltable__fee', sort: s => s.retainer, render: s => <span className={s.retainer > 0 ? '' : 'ltable__none'}>{retainerLabel(s)}</span> },
    { id: 'status', label: 'Status', defaultOn: true, sort: s => (s.active ? 0 : 1), render: s => s.active ? <Tag tone="green" icon="check">Active</Tag> : <Tag>Inactive</Tag> },
    { id: 'updated', label: 'Updated', firstDir: 'desc', sort: s => s.updatedAt, render: s => <span className="ltable__text">{when(s.updatedAt)}</span> },
  ], [])
  const view = useTableView<Service>(STORE, cols, { key: 'name', dir: 'asc' })

  const term = q.trim().toLowerCase()
  const filtered = (services ?? []).filter(s =>
    (practice === 'all' || s.practice === practice) && (pricing === 'all' || s.pricingModel === pricing) &&
    (status === 'all' || (status === 'active') === s.active) &&
    (!term || `${s.name} ${s.description} ${s.practice}`.toLowerCase().includes(term)))
  const rows = sortRows(filtered, view, (a, b) => a.practice.localeCompare(b.practice) || a.name.localeCompare(b.name))

  const add = async () => { const s = await servicesApi.create(); openService(s.id, true) }

  return (
    <>
      <HeaderActions>
        <button type="button" className="iconbtn iconbtn--primary" aria-label="Add service" title="Add service" onClick={add}><IconPlus size={19} stroke={2.2} /></button>
        <ExpandingSearch value={q} onChange={setQ} />
        <span className="only-phone-inline"><SortMenu view={view} label="Sort services" /></span>
        <FilterMenu label="Filter services" activeLabel="Filters applied" sections={[
          { title: 'Practice area', value: practice, onChange: setPractice, options: [{ value: 'all', label: 'All practice areas', badge: null }, ...config.practiceAreas.map(p => ({ value: p, label: p, badge: null }))] },
          { title: 'Pricing', value: pricing, onChange: setPricing, options: [{ value: 'all', label: 'All pricing', badge: null }, ...(Object.entries(PRICING_MODELS) as [PricingModel, string][]).map(([k, v]) => ({ value: k, label: v, badge: null }))] },
          { title: 'Status', value: status, onChange: setStatus, options: [{ value: 'all', label: 'All', badge: null }, { value: 'active', label: 'Active', badge: null }, { value: 'inactive', label: 'Inactive', badge: null }] },
        ]} />
      </HeaderActions>

      {!services ? null : !rows.length ? <Empty icon="services">No services match these filters.</Empty> : (
        <>
          <DataTable rows={rows} view={view} rowKey={s => s.id} onOpen={s => openService(s.id)} sortLabel="Sort services" />
          <ul className="lcards only-phone">{rows.map(s => (
            <li key={s.id}>
              <button type="button" className="lcard" onClick={() => openService(s.id)}>
                <span className="lcard__top"><span className="ltable__avatar ltable__avatar--doc" aria-hidden="true"><Icon name="services" /></span>
                  <span className="lcard__who"><b>{s.name}</b><small>{s.practice}</small></span><span className="lcard__fee num">{priceLabel(s)}</span></span>
                <span className="lcard__meta"><Tag>{PRICING_MODELS[s.pricingModel]}</Tag>{s.active ? <Tag tone="green" icon="check">Active</Tag> : <Tag>Inactive</Tag>}</span>
              </button>
            </li>
          ))}</ul>
        </>
      )}
    </>
  )
}
