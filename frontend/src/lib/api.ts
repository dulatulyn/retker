const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'
const TOKEN_KEY = 'retker_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function req(path: string, opts: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  }
  const t = getToken()
  if (t) headers.Authorization = `Bearer ${t}`
  const res = await fetch(API_BASE + path, { ...opts, headers })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = j.detail || msg
    } catch {}
    throw new Error(msg)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('json') ? res.json() : res.text()
}

export const api = {
  login: (username: string, password: string) =>
    req('/v1/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username: string, password: string, org_name: string) =>
    req('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, org_name }),
    }),
  me: () => req('/v1/auth/me'),
  overview: () => req('/v1/overview'),
  events: (limit = 60) => req(`/v1/events?limit=${limit}`),
  incidents: () => req('/v1/incidents'),
  incident: (id: string) => req(`/v1/incidents/${id}`),
  block: (id: string) => req(`/v1/incidents/${id}/block`, { method: 'POST' }),
  query: (q: string) => req('/v1/query', { method: 'POST', body: JSON.stringify({ q }) }),
  search: (q: string, limit = 25) =>
    req(`/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  report: (id: string) => req(`/v1/reports/${id}`),
  replay: () => req('/v1/replay', { method: 'POST' }),
  timeseries: (range: string) => req(`/v1/timeseries?range=${range}`),
  chat: (message: string, history: any[] = []) =>
    req('/v1/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),
  bulkIncidents: (ids: string[], action: 'block' | 'close') =>
    req('/v1/incidents/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) }),
  fromEvents: (event_ids: string[], title?: string) =>
    req('/v1/incidents/from_events', { method: 'POST', body: JSON.stringify({ event_ids, title }) }),
  sources: () => req('/v1/sources'),
  createSource: (name: string, scope: string) =>
    req('/v1/sources', { method: 'POST', body: JSON.stringify({ name, scope }) }),
  deleteSource: (id: string) => req(`/v1/sources/${id}`, { method: 'DELETE' }),
  streamUrl: () => `${API_BASE}/v1/stream?token=${getToken() || ''}`,
  chats: () => req('/v1/chats'),
  chatHistory: (id: string) => req(`/v1/chats/${id}`),
  createChat: () => req('/v1/chats', { method: 'POST' }),
  deleteChat: (id: string) => req(`/v1/chats/${id}`, { method: 'DELETE' }),
  chatWsUrl: () => `${API_BASE.replace(/^http/, 'ws')}/v1/chat/ws?token=${getToken() || ''}`,
  demoToken: (): Promise<{ token: string }> => req('/v1/chat/demo-token'),
  chatWsUrlWith: (token: string) => `${API_BASE.replace(/^http/, 'ws')}/v1/chat/ws?token=${token}`,
}

export { API_BASE }
