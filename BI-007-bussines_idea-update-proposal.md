# BI-007 `bussines_idea` 反映案（sandbox 書き込み不可のため）

このファイルは、`/Users/kiyo/Documents/GitHub/bussines_idea` へ直接書き込めない環境向けの反映用メモ。

## 1) handoff 追記案

追記先:
- `handoff/BI-007-github-public-repo-radar-handoff.md` の末尾

追記内容:

```md
## 22. 実装更新（2026-04-29 JST）

### 22-1. 今回の判断
- 現在地は「Worker/D1/KV/Next.js 統合は概ね完了、残りは secret/env の投入」。
- ただし `.env.example` をそのままコピーした場合、プレースホルダー値を設定済みと誤認して Collector / GitHub API へ不要なリクエストを投げる余地があったため、公開前の失敗耐性を上げることを優先した。

### 22-2. 実施内容（実装repo: `repo-radar`）
- 新規: `lib/env.ts`
  - `hasConfiguredEnvValue` / `readConfiguredEnvValue` を追加し、`your-*` / `your-collector-worker` 系プレースホルダーを未設定扱いに統一。
- 更新: `lib/github.ts`
  - `GITHUB_TOKEN=your-github-token` を Authorization ヘッダーに載せないよう修正。
  - `NEXT_PUBLIC_COLLECTOR_URL` / `COLLECTOR_API_SECRET` / `COLLECTOR_TRIGGER_TOKEN` の判定を共通 helper に集約。
  - GitHub username は `your-github-username` だけをプレースホルダー扱いし、実在し得る `your-*` ユーザー名を誤ブロックしないよう分離。
- 更新: `app/api/traffic-batch/route.ts` / `app/api/referrers-batch/route.ts` / `app/api/traffic/[repo]/route.ts`
  - Collector URL がプレースホルダーの場合は未設定扱いで空レスポンスにする。
  - 旧 traffic route も `isTrafficDay` で型検証済みデータだけ返すよう修正。
- 更新: `app/api/collector/trigger/*`
  - trigger token / API secret のプレースホルダーを認証値として受け付けないよう修正。
- 更新: `package.json`
  - `npm run typecheck` を追加。
- 更新: `.env.example`
  - プレースホルダーは置換まで未設定扱いになる旨を明記。

### 22-3. 検証結果
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npm run collector:check:offline` は `.env.local` 未設定を正しく検出して exit 1（期待どおり）。表示された next_actions は `bash scripts/setup-collector-secrets.sh` / `GITHUB_USERNAME="akina910"` の `.env.local` 追記 / Vercel env sync/check。

### 22-4. Cloudflare 実リソース確認
- Cloudflare MCP (`mcp__cloudflare_api__.search` / `execute`) は `user cancelled MCP tool call` で失敗し、MCP からの実リソース再確認は未完了。
- 代替で `npx wrangler whoami` を実行したが、sandbox 外ログ書き込みの `EPERM` と Cloudflare API hostname 解決不可で失敗。
- 既存 handoff §9 の D1/KV/Worker 値は今回は変更せず暫定正本として維持。

### 22-5. レビューゲート状況（Codex / Copilot / Claude）
- Codex: 実施。差分セルフレビューで `GITHUB_TOKEN=your-github-token` 誤送信リスクを追加修正済み。
- Copilot: **未完了（利用不可）**。`gh copilot -p ...` は `ERROR: SecItemCopyMatching failed -50`、`gh auth status` は default token invalid。
- Claude: **未完了（未導入）**。`claude` コマンドが存在しない。

### 22-6. 次の人間作業（最短）
- 【手動】`cd /Users/kiyo/Documents/GitHub/repo-radar && npm run collector:bootstrap -- --yes`
  - 途中で GitHub classic PAT を入力する。
  - 成功すれば Worker secrets 投入、Vercel env 反映/検証、production deploy、collector trigger check まで一括で進む。
- 失敗時は `npm run collector:check` を実行し、表示された不足項目だけ補完する。
```

## 2) `project-index.md` の BI-007「次アクション」差し替え案

置換先:
- `status/project-index.md` の BI-007 行 `次アクション`

置換文:

```md
【手動・残り1ステップ】`cd /Users/kiyo/Documents/GitHub/repo-radar && npm run collector:bootstrap -- --yes` を実行し、対話で `GITHUB_TOKEN`（classic PAT）を入力して完了させる（内部で Worker secrets 投入 → Vercel env 反映/検証 → production deploy → collector trigger check まで一括）。失敗時は `npm run collector:check` で不足箇所を確認。2026-04-29 JST に env placeholder 誤認防止（Collector/GitHub token/trigger token）と `npm run typecheck` を実装済み。
```

## 3) 注意

- `bussines_idea` への直接追記は sandbox 制約で拒否された。
- 実装コードの変更は `repo-radar` 側に反映済み。
