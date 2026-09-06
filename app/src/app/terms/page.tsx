import Link from "next/link";
import { LegalDocumentLayout } from "@/app/components/legal/LegalDocumentLayout";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

export default function TermsPage() {
  return (
    <LegalDocumentLayout document={LEGAL_DOCUMENTS.terms}>
      <section>
        <h2 className="text-xl font-bold text-text-dark">1. サービスについて</h2>
        <p className="mt-3">
          ボランティは、性格傾向の診断結果を参考に、ボランティア活動を探すためのサービスです。
          診断結果は活動選びの参考情報であり、参加先や結果を保証するものではありません。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">2. 登録とアカウント</h2>
        <p className="mt-3">
          登録にはGoogleアカウントを使用します。登録時に表示される利用規約と
          <Link href={LEGAL_DOCUMENTS.privacy.href} className="mx-1 text-primary hover:underline">
            プライバシーポリシー
          </Link>
          を確認し、同意した場合にサービスを利用できます。登録情報は本人の責任で管理してください。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">3. 利用上のお願い</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>他の利用者、募集団体、運営事務局に損害や不利益を与える行為をしないでください。</li>
          <li>虚偽の情報、第三者の情報、権利を侵害する情報を登録しないでください。</li>
          <li>募集内容、参加条件、安全情報を確認し、ご自身の判断と責任で参加してください。</li>
          <li>安全上の懸念や不適切な内容は、<Link href={LEGAL_DOCUMENTS.safety.href} className="text-primary hover:underline">安全・通報方針</Link>に従ってお知らせください。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">4. 掲載内容と利用制限</h2>
        <p className="mt-3">
          募集団体が登録した内容の正確性や活動の安全性を、運営事務局が個別に保証するものではありません。
          不正利用、規約違反、その他サービス運営上必要な場合は、利用を制限することがあります。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">5. 退会と変更</h2>
        <p className="mt-3">
          退会・データ削除は、<Link href={LEGAL_DOCUMENTS.accountDeletion.href} className="text-primary hover:underline">退会・データ削除案内</Link>に記載する方法で受け付けます。
          文書を変更する場合は、変更後の版と更新日を公開します。変更内容について確認が必要な場合は、公開前にお問い合わせください。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">6. 問い合わせ</h2>
        <p className="mt-3">
          この規約への問い合わせは、<Link href={LEGAL_DOCUMENTS.contact.href} className="text-primary hover:underline">お問い合わせ</Link>からお願いします。
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
