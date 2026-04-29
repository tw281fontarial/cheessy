type TelegramUnsafeUser = {
  id?: number
  username?: string
  first_name?: string
  last_name?: string
  photo_url?: string
}

type TelegramWebApp = {
  initData?: string
  initDataUnsafe?: {
    user?: TelegramUnsafeUser
  }
  platform?: string
  version?: string
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

export async function waitForTelegramWebApp(
  attempts = 10,
  delayMs = 100,
): Promise<TelegramWebApp | undefined> {
  for (let i = 0; i < attempts; i += 1) {
    const wa = getTelegramWebApp()
    if (wa) return wa
    await new Promise((resolve) => window.setTimeout(resolve, delayMs))
  }
  return undefined
}

function isLikelyTelegramWebView(userAgent: string) {
  return /telegram|telegrambot|telegram-ios|telegram-android|tgweb/i.test(userAgent)
}

export function getTelegramDebugInfo() {
  const hasTelegramObject = Boolean(window.Telegram)
  const wa = getTelegramWebApp()
  const hasWebApp = Boolean(wa)
  const initData = wa?.initData ?? ''
  const unsafeUser = wa?.initDataUnsafe?.user
  const userAgent = window.navigator.userAgent
  const currentUrl = window.location.href
  const telegramScriptLoaded = Boolean(document.querySelector('script[src="https://telegram.org/js/telegram-web-app.js"]'))
  return {
    hasTelegramObject,
    hasWebApp,
    telegramScriptLoaded,
    initDataLength: initData.length,
    initDataPreview: initData ? `${initData.slice(0, 20)}...` : '',
    hasUnsafeUser: Boolean(unsafeUser),
    unsafeUserId: unsafeUser?.id ?? null,
    unsafeUsername: unsafeUser?.username ?? null,
    userAgent,
    currentUrl,
    isLikelyTelegramWebView: isLikelyTelegramWebView(userAgent),
    platform: wa?.platform ?? null,
    version: wa?.version ?? null,
  }
}
