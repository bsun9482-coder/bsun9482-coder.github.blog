import { BookOpenIcon, CodeXmlIcon } from "lucide-react"

import { ArticleCard } from "@/components/article/article-card"
import { CalendarCard } from "@/components/sidebar/calendar-card"
import { MusicPlayerCard } from "@/components/sidebar/music-player-card"
import { WeatherCard } from "@/components/sidebar/weather-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Separator } from "@/components/ui/separator"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { posts } from "@/lib/posts"

export function ProfilePage() {
  useDocumentTitle("博客")

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
          {siteContent.ui.profile.heroEyebrow}
        </p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight sm:text-6xl">
          {siteContent.ui.profile.heroTitle}
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          {siteContent.ui.profile.heroSubtitle}
        </p>
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[18rem_minmax(0,1fr)_15rem]">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <Avatar className="size-20">
                <AvatarImage
                  alt={siteContent.person.name}
                  src={siteContent.person.avatarUrl}
                />
                <AvatarFallback className="text-2xl">
                  {siteContent.person.avatarInitial}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="mt-3">{siteContent.person.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-7 text-muted-foreground">
                {siteContent.person.introduction}
              </p>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpenIcon className="size-4" />
                {siteContent.blog.publicResources}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">联系方式</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild className="justify-start" variant="outline">
                <a
                  href={siteContent.links.github.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <CodeXmlIcon />
                  {siteContent.links.github.label}
                </a>
              </Button>
            </CardContent>
          </Card>

          <MusicPlayerCard />
        </aside>

        <main className="min-w-0 space-y-12">
          <section aria-label="博客轮播">
            <Carousel className="px-12" opts={{ loop: true }}>
              <CarouselContent>
                {siteContent.profileSlides.map((slide) => (
                  <CarouselItem key={slide.eyebrow}>
                    <Card className="min-h-56 justify-center">
                      <CardHeader>
                        <p className="text-sm font-medium text-primary">
                          {slide.eyebrow}
                        </p>
                        <CardTitle className="text-2xl">
                          {slide.title}
                        </CardTitle>
                        <CardDescription className="text-base leading-7">
                          {slide.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-0" />
              <CarouselNext className="right-0" />
            </Carousel>
          </section>

          <section aria-labelledby="profile-latest-resources">
            <div className="mb-6">
              <p className="text-sm font-medium text-primary">
                {siteContent.ui.profile.writing}
              </p>
              <h2
                className="mt-2 text-2xl font-semibold tracking-tight"
                id="profile-latest-resources"
              >
                {siteContent.ui.profile.latestResources}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {siteContent.blog.latestResources}
              </p>
            </div>
            {posts.length > 0 ? (
              <div className="grid gap-4">
                {posts.slice(0, 3).map((post) => (
                  <ArticleCard key={post.slug} post={post} />
                ))}
              </div>
            ) : (
              <Card className="border-dashed py-10 text-center">
                <CardContent>
                  <BookOpenIcon className="mx-auto size-8 text-muted-foreground" />
                  <h3 className="mt-4 font-medium">
                    {siteContent.ui.profile.emptyResources}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {siteContent.ui.profile.emptyResourcesDescription}
                  </p>
                </CardContent>
              </Card>
            )}
          </section>
        </main>

        <aside className="grid gap-4 self-start sm:grid-cols-2 lg:block lg:space-y-4">
          <WeatherCard />
          <CalendarCard />
        </aside>
      </div>
    </div>
  )
}
