"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, X, XCircle } from "lucide-react";

type ToastType = "success" | "error";

export interface ToastInput {
  type: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
}

interface Toast extends ToastInput {
  id: string;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
}

interface UrlToastResult {
  toasts: ToastInput[];
  consumedParams: string[];
}

const ToastContext = createContext<ToastContextValue | null>(null);
const AUTO_DISMISS_MS = 4000;

let toastId = 0;

function nextToastId() {
  toastId += 1;
  return `toast-${toastId}`;
}

function collectUrlToasts(searchParams: URLSearchParams): UrlToastResult {
  const toasts: ToastInput[] = [];
  const consumedParams: string[] = [];

  if (searchParams.get("toast") === "login-success") {
    toasts.push({
      type: "success",
      title: "ログインしました",
      description: "ボランティーへようこそ。",
    });
    consumedParams.push("toast");
  }

  if (searchParams.get("error") === "auth") {
    toasts.push({
      type: "error",
      title: "ログインに失敗しました",
      description: "時間をおいてもう一度お試しください。",
    });
    consumedParams.push("error");
  }

  if (searchParams.get("error") === "suspended") {
    toasts.push({
      type: "error",
      title: "アカウントが凍結されています",
      description: "ご利用できません。お問い合わせください。",
    });
    consumedParams.push("error");
  }

  if (searchParams.get("accountDeleted") === "1") {
    toasts.push({
      type: "success",
      title: "アカウントを削除しました",
      description: "ご利用ありがとうございました。",
    });
    consumedParams.push("accountDeleted");
  }

  return { toasts, consumedParams };
}

function removeConsumedUrlParams(params: string[]) {
  if (params.length === 0) return;

  const url = new URL(window.location.href);
  params.forEach((param) => url.searchParams.delete(param));

  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

function ToastUrlObserver({
  showToast,
}: {
  showToast: (toast: ToastInput) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const lastHandledSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const signature = `${pathname}?${search}`;
    const { toasts, consumedParams } = collectUrlToasts(
      new URLSearchParams(search)
    );

    if (toasts.length === 0) {
      lastHandledSignatureRef.current = null;
      return;
    }

    if (lastHandledSignatureRef.current === signature) {
      return;
    }

    lastHandledSignatureRef.current = signature;
    toasts.forEach((toast) => showToast(toast));
    removeConsumedUrlParams(consumedParams);
  }, [pathname, search, showToast]);

  return null;
}

function SuspendedToastUrlObserver({
  showToast,
}: {
  showToast: (toast: ToastInput) => void;
}) {
  return (
    <Suspense fallback={null}>
      <ToastUrlObserver showToast={showToast} />
    </Suspense>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.durationMs === 0) return;

    const timeoutId = window.setTimeout(
      () => onDismiss(toast.id),
      toast.durationMs ?? AUTO_DISMISS_MS
    );

    return () => window.clearTimeout(timeoutId);
  }, [onDismiss, toast.durationMs, toast.id]);

  const Icon = toast.type === "success" ? CheckCircle2 : XCircle;
  const iconClass =
    toast.type === "success" ? "text-primary" : "text-red-600";

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      className="flex items-start gap-3 rounded-lg border border-card-border bg-white px-4 py-3 text-text-dark shadow-lg"
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-5">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm leading-5 text-text-body">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="通知を閉じる"
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-body hover:bg-tab-bg hover:text-text-dark"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: ToastInput) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      { ...toast, id: nextToastId() },
    ]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== id)
    );
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <SuspendedToastUrlObserver showToast={showToast} />
      <div className="fixed top-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:top-6 sm:right-6">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast は ToastProvider の内側で使用してください。");
  }

  return context;
}
