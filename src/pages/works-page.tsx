import { FolderGit2Icon } from "lucide-react"

import { Reveal } from "@/components/fx/reveal"
import { TiltCard } from "@/components/fx/tilt-card"
import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import { CardContent } from "@/components/ui/card"
import { pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"

/* /works：项目页。
   目前没有项目数据源，所以整页就是「页头 + 一张说明卡」。
   ⚠️ 这张说明卡是用户明确要求保留的（2026-11-11：「没有项目的话改回原来的样子」）——
   之前按「空模块不渲染」的规矩删过，结果页面只剩一行标题，看着像坏了。
   等他真的写了第一个项目，把卡片换成文章列表那套网格、只在没数据时才显示这张卡。 */
export function WorksPage() {
  useDocumentTitle(pageNameOf("/works"))

  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <PageHeader
        icon={FolderGit2Icon}
        subtitle={siteContent.ui.works.subtitle}
        title={pageNameOf("/works")}
      />

      <section aria-labelledby="works-list">
        {/* 区块名只给读屏器念：视觉上不需要再多一行标题，卡片自己说明白了 */}
        <h2 className="sr-only" id="works-list">
          {siteContent.ui.works.listTitle}
        </h2>
        <Reveal delay={100}>
          <TiltCard className="border-dashed py-16 text-center">
            <CardContent>
              <FolderGit2Icon className="mx-auto size-10 text-muted-foreground" />
              <h3 className="mt-5 text-lg font-medium">
                {siteContent.ui.works.emptyTitle}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {siteContent.ui.works.emptyDescription}
              </p>
            </CardContent>
          </TiltCard>
        </Reveal>
      </section>
    </Container>
  )
}
