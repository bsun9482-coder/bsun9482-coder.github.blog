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
    home: {
      /* 首页 hero 左上角的小标签（等宽小字，用 · 分隔几个关键词） */
      eyebrow: "PYTHON · AI · 学习笔记",
      heroTitle: "欢迎来到旺仔冰子的博客",
      heroSubtitle: "或许有天会发现，有些告别不是错付",
      ctaPrimary: "读文章",
      ctaSecondary: "关于我",
      /* 首页 hero 右侧终端卡：先打命令，打完再打结果（两行，55ms/字） */
      terminalCommand: "$ npm run build",
      terminalResult: "→ 部署成功，欢迎来到我的数字花园。",
      /* 终端卡下面那块：两个标签页（签名代码 / 聊一聊）。
         代码里的字段、对话里的问答全在这里改，组件只负责画 —— 别在 tsx 里写死文案。

         字段值是联合类型：
         · 字符串 ⇒ 渲染成带引号的字符串
         · 字符串数组 ⇒ 渲染成多行数组
         · 布尔 / 数字 ⇒ 原样输出（按字面量上色） */
      cardTabs: {
        /* 标签组给读屏器的名字，页面上不显示 */
        label: "首页名片切换",
        codeTab: "签名代码",
        chatTab: "聊一聊",
        codeVariable: "developer",
        codeFields: [
          { key: "name", value: "旺仔冰子" },
          { key: "role", value: "Python / AI 学习者" },
          { key: "location", value: "济南" },
          { key: "stack", value: ["Python", "FastAPI", "React", "Tailwind"] },
          { key: "focus", value: "把 AI 接进自己的小项目" },
          { key: "openToWork", value: true },
        ],
        codeComment: "持续构建中...",
        chatWelcome: "你好，我是冰子的 AI 助手，想了解点什么？",
        /* 点问题 → 先出用户气泡，450ms 后出对应的回答。
           想加问题就往下加一项，按钮和回答会自动跟着出现。 */
        chatQuestions: [
          {
            question: "他是谁？",
            answer:
              "旺仔冰子，在济南自学 Python 与 AI。把学到的东西写成文章，也做点小项目。",
          },
          {
            question: "技术栈？",
            answer:
              "后端 Python + FastAPI，前端 React + TypeScript + Tailwind；AI 相关的还在边学边用。",
          },
          {
            question: "在求职吗？",
            answer: "在找 Python / 后端方向的机会，聊得来就一起做点东西。",
          },
        ],
      },
      /* 底部箭头按钮的无障碍标签；现在它滚到下面的入口区，不再直接跳页 */
      scrollHint: "查看功能入口",
      entriesTitle: "快速入口",
      entriesHint: "五个入口，够用了",
      /* 首页五个功能入口卡。文案在这里，图标与配色在
         components/home/home-entry-card.tsx 里按 href 匹配（颜色是表现层，不进配置）。
         想临时藏掉某个入口：把对应项删掉即可，网格会自动重排。 */
      entries: [
        {
          href: "/resources",
          label: "文章",
          description: "技术笔记、提示词与踩坑记录",
        },
        {
          href: "/works",
          label: "项目",
          description: "用代码一点点做出来的东西",
        },
        {
          href: "/journal",
          label: "日记",
          description: "随手记下的片段，按日子倒排",
        },
        {
          href: "/gallery",
          label: "相册",
          description: "文章里用到的插图合集",
        },
        {
          href: "/profile",
          label: "关于",
          description: "关于我，以及最近在学什么",
        },
      ],
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
      /* 项目页现在没有数据源，整页只有页头 + 一张说明卡。
         这三个键是用户 2026-11-11 明确要求留着的（「没有项目的话改回原来的样子」），
         别再按「空模块不渲染」的规矩删掉。 */
      listTitle: "项目列表",
      emptyTitle: "暂无项目",
      emptyDescription:
        "后续添加项目时，这里会展示项目名称、简介、状态和访问入口。",
    },
    profile: {
      /* 「最新文章」区块：标题与右上角「查看全部」。
         没有文章时整块不渲染，所以不再维护「暂无文章」这类占位文案。 */
      latestPosts: "最新文章",
      viewAll: "查看全部 →",
      /* 顶部个人资料卡的统计项标签。只有「文章」有真实数据源，
         另外两项（说说 / 照片）没有数据就整块不出现 —— 不留孤零零的短横线。 */
      statArticles: "文章",
    },
    /* 顶部「音乐卡」的文案。曲目表为空时整张卡不渲染，所以不需要「暂无播放列表」。 */
    musicCard: {
      badge: "CLOUD MUSIC",
      play: "播放",
    },
    /* 顶部卡片与轮播卡之间原来还有一条「歌词展示栏」，已随组件一起删除：
       它没有数据源，永远只显示「暂无歌词」，属于空占位。 */
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
    /* 日记页：短内容聚合，没有详情路由。空态整块不渲染，不留「还没有日记」。 */
    journal: {
      subtitle: "随手记下的片段，按日子倒着排",
      countSuffix: "则",
    },
    /* 相册页：把文章里用到的插图集中铺一遍（图片清单在 lib/gallery.ts）。
       不做「上传 / 分类」，它就是一个看图的网格。 */
    gallery: {
      title: "相册",
      subtitle: "文章与项目里用到的插图，按章节顺序排开",
      countSuffix: "张",
    },
  },
} as const
