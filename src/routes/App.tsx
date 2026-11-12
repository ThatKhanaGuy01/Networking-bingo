import { Route, Routes, useParams } from 'react-router-dom'
import { AppStateProvider } from '../app/AppState'
import { apiTaskSource, type TaskSource } from '../data/taskSource'
import { CreateCardPage } from './CreateCardPage'
import { HomePage } from './HomePage'
import { PlayPage } from './PlayPage'
import { RandomSetupPage } from './RandomSetupPage'
import { AdminPage } from './AdminPage'
import { SharedCardPage } from './SharedCardPage'

function SharedCardRoute() {
  const { id = '' } = useParams()
  return <SharedCardPage id={id} />
}

export function AppRoutes() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/random" element={<RandomSetupPage />} />
    <Route path="/create" element={<CreateCardPage />} />
    <Route path="/play" element={<PlayPage />} />
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/c/:id" element={<SharedCardRoute />} />
    <Route path="*" element={<HomePage />} />
  </Routes>
}

export default function App({ taskSource = apiTaskSource }: { taskSource?: TaskSource }) {
  return <AppStateProvider taskSource={taskSource}><AppRoutes /></AppStateProvider>
}
