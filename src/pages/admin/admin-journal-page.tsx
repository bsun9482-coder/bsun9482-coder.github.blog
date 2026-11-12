/* 日记管理（后台）。

为什么不学文章那样「列表页 + 新建页 + 编辑页」三个文件？
  文章有九个字段加一个 Markdown 大编辑器，塞不进一张卡；
  日记只有「正文 + 心情」两个字段，新建和编辑共用同一个输入区最省事 ——
  点某一条的「编辑」，下面那块输入区就带着它的内容等你改，
  改完点保存，回来还是这一页。少一次页面跳转，也少一个要懒加载的 chunk。

四种状态（和文章列表同一套）：
    加载中 / 出错（可重试）/ 空（说清是"确实没有"）/ 有数据（列表）
另外两个只在操作时出现：保存中的按钮文案、操作失败的红条。
*/

import { useEffect, useRef, useState, type FormEvent } from "react"
import { NotebookPen, RefreshCw } from "lucide-react"

import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { api } from "@/lib/api"
import { formatJournalDate, formatJournalWeekday } from "@/lib/journal-date"
import { fillTemplate } from "@/lib/text"
import type { ApiJournal, Journal, JournalInput } from "@/types/journal"

const admin = siteContent.ui.admin

type ListState =
  | { status: "loading" }
  | { status: "ready"; journals: Journal[] }
  | { status: "error"; message: string }

/* 后端原样 → 页面用的形状。这里只用到日期和心情，正文原样。
   为什么不复用 lib/api-journals.ts 的 toJournal？
   那份是「前台展示」的形状（mood 归一成 undefined），后台要原样（mood 可能是 null）。
   两边各自转换一次，比强行共用、再在两处做 if 判断更清楚。 */
function toRow(record: ApiJournal): Journal {
  const createdAt = record.created_at ?? ""
  const mood = (record.mood ?? "").trim()
  return {
    id: record.id,
    content: record.content ?? "",
    mood: mood === "" ? undefined : mood,
    date: createdAt.slice(0, 10),
    createdAt,
  }
}

export function AdminJournalPage() {
  useDocumentTitle(admin.journalTitle)

  const [state, setState] = useState<ListState>({ status: "loading" })
  const [reloadKey, setReloadKey] = useState(0)

  /* 输入区：新建和编辑共用。editing 不为空就表示「正在改这一条」。 */
  const [content, setContent] = useState("")
  const [mood, setMood] = useState("")
  const [editing, setEditing] = useState<Journal | null>(null)

  const [fieldError, setFieldError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Journal | null>(null)

  /* 点「编辑」时把输入区滚进视野：列表长了以后，表单在上面看不见，
     用户会以为点了没反应。 */
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    let cancelled = false

    /* 和文章列表一样，这里**不**在 effect 里同步 setState({status:"loading"})：
       初始就是 loading，重试时在点击回调里切。 */
    api
      .get<ApiJournal[]>("/api/journals")
      .then((records) => {
        if (cancelled) return
        setState({ status: "ready", journals: records.map(toRow) })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setState({
          status: "error",
          message:
            caught instanceof Error ? caught.message : admin.journalLoadFailed,
        })
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function refresh() {
    setActionError(null)
    setState({ status: "loading" })
    setReloadKey((key) => key + 1)
  }

  function startEdit(entry: Journal) {
    setEditing(entry)
    setContent(entry.content)
    setMood(entry.mood ?? "")
    setFieldError(null)
    setNotice(null)
    formRef.current?.scrollIntoView({ block: "start" })
  }

  function cancelEdit() {
    setEditing(null)
    setContent("")
    setMood("")
    setFieldError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    /* 前端先拦一次：内容为空就别白跑一趟网络。
       后端也会拦（schemas 里 min_length=1），两边都拦是有意的 ——
       前端拦是为了「快」，后端拦是为了「真」。 */
    const text = content.trim()
    if (!text) {
      setFieldError(admin.errJournalContent)
      return
    }

    setFieldError(null)
    setActionError(null)
    setSaving(true)

    const payload: JournalInput = { content: text, mood: mood.trim() || null }

    try {
      if (editing) {
        await api.put<ApiJournal>(`/api/journals/${editing.id}`, payload)
      } else {
        await api.post<ApiJournal>("/api/journals", payload)
      }

      setNotice(editing ? admin.journalUpdated : admin.journalSaved)
      setEditing(null)
      setContent("")
      setMood("")
      /* 保存后重新拉列表，而不是往本地数组里塞一条 ——
         前者和后端真实状态一定一致，后者只是「看起来对」。 */
      setState({ status: "loading" })
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : admin.journalLoadFailed
      )
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete

    setPendingDelete(null)
    setActionError(null)

    try {
      await api.delete(`/api/journals/${target.id}`)
      setNotice(admin.journalDeleted)
      /* 删的正好是正在编辑的那一条 → 顺手退出编辑态，别让表单指着一个不存在的 id */
      if (editing?.id === target.id) cancelEdit()
      setState({ status: "loading" })
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : admin.journalLoadFailed
      )
    }
  }

  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <PageHeader
        icon={NotebookPen}
        subtitle={admin.journalSubtitle}
        title={admin.journalTitle}
      />

      {notice && (
        <div
          className="flex items-start justify-between gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3"
          role="status"
        >
          <p className="text-sm leading-6 text-foreground">{notice}</p>
          <Button
            aria-label={admin.dismissNotice}
            onClick={() => setNotice(null)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <span aria-hidden="true">×</span>
          </Button>
        </div>
      )}

      {actionError && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-6 text-destructive"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {/* ---------------- 输入区（新建 / 编辑共用） ---------------- */}
      <form
        className="flex scroll-mt-20 flex-col gap-4 rounded-xl border border-border bg-card p-5"
        noValidate
        onSubmit={handleSubmit}
        ref={formRef}
      >
        {editing && (
          <p className="font-mono text-xs text-brand">
            {fillTemplate(admin.journalEditing, {
              date: formatJournalDate(editing.date),
            })}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="journal-content"
          >
            {admin.journalLabelContent}
          </label>
          {/* 用原生 textarea：日记只需要「多行输入 + 自动撑高」，
              没必要为这一个框引一个组件库（也没有现成的 ui/textarea）。 */}
          <textarea
            aria-invalid={Boolean(fieldError)}
            className="min-h-28 w-full resize-y rounded-[7px] border border-input bg-background px-2.5 py-2 text-base leading-7 transition-colors outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 aria-invalid:border-destructive/50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm"
            id="journal-content"
            onChange={(event) => setContent(event.target.value)}
            placeholder={admin.journalPlaceholderContent}
            value={content}
          />
          {fieldError ? (
            <p className="text-xs leading-5 text-destructive" role="alert">
              {fieldError}
            </p>
          ) : (
            <p className="text-xs leading-5 text-faint">{admin.journalHint}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="journal-mood"
          >
            {admin.journalLabelMood}
          </label>
          <Input
            id="journal-mood"
            maxLength={20}
            onChange={(event) => setMood(event.target.value)}
            placeholder={admin.journalPlaceholderMood}
            value={mood}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={saving} type="submit">
            {saving ? admin.journalSaving : admin.journalSave}
          </Button>
          {editing && (
            <Button onClick={cancelEdit} type="button" variant="outline">
              {admin.journalCancelEdit}
            </Button>
          )}
        </div>
      </form>

      {/* ---------------- 列表 ---------------- */}
      {state.status === "loading" && (
        <p aria-busy="true" className="font-mono text-xs text-faint">
          {admin.journalLoading}
        </p>
      )}

      {state.status === "error" && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm leading-6 text-destructive" role="alert">
            {admin.journalLoadFailed}：{state.message}
          </p>
          <Button onClick={refresh} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            {admin.retry}
          </Button>
        </div>
      )}

      {state.status === "ready" && state.journals.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <NotebookPen
            aria-hidden="true"
            className="mx-auto mb-4 size-8 text-muted-foreground"
          />
          <h2 className="text-base font-medium">{admin.journalEmpty}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {admin.journalEmptyDescription}
          </p>
        </div>
      )}

      {state.status === "ready" && state.journals.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="font-mono text-xs text-faint tabular-nums">
            {admin.journalCountPrefix} {state.journals.length}{" "}
            {admin.journalCountSuffix}
          </p>

          <ul className="flex flex-col gap-2">
            {state.journals.map((entry) => (
              <li
                className="rounded-xl border border-border bg-card px-4 py-3.5"
                key={entry.id}
              >
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="font-mono text-xs text-faint tabular-nums">
                    {formatJournalDate(entry.date)}
                  </span>
                  <span className="font-mono text-xs text-faint">
                    {formatJournalWeekday(entry.date)}
                  </span>
                  {entry.mood && (
                    <Badge
                      className="border-brand/25 bg-brand/10 text-brand"
                      variant="ghost"
                    >
                      {entry.mood}
                    </Badge>
                  )}
                  <div className="ml-auto flex gap-1">
                    <Button
                      onClick={() => startEdit(entry)}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      {admin.journalEdit}
                    </Button>
                    <Button
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(entry)}
                      size="xs"
                      type="button"
                      variant="ghost"
                    >
                      {admin.delete}
                    </Button>
                  </div>
                </div>
                {/* line-clamp-3：列表里只看前几行，全文去前台看 */}
                <p className="mt-2 line-clamp-3 text-sm leading-6 whitespace-pre-line text-foreground/85">
                  {entry.content}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        open={pendingDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{admin.deleteJournalTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDelete
              ? `${formatJournalDate(pendingDelete.date)} · ${admin.deleteJournalBody}`
              : ""}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{admin.deleteCancel}</AlertDialogCancel>
            <Button onClick={confirmDelete} type="button" variant="destructive">
              {admin.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Container>
  )
}
