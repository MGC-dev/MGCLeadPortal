import { useEffect, useRef, useState } from 'react'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import { servicesApi, type ServiceInput } from '../../api'
import { config } from '../../api/mockData'
import { PRICING_MODELS, type PricingModel, type Service } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Select } from '../../shared/Select'
import { Tag, usePhone } from '../../shared/ui'
import { when } from '../../shared/format'
import { parseAmount, priceLabel, priceUnit, retainerLabel } from './pricing'

const toInput = (s: Service): ServiceInput => ({ name: s.name, practice: s.practice, description: s.description, pricingModel: s.pricingModel, price: s.price, retainer: s.retainer, active: s.active })

/**
 * A service in a side panel: its default pricing and details. The pencil switches the panel to editing.
 * (Opened from the Services module; a new service opens straight in edit mode.)
 */
export function ServicePanel({ service: svc, startEditing }: { service: Service; startEditing: boolean }) {
  const { openService } = useUi()
  const phone = usePhone()
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState<ServiceInput>(() => toInput(svc))
  const [error, setError] = useState('')
  const panel = useRef<HTMLElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const close = () => openService(null)

  // focus the panel itself (not a button) so the key that opened it cannot also activate Close
  useEffect(() => { panel.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => { if (editing) nameInput.current?.focus() }, [editing])

  const view = editing ? draft : toInput(svc)
  const set = (patch: Partial<ServiceInput>) => setDraft(d => ({ ...d, ...patch }))
  const startEdit = () => { setDraft(toInput(svc)); setError(''); setEditing(true) }
  const cancel = () => { setEditing(false); setError('') }
  const save = async () => {
    if (!draft.name.trim()) return setError('Give the service a name.')
    if (draft.pricingModel === 'contingency' && draft.price > 100) return setError('A contingency percentage cannot be more than 100.')
    await servicesApi.update(svc.id, { ...draft, name: draft.name.trim() })
    setEditing(false); setError('')
  }
  const remove = async () => {
    if (!confirm(`Delete “${svc.name}”? Leads that enquired about it keep their details.`)) return
    await servicesApi.remove(svc.id)
    close()
  }
  const pct = view.pricingModel === 'contingency'
  const priceLabelText = pct ? 'Percentage' : view.pricingModel === 'flat' ? 'Fee' : view.pricingModel === 'hourly' ? 'Hourly rate' : 'Monthly fee'

  return (
    <>
      <div className={'scrim' + (phone ? '' : ' scrim--light')} onClick={close} />
      <aside ref={panel} tabIndex={-1} className="inspector lead svcp" role="dialog" aria-modal="true" aria-labelledby="sv-title">
        <span className="grabber" aria-hidden="true" />
        <div className="sheet-head lead__head">
          <span className="lead__avatar svcp__icon" aria-hidden="true"><Icon name="services" /></span>
          <div className="sheet-head__title">
            {editing
              ? <input ref={nameInput} className="svcp__name" aria-label="Service name" value={view.name} onChange={e => set({ name: e.target.value })} placeholder="Service name" />
              : <h2 id="sv-title">{svc.name}</h2>}
            <span className="footnote">{view.practice}</span>
          </div>
          {!editing && <button type="button" className="svcp__edit" aria-label="Edit service" title="Edit service" onClick={startEdit}><IconPencil size={17} stroke={2} /></button>}
          <button className="closebtn" type="button" onClick={close} aria-label="Close"><Icon name="x" /></button>
        </div>

        <div className="inspector__body">
          {error && <p className="docv__error" role="alert">{error}</p>}

          <section className="lead__section">
            <h3 className="lead__label">Default pricing</h3>
            {editing ? (
              <div className="svcp__fields">
                <div className="svcp__field"><label htmlFor="sv-model">Pricing</label>
                  <Select id="sv-model" aria-label="Pricing model" value={view.pricingModel} onChange={v => set({ pricingModel: v as PricingModel })}
                    options={(Object.entries(PRICING_MODELS) as [PricingModel, string][]).map(([k, label]) => ({ value: k, label }))} /></div>
                <div className="svcp__two">
                  <div className="svcp__field"><label htmlFor="sv-price">{priceLabelText}</label>
                    <span className="svcv__amount">
                      {!pct && <i aria-hidden="true">$</i>}
                      <input id="sv-price" className="docv__input" inputMode="decimal" aria-label="Default price" value={view.price ? String(view.price) : ''} placeholder="0" onChange={e => set({ price: parseAmount(e.target.value) })} />
                      {pct && <i className="is-suffix" aria-hidden="true">%</i>}
                    </span></div>
                  <div className="svcp__field"><label htmlFor="sv-retainer">Retainer</label>
                    <span className="svcv__amount">
                      <i aria-hidden="true">$</i>
                      <input id="sv-retainer" className="docv__input" inputMode="decimal" aria-label="Retainer" value={view.retainer ? String(view.retainer) : ''} placeholder="None" onChange={e => set({ retainer: parseAmount(e.target.value) })} />
                    </span></div>
                </div>
                <p className="caption">The retainer is requested at the Payment Pending stage, before work starts.</p>
              </div>
            ) : (
              <div className="svcv__summary">
                <div className="svcv__big"><b>{priceLabel(svc)}</b><span>{priceUnit[svc.pricingModel]}</span></div>
                <div className="svcv__tiles">
                  <div><span>Pricing model</span><b>{PRICING_MODELS[svc.pricingModel]}</b></div>
                  <div><span>Retainer</span><b>{retainerLabel(svc)}</b></div>
                </div>
              </div>
            )}
          </section>

          <section className="lead__section">
            <h3 className="lead__label">Details</h3>
            {editing ? (
              <div className="svcp__fields">
                <div className="svcp__field"><label htmlFor="sv-practice">Practice area</label>
                  <Select id="sv-practice" aria-label="Practice area" value={view.practice} onChange={v => set({ practice: v })} options={config.practiceAreas.map(p => ({ value: p, label: p }))} /></div>
                <div className="svcp__field"><label htmlFor="sv-desc">Description</label>
                  <textarea id="sv-desc" className="docv__textarea" rows={3} value={view.description} onChange={e => set({ description: e.target.value })} placeholder="What does this service include?" /></div>
                <div className="svcp__switchrow">
                  <span><b>Offered to clients</b><small>Off hides it when adding an enquiry.</small></span>
                  <button type="button" className="switch" role="switch" aria-checked={view.active} aria-label="Offered to clients" onClick={() => set({ active: !view.active })} />
                </div>
              </div>
            ) : (
              <>
                <dl className="lead__details">
                  <div><dt><Icon name="leads" small />Practice area</dt><dd>{svc.practice}</dd></div>
                  <div><dt><Icon name="check" small />Offered to clients</dt><dd>{svc.active ? <Tag tone="green" icon="check">Active</Tag> : <Tag>Inactive</Tag>}</dd></div>
                </dl>
                {svc.description && <p className="lead__notes">{svc.description}</p>}
              </>
            )}
          </section>

          {!editing && <p className="caption svcp__updated">Last updated {when(svc.updatedAt)}</p>}
        </div>

        {editing && (
          <div className="svcp__foot">
            <button type="button" className="btn btn--destructive" onClick={remove}><IconTrash size={16} stroke={1.9} />Delete</button>
            <span className="docv__spacer" />
            <button className="btn" type="button" onClick={cancel}>Cancel</button>
            <button className="btn btn--prominent" type="button" onClick={save}>Save changes</button>
          </div>
        )}
      </aside>
    </>
  )
}
