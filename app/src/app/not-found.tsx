import Link from "next/link";
import { Home, SearchX, Sparkles } from "lucide-react";
import { Header } from "@/app/components/Header";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-16 text-center sm:py-20">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <SearchX className="size-8 text-primary" aria-hidden />
        </div>

        <p className="mt-6 text-sm font-semibold text-primary">
          エラーコード 404
        </p>

        <h1 className="mt-3 text-3xl font-bold text-text-dark sm:text-4xl">
          ページが見つかりません
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-6 text-text-body sm:text-base sm:leading-7">
          削除された、URLが変更された、または入力したURLが間違っている可能性があります。
        </p>

        <div
          data-testid="not-found-actions"
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-card-border bg-background px-4 text-sm font-medium text-text-dark transition-colors hover:bg-primary/5"
          >
            <Home className="size-4" aria-hidden />
            トップへ戻る
          </Link>
          <Link
            href="/diagnosis?mode=brief"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            <Sparkles className="size-4" aria-hidden />
            診断を始める
          </Link>
        </div>
      </main>
    </div>
  );
}
