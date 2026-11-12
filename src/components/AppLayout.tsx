import { Link } from 'react-router-dom'
import { useAppState } from '../app/AppState'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { storageIssue } = useAppState()
  return <div className="app-shell">
    <header className="site-header">
      <Link to="/" className="wordmark" aria-label="Networking Bingo home">
        <span>Networking Bingo</span>
      </Link>
    </header>
    {storageIssue && <p className="storage-notice" role="status">
      {storageIssue === 'corrupted'
        ? 'We cleared a saved card we could not read. You can start a fresh one.'
        : 'This browser cannot save progress right now. You can still play while this page is open.'}
    </p>}
    <main>{children}</main>
  </div>
}
