# P1：关键词与域名 → 最新模板 → 独立站点仓库

这是 `hot-site-factory` 的内部阶段，不对用户单独展示为另一个 Skill。输入来自总控状态：关键词、域名、品牌、slug、目标目录和仓库名。

## 输入规则

- 关键词负责内容主题；域名负责站点身份，两者可以完全不同。
- slug 优先使用用户指定值，否则从域名主体生成；中文关键词不能直接拿来做 slug。
- 品牌默认 `<keyword> AI`，但不要用域名反推品牌覆盖用户输入。
- 目标目录默认 `/Users/tangjei/Documents/建站/工具站/<slug>`；仓库默认当前 `gh` 登录账号下的 `<slug>`，默认私有。

## 0. 模板最新版

确认模板目录：

1. `SHRIMPREEL_TEMPLATE`；
2. 当前目录中 `origin` 指向 `tnagjei/shrimpreel`、`upstream` 指向 `qianshuixia/shrimpreel` 的仓库；
3. 本机默认 `/Users/tangjei/Documents/建站/模板/shrimpreel`。

```bash
git -C "$TEMPLATE_DIR" fetch origin main upstream main
template_origin=$(git -C "$TEMPLATE_DIR" remote get-url origin)
git -C "$TEMPLATE_DIR" merge-base --is-ancestor upstream/main origin/main
template_sha=$(git -C "$TEMPLATE_DIR" rev-parse origin/main)
```

这里克隆的是**模板 fork 的 origin/main**，不是原作者仓库。这样 `hot-site-factory`、状态账本和其他自定义 Skill 会随新站一起复制过去；新站的 `upstream` 指向模板 fork，后续仍可从模板 fork 合并更新。

创建前必须满足：

- 模板工作区干净，`HEAD === origin/main`；
- 原作者 `upstream/main` 已经包含在 `origin/main` 中；
- 模板 fork 的 `origin` 可读。

如果 fork 落后，先在模板仓库完成 `sync-upstream`，不要克隆旧版本。网络失败时保留旧状态并报告真实错误，不能把本地旧提交称为最新版。

## 1. 本地副本

先复制，再创建远程仓库；任何一步失败都保留本地目录和已取得的对象。

```bash
git clone "$template_origin" "$TARGET_DIR"
git -C "$TARGET_DIR" fetch origin main
```

如果克隆提交与 `template_sha` 不同，以刚 fetch 的 `origin/main` 为准。新目录没有用户改动，可以安全执行：

```bash
git -C "$TARGET_DIR" switch -C main origin/main
```

记录实际模板 SHA，不使用 squash、rebase、cherry-pick 或 GitHub “Use this template”。

## 2. 创建站点仓库

```bash
gh repo create "$OWNER/$REPO" --private --description "<keyword> site built on ShrimpReel"
git -C "$TARGET_DIR" remote rename origin upstream
git -C "$TARGET_DIR" remote add origin "https://github.com/$OWNER/$REPO.git"
git -C "$TARGET_DIR" push -u origin main
git -C "$TARGET_DIR" remote -v
git -C "$TARGET_DIR" rev-parse HEAD
git ls-remote origin refs/heads/main
```

只有用户明确要求公开时才改用 `--public`。回读远端 `main` 与本地 HEAD 一致后才能进入 P2。目标目录或仓库冲突时停止，不要覆盖或重复创建。

把实际 `templateSha`、`target`、`repo` 和阶段写入状态账本，然后 checkpoint。

## 3. 交给 P2

进入 `$TARGET_DIR`，读取目标仓库的 `.claude/skills/new-hot-site/SKILL.md`。如果该文件不存在，读取模板中的同名版本，不能凭记忆改写。

按 `new-hot-site` 的 preview→write 流程执行脚手架，关键词、域名、slug、品牌都来自总控状态。P2 可以继续生成双语草稿、素材槽、定价草稿和本地检查；没有真实样本时把规格标成 TODO。

## 失败与恢复

- 目标目录已有内容：停止，不覆盖。
- 远程仓库已存在且非空：停止，核对后切换或换名。
- clone 或 push 失败：保留本地仓库，先读 remote 和远端状态再重试。
- `new-site` 预览异常：停在本地目录，保存日志，不直接改模板共用代码。
- 恢复时先读状态、`git status`、remote 和 HEAD，不重新创建已成功对象。
