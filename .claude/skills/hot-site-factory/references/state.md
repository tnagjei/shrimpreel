# 建站状态账本

状态账本用于跨会话恢复，不替代 Git、部署平台或支付平台的真实状态。默认目录：

```text
~/.codex/site-builds/<domain>.json
~/.codex/site-builds/active.json
```

可以用 `SITE_BUILD_HOME` 临时指向隔离目录做测试或恢复，不要把真实状态提交到站点仓库。

## 字段

```json
{
  "version": 1,
  "project": "example.com",
  "keyword": "Example AI",
  "brand": "Example AI",
  "slug": "example",
  "target": "/Users/.../example",
  "repo": "owner/example",
  "templateSha": "…",
  "stage": "P1",
  "status": "in_progress",
  "completed": ["template_synced", "repo_created"],
  "waiting": [],
  "next": "run new-site scaffold",
  "createdAt": "…",
  "updatedAt": "…",
  "lastVerifiedAt": "…",
  "history": [
    { "at": "…", "event": "checkpoint", "message": "repo read back" }
  ]
}
```

允许的阶段：`P0`–`P8`。允许的状态：`in_progress`、`waiting_for_human`、`blocked`、`paused`、`done`。

## 命令

初始化（不会覆盖已有状态）：

```bash
node scripts/site-state.mjs init \
  --project example.com \
  --keyword "Example AI" \
  --brand "Example AI" \
  --slug example \
  --target /absolute/path/example \
  --repo owner/example
```

更新阶段并保存下一步：

```bash
node scripts/site-state.mjs update \
  --project example.com \
  --stage P2 \
  --status in_progress \
  --completed "repo_created,scaffold_written" \
  --waiting "sample_quality_review" \
  --next "write bilingual content"
```

人工门：使用 `--status waiting_for_human`，把等待原因写进 `--waiting`；不要把整个项目设成 blocked，除非确实没有可推进的下一项。

收尾：

```bash
node scripts/site-state.mjs checkpoint \
  --project example.com \
  --message "P2 local checks passed; sample review pending"
```

切换项目：

```bash
node scripts/site-state.mjs activate --project example.com
```

## 恢复顺序

1. 读 active project 和状态摘要。
2. 核对目标目录是否存在、Git 工作区、remote、HEAD 和远端 `main`。
3. 核对状态中的 `repo`、`target`、`templateSha` 是否仍然匹配。
4. 对照当前阶段的完成条件，选择第一个未满足且前置条件满足的动作。
5. 如果状态与实际不一致，以实际证据为准，写 checkpoint 说明差异，再决定继续或修复。
6. 无法核对的平台状态标成“未核验”，不能猜测为完成。

## 禁止写入

- API Key、密码、Bearer Token、私钥、Webhook Secret、银行卡、身份证明和历史聊天原文。
- 用户照片、视频或反馈内容本身。
- 未经确认的正式价格、真实付款结果或审核结果。
