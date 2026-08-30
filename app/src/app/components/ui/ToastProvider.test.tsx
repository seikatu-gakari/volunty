import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "@/app/components/ui/ToastProvider";

const navigationState = vi.hoisted(() => ({
  pathname: "/login",
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(navigationState.search),
}));

function ManualToastButton() {
  const { showToast } = useToast();

  return (
    <button
      type="button"
      onClick={() =>
        showToast({
          type: "success",
          title: "保存しました",
          description: "変更内容を反映しました。",
        })
      }
    >
      通知する
    </button>
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    navigationState.pathname = "/login";
    navigationState.search = "";
    window.history.replaceState(null, "", "/login");
  });

  it("accountDeleted パラメータから削除完了トーストを表示し、対象パラメータだけ削除する", async () => {
    navigationState.search = "accountDeleted=1&next=%2Fmypage";
    window.history.replaceState(
      null,
      "",
      "/login?accountDeleted=1&next=%2Fmypage"
    );

    render(
      <ToastProvider>
        <div>ログインページ</div>
      </ToastProvider>
    );

    expect(await screen.findByText("アカウントを削除しました")).toBeDefined();
    const searchParams = new URLSearchParams(window.location.search);
    expect(searchParams.has("accountDeleted")).toBe(false);
    expect(searchParams.get("next")).toBe("/mypage");
  });

  it("cleanup 保留を削除完了と区別して表示する", async () => {
    navigationState.search = "accountDeletionPending=1";
    window.history.replaceState(null, "", "/login?accountDeletionPending=1");

    render(
      <ToastProvider>
        <div>ログインページ</div>
      </ToastProvider>
    );

    expect(await screen.findByText("削除申請を受け付けました")).toBeDefined();
    expect(screen.queryByText("アカウントを削除しました")).toBeNull();
  });

  it("error=auth パラメータからログイン失敗トーストを表示する", async () => {
    navigationState.search = "error=auth";
    window.history.replaceState(null, "", "/login?error=auth");

    render(
      <ToastProvider>
        <div>ログインページ</div>
      </ToastProvider>
    );

    expect(await screen.findByText("ログインに失敗しました")).toBeDefined();
  });

  it("error=suspended はトーストを表示せずログイン画面用にパラメータを維持する", () => {
    navigationState.search = "error=suspended";
    window.history.replaceState(null, "", "/login?error=suspended");

    render(
      <ToastProvider>
        <div>ログインページ</div>
      </ToastProvider>
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(new URLSearchParams(window.location.search).get("error")).toBe(
      "suspended"
    );
  });

  it("クライアント遷移後に URL パラメータが付いた場合もトーストを表示する", async () => {
    const { rerender } = render(
      <ToastProvider>
        <div>ログインページ</div>
      </ToastProvider>
    );

    expect(screen.queryByText("アカウントを削除しました")).toBeNull();

    navigationState.search = "accountDeleted=1";
    window.history.replaceState(null, "", "/login?accountDeleted=1");

    rerender(
      <ToastProvider>
        <div>ログインページ</div>
      </ToastProvider>
    );

    expect(await screen.findByText("アカウントを削除しました")).toBeDefined();
    expect(new URLSearchParams(window.location.search).has("accountDeleted")).toBe(
      false
    );
  });

  it("useToast から手動でトーストを表示できる", async () => {
    render(
      <ToastProvider>
        <ManualToastButton />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "通知する" }));

    expect(await screen.findByText("保存しました")).toBeDefined();
    expect(screen.getByText("変更内容を反映しました。")).toBeDefined();
  });
});
