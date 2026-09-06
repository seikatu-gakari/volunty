import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeaturesSection } from "./FeaturesSection";

describe("FeaturesSection", () => {
  it("実態と乖離するAI・独自アルゴリズム表現を含まない", () => {
    render(<FeaturesSection />);

    expect(screen.queryByText(/AI/)).toBeNull();
    expect(screen.queryByText(/独自アルゴリズム/)).toBeNull();
  });
});
