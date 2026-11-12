import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, adminLogin, adminLogout, createAdminTask, deleteAdminTask, getAdminSession, getAdminTasks, updateAdminTask, type AdminTask } from '../api/client'
import { AppLayout } from '../components/AppLayout'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [tasks, setTasks] = useState<readonly AdminTask[]>([])
  const [search, setSearch] = useState('')
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deleteTask, setDeleteTask] = useState<AdminTask | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadTasks = useCallback(async (query: string) => {
    try {
      const result = await getAdminTasks(query)
      setTasks(result)
      setError('')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) setAuthenticated(false)
      setError(cause instanceof Error ? cause.message : 'Could not load tasks.')
    }
  }, [])

  useEffect(() => {
    let current = true
    getAdminSession().then((active) => {
      if (current) setAuthenticated(active)
    }).catch(() => {
      if (current) setError('Could not check the admin session. Refresh to try again.')
    }).finally(() => {
      if (current) setCheckingSession(false)
    })
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (authenticated) void loadTasks(search)
  }, [authenticated, loadTasks, search])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminLogin(password)
      setAuthenticated(true)
      setPassword('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  async function submitNewTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await createAdminTask(newText)
      setNewText('')
      setNotice('Task added.')
      await loadTasks(search)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the task.')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(task: AdminTask) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await updateAdminTask(task.id, editingText)
      setEditingId(null)
      setEditingText('')
      setNotice('Task updated.')
      await loadTasks(search)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the task.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTask) return
    setBusy(true)
    setError('')
    try {
      await deleteAdminTask(deleteTask.id)
      setDeleteTask(null)
      setNotice('Task deleted.')
      await loadTasks(search)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the task.')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    setError('')
    try {
      await adminLogout()
      setAuthenticated(false)
      setTasks([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.')
    } finally {
      setBusy(false)
    }
  }

  return <AppLayout>
    <div className="admin-page">
      <div className="page-heading">
        <Link to="/" className="back-link">← Home</Link>
        <h1>Admin</h1>
      </div>

      {checkingSession
        ? <p role="status" className="loading-card">Checking session…</p>
        : !authenticated
          ? <form className="admin-login setup-panel" onSubmit={submitLogin}>
            <h2>Sign in</h2>
            <label className="field-label" htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {error && <p className="inline-error" role="alert">{error}</p>}
            <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          : <>
            <div className="admin-toolbar">
              <h2>Tasks <span>({tasks.length})</span></h2>
              <button className="button button-quiet" type="button" onClick={logout} disabled={busy}>Sign out</button>
            </div>

            <form className="admin-add-form" onSubmit={submitNewTask}>
              <label className="field-label" htmlFor="new-task">Add task</label>
              <textarea id="new-task" value={newText} onChange={(event) => setNewText(event.target.value)} maxLength={200} rows={3} required />
              <div className="admin-form-footer">
                <span>{newText.length}/200</span>
                <button className="button button-primary" disabled={busy || !newText.trim()}>Add task</button>
              </div>
            </form>

            <label className="admin-search" htmlFor="task-search">Search tasks
              <input id="task-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task text" />
            </label>

            {error && <p className="inline-error" role="alert">{error}</p>}
            {notice && <p className="inline-note" role="status">{notice}</p>}
            <ul className="admin-task-list" aria-label="Tasks">
              {tasks.map((task) => <li key={task.id} className="admin-task-row">
                {editingId === task.id
                  ? <div className="admin-task-edit">
                    <label className="sr-only" htmlFor={'edit-task-' + task.id}>Edit task</label>
                    <textarea id={'edit-task-' + task.id} value={editingText} onChange={(event) => setEditingText(event.target.value)} maxLength={200} rows={3} />
                    <div className="admin-task-actions">
                      <button className="button button-primary button-small" type="button" disabled={busy || !editingText.trim()} onClick={() => void saveEdit(task)}>Save</button>
                      <button className="button button-quiet button-small" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                  : <>
                    <span className="admin-task-text">{task.text}</span>
                    <div className="admin-task-actions">
                      <button className="button button-quiet button-small" type="button" onClick={() => { setEditingId(task.id); setEditingText(task.text) }}>Edit</button>
                      <button className="button button-danger button-small" type="button" onClick={() => setDeleteTask(task)}>Delete</button>
                    </div>
                  </>}
              </li>)}
              {tasks.length === 0 && !error && <li className="admin-empty">{search ? 'No tasks match this search.' : 'No tasks yet.'}</li>}
            </ul>
          </>}
    </div>

    {deleteTask && <ConfirmDialog
      title="Delete this task?"
      description={'This removes “' + deleteTask.text + '” from future cards.'}
      confirmLabel="Delete task"
      cancelLabel="Cancel"
      onCancel={() => setDeleteTask(null)}
      onConfirm={() => void confirmDelete()}
    />}
  </AppLayout>
}
