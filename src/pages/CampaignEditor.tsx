import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { campaigns as api } from '../api'
import { useQuery } from '../hooks'
import { TRIGGERS, type Campaign, type CampaignStep, type CampaignTrigger, type StepType } from '../types'
import { Button, Card, Input, Label, PageHeader, Select, Stat, StatusBadge, Textarea } from '../components/ui'
import { pct } from '../format'

const STEP_LABEL: Record<StepType, string> = { email: '✉ Send email', sms: '💬 Send SMS', wait: '⏱ Wait', task: '☑ Create task' }
const VARS = ['{{first_name}}', '{{practice_area}}', '{{attorney}}', '{{booking_link}}', '{{payment_link}}']

export default function CampaignEditor() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const saved = useQuery(() => api.get(id), [id])
  const [draft, setDraft] = useState<Campaign>()
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (saved && !dirty) setDraft(saved) }, [saved, dirty])
  if (!draft) return null

  const edit = (patch: Partial<Campaign>) => { setDraft({ ...draft, ...patch }); setDirty(true) }
  const setStep = (sid: string, patch: Partial<CampaignStep>) => edit({ steps: draft.steps.map(s => (s.id === sid ? { ...s, ...patch } : s)) })
  const move = (i: number, d: -1 | 1) => {
    const steps = [...draft.steps]; const [s] = steps.splice(i, 1); steps.splice(i + d, 0, s); edit({ steps })
  }
  const st = draft.stats

  return (
    <>
      <Link to="/marketing" className="text-sm text-slate-500 hover:text-slate-800">← Marketing</Link>
      <PageHeader title={draft.name} subtitle={`Trigger: ${TRIGGERS[draft.trigger]}`}
        actions={<>
          <Button variant="danger" onClick={async () => { if (confirm('Delete this automation?')) { await api.remove(id); nav('/marketing') } }}>Delete</Button>
          <Button variant="secondary" onClick={() => edit({ status: draft.status === 'active' ? 'paused' : 'active' })}>{draft.status === 'active' ? 'Pause' : 'Activate'}</Button>
          <Button disabled={!dirty} onClick={async () => { await api.update(id, { name: draft.name, trigger: draft.trigger, status: draft.status, steps: draft.steps }); setDirty(false) }}>{dirty ? 'Save changes' : 'Saved'}</Button>
        </>} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Enrolled" value={st.enrolled} /><Stat label="Sent" value={st.sent} />
        <Stat label="Open rate" value={pct(st.opened, st.sent)} /><Stat label="Reply rate" value={pct(st.replied, st.sent)} />
        <Stat label="Converted" value={st.converted} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit space-y-3 p-5">
          <h2 className="font-semibold text-slate-900">Settings <StatusBadge status={draft.status} /></h2>
          <Label label="Name"><Input value={draft.name} onChange={e => edit({ name: e.target.value })} /></Label>
          <Label label="Starts when…"><Select value={draft.trigger} onChange={e => edit({ trigger: e.target.value as CampaignTrigger })}>
            {Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Label>
          <p className="text-xs text-slate-500">Merge fields: {VARS.join(' ')}</p>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          {draft.steps.map((s, i) => (
            <Card key={s.id} className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{i + 1}</span>
                <Select value={s.type} onChange={e => setStep(s.id, { type: e.target.value as StepType })} className="!w-40">
                  {Object.entries(STEP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                  <Button size="sm" variant="ghost" disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)}>↓</Button>
                  <Button size="sm" variant="ghost" onClick={() => edit({ steps: draft.steps.filter(x => x.id !== s.id) })}>✕</Button>
                </div>
              </div>
              <div className="space-y-3">
                <Label label={s.type === 'wait' ? 'Wait for (days)' : 'Send after (days)'}>
                  <Input type="number" min={0} value={s.delayDays} onChange={e => setStep(s.id, { delayDays: Number(e.target.value) })} className="!w-28" /></Label>
                {s.type !== 'wait' && <>
                  {s.type !== 'sms' && <Label label={s.type === 'task' ? 'Task title' : 'Subject'}><Input value={s.subject} onChange={e => setStep(s.id, { subject: e.target.value })} /></Label>}
                  <Label label={s.type === 'task' ? 'Details' : 'Message'}><Textarea value={s.body} onChange={e => setStep(s.id, { body: e.target.value })} /></Label>
                </>}
              </div>
            </Card>
          ))}
          <Button variant="secondary" onClick={() => edit({ steps: [...draft.steps, api.newStep()] })}>+ Add step</Button>
        </div>
      </div>
    </>
  )
}
