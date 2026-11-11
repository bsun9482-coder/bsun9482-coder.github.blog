import { Container } from "@/components/layout/container"

/* 版权与备案信息集中在这里：换年份、换备案号只改这一处，别在页面里再写一遍。
   备案号必须与备案主体一致，写错等于向访问者展示了错误的备案信息。 */
const COPYRIGHT_YEAR = 2026
const COPYRIGHT_HOLDER = "旺仔冰子"
const ICP_NUMBER = "豫ICP备2026051640号-1"
const ICP_HREF = "https://beian.miit.gov.cn/"

/* 预留位：公安网备批下来后在这里加常量，再在下面「备案号」那一项后面
   用同样的分隔点续一项即可。注意它和工信部备案不是一套东西：
   写法是「省简称 + 公网安备 + 编号 + 号」，链接指向 beian.mps.gov.cn。 */
// const POLICE_ICP_NUMBER = ""

function scrollToTop() {
  /* 尊重系统的「减少动态效果」：开启时直接跳过去，不做平滑滚动
     （长距离平滑滚动对前庭敏感的人会眩晕，全站其它动效也是这个口径）。 */
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
}

/* 全站页脚：靠最外层 flex 列撑到一屏底下（main 是 flex-1），不使用 fixed，
   所以不会盖住正文，也不会有「内容滚完了页脚还浮在上面」的重叠。 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background py-5">
      <Container>
        <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:justify-between sm:gap-4 sm:text-left">
          {/* 左侧两项：版权 · 备案号。窄屏用换行兜底，备案号整串不被截断。 */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 text-note text-muted-foreground">
            <span className="inline-flex min-h-11 items-center sm:min-h-0">
              © {COPYRIGHT_YEAR} {COPYRIGHT_HOLDER}
            </span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <a
              className="inline-flex min-h-11 items-center rounded-sm break-all transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:min-h-0"
              href={ICP_HREF}
              rel="noopener noreferrer"
              target="_blank"
            >
              {ICP_NUMBER}
            </a>
          </div>

          <button
            className="-my-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-note text-muted-foreground transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:min-h-9"
            onClick={scrollToTop}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            回到顶部
          </button>
        </div>
      </Container>
    </footer>
  )
}
