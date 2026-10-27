import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'

type BridgeEnvelope = { channel: string; message: unknown }

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
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + 20, {
    steps: 3,
  })
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height - 45,
    { steps: 10 },
  )
  await page.mouse.up()
}

async function installCrossContextBridge(
  context: BrowserContext,
  pages: Set<Page>,
): Promise<void> {
  await context.exposeBinding(
    'syncboardBridgeSend',
    async ({ page }, envelope: BridgeEnvelope) => {
      await Promise.all(
        [...pages]
          .filter((candidate) => candidate !== page && !candidate.isClosed())
          .map((candidate) =>
            candidate.evaluate((value) => {
              const bridgedWindow = window as typeof window & {
                __syncboardBridgeReceive?: (message: BridgeEnvelope) => void
              }
              bridgedWindow.__syncboardBridgeReceive?.(value)
            }, envelope),
          ),
      )
    },
  )
  await context.addInitScript(() => {
    localStorage.setItem('syncboard-tour-complete', 'true')
    const bridgedWindow = window as typeof window & {
      syncboardBridgeSend: (message: BridgeEnvelope) => Promise<void>
      __syncboardBridgeReceive?: (message: BridgeEnvelope) => void
    }
    class CrossContextBroadcastChannel {
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null

      constructor(readonly name: string) {
        bridgedWindow.__syncboardBridgeReceive = (envelope) => {
          if (envelope.channel === this.name) {
            this.onmessage?.(new MessageEvent('message', { data: envelope.message }))
          }
        }
      }

      postMessage(message: unknown): void {
        void bridgedWindow.syncboardBridgeSend({ channel: this.name, message })
      }

      close(): void {}
    }
    Object.defineProperty(window, 'BroadcastChannel', {
      configurable: true,
      value: CrossContextBroadcastChannel,
    })
  })
}

test('two isolated browser contexts converge through the transport contract', async ({
  browser,
}) => {
  const baseURL = 'http://127.0.0.1:4173'
  const pages = new Set<Page>()
  const firstContext = await browser.newContext({ baseURL })
  const secondContext = await browser.newContext({ baseURL })
  await installCrossContextBridge(firstContext, pages)
  await installCrossContextBridge(secondContext, pages)
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()
  pages.add(first)
  pages.add(second)

  try {
    await Promise.all([first.goto('/'), second.goto('/')])
    await expect(first.getByText('Online', { exact: true })).toBeVisible()
    await expect(second.getByText('Online', { exact: true })).toBeVisible()
    await first.mouse.move(240, 180)
    await second.mouse.move(420, 220)
    await expect(first.locator('.remote-cursor')).toHaveCount(1)
    await expect(second.locator('.remote-cursor')).toHaveCount(1)

    await dragWithPointer(
      first,
      first.getByTestId('card-card-1').getByRole('button', { name: /move/i }),
      first.getByTestId('column-done'),
    )
    await expect(
      second.getByTestId('column-done').getByText('Interview pilot customers'),
    ).toBeVisible()

    await first.getByTestId('card-card-2').getByRole('button').first().click()
    await first.getByLabel('Title', { exact: true }).fill('Cross-context launch plan')
    await first.getByRole('button', { name: 'Save changes' }).click()

    await expect(
      second.getByTestId('card-card-2').getByText('Cross-context launch plan', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(first.getByLabel('2 people viewing')).toContainText('2')
    await expect(second.getByLabel('2 people viewing')).toContainText('2')
  } finally {
    await firstContext.close()
    await secondContext.close()
  }
})
