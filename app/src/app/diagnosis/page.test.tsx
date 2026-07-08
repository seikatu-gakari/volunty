import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mocks.getUser(),
    },
    from: (...args: unknown[]) => mocks.from(...args),
  }),
}));

vi.mock("@/app/components/Header", () => ({
  Header: () => <header>ヘッダー</header>,
}));

vi.mock("./components/DiagnosisWizard", () => ({
  DiagnosisWizard: () => <div>診断ウィザード</div>,
}));

import DiagnosisPage from "./page";

describe("DiagnosisPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "participant-user-1",
          user_metadata: {},
        },
      },
    });
    mocks.maybeSingle.mockResolvedValue({
      data: { role: "participant" },
    });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
  });

  it("metadata role が無くても DB role が participant なら診断画面を表示する", async () => {
    const page = await DiagnosisPage();
    render(page);

    expect(screen.getByText("診断ウィザード")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.from).toHaveBeenCalledWith("m_user");
    expect(mocks.select).toHaveBeenCalledWith("role");
    expect(mocks.eq).toHaveBeenCalledWith("id", "participant-user-1");
  });
});
