import { ImagesIcon } from "lucide-react"

import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { galleryImages } from "@/lib/gallery"

/* /gallery：把文章里用到的插图铺成网格。
   它不是一个「相册管理」页面 —— 没有上传、没有分类、没有详情路由，
   点开就是原图（新标签页）。做这么轻是有意的：这是首页「相册」入口的落地页，
   内容来自仓库里已有的图，不再编一份假数据。
   三列封顶：图多是 16:10 的宽图，四列在 1120 宽度下每张只剩 260px，细节看不清。 */
export function GalleryPage() {
  useDocumentTitle(siteContent.ui.gallery.title)

  return (
    <Container className="flex flex-col gap-10 py-10 sm:gap-12 sm:py-16">
      <div className="flex flex-col gap-3">
        <PageHeader
          icon={ImagesIcon}
          subtitle={siteContent.ui.gallery.subtitle}
          title={siteContent.ui.gallery.title}
        />
        <p className="font-mono text-xs text-faint tabular-nums">
          {galleryImages.length} {siteContent.ui.gallery.countSuffix}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {galleryImages.map((src, index) => (
          <li key={src}>
            {/* 尺寸比例固定 + object-cover：不同高度的原图不会把网格撑得参差不齐。
                新标签页打开原图，所以不需要额外做灯箱（少一层状态与焦点管理）。 */}
            <a
              className="group block overflow-hidden rounded-xl border border-border bg-secondary transition-colors outline-none hover:border-brand/40 focus-visible:ring-2 focus-visible:ring-ring/40"
              href={src}
              rel="noreferrer"
              target="_blank"
            >
              <img
                alt={`插图 ${index + 1}`}
                className="aspect-[16/10] w-full object-cover object-top"
                decoding="async"
                /* 前 6 张立即加载（首屏就能看见），其余懒加载：
                   30 张图一次全下会白等好几秒，而这些图只有滚到才需要。 */
                loading={index < 6 ? "eager" : "lazy"}
                src={src}
              />
            </a>
          </li>
        ))}
      </ul>
    </Container>
  )
}
