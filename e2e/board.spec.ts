import { expect, test, type Locator, type Page } from '@playwright/test'

async function dragWithPointer(
  page: Page,
  source: Locator,
  target: Locator,
): Promise<void> {
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('syncboard-tour-complete', 'true'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Product launch' })).toBeVisible()
})

test('drags a card and preserves the move after reload', async ({ page }) => {
  const card = page.getByTestId('card-card-1')
  const done = page.getByTestId('column-done')
  await dragWithPointer(page, card.getByRole('button', { name: /move/i }), done)
  await expect(done.getByText('Interview pilot customers')).toBeVisible()
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-persisted-revision',
    '1',
  )
  await page.reload()
  await expect(
    page.getByTestId('column-done').getByText('Interview pilot customers'),
  ).toBeVisible()
})

test('two tabs receive edits and live presence', async ({ page, context }) => {
  const second = await context.newPage()
  await second.addInitScript(() =>
    localStorage.setItem('syncboard-tour-complete', 'true'),
  )
  await second.goto('/')

  await page.getByTestId('card-card-2').getByRole('button').first().click()
  await page.getByLabel('Title', { exact: true }).fill('Confirm launch ownership')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(
    second.getByTestId('card-card-2').getByText('Confirm launch ownership', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(second.getByLabel('2 people viewing')).toContainText('2')
})

test('queues an offline edit and converges after reconnect', async ({
  page,
  context,
}) => {
  const second = await context.newPage()
  await second.addInitScript(() =>
    localStorage.setItem('syncboard-tour-complete', 'true'),
  )
  await second.goto('/')

  await page.getByText('Demo controls').click()
  await page.getByLabel('Simulate offline').check()
  await page.getByTestId('card-card-3').getByRole('button').first().click()
  await page.getByLabel('Title', { exact: true }).fill('Audit responsive navigation')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(/changes? pending/i)).toBeVisible()
  await expect(
    second.getByTestId('card-card-3').getByText('Audit responsive navigation', {
      exact: true,
    }),
  ).not.toBeVisible()

  await page.getByLabel('Simulate offline').uncheck()
  await expect(
    second.getByTestId('card-card-3').getByText('Audit responsive navigation', {
      exact: true,
    }),
  ).toBeVisible()
})

test('rolls back an optimistic edit when the transport rejects it', async ({ page }) => {
  await page.getByText('Demo controls').click()
  await page.getByLabel('Force next failures').check()
  await page.getByText('Demo controls').click()

  await page.getByTestId('card-card-2').getByRole('button').first().click()
  await page.getByLabel('Title', { exact: true }).fill('This edit should roll back')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByText('The simulated server rejected this change')).toBeVisible()
  await expect(
    page.getByTestId('card-card-2').getByText('Draft launch checklist', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo last change' })).toBeDisabled()
})

test('synchronizes undo and redo to another tab', async ({ page, context }) => {
  const second = await context.newPage()
  await second.addInitScript(() =>
    localStorage.setItem('syncboard-tour-complete', 'true'),
  )
  await second.goto('/')

  await page.getByTestId('card-card-2').getByRole('button').first().click()
  await page.getByLabel('Title', { exact: true }).fill('Collaborative release plan')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(
    second.getByTestId('card-card-2').getByText('Collaborative release plan', {
      exact: true,
    }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Undo last change' }).click()
  await expect(
    second.getByTestId('card-card-2').getByText('Draft launch checklist', {
      exact: true,
    }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Redo last change' }).click()
  await expect(
    second.getByTestId('card-card-2').getByText('Collaborative release plan', {
      exact: true,
    }),
  ).toBeVisible()
})

test('restores and replays an offline queue after reload', async ({ page, context }) => {
  const second = await context.newPage()
  await second.addInitScript(() =>
    localStorage.setItem('syncboard-tour-complete', 'true'),
  )
  await second.goto('/')

  await page.getByText('Demo controls').click()
  await page.getByLabel('Simulate offline').check()
  await page.getByTestId('card-card-3').getByRole('button').first().click()
  await page.getByLabel('Title', { exact: true }).fill('Persistent offline audit')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(/1 change pending/i)).toBeVisible()
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-persisted-revision',
    '1',
  )

  await page.reload()
  await expect(
    page.getByTestId('card-card-3').getByText('Persistent offline audit', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    second.getByTestId('card-card-3').getByText('Persistent offline audit', {
      exact: true,
    }),
  ).toBeVisible()
})

test('recovers a same-card offline conflict with a clear message', async ({
  page,
  context,
}) => {
  const second = await context.newPage()
  await second.addInitScript(() =>
    localStorage.setItem('syncboard-tour-complete', 'true'),
  )
  await second.goto('/')

  await second.getByText('Demo controls').click()
  await second.getByLabel('Simulate offline').check()
  await second.getByTestId('card-card-2').getByRole('button').first().click()
  await second.getByLabel('Title', { exact: true }).fill('Offline ownership draft')
  await second.getByRole('button', { name: 'Save changes' }).click()

  await page.getByTestId('card-card-2').getByRole('button').first().click()
  await page.getByLabel('Title', { exact: true }).fill('Online ownership draft')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await second.getByLabel('Simulate offline').uncheck()
  await expect(second.getByText(/Conflict resolved with/)).toBeVisible()
  await expect
    .poll(async () => {
      const firstTitle = await page
        .getByTestId('card-card-2')
        .locator('.card-title')
        .textContent()
      const secondTitle = await second
        .getByTestId('card-card-2')
        .locator('.card-title')
        .textContent()
      return firstTitle === secondTitle
    })
    .toBe(true)
})

test('supports empty search, an empty column, and keyboard drag announcements', async ({
  page,
}) => {
  await page.getByPlaceholder('Search cards…').fill('no-card-can-match-this')
  await expect(
    page.getByRole('heading', { name: 'No cards match those filters' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByText('Showing 12 of 12 cards')).toBeVisible()

  await page.getByRole('button', { name: 'Add column' }).click()
  const emptyColumn = page.getByLabel('New column cards')
  await expect(emptyColumn.getByText('Drop a card here or add a new one.')).toBeAttached()

  const handle = page.getByRole('button', { name: /Move Interview pilot customers/ })
  const liveRegion = page.locator('[id^="DndLiveRegion-"]')
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(liveRegion).toContainText(/Picked up|Moving over|Draggable item/)
  await page.waitForTimeout(100)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(100)
  await page.keyboard.press('Space')
  await expect(liveRegion).toContainText(/Dropped|dropped/i)
})

test('keeps filters contained and columns horizontally scrollable on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  const metrics = await page.evaluate(() => {
    const filters = document.querySelector('.filter-bar') as HTMLElement
    const board = document.querySelector('[data-testid="board"]') as HTMLElement
    const filterBox = filters.getBoundingClientRect()
    return {
      filterRight: filterBox.right,
      viewport: window.innerWidth,
      scrollWidth: board.scrollWidth,
      clientWidth: board.clientWidth,
      snap: getComputedStyle(board).scrollSnapType,
    }
  })
  expect(metrics.filterRight).toBeLessThanOrEqual(metrics.viewport)
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
  expect(metrics.snap).toContain('x')
})
