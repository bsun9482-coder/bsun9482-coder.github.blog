/* 新建 / 编辑文章 —— 同一个表单，两种模式。

为什么新建和编辑共用一个组件？
  这两件事的界面长得几乎一样（九个字段 + 一个编辑器），只是标题文案不同、
  保存时调的方法不同（POST 还是 PUT）。写两份的话，以后加一个字段要改两处，
  迟早会漏掉一处。所以用路由参数区分：
      /admin/posts/new         → 新建（没有 slug 参数）
      /admin/posts/:slug/edit  → 编辑（有 slug 参数，先拉详情回填）

三条容易踩的坑，这里都处理了：
  1. slug 自动生成：改标题时顺手同步，但你一旦**手动改过** slug 就不再覆盖
     （否则你精心起的名字会被下一个字冲掉）
  2. 中文标题生成不出英文 slug → 输入框下面给出明确提示，而不是让你对着空字段发呆
  3. 保存成功后回列表时带一条提示：新手最容易犯嘀咕的就是「我点了，到底存没存」
*/

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { PenLine } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"

import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { api, type ApiError } from "@/lib/api"
import { SLUG_PATTERN, slugify } from "@/lib/slug"
import { fillTemplate } from "@/lib/text"
import { cn } from "@/lib/utils"
import type { AdminPost, AdminPostInput } from "@/types/admin"

const admin = siteContent.ui.admin

/* 表单里的值全是字符串 —— 包括数字和日期。
   为什么：input 的值本来就是字符串，先存字符串、提交时再转，
   比「边输边转数字」好处理（否则用户删到空的时候会变成 NaN 或 0）。 */
type FormValues = {
  title: string
  slug: string
  description: string
  category: string
  tagsText: string
  content: string
  readingMinutes: string
  publishedAt: string
  isDraft: boolean
}

const EMPTY_FORM: FormValues = {
  title: "",
  slug: "",
  description: "",
  category: "",
  tagsText: "",
  content: "",
  readingMinutes: "1",
  publishedAt: "",
  isDraft: false,
}

/* 只存「有问题的字段」，没问题的字段不占键 ——
   这样 Object.keys(errors).length > 0 就等于「有错，别提交」。 */
type FieldErrors = {
  title?: string
  slug?: string
  content?: string
  readingMinutes?: string
}

/* 标签输入框是给人用的（"python, 入门"），后端要的是数组（["python","入门"]）。
   中英文逗号都认 —— 中文输入法下打出来的是「，」，不认它会被骂。 */
function parseTags(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of text.split(/[,，]/)) {
    const tag = raw.trim()
    if (tag) seen.add(tag)
  }
  return [...seen]
}

/* 从 API 抛出来的错误里安全地取状态码。
   catch 到的东西可能是任何类型，不能直接读 .status。 */
function statusOf(error: unknown): number | null {
  return error instanceof Error && "status" in error
    ? (error as ApiError).status
    : null
}

function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-xs font-medium text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      {children}
      {/* 有错的时候只显示错误，不再显示提示 —— 两行小字挤在一起没人看 */}
      {error ? (
        <p className="text-xs leading-5 text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs leading-5 text-faint">{hint}</p>
      )}
    </div>
  )
}

export function AdminPostFormPage() {
  const { slug: slugParam } = useParams<{ slug?: string }>()
  const isEdit = Boolean(slugParam)
  const navigate = useNavigate()

  useDocumentTitle(isEdit ? admin.formTitleEdit : admin.formTitleNew)

  const [form, setForm] = useState<FormValues>(EMPTY_FORM)
  /* 用户有没有手动碰过 slug。碰过之后就不再跟着标题自动变。 */
  const [slugTouched, setSlugTouched] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)

  /* 编辑模式：进来先把文章读出来填进表单。 */
  useEffect(() => {
    if (!slugParam) return
    let cancelled = false

    api
      .get<AdminPost>(`/api/posts/${encodeURIComponent(slugParam)}`)
      .then((post) => {
        if (cancelled) return
        setForm({
          title: post.title,
          slug: post.slug,
          description: post.description,
          category: post.category,
          tagsText: post.tags.join(", "),
          content: post.content,
          readingMinutes: String(post.reading_minutes),
          publishedAt: post.published_at ?? "",
          isDraft: post.is_draft,
        })
        /* 已有文章的 slug 是定好的（可能已经在别处被引用），
           绝不能因为你改个标题就把它换掉。 */
        setSlugTouched(true)
        setLoading(false)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setLoadError(
          caught instanceof Error ? caught.message : admin.loadPostFailed
        )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slugParam])

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === "title" && !slugTouched) {
        next.slug = slugify(String(value))
      }
      return next
    })
  }

  function validate(values: FormValues): FieldErrors {
    const found: FieldErrors = {}

    if (!values.title.trim()) found.title = admin.errTitle

    const slug = values.slug.trim()
    if (!slug) found.slug = admin.errSlug
    else if (!SLUG_PATTERN.test(slug)) found.slug = admin.errSlugFormat

    if (!values.content.trim()) found.content = admin.errContent

    const minutes = Number(values.readingMinutes)
    if (!Number.isInteger(minutes) || minutes < 1) {
      found.readingMinutes = admin.errReading
    }

    return found
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault() // 拦下浏览器默认的「整页提交」，否则页面会刷新、状态全丢
    if (saving) return

    const found = validate(form)
    setErrors(found)
    setSubmitError(null)
    /* 有错就原地停下，一个请求都不发。
       这就是「前端校验」的意义：用户不用等网络往返才知道自己漏填了标题。 */
    if (Object.keys(found).length > 0) return

    const payload: AdminPostInput = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      content: form.content,
      /* 分类留空就给默认值，避免列表里出现一格空白 */
      category: form.category.trim() || admin.defaultCategory,
      tags: parseTags(form.tagsText),
      reading_minutes: Number(form.readingMinutes),
      is_draft: form.isDraft,
      /* 日期留空要传 null：后端那一列允许为空，但不接受空字符串 */
      published_at: form.publishedAt || null,
    }

    setSaving(true)
    try {
      if (isEdit && slugParam) {
        await api.put<AdminPost>(
          `/api/posts/${encodeURIComponent(slugParam)}`,
          payload
        )
      } else {
        await api.post<AdminPost>("/api/posts", payload)
      }

      const notice = isEdit
        ? fillTemplate(admin.savedUpdated, { title: payload.title })
        : fillTemplate(form.isDraft ? admin.savedDraft : admin.savedPublished, {
            title: payload.title,
          })

      /* replace: true —— 保存后不该还能按「后退」回到这个表单，
         否则很容易在旧表单上又点一次保存，产生重复操作。 */
      navigate("/admin", { replace: true, state: { notice } })
    } catch (caught) {
      /* slug 撞车（409）单独处理：把话说到 slug 那个输入框下面，
         比在页面底部飘一句「提交失败」有用得多。 */
      if (statusOf(caught) === 409) {
        setErrors({
          slug: caught instanceof Error ? caught.message : admin.errSlugFormat,
        })
      }
      setSubmitError(
        caught instanceof Error ? caught.message : admin.loadPostFailed
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          icon={PenLine}
          subtitle={isEdit ? admin.formSubtitleEdit : admin.formSubtitleNew}
          title={isEdit ? admin.formTitleEdit : admin.formTitleNew}
        />
        <Button asChild size="sm" variant="outline">
          <Link to="/admin">{admin.backToList}</Link>
        </Button>
      </div>

      {loading && (
        <p aria-busy="true" className="font-mono text-xs text-faint">
          {admin.loadingPost}
        </p>
      )}

      {loadError && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm leading-6 text-destructive" role="alert">
            {admin.loadPostFailed}：{loadError}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin">{admin.backToList}</Link>
          </Button>
        </div>
      )}

      {!loading && !loadError && (
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              className="sm:col-span-2"
              error={errors.title}
              id="admin-title"
              label={admin.labelTitle}
            >
              <Input
                aria-invalid={Boolean(errors.title)}
                id="admin-title"
                onChange={(event) => update("title", event.target.value)}
                placeholder={admin.placeholderTitle}
                value={form.title}
              />
            </Field>

            <Field
              error={errors.slug}
              hint={
                /* 标题有内容但生成不出 slug → 说明标题里没有英文，得手填 */
                form.title.trim() && !form.slug.trim()
                  ? admin.hintSlugChinese
                  : admin.hintSlug
              }
              id="admin-slug"
              label={admin.labelSlug}
            >
              <Input
                aria-invalid={Boolean(errors.slug)}
                className="font-mono text-xs"
                id="admin-slug"
                onChange={(event) => {
                  setSlugTouched(true) // 手动改过，之后不再被标题覆盖
                  update("slug", event.target.value)
                }}
                placeholder={admin.placeholderSlug}
                value={form.slug}
              />
            </Field>

            <Field id="admin-category" label={admin.labelCategory}>
              <Input
                id="admin-category"
                onChange={(event) => update("category", event.target.value)}
                placeholder={admin.placeholderCategory}
                value={form.category}
              />
            </Field>

            <Field
              className="sm:col-span-2"
              id="admin-description"
              label={admin.labelDescription}
            >
              <Input
                id="admin-description"
                onChange={(event) => update("description", event.target.value)}
                placeholder={admin.placeholderDescription}
                value={form.description}
              />
            </Field>

            <Field
              hint={admin.hintTags}
              id="admin-tags"
              label={admin.labelTags}
            >
              <Input
                id="admin-tags"
                onChange={(event) => update("tagsText", event.target.value)}
                placeholder={admin.placeholderTags}
                value={form.tagsText}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field
                error={errors.readingMinutes}
                id="admin-reading"
                label={admin.labelReadingMinutes}
              >
                <Input
                  aria-invalid={Boolean(errors.readingMinutes)}
                  id="admin-reading"
                  min={1}
                  onChange={(event) =>
                    update("readingMinutes", event.target.value)
                  }
                  type="number"
                  value={form.readingMinutes}
                />
              </Field>

              <Field id="admin-published" label={admin.labelPublishedAt}>
                <Input
                  id="admin-published"
                  onChange={(event) =>
                    update("publishedAt", event.target.value)
                  }
                  type="date"
                  value={form.publishedAt}
                />
              </Field>
            </div>

            {/* 草稿开关：用 role="switch" 的按钮而不是 checkbox ——
                它在屏幕阅读器里会被念成「开关，已关闭/已打开」，比复选框贴切。 */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">
                {admin.labelIsDraft}
              </span>
              <div className="flex items-center gap-3">
                <button
                  aria-checked={form.isDraft}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/25",
                    form.isDraft
                      ? "border-brand bg-brand"
                      : "border-border bg-secondary"
                  )}
                  onClick={() => update("isDraft", !form.isDraft)}
                  role="switch"
                  type="button"
                >
                  <span
                    className={cn(
                      "absolute top-1 left-1 size-4 rounded-full bg-white transition-transform duration-200",
                      form.isDraft && "translate-x-5"
                    )}
                  />
                  <span className="sr-only">{admin.labelIsDraft}</span>
                </button>
                <p className="text-xs leading-5 text-faint">
                  {admin.hintDraft}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">
                {admin.labelContent}
              </span>
              {/* 编辑器和「上传图片」的联动都收在 MarkdownEditor 里：
                  工具栏那个图片按钮、拖拽、插入位置、上传状态提示。
                  这里只管「值变了告诉我一声」。 */}
              <MarkdownEditor
                onChange={(next) => update("content", next)}
                placeholder={admin.hintContent}
                value={form.content}
              />
              {errors.content ? (
                <p className="text-xs leading-5 text-destructive" role="alert">
                  {errors.content}
                </p>
              ) : (
                <p className="text-xs leading-5 text-faint">
                  {/* 插图的入口在工具栏最右边（一个小图片图标），光有 tooltip 不够显眼，
                      所以在提示行里再说一遍。中间那个「·」是分隔符，别删。 */}
                  {admin.hintContent} · {admin.imageUploadHint}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <Button disabled={saving} type="submit">
              {saving ? admin.saving : admin.save}
            </Button>
            {/* asChild 会把这个 <a> 当成按钮渲染，所以不能带 type ——
                type 是表单按钮的属性，落到链接上属于无效属性。 */}
            <Button asChild variant="outline">
              <Link to="/admin">{admin.cancel}</Link>
            </Button>
            {submitError && (
              <p className="text-xs leading-5 text-destructive" role="alert">
                {submitError}
              </p>
            )}
          </div>
        </form>
      )}
    </Container>
  )
}
