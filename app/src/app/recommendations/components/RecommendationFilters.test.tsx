import { fireEvent, render, screen } from "@testing-library/react"
import type { MouseEventHandler, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RecommendationFilters } from "./RecommendationFilters"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    className,
    "aria-disabled": ariaDisabled,
  }: {
    children: ReactNode
    href: string
    onClick?: MouseEventHandler<HTMLAnchorElement>
    className?: string
    "aria-disabled"?: boolean
  }) => (
    <a
      href={href}
      onClick={onClick}
      className={className}
      aria-disabled={ariaDisabled}
    >
      {children}
    </a>
  ),
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

  it("検索条件を送信するとURL遷移を開始する", () => {
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

    const form = screen.getByRole("form", { name: "おすすめ案件フィルター" })
    fireEvent.submit(form)

    const expectedParams = new URLSearchParams({
      category: "地域活動",
      region: "練馬区",
      participationMode: "online",
    }).toString()

    expect(pushMock).toHaveBeenCalledWith(`/recommendations?${expectedParams}`)
    expect(form.getAttribute("aria-busy")).toBe("false")
    expect(
      screen.getByRole("button", { name: "絞り込む" }).getAttribute("disabled")
    ).toBeNull()
  })
  it("検索結果の条件更新後にクリアすると全selectを初期化する", () => {
    const { rerender } = render(<RecommendationFilters filters={{}} />)

    fireEvent.change(screen.getByRole("combobox", { name: "カテゴリ" }), {
      target: { value: "環境保全" },
    })
    fireEvent.change(screen.getByRole("combobox", { name: "地域" }), {
      target: { value: "新宿区" },
    })
    fireEvent.change(screen.getByRole("combobox", { name: "参加形態" }), {
      target: { value: "online" },
    })
    fireEvent.submit(screen.getByRole("form", { name: "おすすめ案件フィルター" }))

    rerender(
      <RecommendationFilters
        filters={{ category: "環境保全", region: "新宿区", participationMode: "online" }}
      />
    )
    expect((screen.getByRole("combobox", { name: "カテゴリ" }) as HTMLSelectElement).value).toBe("環境保全")

    rerender(<RecommendationFilters filters={{}} />)

    expect((screen.getByRole("combobox", { name: "カテゴリ" }) as HTMLSelectElement).value).toBe("")
    expect((screen.getByRole("combobox", { name: "地域" }) as HTMLSelectElement).value).toBe("")
    expect((screen.getByRole("combobox", { name: "参加形態" }) as HTMLSelectElement).value).toBe("")
    expect(screen.getByRole("button", { name: "絞り込む" }).getAttribute("disabled")).toBeNull()
  })

  it("条件ありのクリアはフォームをリセットして一覧へ遷移する", () => {
    render(
      <RecommendationFilters
        filters={{ category: "環境保全", region: "新宿区", participationMode: "online" }}
      />
    )

    fireEvent.click(screen.getByRole("link", { name: /クリア/ }))

    expect(pushMock).toHaveBeenCalledWith("/recommendations")
    expect((screen.getByRole("combobox", { name: "カテゴリ" }) as HTMLSelectElement).value).toBe("")
    expect((screen.getByRole("combobox", { name: "地域" }) as HTMLSelectElement).value).toBe("")
    expect((screen.getByRole("combobox", { name: "参加形態" }) as HTMLSelectElement).value).toBe("")
  })

  it("条件なしで未送信の選択だけをクリアしても遷移しない", () => {
    render(<RecommendationFilters filters={{}} />)

    fireEvent.change(screen.getByRole("combobox", { name: "カテゴリ" }), {
      target: { value: "環境保全" },
    })
    fireEvent.click(screen.getByRole("link", { name: /クリア/ }))

    expect(pushMock).not.toHaveBeenCalled()
    expect((screen.getByRole("combobox", { name: "カテゴリ" }) as HTMLSelectElement).value).toBe("")
  })

  it("確定済みと同じ条件の送信では遷移しない", () => {
    render(
      <RecommendationFilters
        filters={{ category: "環境保全", region: "新宿区", participationMode: "online" }}
      />
    )

    fireEvent.submit(screen.getByRole("form", { name: "おすすめ案件フィルター" }))

    expect(pushMock).not.toHaveBeenCalled()
  })

})
