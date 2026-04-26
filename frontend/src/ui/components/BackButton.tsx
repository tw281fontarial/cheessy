import { useNavigate } from 'react-router-dom'

export function BackButton(props: { label?: string; className?: string; fallbackTo?: string }) {
  const nav = useNavigate()
  return (
    <button
      type="button"
      className={[
        'rounded-xl border border-white/20 bg-[#0f172a] px-3 py-2 text-xs font-bold text-white',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => {
        if (window.history.length > 1) nav(-1)
        else nav(props.fallbackTo ?? '/tournaments')
      }}
    >
      {props.label ?? '← Назад'}
    </button>
  )
}

