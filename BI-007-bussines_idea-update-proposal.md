# BI-007 `bussines_idea` 反映案（sandbox 書き込み不可のため）

このファイルは、`/Users/kiyo/Documents/GitHub/bussines_idea` が現在の writable root 外で直接編集できないための反映用メモ。

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
