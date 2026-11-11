import { integrationsApi, useQuery } from '../../api'
import { Icon } from '../../shared/Icon'
import { Tag } from '../../shared/ui'

export default function Integrations() {
  const list = useQuery(() => integrationsApi.list())
  if (!list) return null
  return (
    <>
      <div className="grid3">{list.map(x => (
        <article className="group integ" key={x.id}>
          <div className="integ__top"><span className="integ__icon"><Icon name={x.icon} /></span>
            <div><h3>{x.name}</h3>{x.on ? <Tag tone="green" icon="check">Connected</Tag> : <Tag>Not Connected</Tag>}</div></div>
          <p className="secondary">{x.desc}</p>
          <button className={'btn btn--sm' + (x.on ? '' : ' btn--prominent')} type="button" onClick={() => integrationsApi.toggle(x.id)}>{x.on ? 'Disconnect' : 'Connect'}</button>
        </article>
      ))}</div>
      <p className="footnote" style={{ padding: '0 var(--s4)' }}>Sending from your own email domain and texting number is set up in Settings.</p>
    </>
  )
}
