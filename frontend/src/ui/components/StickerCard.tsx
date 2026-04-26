import type { PropsWithChildren } from 'react'

export function StickerCard(
  props: PropsWithChildren<{ title?: string; right?: React.ReactNode; className?: string }>,
) {
  return (
    <section className={['sticker px-4 py-4', props.className].filter(Boolean).join(' ')}>
      {props.title ? (
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-base font-bold uppercase tracking-wide">{props.title}</h2>
          {props.right ? <div className="shrink-0">{props.right}</div> : null}
        </div>
      ) : null}
      {props.children}
    </section>
  )
}

