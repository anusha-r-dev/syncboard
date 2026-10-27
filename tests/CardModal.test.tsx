import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { axe } from 'jest-axe'
import { describe, expect, it } from 'vitest'
import { boardActions, boardReducer } from '../src/features/board/boardSlice'
import { CardModal } from '../src/features/board/CardModal'
import { historyReducer } from '../src/features/history/historySlice'
import { presenceReducer } from '../src/features/presence/presenceSlice'
import { syncReducer } from '../src/features/sync/syncSlice'

function createTestStore() {
  return configureStore({
    reducer: {
      board: boardReducer,
      history: historyReducer,
      presence: presenceReducer,
      sync: syncReducer,
    },
  })
}

describe('CardModal', () => {
  it('opens with card data and closes with Escape', () => {
    const store = createTestStore()
    store.dispatch(boardActions.cardSelected('card-1'))
    render(
      <Provider store={store}>
        <CardModal />
      </Provider>,
    )

    expect(screen.getByRole('dialog', { name: 'Card details' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Interview pilot customers')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('traps keyboard focus and has no axe violations', async () => {
    const user = userEvent.setup()
    const store = createTestStore()
    store.dispatch(boardActions.cardSelected('card-1'))
    const { container } = render(
      <Provider store={store}>
        <CardModal />
      </Provider>,
    )
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close card details' })).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('Title')).toHaveFocus()
    expect((await axe(container)).violations).toHaveLength(0)
  })
})
