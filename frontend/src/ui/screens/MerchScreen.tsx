import { StickerCard } from '../components/StickerCard'

export function MerchScreen() {
  return (
    <div className="space-y-4">
      <StickerCard title="Мерч">
        <div className="text-sm">
          <div className="font-black">Скоро будет доступно</div>
          <div className="opacity-80">Стикеры, футболки и прочий шахматный панк.</div>
        </div>
      </StickerCard>
    </div>
  )
}

