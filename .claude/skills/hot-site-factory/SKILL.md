---
name: hot-site-factory
description: 热词站建站总控。用户只需要说“新建站”“继续建站”“看进度”或“暂停建站”；本 Skill 读取本地状态账本，判断当前阶段，加载 create/repo、new-hot-site、统计、支付或上线检查等内部模块，并在人工门或权限边界停下。不要为单个步骤再增加用户入口。
---

# 热词站总控

这是一个建站流程的路由器和状态恢复入口，不是把全部实现塞进一个大脚本。用户不需要记子 Skill 名称。

## 用户只需要说

| 用户说 | 本 Skill 动作 |
| --- | --- |
| `新建站：关键词=…，域名=…` | 初始化状态，执行 P0，然后进入 P1 |
| `继续建站` | 读取当前项目状态，核对实际仓库，执行下一个可执行阶段 |
| `看进度` | 只读显示项目、阶段、完成项、等待项和下一步 |
| `暂停建站` | checkpoint 当前状态，停止写入 |
| `切到 example.com` | 切换 active project，不执行建站 |
| `做本地部分` | 只执行到 P2，不创建云资源或部署 |

只缺关键词或域名时，只问缺的那一项。品牌、slug、目录、仓库名和可见性可按默认值推导，先给一行业务预览，不要逐个追问。

## 启动与恢复

每次开始先读取项目 `AGENTS.md`、模板 `README*`、`scripts/site-state.mjs`、本 Skill 和目标阶段引用的文件。

```bash
node scripts/site-state.mjs status
```

如果用户明确指定了项目：

```bash
node scripts/site-state.mjs status --project <domain>
```

没有状态但有现成目标目录或仓库时，不要立刻重建。先用 Git、远端和目录核对推断当前阶段，再补建状态账本。状态账本不是事实来源；目录、提交、远端、部署和付费平台的实际状态优先。

恢复时先给用户一个短摘要：

```text
项目：example.com
阶段：P2 · local site
已完成：repository、scaffold
等待：sample quality review
下一步：write bilingual SEO content
```

然后继续既定目标，不要重新问“上次做到哪里”。

## 阶段与依赖

| 阶段 | 交付物 | 何时可做 | 人工门 |
| --- | --- | --- | --- |
| P0 | 关键词、域名、brief、目标路径 | 立即 | 产品或目标有实质歧义时 |
| P1 | 模板 fork 的最新版、独立仓库、`upstream` 和 `origin` | P0 完成 | 目标目录/仓库冲突、建仓库授权、模板 fork 落后 |
| P2 | 本地可运行新站、双语基础内容、SEO 草稿、素材槽 | P1 完成；不必等样片 | 品牌视觉选择可后置 |
| P3 | Cloudflare 资源、登录、Turnstile、预发 | P1/P2 可并行准备 | 账号、验证码、费用或生产授权 |
| P4 | 真实视频样片、人声/口型/双人身份与成本验收 | 可和 P2/P3 并行 | 用户看效果、确定最终规格 |
| P5 | 支付商品、Webhook、sandbox、账本一致 | 套餐结构稳定即可 | 商户资料、正式 Key、真实付款 |
| P6 | 正式域名、公开页面、收费开放 | P3+P4+P5 满足 | 生产发布和收款授权 |
| P7 | Umami、PVUV、GA4、Clarity、反馈、GSC/Bing/IndexNow | 代码接入可早做；提交公开页面可后置 | 平台登录、所有权验证、收录不保证 |
| P8 | 上线体检和售后观察 | P6 后 | 真实用户和付款结果 |

P4 等待人工验收时，继续 P2/P3/P7 中不依赖最终规格的准备工作。不要把整个任务状态改成暂停。

## 阶段路由

| 阶段 | 加载/执行 |
| --- | --- |
| P0 | 使用本 Skill 和 [state reference](references/state.md)；整理关键词与域名，不创建远程资源 |
| P1 | 读取 [phase-1-repository.md](references/phase-1-repository.md)；先拉最新模板，再建独立仓库 |
| P2 | 读取目标站点的 `.claude/skills/new-hot-site/SKILL.md`，不要在总控里复制它的步骤 |
| P3 | 使用项目 README/Cloudflare 配置和现有 Wrangler 流程；有专用模块时再登记到本表 |
| P5 | 使用项目支付文档及现有 Waffo/Dodo 脚本；有专用模块时再登记到本表 |
| P7 | 目标站点已有 `connect-site-analytics` 时优先加载；否则按项目现有统计与搜索文档执行 |
| P8 | 读取 `.claude/skills/launch-audit/SKILL.md` |

模板同步是维护动作，不插入建站阶段；用户说“同步模板”时使用 `sync-upstream` skill。

## 状态协议

状态文件在 `~/.codex/site-builds/`，active pointer 也在同一目录。完整字段和恢复规则见 [state reference](references/state.md)。常用命令：

```bash
node scripts/site-state.mjs init --project <domain> --keyword "<keyword>"
node scripts/site-state.mjs update --project <domain> --stage P1 --status in_progress --next "create repository"
node scripts/site-state.mjs checkpoint --project <domain> --message "P1 repository verified"
node scripts/site-state.mjs list
node scripts/site-state.mjs activate --project <domain>
```

每个阶段结束、每个真实人工门和每次任务暂停都 checkpoint。只记录公开路径、URL、ID、提交和下一步；不记录 Secret、密码、银行卡或身份资料。

## 执行纪律

- 用户说“新建站”并给了关键词和域名，就是执行请求；不要只回一个计划。
- 用户说“继续建站”，先核对状态，再执行下一步；不要重新初始化或重复已完成的写入。
- 资源创建、部署、付款、DNS、提交审核等外部写入，只有在当前用户请求已覆盖的对象和环境中执行；缺授权时只暂停依赖它的动作。
- 当前没有专用模块的阶段，按项目现有文档和工具完成；不能假装某个不存在的 Skill 已经存在。
- 新增任何建站子 Skill，先把它登记到本 Skill 的阶段路由和状态字段，再使用；不要为用户增加第二个入口。
- 一轮结束时报告“已完成、当前可继续、正在等待什么、下一步”；不要把配置、代码通过、已部署、线上请求和平台入库混成一个状态。
