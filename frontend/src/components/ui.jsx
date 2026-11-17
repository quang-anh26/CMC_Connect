import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { initialsOf, mediaUrl } from "../utils/format";

export function Avatar({ name, src, size = "md", online }) {
  const url = mediaUrl(src);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(false);
    if (!url) return undefined;
    const img = new Image();
    let alive = true;
    img.onload = () => alive && setOk(true);
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  const node = (
    <div
      className={`avatar avatar-${size}`}
      style={ok ? { backgroundImage: `url("${url}")` } : undefined}
      title={name || undefined}
    >
      {!ok && initialsOf(name)}
    </div>
  );
  if (online === undefined) return node;
  return (
    <span className="online-avatar">
      {node}
      {online && <i />}
    </span>
  );
}

export function Button({ children, variant = "primary", icon, onClick, disabled, type = "button", title }) {
  return (
    <button type={type} title={title} disabled={disabled} className={`button button-${variant}`} onClick={onClick}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
}

export function EmptyState({ title, copy, icon = "search" }) {
  return (
    <div className="empty-state">
      <span>
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {copy && <p>{copy}</p>}
    </div>
  );
}

export function Loading({ label = "Đang tải..." }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="empty-state" role="alert">
      <span style={{ color: "var(--red)" }}>
        <Icon name="close" size={26} />
      </span>
      <h3>Không thể tải dữ liệu</h3>
      <p>{message || "Đã có lỗi xảy ra. Vui lòng thử lại."}</p>
      {onRetry && (
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      )}
    </div>
  );
}

export function Modal({ title, close, children, wide, className = "", backdropClassName = "", portal = false, preservePage = false }) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && closeRef.current();
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousScrollbarGutter = document.documentElement.style.scrollbarGutter;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyLeft = document.body.style.left;
    const previousBodyWidth = document.body.style.width;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const currentBodyPaddingRight = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    document.documentElement.style.overflow = "hidden";
    if (preservePage) {
      document.documentElement.style.scrollbarGutter = "auto";
      document.body.style.position = "fixed";
      document.body.style.top = `${-scrollY}px`;
      document.body.style.left = `${-scrollX}px`;
      document.body.style.width = "100vw";
      if (scrollbarWidth) document.body.style.paddingRight = `${currentBodyPaddingRight + scrollbarWidth}px`;
    } else {
      document.body.style.overflow = "hidden";
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.scrollbarGutter = previousScrollbarGutter;
      document.body.style.paddingRight = previousBodyPaddingRight;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.left = previousBodyLeft;
      document.body.style.width = previousBodyWidth;
      if (preservePage) window.scrollTo(scrollX, scrollY);
    };
  }, [preservePage]);
  const modal = (
    <div className={`modal-backdrop ${backdropClassName}`.trim()} onMouseDown={close}>
      <div className={`modal ${className}`.trim()} style={wide ? { width: "min(760px, 100%)" } : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={close} aria-label="Đóng">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
  return portal ? createPortal(modal, document.body) : modal;
}

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, kind = "success") => {
    setToast({ message, kind, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className={`app-toast ${toast.kind}`} role="status">
          <Icon name={toast.kind === "error" ? "close" : "check"} size={16} />
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// Gom trạng thái tải dữ liệu thật từ API: { data, loading, error, reload }.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    Promise.resolve()
      .then(fn)
      .then((data) => alive && setState({ data, loading: false, error: "" }))
      .catch((err) => {
        if (!alive) return;
        const message = err?.response?.data?.message || (err?.response ? "Máy chủ trả về lỗi." : "Không thể kết nối tới máy chủ.");
        setState({ data: null, loading: false, error: message });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return {
    ...state,
    reload: () => setTick((t) => t + 1),
    setData: (data) => setState((s) => ({
      ...s,
      data: typeof data === "function" ? data(s.data) : data,
    })),
  };
}
