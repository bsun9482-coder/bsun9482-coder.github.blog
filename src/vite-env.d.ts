/* 后端地址的可选覆盖项（见 src/lib/api.ts）。
   默认留空 = 请求走相对路径 /api，开发期由 vite 代理转发、线上由反代转发。
   只有当后端真的在另一个域名时才需要设它（.env.local 里写 VITE_API_BASE=https://...）。 */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
}

/* 这里以前还有一段 `declare module "virtual:post-metadata"`（构建期 MDX 清单的假模块）。
   第 38 轮随 MDX 链路一起删掉了：那个虚拟模块已经没有任何代码引用，
   留着声明只会让后来的人以为它还活着。 */
