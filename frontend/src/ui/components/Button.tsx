import type { ButtonHTMLAttributes } from 'react'

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'black' | 'yellow' | 'danger' }) {
  const { className, variant = 'black', ...rest } = props
  const base =
    'w-full rounded-xl border-4 border-black px-4 py-3 font-black uppercase tracking-wide active:translate-y-[1px] disabled:opacity-50'
  const themed =
    variant === 'yellow'
      ? 'bg-[#ffe600] text-black'
      : variant === 'danger'
        ? 'bg-[#ff2d2d] text-white'
        : 'bg-black text-white'
  return <button className={[base, themed, className].filter(Boolean).join(' ')} {...rest} />
}

