import Link from "next/link";
import { BrandLogo } from "@/app/components/BrandLogo";
import { LegalLinks } from "./LegalLinks";

export function LegalFooter() {
  return (
    <footer className="border-t border-card-border py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 sm:grid-cols-[1.5fr_1fr]">
        <div>
          <Link href="/" className="inline-flex" aria-label="ボランティ ホーム">
            <BrandLogo />
          </Link>
          <p className="mt-4 text-sm leading-7 text-text-body">
            自分らしく続けられるボランティアとの出会いを。
          </p>
        </div>
        <LegalLinks />
      </div>
      <div className="mx-auto mt-8 w-full max-w-5xl border-t border-card-border px-6 pt-5">
        <p className="text-xs text-text-body">© 2026 ボランティ. All rights reserved.</p>
      </div>
    </footer>
  );
}
