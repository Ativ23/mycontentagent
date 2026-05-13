// Lightweight alerting — sends to Discord webhook if DISCORD_WEBHOOK_URL is set.
// Every call is fire-and-forget: a failed alert never crashes the calling code.

export type AlertLevel = 'info' | 'warn' | 'error' | 'critical'

interface AlertPayload {
  level: AlertLevel
  title: string
  message: string
  jobId?: string
  packageId?: string
  step?: string
}

const COLORS: Record<AlertLevel, number> = {
  info:     0x5865F2, // blurple
  warn:     0xFEE75C, // yellow
  error:    0xED4245, // red
  critical: 0xFF0000, // bright red
}

export function sendAlert(payload: AlertPayload): void {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  const ts = new Date().toISOString()
  const fields = [
    payload.jobId     ? { name: 'Job ID',     value: `\`${payload.jobId}\``,     inline: true } : null,
    payload.packageId ? { name: 'Package ID', value: `\`${payload.packageId}\``, inline: true } : null,
    payload.step      ? { name: 'Step',       value: payload.step,               inline: true } : null,
  ].filter(Boolean)

  const body = JSON.stringify({
    embeds: [{
      title:       `[${payload.level.toUpperCase()}] ${payload.title}`,
      description: payload.message,
      color:       COLORS[payload.level],
      fields,
      footer: { text: `stacksmadesimple.xyz • ${ts}` },
    }],
  })

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => { /* never crash on alert failure */ })
}
