"use client"

import * as React from "react"
import {
  add,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isEqual,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from "date-fns"
import { IconChevronLeft, IconChevronRight, IconCirclePlus } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useMediaQuery } from "@/hooks/use-media-query"

export interface Event {
  id: number | string
  name: string
  time: string
  datetime: string
  /** Colour of the event's dot and bar (for example its task type). */
  color?: string
  done?: boolean
  late?: boolean
}

export interface CalendarData {
  day: Date
  events: Event[]
}

interface FullScreenCalendarProps {
  data: CalendarData[]
  /** The month to open on; defaults to this month. */
  initialMonth?: Date
  /** Shown beside the navigation, for example a Day / Week / Month switch. */
  headerEnd?: React.ReactNode
  newLabel?: string
  onNewEvent?: (day: Date) => void
  onEventClick?: (event: Event) => void
  /** Opens a day in full (the date number, or "more"). */
  onDayOpen?: (day: Date) => void
  /** Events listed in a day before "+ n more". */
  perDay?: number
}

/** Weeks start on Monday, like the rest of the portal's calendar. */
const WEEK = { weekStartsOn: 1 as const }
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const colStartClasses = ["", "col-start-2", "col-start-3", "col-start-4", "col-start-5", "col-start-6", "col-start-7"]
const mondayIndex = (d: Date) => (getDay(d) + 6) % 7

export function FullScreenCalendar({ data, initialMonth, headerEnd, newLabel = "New Event", onNewEvent, onEventClick, onDayOpen, perDay = 2 }: FullScreenCalendarProps) {
  const today = startOfToday()
  const [selectedDay, setSelectedDay] = React.useState(today)
  const [currentMonth, setCurrentMonth] = React.useState(format(initialMonth ?? today, "MMM-yyyy"))
  const firstDayCurrentMonth = parse(currentMonth, "MMM-yyyy", new Date())
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  const days = eachDayOfInterval({
    start: startOfWeek(firstDayCurrentMonth, WEEK),
    end: endOfWeek(endOfMonth(firstDayCurrentMonth), WEEK),
  })
  const weeks = days.length / 7
  const eventsOn = (day: Date) => data.filter((d) => isSameDay(d.day, day)).flatMap((d) => d.events)
  const selectedEvents = eventsOn(selectedDay)

  function previousMonth() {
    setCurrentMonth(format(add(firstDayCurrentMonth, { months: -1 }), "MMM-yyyy"))
  }
  function nextMonth() {
    setCurrentMonth(format(add(firstDayCurrentMonth, { months: 1 }), "MMM-yyyy"))
  }
  function goToToday() {
    setCurrentMonth(format(today, "MMM-yyyy"))
    setSelectedDay(today)
  }

  const dotsFor = (day: Date) => {
    const list = eventsOn(day)
    return list.length > 0 && (
      <div className="-mx-0.5 mt-auto flex flex-wrap-reverse">
        {list.map((event) => (
          <span key={event.id} className="mx-0.5 mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" style={event.color ? { background: event.color } : undefined} />
        ))}
      </div>
    )
  }

  const smallCell = (day: Date, dayIdx: number) => (
    <button
      onClick={() => setSelectedDay(day)}
      key={dayIdx}
      type="button"
      aria-pressed={isEqual(day, selectedDay)}
      aria-label={`${format(day, "EEEE, MMMM d")}${eventsOn(day).length ? `, ${eventsOn(day).length} items` : ""}`}
      className={cn(
        isEqual(day, selectedDay) && "text-primary-foreground",
        !isEqual(day, selectedDay) && !isToday(day) && isSameMonth(day, firstDayCurrentMonth) && "text-foreground",
        !isEqual(day, selectedDay) && !isToday(day) && !isSameMonth(day, firstDayCurrentMonth) && "text-muted-foreground",
        (isEqual(day, selectedDay) || isToday(day)) && "font-semibold",
        isToday(day) && !isEqual(day, selectedDay) && "text-primary",
        "flex h-14 flex-col border-b border-r px-3 py-2 hover:bg-muted focus:z-10",
      )}
    >
      <time
        dateTime={format(day, "yyyy-MM-dd")}
        className={cn("ml-auto flex size-6 items-center justify-center rounded-full", isEqual(day, selectedDay) && "bg-primary text-primary-foreground")}
      >
        {format(day, "d")}
      </time>
      {dotsFor(day)}
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Calendar Header */}
      <div className="flex flex-col space-y-4 p-4 md:flex-row md:items-center md:justify-between md:space-y-0 lg:flex-none">
        <div className="flex flex-auto">
          <div className="flex items-center gap-4">
            <div className="hidden w-20 flex-col items-center justify-center rounded-lg border bg-muted p-0.5 md:flex">
              <h1 className="p-1 text-xs uppercase text-muted-foreground">{format(today, "MMM")}</h1>
              <div className="flex w-full items-center justify-center rounded-lg border bg-card p-0.5 text-lg font-bold">
                <span>{format(today, "d")}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <h2 className="whitespace-nowrap text-lg font-semibold text-foreground" aria-live="polite">{format(firstDayCurrentMonth, "MMMM, yyyy")}</h2>
              <p className="whitespace-nowrap text-sm text-muted-foreground">
                {format(startOfMonth(firstDayCurrentMonth), "MMM d, yyyy")} - {format(endOfMonth(firstDayCurrentMonth), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 md:flex-row md:flex-wrap md:justify-end md:gap-x-6 md:gap-y-3">
          {headerEnd}
          {headerEnd && <Separator orientation="vertical" className="hidden h-6 lg:block" />}

          <div className="inline-flex w-full -space-x-px rounded-lg shadow-sm shadow-black/5 md:w-auto rtl:space-x-reverse">
            <Button onClick={previousMonth} className="rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10" variant="outline" size="icon" aria-label="Navigate to previous month">
              <IconChevronLeft size={16} stroke={2} aria-hidden="true" />
            </Button>
            <Button onClick={goToToday} className="w-full rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 md:w-auto" variant="outline">
              Today
            </Button>
            <Button onClick={nextMonth} className="rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10" variant="outline" size="icon" aria-label="Navigate to next month">
              <IconChevronRight size={16} stroke={2} aria-hidden="true" />
            </Button>
          </div>

          {onNewEvent && (
            <>
              <Separator orientation="vertical" className="hidden h-6 xl:block" />
              <Separator orientation="horizontal" className="block w-full md:hidden" />
              <Button className="w-full gap-2 md:w-auto" onClick={() => onNewEvent(selectedDay)}>
                <IconCirclePlus size={16} stroke={2} aria-hidden="true" />
                <span>{newLabel}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex min-h-0 flex-col lg:flex-auto">
        {/* Week Days Header */}
        <div className="grid grid-cols-7 border text-center text-xs font-semibold leading-6 lg:flex-none">
          {WEEKDAYS.map((d, i) => <div key={d} className={cn("py-2.5", i < 6 && "border-r")}>{d}</div>)}
        </div>

        {/* Calendar Days */}
        <div className="flex min-h-0 text-xs leading-6 lg:flex-auto">
          <div className="hidden w-full border-x lg:grid lg:grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}>
            {days.map((day, dayIdx) =>
              !isDesktop ? smallCell(day, dayIdx) : (
                <div
                  key={dayIdx}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    dayIdx === 0 && colStartClasses[mondayIndex(day)],
                    !isEqual(day, selectedDay) && !isToday(day) && !isSameMonth(day, firstDayCurrentMonth) && "bg-accent/50 text-muted-foreground",
                    "relative flex min-h-0 flex-col overflow-hidden border-b border-r hover:bg-muted focus:z-10",
                    !isEqual(day, selectedDay) && "hover:bg-accent/75",
                  )}
                >
                  <header className="flex items-center justify-between p-2.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedDay(day); onDayOpen?.(day) }}
                      aria-label={`Open ${format(day, "EEEE, MMMM d")}`}
                      className={cn(
                        isEqual(day, selectedDay) && "text-primary-foreground",
                        !isEqual(day, selectedDay) && !isToday(day) && isSameMonth(day, firstDayCurrentMonth) && "text-foreground",
                        !isEqual(day, selectedDay) && !isToday(day) && !isSameMonth(day, firstDayCurrentMonth) && "text-muted-foreground",
                        isToday(day) && !isEqual(day, selectedDay) && "text-primary",
                        isEqual(day, selectedDay) && isToday(day) && "border-none bg-primary",
                        isEqual(day, selectedDay) && !isToday(day) && "bg-foreground",
                        (isEqual(day, selectedDay) || isToday(day)) && "font-semibold",
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs hover:border",
                      )}
                    >
                      <time dateTime={format(day, "yyyy-MM-dd")}>{format(day, "d")}</time>
                    </button>
                  </header>
                  <div className="min-h-0 flex-1 px-2.5 pb-2.5">
                    {eventsOn(day).length > 0 && (
                      <div className="space-y-1.5">
                        {eventsOn(day).slice(0, perDay).map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEventClick?.(event) }}
                            className={cn("flex w-full flex-col items-start gap-1 rounded-lg border bg-muted/50 p-2 text-left text-xs leading-tight hover:bg-card", onEventClick ? "cursor-pointer" : "cursor-default")}
                            style={event.color ? { boxShadow: `inset 3px 0 0 ${event.color}` } : undefined}
                          >
                            <p className={cn("w-full truncate font-medium leading-none", event.done && "text-muted-foreground line-through")}>{event.name}</p>
                            <p className="leading-none text-muted-foreground">
                              {event.late && <span className="font-semibold text-destructive">Overdue · </span>}{event.time}
                            </p>
                          </button>
                        ))}
                        {eventsOn(day).length > perDay && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); onDayOpen?.(day) }} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                            + {eventsOn(day).length - perDay} more
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          <div className="isolate grid w-full grid-cols-7 border-x lg:hidden">
            {days.map((day, dayIdx) => smallCell(day, dayIdx))}
          </div>
        </div>

        {/* On smaller screens the chosen day's items are listed under the month. */}
        <div className="min-h-0 overflow-y-auto border-x border-b lg:hidden">
          <p className="border-b px-4 py-2 text-xs font-semibold text-muted-foreground">{format(selectedDay, "EEEE, MMMM d")}</p>
          {selectedEvents.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <ul>
              {selectedEvents.map((event) => (
                <li key={event.id} className="border-b last:border-b-0">
                  <button type="button" onClick={() => onEventClick?.(event)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted">
                    <span className="size-2 shrink-0 rounded-full bg-muted-foreground" style={event.color ? { background: event.color } : undefined} />
                    <span className={cn("min-w-0 flex-1 truncate font-medium text-foreground", event.done && "text-muted-foreground line-through")}>{event.name}</span>
                    <span className="shrink-0 text-muted-foreground">{event.late && <span className="font-semibold text-destructive">Overdue · </span>}{event.time}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
