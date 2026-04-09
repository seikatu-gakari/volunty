import { Header } from "@/app/components/Header";
import { DiagnosisWizard } from "./components/DiagnosisWizard";

export default function DiagnosisPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <DiagnosisWizard />
      </main>
    </div>
  );
}
