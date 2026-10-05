import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { waitlistEntry: { createMany: mocks.insert } } }));
import { registerWaitlist } from "@/lib/waitlist/register";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockResolvedValue({ count: 1 });
});
describe("待機リストの永続化", () => {
  it("メールだけを重複スキップで保存する", async () => {
    await expect(registerWaitlist("a@example.com")).resolves.toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith({ data: [{ email: "a@example.com" }], skipDuplicates: true });
  });
  it("既登録でも同じ結果で登録日時・案内日時を更新しない", async () => {
    mocks.insert.mockResolvedValue({ count: 0 });
    await expect(registerWaitlist("a@example.com")).resolves.toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith({ data: [{ email: "a@example.com" }], skipDuplicates: true });
  });
  it("DBエラーは呼び出し元へ返し成功扱いしない", async () => {
    mocks.insert.mockRejectedValue(new Error("db unavailable"));
    await expect(registerWaitlist("a@example.com")).rejects.toThrow("db unavailable");
  });
});
