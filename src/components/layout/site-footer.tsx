import { Separator } from "@/components/ui/separator"

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
      <Separator />
      <div className="flex flex-col gap-2 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>学习日志 · Python 与 AI 知识库</p>
        <p>内容持续更新</p>
      </div>
    </footer>
  )
}
