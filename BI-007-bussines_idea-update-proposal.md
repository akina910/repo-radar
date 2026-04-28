# BI-007 `bussines_idea` 反映案（書き込み権限不足時の代替）

このファイルは、`/Users/kiyo/Documents/GitHub/bussines_idea` へ直接書き込めない環境向けの反映用メモ。

## 1) handoff 追記案

追記先:
- `handoff/BI-007-github-public-repo-radar-handoff.md` の末尾

追記内容:

```md
## 21. 追加改善（2026-04-28）

### 【自動化済み】大量 repo 向けの collector バッチ安定化
- `components/repo-radar.tsx`:
  - collector 向けの traffic/referrer バッチ取得を **40件チャンク** へ分割するロジックを追加。
  - URL 長超過や一括失敗の確率を下げ、repo 数が多いアカウントでも sparkline / referrer が欠けにくくなった。
- `app/api/traffic-batch/route.ts` / `app/api/referrers-batch/route.ts`:
  - `repos` クエリを正規化（trim / 重複除去 / 許可文字のみ / 上限 60件）。
  - 不正・過大入力で Worker へ不要な負荷がかからないようにした。
- `app/api/traffic/[repo]/route.ts`:
  - 返却 JSON を配列チェックしてから返すようにし、想定外 payload でも `[]` フォールバックに統一。
- `README.md`:
  - collector fetch をチャンク分割している旨を追記。

### 検証結果
- `npm run lint`: pass
- `npm run build`: pass

### Reviewer gate 実行結果（環境制約）
- Codex（本エージェント）: 差分レビュー実施、重大な回帰なし。
- Copilot: `gh copilot` は利用可能だが、`gh auth status` が token invalid（`The token in default is invalid.`）で実行不可。
- Claude: CLI 未導入（`claude: command not found`）で実行不可。
- 3系統フル実行は未達。認証/CLI 復旧後に再実行が必要。

### Cloudflare MCP 実リソース確認
- `mcp__cloudflare_api__.execute` で workers/D1/KV/R2 一覧取得を2回実行したが、いずれも `user cancelled MCP tool call` で取得不可。
- handoff §9 の既存リソース情報（Worker/D1/KV 作成済み）は維持。
```

## 2) `project-index.md` の BI-007「次アクション」差し替え案

置換先:
- `status/project-index.md` の BI-007 行 `次アクション`

置換文:

```md
【手動・残り1ステップ】`cd repo-radar && npm run collector:bootstrap -- --yes` を実行し、対話で `GITHUB_TOKEN`（classic PAT）と `API_SECRET` を入力して完了させる（内部で Worker secrets投入 → Vercel env反映/検証 → 任意redeploy → trigger check まで実行）。`gh auth` と `vercel login` が未完了なら先に認証。Cloudflare Worker/D1/KV/スキーマ/Next.js統合は完了済み、2026-04-28 に collector バッチ取得の安定化（チャンク分割＋入力正規化）まで反映済み。
```

## 3) 注意

- この反映案は、`bussines_idea` 側が書き込み不可だったため生成。
- 実装コードの変更は `repo-radar` 側に反映済み。
