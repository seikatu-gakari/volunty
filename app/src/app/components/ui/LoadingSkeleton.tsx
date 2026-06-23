type LoadingVariant = "dashboard" | "detail" | "form" | "list";

type SkeletonProps = {
  className?: string;
};

type PageLoadingSkeletonProps = {
  title: string;
  description?: string;
  itemCount?: number;
  variant?: LoadingVariant;
};

function getItemCount(itemCount: number | undefined, fallback: number) {
  if (typeof itemCount !== "number") {
    return fallback;
  }

  return Math.max(1, Math.min(itemCount, 6));
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-tab-bg ${className}`}
    />
  );
}

function LoadingHeaderSkeleton() {
  return (
    <header className="border-b border-header-border bg-background/60">
      <div className="mx-auto flex h-[77px] max-w-7xl items-center justify-between px-8 pt-4 pb-px">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-full bg-primary/10" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="hidden h-3 w-44 sm:block" />
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </header>
  );
}

function LoadingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-card-border bg-background/80 p-5 shadow-sm">
      {children}
    </div>
  );
}

function ListLoadingSkeleton({
  itemCount,
  title,
}: {
  itemCount: number;
  title: string;
}) {
  return (
    <>
      <LoadingCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-36" />
        </div>
      </LoadingCard>
      <ul
        aria-label={`${title}の読み込み項目`}
        className="mt-4 flex flex-col gap-4"
      >
        {Array.from({ length: itemCount }).map((_, index) => (
          <li key={index}>
            <LoadingCard>
              <div className="flex flex-col gap-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-7 w-20 rounded-full bg-primary/10" />
                  <Skeleton className="h-7 w-24 rounded-full bg-primary/10" />
                </div>
              </div>
            </LoadingCard>
          </li>
        ))}
      </ul>
    </>
  );
}

function DetailLoadingSkeleton({ title }: { title: string }) {
  return (
    <section aria-label={`${title}の詳細を読み込み中`}>
      <LoadingCard>
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 rounded-full bg-primary/10" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </LoadingCard>
    </section>
  );
}

function DashboardLoadingSkeleton({
  itemCount,
  title,
}: {
  itemCount: number;
  title: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <LoadingCard key={index}>
            <div className="flex flex-col gap-3">
              <Skeleton className="size-10 rounded-full bg-primary/10" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          </LoadingCard>
        ))}
      </div>
      <ul
        aria-label={`${title}の読み込み項目`}
        className="mt-6 flex flex-col gap-3"
      >
        {Array.from({ length: itemCount }).map((_, index) => (
          <li key={index}>
            <LoadingCard>
              <div className="flex items-center gap-4">
                <Skeleton className="size-10 rounded-full bg-primary/10" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            </LoadingCard>
          </li>
        ))}
      </ul>
    </>
  );
}

function FormLoadingSkeleton({ title }: { title: string }) {
  return (
    <div
      aria-label={`${title}の入力項目を読み込み中`}
      className="flex flex-col gap-4 rounded-[10px] border border-card-border bg-background/80 p-5 shadow-sm"
      role="group"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32 bg-primary/10" />
      </div>
    </div>
  );
}

export function PageLoadingSkeleton({
  title,
  description,
  itemCount,
  variant = "list",
}: PageLoadingSkeletonProps) {
  const resolvedItemCount = getItemCount(
    itemCount,
    variant === "dashboard" ? 3 : 4,
  );

  return (
    <div
      aria-busy="true"
      aria-label={`${title}を読み込み中`}
      className="min-h-screen bg-background font-sans"
      role="status"
    >
      <LoadingHeaderSkeleton />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-3">
          <Skeleton className="h-8 w-48" />
          {description ? (
            <p className="text-sm text-text-body">{description}</p>
          ) : (
            <Skeleton className="h-4 w-full max-w-md" />
          )}
          <p className="text-sm text-text-body">読み込み中...</p>
        </div>

        {variant === "dashboard" && (
          <DashboardLoadingSkeleton
            itemCount={resolvedItemCount}
            title={title}
          />
        )}
        {variant === "detail" && <DetailLoadingSkeleton title={title} />}
        {variant === "form" && <FormLoadingSkeleton title={title} />}
        {variant === "list" && (
          <ListLoadingSkeleton itemCount={resolvedItemCount} title={title} />
        )}
      </main>
    </div>
  );
}
