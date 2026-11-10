/* 背景氛围层：页面顶部的浅灰网格 + 两枚漂浮光斑。
 *
 * 约束（都是硬要求，改之前先读一遍）：
 * - 绝对定位、不占文档流：整层 `absolute inset-x-0 top-0` + 固定高度，
 *   里面全是定位元素，不会把内容顶下去。
 * - `pointer-events-none`：不挡任何点击、不挡文本选择；再加 `aria-hidden`，
 *   读屏器也不会把它念出来。
 * - `-z-10`：挂在 SiteLayout 那个 `relative z-10` 容器里 —— 容器本身创建了层叠上下文，
 *   所以负 z 只会在"容器背景之上、内容之下"，不会掉到 body 背景底下看不见。
 * - 颜色克制：网格与两枚光斑的色值都在 index.css 的 :root 里
 *   （--ambience-grid / --ambience-blob-a / --ambience-blob-b），透明度都很低，白底上不刺眼。
 * - 光斑的**布局盒**始终留在视口内（只用百分比定位、不用负偏移），
 *   否则会撑出横向滚动条；blur 的绘制外溢不会造成滚动，所以不需要 overflow 裁剪
 *   （裁了反而会切出硬边，也会破坏 sticky header 的滚动参照）。
 */
export function SiteAmbience() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] select-none"
    >
      {/* 网格：高度只到 560px，配合遮罩在底部自然消失 */}
      <div className="site-ambience-grid absolute inset-x-0 top-0 h-[560px]" />

      {/* 第一枚：左上，浅蓝。颜色走令牌，别在这里写 hex */}
      <div className="site-ambience-blob absolute top-[104px] left-[6%] size-[200px] rounded-full bg-(--ambience-blob-a) opacity-35 blur-[60px]" />

      {/* 第二枚：右上，浅紫，相位错开 6 秒 */}
      <div className="site-ambience-blob site-ambience-blob--delayed absolute top-[172px] right-[8%] size-[200px] rounded-full bg-(--ambience-blob-b) opacity-35 blur-[60px]" />
    </div>
  )
}
