import Link from "next/link";
import { LegalDocumentLayout } from "@/app/components/legal/LegalDocumentLayout";
import { LEGAL_DOCUMENTS, SERVICE_OPERATOR } from "@/lib/legal/documents";

export default function AccountDeletionPage() {
  return (
    <LegalDocumentLayout document={LEGAL_DOCUMENTS.accountDeletion}>
      <section>
        <h2 className="text-xl font-bold text-text-dark">削除の申し込み</h2>
        <p className="mt-3">
          ログイン後のマイページにある「アカウントを削除」から、確認欄に「削除する」と入力して申し込んでください。
          アカウント削除機能が一時停止中の場合やログインできない場合は、<Link href={LEGAL_DOCUMENTS.contact.href} className="mx-1 text-primary hover:underline">お問い合わせ</Link>へ連絡してください。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">削除されるデータ</h2>
        <p className="mt-3">
          認証アカウントを削除した後、アカウントに紐づくプロフィール、診断回答・結果、応募・活動記録、推薦・お気に入りなどの業務データを物理削除します。
          削除は取り消せず、復旧できません。削除後に同じGoogleアカウントで登録し直しても、削除前のデータは戻りません。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">保留時の扱い</h2>
        <p className="mt-3">
          処理は認証アカウントの削除を先に行い、完了を確認してから業務データを削除します。
          認証アカウントの削除に失敗した場合は業務データを残して再試行を待ちます。
          認証アカウントの削除後に業務データの削除が失敗した場合は、再処理台帳に保留し、運営管理画面から原因解消後に再処理します。
          後者では認証アカウントが削除済みのため、再ログインを依頼しません。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">問い合わせ</h2>
        <p className="mt-3">
          削除処理の状態を確認したい場合は、{SERVICE_OPERATOR.name}へ<Link href={LEGAL_DOCUMENTS.contact.href} className="mx-1 text-primary hover:underline">お問い合わせ</Link>ください。
          公開窓口には、メールアドレスや認証コードなどの個人情報を書き込まないでください。
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
