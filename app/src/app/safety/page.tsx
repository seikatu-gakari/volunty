import Link from "next/link";
import { LegalDocumentLayout } from "@/app/components/legal/LegalDocumentLayout";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

export default function SafetyPage() {
  return (
    <LegalDocumentLayout document={LEGAL_DOCUMENTS.safety}>
      <section>
        <h2 className="text-xl font-bold text-text-dark">活動参加前の確認</h2>
        <p className="mt-3">
          募集内容、活動場所、日時、参加条件、費用、保険・安全情報、キャンセル条件を確認し、無理のない範囲で参加してください。
          不明点は募集団体へ確認し、緊急時は地域の公的な相談窓口や緊急通報を利用してください。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">通報・相談</h2>
        <p className="mt-3">
          危険な募集、嫌がらせ、個人情報の不適切な公開、なりすまし、その他不適切な内容を見つけた場合は、
          <Link href={LEGAL_DOCUMENTS.contact.href} className="mx-1 text-primary hover:underline">お問い合わせ</Link>からお知らせください。
          可能な範囲で、対象ページ、発生日時、状況を記載してください。公開窓口へ個人情報や認証情報を書き込まないでください。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">対応</h2>
        <p className="mt-3">
          運営事務局は、内容を確認し、必要に応じて募集情報の非公開、利用制限、募集団体への確認などを行います。
          すべての活動の安全性を保証するものではありません。個別の法的助言や緊急対応は行えないため、必要な公的窓口も利用してください。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">退会・データ削除</h2>
        <p className="mt-3">
          アカウントの退会や保存データの削除は、<Link href={LEGAL_DOCUMENTS.accountDeletion.href} className="text-primary hover:underline">退会・データ削除案内</Link>を確認してください。
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
