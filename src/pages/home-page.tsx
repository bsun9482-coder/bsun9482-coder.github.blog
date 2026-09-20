import { Link } from "react-router"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"

export function HomePage() {
  useDocumentTitle("首页")

  return (
    <div className="flex min-h-[calc(100svh-5rem)] flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-12 text-center">
        <div className="flex flex-col items-center">
          <Button asChild className="h-auto rounded-full p-0" variant="ghost">
            <Link aria-label="进入博客" to="/profile">
              <Avatar className="size-32 border sm:size-40">
                <AvatarFallback className="text-5xl sm:text-6xl">
                  {siteContent.person.avatarInitial}
                </AvatarFallback>
              </Avatar>
            </Link>
          </Button>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            {siteContent.person.name}
          </h1>
        </div>
      </main>
    </div>
  )
}
