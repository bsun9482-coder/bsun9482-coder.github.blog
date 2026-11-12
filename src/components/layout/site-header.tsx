import { MenuIcon } from "lucide-react"
import { Link, useLocation } from "react-router"

import { Container } from "@/components/layout/container"
import { PersonName } from "@/components/person-name"
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
import { cn } from "@/lib/utils"

const allNavigationItems = [
  { href: "/", label: siteContent.ui.header.home, icon: undefined },
  ...navigationItems,
]

export function SiteHeader() {
  const { pathname } = useLocation()

  /* 当前页高亮：精确匹配；文章详情 /resources/:slug 也算「文章」当前页 */
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/")

  return (
    /* 白底 + 底部 1px 细线：不用半透明、不用毛玻璃 —— 极简风格靠这条线分隔层级。
       sticky 保留（长文滚动时导航仍可用），高度从 20 收到 16，顶部不会显得厚重。 */
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <Container className="flex h-16 items-center gap-2">
        <Link
          className="flex items-center gap-2 rounded-sm text-base font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          to="/"
        >
          {/* 品牌蓝圆点：全站唯一的「点状」装饰，带一层淡光晕（样式在 .brand-dot） */}
          <span aria-hidden="true" className="brand-dot shrink-0" />
          <PersonName />
        </Link>

        <nav
          aria-label={siteContent.ui.header.navLabel}
          className="ml-auto hidden items-center gap-1 md:flex"
        >
          {allNavigationItems.map((item) => {
            const active = isActive(item.href)

            return (
              /* 活跃态：加粗 + 变深 + 底部 2px 品牌蓝（伪元素画的，不占盒高，
                 切页时导航条不会抖）。 */
              <Link
                className={cn(
                  "rounded-[7px] px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "nav-active font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                key={item.href}
                to={item.href}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                aria-label={siteContent.ui.header.menuOpen}
                className="size-11 md:hidden [&_svg]:size-5"
                size="icon-sm"
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
              <nav
                aria-label={siteContent.ui.header.mobileNavLabel}
                className="grid gap-0.5 px-3"
              >
                {allNavigationItems.map((item) => {
                  const active = isActive(item.href)

                  return (
                    <SheetClose asChild key={item.href}>
                      <Link
                        className={cn(
                          /* min-h-11：手机上菜单项的点击热区不小于 44px */
                          "flex min-h-11 items-center rounded-[7px] px-3 text-sm transition-colors",
                          active
                            ? "bg-muted font-semibold text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        to={item.href}
                      >
                        {item.label}
                      </Link>
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
