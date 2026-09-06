import Link from "next/link";
import { LEGAL_DOCUMENT_LINKS } from "@/lib/legal/documents";

export function LegalLinks() {
  return (
    <div>
      <p className="mb-4 text-sm font-black text-text-dark">法務・サポート</p>
      <ul className="space-y-3">
        {LEGAL_DOCUMENT_LINKS.map((document) => (
          <li key={document.href}>
            <Link
              href={document.href}
              className="text-sm text-text-body transition-colors hover:text-secondary-dark"
            >
              {document.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
