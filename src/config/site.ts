import { BookOpen, FolderKanban, Library } from "lucide-react"

export const navigationItems = [
  { href: "/profile", label: "博客", icon: BookOpen },
  { href: "/works", label: "作品", icon: FolderKanban },
  { href: "/resources", label: "资料", icon: Library },
] as const

/* 页面名（即导航标签）的唯一来源：document.title 与导航标签共用它，
   同一个词不再在配置和页面里各写一遍。
   href 已限定成上面出现过的路由，所以 find 必定命中。
   注：works 页内的大标题另有 ui.works.title，值与这里的标签相同，
   属历史遗留，暂未合并。 */
export function pageNameOf(href: (typeof navigationItems)[number]["href"]) {
  return navigationItems.find((item) => item.href === href)!.label
}

export type MusicTrack = {
  title: string
  artist: string
  src: string
}

/* 侧栏音乐播放器的曲目表。
   往 public/music/ 放好 mp3 后，在这里补 { title, artist, src }，
   博客页侧栏的 MusicPlayerCard 会自动出现；空数组时该卡片整张不渲染。
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
  blog: {
    publicResources: "第一篇在路上",
    latestResources: "还在写第一篇，很快见。",
  },
  links: {
    douyin: {
      label: "抖音：bingziyuyang",
      url: "https://www.douyin.com/search/bingziyuyang?type=user",
    },
  },
  weather: {
    storageKey: "blog-weather-location",
    forecastApiUrl: "https://api.open-meteo.com/v1/forecast",
    geocodingApiUrl: "https://geocoding-api.open-meteo.com/v1/search",
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
    },
    footer: {
      subtitle: "内容持续更新",
    },
    home: {
      /* 单屏欢迎页：欢迎标题与副标题。发光渐变色/字号等视觉样式留在 home-page.tsx，
         这里只放文案，改字不改布局。 */
      heroTitle: "欢迎来到旺仔冰子的博客",
      heroSubtitle: "或许有天会发现，有些告别不是错付",
    },
    article: {
      tocTitle: "资料目录",
      noteDefaultTitle: "提示",
      minutesSuffix: "分钟阅读",
    },
    notFound: {
      title: "没有找到这个页面",
    },
    works: {
      badge: "PORTFOLIO",
      title: "作品",
      listTitle: "作品列表",
      description:
        "用来展示完成的项目、实验和其他创作。当前先保留页面结构，作品内容稍后添加。",
      emptyTitle: "暂无作品",
      emptyDescription:
        "后续添加作品时，这里会展示作品名称、简介、状态和访问入口。",
    },
    profile: {
      heroEyebrow: "BLOG / NOTES",
      heroTitle: "博客 · 记录与发现",
      heroSubtitle: "把学习、创作和建设过程整理成可以回看的片段。",
      contact: "联系方式",
      writing: "WRITING",
      latestResources: "最新资料",
      emptyResources: "暂无资料",
      emptyResourcesDescription: "新资料发布后会显示在这里。",
      noTagResults: "没有找到带该标签的文章",
    },
    resources: {
      title: "资料库",
      latestTitle: "最近资料",
      emptyResources: "暂无资料",
      noResults: "没有找到相关资料",
      emptyResourcesDescription: "资料内容已清空，之后可以添加新的 MDX 资料。",
      noResultsDescription: "换一个关键词，或者清除当前搜索条件。",
    },
    sidebar: {
      calendarTitle: "时间与提醒",
      weatherUnavailable: "天气暂不可用",
      humidity: "湿度",
      unknownWeather: "未知",
      locationInputPlaceholder: "输入城市名，如：济南",
      locate: "定位",
      cityNotFound: "未找到该城市，请换个名称试试",
      tagsTitle: "标签",
      music: {
        previousTrack: "上一首",
        play: "播放",
        pause: "暂停",
        nextTrack: "下一首",
        seek: "调整播放进度",
        loadError: "音频加载失败",
      },
    },
  },
} as const
