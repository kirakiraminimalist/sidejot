'use client'

import { db, type Idea, type IdeaPriority } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarDays,
  Check,
  ChevronDown,
  Inbox,
  Leaf,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { FormEvent, useMemo, useRef, useState } from 'react'

type Filter = 'all' | 'today' | 'week' | 'later' | 'done'

const priorities: Record<IdeaPriority, { label: string; className: string }> = {
  high: { label: '重要', className: 'priority-high' },
  medium: { label: '一般', className: 'priority-medium' },
  low: { label: '以后再说', className: 'priority-low' },
}

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: '全部想法' },
  { value: 'today', label: '今天到期' },
  { value: 'week', label: '7 天内' },
  { value: 'later', label: '以后' },
  { value: 'done', label: '已完成' },
]

function dateKey(date: Date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function dueLabel(dueDate?: string) {
  if (!dueDate) return '没有日期'
  const today = dateKey(new Date())
  if (dueDate < today) return '已过期'
  if (dueDate === today) return '今天'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dueDate === dateKey(tomorrow)) return '明天'
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(
    new Date(`${dueDate}T12:00:00`),
  )
}

export function IdeaBoard() {
  const ideas = useLiveQuery(() => db.ideas.orderBy('createdAt').reverse().toArray(), []) ?? []
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<IdeaPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const filtered = useMemo(() => {
    const today = dateKey(new Date())
    const week = new Date()
    week.setDate(week.getDate() + 7)
    const weekKey = dateKey(week)
    return ideas.filter((idea) => {
      if (query && !idea.content.toLowerCase().includes(query.toLowerCase())) return false
      if (filter === 'done') return idea.completed
      if (idea.completed) return false
      if (filter === 'today') return idea.dueDate === today
      if (filter === 'week') return !!idea.dueDate && idea.dueDate >= today && idea.dueDate <= weekKey
      if (filter === 'later') return !idea.dueDate || idea.dueDate > weekKey
      return true
    })
  }, [ideas, filter, query])

  const openCount = ideas.filter((idea) => !idea.completed).length

  async function addIdea(event: FormEvent) {
    event.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    const now = new Date()
    await db.ideas.add({
      content: trimmed,
      priority,
      dueDate: dueDate || undefined,
      completed: false,
      createdAt: now,
      updatedAt: now,
    })
    setContent('')
    setDueDate('')
    inputRef.current?.focus()
  }

  async function toggleIdea(idea: Idea) {
    if (!idea.id) return
    await db.ideas.update(idea.id, { completed: !idea.completed, updatedAt: new Date() })
  }

  async function saveEdit(idea: Idea) {
    if (!idea.id || !editingText.trim()) return
    await db.ideas.update(idea.id, { content: editingText.trim(), updatedAt: new Date() })
    setEditingId(null)
  }

  return (
    <main className="idea-shell">
      <div className="ambient-leaf ambient-leaf-one" aria-hidden="true" />
      <div className="ambient-leaf ambient-leaf-two" aria-hidden="true" />

      <header className="idea-header">
        <div className="brand-mark" aria-hidden="true"><Leaf size={20} strokeWidth={2.4} /></div>
        <div>
          <h1>念头</h1>
          <p>先放下来，不必现在想清楚。</p>
        </div>
        <div className="open-count"><strong>{openCount}</strong><span>个待处理</span></div>
      </header>

      <section className="capture-panel" aria-labelledby="capture-title">
        <h2 id="capture-title">你刚刚想到了什么？</h2>
        <form onSubmit={addIdea}>
          <textarea
            ref={inputRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') addIdea(event)
            }}
            placeholder="例如：联系导师确认论文方向……"
            aria-label="记录一个想法"
            rows={2}
          />
          <div className="capture-actions">
            <label className="select-control">
              <span className={`priority-dot ${priorities[priority].className}`} />
              <select value={priority} onChange={(event) => setPriority(event.target.value as IdeaPriority)} aria-label="优先级">
                <option value="high">重要</option>
                <option value="medium">一般</option>
                <option value="low">以后再说</option>
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </label>
            <label className="date-control">
              <CalendarDays size={17} aria-hidden="true" />
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="到期日期" />
            </label>
            <button className="add-button" type="submit" disabled={!content.trim()}>
              <Plus size={19} /> 收下这个想法
            </button>
          </div>
        </form>
        <p className="shortcut-hint">按 ⌘ + Enter 也可以保存</p>
      </section>

      <section className="ideas-section" aria-labelledby="ideas-title">
        <div className="ideas-toolbar">
          <div>
            <h2 id="ideas-title">你的想法</h2>
            <p>只看现在需要关注的。</p>
          </div>
          <label className="search-box">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" aria-label="搜索想法" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="清除搜索"><X size={15} /></button>}
          </label>
        </div>

        <div className="filter-row" role="group" aria-label="按日期筛选">
          {filters.map((item) => (
            <button key={item.value} type="button" className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="idea-list" aria-live="polite">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Inbox size={28} strokeWidth={1.6} />
              <h3>{query ? '没有找到相符的想法' : '这里很安静'}</h3>
              <p>{query ? '换一个关键词试试。' : '想到什么，就先放到上面。'}</p>
            </div>
          ) : filtered.map((idea) => (
            <article className={`idea-row ${idea.completed ? 'completed' : ''}`} key={idea.id}>
              <button className="check-button" type="button" onClick={() => toggleIdea(idea)} aria-label={idea.completed ? '标记为未完成' : '标记为完成'}>
                {idea.completed && <Check size={15} />}
              </button>
              <div className="idea-copy">
                {editingId === idea.id ? (
                  <input className="edit-input" autoFocus value={editingText} onChange={(event) => setEditingText(event.target.value)} onBlur={() => saveEdit(idea)} onKeyDown={(event) => event.key === 'Enter' && saveEdit(idea)} />
                ) : <h3>{idea.content}</h3>}
                <div className="idea-meta">
                  <span className={`priority-pill ${priorities[idea.priority].className}`}><i />{priorities[idea.priority].label}</span>
                  <span className={idea.dueDate && idea.dueDate < dateKey(new Date()) && !idea.completed ? 'overdue' : ''}><CalendarDays size={14} />{dueLabel(idea.dueDate)}</span>
                </div>
              </div>
              <div className="row-actions">
                <button type="button" onClick={() => { setEditingId(idea.id ?? null); setEditingText(idea.content) }} aria-label="编辑想法"><Pencil size={16} /></button>
                <button type="button" onClick={() => idea.id && db.ideas.delete(idea.id)} aria-label="删除想法"><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
