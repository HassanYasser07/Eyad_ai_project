/**
 * EYAD AI — Guest chat usage tracker.
 *
 * Centralized, configurable guest trial enforcement. An anonymous visitor
 * can send up to appConfig.guestChatLimit normal text-chat messages before
 * being asked to log in. The counter persists in sessionStorage (survives
 * page refresh, resets when the browser session ends or the user logs in).
 *
 * Creative generation is NOT counted here — it always requires login and is
 * gated separately in Chat.jsx before the engine is called.
 */
import { appConfig } from "@/config/app.config";

const COUNT_KEY = "eyad_guest_chat_count";
const PENDING_KEY = "eyad_pending_action";

export const guestUsageService = {
  getCount() {
    try {
      return parseInt(sessionStorage.getItem(COUNT_KEY) || "0", 10) || 0;
    } catch {
      return 0;
    }
  },

  increment() {
    try {
      sessionStorage.setItem(COUNT_KEY, String(this.getCount() + 1));
    } catch {}
  },

  getRemaining() {
    return Math.max(0, appConfig.guestChatLimit - this.getCount());
  },

  hasReachedLimit() {
    return this.getCount() >= appConfig.guestChatLimit;
  },

  reset() {
    try {
      sessionStorage.removeItem(COUNT_KEY);
    } catch {}
  },
};

/**
 * Store a pending chat/generation action so it can be resumed after the user
 * logs in. Used when a guest hits the chat limit or requests a creative
 * generation — the action is preserved and executed exactly once after
 * successful authentication.
 */
export function storePendingAction(action) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(action));
  } catch {}
}

export function getPendingAction() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearPendingAction() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {}
}

export default guestUsageService;