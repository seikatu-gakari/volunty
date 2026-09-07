import { Header } from "@/app/components/Header";
import { LegalFooter } from "@/app/components/legal/LegalFooter";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      {children}
      <LegalFooter />
    </div>
  );
}
