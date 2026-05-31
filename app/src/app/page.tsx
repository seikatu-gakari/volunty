import Link from "next/link";
import {
  Heart,
  Sparkles,
  Zap,
  Brain,
  ArrowRight,
  Target,
  User,
  Building2,
  Star,
  Mail,
  Users,
  MessageCircle,
  Calendar,
  Search,
  ClipboardList,
  Handshake,
  UserPlus,
  Shield,
} from "lucide-react";
import { Header } from "./components/Header";
import { AuthenticatedHome } from "./components/AuthenticatedHome";
import { Reveal } from "./components/lp/Reveal";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase未設定・接続エラー時はログインなしで表示
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ヘッダー */}
      <Header />

      {/* 認証済みユーザーは専用ホーム画面を表示 */}
      {user && <AuthenticatedHome user={user} />}

      {/* 未ログインユーザー向けランディングページ */}
      {!user && (
        <main className="relative mx-auto w-full max-w-7xl px-4 pt-8 pb-20 sm:px-6 lg:px-8">
          {/* ページ全体の装飾 blob */}
          <div className="lp-blob top-[120px] -left-32 size-[420px] bg-primary/25" aria-hidden />
          <div className="lp-blob top-[640px] -right-32 size-[520px] bg-[#fbb672]/40" aria-hidden />
          <div className="lp-blob top-[1400px] left-1/3 size-[480px] bg-[#3b82f6]/15" aria-hidden />
          <div className="lp-blob top-[2200px] -left-24 size-[500px] bg-primary/15" aria-hidden />

          {/* ヒーローセクション */}
          <section className="relative overflow-hidden rounded-4xl bg-white px-6 py-14 shadow-sm sm:px-12 sm:py-20 animate-[fade-in-up_0.8s_ease-out_forwards]">
            <div className="absolute top-0 left-1/2 -z-10 -ml-40 h-[400px] w-[800px] -translate-x-1/2 animate-pulse rounded-full bg-primary/5 blur-3xl" />
            {/* 装飾ドット (SVG) */}
            <svg
              aria-hidden
              className="pointer-events-none absolute right-6 top-6 hidden text-primary/30 sm:block"
              width="120"
              height="120"
              viewBox="0 0 120 120"
              fill="currentColor"
            >
              {Array.from({ length: 6 }).map((_, r) =>
                Array.from({ length: 6 }).map((__, c) => (
                  <circle key={`${r}-${c}`} cx={10 + c * 20} cy={10 + r * 20} r={2} />
                )),
              )}
            </svg>

            <div className="relative mx-auto max-w-3xl text-center">
              <div className="mb-6 flex flex-wrap justify-center gap-3">
                <span className="inline-flex animate-[float_6s_ease-in-out_infinite] items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-dark">
                  <Brain className="size-4" /> 本格性格診断
                </span>
                <span className="inline-flex animate-[float_6s_ease-in-out_1s_infinite] items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-dark">
                  <Target className="size-4" /> 相性スコア
                </span>
                <span className="inline-flex animate-[float_6s_ease-in-out_2s_infinite] items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-dark">
                  <Sparkles className="size-4" /> AI分析
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-text-dark sm:text-5xl lg:text-6xl">
                つながる、みつかる、
                <span className="bg-linear-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                  変わっていく
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-text-body">
                独自の性格診断アルゴリズムを用いて、あなたの特性や強みを診断。相性スコアとAI分析が、あなたに最も適したボランティア活動への第一歩をサポートします。
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/diagnosis?mode=brief"
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-background px-8 text-base font-bold text-text-dark transition-all hover:bg-white sm:w-auto"
                >
                  <Zap className="size-5 text-primary" />
                  16問 簡易診断
                  <span className="ml-1 text-xs font-normal opacity-75">約2分</span>
                </Link>
                <Link
                  href="/diagnosis?mode=full"
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 text-base font-bold text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg sm:w-auto"
                >
                  <Brain className="size-5" />
                  60問 詳細診断
                  <span className="ml-1 text-xs font-normal opacity-75">約8〜10分</span>
                  <ArrowRight className="ml-2 size-5" />
                </Link>
              </div>
            </div>
          </section>

          {/* 2つの入口: 参加者向け / 団体向け */}
          <Reveal>
            <section className="relative z-10 mt-20 grid gap-6 sm:mt-28 lg:grid-cols-2">
              {/* 参加者向け（オレンジ） */}
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-linear-to-br from-white to-primary/5 p-8 shadow-sm ring-1 ring-primary/10 sm:p-10">
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <User className="size-5" />
                  </span>
                  <span className="rounded-full bg-primary/15 px-4 py-1.5 text-sm font-bold text-primary-dark">
                    ボランティアを探しているあなたへ
                  </span>
                </div>
                <div className="min-h-[140px]">
                  <h3 className="text-2xl font-bold text-text-dark sm:text-[26px]">
                    自分らしく、社会とつながる第一歩を。
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-text-body">
                    性格診断やAI分析で、あなたの強みや興味にぴったりの
                    <br className="hidden sm:block" />
                    ボランティア活動をご紹介します。
                    <br className="hidden sm:block" />
                    「やってみたい！」がきっと見つかります。
                  </p>
                </div>
                <div className="mt-8 grid grid-cols-3 gap-4">
                  {[
                    { icon: Heart, title: "自分に合う活動が\n簡単に見つかる", desc: "性格や価値観に合わせておすすめを提案" },
                    { icon: Sparkles, title: "スカウトで届く\nオファー", desc: "興味を持った団体からスカウトが届くことも！" },
                    { icon: Users, title: "はじめてでも安心の\nサポート体制", desc: "メッセージ機能やFAQでしっかりサポート" },
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center text-center">
                      <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <item.icon className="size-7" />
                      </span>
                      <div className="whitespace-pre-line text-sm font-bold text-text-dark">{item.title}</div>
                      <p className="mt-2 text-xs leading-5 text-text-body">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-8">
                  <Link
                    href="/signup?role=participant"
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-bold text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg"
                  >
                    無料で登録して活動を探す
                    <ArrowRight className="size-5" />
                  </Link>
                </div>
              </div>

              {/* 団体向け（ブルー） */}
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-linear-to-br from-white to-[#3b82f6]/5 p-8 shadow-sm ring-1 ring-[#3b82f6]/15 sm:p-10">
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#3b82f6]/15 text-[#1d4ed8]">
                    <Building2 className="size-5" />
                  </span>
                  <span className="rounded-full bg-[#3b82f6]/15 px-4 py-1.5 text-sm font-bold text-[#1d4ed8]">
                    ボランティアを必要としている組織の方へ
                  </span>
                </div>
                <div className="min-h-[140px]">
                  <h3 className="text-2xl font-bold text-text-dark sm:text-[26px]">
                    あなたの想いに合う人材と、
                    <br />
                    効率的につながる。
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-text-body">
                    AIが最適な人材をマッチング。スカウト機能で、
                    <br className="hidden sm:block" />
                    あなたの活動にぴったりのボランティアを見つけられます。
                  </p>
                </div>
                <div className="mt-8 grid grid-cols-3 gap-4">
                  {[
                    { icon: Target, title: "AIマッチングで\n最適な人材を提案", desc: "特性や希望条件に合わせて候補者を提案" },
                    { icon: Mail, title: "スカウト機能で\nアプローチ可能", desc: "活動に合う人へ直接スカウトを送信" },
                    { icon: ClipboardList, title: "活動の管理・分析も\nかんたんに", desc: "応募状況や活動情報をまとめて管理" },
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center text-center">
                      <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-[#3b82f6]/10 text-[#1d4ed8]">
                        <item.icon className="size-7" />
                      </span>
                      <div className="whitespace-pre-line text-sm font-bold text-text-dark">{item.title}</div>
                      <p className="mt-2 text-xs leading-5 text-text-body">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-8">
                  <Link
                    href="/signup?role=organization"
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-6 text-base font-bold text-white shadow-md transition-all hover:bg-[#1d4ed8] hover:shadow-lg"
                  >
                    組織として登録する
                    <ArrowRight className="size-5" />
                  </Link>
                </div>
              </div>
            </section>

          </Reveal>

          {/* ボランティーの主な機能 */}
          <Reveal>
            <section id="features" className="relative z-10 mt-20 sm:mt-28">
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
                  <span className="relative inline-block">
                    <span className="absolute -top-3 -left-4 text-primary">✦</span>
                    ボランティーの主な機能
                    <span className="absolute -top-3 -right-4 text-primary">✦</span>
                  </span>
                </h2>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: Brain,
                    title: "性格診断・AI分析",
                    desc: "独自のアルゴリズムで、あなたの特性や強みを可視化。ぴったりの活動をご提案します。",
                  },
                  {
                    icon: Search,
                    title: "スカウトマッチング",
                    desc: "あなたに興味を持った団体からスカウトが届きます。新しい出会いのきっかけに。",
                  },
                  {
                    icon: MessageCircle,
                    title: "メッセージ機能",
                    desc: "気になる団体とメッセージでやり取り。安心して活動を始められます。",
                  },
                  {
                    icon: Calendar,
                    title: "活動管理・記録",
                    desc: "参加した活動を記録・管理。振り返りや実績としても活用できます。",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center rounded-2xl border border-card-border bg-white p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <item.icon className="size-8" />
                    </span>
                    <h3 className="text-lg font-bold text-text-dark">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-text-body">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          {/* 利用の流れ */}
          <Reveal>
            <section id="flow" className="glass-card relative z-10 mt-20 overflow-hidden rounded-3xl p-8 ring-1 ring-white/60 sm:mt-28 sm:p-12">
              <div className="lp-blob -top-12 -right-12 size-72 bg-primary/20" aria-hidden />
              <div className="lp-blob -bottom-16 -left-16 size-72 bg-[#fbb672]/30" aria-hidden />
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
                  <span className="relative inline-block">
                    <span className="absolute -top-3 -left-4 text-primary">✦</span>
                    利用の流れ
                    <span className="absolute -top-3 -right-4 text-primary">✦</span>
                  </span>
                </h2>
                <p className="mt-3 text-sm text-text-body">3つのステップで、すぐに始められます</p>
              </div>
              <div className="grid gap-10 md:grid-cols-3">
                {[
                  {
                    step: "STEP\u00A01",
                    icon: ClipboardList,
                    title: "診断・登録",
                    desc: "16〜60問の質問に答えて、あなたの特性や興味を診断。無料で登録できます。",
                  },
                  {
                    step: "STEP\u00A02",
                    icon: Search,
                    title: "マッチング・スカウト",
                    desc: "AIがあなたに合う活動や団体を提案。スカウトが届くことも！",
                  },
                  {
                    step: "STEP\u00A03",
                    icon: Handshake,
                    title: "参加・つながり",
                    desc: "気になる活動に参加して、新しい仲間や経験とつながりましょう。",
                  },
                ].map((s, i) => (
                  <div key={i} className="relative flex flex-col items-center text-center">
                    <div className="relative mb-5 flex items-center justify-center">
                      <div className="flex size-20 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-dark text-sm font-bold leading-tight text-white shadow-lg">
                        <span className="whitespace-pre-line text-center">
                          {s.step.replace("\u00A0", "\n")}
                        </span>
                      </div>
                    </div>
                    <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <s.icon className="size-8" />
                    </span>
                    <h3 className="text-lg font-bold text-text-dark">{s.title}</h3>
                    <p className="mt-3 max-w-[260px] text-sm leading-6 text-text-body">{s.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          {/* 利用者の声 */}
          <Reveal>
            <section id="testimonials" className="relative z-10 mt-20 sm:mt-28">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
                  <span className="relative inline-block">
                    <span className="absolute -top-3 -left-4 text-primary">✦</span>
                    利用者の声
                    <span className="absolute -top-3 -right-4 text-primary">✦</span>
                  </span>
                </h2>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {[
                  {
                    name: "大学生・20代",
                    title: "自分に合う活動が見つかり、毎日が充実しています！",
                    body: "性格診断で自分の強みがわかり、ぴったりの団体に出会えました。新しい仲間もできて、毎日が楽しいです！",
                    avatarBg: "from-primary/20 to-primary/5",
                  },
                  {
                    name: "NPO法人担当者",
                    title: "スカウトで理想の人材に出会えました！",
                    body: "AIマッチングのおかげで、求めていた人材と効率的につながることができました。",
                    avatarBg: "from-[#fbcfe8] to-[#fde68a]",
                  },
                  {
                    name: "会社員・30代",
                    title: "初めてでも安心して参加できました",
                    body: "サポートが丁寧で、初めてのボランティアでも安心して参加できました！",
                    avatarBg: "from-primary/15 to-primary/5",
                  },
                ].map((t, i) => (
                  <article
                    key={i}
                    className="flex flex-col rounded-2xl border border-card-border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="mb-4 flex items-start gap-3">
                      <span
                        className={`flex size-14 shrink-0 items-center justify-center rounded-full bg-linear-to-br ${t.avatarBg} text-primary-dark`}
                      >
                        <User className="size-7" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold leading-snug text-text-dark">{t.title}</h3>
                        <p className="mt-1 text-xs text-text-body">{t.name}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-6 text-text-body">{t.body}</p>
                  </article>
                ))}
              </div>
              {/* ページネーションドット（装飾） */}
              <div className="mt-8 flex justify-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                <span className="size-2 rounded-full bg-primary/30" />
                <span className="size-2 rounded-full bg-primary/30" />
                <span className="size-2 rounded-full bg-primary/30" />
              </div>
            </section>
          </Reveal>

          {/* ボトム CTA + 統計 */}
          <Reveal>
            <section className="relative z-10 mt-20 overflow-hidden rounded-3xl bg-linear-to-br from-[#fb8a3c] via-primary to-primary-dark p-8 text-center text-white shadow-xl sm:mt-28 sm:p-14">
              <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/15 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-24 -left-16 size-80 rounded-full bg-white/10 blur-3xl" aria-hidden />
              <h2 className="text-3xl font-bold tracking-tight sm:text-[34px]">
                あなたの一歩が、誰かの未来を変える。
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/90">
                まずは無料登録して、あなたにぴったりの活動を見つけましょう。
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/signup?role=participant"
                  className="flex h-14 w-full max-w-[300px] items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-bold text-primary-dark shadow-md transition-all hover:shadow-xl sm:w-auto"
                >
                  <UserPlus className="size-5" />
                  無料で登録する
                </Link>
                <Link
                  href="/diagnosis?mode=brief"
                  className="flex h-14 w-full max-w-[300px] items-center justify-center gap-2 rounded-full border-2 border-white px-8 text-base font-bold text-white transition-all hover:bg-white/10 sm:w-auto"
                >
                  <Zap className="size-5" />
                  今すぐ診断してみる
                </Link>
              </div>
            </section>
          </Reveal>

          {/* 統計 + プライバシー */}
          <Reveal>
            <section className="relative z-10 mt-10 space-y-4">
              <div className="glass-card grid gap-4 rounded-2xl p-6 shadow-sm ring-1 ring-white/60 sm:grid-cols-3 sm:p-8">
                {[
                  { icon: Users, label: "累計登録者数", value: "50,000人突破！" },
                  { icon: Building2, label: "提携団体数", value: "2,000団体以上" },
                  { icon: Star, label: "参加満足度", value: "97.2%" },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="size-6" />
                    </span>
                    <div>
                      <p className="text-xs text-text-body">{s.label}</p>
                      <p className="text-lg font-bold text-text-dark">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="glass-card flex items-center gap-3 rounded-2xl p-5 shadow-sm ring-1 ring-white/60 sm:px-8">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Shield className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-text-dark">プライバシーを大切にしています</p>
                  <p className="mt-0.5 text-xs text-text-body">
                    個人情報は厳重に管理し、安心してご利用いただけます。
                  </p>
                </div>
              </div>
            </section>
          </Reveal>
        </main>
      )}
    </div>
  );
}
