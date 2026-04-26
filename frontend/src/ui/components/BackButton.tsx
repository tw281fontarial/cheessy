import { useNavigate } from 'react-router-dom'

export function BackButton() {
  const nav = useNavigate()
  return (
    <button
      type="button"
      className="text-xs font-black underline"
      onClick={() => {
        if (window.history.length > 1) nav(-1)
        else nav('/tournaments')
      }}
    >
      ← Назад
    </button>
  )
}

