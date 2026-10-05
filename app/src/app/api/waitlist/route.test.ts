// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock("@/lib/waitlist/register", () => ({ registerWaitlist: mocks.register }));
import { POST } from "@/app/api/waitlist/route";

function request(body: unknown = { email: " Person@EXAMPLE.COM ", website: "" }, headers: Record<string, string> = {}) {
  return new Request("https://volunty.example/api/waitlist", {
    method: "POST", headers: { origin: "https://volunty.example", "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("WAITLIST_RATE_LIMIT_SECRET", "");
  mocks.register.mockResolvedValue("accepted");
});
afterEach(() => vi.unstubAllEnvs());
describe("待機リストAPI", () => {
  it("正規化して保存し同じ成功応答を返す", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.register).toHaveBeenCalledWith("person@example.com", expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([null, [], {}, { email: "bad" }, { email: "a@example.com", website: 123 }, "{"])("不正入力を保存しない", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("別OriginやOriginなしを拒否する", async () => {
    expect((await POST(request({}, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request({}, { origin: "" }))).status).toBe(403);
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("内部URLがlocalhostでも受信HostとOriginが一致すれば受け付ける", async () => {
    const response = await POST(new Request("http://localhost:3000/api/waitlist", {
      method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.com" }),
    }));
    expect(response.status).toBe(200);
  });
  it("JSON以外と長いリクエストを拒否する", async () => {
    expect((await POST(request({}, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(request({}, { "content-length": "2049" }))).status).toBe(413);
    expect((await POST(request({ email: "a".repeat(2050) }))).status).toBe(413);
  });
  it("honeypot入力は成功に見せて保存しない", async () => {
    expect(await (await POST(request({ email: "a@example.com", website: "bot" }))).json()).toEqual({ ok: true });
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("制限超過に再試行時刻を返す", async () => {
    mocks.register.mockResolvedValue("limited");
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
  });
  it("DB障害の情報を漏らさない", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.register.mockRejectedValue(new Error("secret@example.com"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret@example.com");
    expect(log).toHaveBeenCalledWith("[waitlist] 登録処理に失敗しました");
    log.mockRestore();
  });
  it("本番では秘密値と信頼できる送信元が必須", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(request())).status).toBe(503);
    vi.stubEnv("WAITLIST_RATE_LIMIT_SECRET", "test-secret");
    expect((await POST(request(undefined, { "x-forwarded-for": "192.0.2.1" }))).status).toBe(503);
    vi.stubEnv("VERCEL", "1");
    expect((await POST(request(undefined, { "x-vercel-forwarded-for": "invalid" }))).status).toBe(503);
    expect((await POST(request(undefined, { "x-vercel-forwarded-for": "192.0.2.1" }))).status).toBe(200);
  });
  it("任意の転送ヘッダーで制限キーが変わらない", async () => {
    await POST(request(undefined, { "x-forwarded-for": "192.0.2.1" }));
    await POST(request());
    // 不正メールは保存されないため、有効入力で比較する。
    await POST(request({ email: "a@example.com" }, { "x-forwarded-for": "192.0.2.1" }));
    expect(mocks.register.mock.calls[0][1]).toBe(mocks.register.mock.calls[1][1]);
  });
});
