import { Fragment, type ReactNode } from 'react'

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)]+\))/g

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('`')) {
      nodes.push(
        <code key={key++} className="rounded bg-white/10 px-1 py-0.5 text-[12.5px] text-brand">
          {tok.slice(1, -1)}
        </code>,
      )
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={key++} className="font-semibold text-white">{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('*') || tok.startsWith('_')) {
      nodes.push(<em key={key++}>{tok.slice(1, -1)}</em>)
    } else {
      const lm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)
      nodes.push(
        <a key={key++} href={lm![2]} target="_blank" rel="noreferrer"
          className="text-brand underline underline-offset-2 hover:text-[#33adff]">
          {lm![1]}
        </a>,
      )
    }
    last = m.index + tok.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

const isUl = (l: string) => /^\s*[-*•]\s+/.test(l)
const isOl = (l: string) => /^\s*\d+[.)]\s+/.test(l)

export function Markdown({ content }: { content: string }) {
  const lines = (content || '').replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let k = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim().startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++ }
      i++
      blocks.push(
        <pre key={k++} className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[12.5px] leading-relaxed text-white/80">
          <code>{buf.join('\n')}</code>
        </pre>,
      )
      continue
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      const lvl = h[1].length
      const cls = lvl === 1 ? 'text-base font-semibold text-white'
        : lvl === 2 ? 'text-sm font-semibold text-white'
        : 'text-sm font-medium text-white/90'
      blocks.push(<div key={k++} className={cls}>{inline(h[2])}</div>)
      i++
      continue
    }

    if (isUl(line)) {
      const items: string[] = []
      while (i < lines.length && isUl(lines[i])) { items.push(lines[i].replace(/^\s*[-*•]\s+/, '')); i++ }
      blocks.push(
        <ul key={k++} className="list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-white/80 marker:text-white/35">
          {items.map((it, n) => <li key={n}>{inline(it)}</li>)}
        </ul>,
      )
      continue
    }

    if (isOl(line)) {
      const items: string[] = []
      while (i < lines.length && isOl(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++ }
      blocks.push(
        <ol key={k++} className="list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-white/80 marker:text-white/35">
          {items.map((it, n) => <li key={n}>{inline(it)}</li>)}
        </ol>,
      )
      continue
    }

    if (line.trim() === '') { i++; continue }

    const para: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !isUl(lines[i]) && !isOl(lines[i])
      && !/^#{1,3}\s+/.test(lines[i]) && !lines[i].trim().startsWith('```')) {
      para.push(lines[i]); i++
    }
    blocks.push(
      <p key={k++} className="text-[14px] leading-relaxed text-white/80">
        {para.map((l, n) => (
          <Fragment key={n}>{n > 0 && <br />}{inline(l)}</Fragment>
        ))}
      </p>,
    )
  }

  return <div className="space-y-2">{blocks}</div>
}
