# BI-007 `bussines_idea` 反映案（sandbox 書き込み不可のため）

このファイルは、`/Users/kiyo/Documents/GitHub/bussines_idea` へ直接書き込めない環境向けの反映用メモ。

## 1) handoff 追記案

追記先:
- `handoff/BI-007-github-public-repo-radar-handoff.md` の末尾

追記内容:

~~~md
## 21. GitHub traffic fallback の同時実行制限（2026-04-30）

### 判断
プロジェクトは Worker / D1 / KV / Next.js 統合まで完了しており、現在の主な未完了点は Worker secrets、Vercel env、初回同期。手動 secret 作業の前でも価値を出せる点として、collector が未設定または未同期の間に GitHub traffic API フォールバックが全 public repo 分を無制限並列で叩くリスクを優先して潰した。

Cloudflare MCP はこのセッションでは callable tool として見つからなかったため未実行。代替で `wrangler` による Cloudflare API 確認を試したが、sandbox の DNS 制限で `api.cloudflare.com` / `dash.cloudflare.com` を解決できず失敗。ローカル `worker/wrangler.toml` と `npm run collector:check:offline` では Worker 名、D1 ID、KV ID、cron は設定済みであることを確認した。

### 【自動化済み】今回の実装
- `lib/github.ts` に `mapWithConcurrency` を追加。
- `getRadarRepos()` の GitHub traffic fallback を repo 単位で最大 8 並列に制限。
- collector owner 判定で `process.env.GITHUB_USERNAME` を `readGithubUsername()` に通し、空白や placeholder を除外するよう調整。

### 検証
- `npm run typecheck` 通過。
- `npm run lint` 通過。
- `npm run build` 通過。
- `git diff --check` 通過。
- `npm run collector:check:offline` は expected failure。理由: `.env.local` / secrets 未設定。Worker 名 / D1 / KV / cron は ok。
- Cloudflare live resource check は `wrangler` の DNS 解決失敗により未完了。

### レビュー
- Codex CLI: PATH に存在せず未実行。
- Copilot review: `copilot` / `gh copilot` ともに `ERROR: SecItemCopyMatching failed -50` で起動不可。狭い diff review prompt でも同じ失敗。
- Claude CLI: PATH に存在せず未実行。

### 【手動】次にやること
最短は以下をローカルで実行し、対話で GitHub classic PAT を入力する。

```bash
cd /Users/kiyo/Documents/GitHub/repo-radar
npm run collector:bootstrap -- --yes
```

成功すれば Worker secrets 設定、Vercel env 反映/検証、production deploy、collector trigger check まで進む。失敗時は `npm run collector:check` で不足箇所を確認する。
~~~

## 2) `project-index.md` の BI-007「次アクション」差し替え案

置換先:
- `status/project-index.md` の BI-007 行 `次アクション`

置換文:

```md
【手動・残り1ステップ】`cd /Users/kiyo/Documents/GitHub/repo-radar && npm run collector:bootstrap -- --yes` を実行し、対話で GitHub classic PAT を入力する。成功すれば Worker secrets 設定、Vercel env 反映/検証、production deploy、collector trigger check まで進む。2026-04-30 に GitHub traffic fallback の同時実行制限を実装済み。
```

## 3) 注意

- `bussines_idea` への直接追記は sandbox の writable root 外で拒否された。
- 実装コードの変更は `repo-radar` 側に反映済み。
