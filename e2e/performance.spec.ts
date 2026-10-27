import { expect, test, type Locator, type Page } from '@playwright/test'

async function dragWithPointer(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Drag elements are not visible')
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 12,
    sourceBox.y + sourceBox.height / 2 + 12,
    { steps: 4 },
  )
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height - 45,
    { steps: 12 },
  )
  await page.mouse.up()
}

test('virtualizes 6,000 cards without gaps and supports cross-column drag', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('syncboard-tour-complete', 'true'))
  const navigationStarted = performance.now()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Product launch' })).toBeVisible()
  const firstRender = Math.round(performance.now() - navigationStarted)
  await page.getByText('Demo controls').click()

  const startedAt = performance.now()
  await page.getByRole('button', { name: 'Load 6,000-card stress test' }).click()
  await expect(page.getByText('Showing 6,012 of 6,012 cards')).toBeVisible()
  await expect(page.getByTestId('virtualized-column')).toBeVisible()
  const stressRender = Math.round(performance.now() - startedAt)

  const renderedCards = await page
    .getByTestId('column-backlog')
    .locator('article[data-testid^="card-"]')
    .count()
  expect(renderedCards).toBeLessThan(20)
  expect(stressRender).toBeLessThan(3_000)

  const virtualWindow = page.getByTestId('virtualized-column')
  const fps = await virtualWindow.evaluate(async (element) => {
    const started = performance.now()
    let frames = 0
    await new Promise<void>((resolve) => {
      const tick = () => {
        frames += 1
        const progress = Math.min(1, (performance.now() - started) / 1000)
        element.scrollTop = (element.scrollHeight - element.clientHeight) * progress
        if (progress < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
    return frames
  })
  await expect(page.getByText('Performance sample 6000', { exact: true })).toBeVisible()

  const session = await page.context().newCDPSession(page)
  await session.send('Performance.enable')
  const { metrics } = await session.send('Performance.getMetrics')
  const heapBytes = metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0
  const heapMb = Math.round((heapBytes / 1024 / 1024) * 10) / 10
  expect(fps).toBeGreaterThan(40)
  expect(heapMb).toBeLessThan(160)

  const source = page
    .getByTestId('card-performance-6000')
    .getByRole('button', { name: /Move Performance sample 6000/ })
  await dragWithPointer(page, source, page.getByTestId('column-in-progress'))
  await expect(
    page.getByTestId('column-in-progress').getByText('Performance sample 6000'),
  ).toBeVisible()

  console.log(
    `METRIC first render: ${firstRender}ms; 6,000-card render: ${stressRender}ms; scroll: ${fps} FPS; heap: ${heapMb}MB; DOM cards: ${renderedCards}`,
  )
})
