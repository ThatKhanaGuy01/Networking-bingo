import { Link, Route, Routes, useParams } from 'react-router-dom'
import { AppStateProvider } from '../app/AppState'
import type { TaskSource } from '../data/taskSource'
import { AppLayout } from '../components/AppLayout'
import { CreateCardPage } from './CreateCardPage'
import { HomePage } from './HomePage'
import { PlayPage } from './PlayPage'
import { RandomSetupPage } from './RandomSetupPage'

function AdminPlaceholder() {
  return <AppLayout>
    <section className="empty-card-state"><h1>Admin</h1><p>Admin tools are not available yet.</p><Link className="button button-primary" to="/">Home</Link></section>
  </AppLayout>
}

function SharedCardPlaceholder() {
  const { id } = useParams()
  return <AppLayout>
    <section className="empty-card-state"><h1>Shared card unavailable</h1><p>Custom card sharing is not available yet.</p><code>{id}</code><Link className="button button-primary" to="/">Home</Link></section>
  </AppLayout>
}

export function AppRoutes() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/random" element={<RandomSetupPage />} />
    <Route path="/create" element={<CreateCardPage />} />
    <Route path="/play" element={<PlayPage />} />
    <Route path="/admin" element={<AdminPlaceholder />} />
    <Route path="/c/:id" element={<SharedCardPlaceholder />} />
    <Route path="*" element={<HomePage />} />
  </Routes>
}

export default function App({ taskSource }: { taskSource?: TaskSource }) {
  return <AppStateProvider taskSource={taskSource}><AppRoutes /></AppStateProvider>
}
