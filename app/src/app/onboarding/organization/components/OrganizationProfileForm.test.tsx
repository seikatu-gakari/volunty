import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationProfileForm } from "./OrganizationProfileForm";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  registerOrganization: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("@/lib/onboarding/actions", () => ({
  registerOrganization: mocks.registerOrganization,
}));

describe("OrganizationProfileForm", () => {
  const activityAreas = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
  ];

  const defaultValues = {
    organizationName: "NPO法人テスト",
    representativeName: "山田 太郎",
    contactEmail: "contact@example.org",
    activityAreas: ["東京都"],
    description: "団体の説明",
    activityCategories: [],
    websiteUrl: "",
    logoUrl: "",
    contactLineId: "@test",
    contactLineUrl: "",
  };

  beforeEach(() => {
    mocks.push.mockClear();
    mocks.registerOrganization.mockReset();
    mocks.registerOrganization.mockResolvedValue({ success: true });
  });

  it("47都道府県を名前付きのcheckboxとして表示し、初期選択を反映する", () => {
    render(<OrganizationProfileForm defaultValues={defaultValues} />);

    const activityAreaGroup = screen.getByRole("group", {
      name: "主な活動地域（複数選択可・必須）",
    });
    const checkboxes = within(activityAreaGroup).getAllByRole("checkbox");

    expect(activityAreas).toHaveLength(47);
    expect(checkboxes).toHaveLength(activityAreas.length);
    for (const area of activityAreas) {
      const checkbox = within(activityAreaGroup).getByRole("checkbox", {
        name: area,
      }) as HTMLInputElement;

      expect(checkbox.value).toBe(area);
      expect(checkbox.name).toBe("activityAreas");
      expect(checkbox.checked).toBe(area === "東京都");
      expect(checkbox.required).toBe(false);
      expect(checkbox.getAttribute("aria-checked")).toBeNull();
      expect(checkbox.getAttribute("role")).toBeNull();
      expect(checkbox.classList.contains("hidden")).toBe(false);
      expect(checkbox.tabIndex).toBe(0);
    }
  });

  it("地域のクリックで選択・解除でき、他の選択状態と重複しない", () => {
    render(<OrganizationProfileForm defaultValues={defaultValues} />);

    const hokkaido = screen.getByRole("checkbox", { name: "北海道" }) as HTMLInputElement;
    const tokyo = screen.getByRole("checkbox", { name: "東京都" }) as HTMLInputElement;

    expect(tokyo.checked).toBe(true);
    expect(hokkaido.checked).toBe(false);

    fireEvent.click(hokkaido);
    expect(hokkaido.checked).toBe(true);
    expect(tokyo.checked).toBe(true);

    fireEvent.click(hokkaido);
    expect(hokkaido.checked).toBe(false);
    expect(tokyo.checked).toBe(true);
  });

  it("選択した地域を重複させずにregisterOrganizationへ渡す", async () => {
    render(<OrganizationProfileForm defaultValues={defaultValues} />);

    const hokkaido = screen.getByRole("checkbox", { name: "北海道" }) as HTMLInputElement;
    fireEvent.click(hokkaido);
    fireEvent.click(hokkaido);
    fireEvent.click(hokkaido);
    fireEvent.click(screen.getByRole("checkbox", { name: "大阪府" }));
    fireEvent.click(screen.getByRole("button", { name: "登録して審査を申請する" }));

    await waitFor(() => {
      expect(mocks.registerOrganization).toHaveBeenCalledTimes(1);
    });
    expect(mocks.registerOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        activityAreas: ["東京都", "北海道", "大阪府"],
      }),
    );
  });

  it("LINE公式アカウントIDを必須項目として表示する", () => {
    render(<OrganizationProfileForm />);

    expect(screen.getByRole("heading", { name: "LINE 連携" })).toBeDefined();
    expect(screen.queryByText("LINE 連携（任意）")).toBeNull();
    expect(
      screen.getByText(
        "参加者との連絡に使用する団体・公式LINEアカウントのIDを入力してください。"
      )
    ).toBeDefined();
    expect(
      screen.getByText(
        "個人アカウントではなく、団体で管理できるアカウントの利用を推奨します。"
      )
    ).toBeDefined();

    const lineIdInput = screen.getByLabelText(
      "LINE公式アカウントID"
    ) as HTMLInputElement;
    expect(lineIdInput.required).toBe(true);
    expect(screen.getByLabelText("LINE 友達追加 URL")).toBeDefined();
  });

  it("LINE公式アカウントIDが未入力の場合は登録処理を中断する", async () => {
    render(<OrganizationProfileForm />);

    fireEvent.change(screen.getByLabelText("団体名"), {
      target: { value: "NPO法人テスト" },
    });
    fireEvent.change(screen.getByLabelText("代表者名"), {
      target: { value: "山田 太郎" },
    });
    fireEvent.change(screen.getByLabelText("連絡先メールアドレス"), {
      target: { value: "contact@example.org" },
    });
    fireEvent.click(screen.getByLabelText("東京都"));
    fireEvent.click(
      screen.getByRole("button", { name: "登録して審査を申請する" })
    );

    await waitFor(() => {
      expect(screen.getByText("LINE公式アカウントIDは必須です")).toBeDefined();
    });
    expect(mocks.registerOrganization).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
