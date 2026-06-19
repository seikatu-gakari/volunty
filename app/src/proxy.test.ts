import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mocks.updateSession,
}));

function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

function mockGuestSession(request: NextRequest) {
  mocks.updateSession.mockResolvedValue({
    response: NextResponse.next({ request }),
    user: null,
  });
}

describe("proxy", () => {
  beforeEach(() => {
    mocks.updateSession.mockReset();
  });

  it("未認証の未知URLはログインへ送らず404判定へ通す", async () => {
    const request = createRequest("/missing-page");
    mockGuestSession(request);

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("未認証の保護ルートはログインへリダイレクトする", async () => {
    const request = createRequest("/dashboard");
    mockGuestSession(request);

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url,
    );

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });
});
