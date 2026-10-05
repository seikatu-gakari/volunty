import Image from "next/image";
import { lpAssets } from "./lpAssets";
import { WaitlistForm } from "@/app/components/lp/WaitlistForm";

export function LPBottomCTA() {
  return (
    <section id="waitlist" aria-labelledby="waitlist-heading" className="relative scroll-mt-28 overflow-hidden rounded-[40px] bg-primary-dark px-5 py-14 text-center text-white shadow-xl sm:px-12 sm:py-20">
      <Image
        src={lpAssets.orbitMotif.src}
        alt={lpAssets.orbitMotif.alt}
        width={lpAssets.orbitMotif.width}
        height={lpAssets.orbitMotif.height}
        className="pointer-events-none absolute -top-12 -right-16 w-52 opacity-45 sm:w-72"
      />

      <div className="relative mx-auto max-w-3xl">
        <p className="text-xs font-bold tracking-[0.2em] text-white">ただいま公開準備中</p>
        <h2 id="waitlist-heading" className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          サービス開始を、<br />メールでお知らせ。
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white sm:text-base">
          自分らしく続けられるボランティアとの出会いを準備しています。
          無料の事前登録で、ボランティの開始通知を受け取れます。
        </p>
        <div className="mx-auto mt-8 max-w-2xl">
          <WaitlistForm />
        </div>
        <div id="waitlist-privacy" className="mx-auto mt-6 max-w-2xl scroll-mt-28 text-left">
          <h3 className="text-sm font-bold">メールアドレスの利用目的</h3>
          <p className="mt-2 text-xs leading-6 text-white">
            ご登録のメールアドレスは、ボランティのサービス開始のお知らせのために使用します。
            この登録で会員アカウントは作成されません。
            メールアドレスは開始案内後30日以内に削除し、サービス未開始の場合も登録から1年で削除します。
          </p>
          <p className="mt-2 text-xs leading-6 text-white">
            運営: SAGARAKA<br />
            登録情報の削除に関するお問い合わせ: <a href="mailto:sagaraka.office@gmail.com" className="underline underline-offset-4">sagaraka.office@gmail.com</a>
          </p>
        </div>
      </div>
    </section>
  );
}
