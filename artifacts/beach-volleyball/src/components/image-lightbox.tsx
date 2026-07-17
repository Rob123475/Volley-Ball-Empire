/**
 * ImageLightbox — universal click-to-zoom viewer.
 *
 * Usage:
 *   1. Wrap the app with <LightboxProvider> (done in App.tsx).
 *   2. Call `useLightbox().open(src, alt)` from any portrait component.
 *   3. The modal renders in a portal at document.body, above everything.
 *
 * Features:
 *  - Dark semi-transparent overlay; click overlay to close
 *  - X button with accessible label
 *  - Escape key closes
 *  - Focus restored to the trigger element after close
 *  - Body scroll locked while open
 *  - Image preserves aspect ratio, capped at 90vw / 90vh
 *  - Mobile-friendly tap-outside-to-close
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// ── Context ───────────────────────────────────────────────────────────────────

type OpenFn = (src: string, alt: string, trigger?: Element | null) => void;

const LightboxContext = createContext<{ open: OpenFn } | null>(null);

export function useLightbox(): { open: OpenFn } {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error("useLightbox must be used inside <LightboxProvider>");
  return ctx;
}

// ── Provider + Modal ──────────────────────────────────────────────────────────

type LightboxState = { src: string; alt: string } | null;

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [state, setState]       = useState<LightboxState>(null);
  const triggerRef              = useRef<Element | null>(null);
  const closeButtonRef          = useRef<HTMLButtonElement>(null);

  const open: OpenFn = useCallback((src, alt, trigger) => {
    triggerRef.current = trigger ?? document.activeElement;
    setState({ src, alt });
  }, []);

  const close = useCallback(() => {
    setState(null);
    // Restore focus to the element that triggered the viewer
    requestAnimationFrame(() => {
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    });
  }, []);

  // ESC key
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  // Lock body scroll while open
  useEffect(() => {
    if (!state) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [state]);

  // Auto-focus the close button when the lightbox opens
  useEffect(() => {
    if (state) {
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [state]);

  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {state &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Zoomed image: ${state.alt}`}
            className="fixed inset-0 flex items-center justify-center"
            style={{ zIndex: 99999, backgroundColor: "rgba(0,0,0,0.88)" }}
            onClick={close}
          >
            {/* Close button */}
            <button
              ref={closeButtonRef}
              onClick={close}
              aria-label="Close image viewer"
              className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Image — stop propagation so clicking the image itself doesn't close */}
            <img
              src={state.src}
              alt={state.alt}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "90vw",
                maxHeight: "90vh",
                objectFit: "contain",
                borderRadius: "6px",
                boxShadow: "0 32px 80px rgba(0,0,0,0.9)",
                userSelect: "none",
              }}
            />
          </div>,
          document.body,
        )}
    </LightboxContext.Provider>
  );
}
