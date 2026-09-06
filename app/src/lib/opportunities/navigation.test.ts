import { describe, expect, it } from "vitest";
import {
  buildOpportunityDetailHref,
  buildOpportunityLoginHref,
  getOpportunityBackLink,
  getOpportunityViewSource,
  normalizeOpportunitySearchFilters,
} from "./navigation";

describe("getOpportunityViewSource", () => {
  it.each([
    ["rec", "recommendation"],
    ["search", "search"],
    [undefined, "direct"],
    ["", "direct"],
    ["unknown", "direct"],
    [["unknown", "search"], "direct"],
  ] satisfies [string | string[] | undefined, string][])("%j を %s に変換する", (from, expected) => {
    expect(getOpportunityViewSource(from)).toBe(expected);
  });
});

describe("normalizeOpportunitySearchFilters", () => {
  it("有効な検索条件の先頭値を正規化する", () => {
    expect(
      normalizeOpportunitySearchFilters({
        q: ["  子ども & 学習?  ", "無視される値"],
        category: "子ども支援",
        region: " 新宿区 ",
        participationMode: "online",
        schedule: "weekend",
        beginner: "true",
      })
    ).toEqual({
      q: "子ども & 学習?",
      category: "子ども支援",
      region: "新宿区",
      participationMode: "online",
      schedule: "weekend",
      beginner: true,
    });
  });

  it("空値と無効な選択値を除外する", () => {
    expect(
      normalizeOpportunitySearchFilters({
        q: "  ",
        category: "未定義カテゴリ",
        participationMode: "remote",
        schedule: "weekday",
        beginner: "false",
      })
    ).toEqual({});
  });
});

describe("案件詳細のナビゲーション", () => {
  const searchParams = {
    q: "子ども & 学習?",
    category: "子ども支援",
    region: "新宿区",
    participationMode: "online",
    schedule: "weekend",
    beginner: "true",
  };

  it("検索条件をエンコードして詳細URLへ引き継ぐ", () => {
    expect(buildOpportunityDetailHref("opp-1", searchParams)).toBe(
      "/opportunities/opp-1?from=search&q=%E5%AD%90%E3%81%A9%E3%82%82+%26+%E5%AD%A6%E7%BF%92%3F&category=%E5%AD%90%E3%81%A9%E3%82%82%E6%94%AF%E6%8F%B4&region=%E6%96%B0%E5%AE%BF%E5%8C%BA&participationMode=online&schedule=weekend&beginner=true"
    );
  });

  it("検索流入では同じ条件の検索結果へ戻す", () => {
    expect(getOpportunityBackLink("search", searchParams)).toEqual({
      href: "/opportunities?q=%E5%AD%90%E3%81%A9%E3%82%82+%26+%E5%AD%A6%E7%BF%92%3F&category=%E5%AD%90%E3%81%A9%E3%82%82%E6%94%AF%E6%8F%B4&region=%E6%96%B0%E5%AE%BF%E5%8C%BA&participationMode=online&schedule=weekend&beginner=true",
      label: "案件検索結果に戻る",
    });
    expect(getOpportunityBackLink("search", {})).toEqual({
      href: "/opportunities",
      label: "案件検索結果に戻る",
    });
  });

  it("推薦流入と直接流入は従来の導線を維持する", () => {
    const expected = {
      href: "/recommendations",
      label: "おすすめ案件に戻る",
    };
    expect(getOpportunityBackLink("recommendation", searchParams)).toEqual(
      expected
    );
    expect(getOpportunityBackLink("direct", searchParams)).toEqual(expected);
  });
});


describe("公開詳細からのログイン復帰", () => {
  it("6検索条件と検索元を同じ詳細への復帰URLに保持する", () => {
    const params = {
      from: "search", q: "子ども & 学習?", category: "子ども支援",
      region: "新宿区", participationMode: "online", schedule: "weekend", beginner: "true",
    };
    const login = new URL(buildOpportunityLoginHref("opp-1", params), "https://volunty.jp");
    const next = new URL(login.searchParams.get("next")!, login.origin);
    expect(login.pathname).toBe("/login");
    expect(next.pathname).toBe("/opportunities/opp-1");
    expect(Object.fromEntries(next.searchParams)).toEqual(params);
  });

  it("推薦ログIDは先頭値を復帰先へ引き継ぐ", () => {
    const login = new URL(buildOpportunityLoginHref("opp-1", {
      from: ["rec", "search"], rlog: ["log-1", "log-2"],
    }), "https://volunty.jp");
    expect(login.searchParams.get("next")).toBe("/opportunities/opp-1?from=rec&rlog=log-1");
  });

  it("未ログインの直接流入は公開一覧へ戻る", () => {
    expect(getOpportunityBackLink("direct", undefined, true)).toEqual({
      href: "/opportunities", label: "募集一覧に戻る",
    });
    expect(getOpportunityBackLink("recommendation", undefined, true)).toEqual({
      href: "/recommendations", label: "おすすめ案件に戻る",
    });
  });
});
