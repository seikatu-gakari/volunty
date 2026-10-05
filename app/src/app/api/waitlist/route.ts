import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { registerWaitlist } from "@/lib/waitlist/register";
import { normalizeWaitlistEmail, WAITLIST_MAX_BODY_BYTES } from "@/lib/waitlist/validation";

export const runtime = "nodejs";

function reply(status: number, error?: string) {
  return Response.json(error ? { error } : { ok: true }, {
    status,
    headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "900" } : {}) },
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  // Next.js内部のrequest.urlは開発時にlocalhostへ正規化されるためHostで照合する。
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get("host") ?? requestUrl.host}`;
  if (origin !== expectedOrigin) return reply(403, "このページからもう一度お試しください。");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply(415, "送信形式を確認してください。");
  if (Number(request.headers.get("content-length")) > WAITLIST_MAX_BODY_BYTES) return reply(413, "入力内容が長すぎます。");

  let input: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400, "メールアドレスを確認してください。");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > WAITLIST_MAX_BODY_BYTES) {
        await reader.cancel();
        return reply(413, "入力内容が長すぎます。");
      }
      chunks.push(value);
    }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply(400, "入力内容を確認してください。");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return reply(400, "入力内容を確認してください。");
  const fields = input as Record<string, unknown>;
  if (fields.website !== undefined && typeof fields.website !== "string") return reply(400, "入力内容を確認してください。");
  // 人には非表示の項目を埋める自動送信には、DBへ保存せず同じ成功応答を返す。
  if (fields.website) return reply(200);
  const email = normalizeWaitlistEmail(fields.email);
  if (!email) return reply(400, "有効なメールアドレスを入力してください。");

  const production = process.env.NODE_ENV === "production";
  const secret = process.env.WAITLIST_RATE_LIMIT_SECRET || (!production ? "local-waitlist-only" : "");
  // Vercelが上書きする専用ヘッダーだけを信頼し、任意のX-Forwarded-Forは使わない。
  const ip = process.env.VERCEL === "1"
    ? request.headers.get("x-vercel-forwarded-for")?.trim()
    : !production ? "127.0.0.1" : null;
  if (!secret || !ip || !isIP(ip)) return reply(503, "現在登録を受け付けられません。時間をおいてお試しください。");
  const clientHash = createHmac("sha256", secret).update(ip).digest("hex");
  try {
    const result = await registerWaitlist(email, clientHash);
    return result === "limited" ? reply(429, "送信が続いています。15分ほど待ってからお試しください。") : reply(200);
  } catch {
    // メール・IP・DBエラー詳細をログや応答へ出さない。
    console.error("[waitlist] 登録処理に失敗しました");
    return reply(503, "登録できませんでした。時間をおいてもう一度お試しください。");
  }
}
