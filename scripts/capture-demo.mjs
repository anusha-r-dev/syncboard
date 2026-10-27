import { chromium } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1200, height: 675 } })
await context.addInitScript(() => localStorage.setItem('syncboard-tour-complete', 'true'))
const first = await context.newPage()
await first.goto(baseURL)

async function caption(page, text) {
  await page.evaluate((value) => {
    document.querySelector('[data-demo-caption]')?.remove()
    const element = document.createElement('div')
    element.dataset.demoCaption = 'true'
    element.textContent = value
    Object.assign(element.style, {
      position: 'fixed',
      left: '50%',
      bottom: '18px',
      transform: 'translateX(-50%)',
      zIndex: '9999',
      padding: '10px 18px',
      borderRadius: '999px',
      color: 'white',
      background: 'rgba(24, 33, 47, .92)',
      font: '700 14px system-ui',
      boxShadow: '0 8px 28px rgba(0, 0, 0, .22)',
    })
    document.body.append(element)
  }, text)
}

async function drag(page, source, target) {
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Demo drag target is not visible')
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 15)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + 20, sourceBox.y + 35, { steps: 4 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 100, {
    steps: 12,
  })
  await page.mouse.up()
}

await drag(
  first,
  first.getByTestId('card-card-1').getByRole('button', { name: /move/i }),
  first.getByTestId('column-done'),
)
await first.getByTestId('column-done').getByText('Interview pilot customers').waitFor()
await caption(first, 'Pointer drag • persisted board update')
await first.screenshot({ path: 'docs/demo-frame-1.png' })

const second = await context.newPage()
await second.goto(baseURL)
await first.getByTestId('card-card-2').getByRole('button').first().click()
await first.getByLabel('Title', { exact: true }).fill('Coordinate launch across tabs')
await first.getByRole('button', { name: 'Save changes' }).click()
await second.getByText('Coordinate launch across tabs', { exact: true }).waitFor()
await caption(second, 'Two-tab realtime sync • live presence')
await second.screenshot({ path: 'docs/demo-frame-2.png' })

await second.getByText('Demo controls').click()
await second.getByLabel('Simulate offline').check()
await second.getByTestId('card-card-3').getByRole('button').first().click()
await second.getByLabel('Title', { exact: true }).fill('Offline navigation revision')
await second.getByRole('button', { name: 'Save changes' }).click()
await first.getByTestId('card-card-3').getByRole('button').first().click()
await first.getByLabel('Title', { exact: true }).fill('Online navigation revision')
await first.getByRole('button', { name: 'Save changes' }).click()
await second.getByLabel('Simulate offline').uncheck()
await second.getByText(/Conflict resolved with/).waitFor()
await second.getByText('Demo controls').click()
await caption(second, 'Offline conflict • deterministic recovery')
await second.screenshot({ path: 'docs/demo-frame-3.png' })

await browser.close()
