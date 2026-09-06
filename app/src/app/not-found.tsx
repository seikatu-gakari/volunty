import Link from "next/link";
import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Header } from "@/app/components/Header";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { getNotFoundNavigation } from "@/lib/auth/not-found-navigation";

export default async function NotFound() {
  const viewer = await getViewerContext();
  const navigation = getNotFoundNavigation(viewer);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />
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
        {navigation.accountUnavailable && (
          <p className="mt-3 max-w-xl text-sm leading-6 text-text-body sm:text-base sm:leading-7">
            アカウント情報を確認できないため、トップページから再度お試しください。
          </p>
        )}

        <div
          data-testid="not-found-actions"
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <Link
            href={navigation.primary.href}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            {navigation.primary.href === "/" ? (
              <Home className="size-4" aria-hidden />
            ) : (
              <ArrowLeft className="size-4" aria-hidden />
            )}
            {navigation.primary.label}
          </Link>
          {navigation.showHomeLink && (
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-card-border bg-background px-4 text-sm font-medium text-text-dark transition-colors hover:bg-primary/5"
            >
              <Home className="size-4" aria-hidden />
              トップへ戻る
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
