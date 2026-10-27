import { useState } from 'react'
import { agenda, communications } from '../api'
import { useQuery } from '../hooks'
import type { Message } from '../types'
import { AgendaModal, ComposeModal, ContactLink, TYPE_ICON, useContactIndex } from '../components/contacts'
import { Badge, Button, Card, Input, Modal, PageHeader, StatusBadge, Table, Tabs, Td } from '../components/ui'
import { ago, when } from '../format'

type Tab = 'all' | 'email' | 'sms' | 'meetings'

export default function Communication() {
  const msgs = useQuery(() => communications.list())
  const items = useQuery(() => agenda.list())
  const { resolve } = useContactIndex()
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Message>()
  const [compose, setCompose] = useState<{ reply?: Message } | undefined>()
  const [scheduling, setScheduling] = useState(false)

  const meetings = (items ?? []).filter(a => a.type === 'meeting' || a.type === 'call').sort((a, b) => b.dueAt.localeCompare(a.dueAt))
  const rows = (msgs ?? []).filter(m => (tab === 'all' || m.channel === tab) &&
    `${m.subject ?? ''} ${m.body} ${resolve(m).name}`.toLowerCase().includes(q.toLowerCase()))
  const n = (c: 'email' | 'sms') => msgs?.filter(m => m.channel === c).length ?? 0

  return (
    <>
      <PageHeader title="Communication" subtitle="Emails, texts and meetings with every lead and client"
        actions={<>
          <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="!w-52" />
          <Button variant="secondary" onClick={() => setScheduling(true)}>+ Meeting</Button>
          <Button onClick={() => setCompose({})}>+ New message</Button>
        </>} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'all', label: `All (${msgs?.length ?? 0})` }, { key: 'email', label: `Emails (${n('email')})` },
        { key: 'sms', label: `Texts (${n('sms')})` }, { key: 'meetings', label: `Meetings (${meetings.length})` },
      ]} />

      {tab === 'meetings' ? (
        <Card>
          <Table head={['Meeting', 'With', 'When', 'Host', 'Status']} empty={meetings.length ? undefined : 'No meetings or calls yet'}>
            {meetings.map(a => (
              <tr key={a.id}>
                <Td><span className="font-medium text-slate-900">{TYPE_ICON[a.type]} {a.title}</span></Td>
                <Td><ContactLink r={a} /></Td>
                <Td>{when(a.dueAt)}</Td>
                <Td>{a.assignedTo}</Td>
                <Td>{a.done ? <StatusBadge status="closed" /> : new Date(a.dueAt) < new Date() ? <Badge tone="red">overdue</Badge> : <Badge tone="blue">upcoming</Badge>}{a.done && <span className="ml-1 text-xs text-slate-400">done</span>}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : (
        <Card>
          <Table head={['', 'Contact', 'Message', 'Source', 'When']} empty={rows.length ? undefined : 'No messages'}>
            {rows.map(m => (
              <tr key={m.id} onClick={() => setOpen(m)} className="cursor-pointer">
                <Td className="w-10 text-base">{m.channel === 'email' ? '✉' : '💬'}</Td>
                <Td className="whitespace-nowrap"><ContactLink r={m} /><br /><span className="text-xs text-slate-400">{m.direction === 'in' ? '← received' : '→ sent'}</span></Td>
                <Td className="max-w-md"><span className={`block truncate ${m.direction === 'in' ? 'font-medium text-slate-900' : 'text-slate-700'}`}>{m.subject ?? m.body}</span>{m.subject && <span className="block truncate text-xs text-slate-500">{m.body}</span>}</Td>
                <Td>{m.source ? <Badge tone="purple">{m.source}</Badge> : <span className="text-xs text-slate-400">manual</span>}</Td>
                <Td className="whitespace-nowrap">{ago(m.at)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {open && (
        <Modal title={open.subject ?? 'Text message'} onClose={() => setOpen(undefined)} wide>
          <p className="mb-3 text-xs text-slate-500">{open.direction === 'in' ? 'From' : 'To'} {resolve(open).name} · {open.channel === 'email' ? resolve(open).email : resolve(open).phone} · {when(open.at)}</p>
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-800">{open.body}</p>
          <div className="mt-4 flex justify-end"><Button onClick={() => { setCompose({ reply: open }); setOpen(undefined) }}>Reply</Button></div>
        </Modal>
      )}
      {compose && <ComposeModal replyTo={compose.reply} onClose={() => setCompose(undefined)} />}
      {scheduling && <AgendaModal defaultType="meeting" onClose={() => setScheduling(false)} />}
    </>
  )
}
