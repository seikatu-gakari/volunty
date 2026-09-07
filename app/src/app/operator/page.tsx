import Link from "next/link";
import { LegalDocumentLayout } from "@/app/components/legal/LegalDocumentLayout";
import { LEGAL_DOCUMENTS, SERVICE_OPERATOR } from "@/lib/legal/documents";

export default function OperatorPage() {
  return (
    <LegalDocumentLayout document={LEGAL_DOCUMENTS.operator}>
      <section>
        <h2 className="text-xl font-bold text-text-dark">サービス名</h2>
        <p className="mt-3">ボランティ（Volunty）</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">運営主体・責任者</h2>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="font-medium text-text-dark">運営主体</dt>
            <dd>{SERVICE_OPERATOR.name}（{SERVICE_OPERATOR.repositoryOwner}）</dd>
          </div>
          <div>
            <dt className="font-medium text-text-dark">運営責任者</dt>
            <dd>Volunty運営事務局</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">問い合わせ方法</h2>
        <p className="mt-3">
          問い合わせ窓口は、<Link href="/contact" className="text-primary hover:underline">お問い合わせページ</Link>に掲載しています。
          運営主体・責任者の表示内容は、公開前に運営・法務レビューで確定します。
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
