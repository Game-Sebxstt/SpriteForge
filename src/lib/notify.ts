/**
 * Lightweight, non-blocking user notice channel.
 *
 * The engine (which has no React access) and client hooks dispatch a browser
 * `CustomEvent` that a mounted host component listens for and renders as a
 * transient toast, reusing the existing design-system styling. This avoids a
 * blocking `alert(...)` and avoids coupling the engine to React.
 */

export const NOTICE_EVENT = "spriteforge:notice";

export type NoticeLevel = "info" | "warn" | "error";

export interface NoticeDetail {
    message: string;
    level: NoticeLevel;
}

/**
 * Dispatches a non-blocking notice to the notice host.
 * Safe to call from non-DOM contexts (no-op when `window` is unavailable).
 * @param message - The human-readable message to surface.
 * @param level - Severity used for styling (defaults to "info").
 */
export function notify(message: string, level: NoticeLevel = "info"): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent<NoticeDetail>(NOTICE_EVENT, { detail: { message, level } })
    );
}
