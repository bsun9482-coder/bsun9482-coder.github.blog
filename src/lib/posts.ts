import { lazy } from "react"
import postMetadataModules from "virtual:post-metadata"

import type { Post } from "@/types/post"
import type { MDXComponents } from "mdx/types"
import type { ComponentType } from "react"

type PostModule = {
  default: ComponentType<{ components?: MDXComponents }>
}

const postModules = import.meta.glob<PostModule>("/content/resources/*.mdx")

function getSlug(path: string) {
  const filename = path.split("/").at(-1)
  if (!filename?.endsWith(".mdx")) {
    throw new Error(`Invalid MDX post path: ${path}`)
  }

  return filename.slice(0, -4)
}

function getTimestamp(date: string) {
  const timestamp = Date.parse(date)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function createPosts(): Post[] {
  return Object.entries(postMetadataModules)
    .map(([path, metadata]) => {
      const loadContent = postModules[path]
      if (!loadContent) {
        throw new Error(`Missing compiled MDX module for ${path}`)
      }

      return {
        ...metadata,
        slug: getSlug(path),
        Content: lazy(loadContent),
      }
    })
    .filter((post) => !post.draft)
    .sort((a, b) => getTimestamp(b.date) - getTimestamp(a.date))
}

export const posts = createPosts()

export function getPostBySlug(slug: string) {
  return posts.find((post) => post.slug === slug)
}

export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`))
}
