import { describe, expect, it } from "vitest";
import { needsRoleSelection, type OnboardingProfileState } from "./role";

describe("needsRoleSelection", () => {
  it("participant の対応プロフィールがない場合はロール選択を必要とする", () => {
    const state: OnboardingProfileState = {
      role: "participant",
      hasParticipantProfile: false,
      hasOrganizationProfile: false,
    };

    expect(needsRoleSelection(state)).toBe(true);
  });

  it("participant の対応プロフィールがある場合はロール選択を必要としない", () => {
    const state: OnboardingProfileState = {
      role: "participant",
      hasParticipantProfile: true,
      hasOrganizationProfile: false,
    };

    expect(needsRoleSelection(state)).toBe(false);
  });

  it("organization の対応プロフィールがない場合はロール選択を必要とする", () => {
    const state: OnboardingProfileState = {
      role: "organization",
      hasParticipantProfile: false,
      hasOrganizationProfile: false,
    };

    expect(needsRoleSelection(state)).toBe(true);
  });

  it("organization の対応プロフィールがある場合はロール選択を必要としない", () => {
    const state: OnboardingProfileState = {
      role: "organization",
      hasParticipantProfile: false,
      hasOrganizationProfile: true,
    };

    expect(needsRoleSelection(state)).toBe(false);
  });

  it("admin はプロフィールの有無にかかわらずロール選択を必要としない", () => {
    const state: OnboardingProfileState = {
      role: "admin",
      hasParticipantProfile: false,
      hasOrganizationProfile: false,
    };

    expect(needsRoleSelection(state)).toBe(false);
  });

  it("現在のロールと反対側のプロフィールだけでは完了扱いにしない", () => {
    expect(
      needsRoleSelection({
        role: "participant",
        hasParticipantProfile: false,
        hasOrganizationProfile: true,
      }),
    ).toBe(true);
    expect(
      needsRoleSelection({
        role: "organization",
        hasParticipantProfile: true,
        hasOrganizationProfile: false,
      }),
    ).toBe(true);
  });
});
