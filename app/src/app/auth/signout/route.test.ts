import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signOut: signOutMock },
  })),
}));

import { GET } from "./route";

describe("GET /auth/signout", () => {
  beforeEach(() => {
    signOutMock.mockReset();
  });

  it.each([
    [
      "通常ログアウト",
      "http://localhost:3000/auth/signout",
      "http://localhost:3000/",
    ],
    [
      "アカウント切り替え",
      "http://localhost:3000/auth/signout?intent=switch-account",
      "http://localhost:3000/login",
    ],
    [
      "凍結ユーザー",
      "http://localhost:3000/auth/signout?reason=suspended",
      "http://localhost:3000/login?error=suspended",
    ],
    [
      "凍結理由と切り替え意図の同時指定",
      "http://localhost:3000/auth/signout?reason=suspended&intent=switch-account",
      "http://localhost:3000/login?error=suspended",
    ],
    [
      "未知のintent",
      "http://localhost:3000/auth/signout?intent=unknown",
      "http://localhost:3000/",
    ],
    [
      "未知のreason",
      "http://localhost:3000/auth/signout?reason=unknown",
      "http://localhost:3000/",
    ],
    [
      "未知のreasonと切り替え意図の同時指定",
      "http://localhost:3000/auth/signout?reason=unknown&intent=switch-account",
      "http://localhost:3000/",
    ],
    [
      "外部URLの指定",
      "http://localhost:3000/auth/signout?next=https://evil.example&returnTo=//evil.example",
      "http://localhost:3000/",
    ],
  ])(
    "%sでは固定された遷移先へリダイレクトする",
    async (_, requestUrl, expected) => {
      const response = await GET(new Request(requestUrl));

      expect(signOutMock).toHaveBeenCalledOnce();
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(expected);
    },
  );

  it("Docker開発環境の0.0.0.0をlocalhostへ補正する", async () => {
    const response = await GET(new Request("http://0.0.0.0:3000/auth/signout"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });
});
