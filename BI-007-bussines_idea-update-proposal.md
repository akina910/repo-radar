# BI-007 `bussines_idea` 反映案（sandbox 書き込み不可のため）

このファイルは、`/Users/kiyo/Documents/GitHub/bussines_idea` が現在の writable root 外で直接編集できないための反映用メモ。

## 1) handoff 追記案

追記先:
- `handoff/BI-007-github-public-repo-radar-handoff.md` の末尾

追記内容:

~~~md
## 21. Collector運用耐性の追加（2026-05-01 13:34 JST）

### 判断
現状は公開中で、Worker / D1 / KV / Next.js 統合は実装済み。残ブロッカーは Worker secrets と Vercel env の手動設定だが、初回設定時の入力ミスで collector が無効化されるリスクが残っていたため、手動作業を待たずに運用耐性を先に固めた。

### 実装したこと
- `lib/env.ts` に `readConfiguredUrlOrigin()` を追加し、`NEXT_PUBLIC_COLLECTOR_URL` を実行時にも `http/https` の origin へ正規化するようにした。
- `lib/github.ts`、`app/api/traffic-batch/route.ts`、`app/api/referrers-batch/route.ts`、`app/api/collector/trigger/route.ts` を上記 helper に寄せた。これで Vercel env に末尾 slash や path が混ざっても collector API 呼び出しが壊れにくい。
- `worker/src/index.ts` の `days` query を `parseDaysParam()` に変更し、最大 365 日へ上限を設定した。過大な `days` 指定で D1 集計が無制限に広がるのを防ぐ。

### Cloudflare確認
- Cloudflare MCP はこのセッションの `tool_search` では見つからず、MCP での実リソース一覧確認は未実行。
- 代替で `wrangler deploy --dry-run` を実行し、Worker バンドルと bindings は確認済み:
  - `env.repo_radar_kv`: `2fa43c6e27ef452aa6bd4548bd309109`
  - `env.repo_radar_db`: `repo-radar-db`
  - `env.GITHUB_USERNAME`: `akina910`
- `wrangler d1 list` / `wrangler kv namespace list` は sandbox の DNS 制限で Cloudflare API に到達できず失敗。ローカル cache 上の active account は `a0a17abc799ba2891c7beb5c2f6eba37`。

### 検証結果
- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run build`: pass
- `git diff --check`: pass
- `WRANGLER_LOG_PATH="$PWD/.wrangler/logs" npx wrangler deploy --dry-run`: pass
- `NEXT_PUBLIC_COLLECTOR_URL=https://repo-radar-collector.kiyo-nomura.workers.dev COLLECTOR_API_SECRET=dummy GITHUB_USERNAME=akina910 npm run collector:check:offline`: pass
- `.env.local` 未作成の通常 `npm run collector:check:offline` は expected fail。次アクションとして `scripts/setup-collector-secrets.sh` と Vercel env sync を提示する状態。

### レビューゲート
- Codex: 本セッションで差分を手動レビューし、上記検証まで通過。追加修正なし。
- Copilot: `copilot --help` と diff 入力の両方で `ERROR: SecItemCopyMatching failed -50`。さらに `gh auth status` は default account の token invalid を返したため、この環境では Copilot review gate 未完了。
- Claude: `claude` CLI が存在せず未実行。

### 次に人間がやること
1. 【手動・レビューゲート】`gh auth login -h github.com` で GitHub CLI を再認証し、Copilot CLI の Keychain エラーを解消して Copilot review を通す。
2. 【手動・デプロイ残】`cd /Users/kiyo/Documents/GitHub/repo-radar/worker && wrangler secret put GITHUB_TOKEN && wrangler secret put API_SECRET` を実行。
3. 【手動・Vercel】`NEXT_PUBLIC_COLLECTOR_URL=https://repo-radar-collector.kiyo-nomura.workers.dev` と `COLLECTOR_API_SECRET=<Worker API_SECRET と同じ値>` を Vercel に追加して redeploy。
4. 【手動・確認】`npm run collector:check:trigger` または画面の `Sync collector` で初回 collection を実行する。
~~~

## 2) `project-index.md` の BI-007「次アクション」差し替え案

置換先:
- `status/project-index.md` の BI-007 行 `次アクション`

置換文:

```md
【手動・最優先】①`gh auth login -h github.com` でGitHub CLIを再認証し、Copilot CLIの `SecItemCopyMatching failed -50` を解消してCopilot review gateを通す ②`cd /Users/kiyo/Documents/GitHub/repo-radar/worker && wrangler secret put GITHUB_TOKEN && wrangler secret put API_SECRET` ③Vercel envに `NEXT_PUBLIC_COLLECTOR_URL=https://repo-radar-collector.kiyo-nomura.workers.dev` + `COLLECTOR_API_SECRET=<同じ値>` を追加して redeploy ④`npm run collector:check:trigger` または画面の `Sync collector` で初回collection確認。2026-05-01にcollector URL origin正規化とWorker days上限(365日)を実装済み。
```

## 3) 注意

- `bussines_idea` への直接追記は sandbox の writable root 外で拒否された。
- 実装コードの変更は `repo-radar` 側に反映済み。
