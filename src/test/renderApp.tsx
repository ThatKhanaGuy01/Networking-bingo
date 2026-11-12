import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../routes/App'
import type { TaskSource } from '../data/taskSource'

export function renderApp(path = '/', taskSource?: TaskSource) {
  return render(<MemoryRouter initialEntries={[path]}><App taskSource={taskSource} /></MemoryRouter>)
}
