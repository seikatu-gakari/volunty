import { LegalDocumentLayout } from "@/app/components/legal/LegalDocumentLayout";
import { LEGAL_DOCUMENTS, SERVICE_OPERATOR } from "@/lib/legal/documents";

export default function ContactPage() {
  return (
    <LegalDocumentLayout document={LEGAL_DOCUMENTS.contact}>
      <section>
        <h2 className="text-xl font-bold text-text-dark">問い合わせ窓口</h2>
        <p className="mt-3">
          サービスに関する問い合わせは、{SERVICE_OPERATOR.contactLabel}をご利用ください。
        </p>
        <p className="mt-4">
          <a
            href={SERVICE_OPERATOR.contactHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
          >
            GitHubの問い合わせ窓口を開く
          </a>
        </p>
        <p className="mt-4 text-xs leading-6 text-text-body">
          公開の問い合わせ窓口には、パスワード、認証コード、診断回答、住所などの個人情報を書き込まないでください。
          アカウント削除については、本人を特定できる情報を公開せず、問い合わせ内容だけを送ってください。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">問い合わせに含める内容</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>発生した画面または機能</li>
          <li>発生日時と再現手順</li>
          <li>表示されたエラーの内容（認証情報や個人情報は除く）</li>
          <li>退会・削除、表示訂正、安全上の懸念などの相談種別</li>
        </ul>
      </section>
    </LegalDocumentLayout>
  );
}
