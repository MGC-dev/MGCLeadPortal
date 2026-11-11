import { useEffect, useMemo, useState } from 'react'
import { IconCheck, IconX } from '@tabler/icons-react'
import { documentsApi, firmApi, leadsApi, servicesApi, useQuery } from '../../api'
import { DOC_CATEGORIES, type DocCategory, type DocField, type Lead, type PortalDocument } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { InfoTip } from '../../shared/InfoTip'
import { Select } from '../../shared/Select'
import { Sheet, Tag } from '../../shared/ui'
import { first } from '../../shared/format'
import { fromTicket, prefill, sourceLabel } from '../documents/documentFields'

type Values = Record<string, Record<string, string>>

const missing = (d: PortalDocument, v: Record<string, string> | undefined) => d.fields.filter(f => f.required && !(v?.[f.id] ?? '').trim())

/**
 * Send contract: opens from a ticket (the Send Contract button, or moving the card to Contract Sent).
 * Browse the library by category, tick one or more documents (from any category), and check their inputs,
 * which are filled from the ticket and can be adjusted.
 */
export function SendDocumentsModal({ lead: l }: { lead: Lead }) {
  const { openModal } = useUi()
  const docs = (useQuery(() => documentsApi.list()) ?? []).filter(d => d.active && d.file)
  const firm = useQuery(() => firmApi.get())
  const catalog = useQuery(() => servicesApi.list())
  const [category, setCategory] = useState<DocCategory | ''>('')
  const [selected, setSelected] = useState<string[]>([])
  const [focus, setFocus] = useState('')
  const [values, setValues] = useState<Values>({})
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const ready = docs.length > 0 && !!firm && !!catalog
  const close = () => openModal(null)

  // start on the engagement documents with the engagement letter selected, every document's inputs filled from the ticket
  useEffect(() => {
    if (!ready || Object.keys(values).length) return
    setValues(Object.fromEntries(docs.map(d => [d.id, prefill(d.fields, l, firm!.name, (l.serviceIds ?? []).map(id => catalog!.find(s => s.id === id)?.name).filter(Boolean).join(', '))])))
    const start = docs.find(d => d.category === 'Engagement') ?? docs[0]
    setSelected([start.id]); setFocus(start.id); setCategory(start.category)
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => DOC_CATEGORIES.filter(c => docs.some(d => d.category === c)), [docs])
  const inCategory = docs.filter(d => d.category === category)
  const current = docs.find(d => d.id === focus)
  const chosen = useMemo(() => docs.filter(d => selected.includes(d.id)), [docs, selected])
  const todo = chosen.reduce((n, d) => n + missing(d, values[d.id]).length, 0)

  const toggle = (id: string) => { setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id])); setFocus(id) }
  // picking from the dropdown adds the document to the contract (if it is not there yet) and shows its inputs
  const pick = (id: string) => { setSelected(s => (s.includes(id) ? s : [...s, id])); setFocus(id) }
  const openDoc = (d: PortalDocument) => { setCategory(d.category); setFocus(d.id) }
  const setValue = (docId: string, fieldId: string, v: string) => setValues(all => ({ ...all, [docId]: { ...all[docId], [fieldId]: v } }))

  const send = async () => {
    setTried(true)
    if (!chosen.length || todo > 0 || sending) return
    setSending(true)
    await leadsApi.sendDocuments(l.id, chosen.map(d => ({ templateId: d.id, name: d.name, values: values[d.id] ?? {} })))
    close()
  }

  const input = (d: PortalDocument, f: DocField) => {
    const v = values[d.id]?.[f.id] ?? ''
    const bad = tried && f.required && !v.trim()
    const common = { id: `sd-${d.id}-${f.id}`, value: v, 'aria-invalid': bad || undefined, onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setValue(d.id, f.id, e.target.value) }
    return (
      <div className={'sdoc__field' + (bad ? ' is-bad' : '')} key={f.id}>
        <label htmlFor={common.id}>
          <span>{f.label}{f.required && <i title="Required"> *</i>}</span>
          {fromTicket(f.source)
            ? <Tag tone="tint">From ticket</Tag>
            : f.source === 'manual' ? <Tag tone="orange">Type it in</Tag> : <Tag>{sourceLabel(f.source)}</Tag>}
        </label>
        {f.kind === 'longtext' ? <textarea {...common} rows={3} />
          : f.kind === 'money' ? <span className="sdoc__money"><i aria-hidden="true">$</i><input {...common} value={v.replace(/^\$/, '')} onChange={e => setValue(d.id, f.id, e.target.value ? '$' + e.target.value.replace(/^\$/, '') : '')} inputMode="decimal" /></span>
            : <input {...common} />}
        {bad && <small className="sdoc__err">This is needed before sending.</small>}
      </div>
    )
  }

  return (
    <Sheet className="sdoc" wide title="Send contract" sub={`To ${l.name} | ${l.matter}`} icon={<Icon name="doc" />} onClose={close}
      foot={
        <div className="sdoc__foot">
          <p className="sdoc__sum">
            {chosen.length === 0 ? 'Choose at least one document.'
              : <><b>{chosen.length}</b> {chosen.length === 1 ? 'document' : 'documents'} selected{todo > 0 ? <> · <span className="sdoc__todo">{todo} {todo === 1 ? 'input needs' : 'inputs need'} filling</span></> : <> · ready to send to {first(l.name)}</>}</>}
          </p>
          <button className="btn" type="button" onClick={close}>Cancel</button>
          <button className="btn btn--prominent" type="button" onClick={send} disabled={!chosen.length || sending}>
            <Icon name="doc" small />Send for signature
          </button>
        </div>
      }>
      {!ready ? (
        <div className="empty"><p>{docs.length === 0 && firm ? 'No documents are available. Add and activate one in Documents first.' : 'Loading documents…'}</p></div>
      ) : (
        <>
          {chosen.length > 0 && (
            <div className="sdoc__chips" role="group" aria-label="Selected documents">
              <span className="sdoc__chips-label">Sending</span>
              {chosen.map(d => (
                <span key={d.id} className={'sdoc__chip' + (focus === d.id ? ' is-focus' : '')}>
                  <button type="button" className="sdoc__chip-name" onClick={() => openDoc(d)}>{d.name}</button>
                  <button type="button" className="sdoc__chip-x" aria-label={`Remove ${d.name}`} onClick={() => toggle(d.id)}><IconX size={13} stroke={2.6} /></button>
                </span>
              ))}
            </div>
          )}

          <div className="sdoc__body">
            <nav className="sdoc__cats" aria-label="Document categories">
              <p className="lead__label">Categories</p>
              {categories.map(c => {
                const picked = chosen.filter(d => d.category === c).length
                return (
                  <button key={c} type="button" className={'sdoc__cat' + (category === c ? ' is-active' : '')} aria-current={category === c ? 'true' : undefined} onClick={() => {
                    setCategory(c)
                    // show the inputs of a document already chosen in this category; otherwise wait for a choice
                    if (!docs.some(d => d.id === focus && d.category === c)) setFocus(chosen.find(d => d.category === c)?.id ?? '')
                  }}>
                    <span className="sdoc__cat-name">{c}</span>
                    <span className="sdoc__cat-count">{picked > 0 && <em>{picked}<span className="vh"> selected</span></em>}</span>
                  </button>
                )
              })}
            </nav>

            <div className="sdoc__main">
              <div className="sdoc__pick">
                <div className="sdoc__label">
                  <label className="lead__label" htmlFor="sd-doc">{category} document</label>
                  <InfoTip label="About choosing documents" text={`${inCategory.length} ${inCategory.length === 1 ? 'document' : 'documents'} in ${category}. Pick one to add it, then pick more to send several together.`} />
                </div>
                <Select id="sd-doc" value={current && current.category === category ? current.id : ''} onChange={pick} placeholder="Choose a document"
                  options={inCategory.map(d => ({ value: d.id, label: d.name, hint: selected.includes(d.id) ? 'Added to this contract' : d.description || undefined }))} />
              </div>

              {current && current.category === category ? (
                <div className="sdoc__form">
                  <div className="sdoc__formhead">
                    <h3>{current.name}</h3>
                    <InfoTip label="About these inputs" text="Inputs are filled from this ticket where possible. Change anything that needs it." />
                  </div>
                  <div className={'sdoc__fields' + (selected.includes(current.id) ? '' : ' is-off')}>
                    {current.fields.length ? current.fields.map(f => input(current, f)) : <p className="caption">This document has no inputs.</p>}
                  </div>
                </div>
              ) : (
                <div className="sdoc__empty"><Icon name="doc" /><p>Choose a {category.toLowerCase()} document above to see the inputs it needs.</p></div>
              )}
            </div>
          </div>
        </>
      )}
    </Sheet>
  )
}
