// 네이버 블로그 · LinkedIn 수치 수집 에이전트
//
// 매 실행마다:
//   1. 네이버 RSS에서 새 블로그 글을 찾아 posts에 자동 등록
//   2. 등록된 naver_blog 게시물의 공개 페이지에서 공감·댓글 수집
//   3. 등록된 linkedin 게시물 페이지에서 반응·댓글 수집 (로그인 프로필 필요)
//   4. 수치를 /api/posts/metrics 로 전송
//
// 사용법:  node scrape.mjs
// 선행조건: config.json에 naver_blog_id 설정, `node login.mjs`로 로그인 1회

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const cfg = JSON.parse(readFileSync(path.join(DIR, 'config.json'), 'utf8'))
const API = String(cfg.api_base ?? '').replace(/\/$/, '')
const PROFILE = path.join(DIR, 'profile')
const DEBUG_DIR = path.join(DIR, 'debug')

const summary = { naver_new: 0, naver_metrics: 0, linkedin_metrics: 0, failed: [] }

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args)
}

async function api(pathname, init) {
  const res = await fetch(`${API}${pathname}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}`)
  return res.json()
}

const num = (m) => (m ? Number(String(m[1]).replace(/,/g, '')) : undefined)

function decodeXml(s) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .trim()
}

/** 네이버 글 URL → logNo 기반 정규화 키 */
function naverKey(url) {
  const m =
    String(url).match(/blog\.naver\.com\/([^/?#]+)\/(\d+)/) ||
    String(url).match(/blogId=([^&]+).*?logNo=(\d+)/)
  return m ? `${m[1]}/${m[2]}` : String(url)
}

// ── 1. 네이버 RSS → 새 글 자동 등록 ──
async function syncNaverFromRss(existingPosts) {
  if (!cfg.naver_blog_id) {
    log('naver: config.json의 naver_blog_id가 비어 있어 RSS 동기화를 건너뜁니다')
    return
  }
  const res = await fetch(`https://rss.blog.naver.com/${cfg.naver_blog_id}.xml`)
  if (!res.ok) throw new Error(`naver RSS HTTP ${res.status}`)
  const xml = await res.text()
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])
  const rssPosts = items
    .map((item) => ({
      title: decodeXml((item.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? ''),
      link: decodeXml((item.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? ''),
      pubDate: ((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? [])[1] ?? '').trim(),
    }))
    .filter((p) => p.link)

  const known = new Set(
    existingPosts.filter((p) => p.platform === 'naver_blog').map((p) => naverKey(p.post_url))
  )
  const fresh = rssPosts.filter((p) => !known.has(naverKey(p.link)))
  for (const p of fresh) {
    await api('/posts', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'naver_blog',
        title: p.title.slice(0, 60),
        post_url: p.link,
        posted_at: p.pubDate ? new Date(p.pubDate).toISOString() : new Date().toISOString(),
      }),
    })
    log(`naver: 새 글 등록 — ${p.title.slice(0, 40)}`)
    summary.naver_new += 1
  }
}

// ── 2. 네이버 게시물 수치 (공개 모바일 페이지: 공감·댓글) ──
async function scrapeNaverPost(page, post) {
  const key = naverKey(post.post_url)
  const target = key.includes('/') ? `https://m.blog.naver.com/${key}` : post.post_url
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)
  // 하단 공감/댓글 영역은 지연 렌더링 — 스크롤로 로드 유도
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(2000)
  const text = await page.evaluate(() => document.body.innerText)

  // 카운트가 0이면 네이버는 숫자 없이 라벨("공감"/"댓글")만 표시함 → 라벨 존재 시 0으로 처리
  let likes = num(text.match(/공감\s*([\d,]+)/))
  let comments = num(text.match(/댓글\s*([\d,]+)/))
  if (likes == null && /공감/.test(text)) likes = 0
  if (comments == null && /댓글/.test(text)) comments = 0

  if (likes == null && comments == null) {
    dumpDebug(`naver_${key.replace(/\W/g, '_')}`, text)
    throw new Error('공감/댓글 패턴 미검출 (debug/ 폴더 확인)')
  }
  return { likes, comments }
}

// ── 3. LinkedIn 게시물 수치 (로그인 세션, 반응·댓글) ──
async function scrapeLinkedinPost(page, post) {
  await page.goto(post.post_url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(5000)
  const text = await page.evaluate(() => document.body.innerText)

  if (/로그인|Sign in|가입/.test(text.slice(0, 400)) && text.length < 3000) {
    throw new Error('로그인 세션 만료 추정 — node login.mjs 재실행 필요')
  }

  const likes =
    num(text.match(/외\s*([\d,]+)명/)) ??
    num(text.match(/([\d,]+)\s*(?:others|reactions?)/i))
  const comments =
    num(text.match(/댓글\s*([\d,]+)/)) ?? num(text.match(/([\d,]+)\s*comments?/i))
  const views = num(text.match(/노출\s*([\d,]+)/)) ?? num(text.match(/([\d,]+)\s*impressions?/i))

  if (likes == null && comments == null && views == null) {
    dumpDebug(`linkedin_${post.id}`, text)
    throw new Error('반응/댓글 패턴 미검출 (debug/ 폴더 확인)')
  }
  return { likes, comments, views }
}

function dumpDebug(name, text) {
  mkdirSync(DEBUG_DIR, { recursive: true })
  writeFileSync(path.join(DEBUG_DIR, `${name}.txt`), text.slice(0, 20000), 'utf8')
}

async function postMetrics(postId, metrics) {
  const body = { post_id: postId }
  for (const k of ['views', 'likes', 'comments']) {
    if (metrics[k] != null && !Number.isNaN(metrics[k])) body[k] = metrics[k]
  }
  if (Object.keys(body).length === 1) return false
  await api('/posts/metrics', { method: 'POST', body: JSON.stringify(body) })
  return true
}

// ── main ──
async function main() {
  log(`metrics-agent 시작 (api: ${API})`)

  let { posts } = await api('/posts')

  // 네이버는 Vercel 크론이 클라우드에서 수집 — naver_enabled=true일 때만 로컬 백업 수집
  const naverEnabled = Boolean(cfg.naver_enabled)
  if (naverEnabled) {
    try {
      await syncNaverFromRss(posts)
      if (summary.naver_new > 0) ({ posts } = await api('/posts'))
    } catch (err) {
      summary.failed.push(`naver rss: ${err.message}`)
    }
  }

  const naverPosts = naverEnabled ? posts.filter((p) => p.platform === 'naver_blog') : []
  const linkedinPosts = posts.filter((p) => p.platform === 'linkedin')

  if (naverPosts.length === 0 && linkedinPosts.length === 0) {
    log('수집할 네이버/링크드인 게시물이 없습니다. (성과 페이지에서 등록하거나 naver_blog_id를 설정하세요)')
    return
  }

  const context = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: Boolean(cfg.headless),
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const page = context.pages()[0] ?? (await context.newPage())

  try {
    for (const post of naverPosts) {
      try {
        const m = await scrapeNaverPost(page, post)
        if (await postMetrics(post.id, m)) {
          summary.naver_metrics += 1
          log(`naver ✓ ${post.title.slice(0, 30)} — 공감 ${m.likes ?? '-'} 댓글 ${m.comments ?? '-'}`)
        }
        await page.waitForTimeout(1500)
      } catch (err) {
        summary.failed.push(`naver post ${post.id}: ${err.message}`)
      }
    }

    for (const post of linkedinPosts) {
      try {
        const m = await scrapeLinkedinPost(page, post)
        if (await postMetrics(post.id, m)) {
          summary.linkedin_metrics += 1
          log(`linkedin ✓ ${post.title.slice(0, 30)} — 반응 ${m.likes ?? '-'} 댓글 ${m.comments ?? '-'} 노출 ${m.views ?? '-'}`)
        }
        await page.waitForTimeout(4000) // 링크드인은 천천히 (봇 감지 회피)
      } catch (err) {
        summary.failed.push(`linkedin post ${post.id}: ${err.message}`)
      }
    }
  } finally {
    await context.close()
  }

  log('완료:', JSON.stringify(summary, null, 2))
  if (summary.failed.length > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error('[metrics-agent] fatal:', err)
  process.exitCode = 1
})
