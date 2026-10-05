import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WaitlistForm } from "@/app/components/lp/WaitlistForm";

const fetchMock = vi.fn<typeof fetch>();

function submitEmail(email: string) {
  fireEvent.change(screen.getByRole("textbox", { name: /メールアドレス/ }), {
    target: { value: email },
  });
  fireEvent.submit(screen.getByRole("form", { name: "開始通知の事前登録" }));
}

describe("WaitlistForm", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("メール入力にラベルと利用目的のリンクを付ける", () => {
    render(<WaitlistForm />);

    const email = screen.getByRole("textbox", { name: /メールアドレス/ });
    expect(email.getAttribute("type")).toBe("email");
    expect(email.getAttribute("autocomplete")).toBe("email");
    expect(email.hasAttribute("required")).toBe(true);
    expect(email.getAttribute("maxlength")).toBe("254");
    expect(screen.getByRole("link", { name: "メールアドレスの利用目的" }).getAttribute("href")).toBe("#waitlist-privacy");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByRole("form").getAttribute("method")).toBe("post");
    expect(screen.getByRole("form").getAttribute("action")).toBe("/api/waitlist");
  });

  it.each([
    ["", "メールアドレスを入力してください。"],
    ["not-an-email", "有効なメールアドレスを入力してください。"],
    ["person@localhost", "有効なメールアドレスを入力してください。"],
    [`${"a".repeat(65)}@example.com`, "有効なメールアドレスを入力してください。"],
  ])("不正なメール（%s）は送信せず入力欄へフォーカスする", (email, message) => {
    render(<WaitlistForm />);
    submitEmail(email);

    const input = screen.getByRole("textbox", { name: /メールアドレス/ });
    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("waitlist-error");
    expect(document.activeElement).toBe(input);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("メールを正規化してAPIに送信し、登録完了をライブ通知する", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<WaitlistForm />);
    submitEmail("  Person@Example.COM  ");

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("開始通知の登録を受け付けました"));
    expect(fetchMock).toHaveBeenCalledWith("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", website: "" }),
    });
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("処理中は入力とボタンを無効にし、重複送信しない", async () => {
    let finishRequest!: (response: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => {
      finishRequest = resolve;
    }));
    render(<WaitlistForm />);
    submitEmail("person@example.com");

    expect(screen.getByRole("button", { name: "登録中…" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("登録内容を送信しています。");
    fireEvent.submit(screen.getByRole("form"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => finishRequest(new Response(JSON.stringify({ ok: true }))));
    expect(screen.getByRole("status").textContent).toContain("開始通知の登録を受け付けました");
  });

  it.each([400, 429, 503])("APIのエラー（%s）を表示し、再試行できる", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "時間をおいて再度お試しください。" }), { status }));
    render(<WaitlistForm />);
    submitEmail("person@example.com");

    expect((await screen.findByRole("alert")).textContent).toBe("時間をおいて再度お試しください。");
    expect(screen.getByRole("button", { name: "開始通知を受け取る" }).hasAttribute("disabled")).toBe(false);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("person@example.com");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("開始通知の登録を受け付けました"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("通信エラーを表示し入力を維持する", async () => {
    fetchMock.mockRejectedValue(new Error("ネットワーク切断"));
    render(<WaitlistForm />);
    submitEmail("person@example.com");

    expect((await screen.findByRole("alert")).textContent).toContain("通信に失敗しました");
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("person@example.com");
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
  });

  it.each([
    ["JSONではない応答", 503],
    [JSON.stringify({ error: 123 }), 400],
    [JSON.stringify({}), 200],
  ])("不正な応答を成功として扱わず一般的なエラーを表示する", async (body, status) => {
    fetchMock.mockResolvedValue(new Response(body, { status }));
    render(<WaitlistForm />);
    submitEmail("person@example.com");

    expect((await screen.findByRole("alert")).textContent).toBe("登録できませんでした。時間をおいて、もう一度お試しください。");
    expect(screen.getByRole("status").textContent).not.toContain("登録を受け付けました");
  });

  it("入力を修正すると入力エラーを解除する", () => {
    render(<WaitlistForm />);
    submitEmail("");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "person@example.com" } });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("false");
  });

  it("自動登録対策の値をAPIへ渡す", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<WaitlistForm />);
    fireEvent.change(screen.getByLabelText("ウェブサイト（入力しないでください）"), { target: { value: "https://example.com" } });
    submitEmail("person@example.com");

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("登録を受け付けました"));
    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(request?.body as string)).toEqual({ email: "person@example.com", website: "https://example.com" });
  });
});
