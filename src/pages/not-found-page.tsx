import { FileQuestionIcon } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type NotFoundPageProps = {
  compact?: boolean
}

export function NotFoundPage({ compact = false }: NotFoundPageProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl items-center px-4 py-16 sm:px-6",
        !compact && "min-h-[65vh]"
      )}
    >
      <Card className="w-full py-12 text-center">
        <CardContent>
          <FileQuestionIcon className="mx-auto mb-5 size-10 text-muted-foreground" />
          <p className="text-sm font-medium text-primary">404</p>
          <h1 className="mt-2 text-2xl font-semibold">没有找到这个页面</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            页面可能已被移动，或者链接地址有误。
          </p>
          <Button asChild className="mt-6">
            <Link to="/">返回首页</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
