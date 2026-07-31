import Notification from "../models/Notification.js";

// Best-effort by design: a notification failing to write should never
// block or fail the actual action (accepting a request, matching a scrim,
// etc). Call sites don't need to await-and-handle this themselves.
export async function notify(userId, type, message, link = null) {
  try {
    await Notification.create({ user: userId, type, message, link });
  } catch (err) {
    console.error(`[notify] Failed to create notification for user ${userId}:`, err.message);
  }
}