import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpportunityForm } from "./OpportunityForm";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

type ValidationField =
  | "title"
  | "description"
  | "publishedAt"
  | "startDate"
  | "endDate"
  | "capacity"
  | "minAge"
  | "maxAge";

interface ActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<ValidationField, string>>;
}

function createAction() {
  return vi.fn<(formData: FormData) => Promise<ActionResult>>();
}

describe("OpportunityForm の入力検証", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
  });

  it("invalid の既定動作を抑止し、入力直下にARIA付きエラーを表示する", async () => {
    const onSubmitAction = createAction();
    onSubmitAction.mockResolvedValue({ success: true });

    render(
      <OpportunityForm
        onSubmitAction={onSubmitAction}
        cancelHref="/dashboard"
      />
    );

    const title = screen.getByLabelText("案件タイトル") as HTMLInputElement;
    const description = screen.getByLabelText("案件説明") as HTMLTextAreaElement;
    const capacity = screen.getByLabelText("定員（任意）") as HTMLInputElement;
    const form = title.closest("form") as HTMLFormElement;
    let formIsValid = true;

    fireEvent.change(description, { target: { value: "説明です" } });
    fireEvent.change(capacity, { target: { value: "0" } });
    act(() => {
      formIsValid = form.checkValidity();
    });

    expect(formIsValid).toBe(false);
    expect(onSubmitAction).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.getByText("案件タイトルを入力してください", { exact: true })
      ).toBeDefined();
      expect(capacity.getAttribute("aria-invalid")).toBe("true");
    });

    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(description.getAttribute("aria-invalid")).not.toBe("true");
    expect(title.getAttribute("aria-describedby")).toBe(
      "opportunity-title-error"
    );
    expect(description.getAttribute("aria-describedby")).toBeNull();
    expect(
      title.closest("[data-validation-field=title]")?.getAttribute("class")
    ).toContain("scroll-mt-24");
    expect(document.activeElement).toBe(title);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "instant",
    });
  });

  it("修正したエラーだけを消し、再送信では残った項目へ移動する", async () => {
    const onSubmitAction = createAction();
    onSubmitAction.mockResolvedValue({ success: true });

    render(
      <OpportunityForm
        onSubmitAction={onSubmitAction}
        cancelHref="/dashboard"
      />
    );

    const form = screen
      .getByRole("button", { name: "作成する" })
      .closest("form") as HTMLFormElement;
    const title = screen.getByLabelText("案件タイトル") as HTMLInputElement;
    const description = screen.getByLabelText("案件説明") as HTMLTextAreaElement;

    // happy-dom 20ではtextarea.willValidateが未実装のため、実ブラウザの検証対象を再現する。
    Object.defineProperty(description, "willValidate", {
      configurable: true,
      value: true,
    });

    let formIsValid = true;
    act(() => {
      formIsValid = form.checkValidity();
    });
    expect(formIsValid).toBe(false);
    await waitFor(() => {
      expect(
        screen.getByText("案件タイトルを入力してください", { exact: true })
      ).toBeDefined();
    });

    fireEvent.change(title, { target: { value: "テスト案件" } });
    await waitFor(() => {
      expect(title.getAttribute("aria-invalid")).not.toBe("true");
      expect(
        screen.queryByText("案件タイトルを入力してください", { exact: true })
      ).toBeNull();
    });
    act(() => {
      form.checkValidity();
    });
    await waitFor(() => {
      expect(
        screen.getByText("案件説明を入力してください", { exact: true })
      ).toBeDefined();
      expect(document.activeElement).toBe(description);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);

    fireEvent.change(description, { target: { value: "説明です" } });
    fireEvent.submit(form);

    await waitFor(() => expect(onSubmitAction).toHaveBeenCalledTimes(1));
    const submitted = onSubmitAction.mock.calls[0]?.[0];
    expect(submitted?.get("title")).toBe("テスト案件");
    expect(submitted?.get("description")).toBe("説明です");
  });

  it("サーバーのpublishedAtフィールドエラーも同じフォーカス処理で表示する", async () => {
    const onSubmitAction = createAction();
    onSubmitAction.mockResolvedValue({
      success: false,
      error: "入力内容を確認してください",
      fieldErrors: { publishedAt: "公開予約日時を確認してください" },
    });

    render(
      <OpportunityForm
        onSubmitAction={onSubmitAction}
        cancelHref="/dashboard"
      />
    );

    fireEvent.change(screen.getByLabelText("案件タイトル"), {
      target: { value: "テスト案件" },
    });
    fireEvent.change(screen.getByLabelText("案件説明"), {
      target: { value: "説明です" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "公開予約" }));

    const form = screen
      .getByRole("button", { name: "作成する" })
      .closest("form") as HTMLFormElement;
    fireEvent.submit(form);

    const publishedAt = screen.getByLabelText("公開日時") as HTMLInputElement;
    await waitFor(() => {
      expect(
        screen.getByText("公開予約日時を確認してください", { exact: true })
      ).toBeDefined();
      expect(document.activeElement).toBe(publishedAt);
    });
    expect(publishedAt.getAttribute("aria-invalid")).toBe("true");
    expect(publishedAt.getAttribute("aria-describedby")).toBe(
      "opportunity-publishedAt-error"
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("必須以外の制約では対象要素のvalidationMessageを表示する", async () => {
    const onSubmitAction = createAction();
    onSubmitAction.mockResolvedValue({ success: true });

    render(
      <OpportunityForm
        onSubmitAction={onSubmitAction}
        cancelHref="/dashboard"
      />
    );

    fireEvent.change(screen.getByLabelText("案件タイトル"), {
      target: { value: "定員テスト案件" },
    });
    fireEvent.change(screen.getByLabelText("案件説明"), {
      target: { value: "定員テストの説明です" },
    });
    const capacity = screen.getByLabelText("定員（任意）") as HTMLInputElement;
    fireEvent.change(capacity, { target: { value: "0" } });
    expect(fireEvent.invalid(capacity)).toBe(false);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        capacity.validationMessage || "入力内容を確認してください"
      );
    });
    expect(capacity.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(capacity);
    expect(onSubmitAction).not.toHaveBeenCalled();
  });

  it("表示対象から外した公開予約日時のエラーを破棄する", async () => {
    const onSubmitAction = createAction();
    onSubmitAction.mockResolvedValue({
      success: false,
      fieldErrors: { publishedAt: "公開予約日時を確認してください" },
    });

    render(
      <OpportunityForm
        onSubmitAction={onSubmitAction}
        cancelHref="/dashboard"
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "公開予約" }));
    const form = screen
      .getByRole("button", { name: "作成する" })
      .closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(
        screen.getByText("公開予約日時を確認してください", { exact: true })
      ).toBeDefined()
    );

    fireEvent.click(screen.getByRole("radio", { name: "すぐ公開" }));
    await waitFor(() =>
      expect(
        screen.queryByText("公開予約日時を確認してください", { exact: true })
      ).toBeNull()
    );
  });
});
