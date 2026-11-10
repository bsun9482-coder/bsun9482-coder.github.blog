import { BookOpen, FolderGit2, Library, NotebookPen } from "lucide-react"

export const navigationItems = [
  { href: "/profile", label: "博客", icon: BookOpen },
  { href: "/works", label: "项目", icon: FolderGit2 },
  { href: "/resources", label: "文章", icon: Library },
  { href: "/journal", label: "日记", icon: NotebookPen },
] as const

/* 页面名（即导航标签）的唯一来源：document.title 与导航标签共用它，
   同一个词不再在配置和页面里各写一遍。
   href 已限定成上面出现过的路由，所以 find 必定命中。
   大标题也走本函数，值同导航标签。 */
export function pageNameOf(href: (typeof navigationItems)[number]["href"]) {
  return navigationItems.find((item) => item.href === href)!.label
}

export type MusicTrack = {
  title: string
  artist: string
  src: string
  /* TODO(歌词): 这里预留逐行歌词字段的位置，先不实现。
     做成歌词后补上 lyrics?: readonly string[]（每项一句），
     博客页顶部的歌词栏会按播放进度逐行切换、高亮当前句。 */
}

/* 音乐曲目表（博客页顶部「音乐卡」取第一首判断能否播放）。
   往 public/music/ 放好 mp3 后，在这里补 { title, artist, src }，
   空数组时音乐卡的播放按钮置灰。
   —— 原先这里挂着两条指向 /music/demo-*.mp3 的示例曲目，但 public/music/ 里
   并没有对应文件，卡片必然落进「音频加载失败」分支（体检也一直报 FAIL）。
   先把示例撤下，等真实音频补上再挂回。 */
export const musicPlaylist: readonly MusicTrack[] = []

export const siteContent = {
  meta: {
    titleSuffix: "学习日志",
  },
  /* 全站标语：首页 Hero 和页脚用的是同一句，只在这里写一遍。 */
  tagline: "学习日志 · Python 与 AI 知识库",
  person: {
    // 全站名字的唯一来源：主名字 + 尾部「（……）」敬称，展示时会自动把敬称降级处理
    name: "旺仔冰子（恩师萧氏）",
    avatarInitial: "旺",
    avatarUrl: "/avatar.jpg",
    introduction: "泪水打湿猪脚饭，发誓要挣100万",
    location: "济南",
  },
  weather: {
    storageKey: "blog-weather-location",
    forecastApiUrl: "https://api.open-meteo.com/v1/forecast",
    defaultLocation: {
      name: "济南",
      latitude: 36.65,
      longitude: 117,
    },
  },
  profileSlides: [
    {
      eyebrow: "01 / 03",
      title: "正在学习",
      description: "正在系统学习 Python，并尝试把 AI 能力接入小型应用。",
    },
    {
      eyebrow: "02 / 03",
      title: "最近完成",
      description: "完成了这个个人学习博客的本地 MVP 和基础登录流程。",
    },
    {
      eyebrow: "03 / 03",
      title: "接下来",
      description: "整理并发布第一篇 Python 或 AI 应用学习资料。",
    },
  ],
  ui: {
    header: {
      /* 「首页」这个词在组件里出现三次：桌面端导航条右侧的独立按钮、移动端菜单的第一项、
         首页的 document.title。它不属于 navigationItems（桌面端不把首页排进主导航），
         所以单独放这里，三处共用，别在组件里写死。 */
      home: "首页",
      menuTitle: "导航菜单",
      menuDescription: "选择要访问的页面",
      /* 无障碍标签：读屏器会念出来，页面上看不见，仍是文案的一部分 */
      navLabel: "主导航",
      mobileNavLabel: "移动端导航",
      menuOpen: "打开导航菜单",
    },
    footer: {
      subtitle: "内容持续更新",
    },
    home: {
      /* 单屏欢迎页：欢迎标题、副标题与两个按钮文案。
         视觉样式（字号/字重/间距）留在 home-page.tsx，这里只放文案。 */
      heroTitle: "欢迎来到旺仔冰子的博客",
      heroSubtitle: "或许有天会发现，有些告别不是错付",
      ctaPrimary: "读文章",
      ctaSecondary: "关于我",
      /* 首页 hero 的终端打字机：先打命令，打完再打结果（两行，55ms/字） */
      terminalCommand: "$ npm run build",
      terminalResult: "→ 部署成功，欢迎来到我的数字花园。",
      /* 首屏底部那个下滑箭头按钮的无障碍标签（图标按钮，页面上没有可见文字） */
      scrollHint: "向下滚动进入博客",
    },
    article: {
      tocTitle: "文章目录",
      tocKicker: "当前教程",
      noteDefaultTitle: "提示",
      minutesSuffix: "分钟阅读",
      /* 下面三条原来写死在 article-page.tsx / article-card.tsx 里 */
      missingTitle: "文章不存在",
      backToList: "返回文章列表",
      loading: "正在加载文章",
      openLabel: "打开文章",
    },
    notFound: {
      title: "没有找到这个页面",
      description: "页面可能已被移动，或者链接地址有误。",
      backHome: "返回首页",
    },
    /* 页面级懒加载与出错兜底（见 App.tsx 的 Suspense / ErrorBoundary）：
       懒加载的页面在下载期间显示的占位提示、以及页面彻底崩了之后的说明与操作。 */
    page: {
      loading: "正在加载页面",
      errorTitle: "页面没能加载出来",
      errorHint: "可能是网络波动，或者站点刚更新过。重新加载一次通常就好了。",
      retry: "重新加载",
    },
    works: {
      subtitle: "从零到一，用代码构建的每一个项目",
      listTitle: "项目列表",
      emptyTitle: "暂无项目",
      emptyDescription:
        "后续添加项目时，这里会展示项目名称、简介、状态和访问入口。",
    },
    profile: {
      /* 「最新文章」区块：标题、右上角「查看全部」、以及没有文章时的两条占位文案。
         注意这里不再另存一份「暂无文章」—— 与 ui.resources.emptyResources 是同一句话，
         两处各写一份正是之前「资料 / 文章」分叉的起因。 */
      latestPosts: "最新文章",
      viewAll: "查看全部 →",
      emptyPostsHint: "还在写第一篇，很快见。",
      /* 个人卡右下角两个图标按钮的无障碍标签（未接功能，另有 TODO 跟踪） */
      externalLink: "外部链接",
      music: "音乐",
      /* 顶部个人资料卡三个统计项的小字标签（数字/短横线本身在组件里拼） */
      statArticles: "文章",
      statMoments: "说说",
      statPhotos: "照片",
    },
    /* 顶部「音乐卡」的文案 */
    musicCard: {
      badge: "CLOUD MUSIC",
      emptyTitle: "暂无播放列表",
      emptyHint: "往 site.ts 添加曲目",
      play: "播放",
    },
    /* 顶部卡片与轮播卡之间那条「歌词展示栏」的文案 */
    lyricsBar: {
      regionLabel: "歌词展示",
      empty: "暂无歌词",
    },
    /* 文章列表页（/resources）：筛选条、搜索框、计数与两种空状态。
       计数文案用 {query} / {count} 占位，由 lib/text.ts 的 fillTemplate 填 ——
       别在组件里拿字符串拼，中文语序一旦要调就得改 JSX。 */
    resources: {
      subtitle: "记录技术探索、学术研究与生活感悟",
      allCategories: "全部",
      filterLabel: "按分类筛选",
      searchLabel: "搜索文章",
      searchPlaceholder: "搜索标题、标签或正文…",
      clearSearch: "清除搜索",
      matchedCount: "“{query}” 匹配到 {count} 篇",
      totalCount: "共 {count} 篇",
      clearFilters: "清除筛选条件",
      emptyResources: "暂无文章",
      noResults: "没有找到相关文章",
      emptyResourcesDescription: "文章内容已清空，之后可以添加新的 MDX 文章。",
      noResultsDescription: "换一个关键词，或者清除当前搜索条件。",
    },
    /* 底部「时间天气横条」（StatusBar）的文案。
       这里原先叫 sidebar，但站上早就没有侧边栏了，改名避免让人去找一个不存在的组件。 */
    statusBar: {
      weatherUnavailable: "天气不可用",
      humidity: "湿度",
      unknownWeather: "未知",
      /* 日期里的「周一」这类：名字按 Date.getDay() 的 0~6 索引取 */
      weekdayPrefix: "周",
      weekdays: ["日", "一", "二", "三", "四", "五", "六"],
    },
    /* 日记页：短内容聚合，没有详情路由 */
    journal: {
      subtitle: "随手记下的片段，按日子倒着排",
      countSuffix: "则",
      emptyTitle: "还没有日记",
      emptyDescription: "往 content/journal/ 放一个 .mdx，这里就会出现第一则。",
    },
  },
} as const
