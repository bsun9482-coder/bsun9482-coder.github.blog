import { useCallback, useRef } from "react"
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react"
import { Link } from "react-router"

import { TerminalTyper } from "@/components/fx/terminal-typer"
import { Reveal } from "@/components/fx/reveal"
import { HomeEntryCard } from "@/components/home/home-entry-card"
import { ProfileCardTabs } from "@/components/home/profile-card-tabs"
import { Container } from "@/components/layout/container"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useEnterTransition } from "@/hooks/use-enter-transition"
import { prefersReducedMotion, staggerDelay } from "@/lib/reveal"

/* 底部向下箭头的上下浮动循环动画；降级时停掉浮动（media query 见下方 style） */
const CHEVRON_CSS = `
@keyframes home-chevron-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(8px); }
}
.home-chevron-float { animation: home-chevron-float 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .home-chevron-float { animation: none; }
}
`

const ENTRIES_ANCHOR = "home-entries"

export function HomePage() {
  useDocumentTitle(siteContent.ui.header.home)

  const { focus, heroTitle } = siteContent.ui.home

  /* 首屏依次淡入：开启「减少动态效果」时直接是可见态，不播。
     双 rAF 的细节在 hooks/use-enter-transition.ts 里（那里有为什么）。 */
  const visible = useEnterTransition(!prefersReducedMotion())
  const entriesRef = useRef<HTMLDivElement>(null)

  /* 箭头按钮：滚到下面的入口区。
     ⚠️ 这里原来是「滚轮往下 / 触屏上滑 / 按方向键 ⇒ 450ms 退场后跳去 /profile」，
     那套劫持在首页只有一个整屏时成立；现在首页多了入口区与入口卡，
     再劫持滚动就等于「用户永远看不到下面那排卡」—— 所以整段删掉，
     改成正常滚动 + 这个显式按钮。 */
  const scrollToEntries = useCallback(() => {
    entriesRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    })
  }, [])

  /* 依次淡入：标签 0ms → 标题 120ms → 简介 240ms → 按钮 360ms。
     只动 opacity / transform，不动布局。 */
  const rise = (delayMs: number) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0px)" : "translateY(12px)",
    transition: `opacity 600ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms, transform 600ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`,
  })

  return (
    <>
      <style>{CHEVRON_CSS}</style>

      {/* 首屏：左右两栏。左栏是「人话」，右栏是终端卡 —— 单栏靠左的老版在
          1120 宽的版心里右侧会空掉一大块，两栏把空白变成有内容的平衡。
          桌面 1.1 : 0.9，窄屏单列（文字在前、终端在后，读起来是顺的）。 */}
      <Container className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-center py-16 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            {/* 小标签：小头像 + 等宽小字。字号只到 12，靠字距和灰色拉开层级，
                不跟标题抢注意力。 */}
            <div className="flex items-center gap-2.5" style={rise(0)}>
              <Avatar className="size-7 ring-1 ring-border">
                <AvatarImage
                  alt={siteContent.person.name}
                  src={siteContent.person.avatarUrl}
                />
                <AvatarFallback className="text-xs">
                  {siteContent.person.avatarInitial}
                </AvatarFallback>
              </Avatar>
              <span className="font-mono text-xs tracking-[0.14em] text-faint uppercase">
                {siteContent.ui.home.eyebrow}
              </span>
            </div>

            {/* 标题用 clamp 而不是断点阶梯：1120 版心里 44px 刚好，
                窗口缩到 500 时退到 32 —— 中间不会出现两级跳变。
                中间那段是蓝紫渐变（.text-gradient-brand），全页唯一的高饱和焦点。 */}
            <h1
              className="mt-6 font-heading leading-[1.1] font-semibold tracking-tight text-balance text-foreground"
              style={{
                fontSize: "clamp(32px, 4.6vw, 44px)",
                ...rise(80),
              }}
            >
              {heroTitle.lead}
              <span className="text-gradient-brand">{heroTitle.accent}</span>
              {heroTitle.tail}
            </h1>

            {/* 金句：左侧 3px 品牌蓝边条 + 衬线体。
                全站唯一用衬线的地方 —— 引言和正文一混，就分不出哪句是「说的」了。 */}
            <blockquote
              className="mt-6 max-w-xl rounded-r-lg border-l-[3px] border-brand bg-muted/50 py-3 pr-4 pl-4 sm:pl-5"
              style={rise(160)}
            >
              <p className="font-serif text-base leading-8 text-muted-foreground sm:text-lg">
                {siteContent.ui.home.heroSubtitle}
              </p>
            </blockquote>

            <div
              className="mt-8 flex flex-wrap items-center gap-3"
              style={rise(240)}
            >
              <Button asChild size="lg">
                <Link to="/resources">
                  {siteContent.ui.home.ctaPrimary}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
              {/* 带 state 过去：博客页靠这个标记决定要不要播一次入场动画
                  （以前是「首页下滑」带的，现在下滑不再自动跳页了）。 */}
              <Button asChild size="lg" variant="outline">
                <Link state={{ fromHome: true }} to="/profile">
                  {siteContent.ui.home.ctaSecondary}
                </Link>
              </Button>
            </div>
          </div>

          {/* 右栏和按钮同一档延迟：视觉上「左边说完、右边一起落地」 */}
          <div className="flex flex-col gap-4" style={rise(240)}>
            <TerminalTyper
              command={siteContent.ui.home.terminalCommand}
              result={siteContent.ui.home.terminalResult}
              startDelay={300}
            />

            {/* 终端卡下面：签名代码 / 聊一聊 两个标签页。
                原来这里是一条「篇文章 / 则日记 / 个分类」的统计条，
                数字虽然是真的，但三个数对访客没什么用，换成能点、能读的东西。 */}
            <ProfileCardTabs />
          </div>
        </div>

        <button
          aria-label={siteContent.ui.home.scrollHint}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md p-2 text-faint transition-colors hover:text-muted-foreground"
          onClick={scrollToEntries}
          type="button"
        >
          <ChevronDownIcon
            aria-hidden="true"
            className="home-chevron-float size-5"
          />
        </button>
      </Container>

      {/* 当前专注：全站唯一的深色块。位置在首屏和入口区之间 ——
          把「我是谁」和「去哪儿」隔开，页面才有段落感。
          深色只此一处，别复制第二块，否则浅色极简的调子就散了。 */}
      <Container
        aria-labelledby="home-focus"
        as="section"
        className="pb-16 sm:pb-24"
      >
        <Reveal>
          <div className="focus-card p-6 sm:p-10">
            <p className="font-mono text-xs tracking-[0.16em] text-(--brand-soft) uppercase">
              {focus.label}
            </p>
            <h2
              className="mt-4 text-title font-semibold tracking-tight text-white sm:text-3xl"
              id="home-focus"
            >
              {focus.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              {focus.description}
            </p>
            {/* 技术标签：描边款，不填色 —— 深色块里再上彩色底会显得吵 */}
            <ul className="mt-6 flex flex-wrap gap-2">
              {focus.tags.map((tag) => (
                <li
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200"
                  key={tag}
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Container>

      {/* 功能入口区：五个卡，桌面一行五列、平板三列、手机两列。
          区块之间的垂直间距走 --section-gap（和各页面一致）。 */}
      <Container
        aria-labelledby={ENTRIES_ANCHOR}
        as="section"
        className="flex flex-col gap-6 pb-16 sm:pb-24"
        ref={entriesRef}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            className="text-title font-semibold tracking-tight"
            id={ENTRIES_ANCHOR}
          >
            {siteContent.ui.home.entriesTitle}
          </h2>
          <p className="font-mono text-xs text-faint">
            {siteContent.ui.home.entriesHint}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {siteContent.ui.home.entries.map((entry, index) => (
            /* 外层 Reveal 给 grid：卡片才能等高撑满单元格；
               延迟 0/100/200 循环，五个入口依次浮上来。 */
            <Reveal
              className="grid"
              delay={staggerDelay(index)}
              key={entry.href}
            >
              <HomeEntryCard
                description={entry.description}
                href={entry.href}
                label={entry.label}
              />
            </Reveal>
          ))}
        </div>
      </Container>
    </>
  )
}
