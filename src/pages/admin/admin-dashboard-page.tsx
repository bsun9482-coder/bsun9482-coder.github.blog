/* 工作台（/admin/dashboard）—— 登录后落地的那一屏。

为什么要有这一页：
  以前登录完直接进文章列表，等于「一进门就被塞一张表格」。实际上进后台第一件事
  往往不是改文章，而是「我最近写了多少 / 先把头像换了」。这一页把这两件事摆出来，
  再让人自己点去哪。

两张卡，两条完全独立的取数链路：

  ① 个人资料卡 → GET /api/profile
     表单挂载时回填（getProfile），点「保存更改」才 PUT。改文字和换头像互不影响：
     头像传完立刻生效、不用点保存；文字改完不点保存就等于没改。
     这个区别必须在界面上说清楚（提示语分开写），否则用户会以为传完头像还得再保存一次。

  ② 内容概览卡 → 三个列表接口各拿一次总数
     文章用 api.get（后台视角，含草稿，和文章管理页口径一致）；日记、相册用现成的
     公开接口封装。三个请求并发发，但**各自独立记录状态** —— 一个挂了不该把另外两个
     也变成「加载失败」，这是总览页和列表页最大的区别。

四种状态：加载中（骨架） / 出错可重试 / 正常。两卡各自维护自己的状态机，
所以这块没有「整页一个 state」，而是 profileState + overviewState 两份。
*/

import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  FileTextIcon,
  ImagesIcon,
  NotebookPenIcon,
  RefreshCw,
  Upload,
  UserRound,
} from "lucide-react"
import { Link } from "react-router"

import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
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
import type { AdminPost } from "@/types/admin"
import { fillTemplate } from "@/lib/text"

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

/* 概览三个数字各自的状态。key 和下面 OVERVIEW_ITEMS 里的 key 一一对应。 */
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

export function AdminDashboardPage() {
  useDocumentTitle(admin.dashboardTitle)

  /* ---------------- ① 资料 ---------------- */
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

  /* ---------------- ② 概览 ---------------- */
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
     Promise.all 一挂全挂，一个接口抖一下，整张卡就只剩「没数出来」。
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
      /* 头像的返回值是整个资料对象，所以预览直接换。
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

  /* 概览三项的展示数据。图标和单位走这里，页面下面那段 JSX 只负责画。 */
  const overviewItems: Array<{
    key: CountKey
    label: string
    suffix: string
    to: string
    icon: typeof FileTextIcon
  }> = [
    {
      key: "posts",
      label: admin.overviewPosts,
      suffix: admin.overviewCountSuffixPosts,
      to: "/admin",
      icon: FileTextIcon,
    },
    {
      key: "journals",
      label: admin.overviewJournals,
      suffix: admin.overviewCountSuffixJournals,
      to: "/admin/journal",
      icon: NotebookPenIcon,
    },
    {
      key: "photos",
      label: admin.overviewPhotos,
      suffix: admin.overviewCountSuffixPhotos,
      to: "/admin/album",
      icon: ImagesIcon,
    },
  ]

  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <PageHeader
        icon={UserRound}
        subtitle={admin.dashboardSubtitle}
        title={admin.dashboardTitle}
      />

      {/* 两栏在宽屏并排，窄屏上下堆。版面比例 3:2 —— 左边表单字段多，
          右边只是三个数字，等宽会让右边空一大片。 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ================= ① 个人资料 ================= */}
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
                        那时 avatarUrl 还在、文件没了 —— 裂图比回到首字难看得多。
                     为什么把首字垫在图片**后面**（不是二选一）：这样图片还在下载时，
                     圆里已经是名字了，不会先空一帧再出现图。 */}
                  <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
                    <span
                      aria-label={admin.profileAvatarEmpty}
                      className="font-heading text-[22px] leading-none font-semibold text-muted-foreground"
                      role="img"
                    >
                      {firstChar(profile.name)}
                    </span>
                    {profile.avatarUrl && !avatarBroken && (
                      /* 头像换了之后后端每次起新文件名，所以地址本身就变了。
                         加 key 是为了「同一个地址、内容变了」的极端情况：
                         换了 key 浏览器就当新元素处理，不会继续用缓存里那张。
                         同时用 object-cover：头像大多不是正方形，不裁会变形。 */
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
                      本站没有 ui/textarea.tsx（日记页也是原生 elementi），
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

        {/* ================= ② 内容概览 ================= */}
        <Card>
          <CardHeader>
            <CardTitle>{admin.overviewCardTitle}</CardTitle>
            <CardDescription>{admin.overviewCardDescription}</CardDescription>
          </CardHeader>

          <CardContent>
            <ul className="flex flex-col">
              {overviewItems.map((item, index) => {
                const state = overview[item.key]
                const Icon = item.icon

                return (
                  <li key={item.key}>
                    <Link
                      className={`-mx-2 flex items-center gap-3 rounded-lg px-2 py-3.5 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-brand/20 ${
                        index > 0 ? "border-t border-border" : ""
                      }`}
                      to={item.to}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
                        <Icon aria-hidden="true" className="size-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">
                          {item.label}
                        </span>
                        <span className="font-mono text-xs text-faint">
                          {admin.overviewGo}
                        </span>
                      </span>

                      <span className="shrink-0 text-right">
                        {state.status === "loading" && (
                          <Skeleton className="ml-auto h-6 w-10 rounded-md" />
                        )}
                        {state.status === "error" && (
                          /* 单项挂了只在数字位置显示一个 ×，不写「失败」两个字 ——
                             那个位置只有 40px 宽，写不下，而且整卡还有底部口径说明。 */
                          <span
                            aria-label={admin.overviewFailed}
                            className="font-mono text-base text-destructive"
                            role="img"
                          >
                            ×
                          </span>
                        )}
                        {state.status === "ready" && (
                          <span className="font-heading text-[22px] leading-none font-semibold text-foreground tabular-nums">
                            {state.value}
                            <span className="ml-1 text-xs font-normal text-faint">
                              {item.suffix}
                            </span>
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            {/* 三个都失败了才给重试 —— 只要还有一个是好的，用户点进去照样能看到内容，
                上面挂一个「重试」反而显得整张卡都坏了。 */}
            {overviewItems.every(
              (item) => overview[item.key].status === "error"
            ) && (
              <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
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
          </CardContent>

          <CardFooter className="text-xs leading-5 text-faint">
            {admin.overviewCardFooter}
          </CardFooter>
        </Card>
      </div>
    </Container>
  )
}
