import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), removeExpired: vi.fn(), counter: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
import { registerWaitlist } from "@/lib/waitlist/register";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.counter.mockResolvedValue([{ count: 1 }]);
  mocks.insert.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (callback) => callback({
    waitlistRateLimit: { deleteMany: mocks.removeExpired },
    $queryRaw: mocks.counter,
    waitlistEntry: { createMany: mocks.insert },
  }));
});
describe("待機リストの永続化", () => {
  it("同じトランザクションで期限切れ制限を削除し重複スキップで保存する", async () => {
    expect(await registerWaitlist("a@example.com", "hashed-ip")).toBe("accepted");
    expect(mocks.removeExpired).toHaveBeenCalledWith({ where: { expiresAt: { lte: expect.any(Date) } } });
    expect(mocks.insert).toHaveBeenCalledWith({ data: [{ email: "a@example.com" }], skipDuplicates: true });
    expect(mocks.counter.mock.calls[0].slice(1)).toEqual(["hashed-ip", expect.any(Date), expect.any(Date), 10]);
  });
  it("既登録でも同じ結果で登録日時を更新しない", async () => {
    mocks.insert.mockResolvedValue({ count: 0 });
    expect(await registerWaitlist("a@example.com", "hashed-ip")).toBe("accepted");
  });
  it("上限超過時は保存しない", async () => {
    mocks.counter.mockResolvedValue([]);
    expect(await registerWaitlist("a@example.com", "hashed-ip")).toBe("limited");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("DBエラーは呼び出し元へ返し成功扱いしない", async () => {
    mocks.insert.mockRejectedValue(new Error("db unavailable"));
    await expect(registerWaitlist("a@example.com", "hashed-ip")).rejects.toThrow("db unavailable");
  });
});
