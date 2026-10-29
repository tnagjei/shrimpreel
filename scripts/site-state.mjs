#!/usr/bin/env node
// 热词站总控的本地状态账本。状态放在用户目录，不进入站点仓库。
// 用法见 .claude/skills/hot-site-factory/SKILL.md；不要把 Secret 写进这里的任何字段。
import { chmod, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const STAGES = new Set(['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'])
const STATUSES = new Set(['in_progress', 'waiting_for_human', 'blocked', 'paused', 'done'])
const ROOT = process.env.SITE_BUILD_HOME || join(homedir(), '.codex', 'site-builds')

function fail(message) {
  console.error(`site-state: ${message}`)
  process.exitCode = 1
}

function argsOf(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i]
    if (!value.startsWith('--')) {
      out._.push(value)
      continue
    }
    const key = value.slice(2)
    const next = argv[i + 1]
    out[key] = next && !next.startsWith('--') ? (i++, next) : true
  }
  return out
}

function text(value, name, { required = false, max = 500 } = {}) {
  if (value === undefined || value === true || String(value).trim() === '') {
    if (required) throw new Error(`缺少 --${name}`)
    return undefined
  }
  return String(value).trim().slice(0, max)
}

function projectKey(value) {
  const project = text(value, 'project', { required: true, max: 253 })?.toLowerCase()
  if (!project || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(project) || !project.includes('.')) {
    throw new Error('--project 必须是完整域名，例如 imagetorapvideo.com')
  }
  return project
}

function pathOf(project) {
  if (project.includes('/') || project.includes('\\') || project === 'active') throw new Error('非法项目名')
  return join(ROOT, `${project}.json`)
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw new Error(`无法读取 ${path}: ${error.message}`)
  }
}

async function writeJson(path, value) {
  await mkdir(ROOT, { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await rename(tmp, path)
  await chmod(path, 0o600)
}

function list(value) {
  return [...new Set(String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean))].slice(0, 100)
}

function now() {
  return new Date().toISOString()
}

function addHistory(state, event, message) {
  state.history = [
    ...(Array.isArray(state.history) ? state.history : []),
    { at: now(), event, message: String(message ?? '').slice(0, 2000) },
  ].slice(-100)
}

function assertSafeText(value, name) {
  const s = String(value ?? '')
  if (/-----BEGIN [^-]*PRIVATE KEY-----|\bBearer\s+\S{20,}/i.test(s)) {
    throw new Error(`${name} 疑似包含密钥，拒绝写入状态账本`)
  }
}

function summary(state) {
  return [
    `项目：${state.project}`,
    `关键词：${state.keyword || '-'}`,
    `阶段：${state.stage || 'P0'} · ${state.status || 'in_progress'}`,
    `已完成：${state.completed?.length ? state.completed.join('、') : '无'}`,
    `等待：${state.waiting?.length ? state.waiting.join('、') : '无'}`,
    `下一步：${state.next || '未记录'}`,
    `仓库：${state.repo || '未创建'}`,
    `最后核验：${state.lastVerifiedAt || '未核验'}`,
  ].join('\n')
}

async function activeProject() {
  const active = await readJson(join(ROOT, 'active.json'))
  return active?.project ? projectKey(active.project) : undefined
}

async function resolve(args) {
  return projectKey(args.project || (await activeProject()))
}

async function init(args) {
  const project = projectKey(args.project)
  const keyword = text(args.keyword, 'keyword', { required: true, max: 120 })
  const statePath = pathOf(project)
  const existing = await readJson(statePath)
  if (existing) {
    console.log(`项目已存在，未覆盖：${project}`)
    return status({ ...args, project })
  }
  const at = now()
  const state = {
    version: 1,
    project,
    keyword,
    brand: text(args.brand, 'brand', { max: 100 }),
    slug: text(args.slug, 'slug', { max: 100 }),
    target: text(args.target, 'target', { max: 1000 }),
    repo: text(args.repo, 'repo', { max: 300 }),
    templateSha: text(args['template-sha'], 'template-sha', { max: 100 }),
    stage: 'P0',
    status: 'in_progress',
    completed: [],
    waiting: [],
    next: '整理站点 brief',
    createdAt: at,
    updatedAt: at,
    lastVerifiedAt: at,
    history: [{ at, event: 'created', message: '建立建站状态账本' }],
  }
  await writeJson(statePath, state)
  await writeJson(join(ROOT, 'active.json'), { project, updatedAt: at })
  console.log(summary(state))
}

async function update(args, event = 'updated') {
  const project = await resolve(args)
  const statePath = pathOf(project)
  const state = await readJson(statePath)
  if (!state) throw new Error(`项目 ${project} 还没有状态，先运行 init`)
  const nextStage = text(args.stage, 'stage', { max: 2 })
  const nextStatus = text(args.status, 'status', { max: 30 })
  if (nextStage && !STAGES.has(nextStage)) throw new Error(`未知阶段：${nextStage}`)
  if (nextStatus && !STATUSES.has(nextStatus)) throw new Error(`未知状态：${nextStatus}`)
  if (nextStage) state.stage = nextStage
  if (nextStatus) state.status = nextStatus
  if (args.brand !== undefined) state.brand = text(args.brand, 'brand', { max: 100 }) || null
  if (args.slug !== undefined) state.slug = text(args.slug, 'slug', { max: 100 }) || null
  if (args.target !== undefined) state.target = text(args.target, 'target', { max: 1000 }) || null
  if (args.repo !== undefined) state.repo = text(args.repo, 'repo', { max: 300 }) || null
  if (args['template-sha'] !== undefined) state.templateSha = text(args['template-sha'], 'template-sha', { max: 100 }) || null
  if (args.next !== undefined) {
    state.next = text(args.next, 'next', { max: 500 }) || null
    assertSafeText(state.next, '--next')
  }
  if (args.completed !== undefined) {
    state.completed = [...new Set([...(state.completed || []), ...list(args.completed)])].slice(-100)
  }
  if (args.waiting !== undefined) state.waiting = list(args.waiting)
  const message = text(args.message || args.note, 'message', { max: 2000 })
  if (message) assertSafeText(message, '--message')
  state.updatedAt = now()
  state.lastVerifiedAt = now()
  addHistory(state, event, message || state.next || '')
  await writeJson(statePath, state)
  await writeJson(join(ROOT, 'active.json'), { project, updatedAt: state.updatedAt })
  console.log(summary(state))
}

async function checkpoint(args) {
  const message = text(args.message, 'message', { required: true, max: 2000 })
  await update(args, 'checkpoint')
  return message
}

async function activate(args) {
  const project = await resolve(args)
  const state = await readJson(pathOf(project))
  if (!state) throw new Error(`项目 ${project} 还没有状态`)
  await writeJson(join(ROOT, 'active.json'), { project, updatedAt: now() })
  console.log(`当前项目：${project}`)
}

async function status(args) {
  const project = await resolve(args)
  const state = await readJson(pathOf(project))
  if (!state) throw new Error(`项目 ${project} 还没有状态`)
  if (args.json) console.log(JSON.stringify(state, null, 2))
  else console.log(summary(state))
}

async function listProjects(args) {
  await mkdir(ROOT, { recursive: true })
  const files = await readdir(ROOT)
  const states = []
  for (const file of files.filter((name) => name.endsWith('.json') && name !== 'active.json').sort()) {
    try {
      const state = await readJson(join(ROOT, file))
      if (state?.project) states.push(state)
    } catch {
      // 损坏的状态不能阻塞其他项目；status 会单独报错。
    }
  }
  if (args.json) {
    console.log(JSON.stringify(states, null, 2))
    return
  }
  if (!states.length) {
    console.log('还没有建站状态。')
    return
  }
  for (const state of states.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))) {
    console.log(`${state.project}\t${state.stage || 'P0'}\t${state.status || 'in_progress'}\t${state.next || ''}`)
  }
}

async function main() {
  const args = argsOf(process.argv.slice(2))
  const command = args._[0]
  try {
    if (command === 'init') await init(args)
    else if (command === 'update') await update(args)
    else if (command === 'checkpoint') await checkpoint(args)
    else if (command === 'activate') await activate(args)
    else if (command === 'status') await status(args)
    else if (command === 'list') await listProjects(args)
    else {
      console.log('用法：node scripts/site-state.mjs <init|status|update|checkpoint|activate|list> [--project <domain>] [--json]')
      process.exitCode = command ? 1 : 0
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

await main()
