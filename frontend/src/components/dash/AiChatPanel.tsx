import { useEffect, useRef, useState } from 'react'
import {
  X, Plus, ArrowUp, Loader2, ChevronDown, Wrench, History, MessageSquare, Trash2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { Markdown } from './Markdown'
import { ChatToolBlock } from './ChatToolBlock'

type Block = { tool: string; data: any }
type Msg = { role: 'user' | 'ai'; content: string; tools?: string[]; blocks?: Block[]; elapsed?: number; online?: boolean; degraded?: boolean }
type ChatMeta = { id: string; title: string; count: number; updated_at: string }

const DEFAULT_SUGGEST = [
  'Сколько у нас инцидентов?',
  'Какое событие самое опасное?',
  'Что делать с утечками?',
  'Покажи фишинг за сегодня',
]

const TOOL_LABEL: Record<string, string> = {
  get_stats: 'Сводка по организации',
  search_logs: 'Поиск по логам событий',
  list_incidents: 'Список инцидентов',
  get_incident: 'Детали инцидента',
  get_alerts: 'Список алертов',
  search_knowledge: 'Поиск в базе знаний',
  score_transaction: 'Скоринг транзакции',
  score_event: 'Скоринг события',
}
const toolLabel = (t: string) => TOOL_LABEL[t] || t
const plural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10, h = n % 100
  if (d === 1 && h !== 11) return one
  if (d >= 2 && d <= 4 && (h < 10 || h >= 20)) return few
  return many
}

export function AiChatPanel({ open, onClose, onNavigate }:
  { open: boolean; onClose: () => void; onNavigate?: (view: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState<{ tools: string[]; text: string; blocks: Block[] } | null>(null)
  const [suggest, setSuggest] = useState<string[]>(DEFAULT_SUGGEST)
  const [mode, setMode] = useState<{ online: boolean; provider?: string } | null>(null)
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set())
  const [chats, setChats] = useState<ChatMeta[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const bodyRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const liveRef = useRef<{ text: string; tools: string[]; blocks: Block[] }>({ text: '', tools: [], blocks: [] })

  // скроллим ТОЛЬКО внутренний список чата (scrollIntoView тянул и всё окно страницы)
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, streaming])
  useEffect(() => { if (open) loadChats() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => wsRef.current?.close(), [])

  const loadChats = async () => { try { setChats(await api.chats()) } catch {} }

  const openChat = async (id: string) => {
    try {
      const c = await api.chatHistory(id)
      setChatId(id)
      setMsgs((c.messages || []).map((mm: any) => ({
        role: mm.role === 'assistant' ? 'ai' : 'user',
        content: mm.content,
        tools: (mm.tools || []).map(toolLabel),
      })))
      setShowHistory(false)
    } catch {}
  }

  const newChat = () => {
    wsRef.current?.close()
    setMsgs([]); setChatId(null); setSuggest(DEFAULT_SUGGEST); setStreaming(null); setShowHistory(false)
  }

  const removeChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try { await api.deleteChat(id); if (id === chatId) newChat(); loadChats() } catch {}
  }

  const send = async (text?: string) => {
    const m = (text ?? input).trim()
    if (!m || streaming) return
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
    const history = msgs.map((x) => ({ role: x.role === 'ai' ? 'assistant' : 'user', content: x.content }))
    setMsgs((p) => [...p, { role: 'user', content: m }])
    liveRef.current = { text: '', tools: [], blocks: [] }
    setStreaming({ tools: [], text: '', blocks: [] })
    const pushStream = () => setStreaming({
      tools: liveRef.current.tools, text: liveRef.current.text, blocks: liveRef.current.blocks,
    })

    const t0 = performance.now()
    let finished = false
    const finalize = (extra?: any) => {
      if (finished) return
      finished = true
      const { text, tools, blocks } = liveRef.current
      const content = (text.trim() || extra?.errorText || 'Не удалось получить ответ.')
      const elapsed = extra?.elapsed ?? (performance.now() - t0) / 1000
      setMsgs((p) => [...p, { role: 'ai', content, tools, blocks, elapsed, online: extra?.online, degraded: extra?.degraded }])
      setStreaming(null)
      if (extra?.suggestions?.length) setSuggest(extra.suggestions)
      if (extra?.online != null) setMode({ online: extra.online, provider: extra.provider })
      loadChats()
    }

    const restFallback = async () => {
      try {
        const r: any = await api.chat(m, history)
        liveRef.current.text = r.reply || ''
        liveRef.current.tools = (r.trace || []).map((t: any) => toolLabel(t.tool))
        finalize({ suggestions: r.suggestions, online: r.online, provider: r.provider, degraded: true })
      } catch {
        finalize({ errorText: 'Ошибка соединения с ассистентом.' })
      }
    }

    let ws: WebSocket
    try { ws = new WebSocket(api.chatWsUrl()) } catch { return restFallback() }
    wsRef.current = ws
    ws.onopen = () => ws.send(JSON.stringify({ message: m, chat_id: chatId }))
    ws.onmessage = (e) => {
      let d: any
      try { d = JSON.parse(e.data) } catch { return }
      if (d.type === 'chat') { if (d.chat_id) setChatId(d.chat_id) }
      else if (d.type === 'tool') {
        liveRef.current.tools = [...liveRef.current.tools, toolLabel(d.tool)]
        pushStream()
      } else if (d.type === 'tool_result') {
        liveRef.current.blocks = [...liveRef.current.blocks, { tool: d.tool, data: d.data }]
        pushStream()
      } else if (d.type === 'delta') {
        liveRef.current.text += d.text
        pushStream()
      } else if (d.type === 'done') {
        finalize({ elapsed: d.elapsed, suggestions: d.suggestions, online: d.online, provider: d.provider })
        ws.close()
      } else if (d.type === 'error') {
        finalize({ errorText: 'Ошибка ассистента.' })
        ws.close()
      }
    }
    ws.onclose = () => { if (!finished) { liveRef.current.text ? finalize() : restFallback() } }
    ws.onerror = () => {}
  }

  const autogrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const t = e.target
    t.style.height = 'auto'
    t.style.height = `${Math.min(t.scrollHeight, 140)}px`
  }
  const toggleSteps = (i: number) =>
    setOpenSteps((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })

  const liveStep = streaming && !streaming.text
    ? (streaming.tools[streaming.tools.length - 1] || 'Анализирую данные…')
    : null

  return (
    <aside
      className={`sticky top-0 h-screen shrink-0 overflow-hidden border-l border-white/10 bg-[#141414] transition-[width] duration-300 ${open ? 'w-full sm:w-[400px] lg:w-[460px]' : 'w-0'}`}
      style={{ transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
      aria-hidden={!open}
    >
      <div className="flex h-full w-full flex-col sm:w-[400px] lg:w-[460px]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setShowHistory((v) => !v)} title="История чатов"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-white/5 ${showHistory ? 'text-brand' : 'text-white/50 hover:text-white'}`}>
              <History size={16} />
            </button>
            <span className="truncate text-sm font-medium">AI-аналитик</span>
            {mode && (
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-normal text-white/35"
                title={mode.online ? `LLM: ${mode.provider || 'online'}` : 'офлайн-режим (без LLM-ключа)'}>
                <span className={`h-1.5 w-1.5 rounded-full ${mode.online ? 'bg-emerald-400' : 'bg-white/30'}`} />
                {mode.online ? (mode.provider || 'LLM') : 'офлайн'}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={newChat} title="Новый чат" className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"><Plus size={16} /></button>
            <button onClick={onClose} title="Закрыть" className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-red-500/10 hover:text-red-400"><X size={16} /></button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          {showHistory ? (
            <div className="h-full overflow-y-auto p-2">
              <div className="px-2 py-1.5 text-xs uppercase tracking-wide text-white/35">История чатов</div>
              {chats.length === 0 && <div className="px-2 py-8 text-center text-sm text-white/40">Пока нет сохранённых чатов</div>}
              {chats.map((c) => (
                <div key={c.id} onClick={() => openChat(c.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/5 ${c.id === chatId ? 'bg-white/5' : ''}`}>
                  <MessageSquare size={14} className="shrink-0 text-white/35" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white/80">{c.title}</div>
                    <div className="text-[11px] text-white/35">{c.count} {plural(c.count, 'сообщение', 'сообщения', 'сообщений')}</div>
                  </div>
                  <button onClick={(e) => removeChat(c.id, e)} title="Удалить"
                    className="shrink-0 text-white/25 opacity-0 transition hover:text-red-400 group-hover:opacity-100"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ) : (
            <div ref={bodyRef} className="h-full overflow-y-auto px-4">
              {msgs.length === 0 && !streaming ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <h3 className="text-base font-semibold text-white">Чем помочь?</h3>
                  <p className="mt-1 max-w-[16rem] text-sm text-white/50">Спросите про инциденты, события и угрозы — отвечу по данным вашей организации.</p>
                  <div className="mt-6 flex w-full flex-col gap-2">
                    {DEFAULT_SUGGEST.map((s) => (
                      <button key={s} onClick={() => send(s)}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left text-sm text-white/70 transition hover:-translate-y-px hover:border-brand/50 hover:bg-brand/10 hover:text-brand">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  {msgs.map((m, i) => (
                    <div key={i} className="flex flex-col gap-1.5 border-t border-white/5 py-3.5 first:border-t-0">
                      <span className={m.role === 'ai' ? 'text-xs text-brand' : 'text-xs text-white/40'}>
                        {m.role === 'ai' ? 'AI-аналитик' : 'Вы'}
                      </span>
                      {m.role === 'user' ? (
                        <div className="w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl bg-white/[0.05] px-4 py-2.5 text-sm">{m.content}</div>
                      ) : (
                        <>
                          {m.degraded && (
                            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-300/90">
                              ⚠ Упрощённый ответ: WebSocket не подключился — диаграммы и стрим недоступны. Перезапусти бэкенд (см. ниже).
                            </div>
                          )}
                          {!!m.tools?.length && (
                            <div>
                              <button onClick={() => toggleSteps(i)}
                                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
                                <Wrench size={11} className="text-brand" /> {m.tools.length} {plural(m.tools.length, 'инструмент', 'инструмента', 'инструментов')}
                                {m.elapsed != null && <> · {m.elapsed.toFixed(1)}s</>}
                                <ChevronDown size={12} className={`transition ${openSteps.has(i) ? 'rotate-180' : ''}`} />
                              </button>
                              {openSteps.has(i) && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {m.tools.map((s, n) => (
                                    <span key={n} className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 text-xs text-brand/90">
                                      <Wrench size={11} /> {s}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {m.blocks?.map((b, n) => <ChatToolBlock key={n} tool={b.tool} data={b.data} onNavigate={onNavigate} />)}
                          <Markdown content={m.content} />
                        </>
                      )}
                    </div>
                  ))}

                  {streaming && (
                    <div className="flex flex-col gap-1.5 border-t border-white/5 py-3.5 first:border-t-0">
                      <span className="text-xs text-brand">AI-аналитик</span>
                      {streaming.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {streaming.tools.map((s, n) => (
                            <span key={n} className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 text-xs text-brand/90">
                              <Wrench size={11} /> {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {streaming.blocks.map((b, n) => <ChatToolBlock key={n} tool={b.tool} data={b.data} onNavigate={onNavigate} />)}
                      {liveStep ? (
                        <div className="flex items-center gap-2 text-xs text-brand">
                          <Loader2 size={13} className="animate-spin" /> {liveStep}
                        </div>
                      ) : (
                        <div>
                          <Markdown content={streaming.text} />
                          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-brand align-text-bottom" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 p-3">
          {msgs.length > 0 && suggest.length > 0 && !streaming && !showHistory && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {suggest.slice(0, 3).map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/55 hover:text-white">{s}</button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/40 py-1.5 pl-4 pr-1.5">
            <textarea ref={taRef} rows={1} value={input} onChange={autogrow}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Спросите о безопасности…"
              className="chat-no-ring max-h-36 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/35" />
            <button onClick={() => send()} disabled={!input.trim() || !!streaming}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-[#0a8ae6] disabled:opacity-30 active:scale-95">
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
