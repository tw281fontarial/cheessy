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

export function getTelegramDebugInfo() {
  const hasTelegramObject = Boolean(window.Telegram)
  const wa = getTelegramWebApp()
  const hasWebApp = Boolean(wa)
  const initData = wa?.initData ?? ''
  const unsafeUser = wa?.initDataUnsafe && (wa.initDataUnsafe as any).user
  return {
    hasTelegramObject,
    hasWebApp,
    initDataLength: initData.length,
    initDataPreview: initData ? `${initData.slice(0, 20)}...` : '',
    hasUnsafeUser: Boolean(unsafeUser),
    unsafeUserId: unsafeUser?.id ?? null,
    unsafeUsername: unsafeUser?.username ?? null,
    platform: (wa as any)?.platform ?? null,
    version: (wa as any)?.version ?? null,
  }
}

