import Link from "next/link";

interface AuthFooterProps {
  message: string;
  linkText: string;
  linkHref: string;
}

export function AuthFooter({ message, linkText, linkHref }: AuthFooterProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-sm text-text-body">{message}</p>
      <Link
        href={linkHref}
        className="text-sm font-bold text-primary hover:underline"
      >
        {linkText}
      </Link>
    </div>
  );
}
