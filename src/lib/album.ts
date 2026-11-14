import type { Photo } from "@/lib/api-photos"

/* 相册的「展示形状」：把接口数据翻成页面和灯箱认的结构。

   为什么还要有这么一层，而不是页面直接用 Photo？
   因为灯箱（components/album/album-lightbox.tsx）只关心「怎么显示」：
   它要的是 cap（说明文字）和 full（大图地址），不关心这条记录在库里排第几、
   是谁传的。把「数据来源」和「展示形状」隔开，灯箱以后换数据源也不用改。

   ⚠️ 第 43 轮之前这里是 30 张写死的占位图（文章插图，按章节硬分三类）。
      现在数据来自后端 /api/photos，后台传什么，这里就是什么 ——
      cap 用照片标题，没填标题就退成「第 N 张」。 */

export type AlbumImage = {
  /** 唯一键：灯箱、React key 都用它 */
  id: string
  /** 分类，中文，直接来自后端（日常 / 学习 / 风景 …），空串表示没分 */
  cat: string
  /** 网格 hover 遮罩和灯箱底部显示的说明文字 */
  cap: string
  /** 网格缩略图：480 宽的 webp 小图（没有缩略图时后端/适配层已兜底成原图） */
  thumb: string
  /** 灯箱大图：始终是原图 —— 点开看的就是清晰的那张，这里不做任何压缩 */
  full: string
}

/** 单条转换。index 是它在列表里的位置，只用来兜底生成说明文字。 */
export function toAlbumImage(photo: Photo, index: number): AlbumImage {
  const title = photo.title.trim()
  return {
    id: String(photo.id),
    cat: photo.category,
    cap: title || `第 ${index + 1} 张`,
    /* 格子用 thumbUrl（480 宽 webp，通常只有原图的几十分之一大），
       灯箱用 url（原图）。这一行就是整个「相册不卡」的关键：
       20 张手机照片的原图接近 60MB，缩略图加起来不到 1MB。 */
    thumb: photo.thumbUrl,
    full: photo.url,
  }
}

export function toAlbumImages(photos: Photo[]): AlbumImage[] {
  return photos.map(toAlbumImage)
}
