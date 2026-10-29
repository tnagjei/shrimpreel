import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('../../scripts/site-state.mjs', import.meta.url))

function run(home: string, ...args: string[]) {
  return execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, SITE_BUILD_HOME: home },
  })
}

describe('site-state', () => {
  it('初始化、更新、checkpoint 与恢复摘要保持一致', () => {
    const home = mkdtempSync(join(tmpdir(), 'site-state-test-'))
    try {
      run(home, 'init', '--project', 'example.test', '--keyword', 'Example AI', '--repo', 'owner/example')
      run(home, 'update', '--project', 'example.test', '--stage', 'P1', '--completed', 'repo_created', '--next', 'run scaffold')
      run(home, 'checkpoint', '--project', 'example.test', '--message', 'repo verified')

      const state = JSON.parse(readFileSync(join(home, 'example.test.json'), 'utf8')) as {
        stage: string
        completed: string[]
        next: string
        history: Array<{ event: string }>
      }
      expect(state).toMatchObject({ stage: 'P1', completed: ['repo_created'], next: 'run scaffold' })
      expect(state.history.map((event) => event.event)).toEqual(['created', 'updated', 'checkpoint'])

      const summary = run(home, 'status', '--project', 'example.test')
      expect(summary).toContain('阶段：P1')
      expect(summary).toContain('下一步：run scaffold')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
