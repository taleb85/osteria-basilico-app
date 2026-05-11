/**
 * Webhook sender per Slack, Teams e webhook custom.
 * Utilizzabile da Edge Functions o dal client per notifiche eventi.
 */

export interface WebhookPayload {
  event: 'shift.created' | 'shift.updated' | 'shift.deleted' | 'shift.published' | 'punch.created' | 'holiday.created' | 'holiday.approved';
  tenantId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export function buildSlackMessage(payload: WebhookPayload): { text: string; blocks: unknown[] } {
  const emoji: Record<string, string> = {
    'shift.created': '📅',
    'shift.updated': '✏️',
    'shift.deleted': '🗑️',
    'shift.published': '📢',
    'punch.created': '⏰',
    'holiday.created': '🌴',
    'holiday.approved': '✅',
  };
  const em = emoji[payload.event] ?? '🔔';
  const text = `${em} *${payload.event.replace('.', ' → ')}*\n\`\`\`${JSON.stringify(payload.data, null, 2)}\`\`\``;
  return {
    text: `${em} ${payload.event}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `FLOW · ${new Date(payload.timestamp).toLocaleString('it-IT')}` }] },
    ],
  };
}

export function buildTeamsMessage(payload: WebhookPayload): { title: string; text: string; sections: unknown[] } {
  const title = `FLOW: ${payload.event.replace('.', ' — ')}`;
  return {
    title,
    text: JSON.stringify(payload.data, null, 2),
    sections: [{ facts: Object.entries(payload.data).map(([k, v]) => ({ name: k, value: String(v) })) }],
  };
}

export async function sendWebhook(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}
