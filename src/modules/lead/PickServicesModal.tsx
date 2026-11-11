import { useMemo, useState } from 'react'
import { IconCheck, IconSearch } from '@tabler/icons-react'
import { leadsApi, servicesApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import type { Lead } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Select } from '../../shared/Select'
import { Sheet, Tag } from '../../shared/ui'
import { first, money } from '../../shared/format'
import { feeOf, priceLabel, retainerLabel, retainerOf } from '../services/pricing'

/**
 * Which services is this client taking? A lookup into the Services catalog where several can be ticked.
 * Their default prices make up the ticket's estimated fee. `next` continues into the following step once saved.
 */
export function PickServicesModal({ lead: l, next }: { lead: Lead; next?: 'send-docs' | 'request-payment' }) {
  const { openModal } = useUi()
  const catalog = (useQuery(() => servicesApi.list()) ?? []).filter(s => s.active)
  const [selected, setSelected] = useState<string[]>(l.serviceIds ?? [])
  const [q, setQ] = useState('')
  const [practice, setPractice] = useState('all')
  const [saving, setSaving] = useState(false)
  const close = () => openModal(null)

  const term = q.trim().toLowerCase()
  const rows = useMemo(() => catalog.filter(s => (practice === 'all' || s.practice === practice) && (!term || `${s.name} ${s.description} ${s.practice}`.toLowerCase().includes(term))), [catalog, practice, term])
  const chosen = catalog.filter(s => selected.includes(s.id))
  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))

  const save = async () => {
    if (saving || (next && !chosen.length)) return
    setSaving(true)
    await leadsApi.setServices(l.id, chosen.map(s => s.id))
    if (next === 'send-docs') openModal({ type: 'send-docs', id: l.id })
    else if (next === 'request-payment') openModal({ type: 'request-payment', id: l.id })
    else close()
  }

  return (
    <Sheet className="pick" wide title="Services" sub={`For ${l.name} | ${l.matter}`} icon={<Icon name="services" />} onClose={close}
      foot={
        <div className="pick__foot">
          <p className="pick__sum">
            {chosen.length === 0 ? `Tick every service ${first(l.name)} is taking.`
              : <><b>{chosen.length}</b> {chosen.length === 1 ? 'service' : 'services'} · estimated fee <b>{money(feeOf(chosen))}</b>{retainerOf(chosen) > 0 && <> · retainer <b>{money(retainerOf(chosen))}</b></>}</>}
          </p>
          <button className="btn" type="button" onClick={close}>Cancel</button>
          <button className="btn btn--prominent" type="button" onClick={save} disabled={saving || (!!next && !chosen.length)}>
            {next ? 'Save and continue' : 'Save services'}
          </button>
        </div>
      }>
      <div className="pick__bar">
        <label className="pick__search"><IconSearch size={17} stroke={1.9} /><span className="vh">Search services</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search services" autoComplete="off" autoFocus /></label>
        <div className="pick__filter">
          <Select aria-label="Practice area" value={practice} onChange={setPractice}
            options={[{ value: 'all', label: 'All practice areas' }, ...config.practiceAreas.map(p => ({ value: p, label: p }))]} />
        </div>
      </div>

      <div className="pick__table" role="group" aria-label="Services">
        <div className="pick__head" aria-hidden="true"><span /><span>Service</span><span>Pricing</span><span>Retainer</span></div>
        {rows.length === 0 && <p className="pick__none">No services match.</p>}
        {rows.map(s => {
          const on = selected.includes(s.id)
          return (
            <button key={s.id} type="button" className={'pick__row' + (on ? ' is-on' : '')} role="checkbox" aria-checked={on} onClick={() => toggle(s.id)}>
              <span className="pick__check">{on && <IconCheck size={14} stroke={3} />}</span>
              <span className="pick__name"><b>{s.name}</b><small>{s.practice}</small></span>
              <span className="pick__price"><b>{priceLabel(s)}</b></span>
              <span className="pick__ret">{s.retainer > 0 ? retainerLabel(s) : <Tag>None</Tag>}</span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
