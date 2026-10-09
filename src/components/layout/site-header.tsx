import { HomeIcon, MenuIcon } from "lucide-react"
import { Link, useLocation } from "react-router"

import { Container } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { navigationItems, siteContent } from "@/config/site"
import { cn } from "cn"

const mobileNavigationItems = [
  { href: "/", label: siteContent.ui.header.home, icon: HomeIcon },
  ...navigationItems,
]

export function SiteHeader() {
  const { pathname } = useLocation()

  /* 首页是深色视频背景，页头要跟着换成深色半透 + 亮色文字，
     否则浅色导航压在深色画面上会割裂。其余路由维持浅色主题默认样式。 */
  const isHome = pathname === "/"

  /* 当前页高亮：精确匹配；文章详情 /resources/:slug 也算「资料」当前页 */
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/")

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-xl",
        isHome
          ? "border-white/10 bg-black/55 text-white"
          : "border-border bg-background/70"
      )}
    >
      <Container className="flex h-20 items-center gap-2">
        <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
          {navigationItems.map((item) => {
            const active = isActive(item.href)

            return (
              <Button
                asChild
                key={item.href}
                size="lg"
                variant="ghost"
                className={cn(
                  "gap-2 rounded-full px-4 text-sm",
                  isHome
                    ? "text-white/85 hover:text-white"
                    : "text-foreground",
                  active && (isHome ? "bg-white/15 text-white" : "bg-primary/10 text-primary")
                )}
              >
                <Link to={item.href}>
                  <item.icon aria-hidden="true" className="size-4" />
                  {item.label}
                </Link>
              </Button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* 暗色是唯一主题，主题切换按钮不再渲染（组件文件保留） */}

          <Button
            asChild
            className={cn(
              "hidden gap-2 rounded-full px-4 text-sm md:inline-flex",
              isHome ? "text-white/85 hover:text-white" : "text-foreground",
              isActive("/") && (isHome ? "bg-white/15 text-white" : "bg-primary/10 text-primary")
            )}
            size="lg"
            variant="ghost"
          >
            <Link to="/">
              <HomeIcon aria-hidden="true" className="size-4" />
              {siteContent.ui.header.home}
            </Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                aria-label="打开导航菜单"
                className={cn("md:hidden", isHome && "text-white hover:text-white")}
                size="icon"
                variant="ghost"
              >
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{siteContent.ui.header.menuTitle}</SheetTitle>
                <SheetDescription>
                  {siteContent.ui.header.menuDescription}
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="移动端导航" className="grid gap-1 px-4">
                {mobileNavigationItems.map((item) => {
                  const active = isActive(item.href)

                  return (
                    <SheetClose asChild key={item.href}>
                      <Button
                        asChild
                        className={cn(
                          "justify-start gap-2 rounded-full px-4 text-sm",
                          active && "bg-primary/10 text-primary"
                        )}
                        size="lg"
                        variant="ghost"
                      >
                        <Link to={item.href}>
                          <item.icon aria-hidden="true" className="size-4" />
                          {item.label}
                        </Link>
                      </Button>
                    </SheetClose>
                  )
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  )
}
