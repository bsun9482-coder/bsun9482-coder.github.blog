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
  /* 博客页右侧「此刻状态」卡的三行。原来叫 profileSlides、被塞进一个轮播里，
     第 40 轮改成竖排卡片：轮播一次只露一条，剩下的两条要等自动播放才看得到，
     而这三条本来就是「一眼看完」的信息。
     字段从 title/description 改成 label/detail，是因为卡片里没有编号（eyebrow），
     那个「01 / 03」只在轮播里才有意义。 */
  profileStatus: [
    {
      label: "正在学习",
      detail: "正在系统学习 Python，并尝试把 AI 能力接入小型应用。",
    },
    {
      label: "最近完成",
      detail: "完成了这个个人学习博客的本地 MVP 和基础登录流程。",
    },
    {
      label: "接下来",
      detail: "整理并发布第一篇 Python 或 AI 应用学习文章。",
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
      /* 标题拆三段：只有 accent 那段渲染成蓝紫渐变。
         拆开写而不是在组件里对整句做 split —— 那种写法换个字就悄悄失效，
         而且看不出来为什么渐变没了。 */
      heroTitle: {
        lead: "欢迎来到",
        accent: "旺仔冰子",
        tail: "的博客",
      },
      /* Hero 里那句引言（衬线体 + 左侧品牌蓝边条的引用卡） */
      heroSubtitle: "或许有天会发现，有些告别不是错付",
      /* 「当前专注」深色卡。三处文案都在这里，改内容不用碰组件。 */
      focus: {
        label: "当前专注 / CURRENT FOCUS",
        title: "把 AI 接进自己的小项目",
        description:
          "最近在系统学 Python 与 Agent 开发，边写边拆：把踩过的坑整理成文章，把一个能跑的小工具从 0 做到上线。",
        tags: ["Python", "FastAPI", "Agent", "RAG", "React"],
      },
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
          href: "/album",
          label: "相册",
          description: "随手拍的和顺手存的，摊开看",
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
      /* 下面是「从接口取文章」之后新增的状态文案。
         分开写三句，因为三件事的处理方式不一样（见 hooks/use-post.ts 的说明）：
         加载中只是等、失败可以重试、不存在重试也没用。 */
      loadFailed: "文章没能加载出来",
      missingDescription: "这篇文章可能已经被删除了，或者地址拼错了。",
      retry: "重试",
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
      /* ---------- 顶部通栏 hero ----------
         名字旁的「Agent」标签、右侧「开放工作机会」标签，以及名字下面那行统计
         （{count} 由 lib/text.ts 的 fillTemplate 填 —— 中文语序要改只动这里）。 */
      agentTag: "Agent",
      openToWork: "开放工作机会",
      articleCount: "{count} 篇文章",
      /* ---------- 左栏文章区 ----------
         规格明确要求：文章区不要「最新文章」这种区块标题，也不要「查看全部」链接。
         第 41 轮把大卡改成了轮播，所以原来的「精选」角标换成了轮播页码（01/05），
         `featuredLabel` 随之删除 —— 每张都写「精选」就不叫精选了。
         轮播的三条无障碍标签也在这里：箭头说「上一篇/下一篇」，
         指示点说「跳到第 N 篇」，幻灯片本身说「N / 总数」。 */
      carouselLabel: "文章轮播",
      carouselPrev: "上一篇",
      carouselNext: "下一篇",
      carouselSlide: "{index} / {total}",
      carouselGoto: "跳到第 {index} 篇",
      tagCloudLabel: "标签云",
      /* ---------- 右栏三张卡 ---------- */
      quoteLabel: "今日说说",
      quoteText: "如果情绪有天气，那我困在阴天里。",
      statusLabel: "此刻状态",
      liveLabel: "实时信息",
      /* 相册入口卡：标题、张数、整卡链接的无障碍名。
         {count} 由 lib/text.ts 的 fillTemplate 填，中文语序要改只动这里。 */
      albumLabel: "相册",
      albumCount: "{count} 张",
      albumOpen: "查看全部相册",
      /* 入口卡里一张图都没有时的占位。为什么是「占位」而不是「整卡藏起来」：
         这张卡是全页唯一吃 flex-1 的（右栏靠它撑高），藏掉它右栏会空一大块、
         左栏的卡被拉长，整个 profile 的版式就散了。 */
      albumEmptyHint: "还没有照片",
      /* 取文章时的两种中间状态。没有「暂无文章」这类占位文案：
         真没有文章时整个文章区不出现，页面只剩 hero + 右侧三张卡。 */
      postsLoadFailed: "文章没能加载出来",
      postsLoading: "正在加载文章…",
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
      emptyResourcesDescription:
        "还没有发布任何文章。在后台发布第一篇之后，这里就会自动出现。",
      noResultsDescription: "换一个关键词，或者清除当前搜索条件。",
      /* 以下是「从接口取文章」之后新增的三种状态文案 */
      loading: "正在加载文章…",
      loadFailed: "文章列表没能加载出来",
      retry: "重试",
    },
    /* 右侧「实时信息」卡（天气 / 湿度 / 日期）的文案。
       这里原先叫 statusBar，挂在页面底部一条横条上；第 40 轮改成右侧竖排卡片、
       横条已删掉 —— 名字跟着改，免得后来人去找一个不存在的组件。 */
    live: {
      weatherUnavailable: "天气不可用",
      humidity: "湿度",
      unknownWeather: "未知",
      /* 日期里的「周一」这类：名字按 Date.getDay() 的 0~6 索引取 */
      weekdayPrefix: "周",
      weekdays: ["日", "一", "二", "三", "四", "五", "六"],
    },
    /* 日记页：短内容聚合，没有详情路由。空态整块不渲染，不留「还没有日记」。
       数据从第 36 轮起来自 GET /api/journals（不再是构建期扫 MDX），
       所以多了「加载中 / 加载失败」两种以前不存在的状态。 */
    journal: {
      subtitle: "随手记下的片段，按日子倒着排",
      countSuffix: "则",
      loading: "正在读取日记…",
      loadFailed: "日记没加载出来",
      retry: "重试",
    },
    /* 相册页（/album）：分类筛选 + 网格 + 灯箱。
       数据在 lib/album.ts（它又从 lib/gallery.ts 取图片清单），文案全部在这里。
       counter 用 {index}/{total} 两个占位符 —— 「1 / 12」的写法要换成「第 1 张，共 12 张」
       只改这一行，不要去改灯箱组件。 */
    album: {
      title: "相册",
      subtitle: "随手拍的和顺手存的，按分类摊开看",
      countSuffix: "张",
      filtersLabel: "按分类筛选",
      categories: {
        all: "全部",
        daily: "日常",
        study: "学习",
        scenery: "风景",
      },
      loading: "正在读取照片…",
      loadFailed: "照片没读出来",
      retry: "重试",
      emptyFiltered: "这个分类下还没有照片",
      emptyFilteredHint: "换一个分类看看，或者回到「全部」。",
      /* 前台相册页的空态。⚠️ 文案里别写 /admin/album 这类后台地址 ——
         这是**访客也看得到**的页面，把后台入口写上去等于主动报门牌号。
         怎么传图是站长自己的事，后台那一侧已经有一句提示了
         （见 ui.admin.albumEmptyDescription）。 */
      empty: "还没有照片",
      emptyHint: "照片会慢慢攒起来的，过几天再来看看。",
      lightboxLabel: "图片预览",
      prev: "上一张",
      next: "下一张",
      close: "关闭预览",
      counter: "{index} / {total}",
    },
    /* 管理后台（/admin 与 /admin/login）。
       注意：这一块**不进 navigationItems** —— 后台入口不上访客导航，
       只有知道地址的人才会来，导航五项也留给了内容。 */
    admin: {
      title: "管理后台",
      pathLabel: "/admin",
      signedInAs: "当前登录的账号",
      loginTitle: "登录后台",
      loginSubtitle: "用本机 create_admin.py 建的那个账号登录。",
      loginHint: "只有作者本人需要登录，访客内容不需要账号。",
      backToSite: "返回站点",
      loginFailed: "登录没成功，稍后再试一次",
      usernameLabel: "用户名",
      passwordLabel: "密码",
      usernamePlaceholder: "admin",
      passwordPlaceholder: "至少 8 位",
      submit: "登录",
      submitting: "登录中…",
      logout: "退出登录",
      /* 顶栏的两块入口。放在顶栏而不是侧边栏：后台只有两个模块，
         一个侧边栏比内容还高，反而占地方。 */
      navLabel: "后台模块",
      navPosts: "文章",
      navJournal: "日记",
      navAlbum: "相册",
      postsTitle: "文章管理",
      postsSubtitle:
        "数据来自 FastAPI + SQLite，和 src/content 里的 MDX 文件是两套数据源。",
      loading: "加载中…",
      loadFailed: "列表没加载出来",
      retry: "重试",
      empty: "数据库里还没有文章",
      emptyDescription:
        "点右上角「新建文章」写第一篇，左边写 Markdown 右边立刻能看到排版。",
      totalPrefix: "共",
      countSuffix: "篇",
      countWithDrafts:
        "共 {total} 篇，其中草稿 {drafts} 篇（草稿只有登录后看得见）",
      deleted: "已删除「{title}」",
      /* 提示条右侧那个 × 的读屏文案。光一个「×」会被读成「乘号」，听的人一头雾水。 */
      dismissNotice: "关闭这条提示",
      colTitle: "标题",
      colCategory: "分类",
      colStatus: "状态",
      colPublishedAt: "发布日期",
      colActions: "操作",
      statusDraft: "草稿",
      statusPublished: "已发布",
      dateUnset: "未定",
      newPost: "新建文章",
      edit: "编辑",
      delete: "删除",
      deleting: "删除中…",
      deleteFailed: "删除没成功",
      deleteTitle: "确认删除这篇文章？",
      deleteBody: "「{title}」会被永久删除，找不回来（草稿和已发布都一样）。",
      deleteCancel: "取消",
      /* 保存成功后回到列表，顶部这条提示告诉用户「刚才那下确实生效了」。
         新手最容易犯嘀咕的就是「我点了保存，到底存没存」。 */
      savedPublished: "已发布「{title}」",
      savedDraft: "已存为草稿「{title}」，公开列表里看不到它",
      savedUpdated: "已保存修改「{title}」",
      formTitleNew: "新建文章",
      formTitleEdit: "编辑文章",
      formSubtitleNew:
        "左边写 Markdown，右边实时看排版效果。存为草稿只有你自己看得见。",
      formSubtitleEdit: "改完点保存，回到列表就能看到变化。",
      loadingPost: "正在读取文章…",
      loadPostFailed: "这篇文章读不出来",
      labelTitle: "标题",
      labelSlug: "slug（地址里的短名）",
      labelDescription: "描述",
      labelCategory: "分类",
      labelTags: "标签",
      labelContent: "正文（Markdown）",
      labelReadingMinutes: "阅读时长（分钟）",
      labelPublishedAt: "发布日期",
      labelIsDraft: "存为草稿",
      placeholderTitle: "例如：用 FastAPI 写第一个接口",
      placeholderSlug: "my-first-post",
      placeholderDescription: "一句话摘要，以后会显示在文章卡片上",
      placeholderCategory: "未分类",
      /* 分类留空时真正写进数据库的值。刻意和 placeholderCategory 分开写：
         以后想把输入框提示改成「例如 前端 / AI」，这里不跟着改，数据就不会跑偏。 */
      defaultCategory: "未分类",
      placeholderTags: "python, 入门",
      hintSlug:
        "只能用英文、数字、- 和 _。改标题时会自动生成，你也可以直接改。",
      hintSlugChinese:
        "标题里没有英文，自动生成不出来 —— 请自己填一个英文短名，例如 my-first-post",
      hintTags: "多个标签用逗号隔开",
      hintDraft:
        "打开后这篇文章不会出现在公开的文章列表里，只有登录的你能看到。",
      hintContent: "常用写法：# 一级标题、**加粗**、- 列表、```代码块```",

      /* ---------- 编辑器里的「上传图片」（第 37 轮） ----------
         按钮在工具栏右侧（挂到 extraCommands），也可以直接把图片拖进编辑区。
         文案写在这里而不是组件里，是为了以后想把「上传图片」改成「插图」只改一处。 */
      imageUpload: "上传图片",
      imageUploading: "正在上传图片…",
      imageUploadHint: "也可以把图片直接拖到编辑区里",
      imageDropActive: "松手就上传这张图",
      imageInserted: "已插入「{name}」",
      imageInsertedCount: "已插入 {count} 张图片",
      imageUploadFailed: "图片没传上去",
      imageUploadingCount: "正在上传 {index}/{total}：{name}",
      imageErrEmpty: "「{name}」是个空文件（0 字节），换一张吧",
      imageErrTooLarge: "「{name}」太大了（{size}），上限 5 MB，先压缩一下",
      imageErrNotImage: "「{name}」不是图片，只支持 jpg / png / webp / gif",
      imageErrBadFiles: "这些东西不是图片，跳过 {count} 个：{names}",
      save: "保存",
      saving: "保存中…",
      cancel: "取消",
      backToList: "返回列表",
      errTitle: "标题不能为空",
      errSlug: "slug 不能为空",
      errSlugFormat: "slug 只能用英文、数字、- 和 _",
      errContent: "正文不能为空",
      errReading: "阅读时长要是 1 以上的整数",

      /* ---------- 日记（/admin/journal） ----------
         日记字段少，所以没有「新建页 / 编辑页」，整块就一个页面：
         上面是输入区（新建和编辑共用），下面是列表。 */
      journalTitle: "日记管理",
      journalSubtitle:
        "两三句话就能记一条。数据来自 FastAPI + SQLite，写完前台刷新就能看到。",
      journalCountPrefix: "共",
      journalCountSuffix: "则",
      journalLoading: "正在读取日记…",
      journalLoadFailed: "日记没加载出来",
      journalEmpty: "还没有日记",
      journalEmptyDescription:
        "在上面写第一句，点保存就出现在这里，也出现在前台日记页。",
      journalLabelContent: "内容",
      journalLabelMood: "心情（可空）",
      journalPlaceholderContent: "今天……",
      journalPlaceholderMood: "例如：不错 / 卡住 / 降温",
      journalHint: "空行分段。不用写 Markdown，纯文字就行。",
      journalSave: "保存",
      journalSaving: "保存中…",
      journalEditing: "正在编辑 {date} 那一则（改完点保存）",
      journalCancelEdit: "取消编辑",
      journalSaved: "已写下这一则",
      journalUpdated: "已保存修改",
      journalDeleted: "已删除这一则",
      journalEdit: "编辑",
      errJournalContent: "内容不能为空",
      deleteJournalTitle: "确认删除这则日记？",
      deleteJournalBody: "删掉就找不回来了。",

      /* ---- 相册管理 ---- */
      albumTitle: "相册",
      albumSubtitle:
        "传图、改标题和分类、排顺序。传上去的照片会直接出现在前台相册页。",
      albumLoading: "正在读取照片…",
      albumLoadFailed: "照片没读出来",
      albumEmpty: "还没有照片",
      albumEmptyDescription: "点上面的「选择照片上传」，传完这里就有了。",
      albumCountPrefix: "共",
      albumUploadCta: "选择照片上传",
      albumUploading: "上传中…",
      albumUploadHint:
        "支持 jpg / png / webp / gif，单张不超过 5 MB；可以一次选多张，传完都在这个分类里。",
      albumCategoryLabel: "传到哪个分类",
      albumCategoryHint: "分类决定前台筛选项，写一个新的就等于新建一个分类。",
      albumFilterLabel: "按分类筛选",
      albumSaved: "已更新",
      albumDeleted: "已删掉了",
      albumUploaded: "已上传 {count} 张",
      albumSortLabel: "排序号",
      albumEditTitle: "标题",
      /* 卡片上「没填标题」时的显示。和下面那个 placeholder 是两回事：
         这个是读的时候看的，那个是写的时候看的，别合并。 */
      albumUntitled: "未命名",
      albumEditTitlePlaceholder: "留空就显示成「第 N 张」",
      albumSave: "保存",
      albumSaving: "保存中…",
      albumEdit: "改这张",
      errAlbumSort: "排序号得是 0 到 9999 之间的整数",
      deleteAlbumTitle: "确认删掉这张照片？",
      deleteAlbumBody: "记录和服务器上的文件都会删掉，找不回来。",
    },
  },
} as const
