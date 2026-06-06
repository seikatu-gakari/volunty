import { Users, Star, Lightbulb, Zap, Heart, BarChart2, MessageCircle, Handshake } from "lucide-react";

const TYPES = [
  { icon: Users,         name: "縁の下の力持ちタイプ", desc: "静かな環境での活動が得意",       activity: "事務サポート・データ整理", color: "bg-orange-100 text-orange-600" },
  { icon: Star,          name: "リーダータイプ",       desc: "人との交流を活かす活動が得意",   activity: "イベント運営・呼びかけ",     color: "bg-red-100 text-red-600" },
  { icon: Lightbulb,     name: "アイデアマンタイプ",   desc: "創造的・未来志向の活動が得意",   activity: "企画・広報・SNS発信",        color: "bg-purple-100 text-purple-600" },
  { icon: Zap,           name: "実行力タイプ",         desc: "実践的・具体的な活動が得意",     activity: "清掃・防災・現場作業",       color: "bg-green-100 text-green-600" },
  { icon: Heart,         name: "サポータータイプ",     desc: "チーム支援・協調的な活動が得意", activity: "受付・チーム補助",           color: "bg-blue-100 text-blue-600" },
  { icon: BarChart2,     name: "アナリストタイプ",     desc: "分析・戦略立案の活動が得意",     activity: "調査・集計・改善提案",       color: "bg-indigo-100 text-indigo-600" },
  { icon: MessageCircle, name: "コミュニケータータイプ", desc: "対話・情報伝達の活動が得意",   activity: "相談・案内・通訳",           color: "bg-yellow-100 text-yellow-600" },
  { icon: Handshake,     name: "ケアギバータイプ",     desc: "思いやり・サポート活動が得意",   activity: "見守り・福祉・子ども支援",   color: "bg-pink-100 text-pink-600" },
];

export function DiagnosisTypesGrid() {
  return (
    <section id="types" className="relative z-10 mt-20 sm:mt-28">
      <div className="mb-12 text-center">
        <p className="mb-3 text-sm font-medium text-primary">✦ 8つの診断タイプ ✦</p>
        <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
          あなたは、どのタイプ？
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-text-body">
          性格診断であなたの強みを8タイプで可視化。タイプごとに、活きる活動が変わります。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TYPES.map((type) => (
          <div
            key={type.name}
            className="flex flex-col rounded-2xl border border-card-border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <span className={`mb-4 inline-flex size-12 items-center justify-center rounded-xl ${type.color}`}>
              <type.icon className="size-6" />
            </span>
            <h3 className="text-base font-bold text-text-dark">{type.name}</h3>
            <p className="mt-1 text-xs leading-5 text-text-body">{type.desc}</p>
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-background px-2 py-1.5">
              <span className="text-xs text-primary">→</span>
              <span className="text-xs font-medium text-text-body">{type.activity}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-text-body opacity-70">
        ＊ 16問の簡易診断でタイプを判定。60問の詳細診断でさらに精度の高い分析ができます。
      </p>
    </section>
  );
}
