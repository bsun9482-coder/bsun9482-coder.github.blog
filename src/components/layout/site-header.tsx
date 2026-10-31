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
import { cn } from "cn"

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
          className="rounded-sm text-[15px] font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          to="/"
        >
          <PersonName />
        </Link>

        <nav
          aria-label="主导航"
          className="ml-auto hidden items-center gap-1 md:flex"
        >
          {allNavigationItems.map((item) => {
            const active = isActive(item.href)

            return (
              /* 活跃态只加粗 + 变深，不加彩色底 —— 点开哪页看字重就知道。 */
              <Link
                className={cn(
                  "rounded-[7px] px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "font-semibold text-foreground"
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
                aria-label="打开导航菜单"
                className="md:hidden"
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
              <nav aria-label="移动端导航" className="grid gap-0.5 px-3">
                {allNavigationItems.map((item) => {
                  const active = isActive(item.href)

                  return (
                    <SheetClose asChild key={item.href}>
                      <Link
                        className={cn(
                          "rounded-[7px] px-3 py-2 text-sm transition-colors",
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
