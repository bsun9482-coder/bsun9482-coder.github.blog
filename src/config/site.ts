export const navigationItems = [
  { href: "/profile", label: "博客" },
  { href: "/works", label: "作品" },
  { href: "/resources", label: "资料" },
  { href: "/community", label: "社区交流" },
] as const

export const musicPlaylist = [
  {
    title: "示例音乐一",
    artist: "待补充",
    src: "/music/demo-1.mp3",
  },
  {
    title: "示例音乐二",
    artist: "待补充",
    src: "/music/demo-2.mp3",
  },
] as const

export const siteContent = {
  meta: {
    titleSuffix: "学习日志",
  },
  person: {
    name: "旺仔小冰子",
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
    github: {
      label: "@bsun9482-coder",
      url: "https://github.com/bsun9482-coder",
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
      menuTitle: "导航菜单",
      menuDescription: "选择要访问的页面",
    },
    footer: {
      tagline: "学习日志 · Python 与 AI 知识库",
      subtitle: "内容持续更新",
    },
    works: {
      badge: "PORTFOLIO",
      title: "作品",
      description:
        "用来展示完成的项目、实验和其他创作。当前先保留页面结构，作品内容稍后添加。",
      emptyTitle: "暂无作品",
      emptyDescription:
        "后续添加作品时，这里会展示作品名称、简介、状态和访问入口。",
    },
    community: {
      badge: "COMMUNITY",
      title: "社区交流",
      description:
        "用来发布讨论、分享经验和交流问题。当前先保留页面入口和内容结构。",
      emptyTitle: "社区暂未开放",
      emptyDescription: "后续可以在这里加入话题列表、发布入口和评论功能。",
    },
    profile: {
      heroEyebrow: "BLOG / NOTES",
      heroTitle: "博客 · 记录与发现",
      heroSubtitle: "把学习、创作和建设过程整理成可以回看的片段。",
      about: "关于我",
      currentDirection: "当前方向",
      thisBlog: "这个博客",
      writing: "WRITING",
      latestResources: "最新资料",
      emptyResources: "暂无资料",
      emptyResourcesDescription: "新资料发布后会显示在这里。",
    },
    resources: {
      emptyResources: "暂无资料",
      noResults: "没有找到相关资料",
      emptyResourcesDescription: "资料内容已清空，之后可以添加新的 MDX 资料。",
      noResultsDescription: "换一个关键词，或者清除当前搜索条件。",
    },
    sidebar: {
      weatherUnavailable: "天气暂不可用",
      humidity: "湿度",
      unknownWeather: "未知",
      locationInputPlaceholder: "输入城市名，如：济南",
      locate: "定位",
      cityNotFound: "未找到该城市，请换个名称试试",
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
