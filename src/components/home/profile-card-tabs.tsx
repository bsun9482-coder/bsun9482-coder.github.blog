import { useEffect, useRef, useState } from "react"

import { siteContent } from "@/config/site"
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

/* 代码面板：结构固定（变量名 + 字段 + 收尾注释），内容全部来自配置。
   为什么用 pre 里的 block 级 span 排每行：pre 只接受行内内容，塞 div 是非法结构，
   而这行又必须整行断开 —— 用 display:block 的 span 既合法又能断行。 */
function SignaturePanel() {
  const { codeComment, codeFields, codeVariable } = siteContent.ui.home.cardTabs

  return (
    <pre className="font-mono text-xs leading-5 text-foreground">
      <code>
        <span className="block">
          <span className="text-brand">const</span> {codeVariable}{" "}
          <span className="text-muted-foreground">= {"{"}</span>
        </span>

        {codeFields.map((field) => (
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: "ai", text: chatWelcome },
  ])
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

    setMessages((list) => [
      ...list,
      { id: nextId.current++, role: "user", text: question },
    ])
    setPending(true)

    timerRef.current = window.setTimeout(() => {
      setMessages((list) => [
        ...list,
        { id: nextId.current++, role: "ai", text: answer },
      ])
      setPending(false)
      timerRef.current = null
    }, 450)
  }

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
            onClick={() => ask(item.question, item.answer)}
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
