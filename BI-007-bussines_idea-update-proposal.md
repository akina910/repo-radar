# BI-007 `bussines_idea` 反映案（sandbox 書き込み不可のため）

このファイルは、`/Users/kiyo/Documents/GitHub/bussines_idea` が現在の writable root 外で直接編集できないための反映用メモ。

## 0) 最新反映案（2026-05-23）

### handoff 追記案

追記先:
- `handoff/BI-007-github-public-repo-radar-handoff.md` の末尾

追記内容:

~~~md
## 21. 実装済み改善（2026-05-23）

Cloudflare / Worker / D1 / KV の実リソース確認を試みたが、このセッションでは Cloudflare MCP tool が露出しておらず、`wrangler` 経由の確認も DNS 制限で Cloudflare API に到達できなかった。その結果、リソース未作成とネットワーク未到達を混同しないことが初回公開前の重要な改善点だと判断した。

### 変更内容
- `scripts/check-cloudflare-resources.mjs`: `wrangler` の失敗が Cloudflare API 未到達（DNS / network）か、認証・権限・リソース不足かを分類するよう改善。
- Cloudflare API 未到達時は `npm run collector:bootstrap` を誤って案内せず、「network/DNS access のある環境または Cloudflare MCP で確認 → 再実行」と出すよう変更。
- `scripts/check-cloudflare-resources.test.mjs`: DNS / ENOTFOUND / 403 / 認証エラーの分類テストを追加。

### 検証
- `npm test`: pass（16 tests）
- `npm run lint`: pass
- `npm run build`: pass
- `npm run typecheck`: pass（`build` と並列実行した一回目だけ `.next/types` 生成競合で失敗、単独再実行で pass）
- `git diff --check`: pass
- `npm run collector:check:offline`: expected fail（ローカル `.env.local` 未設定。`worker/wrangler.toml` の Worker名 / GITHUB_USERNAME / D1 / KV / cron は ok）
- `npm run collector:check:cloudflare`: expected fail（Cloudflare API DNS 解決不可）。改善後は bootstrap ではなく network/DNS/MCP 確認を案内。

### Reviewer gate
- Codex: この実行主体で差分自己レビュー済み。`api.cloudflare.com` 文字列だけでネットワーク障害扱いする誤分類リスクを見つけ、判定をネットワーク語に限定して修正済み。
- Copilot: CLI は存在するが認証情報なしで実行不可。`gh auth status` も既存 token invalid。ユーザー再認証が必要。
- Claude: `claude` CLI が存在せず実行不可。

### 次アクション
【手動・残り】`gh auth login` または `COPILOT_GITHUB_TOKEN` / `GH_TOKEN` 設定で Copilot review gate を復旧し、`copilot -p` の read-only review を実行。その後、Cloudflare API に到達できる環境で `npm run collector:check:cloudflare` を再実行し、Worker secrets と Vercel env を `npm run collector:bootstrap` で完了する。
~~~

### `project-index.md` の BI-007「次アクション」差し替え案

```md
【手動・残り】①Copilot gate 復旧: `gh auth login` または `COPILOT_GITHUB_TOKEN` / `GH_TOKEN` を設定して read-only review を再実行（現状は認証なしで不可） ②Cloudflare API に到達できる環境または Cloudflare MCP で `npm run collector:check:cloudflare` を再実行 ③問題なければ `npm run collector:bootstrap` で Worker secrets (`GITHUB_TOKEN` / `API_SECRET`) と Vercel env (`NEXT_PUBLIC_COLLECTOR_URL=https://repo-radar-collector.kiyo-nomura.workers.dev` / `COLLECTOR_API_SECRET=<同じ値>`) を設定し redeploy。2026-05-23 に Cloudflare検査の network/DNS 失敗誤誘導を修正済み。
```

## 1) handoff 追記案

追記先:
- `handoff/BI-007-github-public-repo-radar-handoff.md` の末尾

追記内容:

~~~md
## 21. 実装済み改善（2026-05-01）

手動 secret / env 待ちの間に残っていた rename 耐性の穴を塞いだ。`lib/github.ts` は collector aggregate を `github_repo_id` で拾えるようになっていたが、sparkline / referrer の batch proxy は repo 名で Worker を参照していたため、GitHub 側で repo rename 直後かつ collector がまだ新名を収集していない間は、カード本体は 90日累計を表示できても sparkline / referrer が空になる可能性があった。

### 変更内容
- `worker/src/index.ts`: `GET /api/repos/id/:githubRepoId/traffic` と `GET /api/repos/id/:githubRepoId/referrers` を追加。D1 の immutable `github_repo_id` で直接 traffic/referrer を読む。
- `lib/collector-batch.ts`: batch proxy 用に `repoIds` パラメータの検証・重複排除を追加。
- `app/api/traffic-batch/route.ts` / `app/api/referrers-batch/route.ts`: `repoIds` 優先で Worker を参照。旧 Worker へ先に Next.js が出ても壊れないよう、id 結果が全空かつ `repos` が揃っている場合は legacy repo-name endpoint にフォールバック。
- `components/repo-radar.tsx`: collector-backed repo の sparkline/referrer batch を repo 名ではなく `repo.id` キーで扱うよう変更。

### 検証
- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run build`: pass
- `git diff --check`: pass
- `WRANGLER_LOG_PATH=/Users/kiyo/Documents/GitHub/repo-radar/.wrangler/logs wrangler deploy --dry-run --outdir /private/tmp/repo-radar-worker-dry-run`: pass（KV/D1/GITHUB_USERNAME binding を確認）
- `npm run collector:check:offline`: expected fail（ローカル `.env.local` 未設定のため。`worker/wrangler.toml` の Worker名 / GITHUB_USERNAME / D1 / KV / cron は ok）
- Cloudflare MCP: このセッションでは callable tool が露出しておらず利用不可。代替で `wrangler` を使用したが、Cloudflare API への list / whoami は DNS 制限で失敗。dry-run は成功。
- Reviewer chain: Codex CLI / Claude CLI は未インストール。Copilot CLI は `ERROR: SecItemCopyMatching failed -50` で help も起動できず利用不可。差分は手元で Codex self-review 済み。

### 次アクション
【手動】今回の Worker 変更を本番へ反映してから、collector bootstrap を完了する。

```bash
cd /Users/kiyo/Documents/GitHub/repo-radar/worker
WRANGLER_LOG_PATH=/Users/kiyo/Documents/GitHub/repo-radar/.wrangler/logs wrangler deploy

cd /Users/kiyo/Documents/GitHub/repo-radar
npm run collector:bootstrap
npm run collector:check:trigger
```

`collector:bootstrap` は Worker secrets (`GITHUB_TOKEN` / `API_SECRET`) と Vercel env (`NEXT_PUBLIC_COLLECTOR_URL` / `COLLECTOR_API_SECRET` / optional `COLLECTOR_TRIGGER_TOKEN`) をまとめて処理できる。Cloudflare / Vercel の認証や PAT 入力は人間が行う。
~~~

## 2) `project-index.md` の BI-007「次アクション」差し替え案

置換先:
- `status/project-index.md` の BI-007 行 `次アクション`

置換文:

```md
【手動・デプロイ/secret残】今回の id-based collector endpoint 変更を反映するため、①`cd /Users/kiyo/Documents/GitHub/repo-radar/worker && WRANGLER_LOG_PATH=/Users/kiyo/Documents/GitHub/repo-radar/.wrangler/logs wrangler deploy` ②`cd /Users/kiyo/Documents/GitHub/repo-radar && npm run collector:bootstrap` で Worker secrets (`GITHUB_TOKEN` / `API_SECRET`) と Vercel env (`NEXT_PUBLIC_COLLECTOR_URL=https://repo-radar-collector.kiyo-nomura.workers.dev` / `COLLECTOR_API_SECRET=<同じ値>`) を設定 ③`npm run collector:check:trigger` または画面の `Sync collector` で初回collection確認。2026-05-01に sparkline/referrer の repo rename 耐性を実装済み。
```

## 3) 注意

- `bussines_idea` への直接追記は sandbox の writable root 外で拒否された。
- 実装コードの変更は `repo-radar` 側に反映済み。
