/* 相册图片清单（/album 用，经 lib/album.ts 加工成带上分类和说明的条目）。
   ⚠️ 为什么是手写清单、而不是 import.meta.glob：
   public/ 下的文件不参与打包，Vite 的 glob 扫不到它们；这些图又是文章正文里
   用绝对路径引用的（/images/...），只能在构建前就写死。
   往文章里加图时记得把文件名补到这里 —— 漏了不会报错，只是相册里少一张。
   文件夹里另有 20 张同名副本在 public/images/ 根下（文章没引用它们），
   这里只收文章真正用到的那一份，免得同一张图在相册里出现两次。 */
export const galleryImages = [
  "/images/build-your-first-ai-agent/OPEN-01-F01.webp",
  "/images/build-your-first-ai-agent/CH-01-F01.webp",
  "/images/build-your-first-ai-agent/CH-01-F02.webp",
  "/images/build-your-first-ai-agent/CH-01-F03.webp",
  "/images/build-your-first-ai-agent/CH-01-F04.webp",
  "/images/build-your-first-ai-agent/CH-02-F01.webp",
  "/images/build-your-first-ai-agent/CH-02-F02.webp",
  "/images/build-your-first-ai-agent/CH-02-F03.webp",
  "/images/build-your-first-ai-agent/CH-02-F04.webp",
  "/images/build-your-first-ai-agent/CH-02-F05.webp",
  "/images/build-your-first-ai-agent/CH-02-F06.webp",
  "/images/build-your-first-ai-agent/CH-02-F07.webp",
  "/images/build-your-first-ai-agent/CH-03-F01.webp",
  "/images/build-your-first-ai-agent/CH-03-F02.webp",
  "/images/build-your-first-ai-agent/CH-03-F03.webp",
  "/images/build-your-first-ai-agent/CH-03-F04.webp",
  "/images/build-your-first-ai-agent/CH-03-F05.webp",
  "/images/build-your-first-ai-agent/CH-03-F06.webp",
  "/images/build-your-first-ai-agent/CH-04-F01.webp",
  "/images/build-your-first-ai-agent/CH-04-F02.webp",
  "/images/build-your-first-ai-agent/CH-04-F03.webp",
  "/images/build-your-first-ai-agent/CH-04-F04.webp",
  "/images/build-your-first-ai-agent/CH-04-F05.webp",
  "/images/build-your-first-ai-agent/CH-05-F01.webp",
  "/images/build-your-first-ai-agent/CH-05-F02.webp",
  "/images/build-your-first-ai-agent/CH-05-F03.webp",
  "/images/build-your-first-ai-agent/CH-06-F01.webp",
  "/images/build-your-first-ai-agent/CH-06-F02.webp",
  "/images/build-your-first-ai-agent/CH-07-F01.webp",
  "/images/build-your-first-ai-agent/CH-07-F02.webp",
] as const
