import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RecommendationFilters } from "./RecommendationFilters"

describe("RecommendationFilters", () => {
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
})
