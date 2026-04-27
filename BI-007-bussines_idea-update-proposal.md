# BI-007 `bussines_idea` 反映案（書き込み権限不足時の代替）

このファイルは、`/Users/kiyo/Documents/GitHub/bussines_idea` へ直接書き込めない環境向けの反映用メモ。

## 1) handoff 追記案

追記先:
- `handoff/BI-007-github-public-repo-radar-handoff.md` の末尾

追記内容:

```md
## 21. セキュリティ/運用ハードニング（2026-04-27）

実装repo（`repo-radar`）で以下を反映済み。

### 21-1. 手動同期セッションのトークン取り扱い強化
- 対象: `app/api/collector/trigger/session/route.ts`, `app/api/collector/trigger/route.ts`
- 変更:
  - cookie に平文トークンを保存せず、`sha256` ハッシュを保存
  - 比較は `timingSafeEqual` ベースに統一
  - `GET /api/collector/trigger/session` はハッシュ比較で `authenticated` を返す
  - `POST /api/collector/trigger` も cookie/hash または header を timing-safe に検証

### 21-2. Worker `/api/status` の情報露出制御
- 対象: `worker/src/index.ts`
- 変更:
  - `X-API-Secret` が一致した場合のみ `runtime_config` を返却
  - それ以外は `runtime_config: null`
  - 追加フィールド: `runtime_config_visible: boolean`

### 21-3. Next.js 側の status 取得をヘッダー対応
- 対象: `lib/github.ts`
- 変更:
  - `COLLECTOR_API_SECRET` が有効値の場合、`/api/status` 取得時に `X-API-Secret` を付与
  - 既存ダッシュボードの状態表示で詳細診断が引き続き利用可能

### 21-4. ローカル運用スクリプト/ドキュメント同期
- 対象: `scripts/check-collector.mjs`, `lib/collector-types.ts`, `README.md`
- 変更:
  - `collector:check` が `X-API-Secret` 付きで `/api/status` を確認
  - 型定義に `runtime_config_visible` を追加
  - README に status 詳細のヘッダー要件を追記

### 21-5. 検証結果
- `npm run lint`: pass
- `npm run build`: pass
- `npm run collector:check:offline`: expected fail（ローカル未設定を正しく検出）

### 21-6. Reviewer gate 実行結果（環境制約）
- Codex CLI: 未導入（`codex: command not found`）
- Claude CLI: 未導入（`claude: command not found`）
- Copilot CLI: インストール済みだが実行不可（`SecItemCopyMatching failed -50`）
- `gh auth status`: token invalid（`akina910`）
- 上記のためこのセッションでは reviewer chain を完走不可。次セッションで認証復旧後に再実行が必要。

### 21-7. Cloudflare MCP 確認
- 本セッションで Cloudflare MCP 呼び出しを再試行したが、`user cancelled MCP tool call` で一覧取得不可。
- 既存 handoff §9 のリソース情報は維持（Worker/D1/KV 作成済み前提）。
```

## 2) `project-index.md` の BI-007「次アクション」差し替え案

置換先:
- `status/project-index.md` の BI-007 行 `次アクション`

置換文:

```md
【手動・残り2ステップ】①`cd repo-radar/worker && wrangler secret put GITHUB_TOKEN`（classic PAT）→`wrangler secret put API_SECRET`（openssl rand -hex 32） ②Vercel env追加: `NEXT_PUBLIC_COLLECTOR_URL=https://repo-radar-collector.kiyo-nomura.workers.dev` + `COLLECTOR_API_SECRET=<同じ値>`（任意で`COLLECTOR_TRIGGER_TOKEN`も設定可）→ redeploy → `npm run collector:check:trigger` または UI の `Sync collector` で初回収集確認（2026-04-27時点でトークン比較のtiming-safe化、session cookieハッシュ化、`/api/status`の情報露出制御まで反映済み）
```

## 3) 注意

- この反映案は、`bussines_idea` 側が書き込み不可だったため生成。
- 実装コードの変更は `repo-radar` 側に反映済み。
