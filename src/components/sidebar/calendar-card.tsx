import { useEffect, useState } from "react"
import { CalendarDaysIcon, ClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const WEEK_START = new Date(2023, 0, 1)
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

const TIME_ZONES = [
  { label: "跟随设备时区", value: "" },
  { label: "Asia/Shanghai", value: "Asia/Shanghai" },
  { label: "Asia/Tokyo", value: "Asia/Tokyo" },
  { label: "America/New_York", value: "America/New_York" },
  { label: "Europe/London", value: "Europe/London" },
] as const

const HOLIDAYS = [
  { day: 1, month: 1, name: "元旦" },
  { day: 1, month: 5, name: "劳动节" },
  { day: 1, month: 10, name: "国庆节" },
  { day: 25, month: 12, name: "圣诞节" },
] as const

type DateParts = {
  day: number
  month: number
  year: number
}

function getDateParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  })
  const parts = formatter.formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)

  return {
    day: getPart("day"),
    month: getPart("month"),
    year: getPart("year"),
  }
}

function getNextHoliday({ day, month, year }: DateParts) {
  const currentDate = Date.UTC(year, month - 1, day)
  const nextHoliday = HOLIDAYS.find(
    (holiday) => Date.UTC(year, holiday.month - 1, holiday.day) >= currentDate
  )
  const holiday = nextHoliday ?? HOLIDAYS[0]
  const holidayYear = nextHoliday ? year : year + 1
  const holidayDate = Date.UTC(holidayYear, holiday.month - 1, holiday.day)
  const daysUntil = Math.round(
    (holidayDate - currentDate) / DAY_IN_MILLISECONDS
  )

  return {
    name: holiday.name,
    remaining: daysUntil === 0 ? "今天就是节日" : `还有 ${daysUntil} 天`,
  }
}

export function CalendarCard() {
  const [now, setNow] = useState(() => new Date())
  const [timeZone, setTimeZone] = useState("")
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const dateParts = getDateParts(now, timeZone)
  const { day, month, year } = dateParts
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const formatWithTimeZone = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("zh-CN", {
      ...options,
      ...(timeZone ? { timeZone } : {}),
    }).format(now)
  const clockLabel = formatWithTimeZone({
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    second: "2-digit",
  })
  const dateLabel = formatWithTimeZone({ day: "2-digit", month: "2-digit" })
  const monthLabel = formatWithTimeZone({ month: "long", year: "numeric" })
  const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
  })
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(WEEK_START)
    date.setDate(WEEK_START.getDate() + index)
    return weekdayFormatter.format(date).replace("周", "")
  })
  const calendarCells = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const nextHoliday = getNextHoliday(dateParts)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm text-primary">
          <ClockIcon className="size-4" />
          时间与提醒
        </CardTitle>
        <Button
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          size="sm"
          type="button"
          variant="outline"
        >
          {isExpanded ? "收起" : "展开"}
          <CalendarDaysIcon />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-3xl font-bold tracking-tight text-primary">
          {clockLabel}
        </p>

        {isExpanded ? (
          <>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>

            <div className="space-y-2">
              <label
                className="text-xs text-muted-foreground"
                htmlFor="calendar-time-zone"
              >
                当前时区
              </label>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                id="calendar-time-zone"
                onChange={(event) => setTimeZone(event.target.value)}
                value={timeZone}
              >
                {TIME_ZONES.map((zone) => (
                  <option key={zone.label} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4 border-t pt-4">
              <p className="font-medium">{monthLabel}</p>
              <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
                {weekdays.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
                {calendarCells.map((calendarDay, index) =>
                  calendarDay === null ? (
                    <span aria-hidden="true" key={`empty-${index}`} />
                  ) : (
                    <span
                      aria-current={calendarDay === day ? "date" : undefined}
                      className={cn(
                        "mx-auto flex size-7 items-center justify-center rounded-md",
                        calendarDay === day &&
                          "bg-primary font-medium text-primary-foreground"
                      )}
                      key={calendarDay}
                    >
                      {calendarDay}
                    </span>
                  )
                )}
              </div>
            </div>

            <p className="border-t pt-4 text-xs text-muted-foreground">
              下一节点 · {nextHoliday.name}（{nextHoliday.remaining}）
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
