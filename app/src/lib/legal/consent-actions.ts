"use server";

import { cookies } from "next/headers";
import {
  SIGNUP_CONSENT_COOKIE,
  SIGNUP_CONSENT_MAX_AGE_SECONDS,
} from "./documents";
import { createSignupConsentToken } from "./consent-token";

export type PrepareSignupConsentResult =
  | { success: true }
  | { success: false; error: string };

/** OAuth開始前に、現行版への同意を署名付きHttpOnly cookieへ保存する。 */
export async function prepareSignupConsent(): Promise<PrepareSignupConsentResult> {
  try {
    const cookieStore = await cookies();
    cookieStore.set({
      name: SIGNUP_CONSENT_COOKIE,
      value: createSignupConsentToken(),
      httpOnly: true,
      maxAge: SIGNUP_CONSENT_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return { success: true };
  } catch (error) {
    console.error("[prepareSignupConsent] 同意トークンの保存に失敗しました", {
      code: "consent_token_failed",
      error,
    });
    return {
      success: false,
      error: "登録準備に失敗しました。時間をおいて再度お試しください。",
    };
  }
}
