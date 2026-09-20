declare module "virtual:post-metadata" {
  import type { PostMetadata } from "@/types/post"

  const postMetadata: Record<string, PostMetadata>
  export default postMetadata
}
