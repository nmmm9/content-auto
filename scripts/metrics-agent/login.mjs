// 최초 1회 실행: 네이버·링크드인에 로그인해서 브라우저 프로필에 세션을 저장한다.
// 이후 scrape.mjs가 이 프로필로 로그인 상태를 재사용한다.
//
// 사용법:  node login.mjs
//   1) 크롬 창이 뜨면 네이버 탭과 링크드인 탭에서 각각 로그인
//   2) 로그인 완료 후 브라우저 창을 닫으면 저장 완료

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const PROFILE = path.join(DIR, 'profile')

const context = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome',
  headless: false,
  viewport: null,
  // 자동화 감지 완화 (구글 SSO "안전하지 않은 브라우저" 차단 우회)
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
})

const naver = context.pages()[0] ?? (await context.newPage())
await naver.goto('https://nid.naver.com/nidlogin.login')

const linkedin = await context.newPage()
await linkedin.goto('https://www.linkedin.com/login')

console.log('')
console.log('==============================================')
console.log('  1) 네이버 탭에서 로그인하세요')
console.log('  2) 링크드인 탭에서 로그인하세요')
console.log('  3) 둘 다 로그인 후 브라우저 창을 닫으세요')
console.log('==============================================')

await new Promise((resolve) => context.on('close', resolve))
console.log('[login] 세션 저장 완료 — 이제 scrape.mjs가 로그인 상태로 실행됩니다.')
