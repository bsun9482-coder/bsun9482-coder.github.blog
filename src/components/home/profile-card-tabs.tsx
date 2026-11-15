import { useEffect, useRef, useState } from "react"

import { siteContent } from "@/config/site"
import { useSiteProfile } from "@/lib/site-profile-hook"
import { fillTemplate } from "@/lib/text"
import { cn } from "@/lib/utils"

/* 首页右侧终端卡下面的那块：两个标签页。
   · 签名代码：把站点信息渲染成一段带高亮的代码
   · 聊一聊：点预设问题 → 先插用户气泡，450ms 后插预设回答（纯前端，没有接口）

   两个面板放在同一个网格单元里叠着，不显示的那个用 invisible 保留占位 ——
   这样切换标签时外框高度不变，不会一上一下地跳。占位的那份同时 inert，
   既点不到也进不了 Tab 顺序。 */

const INDENT = "  "

type ChatMessage = { id: number; role: "user" | "ai"; text: string }

function TabButton({
  active,
  controls,
  id,
  label,
  onSelect,
}: {
  active: boolean
  controls: string
  id: string
  label: string
  onSelect: () => void
}) {
  return (
    <button
      aria-controls={controls}
      aria-selected={active}
      className={cn(
        "min-h-11 rounded-lg px-3 text-sm font-medium transition-colors sm:min-h-9",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
      id={id}
      onClick={onSelect}
      role="tab"
      type="button"
    >
      {label}
    </button>
  )
}

/* 代码面板：结构固定（变量名 + 字段 + 收尾注释）。
   为什么用 pre 里的 block 级 span 排每行：pre 只接受行内内容，塞 div 是非法结构，
   而这行又必须整行断开 —— 用 display:block 的 span 既合法又能断行。

   ⚠️ 字段分两段拼起来（第 48 轮）：
     · 前两项 name / location —— 作者的真实资料，来自 GET /api/profile
     · 后面几项 role / stack / focus / openToWork —— 「人设描述」，来自 site.ts 配置

   为什么不把 name / location 也写进配置、再按 key 覆盖：配置写死的那份会变成
   第二份「真相」，站长改了名字而配置没改，卡片上就挂着旧名。而如果把配置里的
   这两项删掉再按 key 覆盖，TS 会拿 `field.key` 的字面量联合类型去和 "name" 比，
   直接报「两个类型没有重叠」—— 编译期就知道这两个 key 已经不存在了。
   所以顺序反过来：资料字段在组件里造，配置字段在后面跟，两段拼成一个数组。 */
function SignaturePanel() {
  const { codeComment, codeFields, codeVariable } = siteContent.ui.home.cardTabs
  const profile = useSiteProfile()

  /* value 写成 readonly string[]：site.ts 是 `as const` 导出的，
     里面的 ["Python", ...] 是只读元组，可变数组接不住它。 */
  const fields: {
    key: string
    value: string | readonly string[] | boolean | number
  }[] = [
    { key: "name", value: profile.name },
    { key: "location", value: profile.location },
    ...codeFields,
  ]

  return (
    <pre className="font-mono text-xs leading-5 text-foreground">
      <code>
        <span className="block">
          <span className="text-brand">const</span> {codeVariable}{" "}
          <span className="text-muted-foreground">= {"{"}</span>
        </span>

        {fields.map((field) => (
          <span className="block" key={field.key}>
            {INDENT}
            {field.key}
            <span className="text-muted-foreground">: </span>
            {Array.isArray(field.value) ? (
              <>
                <span className="text-muted-foreground">[</span>
                {field.value.map((item) => (
                  <span className="block" key={item}>
                    {INDENT}
                    {INDENT}
                    <span className="text-emerald-700">{`"${item}"`}</span>,
                  </span>
                ))}
                {INDENT}
                <span className="text-muted-foreground">]</span>,
              </>
            ) : typeof field.value === "string" ? (
              <>
                <span className="text-emerald-700">{`"${field.value}"`}</span>,
              </>
            ) : (
              <>
                <span className="text-amber-700">{String(field.value)}</span>,
              </>
            )}
          </span>
        ))}

        <span className="block">
          <span className="text-muted-foreground">{"}"}</span>
        </span>
        <span className="block text-faint italic">{`// ${codeComment}`}</span>
      </code>
    </pre>
  )
}

function Bubble({ role, text }: { role: ChatMessage["role"]; text: string }) {
  return (
    <p
      className={cn(
        "chat-bubble max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-5 whitespace-pre-line",
        role === "user"
          ? "self-end rounded-br-md bg-brand text-white"
          : "self-start rounded-bl-md bg-secondary text-foreground"
      )}
    >
      {text}
    </p>
  )
}

function ChatPanel() {
  const { chatQuestions, chatWelcome } = siteContent.ui.home.cardTabs
  /* 预设问答里带 {name} / {location} 占位符 —— 填真值，别让助手自称旧名字。 */
  const profile = useSiteProfile()
  const values = { name: profile.name, location: profile.location }

  /* ⚠️ 欢迎语**不能**放进 useState 的初值里（第一版就是这么写的，踩了坑）：
     这块面板和「签名代码」是叠在同一个网格里的两份 DOM（隐藏那份 invisible+inert），
     所以它**在首屏就挂载了** —— 那一刻资料还在路上，初值算出来的是兜底名字
     「旺仔冰子」；资料随后到位，setState 初值不会重算，于是欢迎语永远停在旧名。
     （实测：签名代码卡跟着变了，唯独这句欢迎语没变。）

     正确做法：state 里只存「用户点了哪些问题」，欢迎语每次渲染现算。
     这样资料什么时候到，它就什么时候跟着变。 */
  const [asked, setAsked] = useState<
    { id: number; role: ChatMessage["role"]; text: string }[]
  >([])
  /* 有人正在「思考」时把问题按钮禁掉：否则连点会把同一个问题排进队列，
     气泡一前一后地冒出来，看着像坏了。 */
  const [pending, setPending] = useState(false)
  const timerRef = useRef<number | null>(null)
  const nextId = useRef(1)

  /* 卸载时把定时器清掉：切页面之后再 setState 是无效更新，也会一直占着定时器 */
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    []
  )

  const ask = (question: string, answer: string) => {
    if (pending) return

    setAsked((list) => [
      ...list,
      { id: nextId.current++, role: "user", text: question },
    ])
    setPending(true)

    timerRef.current = window.setTimeout(() => {
      setAsked((list) => [
        ...list,
        { id: nextId.current++, role: "ai", text: answer },
      ])
      setPending(false)
      timerRef.current = null
    }, 450)
  }

  /* id 0 固定给欢迎语，其余用自增 id —— 和原来那套 id 语义保持一致。 */
  const messages: ChatMessage[] = [
    { id: 0, role: "ai", text: fillTemplate(chatWelcome, values) },
    ...asked,
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* aria-live：新气泡是异步出现的，读屏器要靠它把回答念出来 */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {messages.map((message) => (
          <Bubble key={message.id} role={message.role} text={message.text} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {chatQuestions.map((item) => (
          <button
            className={cn(
              "min-h-11 rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors sm:min-h-9",
              "hover:border-brand/40 hover:text-brand disabled:hover:border-border disabled:hover:text-muted-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            disabled={pending}
            key={item.question}
            onClick={() =>
              ask(item.question, fillTemplate(item.answer, values))
            }
            type="button"
          >
            {item.question}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ProfileCardTabs() {
  const [tab, setTab] = useState<"code" | "chat">("code")
  const { chatTab, codeTab, label } = siteContent.ui.home.cardTabs

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="border-b border-border bg-secondary/60 p-2">
        <div
          aria-label={label}
          className="grid grid-cols-2 gap-1"
          role="tablist"
        >
          <TabButton
            active={tab === "code"}
            controls="home-panel-code"
            id="home-tab-code"
            label={codeTab}
            onSelect={() => setTab("code")}
          />
          <TabButton
            active={tab === "chat"}
            controls="home-panel-chat"
            id="home-tab-chat"
            label={chatTab}
            onSelect={() => setTab("chat")}
          />
        </div>
      </div>

      <div className="grid p-4">
        <div
          aria-labelledby="home-tab-code"
          className={cn(
            "col-start-1 row-start-1",
            tab !== "code" && "invisible"
          )}
          id="home-panel-code"
          inert={tab !== "code"}
          role="tabpanel"
        >
          <SignaturePanel />
        </div>

        <div
          aria-labelledby="home-tab-chat"
          className={cn(
            "col-start-1 row-start-1",
            tab !== "chat" && "invisible"
          )}
          id="home-panel-chat"
          inert={tab !== "chat"}
          role="tabpanel"
        >
          <ChatPanel />
        </div>
      </div>
    </section>
  )
}
