"use client"

import { useEffect, useState } from "react";
import { NOTICE_EVENT, type NoticeDetail } from "@/lib/notify";

interface Notice extends NoticeDetail {
    id: number;
}

/**
 * Mounts a transient, non-blocking toast host that renders notices dispatched
 * via `notify(...)`. Styled with the existing Tailwind design tokens so it does
 * not introduce a new visual language; it is empty (renders nothing) unless a
 * notice is active, so the preserved surfaces are unaffected.
 */
export default function NoticeHost() {
    const [notices, setNotices] = useState<Notice[]>([]);

    useEffect(() => {
        let counter = 0;

        const onNotice = (event: Event) => {
            const detail = (event as CustomEvent<NoticeDetail>).detail;
            if (!detail?.message) return;

            const id = ++counter;
            setNotices((prev) => [...prev, { ...detail, id }]);

            window.setTimeout(() => {
                setNotices((prev) => prev.filter((notice) => notice.id !== id));
            }, 4000);
        };

        window.addEventListener(NOTICE_EVENT, onNotice);
        return () => window.removeEventListener(NOTICE_EVENT, onNotice);
    }, []);

    if (notices.length === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
            {notices.map((notice) => {
                const tone =
                    notice.level === "error"
                        ? "border-red-500/50 text-red-100"
                        : notice.level === "warn"
                        ? "border-amber-500/50 text-amber-100"
                        : "border-gray-200/50 dark:border-gray-700/50 text-gray-900 dark:text-gray-100";

                return (
                    <div
                        key={notice.id}
                        role="status"
                        className={`bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border ${tone} rounded-2xl shadow-xl px-4 py-2 text-sm max-w-md text-center`}
                    >
                        {notice.message}
                    </div>
                );
            })}
        </div>
    );
}
