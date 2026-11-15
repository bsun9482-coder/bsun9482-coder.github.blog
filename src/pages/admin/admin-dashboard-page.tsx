/* 工作台（/admin/dashboard）—— 登录后落地的那一屏。

为什么要有这一页：
  以前登录完直接进文章列表，等于「一进门就被塞一张表格」。实际上进后台第一件事
  往往不是改文章，而是「我最近写了多少 / 先把头像换了」。

版面从上到下三块（第 46 轮重排，对齐飞书的「Banner + 宫格 + 明细」）：

  ① 欢迎 Banner —— 浅蓝渐变（#eff6ff → 白，不是深色块）+ 头像 + 名字 + 一句欢迎语 + 签名
  ② 功能宫格   —— 四张卡：工作台 / 文章 / 日记 / 相册，每张带一个数字
  ③ 个人资料   —— 原来那张表单，字段和提交逻辑一个字没改

三块背后的数据只有两条链路：

  · Banner 和资料卡共用一份 Profile（GET /api/profile，挂载时取一次）。
    刻意不分成两个请求：头像改完要**两处同时**变，分两个请求就得自己维护一致性。
  · 宫格里的三个数字各自独立（文章走后台接口含草稿、日记和相册走公开接口）。
    三个请求并发发，但**各自独立记录状态** —— 一个挂了不该把另外两个
    也变成「加载失败」。

⚠️ 这里**不跳页**：Banner 的「开放工作机会」是块状态牌，不是链接；
   点它没有去处，做成 button 式的可点区域只会让人白点一下。
*/

import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  FileTextIcon,
  ImagesIcon,
  LayoutGrid,
  NotebookPenIcon,
  RefreshCw,
  Upload,
} from "lucide-react"
import { Link } from "react-router"

import { AdminShell } from "@/components/admin/admin-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { fetchJournals } from "@/lib/api-journals"
import { getPhotos } from "@/lib/api-photos"
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  type Profile,
} from "@/lib/api-profile"
import { api } from "@/lib/api"
import { fallbackProfile } from "@/lib/site-profile"
import { fillTemplate } from "@/lib/text"
import type { AdminPost } from "@/types/admin"

/* 后台内容区的外框（宽度、内边距、块间距）统一在 components/admin/admin-shell.tsx，
   五个后台页面共用一份 —— 见那个文件顶部的说明。 */

const admin = siteContent.ui.admin

/* 表单里那四个字段。单独一个类型，是为了「回填」和「用户输入」用同一个形状：
   拿到资料就 setForm(从 profile 取四项)，提交就原样发出去，中间不用挑字段。 */
type ProfileForm = {
  name: string
  subtitle: string
  bio: string
  location: string
}

type ProfileState =
  | { status: "loading" }
  | { status: "ready"; profile: Profile }
  | { status: "error"; message: string }

/* 宫格里三个数字各自的状态。key 和下面 GRID_ITEMS 里的 key 一一对应。 */
type CountKey = "posts" | "journals" | "photos"
type CountState =
  | { status: "loading" }
  | { status: "ready"; value: number }
  | {
      status: "error"
    }

type OverviewState = Record<CountKey, CountState>

const OVERVIEW_LOADING: OverviewState = {
  posts: { status: "loading" },
  journals: { status: "loading" },
  photos: { status: "loading" },
}

/* 头像占位用的字：取名字第一个字符。
   为什么用 Array.from 而不是 name[0]：中文没问题，但 emoji / 生僻字在 JS 里是
   两个 UTF-16 单元，name[0] 会切出半个字符（显示成方块）。Array.from 按「看得见的字符」切。 */
function firstChar(name: string): string {
  const chars = Array.from(name.trim())
  return chars.length > 0 ? chars[0] : "?"
}

/* 按时段选问候语。三段而不是四段：见 site.ts 里那段说明 ——
   半夜改稿的人需要的是「晚上好」，不是一句提醒他该睡了。 */
function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return admin.greetingMorning
  if (hour < 18) return admin.greetingAfternoon
  return admin.greetingEvening
}

/* 宫格的四种配色。色值写在这儿而不是 index.css：
   它们是**装饰色**（每张卡一个色），不是品牌色，换品牌不该跟着变；
   而且只有这个文件用，进 CSS 变量只是多一处要维护。
   每项三件套：图标底色 / 图标色 / hover 时的描边色。 */
const ACCENTS = {
  brand: {
    tile: "bg-brand/10",
    icon: "text-brand",
    ring: "hover:border-brand/40",
  },
  violet: {
    tile: "bg-violet-100",
    icon: "text-violet-600",
    ring: "hover:border-violet-300",
  },
  amber: {
    tile: "bg-amber-100",
    icon: "text-amber-600",
    ring: "hover:border-amber-300",
  },
  emerald: {
    tile: "bg-emerald-100",
    icon: "text-emerald-600",
    ring: "hover:border-emerald-300",
  },
} as const

type AccentKey = keyof typeof ACCENTS

type GridItem = {
  key: CountKey
  label: string
  suffix: string
  to: string
  icon: typeof FileTextIcon
  accent: AccentKey
}

export function AdminDashboardPage() {
  useDocumentTitle(admin.dashboardTitle)

  /* ---------------- ① 资料（Banner + 表单共用） ---------------- */
  const [profileState, setProfileState] = useState<ProfileState>({
    status: "loading",
  })
  const [profileReloadKey, setProfileReloadKey] = useState(0)
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    subtitle: "",
    bio: "",
    location: "",
  })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  /* 头像图片挂掉时置 true，退回名字首字。
     为什么是 state 而不是「检测 <img> 有没有 naturalWidth」：
     后者得在渲染后再读 DOM，还得处理「还没加载完」和「真的挂了」两种情况。 */
  const [avatarBroken, setAvatarBroken] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ---------------- ② 宫格数字 ---------------- */
  const [overview, setOverview] = useState<OverviewState>(OVERVIEW_LOADING)
  const [overviewReloadKey, setOverviewReloadKey] = useState(0)

  /* 读资料。cancelled 守卫是必需的：这两个请求都可能在组件卸载后才回来
     （用户改完就去点文章了），那时 setState 会在控制台留下警告。 */
  useEffect(() => {
    let cancelled = false

    getProfile()
      .then((profile) => {
        if (cancelled) return
        setProfileState({ status: "ready", profile })
        /* 回填只发生在这里。用户开始打字之后不再覆写 ——
           否则「保存失败 → 重试成功」时正在编辑的内容会被旧值顶掉。 */
        setForm({
          name: profile.name,
          subtitle: profile.subtitle,
          bio: profile.bio,
          location: profile.location,
        })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setProfileState({
          status: "error",
          message:
            caught instanceof Error
              ? caught.message
              : admin.dashboardLoadFailed,
        })
      })

    return () => {
      cancelled = true
    }
  }, [profileReloadKey])

  /* 数三个总数。刻意分成三个独立的 promise 而不是 Promise.all：
     Promise.all 一挂全挂，一个接口抖一下，整块宫格就只剩「没数出来」。
     这里每个各写各的，哪个成了就显示哪个，失败的单独给 ×。

     ⚠️ effect 里**不重置** overview 状态（不写 setOverview(OVERVIEW_LOADING)）：
        同步 setState 会触发一次额外的渲染，eslint 的 react-hooks/set-state-in-effect
        会直接报错。重置挪到了 retryOverview 里 —— 那是用户点击时发生的事，本来就该有渲染。 */
  useEffect(() => {
    let cancelled = false

    const jobs: Array<[CountKey, Promise<number>]> = [
      /* 文章：后台视角，带 include_drafts=true —— 和文章管理页看到的条数一致。
         不能用 fetchPublishedPosts()：那是访客口径，草稿不算，两个页面会对不上。 */
      [
        "posts",
        api
          .get<AdminPost[]>("/api/posts?include_drafts=true")
          .then((list) => list.length),
      ],
      ["journals", fetchJournals().then((list) => list.length)],
      ["photos", getPhotos().then((list) => list.length)],
    ]

    for (const [key, job] of jobs) {
      job
        .then((value) => {
          if (cancelled) return
          setOverview((prev) => ({
            ...prev,
            [key]: { status: "ready", value },
          }))
        })
        .catch(() => {
          if (cancelled) return
          setOverview((prev) => ({ ...prev, [key]: { status: "error" } }))
        })
    }

    return () => {
      cancelled = true
    }
  }, [overviewReloadKey])

  function retryProfile() {
    setProfileState({ status: "loading" })
    setProfileReloadKey((key) => key + 1)
  }

  function retryOverview() {
    /* 先回到骨架态再打请求：不然点了「重试」之后画面纹丝不动，
       用户不知道到底有没有在重来（接口很快时更明显）。 */
    setOverview(OVERVIEW_LOADING)
    setOverviewReloadKey((key) => key + 1)
  }

  /* ---------------- 保存文字 ---------------- */
  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    /* 名字空着就停：后端 name 有 min_length=1，空串会回 422，
       那条错误信息（"String should have at least 1 character"）对写作者毫无帮助，
       不如在这里直接说「名字不能空着」。 */
    if (form.name.trim() === "") {
      setNameError(admin.profileNameRequired)
      return
    }

    setNameError(null)
    setSaveError(null)
    setSavedAt(null)
    setSaving(true)

    try {
      const updated = await updateProfile({
        name: form.name.trim(),
        /* 其余三项原样发（不去 trim）：后端会统一 strip 并把空串转成 null，
           这里再 trim 一遍等于把同一条规则写两处，改的时候容易只改一边。 */
        subtitle: form.subtitle,
        bio: form.bio,
        location: form.location,
      })
      setProfileState({ status: "ready", profile: updated })
      /* 用服务器回来的值回填，而不是本地 form：
         后端做了 strip 和「空串 → null」，服务器那份才是真相。
         用户会看到自己多打的空格被清掉了 —— 这正是我们希望他知道的。 */
      setForm({
        name: updated.name,
        subtitle: updated.subtitle,
        bio: updated.bio,
        location: updated.location,
      })
      setSavedAt(updated.updatedAt.slice(0, 16).replace("T", " "))
    } catch (caught: unknown) {
      /* 失败时**不动 form** —— 用户刚敲进去的东西必须留在输入框里，
         否则他会以为「我写的那段没了」，然后重新打一遍。 */
      setSaveError(
        caught instanceof Error ? caught.message : admin.profileSaveFailed
      )
    } finally {
      setSaving(false)
    }
  }

  /* ---------------- 换头像 ---------------- */
  async function handleAvatar(file: File | null | undefined) {
    if (!file) return

    setAvatarError(null)
    setSavedAt(null)
    setAvatarUploading(true)
    /* 新头像是个新文件，之前那张「裂了」的判断对这次不成立 —— 不清掉的话，
       用户换了一张好图，圆里还是名字首字，看着像没传上去。 */
    setAvatarBroken(false)

    try {
      const updated = await uploadAvatar(file)
      /* 头像的返回值是整个资料对象，所以预览直接换（Banner 和资料卡同时变，
         因为它们读的是同一个 profileState）。
         ⚠️ 这里**只换预览，不动 form** —— 用户可能正在改名字还没保存，
         拿服务器那份去覆写 form 会把他的编辑吃掉。 */
      setProfileState({ status: "ready", profile: updated })
    } catch (caught: unknown) {
      setAvatarError(
        caught instanceof Error ? caught.message : admin.profileAvatarFailed
      )
    } finally {
      setAvatarUploading(false)
      /* 选完清空 value：同一个文件再选一次不会触发 change，
         而「刚才那张没看清，我重传一次同一张」是很常见的动作。 */
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const profile = profileState.status === "ready" ? profileState.profile : null

  /* Banner 兜底：资料还没回来 / 回来了但是空的，都别让 Banner 塌成一条线。
     名字退回站点配置里那份（就是「上线前写死的」那个），签名留空。 */
  const fallback = fallbackProfile()
  const bannerName = profile?.name || fallback.name
  const bannerBio = profile?.bio || ""
  const bannerAvatar = profile?.avatarUrl || null
  const bannerInitial = firstChar(bannerName) || fallback.initial

  /* 宫格四项。工作台放在第一格（它本身也在这张表上，数字就是「4 个入口」？——
     不，那个数字没意义，所以工作台这张卡只显示「总览」，不显示计数。
     其余三张各带自己的数量。 */
  const gridItems: GridItem[] = [
    {
      key: "posts",
      label: admin.overviewPosts,
      suffix: admin.overviewCountSuffixPosts,
      to: "/admin",
      icon: FileTextIcon,
      accent: "brand",
    },
    {
      key: "journals",
      label: admin.overviewJournals,
      suffix: admin.overviewCountSuffixJournals,
      to: "/admin/journal",
      icon: NotebookPenIcon,
      accent: "violet",
    },
    {
      key: "photos",
      label: admin.overviewPhotos,
      suffix: admin.overviewCountSuffixPhotos,
      to: "/admin/album",
      icon: ImagesIcon,
      accent: "emerald",
    },
  ]

  const overviewFailed = gridItems.every(
    (item) => overview[item.key].status === "error"
  )

  return (
    <AdminShell>
      {/* ================= ① 欢迎 Banner =================
          浅蓝渐变（#eff6ff → 白），不是深色块 —— 全站唯一的深色面留给首页那张
          「当前专注」，后台不抢它的位置。
          渐变用 linear-gradient(135deg, ...) 写成 inline style 而不是 Tailwind 的
          from-/to-：那两个工具类要先声明 --tw-gradient-* 一串变量，
          在这里读起来反而不如一行 linear-gradient 直白。 */}
      <section
        aria-labelledby="dashboard-banner-title"
        className="relative overflow-hidden rounded-xl border border-border bg-card shadow-card"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #eff6ff 0%, #ffffff 62%, #ffffff 100%)",
        }}
      >
        {/* 右上一个很淡的蓝光圈：给浅色渐变一点方向感，不加会显得整块像「褪色的白」。
            pointer-events-none 是必需的，否则它会截住右侧那块状态牌的点击。 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-brand/10 blur-2xl"
        />

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            {/* ---- 头像 ----
                三种情形都长得体面：有头像显示图 / 没头像显示名字首字 /
                图片挂了也退回首字。为什么首字垫在图片**后面**而不是二选一：
                图片还在下载时圆里已经是名字了，不会先空一帧。 */}
            <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary sm:size-16">
              <span
                aria-label={admin.profileAvatarEmpty}
                className="font-heading text-[22px] leading-none font-semibold text-muted-foreground"
                role="img"
              >
                {bannerInitial}
              </span>
              {bannerAvatar && !avatarBroken && (
                /* key=地址：头像换了之后后端每次起新文件名，地址本身就变了；
                   万一遇到「地址不变、内容变了」的极端情况，换 key 能让浏览器当新元素取图。 */
                <img
                  alt={bannerName}
                  className="absolute inset-0 size-full object-cover"
                  key={bannerAvatar}
                  onError={() => setAvatarBroken(true)}
                  src={bannerAvatar}
                />
              )}
            </span>

            <div className="min-w-0">
              {/* 标题叫「欢迎语·名字」两段拼的，所以 h1 里放整句，
                  名字不再单独强调 —— 它就在这句话里。 */}
              <h1
                className="truncate font-heading text-title leading-tight font-semibold tracking-tight"
                id="dashboard-banner-title"
              >
                {fillTemplate(admin.bannerWelcome, {
                  greeting: greeting(new Date()),
                  name: bannerName,
                })}
              </h1>
              {/* 签名。为空时用一句兜底话顶上 —— Banner 只剩一行名字会显得「没加载完」。 */}
              <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {bannerBio || admin.bannerFallbackBio}
              </p>
              {profileState.status === "error" && (
                /* Banner 这块只给一句轻提示，不放大红条：
                   宫格和资料卡下面各有自己的重试入口，这里再放一个会三处打架。 */
                <p className="mt-1 text-xs leading-5 text-destructive">
                  {admin.dashboardLoadFailed}
                </p>
              )}
            </div>
          </div>

          {/* ---- 右侧：状态牌 ----
              浅色胶囊：白底 + 绿点 + 一行字。刻意不做成按钮 —— 它没有去处。 */}
          <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-border bg-background px-3 py-1.5 sm:self-auto">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-emerald-500"
            />
            <span className="text-xs font-medium whitespace-nowrap text-foreground">
              {admin.hireBadge}
            </span>
          </div>
        </div>
      </section>

      {/* ================= ② 功能宫格 =================
          断点：手机 2 列 → 平板 3 列（md）→ 桌面 4 列（xl）。
          为什么桌面要 4 列而不是「4 个卡片刚好铺满」：内容区在 1180 以内，
          4 列时每张卡约 270px，图标 + 名字 + 数字排得开；
          3 列会到 360px，卡片大而无当。 */}
      <section
        aria-labelledby="dashboard-grid-title"
        className="flex flex-col gap-3"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2
            className="font-heading text-base font-semibold tracking-tight"
            id="dashboard-grid-title"
          >
            {admin.gridTitle}
          </h2>
          <p className="hidden text-xs text-faint sm:inline">
            {admin.gridSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {/* ---- 第一格：工作台自己 ----
              它不显示计数（「工作台里有几个工作台」没有意义），改成一句定位。
              ⚠️ 不要让它跨列：手机上 2 列时第一格如果 col-span-2，
                 后面三张就全被挤到下面，一屏只剩一张卡。
              等高交给 grid 的默认 stretch，四张一样高。 */}
          <Link
            className="group flex min-h-[132px] flex-col rounded-xl border border-border bg-background p-4 transition-[border-color,box-shadow,translate] duration-200 outline-none hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-pop focus-visible:ring-3 focus-visible:ring-brand/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            to="/admin/dashboard"
          >
            <span
              className={`flex size-10 items-center justify-center rounded-lg ${ACCENTS.brand.tile}`}
            >
              <LayoutGrid
                aria-hidden="true"
                className={`size-5 ${ACCENTS.brand.icon}`}
              />
            </span>
            <span className="mt-3 font-heading text-sm font-semibold tracking-tight">
              {admin.navDashboard}
            </span>
            <span className="mt-1 text-xs leading-5 text-faint">
              {admin.navDashboardHint}
            </span>
          </Link>

          {/* ---- 另外三格：模块 + 数量 ---- */}
          {gridItems.map((item) => {
            const state = overview[item.key]
            const Icon = item.icon
            const accent = ACCENTS[item.accent]

            return (
              <Link
                className={`group flex min-h-[132px] flex-col rounded-xl border border-border bg-background p-4 transition-[border-color,box-shadow,translate] duration-200 outline-none hover:-translate-y-0.5 hover:shadow-pop focus-visible:ring-3 focus-visible:ring-brand/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${accent.ring}`}
                key={item.key}
                to={item.to}
              >
                <span
                  className={`flex size-10 items-center justify-center rounded-lg ${accent.tile}`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`size-5 ${accent.icon}`}
                  />
                </span>

                <span className="mt-3 font-heading text-sm font-semibold tracking-tight">
                  {item.label}
                </span>

                {/* 数字贴底：mt-auto 把这一行推到底部，三张卡的数字因此对齐在同一条线上。
                    骨架的宽高和真数字一样（h-7），加载完不会跳一下。 */}
                <span className="mt-auto flex items-baseline gap-1 pt-2">
                  {state.status === "loading" && (
                    <>
                      <Skeleton className="h-6 w-9 rounded-md" />
                      <span className="sr-only">{admin.dashboardLoading}</span>
                    </>
                  )}
                  {state.status === "error" && (
                    /* 单项挂了只在数字位置显示 ×，不写「失败」两个字 ——
                       那个位置只有 40px 宽，写不下。 */
                    <span
                      aria-label={admin.overviewFailed}
                      className="font-mono text-lg text-destructive"
                      role="img"
                    >
                      ×
                    </span>
                  )}
                  {state.status === "ready" && (
                    <>
                      <span className="font-heading text-[22px] leading-none font-semibold text-foreground tabular-nums">
                        {state.value}
                      </span>
                      <span className="text-xs text-faint">{item.suffix}</span>
                    </>
                  )}
                </span>
              </Link>
            )
          })}
        </div>

        {/* 三个都失败了才给重试 —— 只要还有一个是好的，用户点进去照样能看到内容，
            挂一个「重试」反而显得整块都坏了。 */}
        {overviewFailed && (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm leading-6 text-destructive" role="alert">
              {admin.dashboardLoadFailed}
            </p>
            <Button
              className="h-11"
              onClick={retryOverview}
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              {admin.retry}
            </Button>
          </div>
        )}

        <p className="text-xs leading-5 text-faint">
          {admin.overviewCardFooter}
        </p>
      </section>

      {/* ================= ③ 个人资料 ================= */}
      <Card>
        <CardHeader>
          <CardTitle>{admin.profileCardTitle}</CardTitle>
          <CardDescription>{admin.profileCardDescription}</CardDescription>
        </CardHeader>

        <CardContent>
          {profileState.status === "loading" && (
            <div aria-busy="true" className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <Skeleton className="size-16 rounded-full" />
                <Skeleton className="h-11 w-28 rounded-lg" />
              </div>
              <div className="flex flex-col gap-4">
                <Skeleton className="h-9 w-full rounded-[7px]" />
                <Skeleton className="h-9 w-full rounded-[7px]" />
                <Skeleton className="h-28 w-full rounded-[7px]" />
                <Skeleton className="h-9 w-full rounded-[7px]" />
              </div>
              <span className="sr-only">{admin.dashboardLoading}</span>
            </div>
          )}

          {profileState.status === "error" && (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
              <p className="text-sm leading-6 text-destructive" role="alert">
                {admin.dashboardLoadFailed}：{profileState.message}
              </p>
              <Button
                className="h-11"
                onClick={retryProfile}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" />
                {admin.retry}
              </Button>
            </div>
          )}

          {profile && (
            <form
              className="flex flex-col gap-5"
              noValidate
              onSubmit={handleSave}
            >
              {/* ---- 头像区 ---- */}
              <div className="flex flex-wrap items-center gap-4">
                {/* 圆形预览。三种情形都长得体面：
                     有头像        → 显示图
                     没有头像      → 显示名字首字（比一个灰头像图标更像「这是谁」）
                     头像加载失败  → 也退回首字，而不是一个裂图
                   ⚠️ 为什么需要「失败退回」：后端每次上传都换新文件名，正常不会裂；
                      但头像文件可能被人手工从服务器上删掉（uploads 目录不在版本库里），
                      那时 avatarUrl 还在、文件没了 —— 裂图比回到首字难看得多。 */}
                <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
                  <span
                    aria-label={admin.profileAvatarEmpty}
                    className="font-heading text-[22px] leading-none font-semibold text-muted-foreground"
                    role="img"
                  >
                    {firstChar(profile.name)}
                  </span>
                  {profile.avatarUrl && !avatarBroken && (
                    <img
                      alt={admin.profileCardTitle}
                      className="absolute inset-0 size-full object-cover"
                      key={profile.avatarUrl}
                      onError={() => setAvatarBroken(true)}
                      src={profile.avatarUrl}
                    />
                  )}
                </span>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <input
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={avatarUploading}
                    id="dashboard-avatar-input"
                    onChange={(event) =>
                      void handleAvatar(event.target.files?.[0])
                    }
                    ref={fileInputRef}
                    type="file"
                  />
                  <Button
                    className="h-11 w-fit"
                    disabled={avatarUploading}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    <Upload aria-hidden="true" />
                    {avatarUploading
                      ? admin.profileAvatarUploading
                      : admin.profileAvatarUpload}
                  </Button>
                  <p className="text-xs leading-5 text-faint">
                    {admin.profileAvatarHint}
                  </p>
                </div>
              </div>

              {avatarError && (
                <p
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-note leading-5 text-destructive"
                  role="alert"
                >
                  {admin.profileAvatarFailed}：{avatarError}
                </p>
              )}

              {/* ---- 四个文字字段 ---- */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {admin.profileNameLabel}
                  </span>
                  <Input
                    aria-invalid={Boolean(nameError)}
                    disabled={saving}
                    maxLength={50}
                    onChange={(event) => {
                      setForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                      setNameError(null)
                      setSavedAt(null)
                    }}
                    placeholder={admin.profileNamePlaceholder}
                    value={form.name}
                  />
                  {nameError && (
                    <span
                      className="text-xs leading-5 text-destructive"
                      role="alert"
                    >
                      {nameError}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {admin.profileSubtitleLabel}
                  </span>
                  <Input
                    disabled={saving}
                    maxLength={100}
                    onChange={(event) => {
                      setForm((prev) => ({
                        ...prev,
                        subtitle: event.target.value,
                      }))
                      setSavedAt(null)
                    }}
                    placeholder={admin.profileSubtitlePlaceholder}
                    value={form.subtitle}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {admin.profileBioLabel}
                </span>
                {/* 签名可能写好几行，所以用 textarea 而不是 Input。
                    本站没有 ui/textarea.tsx（日记页也是原生 element），
                    这里照抄日记页那套类名，保持两个输入框长得一样。
                    字号：text-base 在手机上是 16px（iOS 聚焦时不会自动放大），
                    桌面降一档到 14px —— 和 Input 组件的做法一致。 */}
                <textarea
                  className="min-h-24 w-full resize-y rounded-[7px] border border-input bg-background px-2.5 py-2 text-base leading-7 transition-colors outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 md:text-sm"
                  disabled={saving}
                  maxLength={500}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, bio: event.target.value }))
                    setSavedAt(null)
                  }}
                  placeholder={admin.profileBioPlaceholder}
                  rows={3}
                  value={form.bio}
                />
              </label>

              <label className="flex flex-col gap-1.5 sm:max-w-[50%]">
                <span className="text-xs font-medium text-muted-foreground">
                  {admin.profileLocationLabel}
                </span>
                <Input
                  disabled={saving}
                  maxLength={50}
                  onChange={(event) => {
                    setForm((prev) => ({
                      ...prev,
                      location: event.target.value,
                    }))
                    setSavedAt(null)
                  }}
                  placeholder={admin.profileLocationPlaceholder}
                  value={form.location}
                />
              </label>

              {saveError && (
                <p
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-note leading-5 text-destructive"
                  role="alert"
                >
                  {admin.profileSaveFailed}：{saveError}
                </p>
              )}

              {/* 保存后的「已保存」放在按钮右边，而不是页面顶部：
                  眼睛在按钮上，反馈就该出现在同一个视野里。
                  role="status" 让读屏软件也念一句，不依赖颜色和位置。 */}
              <div className="flex flex-wrap items-center gap-3">
                <Button className="h-11" disabled={saving} type="submit">
                  {saving ? admin.profileSaving : admin.profileSave}
                </Button>
                {savedAt && (
                  <span
                    className="font-mono text-xs text-brand tabular-nums"
                    role="status"
                  >
                    {admin.profileSaved}
                    {savedAt
                      ? ` · ${fillTemplate(admin.profileUpdatedAt, {
                          time: savedAt,
                        })}`
                      : ""}
                  </span>
                )}
              </div>
            </form>
          )}
        </CardContent>

        {/* 底部这句是给「改了没生效」的人看的：文字改动要熬过保存，
            头像不用。把这条规则贴在按钮下面，比写在文档里有用。 */}
        {profile && (
          <CardFooter className="text-xs leading-5 text-faint">
            {admin.profileCardFooter}
          </CardFooter>
        )}
      </Card>
    </AdminShell>
  )
}
