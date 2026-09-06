import { Header } from "@/app/components/Header";
import { LegalFooter } from "./LegalFooter";
import {
  LEGAL_LAST_UPDATED,
  LEGAL_DOCUMENTS,
} from "@/lib/legal/documents";

type DocumentDefinition = (typeof LEGAL_DOCUMENTS)[keyof typeof LEGAL_DOCUMENTS];

interface LegalDocumentLayoutProps {
  document: DocumentDefinition;
  children: React.ReactNode;
}

export function LegalDocumentLayout({
  document,
  children,
}: LegalDocumentLayoutProps) {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14">
        <article className="rounded-2xl border border-card-border bg-white p-6 shadow-sm sm:p-10">
          <div className="border-b border-card-border pb-6">
            <h1 className="text-3xl font-bold tracking-tight text-text-dark">
              {document.label}
            </h1>
            <dl className="mt-4 grid gap-2 text-sm text-text-body sm:grid-cols-2">
              <div>
                <dt className="font-medium text-text-dark">最終更新日</dt>
                <dd>{LEGAL_LAST_UPDATED}</dd>
              </div>
              {"version" in document && (
                <div>
                  <dt className="font-medium text-text-dark">版</dt>
                  <dd>{document.version}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="mt-8 space-y-8 text-sm leading-7 text-text-body">
            {children}
          </div>
        </article>
      </main>
      <LegalFooter />
    </div>
  );
}
