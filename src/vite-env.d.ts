declare module "virtual:post-metadata" {
  import type { PostMetadata } from "@/types/post"

  const postMetadata: Record<string, PostMetadata>
  export default postMetadata
}

/* 后端地址的可选覆盖项（见 src/lib/api.ts）。
   默认留空 = 请求走相对路径 /api，开发期由 vite 代理转发、线上由反代转发。
   只有当后端真的在另一个域名时才需要设它（.env.local 里写 VITE_API_BASE=https://...）。 */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
}
