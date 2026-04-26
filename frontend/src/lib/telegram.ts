type TelegramWebApp = {
  initData?: string
  initDataUnsafe?: unknown
  ready?: () => void
  expand?: () => void
  showAlert?: (message: string, callback?: () => void) => void
  showPopup?: (
    params: {
      title?: string
      message: string
      buttons?: Array<{ id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text: string }>
    },
    callback?: (buttonId: string) => void,
  ) => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp
}

