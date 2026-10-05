"use client";

import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { normalizeWaitlistEmail } from "@/lib/waitlist/validation";

const REGISTRATION_ERROR = "登録できませんでした。時間をおいて、もう一度お試しください。";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || status === "success") return;

    const normalizedEmail = normalizeWaitlistEmail(email);
    if (!normalizedEmail) {
      setError(email.trim() ? "有効なメールアドレスを入力してください。" : "メールアドレスを入力してください。");
      setEmailInvalid(true);
      emailInput.current?.focus();
      return;
    }

    submitting.current = true;
    setStatus("pending");
    setError(null);
    setEmailInvalid(false);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, website }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && result && typeof result === "object" && "ok" in result && result.ok === true) {
        setStatus("success");
        setEmail("");
        return;
      }

      const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : REGISTRATION_ERROR;
      setError(message || REGISTRATION_ERROR);
      setStatus("idle");
    } catch {
      setError("通信に失敗しました。接続を確認して、もう一度お試しください。");
      setStatus("idle");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="rounded-3xl bg-white p-5 text-left text-text-dark shadow-lg sm:p-8">
      {status !== "success" && (
        <form aria-label="開始通知の事前登録" action="/api/waitlist" method="post" onSubmit={handleSubmit} noValidate>
          <label htmlFor="waitlist-email" className="block text-sm font-bold">
            メールアドレス <span className="text-xs font-medium text-text-body">（必須）</span>
          </label>
          <p id="waitlist-email-help" className="mt-2 text-xs leading-6 text-text-body">
            メールアドレスだけで無料登録。サービス開始時にお知らせします。
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              ref={emailInput}
              id="waitlist-email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
                setEmailInvalid(false);
              }}
              disabled={status === "pending"}
              aria-invalid={emailInvalid}
              aria-describedby={`waitlist-email-help${error ? " waitlist-error" : ""}`}
              placeholder="you@example.com"
              className="h-14 w-full min-w-0 rounded-xl border border-input-border bg-background px-4 text-base text-text-dark outline-none transition-shadow placeholder:text-text-body focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/25 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === "pending"}
              className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-dark px-6 text-sm font-bold text-white transition-colors hover:bg-primary-dark/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-dark disabled:cursor-wait disabled:opacity-60"
            >
              <Mail className="size-4" aria-hidden />
              {status === "pending" ? "登録中…" : "無料で事前登録"}
            </button>
          </div>
          {/* 自動登録対策。通常の入力・読み上げ・キーボード操作の対象から除外する。 */}
          <div hidden aria-hidden="true">
            <label htmlFor="waitlist-website">ウェブサイト（入力しないでください）</label>
            <input
              id="waitlist-website"
              name="website"
              type="text"
              autoComplete="off"
              tabIndex={-1}
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
          {error && <p id="waitlist-error" role="alert" className="mt-3 text-sm leading-6 text-error">{error}</p>}
          <p className="mt-4 text-xs leading-6 text-text-body">
            登録前に
            <a href="#waitlist-privacy" className="rounded-sm font-bold text-primary-dark underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dark">
              メールアドレスの利用目的
            </a>
            をご確認ください。
          </p>
        </form>
      )}
      <div role="status" aria-live="polite" aria-atomic="true">
        {status === "pending" && <p className="mt-3 text-sm text-text-body">登録内容を送信しています。</p>}
        {status === "success" && (
          <div className="py-3 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
            <p className="mt-4 text-xl font-bold">開始通知の登録を受け付けました</p>
            <p className="mt-3 text-sm leading-7 text-text-body">
              サービス開始時にメールでお知らせします。<br />公開まで、どうぞお楽しみに。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
