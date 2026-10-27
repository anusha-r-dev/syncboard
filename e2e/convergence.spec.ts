import { expect, test, type Locator, type Page } from '@playwright/test'

type BoardSnapshot = Array<{ id: string; title: string; columnId: string }>

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
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 10, sourceBox.y + 20, {
    steps: 3,
  })
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height - 45,
    { steps: 8 },
  )
  await page.mouse.up()
  await page.waitForTimeout(220)
}

async function snapshotBoard(page: Page): Promise<BoardSnapshot> {
  return page.locator('article[data-testid^="card-"]').evaluateAll((cards) =>
    cards
      .map((card) => ({
        id: card.getAttribute('data-testid') ?? '',
        title: card.querySelector('.card-title')?.textContent?.trim() ?? '',
        columnId:
          card.closest('section[data-testid^="column-"]')?.getAttribute('data-testid') ??
          '',
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  )
}

function shuffledActions(): Array<'drag' | 'edit' | 'undo'> {
  const actions: Array<'drag' | 'edit' | 'undo'> = [
    ...Array.from({ length: 20 }, () => 'drag' as const),
    ...Array.from({ length: 20 }, () => 'edit' as const),
    ...Array.from({ length: 10 }, () => 'undo' as const),
  ]
  let seed = 1_337
  for (let index = actions.length - 1; index > 1; index -= 1) {
    seed = (seed * 48_271) % 2_147_483_647
    const swapIndex = 1 + (seed % index)
    const current = actions[index]
    const swap = actions[swapIndex]
    if (current && swap) {
      actions[index] = swap
      actions[swapIndex] = current
    }
  }
  actions[0] = 'edit'
  return actions
}

test('two clients converge after 50 mixed online and offline operations', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => localStorage.setItem('syncboard-tour-complete', 'true'))
  await page.goto('/')
  const second = await context.newPage()
  await second.addInitScript(() =>
    localStorage.setItem('syncboard-tour-complete', 'true'),
  )
  await second.goto('/')
  await expect(page.getByText('Online', { exact: true })).toBeVisible()
  await expect(second.getByText('Online', { exact: true })).toBeVisible()

  const setOffline = async (offline: boolean) => {
    const controls = page.locator('.dev-panel')
    if (!(await controls.evaluate((element) => element.hasAttribute('open')))) {
      await page.getByText('Demo controls').click()
    }
    const checkbox = page.getByLabel('Simulate offline')
    if (offline) await checkbox.check()
    else await checkbox.uncheck()
    await page.getByText('Demo controls').click()
  }

  const actions = shuffledActions()
  for (const [index, action] of actions.entries()) {
    if (index === 15) await setOffline(true)
    if (index === 30) await setOffline(false)

    if (action === 'edit') {
      await page.getByTestId('card-card-2').locator('.card-body').click({ force: true })
      await page
        .getByLabel('Title', { exact: true })
        .fill(`Launch ownership revision ${index}`)
      await page.getByRole('button', { name: 'Save changes' }).click()
    } else if (action === 'drag') {
      const card = page.getByTestId('card-card-1')
      const currentColumn = await card.evaluate(
        (node) => node.closest('section')?.getAttribute('data-testid') ?? '',
      )
      const targetId =
        currentColumn === 'column-in-progress' ? 'column-backlog' : 'column-in-progress'
      await dragWithPointer(
        page,
        card.getByRole('button', { name: /move/i }),
        page.getByTestId(targetId),
      )
    } else {
      await page.getByRole('button', { name: 'Undo last change' }).click()
    }
  }

  if (await page.getByText('Offline', { exact: true }).isVisible())
    await setOffline(false)
  await expect(page.getByText(/changes pending/i)).not.toBeVisible({ timeout: 15_000 })
  await expect
    .poll(async () => JSON.stringify(await snapshotBoard(second)), { timeout: 15_000 })
    .toBe(JSON.stringify(await snapshotBoard(page)))
})
