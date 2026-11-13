import { galleryImages } from "@/lib/gallery"

/* 相册数据（/album 与 /profile 的相册入口卡共用这一份）。

   字段就是规格里那五个：id / cat / cap / thumb / full。
   · thumb 与 full 现在指向同一个文件 —— 仓库里只有一种尺寸（文章用的 webp），
     没有为相册单独压过小图。将来换成真照片时，把 thumb 指向缩略图、
     full 指向大图即可，页面代码一行都不用改。
   · cat 只有 three 类：study（学习）/ daily（日常）/ scenery（风景），
     外加「全部」这个伪分类只在页面里当筛选用，不进数据。

   ⚠️ 这是**占位数据**：30 张图其实是《动手搭建 AI 智能体》那篇文章的插图，
     所以 cap 只能是「第几章第几图」这种真实但朴素的说法；
     cat 也是按章节粗分的，不代表图片内容。
     接了真实相册之后，把下面的 map 换成手写数组最省事：
       { id: "beach-01", cat: "scenery", cap: "青岛 · 六月的海",
         thumb: "/album/beach-01-thumb.webp", full: "/album/beach-01.webp" }
     页面只认 AlbumImage 这个形状，不认来源。 */

export type AlbumCategoryId = "study" | "daily" | "scenery"

export type AlbumImage = {
  /** 唯一键：灯箱、React key、URL hash 都用它，别改成会重复的值 */
  id: string
  cat: AlbumCategoryId
  /** 网格 hover 遮罩和灯箱底部显示的说明文字 */
  cap: string
  /** 网格里用的缩略图（现在＝原图） */
  thumb: string
  /** 灯箱里用的大图（现在＝原图） */
  full: string
}

const CHAPTER_ONE = "/images/build-your-first-ai-agent/OPEN-01-F01.webp"

/** 把 /images/.../CH-03-F02.webp 解析成「第 3 章 · 图 2」；开篇那张单独处理。 */
function captionOf(src: string) {
  const file = src.split("/").pop() ?? ""
  const matched = file.match(/CH-(\d+)-F(\d+)/)
  if (!matched) return "开篇 · 图 1"
  return `第 ${Number(matched[1])} 章 · 图 ${Number(matched[2])}`
}

/** 按章节粗分三类：前两章算学习笔记，中间两章算日常，后面收尾算风景。
    这只是让筛选器有东西可筛，不代表图片内容。 */
function categoryOf(src: string): AlbumCategoryId {
  if (src === CHAPTER_ONE) return "study"
  const matched = src.match(/CH-(\d+)-F\d+/)
  const chapter = matched ? Number(matched[1]) : 1
  if (chapter <= 2) return "study"
  if (chapter <= 4) return "daily"
  return "scenery"
}

export const albumImages: AlbumImage[] = galleryImages.map((src, index) => {
  const file = (src.split("/").pop() ?? `image-${index}`).replace(/\.webp$/, "")
  return {
    id: file.toLowerCase(),
    cat: categoryOf(src),
    cap: captionOf(src),
    thumb: src,
    full: src,
  }
})
