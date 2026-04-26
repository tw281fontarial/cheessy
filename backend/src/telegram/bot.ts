import type { Env } from '../env'

export async function sendTelegramMessage(env: Env, chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`telegram sendMessage failed: ${res.status} ${body}`)
  }
}

export async function sendTelegramMessageWithWebAppButton(env: Env, chatId: number) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text:
        'Привет! Это Cheessy — мини-приложение для шахматных турниров.\n\n' +
        'Здесь можно смотреть турниры, регистрироваться и получать уведомления о партиях.',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Открыть Cheessy',
              web_app: {
                url: env.APP_BASE_URL,
              },
            },
          ],
        ],
      },
      disable_web_page_preview: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`telegram sendMessage with web_app failed: ${res.status} ${body}`)
  }
}

