import { Header } from "@/app/components/Header";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      {children}
    </div>
  );
}
