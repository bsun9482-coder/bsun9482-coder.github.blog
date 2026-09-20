import { MenuIcon } from "lucide-react"
import { Link } from "react-router"

import { ThemeToggle } from "@/components/layout/theme-toggle"
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

const mobileNavigationItems = [{ href: "/", label: "首页" }, ...navigationItems]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
          {navigationItems.map((item) => (
            <Button
              asChild
              className="px-5 text-base"
              key={item.href}
              size="lg"
              variant="ghost"
            >
              <Link to={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          <Button
            asChild
            className="hidden md:inline-flex"
            size="lg"
            variant="ghost"
          >
            <Link to="/">首页</Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                aria-label="打开导航菜单"
                className="md:hidden"
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
              <nav aria-label="移动端导航" className="grid gap-2 px-4">
                {mobileNavigationItems.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Button
                      asChild
                      className="justify-start"
                      size="lg"
                      variant="ghost"
                    >
                      <Link to={item.href}>{item.label}</Link>
                    </Button>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
