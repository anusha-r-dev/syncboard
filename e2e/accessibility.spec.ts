import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('board and card modal have no automatically detectable accessibility violations', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('syncboard-tour-complete', 'true'))
  await page.goto('/')
  const boardResults = await new AxeBuilder({ page }).analyze()
  expect(boardResults.violations).toEqual([])

  for (const name of ['Undo last change', 'Redo last change', 'Use dark theme']) {
    const control = page.getByRole('button', { name })
    await expect(control).toHaveAttribute('title', /.+/)
  }

  await page.getByRole('button', { name: 'Use dark theme' }).click()
  const darkResults = await new AxeBuilder({ page }).analyze()
  expect(darkResults.violations).toEqual([])

  await page.getByTestId('card-card-1').getByRole('button').first().click()
  const modalResults = await new AxeBuilder({ page }).analyze()
  expect(modalResults.violations).toEqual([])
})
