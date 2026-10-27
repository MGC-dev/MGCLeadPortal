import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { campaigns as api } from '../api'
import { useQuery } from '../hooks'
import { TRIGGERS, type CampaignTrigger } from '../types'
import { Button, Card, Input, Label, Modal, PageHeader, Select, StatusBadge, Table, Td } from '../components/ui'
import { pct } from '../format'

export default function Marketing() {
  const list = useQuery(() => api.list())
  const [adding, setAdding] = useState(false)

  return (
    <>
      <PageHeader title="Marketing" subtitle="Automated campaigns that nurture leads and collect payments. Sends appear in Communication."
        actions={<Button onClick={() => setAdding(true)}>+ New campaign</Button>} />
      <Card>
        <Table head={['Campaign', 'Trigger', 'Steps', 'Enrolled', 'Open rate', 'Reply rate', 'Converted', 'Status']} empty={list?.length ? undefined : 'No campaigns yet'}>
          {list?.map(c => (
            <tr key={c.id}>
              <Td><Link to={`/marketing/${c.id}`} className="font-medium text-brand-600 hover:underline">{c.name}</Link></Td>
              <Td>{TRIGGERS[c.trigger]}</Td>
              <Td>{c.steps.length}</Td>
              <Td>{c.stats.enrolled}</Td>
              <Td>{pct(c.stats.opened, c.stats.sent)}</Td>
              <Td>{pct(c.stats.replied, c.stats.sent)}</Td>
              <Td>{c.stats.converted}</Td>
              <Td>
                <button onClick={() => api.update(c.id, { status: c.status === 'active' ? 'paused' : 'active' })} title="Click to toggle">
                  <StatusBadge status={c.status} />
                </button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      {adding && <NewCampaign onClose={() => setAdding(false)} />}
    </>
  )
}

function NewCampaign({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<CampaignTrigger>('lead_created')
  return (
    <Modal title="New campaign" onClose={onClose}>
      <form className="space-y-3" onSubmit={async e => { e.preventDefault(); const c = await api.create(name, trigger); onClose(); nav(`/marketing/${c.id}`) }}>
        <Label label="Name"><Input required value={name} onChange={e => setName(e.target.value)} /></Label>
        <Label label="Starts when…"><Select value={trigger} onChange={e => setTrigger(e.target.value as CampaignTrigger)}>
          {Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Label>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button>Create & edit</Button></div>
      </form>
    </Modal>
  )
}
