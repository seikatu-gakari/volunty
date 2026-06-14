import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RecommendationFilters } from "./RecommendationFilters"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

describe("RecommendationFilters", () => {
  beforeEach(() => {
    pushMock.mockClear()
  })

  it("地域と参加形態を選択式フィルタとして表示する", () => {
    render(
      <RecommendationFilters
        filters={{
          category: "地域活動",
          region: "練馬区",
          participationMode: "online",
        }}
      />
    )

    const regionSelect = screen.getByRole("combobox", { name: "地域" })
    const participationModeSelect = screen.getByRole("combobox", {
      name: "参加形態",
    })

    expect(regionSelect.getAttribute("name")).toBe("region")
    expect((regionSelect as HTMLSelectElement).value).toBe("練馬区")
    expect(screen.getByRole("option", { name: "八王子市" })).toBeTruthy()
    expect(participationModeSelect.getAttribute("name")).toBe(
      "participationMode"
    )
    expect((participationModeSelect as HTMLSelectElement).value).toBe("online")
    expect(screen.getByRole("option", { name: "オンライン" })).toBeTruthy()
    expect(screen.getByRole("option", { name: "オフライン" })).toBeTruthy()
  })

  it("検索送信中はローディング表示に切り替える", () => {
    render(<RecommendationFilters filters={{}} />)

    fireEvent.change(screen.getByRole("combobox", { name: "カテゴリ" }), {
      target: { value: "地域活動" },
    })
    fireEvent.change(screen.getByRole("combobox", { name: "地域" }), {
      target: { value: "練馬区" },
    })
    fireEvent.change(screen.getByRole("combobox", { name: "参加形態" }), {
      target: { value: "online" },
    })

    fireEvent.submit(
      screen.getByRole("form", { name: "おすすめ案件フィルター" })
    )

    const expectedParams = new URLSearchParams({
      category: "地域活動",
      region: "練馬区",
      participationMode: "online",
    }).toString()

    expect(pushMock).toHaveBeenCalledWith(`/recommendations?${expectedParams}`)
    expect(
      screen.getByRole("button", { name: "検索中" }).getAttribute("disabled")
    ).not.toBeNull()
  })
})
