/* 带「上传图片」的 Markdown 编辑器 —— 把 MDEditor 包一层。

为什么不干脆把上传逻辑写进 admin-post-form-page.tsx？
  那个文件已经 488 行了（九个字段 + 校验 + 保存）。再塞 150 行上传逻辑进去，
  以后想改「上传」这件事得先在一堆表单代码里找。所以拆成两层：
      markdown-editor.tsx  —— 只管「写 Markdown」和「插图」
      admin-post-form-page —— 只管「表单字段 + 保存」

三条和这个组件绑定的关键点：

① 按钮挂在 extraCommands（工具栏右侧），不是 commands
   commands 是**左侧**那一排（粗体、斜体、列表……），传了会**替换**掉默认那一套；
   extraCommands 是追加，不动原有的。我们要的是「加一个」，显然该用后者。

② 图片必须插在**光标处**，而不是文末
   新手最烦的事就是「我明明插在第二段，结果图跑到文章最后」。
   所以点按钮那一刻先记住选区（selectionStart/End），传完再按那个位置拼字符串；
   拖拽进来时用当时的选区。

③ 拖拽必须自己 preventDefault
   浏览器的默认行为是「把文件直接打开/下载」。不拦，你会看到编辑器被一张图替换掉。
   拦的地方是 dragenter / dragover（drop 里也要 preventDefault，否则 Chrome 还会补一次默认动作）。
*/

import { useRef, useState, type DragEvent } from "react"
import MDEditor, { type ICommand } from "@uiw/react-md-editor"
import { ImagePlus } from "lucide-react"

import { siteContent } from "@/config/site"
import { fillTemplate } from "@/lib/text"
import {
  IMAGE_ACCEPT,
  checkImageFile,
  toMarkdownImage,
  uploadImage,
  type ImageRejection,
} from "@/lib/upload-image"
import { cn } from "@/lib/utils"

const admin = siteContent.ui.admin

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: number
}

/* 前端否掉的理由 → 一句中文。翻译这一层留在组件里，
   是为了让 upload-image.ts 保持「不认中文」——它只产出代号，方便以后复用。 */
function describeRejection(rejection: ImageRejection): string {
  if (rejection.code === "empty") {
    return fillTemplate(admin.imageErrEmpty, { name: rejection.name })
  }
  if (rejection.code === "too-large") {
    return fillTemplate(admin.imageErrTooLarge, {
      name: rejection.name,
      size: rejection.size ?? "",
    })
  }
  return fillTemplate(admin.imageErrNotImage, { name: rejection.name })
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  height = 460,
}: Props) {
  /* 包住编辑器的这层 div，用来「顺手摸到里面那个 textarea」。
     为什么不给 MDEditor 传 ref：它内部有好几个节点，ref 指向谁不稳定；
     而 DOM 查询拿到的就是那唯一一个 textarea，行为更好预期。 */
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [progress, setProgress] = useState<{
    index: number
    total: number
    name: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const uploading = progress !== null

  function currentTextarea(): HTMLTextAreaElement | null {
    return containerRef.current?.querySelector("textarea") ?? null
  }

  /* 记住「图该插在哪」。拿不到 textarea 就返回 null（表示插到文末）。 */
  function captureSelection(): { start: number; end: number } | null {
    const el = currentTextarea()
    if (!el) return null
    return { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 }
  }

  /* 把一段 Markdown 拼进正文，返回「拼完的全文」和「光标该在哪」。

     为什么 text 要当参数传进来，而不是在里面读 value？
       上传是异步的：一次拖 3 张图，第 1 张传完时组件的 value 还是**上传前**那句
       （React 要等这一轮渲染才更新 props）。所以调用处自己拿着一份「最新全文」，
       每插一张就更新它，下一张接着往上拼 —— 否则后一张会把前一张覆盖掉。 */
  function insertSnippet(
    text: string,
    snippet: string,
    at: { start: number; end: number } | null
  ): { text: string; caret: number } {
    const start = at ? Math.min(at.start, text.length) : text.length
    const end = at ? Math.min(at.end, text.length) : text.length
    const before = text.slice(0, start)
    const after = text.slice(end)

    /* 图片前后各留一个空行：不然会出现
         「上一句![图](...)下一句」——Markdown 里图片和文字会挤在同一行，
         看着像排版坏了。 */
    const lead =
      before.length === 0 || before.endsWith("\n\n")
        ? ""
        : before.endsWith("\n")
          ? "\n"
          : "\n\n"
    const tail = after.length === 0 || after.startsWith("\n") ? "" : "\n"

    const next = `${before}${lead}${snippet}${tail}${after}`
    const caret = before.length + lead.length + snippet.length

    onChange(next)

    /* 光标等 React 把新 value 写回 textarea 之后再设。
       这一帧之内设会被「受控组件的值刷新」冲掉，所以用 requestAnimationFrame。 */
    requestAnimationFrame(() => {
      const el = currentTextarea()
      if (!el) return
      el.focus()
      el.setSelectionRange(caret, caret)
    })

    return { text: next, caret }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    if (uploading) return // 上一批还在传，别叠着来（否则两批图的插入位置会打架）

    const files = Array.from(fileList)
    /* 一次拖一批图时，它们都依次插在「拖进来那一瞬间」的光标位置。 */
    let at = captureSelection()
    /* 这份副本就是「拼到哪了」。每插一张图更新一次，下一张接着往上拼。 */
    let text = value
    const problems: string[] = []
    let inserted = 0

    setError(null)
    setNotice(null)

    for (const [index, file] of files.entries()) {
      const rejection = checkImageFile(file)
      if (rejection) {
        problems.push(describeRejection(rejection))
        continue
      }

      setProgress({ index: index + 1, total: files.length, name: file.name })
      try {
        const image = await uploadImage(file)
        const result = insertSnippet(text, toMarkdownImage(image), at)
        text = result.text
        at = { start: result.caret, end: result.caret } // 下一张接在这一张后面
        inserted += 1
      } catch (caught) {
        /* 后端拒了（类型不对 / 太大 / 没登录）。错误信息由 api.ts 翻成人话了，直接用。 */
        problems.push(
          `${file.name}：${caught instanceof Error ? caught.message : admin.imageUploadFailed}`
        )
      }
    }

    setProgress(null)

    if (problems.length > 0) setError(problems.join("；"))
    if (inserted === 1)
      setNotice(
        fillTemplate(admin.imageInserted, { name: files[0]?.name ?? "" })
      )
    else if (inserted > 1)
      setNotice(fillTemplate(admin.imageInsertedCount, { count: inserted }))
  }

  /* 上传按钮：点开系统选文件框。真正的活在 handleFiles 里。 */
  const uploadCommand: ICommand = {
    name: "upload-image",
    keyCommand: "upload-image",
    buttonProps: {
      "aria-label": admin.imageUpload,
      title: `${admin.imageUpload}（${admin.imageUploadHint}）`,
      disabled: uploading,
    },
    icon: <ImagePlus size={13} />,
    execute: () => {
      fileInputRef.current?.click()
    },
  }

  /* 拖拽：只有真的拖着「文件」过来才亮边。
     dataTransfer.types 里带 "Files" 才是文件；拖选中的文字过来不该触发。 */
  function hasFiles(event: DragEvent<HTMLDivElement>): boolean {
    return Array.from(event.dataTransfer.types).includes("Files")
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return
    event.preventDefault() // 关键：不拦的话松手时浏览器会直接打开这张图
    event.dataTransfer.dropEffect = "copy"
    if (!uploading) setDragging(true)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return
    event.preventDefault()
    setDragging(false)
    void handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* 拖拽高亮：虚线框套在编辑器外面，而不是把编辑器整个换掉 ——
          换掉的话你在拖动过程中就看不见自己写的内容了，容易放错地方。 */}
      <div
        className={cn(
          "rounded-md transition-shadow",
          dragging && "ring-2 ring-brand ring-offset-2 ring-offset-background"
        )}
        onDragEnter={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* data-color-mode="light"：编辑器默认跟系统深色模式走，
            不加这句，深色系统上会白底配黑框，和本站浅色风格打架。 */}
        <div
          className="admin-editor"
          data-color-mode="light"
          ref={containerRef}
        >
          <MDEditor
            extraCommands={[uploadCommand]}
            height={height}
            onChange={(next) => onChange(next ?? "")}
            preview="live"
            textareaProps={{ placeholder }}
            value={value}
          />
        </div>
      </div>

      {/* 隐藏的文件选择框。为什么放在编辑器旁边而不是用 document.createElement：
          这样它跟着组件一起挂载/卸载，不会在 DOM 里留孤儿节点。 */}
      <input
        accept={IMAGE_ACCEPT}
        className="hidden"
        multiple
        onChange={(event) => {
          void handleFiles(event.target.files)
          /* 清空：不清的话，连续两次选**同一个文件**不会触发 change
             （浏览器认为值没变），你会觉得「点了没反应」。 */
          event.target.value = ""
        }}
        ref={fileInputRef}
        type="file"
      />

      {dragging && (
        <p className="rounded-md border border-dashed border-brand bg-brand/5 px-3 py-2 text-xs text-brand">
          {admin.imageDropActive}
        </p>
      )}

      {uploading && (
        <p aria-busy="true" className="font-mono text-xs text-faint">
          {fillTemplate(admin.imageUploadingCount, {
            index: progress.index,
            total: progress.total,
            name: progress.name,
          })}
        </p>
      )}

      {error && (
        <p className="text-xs leading-5 text-destructive" role="alert">
          {error}
        </p>
      )}

      {!error && notice && (
        <p className="text-xs leading-5 text-faint" role="status">
          {notice}
        </p>
      )}
    </div>
  )
}
