/**
 * ImageLightbox — universal click-to-zoom viewer with zoom & pan controls.
 *
 * Usage:
 *   1. Wrap the app with <LightboxProvider> (done in App.tsx).
 *   2. Call `useLightbox().open(src, alt)` from any portrait component.
 *
 * Controls:
 *   - Scroll wheel    → zoom in / out centred on cursor
 *   - Click + drag    → pan (when scale > 1)
 *   - Touch drag      → pan (when scale > 1)
 *   - Double-click    → zoom in 2× at click point (or reset if already zoomed)
 *   - +/− buttons     → step zoom
 *   - Reset button    → back to 100%, centred
 *   - Overlay click   → close (only if not mid-drag)
 *   - Escape          → close
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
import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_SCALE  = 1;
const MAX_SCALE  = 5;
const STEP       = 0.25;
const WHEEL_STEP = 0.12;   // multiplicative per wheel tick

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// ── Context ───────────────────────────────────────────────────────────────────

type OpenFn = (src: string, alt: string, trigger?: Element | null) => void;

const LightboxContext = createContext<{ open: OpenFn } | null>(null);

export function useLightbox(): { open: OpenFn } {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error("useLightbox must be used inside <LightboxProvider>");
  return ctx;
}

// ── ToolbarBtn ────────────────────────────────────────────────────────────────

function ToolbarBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "none",
        background: "transparent",
        color: disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.85)",
        cursor: disabled ? "not-allowed" : "pointer",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "rgba(255,255,255,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

// ── LightboxModal — owns all zoom/pan state ───────────────────────────────────

type Offset = { x: number; y: number };

type ModalProps = {
  src: string;
  alt: string;
  onClose: () => void;
  closeRef: React.RefObject<HTMLButtonElement | null>;
};

function LightboxModal({ src, alt, onClose, closeRef }: ModalProps) {
  const [scale, setScale]         = useState(1);
  const [offset, setOffset]       = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging]   = useState(false);
  const wasDragging               = useRef(false);
  const dragStart                 = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const touchStart                = useRef<{ tx: number; ty: number; ox: number; oy: number } | null>(null);
  const containerRef              = useRef<HTMLDivElement>(null);
  const currentOffset             = useRef<Offset>({ x: 0, y: 0 });

  // Keep ref in sync with state (used in closures that shouldn't re-subscribe)
  useEffect(() => { currentOffset.current = offset; }, [offset]);

  // Reset when image changes
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    wasDragging.current = false;
  }, [src]);

  // ── Zoom around a point (cx, cy relative to container centre) ────────────────

  const zoomAround = useCallback((newScaleRaw: number, cx: number, cy: number) => {
    setScale((prev) => {
      const next = clamp(newScaleRaw, MIN_SCALE, MAX_SCALE);
      const f    = next / prev;
      setOffset((o) => ({ x: cx + (o.x - cx) * f, y: cy + (o.y - cy) * f }));
      return next;
    });
  }, []);

  const stepZoom = useCallback((delta: number) => {
    setScale((prev) => {
      const next = clamp(prev + delta, MIN_SCALE, MAX_SCALE);
      const f    = next / prev;
      setOffset((o) => ({ x: o.x * f, y: o.y * f }));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // ── Wheel zoom ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect   = el.getBoundingClientRect();
      const cx     = e.clientX - rect.left  - rect.width  / 2;
      const cy     = e.clientY - rect.top   - rect.height / 2;
      const factor = e.deltaY < 0 ? 1 + WHEEL_STEP : 1 - WHEEL_STEP;
      // Read current scale via functional updater to avoid stale closure
      setScale((prev) => {
        const next = clamp(prev * factor, MIN_SCALE, MAX_SCALE);
        const f    = next / prev;
        setOffset((o) => ({ x: cx + (o.x - cx) * f, y: cy + (o.y - cy) * f }));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Mouse drag to pan ─────────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // If not zoomed in, only prevent default so we don't miss overlay clicks
    setScale((s) => {
      if (s <= 1) return s;

      e.preventDefault();
      e.stopPropagation();

      dragStart.current = {
        mx: e.clientX,
        my: e.clientY,
        ox: currentOffset.current.x,
        oy: currentOffset.current.y,
      };
      wasDragging.current = false;
      setDragging(true);

      const onMove = (ev: MouseEvent) => {
        wasDragging.current = true;
        setOffset({
          x: dragStart.current.ox + ev.clientX - dragStart.current.mx,
          y: dragStart.current.oy + ev.clientY - dragStart.current.my,
        });
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup",   onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup",   onUp);

      return s;
    });
  };

  // ── Touch drag to pan ─────────────────────────────────────────────────────────

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setScale((s) => {
      if (s <= 1) return s;
      const t = e.touches[0]!;
      touchStart.current = {
        tx: t.clientX, ty: t.clientY,
        ox: currentOffset.current.x,
        oy: currentOffset.current.y,
      };
      return s;
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current || e.touches.length !== 1) return;
    e.stopPropagation();
    const t = e.touches[0]!;
    setOffset({
      x: touchStart.current.ox + t.clientX - touchStart.current.tx,
      y: touchStart.current.oy + t.clientY - touchStart.current.ty,
    });
  };

  const handleTouchEnd = () => { touchStart.current = null; };

  // ── Double-click: zoom in at point, or reset if zoomed ───────────────────────

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      reset();
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left  - rect.width  / 2;
      const cy = e.clientY - rect.top   - rect.height / 2;
      zoomAround(2, cx, cy);
    }
  };

  // ── Overlay click (close, unless mid-drag) ────────────────────────────────────

  const handleOverlayClick = () => {
    if (wasDragging.current) { wasDragging.current = false; return; }
    onClose();
  };

  // ── Cursor ─────────────────────────────────────────────────────────────────────

  const cursor = scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in";

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Image viewer: ${alt}`}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backgroundColor: "rgba(0,0,0,0.90)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* ── Close button ───────────────────────────────────────────────── */}
      <button
        ref={closeRef}
        type="button"
        aria-label="Close image viewer"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 1,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,0.12)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.24)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
      >
        <X size={20} />
      </button>

      {/* ── Image ──────────────────────────────────────────────────────── */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          userSelect: "none",
          cursor,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: dragging ? "none" : "transform 0.12s ease-out",
          borderRadius: scale <= 1 ? 6 : 0,
          boxShadow: scale <= 1 ? "0 32px 80px rgba(0,0,0,0.9)" : "none",
          willChange: "transform",
        }}
      />

      {/* ── Zoom toolbar ───────────────────────────────────────────────── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 999,
          padding: "4px 8px",
          pointerEvents: "auto",
        }}
      >
        <ToolbarBtn
          title="Zoom out (−)"
          onClick={() => stepZoom(-STEP)}
          disabled={scale <= MIN_SCALE}
        >
          <ZoomOut size={15} />
        </ToolbarBtn>

        <span
          style={{
            color: "rgba(255,255,255,0.80)",
            fontSize: 12,
            fontWeight: 600,
            minWidth: 44,
            textAlign: "center",
            letterSpacing: "0.02em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(scale * 100)}%
        </span>

        <ToolbarBtn
          title="Zoom in (+)"
          onClick={() => stepZoom(STEP)}
          disabled={scale >= MAX_SCALE}
        >
          <ZoomIn size={15} />
        </ToolbarBtn>

        {scale !== 1 && (
          <>
            <div
              style={{
                width: 1,
                height: 18,
                background: "rgba(255,255,255,0.18)",
                margin: "0 4px",
                flexShrink: 0,
              }}
            />
            <ToolbarBtn title="Reset to 100%" onClick={reset}>
              <Maximize2 size={14} />
            </ToolbarBtn>
          </>
        )}
      </div>

      {/* ── Hint label (only at 100%) ──────────────────────────────────── */}
      {scale === 1 && (
        <p
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.35)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.04em",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          Scroll or + to zoom · Double-click to zoom in · Drag when zoomed
        </p>
      )}
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

type LightboxState = { src: string; alt: string } | null;

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [state, setState]   = useState<LightboxState>(null);
  const triggerRef          = useRef<Element | null>(null);
  const closeRef            = useRef<HTMLButtonElement | null>(null);

  const open: OpenFn = useCallback((src, alt, trigger) => {
    triggerRef.current = trigger ?? document.activeElement;
    setState({ src, alt });
  }, []);

  const close = useCallback(() => {
    setState(null);
    requestAnimationFrame(() => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    });
  }, []);

  // Escape key
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  // Lock body scroll
  useEffect(() => {
    if (!state) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [state]);

  // Auto-focus close button
  useEffect(() => {
    if (state) requestAnimationFrame(() => closeRef.current?.focus());
  }, [state]);

  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {state &&
        createPortal(
          <LightboxModal
            src={state.src}
            alt={state.alt}
            onClose={close}
            closeRef={closeRef}
          />,
          document.body,
        )}
    </LightboxContext.Provider>
  );
}
