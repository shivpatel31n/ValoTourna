// Posts a message into a Discord channel via an Incoming Webhook.
// This is separate from the public Discord invite link used in the UI —
// a webhook lets the backend post messages, it doesn't let people join.
//
// To set one up: in your Discord server go to
// Server Settings -> Integrations -> Webhooks -> New Webhook, pick the
// channel you want notifications posted into (e.g. #scrim-requests),
// then copy the Webhook URL into DISCORD_WEBHOOK_URL in your .env.
//
// If DISCORD_WEBHOOK_URL isn't set, this silently no-ops — notifications
// just won't be posted to Discord, nothing breaks.

export async function postToDiscord(content) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      console.error("Discord webhook responded with", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("Discord webhook post failed:", err.message);
  }
}