# BI-007 `bussines_idea` 反映案（書き込み権限不足時の代替）

このファイルは、`/Users/kiyo/Documents/GitHub/bussines_idea` へ直接書き込めない環境向けの反映用メモ。

## 1) handoff 追記案

追記先:
- `handoff/BI-007-github-public-repo-radar-handoff.md` の末尾

追記内容:

```md
## 21. 実装更新（2026-04-28）

### 21-1. 今回の判断
- 現状は「機能不足」ではなく「運用時の失敗耐性」がボトルネックと判断。
- 手動 secret 設定待ちでも実装価値を出すため、Collector バッチ API の安定化を優先。

### 21-2. 実施内容（実装repo: `repo-radar`）
- 新規: `lib/collector-batch.ts`
  - `repos` クエリの共通バリデーション
  - Collector 呼び出しの同時実行数制限（8）
  - 外部 fetch タイムアウト（8秒）
  - `TrafficDay` / `ReferrerSummary` の型ガード
- 更新: `app/api/traffic-batch/route.ts`
  - ルート内重複ロジックを共通化
  - 型検証済みデータのみ返却
- 更新: `app/api/referrers-batch/route.ts`
  - 同上（共通化 + 同時実行制限 + タイムアウト + 型検証）

### 21-3. 検証結果
- `npm run lint` ✅
- `npm run build` ✅

### 21-4. Cloudflare 実リソース確認について
- `Cloudflare MCP (mcp__cloudflare_api__.execute)` は 2026-04-28 JST 実行時に毎回 `user cancelled MCP tool call` となり確認不能。
- 代替で `wrangler whoami` も試行したが、ネットワーク/DNS解決不可で Cloudflare API 到達不可（`Unable to resolve Cloudflare's API hostname`）。
- よって、リソースの「実在再確認」は今回は未完了。既存 handoff §9 の値を暫定正本として維持。

### 21-5. レビューゲート状況（Codex / Copilot / Claude）
- Codex: 実施（差分セルフレビュー + lint/buildで整合確認）。
- Copilot: **未実施（失敗）**。`gh copilot` 実行時 `SecItemCopyMatching failed -50`、`gh auth status` で token invalid を確認。
- Claude: **未実施（未導入）**。`claude` コマンドが存在しないことを確認。

### 21-6. 次の人間作業（最短）
- `repo-radar` で `npm run collector:bootstrap -- --yes` を実行（途中でPAT入力が必要）。
- 失敗時は `npm run collector:check` で不足（Worker secret / Vercel env）を特定し、表示コマンドどおり補完。
```

## 2) `project-index.md` の BI-007「次アクション」差し替え案

置換先:
- `status/project-index.md` の BI-007 行 `次アクション`

置換文:

```md
【手動・残り1ステップ】`cd repo-radar && npm run collector:bootstrap -- --yes` を実行し、対話で `GITHUB_TOKEN`（classic PAT）を入力して完了させる（内部で Worker secrets投入 → Vercel env反映/検証 → deploy → trigger check まで一括）。失敗時は `npm run collector:check` で不足箇所を確認。2026-04-28 に collector バッチ API（traffic/referrers）の同時実行制限・タイムアウト・型検証を実装済み。
```

## 3) 注意

- この反映案は、`bussines_idea` 側が書き込み不可だったため生成。
- 実装コードの変更は `repo-radar` 側に反映済み。
