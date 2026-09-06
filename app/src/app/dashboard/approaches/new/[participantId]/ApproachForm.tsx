"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Save, Send } from "lucide-react";
import Link from "next/link";
import { APPROACH_MESSAGE_MAX_LENGTH } from "@/lib/approaches/constants";
import { saveApproachTemplate, sendApproach } from "@/lib/approaches/actions";
import type {
  ApproachMessageTemplate,
  ApproachOpportunityOption,
} from "@/lib/approaches/types";

interface ApproachFormProps {
  participantProfileId: string;
  participantName: string;
  opportunities: ApproachOpportunityOption[];
  templates: ApproachMessageTemplate[];
}

export function ApproachForm({
  participantProfileId,
  participantName,
  opportunities,
  templates,
}: ApproachFormProps) {
  const firstAvailable = opportunities.find(
    (opportunity) => !opportunity.alreadyApproached
  );
  const [opportunityId, setOpportunityId] = useState(firstAvailable?.id ?? "");
  const [message, setMessage] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isSavingTemplate, startTemplateTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    approachId?: string;
    error?: string;
  } | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);

  const selectedOpportunity = opportunities.find(
    (opportunity) => opportunity.id === opportunityId
  );

  function fillTemplate(body: string) {
    return body
      .replaceAll("{participantName}", participantName)
      .replaceAll("{opportunityTitle}", selectedOpportunity?.title ?? "");
  }

  function handleTemplateSelect(value: string) {
    const template = templates.find((item) => item.id === value);
    if (!template) return;
    setMessage(fillTemplate(template.body));
    setTemplateName(template.name);
    setTemplateMessage(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);

    startTransition(async () => {
      const response = await sendApproach({
        participantProfileId,
        opportunityId,
        message,
      });
      setResult(response);
    });
  }

  function handleSaveTemplate() {
    setTemplateMessage(null);
    startTemplateTransition(async () => {
      const response = await saveApproachTemplate({
        name: templateName,
        body: message,
      });
      setTemplateMessage(
        response.success
          ? "テンプレートを保存しました"
          : (response.error ?? "テンプレートを保存できませんでした")
      );
    });
  }

  if (result?.success) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-green-50 p-6 text-center">
        <CheckCircle2 className="size-10 text-green-700" />
        <div>
          <p className="text-sm font-medium text-green-800">
            アプローチを送信しました。
          </p>
          <p className="mt-1 text-xs text-green-700">
            参加者が承諾すると、連絡先情報が表示されます。
          </p>
        </div>
        <Link
          href="/dashboard/approaches"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
        >
          送信履歴を見る
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-card-border bg-background/60 p-4 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium text-text-dark">
            テンプレート
          </span>
          <select
            defaultValue=""
            onChange={(event) => handleTemplateSelect(event.target.value)}
            className="h-11 w-full min-w-0 max-w-full rounded-lg border border-input-border bg-white px-3 text-sm text-text-dark outline-none transition-colors focus:border-primary"
          >
            <option value="">選択しない</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0">
          <label
            htmlFor="approach-template-name"
            className="mb-2 block text-sm font-medium text-text-dark"
          >
            保存名
          </label>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              id="approach-template-name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-input-border bg-white px-3 text-sm text-text-dark outline-none transition-colors focus:border-primary sm:flex-1"
              placeholder="例: 初回案内"
            />
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isSavingTemplate || !message.trim()}
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-card-border bg-white px-3 text-sm font-medium text-text-dark hover:bg-background disabled:opacity-50 sm:w-auto"
            >
              {isSavingTemplate ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <Save className="size-4 shrink-0" />
              )}
              <span>保存</span>
            </button>
          </div>
        </div>
        {templateMessage && (
          <p className="min-w-0 break-words text-xs text-text-body sm:col-span-2">
            {templateMessage}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="approach-opportunity"
          className="text-sm font-medium text-text-dark"
        >
          関連する募集案件
        </label>
        <select
          id="approach-opportunity"
          value={opportunityId}
          onChange={(event) => setOpportunityId(event.target.value)}
          disabled={isPending || !firstAvailable}
          className="h-11 w-full min-w-0 max-w-full rounded-lg border border-input-border bg-white px-3 text-sm text-text-dark outline-none transition-colors focus:border-primary"
        >
          {!firstAvailable && (
            <option value="">送信可能な公開中案件がありません</option>
          )}
          {opportunities.map((opportunity) => (
            <option
              key={opportunity.id}
              value={opportunity.id}
              disabled={opportunity.alreadyApproached}
            >
              {opportunity.title}
              {opportunity.alreadyApproached ? "（送信済み）" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="approach-message"
          className="text-sm font-medium text-text-dark"
        >
          アプローチ文
        </label>
        <textarea
          id="approach-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="活動内容や参加してほしい理由を入力してください"
          rows={6}
          maxLength={APPROACH_MESSAGE_MAX_LENGTH}
          disabled={isPending || !firstAvailable}
          className="w-full resize-none rounded-lg border border-input-border bg-white px-4 py-3 text-sm text-text-dark placeholder:text-text-body/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        />
        <div className="flex justify-end text-xs text-text-body">
          {message.length}/{APPROACH_MESSAGE_MAX_LENGTH}
        </div>
      </div>

      <div className="rounded-lg bg-background p-4 text-xs leading-6 text-text-body">
        アプリ内でメッセージのやり取りはできません。承諾後にLINE等で連絡します。
        参加者がアプローチを承諾するまで、団体の連絡先は参加者に表示されません。
      </div>

      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}

      <button
        type="submit"
        disabled={isPending || !firstAvailable}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            送信中...
          </>
        ) : (
          <>
            <Send className="size-4" />
            アプローチを送信
          </>
        )}
      </button>
    </form>
  );
}
