import type { ButtonHTMLAttributes } from 'react'

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'black' | 'yellow' | 'danger' }) {
  const { className, variant = 'black', ...rest } = props
  const base =
    'w-full rounded-xl border border-white/10 px-4 py-2.5 font-bold tracking-wide active:translate-y-[1px] disabled:opacity-50'
  const themed =
    variant === 'yellow'
      ? 'bg-[#FFD84D] text-black'
      : variant === 'danger'
        ? 'bg-[#ff2d2d] text-white'
        : 'bg-[var(--tg-theme-button-color,#2AABEE)] text-[var(--tg-theme-button-text-color,#fff)]'
  return <button className={[base, themed, className].filter(Boolean).join(' ')} {...rest} />
}

