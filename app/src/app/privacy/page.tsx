import Link from "next/link";
import { LegalDocumentLayout } from "@/app/components/legal/LegalDocumentLayout";
import { LEGAL_DOCUMENTS, SERVICE_OPERATOR } from "@/lib/legal/documents";

export default function PrivacyPage() {
  return (
    <LegalDocumentLayout document={LEGAL_DOCUMENTS.privacy}>
      <section>
        <h2 className="text-xl font-bold text-text-dark">1. 運営主体</h2>
        <p className="mt-3">
          本サービスは、{SERVICE_OPERATOR.name}（リポジトリ管理主体: {SERVICE_OPERATOR.repositoryOwner}）が運営します。
          個人情報の取扱いについての問い合わせは、<Link href={LEGAL_DOCUMENTS.contact.href} className="text-primary hover:underline">お問い合わせ</Link>からお願いします。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">2. 取得する情報</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Google OAuthで受け取るGoogleアカウントの識別子、メールアドレス、表示名、プロフィール画像（Googleから提供される範囲）。</li>
          <li>ロール、氏名、生年月日、性別、地域、自己紹介、興味分野、活動可能日時など、プロフィールとして登録した情報。</li>
          <li>診断への回答、診断結果、診断の実施日時、診断結果を使った活動スタイル・推薦情報。</li>
          <li>募集案件の閲覧、お気に入り、応募、アプローチ、活動履歴、証明書など、サービス上の利用記録。</li>
          <li>認証・障害対応・安全運用に必要なアクセスログや操作記録。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">3. 利用目的</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Googleアカウントによる認証、アカウント管理、本人の利用状態の確認。</li>
          <li>診断結果を参考にした活動スタイルの表示、募集案件の検索・推薦。</li>
          <li>応募、アプローチ、承認後の連絡先表示など、利用者と募集団体をつなぐ機能の提供。</li>
          <li>不正利用、凍結、安全上の問題、問い合わせ、障害の調査と対応。</li>
          <li>サービスの保守、品質改善、利用状況の把握。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">4. 保存期間と削除</h2>
        <p className="mt-3">
          アカウント情報、プロフィール、診断回答・結果、応募・活動記録は、アカウントの利用中に保存します。
          退会を受け付けた場合は、認証アカウントを先に削除し、確認後に業務データを物理削除します。
          業務データの削除が一時的に失敗した場合は再処理台帳で保留し、削除完了まで再処理します。
          詳細は<Link href={LEGAL_DOCUMENTS.accountDeletion.href} className="mx-1 text-primary hover:underline">退会・データ削除案内</Link>を確認してください。
        </p>
        <p className="mt-3">
          監視・障害対応のログや、法令・安全対応上必要な記録は、目的に必要な期間だけ保持します。
          保持期間の確定値は、運営・法務レビューで運用基準を定めて公開します。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">5. 委託・第三者提供</h2>
        <p className="mt-3">
          本サービスは、認証・データ保存・ホスティング等のために、Supabase、Google、Vercelなどのサービスを利用します。
          これらのサービスには、機能の提供に必要な範囲で情報が送信されます。各サービスの取扱いは、各社の規約・プライバシー情報にも従います。
        </p>
        <p className="mt-3">
          利用者の情報を販売することはありません。応募や活動の進行に必要な情報は、画面上で示す条件に従い、募集団体に表示・共有されることがあります。
          法令、生命・身体の保護、その他安全対応のために必要な場合を除き、目的を超えて第三者へ提供しません。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-dark">6. 安全管理と問い合わせ</h2>
        <p className="mt-3">
          認証、アクセス制御、削除処理、運用ログなど、サービスの構成に応じた安全管理を行います。
          開示や削除に関する相談、誤表示、安全上の懸念は<Link href={LEGAL_DOCUMENTS.contact.href} className="mx-1 text-primary hover:underline">お問い合わせ</Link>へ連絡してください。
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
