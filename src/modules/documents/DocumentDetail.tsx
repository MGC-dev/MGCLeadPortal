import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconCloudUpload, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { documentsApi, useQuery, type DocumentInput } from '../../api'
import { DOC_CATEGORIES, type DocCategory, type DocField, type FieldKind, type FieldSource, type PortalDocument } from '../../api/types'
import { Icon } from '../../shared/Icon'
import { Select } from '../../shared/Select'
import { Tag } from '../../shared/ui'
import { toast } from '../../shared/toast'
import { when } from '../../shared/format'
import { KIND_OPTIONS, SOURCE_OPTIONS, fromTicket, kindLabel, sourceLabel } from './documentFields'
import { fileUrl, formatSize, rememberFile } from './fileStore'
import { InfoTip } from '../../shared/InfoTip'

const toInput = (d: PortalDocument): DocumentInput => ({ name: d.name, category: d.category, description: d.description, file: d.file, fields: d.fields.map(f => ({ ...f })), active: d.active })
const newField = (): DocField => ({ id: 'f' + Math.random().toString(36).slice(2, 8), label: '', source: 'manual', kind: 'text', required: false })

/** One document in full: its file, its details and the inputs it needs. The pencil switches the whole page to editing. */
export default function DocumentDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const docs = useQuery(() => documentsApi.list())
  const doc = docs?.find(d => d.id === id)
  const [editing, setEditing] = useState(!!(location.state as { edit?: boolean } | null)?.edit)
  const [draft, setDraft] = useState<DocumentInput>()
  const [error, setError] = useState('')
  const picker = useRef<HTMLInputElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing && doc && !draft) setDraft(toInput(doc)) }, [editing, doc, draft])
  useEffect(() => { if (editing && draft) nameInput.current?.focus() }, [editing, !!draft]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!docs) return null
  if (!doc) return (
    <div className="docv">
      <button type="button" className="docv__back" onClick={() => navigate('/documents')}><IconArrowLeft size={16} stroke={2.2} />Documents</button>
      <div className="group empty"><Icon name="folder" /><p>This document no longer exists.</p></div>
    </div>
  )

  const view = editing && draft ? draft : toInput(doc)
  const set = (patch: Partial<DocumentInput>) => setDraft(d => (d ? { ...d, ...patch } : d))
  const setField = (fid: string, patch: Partial<DocField>) => set({ fields: view.fields.map(f => (f.id === fid ? { ...f, ...patch } : f)) })

  const startEdit = () => { setDraft(toInput(doc)); setError(''); setEditing(true) }
  const cancel = () => { setEditing(false); setDraft(undefined); setError('') }
  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) return setError('Give the document a name.')
    if (draft.fields.some(f => !f.label.trim())) return setError('Every input needs a label.')
    await documentsApi.update(doc.id, { ...draft, name: draft.name.trim(), fields: draft.fields.map(f => ({ ...f, label: f.label.trim() })) })
    setEditing(false); setDraft(undefined); setError('')
  }
  const remove = async () => {
    if (!confirm(`Delete “${doc.name}”? This cannot be undone.`)) return
    await documentsApi.remove(doc.id)
    navigate('/documents')
  }
  const onFile = (f?: File | null) => {
    if (!f) return
    rememberFile(doc.id, f)
    set({ file: { name: f.name, size: f.size, type: f.type || 'application/octet-stream', uploadedAt: Date.now() } })
  }
  const openFile = () => {
    const url = fileUrl(doc.id)
    if (url) window.open(url, '_blank', 'noopener')
    else toast('Sample file', 'The original file is only kept while this tab stays open')
  }

  return (
    <div className="docv">
      <button type="button" className="docv__back" onClick={() => navigate('/documents')}><IconArrowLeft size={16} stroke={2.2} />Documents</button>

      <section className="docv__head">
        <span className="docv__icon" aria-hidden="true"><Icon name="doc" /></span>
        <div className="docv__title">
          {editing
            ? <input ref={nameInput} className="docv__name" aria-label="Document name" value={view.name} onChange={e => set({ name: e.target.value })} placeholder="Document name" />
            : <h2>{doc.name}</h2>}
          <div className="docv__meta">
            <Tag tone="tint">{view.category}</Tag>
            {view.active ? <Tag tone="green" icon="check">Active</Tag> : <Tag>Draft</Tag>}
            <span className="caption">Updated {when(doc.updatedAt)} by {doc.updatedBy}</span>
          </div>
        </div>
        <div className="docv__actions">
          {editing ? (
            <>
              <button className="btn" type="button" onClick={cancel}>Cancel</button>
              <button className="btn btn--prominent" type="button" onClick={save}>Save changes</button>
            </>
          ) : (
            <button type="button" className="docv__edit" aria-label="Edit document" title="Edit document" onClick={startEdit}><IconPencil size={18} stroke={2} />Edit</button>
          )}
        </div>
      </section>
      {error && <p className="docv__error" role="alert">{error}</p>}

      <div className="docv__grid">
        <section className="docv__card">
          <h3 className="lead__label">Document</h3>
          {view.file ? (
            <div className="docv__file">
              <span className="docv__filetile"><Icon name="doc" /></span>
              <div className="docv__fileinfo">
                <b>{view.file.name}</b>
                <span>{formatSize(view.file.size)} · uploaded {when(view.file.uploadedAt)}</span>
              </div>
              {editing
                ? <div className="docv__fileactions">
                    <button className="btn btn--sm" type="button" onClick={() => picker.current?.click()}><IconCloudUpload size={16} stroke={2} />Replace</button>
                    <button className="btn btn--sm btn--destructive" type="button" onClick={() => set({ file: null, active: false })}>Remove</button>
                  </div>
                : <button className="btn btn--sm" type="button" onClick={openFile}>Open</button>}
            </div>
          ) : editing ? (
            <button type="button" className="docv__drop" onClick={() => picker.current?.click()}
              onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
              <IconCloudUpload size={26} stroke={1.7} />
              <b>Upload the document</b>
              <span>Drop a PDF or Word file here, or click to browse</span>
            </button>
          ) : (
            <div className="docv__nofile"><Tag tone="orange">No file yet</Tag><span>Edit this document to upload the file.</span></div>
          )}
          <input ref={picker} type="file" hidden accept=".pdf,.doc,.docx" onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </section>

        <section className="docv__card">
          <h3 className="lead__label">Details</h3>
          <div className="docv__rows">
            <div className="docv__row">
              <span>Category</span>
              {editing ? <Select aria-label="Category" value={view.category} onChange={v => set({ category: v as DocCategory })} options={DOC_CATEGORIES.map(c => ({ value: c, label: c }))} /> : <b>{view.category}</b>}
            </div>
            <div className="docv__row docv__row--top">
              <span>Description</span>
              {editing
                ? <textarea className="docv__textarea" rows={3} value={view.description} onChange={e => set({ description: e.target.value })} placeholder="What is this document for?" />
                : <p>{view.description || <em>No description</em>}</p>}
            </div>
            <div className="docv__row">
              <span>Available when sending</span>
              <span className="docv__switch">
                <button type="button" className="switch" role="switch" aria-checked={view.active} aria-label="Available when sending" disabled={!editing || !view.file}
                  onClick={() => set({ active: !view.active })} />
                <em>{view.active ? 'On' : view.file ? 'Off' : 'Upload a file first'}</em>
              </span>
            </div>
          </div>
        </section>

        <section className="docv__card docv__card--wide">
          <div className="docv__cardhead">
            <div className="titlerow"><h3 className="lead__label">Inputs</h3><InfoTip text="What this document needs. Inputs filled from the ticket are completed automatically when it is sent." label="About inputs" /></div>
            {editing && <button className="btn btn--sm" type="button" onClick={() => set({ fields: [...view.fields, newField()] })}><IconPlus size={15} stroke={2.2} />Add input</button>}
          </div>

          {view.fields.length === 0 ? (
            <p className="docv__empty">No inputs yet.{editing ? ' Add the details this document needs, like the client name or the fee.' : ''}</p>
          ) : (
            <div className="docv__fields">
              <div className="docv__fhead" aria-hidden="true"><span>Input</span><span>Filled from</span><span>Type</span><span>Required</span><span /></div>
              {view.fields.map(f => (
                <div className="docv__frow" key={f.id}>
                  {editing ? (
                    <>
                      <input className="docv__input" aria-label="Input label" value={f.label} placeholder="Label, e.g. Client name" onChange={e => setField(f.id, { label: e.target.value })} />
                      <Select aria-label="Filled from" value={f.source} onChange={v => setField(f.id, { source: v as FieldSource })}
                        options={SOURCE_OPTIONS.map(o => ({ value: o.value, label: o.group === 'Ticket' ? `Ticket · ${o.label}` : o.label }))} />
                      <Select aria-label="Type" value={f.kind} onChange={v => setField(f.id, { kind: v as FieldKind })} options={KIND_OPTIONS} />
                      <label className="docv__check"><input type="checkbox" checked={!!f.required} onChange={e => setField(f.id, { required: e.target.checked })} /><span className="vh">Required</span></label>
                      <button type="button" className="docv__trash" aria-label={`Remove ${f.label || 'input'}`} onClick={() => set({ fields: view.fields.filter(x => x.id !== f.id) })}><IconTrash size={17} stroke={1.9} /></button>
                    </>
                  ) : (
                    <>
                      <b>{f.label}</b>
                      <span>{fromTicket(f.source) ? <Tag tone="tint">Ticket · {sourceLabel(f.source)}</Tag> : f.source === 'manual' ? <Tag tone="orange">Typed in when sending</Tag> : <Tag>{sourceLabel(f.source)}</Tag>}</span>
                      <span className="docv__kind">{kindLabel(f.kind)}</span>
                      <span>{f.required ? <Tag tone="green" icon="check">Required</Tag> : <span className="caption">Optional</span>}</span>
                      <span />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {editing && (
        <div className="docv__foot">
          <button type="button" className="btn btn--destructive" onClick={remove}><IconTrash size={16} stroke={1.9} />Delete document</button>
          <span className="docv__spacer" />
          <button className="btn" type="button" onClick={cancel}>Cancel</button>
          <button className="btn btn--prominent" type="button" onClick={save}>Save changes</button>
        </div>
      )}
    </div>
  )
}
