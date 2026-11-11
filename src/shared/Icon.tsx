import { ICON_SPRITE } from './iconSprite'

/** Renders the sprite once; <Icon/> references its symbols. */
export function IconSprite() {
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: ICON_SPRITE }} />
}

export function Icon({ name, small, className = '' }: { name: string; small?: boolean; className?: string }) {
  return <svg className={`icon${small ? ' icon--s' : ''}${className ? ' ' + className : ''}`} aria-hidden="true"><use href={`#i-${name}`} /></svg>
}
