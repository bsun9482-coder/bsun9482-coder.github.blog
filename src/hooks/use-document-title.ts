import { useEffect } from "react"

import { siteContent } from "@/config/site"

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
      ? `${title} · ${siteContent.meta.titleSuffix}`
      : siteContent.meta.titleSuffix
  }, [title])
}
