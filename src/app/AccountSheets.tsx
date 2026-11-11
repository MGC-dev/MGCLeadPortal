import { useNavigate } from 'react-router-dom'
import { firmApi, systemApi, useQuery } from '../api'
import { toast } from '../shared/toast'
import { Icon } from '../shared/Icon'
import { Sheet, Tag } from '../shared/ui'
import { VIEWS, TABS } from './nav'
import { useUi } from './UiContext'
import { tourStore } from '../modules/tour/tourStore'

type Kind = 'more' | 'help' | 'account' | 'team'

function RowBtn({ icon, title, sub, onClick }: { icon: string; title: string; sub?: string; onClick: () => void }) {
  return (
    <li><button type="button" className="row" onClick={onClick}>
      <Icon name={icon} /><span className="row__main"><b>{title}</b>{sub && <span>{sub}</span>}</span><Icon name="chev" small className="chev" />
    </button></li>
  )
}

/** The small utility sheets: More (phone), Help, Account and Team. */
export function AccountSheet({ kind }: { kind: Kind }) {
  const { openModal, closeAll } = useUi()
  const navigate = useNavigate()
  const firm = useQuery(() => firmApi.get())
  const team = useQuery(() => firmApi.team()) ?? []
  const close = () => openModal(null)
  const go = (path: string) => { closeAll(); navigate(path) }

  if (kind === 'more') return (
    <Sheet title="More" onClose={close}>
      <ul className="group rows">
        {VIEWS.filter(v => !TABS.includes(v.id)).map(v => <RowBtn key={v.id} icon={v.icon} title={v.label} sub={v.sub} onClick={() => go(v.path)} />)}
        <RowBtn icon="help" title="Help and Resources" sub="The guided tour, setup guide and support" onClick={() => openModal({ type: 'help' })} />
      </ul>
    </Sheet>
  )
  if (kind === 'help') return (
    <Sheet title="Help and Resources" sub="Sample data only. Nothing is sent." info="Each firm runs its own workspace: its own team, data, domain and number." onClose={close}>
      <ul className="group rows">
        <RowBtn icon="arrow" title="Take the Guided Tour" sub="Seven steps, from firm onboarding to reports" onClick={() => { closeAll(); tourStore.restart() }} />
        <RowBtn icon="gear" title="Firm Setup Guide" sub="Verify your email domain and register texting" onClick={() => go('/settings')} />
        <RowBtn icon="messages" title="Contact Support" sub="The UNIR team replies within one business day" onClick={() => { close(); toast('Message sent to support', 'The UNIR team replies within one business day') }} />
        <RowBtn icon="bolt" title="Reset Sample Data" sub="Start again with the sample firm" onClick={async () => { close(); tourStore.set({ leadId: null, step: 0 }); await systemApi.reset() }} />
      </ul>
    </Sheet>
  )
  if (kind === 'account') return (
    <Sheet title="Sarah Mitchell" sub={`Intake Manager, ${firm?.name ?? ''}`} onClose={close}>
      <ul className="group rows">
        <RowBtn icon="leads" title="Team and Permissions" sub="Your firm invites its own people and sets who can do what" onClick={() => openModal({ type: 'team' })} />
        <RowBtn icon="gear" title="Firm Settings" sub="Your sending domain, texting number and workspace" onClick={() => go('/settings')} />
        <RowBtn icon="arrow" title="Sign Out" onClick={() => { close(); toast('Signed out', 'Sign-out is not connected yet, you stay signed in') }} />
      </ul>
    </Sheet>
  )
  return (
    <Sheet title="Team and Permissions" sub={`${firm?.name ?? ''} manages who has access.`} onClose={close}>
      <ul className="group rows">
        {team.map(m => (
          <li key={m.name}><div className="row" style={{ cursor: 'default' }}>
            <span className="avatar" style={{ background: 'var(--tint-soft)', color: 'var(--tint-soft-ink)' }} aria-hidden="true">{m.name.split(' ').map(x => x[0]).join('')}</span>
            <span className="row__main"><b>{m.name}</b><span>{m.role}</span></span>
            <Tag tone={m.permission === 'Admin' ? 'accent' : undefined}>{m.permission}</Tag>
          </div></li>
        ))}
      </ul>
      <div className="sheet__foot" style={{ padding: 0 }}>
        <button className="btn btn--prominent" type="button" onClick={() => { close(); toast('Invite sent', `Your teammate gets an email to join ${firm?.name}`) }}>Invite Teammate</button>
      </div>
    </Sheet>
  )
}
