"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useRef, type MouseEvent } from "react";
import { CATEGORY_OPTIONS, PARTICIPATION_MODE_OPTIONS } from "@/lib/opportunities/constants";
import type { PublicOpportunityFilters } from "@/lib/opportunities/public-list";

type OpportunityFiltersProps = {
  filters: PublicOpportunityFilters;
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export function OpportunityFilters({
  filters,
}: OpportunityFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function handleClearClick(event: MouseEvent<HTMLAnchorElement>) {
    if (isModifiedClick(event)) return;
    formRef.current?.reset();
  }

  return (
    <form
      ref={formRef}
      action="/opportunities"
      className="mb-8 grid gap-4 rounded-lg border border-card-border bg-white p-4 shadow-sm md:grid-cols-3"
      method="get"
    >
      <label className="flex flex-col gap-1 md:col-span-3">
        <span className="text-sm font-medium text-text-dark">キーワード</span>
        <input
          className="h-11 rounded-lg border border-input-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          defaultValue={filters.q ?? ""}
          name="q"
          placeholder="タイトル・活動内容・団体名で検索"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-dark">カテゴリ</span>
        <select
          className="h-11 rounded-lg border border-input-border px-3 text-sm"
          defaultValue={filters.category ?? ""}
          name="category"
        >
          <option value="">すべて</option>
          {CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-dark">地域</span>
        <input
          className="h-11 rounded-lg border border-input-border px-3 text-sm"
          defaultValue={filters.region ?? ""}
          name="region"
          placeholder="例: 渋谷区"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-dark">参加形態</span>
        <select
          className="h-11 rounded-lg border border-input-border px-3 text-sm"
          defaultValue={filters.participationMode ?? ""}
          name="participationMode"
        >
          <option value="">すべて</option>
          {PARTICIPATION_MODE_OPTIONS.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-text-dark">
        <input
          defaultChecked={filters.schedule === "weekend"}
          name="schedule"
          type="checkbox"
          value="weekend"
          className="accent-primary"
        />
        週末に参加できる
      </label>
      <label className="flex items-center gap-2 text-sm text-text-dark">
        <input
          defaultChecked={filters.beginner === true}
          name="beginner"
          type="checkbox"
          value="true"
          className="accent-primary"
        />
        初心者歓迎
      </label>
      <div className="flex gap-2 md:col-span-3">
        <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark">
          <Search className="size-4" />
          検索する
        </button>
        <Link
          href="/opportunities"
          onClick={handleClearClick}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-card-border px-4 text-sm font-medium text-text-body hover:bg-background"
        >
          <X className="size-4" />
          条件を解除
        </Link>
      </div>
    </form>
  );
}
