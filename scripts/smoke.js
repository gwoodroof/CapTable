#!/usr/bin/env node
// Smoke test script — run against the live URL after each production deploy.
// Requires: POSTMARK_API_TOKEN, SMOKE_PASSWORD
// Optional: SMOKE_FRONTEND_URL (default https://getcaptable.com)
//           SMOKE_API_URL      (default https://api.getcaptable.com)
//
// Exit 0 = all checks passed  |  Exit 1 = one or more checks failed

const FRONTEND = (process.env.SMOKE_FRONTEND_URL || 'https://getcaptable.com').replace(/\/$/, '')
const API      = (process.env.SMOKE_API_URL      || 'https://api.getcaptable.com').replace(/\/$/, '')
const EMAIL    = 'smokey@getcaptable.com'
const DEST     = 'garrett@getcaptable.com'
const FROM     = 'CapTable <noreply@getcaptable.com>'

const results = []
let anyFailed = false

async function check(label, fn) {
  const t0 = Date.now()
  try {
    await fn()
    const ms = Date.now() - t0
    results.push({ label, ok: true, ms })
    console.log(`  ✓  ${label} (${ms}ms)`)
  } catch (err) {
    const ms = Date.now() - t0
    results.push({ label, ok: false, ms, error: err.message })
    console.error(`  ✗  ${label}: ${err.message}`)
    anyFailed = true
  }
}

// Retry the health check until the API is up (cold-start can take 60-90 s on some hosts)
async function waitForHealth({ retries = 20, intervalMs = 6000 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${API}/api/v1/health`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) return
    } catch {}
    console.log(`  … waiting for API (attempt ${i + 1}/${retries})`)
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`API did not become healthy after ${retries} attempts`)
}

async function run() {
  console.log(`\nCapTable smoke tests`)
  console.log(`  frontend → ${FRONTEND}`)
  console.log(`  api      → ${API}\n`)

  // Wait up to ~2 min for the API to be live
  await check('API health', () => waitForHealth())

  // Homepage load — exercises the frontend CDN/server
  await check('homepage load', async () => {
    const res = await fetch(FRONTEND, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })

  // Login with the dedicated smoke account — exercises DB + bcrypt + JWT signing
  let token
  await check('login (smokey@getcaptable.com)', async () => {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: process.env.SMOKE_PASSWORD }),
      signal: AbortSignal.timeout(8000),
    })
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if (!body.token) throw new Error('no token in response')
    token = body.token
  })

  await sendEmail()

  process.exit(anyFailed ? 1 : 0)
}

async function sendEmail() {
  const apiToken = process.env.POSTMARK_API_TOKEN
  if (!apiToken) {
    console.warn('\n  (no POSTMARK_API_TOKEN — skipping email)\n')
    return
  }

  const passed   = results.filter(r => r.ok).length
  const failed   = results.filter(r => !r.ok).length
  const label    = anyFailed ? '🔴 FAILED' : '🟢 PASSED'
  const deployed = new Date().toUTCString()

  const rows = results.map(r => `
    <tr style="color:${r.ok ? '#2d7a3a' : '#c0392b'}">
      <td style="padding:6px 12px;font-size:18px">${r.ok ? '✓' : '✗'}</td>
      <td style="padding:6px 12px">${r.label}</td>
      <td style="padding:6px 12px;color:#666">${r.ms}ms</td>
      <td style="padding:6px 12px;color:#c0392b">${r.error || ''}</td>
    </tr>`).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin-bottom:4px">CapTable deploy smoke: ${label}</h2>
      <p style="color:#666;margin-top:0">${deployed}</p>
      <p>${passed} passed &nbsp;·&nbsp; ${failed} failed</p>
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr style="background:#f5f5f5;text-align:left">
            <th style="padding:6px 12px"></th>
            <th style="padding:6px 12px">Check</th>
            <th style="padding:6px 12px">Time</th>
            <th style="padding:6px 12px">Error</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:24px">
        Tested against <a href="${FRONTEND}">${FRONTEND}</a> &nbsp;·&nbsp; <a href="${API}">${API}</a>
      </p>
    </div>`

  try {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiToken,
      },
      body: JSON.stringify({
        From: FROM, To: DEST,
        Subject: `[CapTable] Smoke ${label} — ${deployed}`,
        HtmlBody: html,
        MessageStream: 'outbound',
      }),
    })
    if (!res.ok) console.error(`  email send failed: HTTP ${res.status}`)
    else console.log(`\n  Email sent to ${DEST}`)
  } catch (err) {
    console.error(`  email send error: ${err.message}`)
  }
}

run().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
