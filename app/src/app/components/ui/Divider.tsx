export function Divider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 border-t border-divider-border" />
      <span className="text-sm text-text-body">{text}</span>
      <div className="h-px flex-1 border-t border-divider-border" />
    </div>
  );
}
