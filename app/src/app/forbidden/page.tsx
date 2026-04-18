import Link from "next/link";
import { ShieldAlert, Home, LogIn } from "lucide-react";
import { Header } from "@/app/components/Header";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-red-100">
          <ShieldAlert className="size-8 text-red-600" />
        </div>

        <h1 className="mt-6 text-3xl font-bold text-text-dark">
          このページにはアクセスできません
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-6 text-text-body">
          管理者向けページのため、現在のアカウントでは表示できません。
          団体審査画面を開くには、m_user の role が admin である必要があります。
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-card-border bg-white px-4 text-sm font-medium text-text-dark hover:bg-primary/5"
          >
            <Home className="size-4" />
            トップへ戻る
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <LogIn className="size-4" />
            別のアカウントでログイン
          </Link>
        </div>
      </main>
    </div>
  );
}
