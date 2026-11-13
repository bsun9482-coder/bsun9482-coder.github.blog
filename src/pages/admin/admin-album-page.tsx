/* 相册管理（后台）。

和日记页一样是「单页搞定」：上传区 + 列表都在这一页，不做新建/编辑两个页面 ——
照片的「编辑」只改三个小字段（标题 / 分类 / 排序号），开一个新页面不划算，
而且用户改完想看下一张，跳来跳去很烦。

三件事要理解清楚：

① 上传是**真文件**，不是 JSON。
   走 api.upload → FormData，Content-Type 由浏览器自己生成（手写会丢 boundary，后端 400）。
   一次选多张时**串行**上传，不并发：手机拍的原图一张就 3–4 MB，
   五张一起发会把上行带宽挤爆，前端还看不到任何进度。

② 分类是自由文本，不是枚举。
   前台筛选项是「数据里出现过的分类」，所以这里用 datalist：既能选现有的，
   也能直接敲一个新的（敲「宠物」就等于新建分类）。后端默认「日常」。

③ 每一次写操作结束后都**重新拉列表**，不往本地数组里塞/改。
   本地改看着更快，但和服务器真实状态一旦不一致（比如排序号被后端夹到 9999），
   页面上显示的就不是真的 —— 列表是唯一的真相来源。

四种状态（和文章、日记同一套）：加载中 / 出错可重试 / 空 / 有数据。
另外操作时出现：上传进度、保存中、操作失败的红条、成功的蓝条。
*/

import { useEffect, useRef, useState, type FormEvent } from "react"
import { ImagesIcon, RefreshCw, Upload } from "lucide-react"

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
import {
  deletePhoto,
  getPhotos,
  updatePhoto,
  uploadPhoto,
  type Photo,
} from "@/lib/api-photos"
import { fillTemplate } from "@/lib/text"

const admin = siteContent.ui.admin
const album = siteContent.ui.album

type ListState =
  | { status: "loading" }
  | { status: "ready"; photos: Photo[] }
  | { status: "error"; message: string }

export function AdminAlbumPage() {
  useDocumentTitle(admin.albumTitle)

  const [state, setState] = useState<ListState>({ status: "loading" })
  const [reloadKey, setReloadKey] = useState(0)

  /* 筛选是本地状态：只是「眼睛想看哪一批」，不改任何数据 */
  const [filter, setFilter] = useState("")

  /* 上传区：分类跟着上一次的选择走，连着传同一批照片时不用每次改 */
  /* 显式写 <string>：不写的话 TS 从初始值推出字面量类型 "日常"，
     用户在输入框里敲「宠物」时 setState 就会报类型不兼容。 */
  const [uploadCategory, setUploadCategory] = useState<string>(
    album.categories.daily
  )
  const [uploading, setUploading] = useState<{
    done: number
    total: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* 行内编辑：一次只改一张 */
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editSort, setEditSort] = useState("")

  const [fieldError, setFieldError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Photo | null>(null)

  useEffect(() => {
    let cancelled = false

    getPhotos()
      .then((photos) => {
        if (!cancelled) setState({ status: "ready", photos })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setState({
          status: "error",
          message:
            caught instanceof Error ? caught.message : admin.albumLoadFailed,
        })
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function refresh() {
    setState({ status: "loading" })
    setReloadKey((key) => key + 1)
  }

  /* ---------------- 上传 ---------------- */
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const list = Array.from(files)
    const category = uploadCategory.trim() || album.categories.daily
    const failures: string[] = []
    let uploaded = 0

    setActionError(null)
    setNotice(null)
    setUploading({ done: 0, total: list.length })

    /* for...of + await 而不是 Promise.all：见文件头注释①，串行是为了不挤爆上行带宽，
       也让「已传 3 / 共 5」这个进度是真的 */
    for (const [index, file] of list.entries()) {
      try {
        await uploadPhoto(file, { title: "", category, sortOrder: 0 })
        uploaded += 1
      } catch (caught: unknown) {
        const reason = caught instanceof Error ? caught.message : "上传失败"
        failures.push(`${file.name}：${reason}`)
      }
      setUploading({ done: index + 1, total: list.length })
    }

    setUploading(null)
    /* 选完立刻清空 input.value：否则同一个文件再选一次不会触发 change 事件 */
    if (fileInputRef.current) fileInputRef.current.value = ""

    if (uploaded > 0) {
      setNotice(fillTemplate(admin.albumUploaded, { count: uploaded }))
    }
    if (failures.length > 0) {
      setActionError(failures.join("；"))
    }
    refresh()
  }

  /* ---------------- 改标题 / 分类 / 排序 ---------------- */
  function startEdit(photo: Photo) {
    setEditingId(photo.id)
    setEditTitle(photo.title)
    setEditCategory(photo.category)
    setEditSort(String(photo.sortOrder))
    setFieldError(null)
    setNotice(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setFieldError(null)
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingId === null || saving) return

    /* 排序号在界面上是文本框（允许先删空再打字），所以这里自己判一次。
       前端判是为了快，后端 schema 还有 ge=0 / le=9999 兜底（那个才是真拦截）。 */
    const sortText = editSort.trim()
    const sortValue = sortText === "" ? 0 : Number(sortText)
    if (!Number.isInteger(sortValue) || sortValue < 0 || sortValue > 9999) {
      setFieldError(admin.errAlbumSort)
      return
    }

    setFieldError(null)
    setActionError(null)
    setSaving(true)

    try {
      await updatePhoto(editingId, {
        title: editTitle.trim(),
        category: editCategory.trim() || album.categories.daily,
        sortOrder: sortValue,
      })
      setNotice(admin.albumSaved)
      setEditingId(null)
      refresh()
    } catch (caught: unknown) {
      setActionError(
        caught instanceof Error ? caught.message : admin.albumLoadFailed
      )
    } finally {
      setSaving(false)
    }
  }

  /* ---------------- 删 ---------------- */
  async function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete

    setPendingDelete(null)
    setActionError(null)

    try {
      await deletePhoto(target.id)
      setNotice(admin.albumDeleted)
      if (editingId === target.id) setEditingId(null)
      refresh()
    } catch (caught: unknown) {
      setActionError(
        caught instanceof Error ? caught.message : admin.albumLoadFailed
      )
    }
  }

  /* ---------------- 派生数据 ---------------- */
  const photos = state.status === "ready" ? state.photos : []
  const categories = [
    ...new Set(photos.map((photo) => photo.category).filter(Boolean)),
  ].sort()
  const visible = filter
    ? photos.filter((photo) => photo.category === filter)
    : photos
  const busy = uploading !== null

  const filters = [
    { id: "", label: album.categories.all },
    ...categories.map((name) => ({ id: name, label: name })),
  ]

  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <PageHeader
        icon={ImagesIcon}
        subtitle={admin.albumSubtitle}
        title={admin.albumTitle}
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

      {/* ---------------- 上传区 ---------------- */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="album-upload-category"
            >
              {admin.albumCategoryLabel}
            </label>
            {/* datalist：既能选已存在的分类，也能直接敲一个新的 */}
            <Input
              className="sm:w-48"
              disabled={busy}
              id="album-upload-category"
              list="album-category-options"
              maxLength={50}
              onChange={(event) => setUploadCategory(event.target.value)}
              value={uploadCategory}
            />
            <datalist id="album-category-options">
              {categories.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          {/* 真 input 藏起来，用 Button 代点：原生 file 控件在各浏览器里长得都不一样，
              也不能跟随站点配色 */}
          <input
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            id="album-file-input"
            multiple
            onChange={(event) => void handleFiles(event.target.files)}
            ref={fileInputRef}
            type="file"
          />
          <Button
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Upload aria-hidden="true" />
            {busy ? admin.albumUploading : admin.albumUploadCta}
          </Button>

          {uploading && (
            <p
              aria-live="polite"
              className="font-mono text-xs text-muted-foreground tabular-nums"
            >
              {uploading.done} / {uploading.total}
            </p>
          )}
        </div>

        <p className="text-xs leading-5 text-faint">{admin.albumUploadHint}</p>
        <p className="text-xs leading-5 text-faint">
          {admin.albumCategoryHint}
        </p>
      </section>

      {/* ---------------- 筛选 ---------------- */}
      <div
        aria-label={admin.albumFilterLabel}
        className="flex flex-wrap gap-2"
        role="group"
      >
        {filters.map((item) => {
          const active = filter === item.id
          return (
            <button
              aria-pressed={active}
              className={`h-9 rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                active
                  ? "border-brand bg-brand font-medium text-white"
                  : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground"
              }`}
              key={item.id || "all"}
              onClick={() => setFilter(item.id)}
              type="button"
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* ---------------- 列表 ---------------- */}
      {state.status === "loading" && (
        <p aria-busy="true" className="font-mono text-xs text-faint">
          {admin.albumLoading}
        </p>
      )}

      {state.status === "error" && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm leading-6 text-destructive" role="alert">
            {admin.albumLoadFailed}：{state.message}
          </p>
          <Button onClick={refresh} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            {admin.retry}
          </Button>
        </div>
      )}

      {state.status === "ready" && photos.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <ImagesIcon
            aria-hidden="true"
            className="mx-auto mb-4 size-8 text-muted-foreground"
          />
          <h2 className="text-base font-medium">{admin.albumEmpty}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {admin.albumEmptyDescription}
          </p>
        </div>
      )}

      {state.status === "ready" && photos.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="font-mono text-xs text-faint tabular-nums">
            {admin.albumCountPrefix} {photos.length} {album.countSuffix}
          </p>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            {visible.map((photo) => {
              const editing = editingId === photo.id
              return (
                <li
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5"
                  key={photo.id}
                >
                  <img
                    alt={photo.title}
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                    decoding="async"
                    loading="lazy"
                    src={photo.url}
                  />

                  {editing ? (
                    <form className="flex flex-col gap-2" onSubmit={handleSave}>
                      <Input
                        aria-label={admin.albumEditTitle}
                        maxLength={200}
                        onChange={(event) => setEditTitle(event.target.value)}
                        placeholder={admin.albumEditTitlePlaceholder}
                        value={editTitle}
                      />
                      <Input
                        aria-label={admin.albumCategoryLabel}
                        list="album-category-options"
                        maxLength={50}
                        onChange={(event) =>
                          setEditCategory(event.target.value)
                        }
                        value={editCategory}
                      />
                      <Input
                        aria-invalid={Boolean(fieldError)}
                        aria-label={admin.albumSortLabel}
                        inputMode="numeric"
                        onChange={(event) => setEditSort(event.target.value)}
                        value={editSort}
                      />
                      {fieldError && (
                        <p
                          className="text-xs leading-5 text-destructive"
                          role="alert"
                        >
                          {fieldError}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <Button disabled={saving} size="xs" type="submit">
                          {saving ? admin.albumSaving : admin.albumSave}
                        </Button>
                        <Button
                          onClick={cancelEdit}
                          size="xs"
                          type="button"
                          variant="outline"
                        >
                          {admin.journalCancelEdit}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm text-foreground">
                          {photo.title || admin.albumUntitled}
                        </p>
                        <Badge
                          className="shrink-0 border-brand/25 bg-brand/10 text-brand"
                          variant="ghost"
                        >
                          {photo.category}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-faint tabular-nums">
                          #{photo.sortOrder} · {photo.createdAt.slice(0, 10)}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            onClick={() => startEdit(photo)}
                            size="xs"
                            type="button"
                            variant="outline"
                          >
                            {admin.albumEdit}
                          </Button>
                          <Button
                            className="text-destructive hover:text-destructive"
                            onClick={() => setPendingDelete(photo)}
                            size="xs"
                            type="button"
                            variant="ghost"
                          >
                            {admin.delete}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>

          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {album.emptyFiltered}
            </p>
          )}
        </section>
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        open={pendingDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{admin.deleteAlbumTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDelete
              ? `${pendingDelete.title || `#${pendingDelete.id}`} · ${admin.deleteAlbumBody}`
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
