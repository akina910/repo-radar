# BI-007 `bussines_idea` 反映案（sandbox 書き込み不可のため）

このファイルは、`/Users/kiyo/Documents/GitHub/bussines_idea` へ直接書き込めない環境向けの反映用メモ。

## 1) handoff 追記案

追記先:
- `handoff/BI-007-github-public-repo-radar-handoff.md` の末尾

追記内容:

```md
## 21. Collector bootstrap 手順の不整合修正（2026-04-29）

### 判断
プロジェクトは Worker / D1 / KV / Next.js 統合まで完了しており、残りは GitHub PAT / API secret / Vercel env / redeploy の接続作業。ビジネス的には、初回同期までの人間操作を減らして「公開後に毎日見る状態」へ早く到達させることが最優先。

Cloudflare MCP はこの実行環境では tool call が cancelled 扱いになったため、代替としてローカル `worker/wrangler.toml` と `wrangler` を確認した。`wrangler whoami` は sandbox 外の `~/Library/Preferences/.wrangler/logs` 書き込み権限と DNS 解決制限で失敗。ローカル preflight では Worker 名 / D1 ID / KV ID / cron は設定済み、`.env.local` と secrets は未設定。

### 【自動化済み】今回の実装
- `scripts/setup-collector-secrets.sh` に `--env-file <path>` を追加。
  - 既定は従来通り `.env.local`。
  - 不明オプション / 引数不足は即時エラー。
  - env ファイルの親ディレクトリがない場合は作成。
- `scripts/bootstrap-collector.sh --env-file <path>` が Step 1 の `setup-collector-secrets.sh` にも同じ env file を渡すよう修正。
  - 以前は bootstrap に `--env-file` を渡しても Step 1 は常に `.env.local` を更新していた。
- `README.md` に custom env file の bootstrap / Vercel env push 手順を追記。

### 検証
- `bash -n scripts/setup-collector-secrets.sh scripts/bootstrap-collector.sh scripts/push-vercel-collector-env.sh scripts/check-vercel-collector-env.sh` 通過。
- `bash scripts/setup-collector-secrets.sh --help` 通過。
- `bash scripts/bootstrap-collector.sh --help` 通過。
- `bash scripts/setup-collector-secrets.sh --unknown; test $? -eq 1` 通過。
- `bash scripts/setup-collector-secrets.sh --env-file; test $? -eq 1` 通過。
- `npm run typecheck` 通過。
- `npm run lint` 通過。
- `npm run build` 通過。
- `git diff --check` 通過。
- `npm run collector:check:offline` は expected failure。理由: `.env.local` / secrets がまだ未設定。Worker 名 / D1 / KV / cron は ok。

### レビュー
- Codex subagent review: clean verdict。
- Copilot review: `copilot` / `gh copilot` ともに `ERROR: SecItemCopyMatching failed -50` で起動不可。狭い diff review prompt でも同じ失敗。
- Claude review: `claude` CLI が PATH に存在せず未実行。

### 【手動】次にやること
最短は以下をローカルで実行し、対話プロンプトで GitHub classic PAT と必要に応じて secret を入力する。

```bash
cd /Users/kiyo/Documents/GitHub/repo-radar
npm run collector:bootstrap -- --yes
```

ネットワーク / Cloudflare / Vercel 認証がローカルで有効なら、このコマンドで Worker secrets 設定、Vercel env 反映、production redeploy、collector trigger check まで進む。分けて実行する場合は `README.md` の Collector Setup を参照。
```

## 2) `project-index.md` の BI-007「次アクション」差し替え案

置換先:
- `status/project-index.md` の BI-007 行 `次アクション`

置換文:

```md
【手動・残り1ステップ】`cd /Users/kiyo/Documents/GitHub/repo-radar && npm run collector:bootstrap -- --yes` を実行し、対話で `GITHUB_TOKEN`（classic PAT）を入力して完了させる。成功すれば Worker secrets 投入、Vercel env 反映/検証、production deploy、collector trigger check まで一括で進む。失敗時は `npm run collector:check` で不足箇所を確認。2026-04-29 JST に bootstrap の `--env-file` 伝播不整合を修正済み。
```

## 3) 注意

- `bussines_idea` への直接追記は sandbox の writable root 外で拒否された。
- 実装コードの変更は `repo-radar` 側に反映済み。
