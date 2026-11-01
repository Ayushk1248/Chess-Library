"use client";

import { useEffect } from "react";

// Applies focus containment to the existing dialogs without changing their actions.
export function DialogFocus() {
  useEffect(() => {
    const selector = 'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]';
    let active: HTMLElement | null = null;
    const previous = new Map<HTMLElement, HTMLElement | null>();
    const sync = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
      const next = dialogs.at(-1) ?? null;
      if (next === active) return;
      const old = active;
      active = next;
      if (old && !old.isConnected) {
        previous.get(old)?.focus();
        previous.delete(old);
      }
      if (next) {
        if (!previous.has(next)) previous.set(next, document.activeElement as HTMLElement | null);
        if (!next.contains(document.activeElement)) {
          (next.querySelector<HTMLElement>('[autofocus]') ?? next.querySelector<HTMLElement>(selector))?.focus();
        }
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (!active || event.key !== 'Tab') return;
      const controls = Array.from(active.querySelectorAll<HTMLElement>(selector)).filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !active.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', onKey);
    sync();
    return () => { observer.disconnect(); document.removeEventListener('keydown', onKey); };
  }, []);
  return null;
}
