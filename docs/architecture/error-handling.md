# エラーハンドリング方針

Volunty の画面エラーは、ユーザーが復旧できる導線を必ず持つことを基本方針とする。

## route-level error.tsx

- 予期しない描画エラー、データ取得中の例外、未捕捉の例外は、各主要 route segment の `error.tsx` で受ける。
- `error.tsx` は Next.js の要件に合わせて Client Component とし、`reset()` を「もう一度試す」導線へ接続する。
- ユーザーには安全な共通文言を表示し、技術的な詳細は `console.error` に記録する。`digest` がある場合のみエラーIDとして表示する。

## Server Action の戻り値

- 入力不備、権限不足、対象データなしなど、ユーザー操作で想定できる失敗は例外として投げず、既存パターンどおり `error: string` を含む戻り値で返す。
- 更新系 Action は `{ success: false, error: string }`、取得系 Action は `{ data: null, error: string | null }` や `{ items: [], error: string }` のように、呼び出し元が分岐できる形を維持する。
- `error` の文字列は UI に出せる日本語メッセージに限定する。DB エラーや SDK エラーの詳細は Server Action 側でログに残し、戻り値には含めない。

## UI 表示

- Server Action の `error` は、フォーム直下のインライン表示、既存 Toast、またはページ内の空状態として表示する。
- `error.tsx` は Server Action が返した想定内エラーの表示には使わない。未捕捉例外で画面全体の描画を継続できない場合の最終 fallback とする。
