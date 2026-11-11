"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  IconCalendar, IconCalendarWeek, IconCalendarEvent, IconChevronLeft, IconChevronRight, IconClock, IconFilter, IconList,
  IconPlus, IconSearch, IconX
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface Event {
  id: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  color: string
  category?: string
  attendees?: string[]
  tags?: string[]
  /** Shown but not editable or draggable (for example events kept elsewhere). */
  readOnly?: boolean
  /** Shown struck through and greyed. */
  done?: boolean
}

export interface EventColor { name: string; value: string; bg: string; text: string }
export type CalendarView = "month" | "week" | "day" | "list"

export interface EventManagerProps {
  events?: Event[]
  onEventCreate?: (event: Omit<Event, "id">) => void
  onEventUpdate?: (id: string, event: Partial<Event>) => void
  onEventDelete?: (id: string) => void
  categories?: string[]
  colors?: EventColor[]
  defaultView?: CalendarView
  onViewChange?: (view: CalendarView) => void
  className?: string
  availableTags?: string[]
  /** Words for the parts of an event, so they can match the product (for example tags as "Assigned to"). */
  labels?: { newEvent?: string; category?: string; tags?: string; color?: string }
  /** Only one tag per event (choosing one replaces the other). */
  singleTag?: boolean
  /** The colour follows the category, so the colour picker is hidden. */
  colorFromCategory?: (category: string) => string | undefined
  /** Extra actions in the event dialog, for example "Mark as done". */
  dialogActions?: (event: Event, close: () => void) => ReactNode
}

const defaultColors: EventColor[] = [
  { name: "Blue", value: "blue", bg: "bg-blue-500", text: "text-blue-700" },
  { name: "Green", value: "green", bg: "bg-green-500", text: "text-green-700" },
  { name: "Purple", value: "purple", bg: "bg-purple-500", text: "text-purple-700" },
  { name: "Orange", value: "orange", bg: "bg-orange-500", text: "text-orange-700" },
  { name: "Pink", value: "pink", bg: "bg-pink-500", text: "text-pink-700" },
  { name: "Red", value: "red", bg: "bg-red-500", text: "text-red-700" },
]

const HOUR = 56
const DAY_MS = 86_400_000
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
/** Weeks start on Monday. */
const startOfWeek = (d: Date) => { const s = startOfDay(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s }
const hourLabel = (h: number) => (h === 0 ? "12 AM" : h === 12 ? "12 PM" : `${h % 12} ${h < 12 ? "AM" : "PM"}`)
const timeOf = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
const toInput = (d: Date) => new Date(+d - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

/** Places overlapping events in a day side by side. */
function lanes(list: Event[]) {
  const ends: number[] = []
  const placed = list.map(e => {
    const s = +e.startTime, end = Math.max(+e.endTime, s + 25 * 60_000)
    let lane = ends.findIndex(x => x <= s)
    if (lane < 0) { lane = ends.length; ends.push(0) }
    ends[lane] = end
    return { e, s, end, lane }
  })
  return placed.map(p => ({ ...p, of: Math.max(...placed.filter(q => q.s < p.end && q.end > p.s).map(q => q.lane)) + 1 }))
}

export function EventManager({
  events: initialEvents = [], onEventCreate, onEventUpdate, onEventDelete, categories = ["Meeting", "Task", "Reminder", "Personal"],
  colors = defaultColors, defaultView = "month", onViewChange, className, availableTags = ["Important", "Urgent", "Work", "Personal", "Team", "Client"],
  labels = {}, singleTag, colorFromCategory, dialogActions,
}: EventManagerProps) {
  const L = { newEvent: "New Event", category: "Category", tags: "Tags", color: "Color", ...labels }
  const [events, setEvents] = useState<Event[]>(initialEvents)
  // keep in step with the events passed in (they change when the data behind them does)
  useEffect(() => { setEvents(initialEvents) }, [initialEvents])

  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setViewState] = useState<CalendarView>(defaultView)
  const setView = (v: CalendarView) => { setViewState(v); onViewChange?.(v) }
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [draggedEvent, setDraggedEvent] = useState<Event | null>(null)
  const [newEvent, setNewEvent] = useState<Partial<Event>>({ title: "", description: "", color: colors[0].value, category: categories[0], tags: [] })
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const filteredEvents = useMemo(() => events.filter(event => {
    const q = searchQuery.trim().toLowerCase()
    if (q && ![event.title, event.description, event.category, ...(event.tags ?? [])].some(x => x?.toLowerCase().includes(q))) return false
    if (selectedColors.length && !selectedColors.includes(event.color)) return false
    if (selectedTags.length && !event.tags?.some(t => selectedTags.includes(t))) return false
    if (selectedCategories.length && !(event.category && selectedCategories.includes(event.category))) return false
    return true
  }), [events, searchQuery, selectedColors, selectedTags, selectedCategories])

  const hasActiveFilters = selectedColors.length > 0 || selectedTags.length > 0 || selectedCategories.length > 0
  const clearFilters = () => { setSelectedColors([]); setSelectedTags([]); setSelectedCategories([]); setSearchQuery("") }
  const getColorClasses = useCallback((value: string) => colors.find(c => c.value === value) ?? colors[0], [colors])

  const openCreate = (at?: Date) => {
    const start = at ?? (() => { const d = new Date(currentDate); const h = new Date().getHours() + 1; d.setHours(h >= 8 && h <= 17 ? h : 9, 0, 0, 0); return d })()
    const cat = categories[0]
    setNewEvent({ title: "", description: "", startTime: start, endTime: new Date(+start + 30 * 60_000), category: cat, color: colorFromCategory?.(cat) ?? colors[0].value, tags: availableTags[0] && singleTag ? [availableTags[0]] : [] })
    setSelectedEvent(null); setIsCreating(true); setConfirmDelete(false); setIsDialogOpen(true)
  }
  const openEvent = (event: Event) => { setSelectedEvent(event); setIsCreating(false); setConfirmDelete(false); setIsDialogOpen(true) }
  const closeDialog = () => { setIsDialogOpen(false); setSelectedEvent(null); setIsCreating(false); setConfirmDelete(false) }

  const handleCreateEvent = () => {
    if (!newEvent.title?.trim() || !newEvent.startTime || !newEvent.endTime) return
    const event: Omit<Event, "id"> = {
      title: newEvent.title.trim(), description: newEvent.description, startTime: newEvent.startTime, endTime: newEvent.endTime,
      color: newEvent.color || colors[0].value, category: newEvent.category, attendees: newEvent.attendees, tags: newEvent.tags || [],
    }
    if (onEventCreate) onEventCreate(event)
    else setEvents(p => [...p, { ...event, id: Math.random().toString(36).slice(2, 11) }])
    closeDialog()
  }
  const handleUpdateEvent = () => {
    if (!selectedEvent) return
    setEvents(p => p.map(e => (e.id === selectedEvent.id ? selectedEvent : e)))
    onEventUpdate?.(selectedEvent.id, selectedEvent)
    closeDialog()
  }
  const handleDeleteEvent = (id: string) => { setEvents(p => p.filter(e => e.id !== id)); onEventDelete?.(id); closeDialog() }

  const handleDragStart = (event: Event) => { if (!event.readOnly) setDraggedEvent(event) }
  const handleDragEnd = () => setDraggedEvent(null)
  /** Drops onto a day (keeps the time) or onto an hour of a day. */
  const handleDrop = (date: Date, hour?: number) => {
    if (!draggedEvent) return
    const duration = +draggedEvent.endTime - +draggedEvent.startTime
    const start = new Date(date)
    if (hour === undefined) start.setHours(draggedEvent.startTime.getHours(), draggedEvent.startTime.getMinutes(), 0, 0)
    else start.setHours(hour, 0, 0, 0)
    const updated = { ...draggedEvent, startTime: start, endTime: new Date(+start + duration) }
    setEvents(p => p.map(e => (e.id === draggedEvent.id ? updated : e)))
    onEventUpdate?.(draggedEvent.id, updated)
    setDraggedEvent(null)
  }

  const navigateDate = (dir: "prev" | "next") => setCurrentDate(prev => {
    const d = new Date(prev), n = dir === "prev" ? -1 : 1
    if (view === "month") d.setMonth(d.getMonth() + n, 1)
    else if (view === "week") d.setDate(d.getDate() + 7 * n)
    else if (view === "day") d.setDate(d.getDate() + n)
    else d.setMonth(d.getMonth() + n, 1)
    return d
  })

  const title = (() => {
    if (view === "day") return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    if (view === "week") {
      const s = startOfWeek(currentDate), e = new Date(+s + 6 * DAY_MS)
      return s.getMonth() === e.getMonth()
        ? `${s.toLocaleDateString("en-US", { month: "long" })} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`
        : `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${e.getFullYear()}`
    }
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  })()

  const toggleTag = (tag: string, forCreate: boolean) => {
    const next = (tags: string[] = []) => (singleTag ? [tag] : tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag])
    if (forCreate) setNewEvent(p => ({ ...p, tags: next(p.tags) }))
    else setSelectedEvent(p => (p ? { ...p, tags: next(p.tags) } : null))
  }

  const views: [CalendarView, string, typeof IconCalendar][] = [["month", "Month", IconCalendar], ["week", "Week", IconCalendarWeek], ["day", "Day", IconClock], ["list", "List", IconList]]
  const draft = isCreating ? newEvent : selectedEvent
  const ro = !isCreating && !!selectedEvent?.readOnly
  const set = (patch: Partial<Event>) => (isCreating ? setNewEvent(p => ({ ...p, ...patch })) : setSelectedEvent(p => (p ? { ...p, ...patch } : null)))

  const filterMenu = (label: string, items: { value: string; label: ReactNode }[], sel: string[], setSel: (v: string[]) => void) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 bg-card">
          <IconFilter className="h-4 w-4" />{label}{sel.length > 0 && <Badge variant="secondary" className="ml-0.5 h-5 rounded-full px-1.5">{sel.length}</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Filter by {label.toLowerCase()}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map(it => (
          <DropdownMenuCheckboxItem key={it.value} checked={sel.includes(it.value)} onSelect={e => e.preventDefault()}
            onCheckedChange={c => setSel(c ? [...sel, it.value] : sel.filter(x => x !== it.value))}>{it.label}</DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
          <div className="ml-1 flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous" onClick={() => navigateDate("prev")}><IconChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 bg-card" onClick={() => setCurrentDate(new Date())}>Today</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next" onClick={() => navigateDate("next")}><IconChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="sm:hidden flex-1">
            <Select value={view} onValueChange={v => setView(v as CalendarView)}>
              <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>{views.map(([v, l, I]) => <SelectItem key={v} value={v}><span className="flex items-center gap-2"><I className="h-4 w-4" />{l}</span></SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="hidden items-center rounded-lg bg-muted p-0.5 sm:flex" role="group" aria-label="Calendar view">
            {views.map(([v, l, I]) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                className={cn("flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors", view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <I className="h-4 w-4" />{l}
              </button>
            ))}
          </div>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => openCreate()}><IconPlus className="h-4 w-4" />{L.newEvent}</Button>
        </div>
      </div>

      {/* search and filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search events" aria-label="Search events" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-9 bg-card pl-9 pr-8" />
          {searchQuery && (
            <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"><IconX className="h-4 w-4" /></button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!colorFromCategory && filterMenu(L.color, colors.map(c => ({ value: c.value, label: <span className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-full", c.bg)} />{c.name}</span> })), selectedColors, setSelectedColors)}
          {filterMenu(L.category, categories.map(c => ({ value: c, label: c })), selectedCategories, setSelectedCategories)}
          {availableTags.length > 0 && filterMenu(L.tags, availableTags.map(t => ({ value: t, label: t })), selectedTags, setSelectedTags)}
          {hasActiveFilters && <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={clearFilters}>Clear filters</Button>}
        </div>
      </div>
      {hasActiveFilters && (
        <div className="-mt-1 flex flex-wrap gap-1.5">
          {[...selectedColors.map(v => ["c", v, colors.find(c => c.value === v)?.name ?? v] as const), ...selectedCategories.map(v => ["k", v, v] as const), ...selectedTags.map(v => ["t", v, v] as const)].map(([k, v, l]) => (
            <Badge key={k + v} variant="secondary" className="gap-1 pr-1">{l}
              <button type="button" aria-label={`Remove ${l}`} className="rounded-sm hover:bg-black/10" onClick={() => (k === "c" ? setSelectedColors : k === "k" ? setSelectedCategories : setSelectedTags)(s => s.filter(x => x !== v))}><IconX className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}

      {/* views */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 gap-0">
        {view === "month" && <MonthView currentDate={currentDate} events={filteredEvents} onEventClick={openEvent} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDrop={handleDrop} getColorClasses={getColorClasses}
          onDayOpen={d => { setCurrentDate(d); setView("day") }} onCreate={openCreate} />}
        {view === "week" && <TimeGrid days={Array.from({ length: 7 }, (_, i) => new Date(+startOfWeek(currentDate) + i * DAY_MS + 3_600_000)).map(startOfDay)} events={filteredEvents} onEventClick={openEvent} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDrop={handleDrop} getColorClasses={getColorClasses} onCreate={openCreate} onDayOpen={d => { setCurrentDate(d); setView("day") }} />}
        {view === "day" && <TimeGrid days={[startOfDay(currentDate)]} events={filteredEvents} onEventClick={openEvent} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDrop={handleDrop} getColorClasses={getColorClasses} onCreate={openCreate} />}
        {view === "list" && <ListView currentDate={currentDate} events={filteredEvents} onEventClick={openEvent} getColorClasses={getColorClasses} />}
      </Card>

      {/* create / edit */}
      <Dialog open={isDialogOpen} onOpenChange={o => { if (!o) closeDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{isCreating ? L.newEvent : ro ? "Event" : "Edit event"}</DialogTitle>
            <DialogDescription>{isCreating ? "Add a new event to the calendar." : ro ? "This event is kept by the firm and can’t be changed here." : "Change the details, or delete it."}</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4 py-1">
              <div className="grid gap-2">
                <Label htmlFor="em-title">Title</Label>
                <Input id="em-title" autoFocus={isCreating} disabled={ro} value={draft.title ?? ""} onChange={e => set({ title: e.target.value })} placeholder="Call Rachel about her documents"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); isCreating ? handleCreateEvent() : !ro && handleUpdateEvent() } }} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="em-desc">Description</Label>
                <Textarea id="em-desc" rows={3} disabled={ro} value={draft.description ?? ""} onChange={e => set({ description: e.target.value })} placeholder="Notes" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="em-start">Starts</Label>
                  <Input id="em-start" type="datetime-local" disabled={ro} value={draft.startTime ? toInput(draft.startTime) : ""}
                    onChange={e => { if (!e.target.value) return; const s = new Date(e.target.value), dur = draft.startTime && draft.endTime ? +draft.endTime - +draft.startTime : 30 * 60_000; set({ startTime: s, endTime: new Date(+s + Math.max(dur, 0)) }) }} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="em-end">Ends</Label>
                  <Input id="em-end" type="datetime-local" disabled={ro} value={draft.endTime ? toInput(draft.endTime) : ""} min={draft.startTime ? toInput(draft.startTime) : undefined}
                    onChange={e => { if (e.target.value) set({ endTime: new Date(e.target.value) }) }} />
                </div>
              </div>
              <div className={cn("grid grid-cols-1 gap-4", !colorFromCategory && "sm:grid-cols-2")}>
                <div className="grid gap-2">
                  <Label htmlFor="em-cat">{L.category}</Label>
                  <Select disabled={ro} value={draft.category} onValueChange={v => set({ category: v, ...(colorFromCategory?.(v) ? { color: colorFromCategory(v) } : {}) })}>
                    <SelectTrigger id="em-cat"><SelectValue /></SelectTrigger>
                    <SelectContent>{(ro && draft.category && !categories.includes(draft.category) ? [draft.category, ...categories] : categories).map(c => (
                      <SelectItem key={c} value={c}><span className="flex items-center gap-2">{colorFromCategory && <span className={cn("h-3 w-3 rounded-full", getColorClasses(colorFromCategory(c) ?? "").bg)} />}{c}</span></SelectItem>
                    ))}</SelectContent>
                  </Select>
                </div>
                {!colorFromCategory && (
                  <div className="grid gap-2">
                    <Label htmlFor="em-color">{L.color}</Label>
                    <Select disabled={ro} value={draft.color} onValueChange={v => set({ color: v })}>
                      <SelectTrigger id="em-color"><SelectValue /></SelectTrigger>
                      <SelectContent>{colors.map(c => <SelectItem key={c.value} value={c.value}><span className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-full", c.bg)} />{c.name}</span></SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {availableTags.length > 0 && (
                <div className="grid gap-2">
                  <Label>{L.tags}</Label>
                  <div className="flex flex-wrap gap-1.5" role={singleTag ? "radiogroup" : "group"} aria-label={L.tags}>
                    {availableTags.map(tag => {
                      const on = !!draft.tags?.includes(tag)
                      return (
                        <button key={tag} type="button" disabled={ro} role={singleTag ? "radio" : undefined} aria-checked={singleTag ? on : undefined} aria-pressed={singleTag ? undefined : on}
                          onClick={() => toggleTag(tag, isCreating)}
                          className={cn("rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-60", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {!isCreating && selectedEvent && dialogActions && <div className="-mt-1 flex flex-wrap items-center gap-2">{dialogActions(selectedEvent, closeDialog)}</div>}
          <DialogFooter className="flex-row flex-wrap items-center justify-between gap-2 sm:justify-between sm:space-x-0">
            <div className="flex items-center gap-2">
              {!isCreating && selectedEvent && !ro && (confirmDelete ? (
                <>
                  <span className="text-sm text-muted-foreground">Delete this?</span>
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Keep</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteEvent(selectedEvent.id)}>Delete</Button>
                </>
              ) : <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>)}
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={closeDialog}>{ro ? "Close" : "Cancel"}</Button>
              {!ro && <Button onClick={isCreating ? handleCreateEvent : handleUpdateEvent} disabled={!draft?.title?.trim()}>{isCreating ? "Create" : "Save changes"}</Button>}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ViewProps {
  events: Event[]
  onEventClick: (e: Event) => void
  onDragStart: (e: Event) => void
  onDragEnd: () => void
  onDrop: (date: Date, hour?: number) => void
  getColorClasses: (v: string) => EventColor
  onCreate: (at?: Date) => void
  onDayOpen?: (d: Date) => void
}

/** One event as a solid block or chip. */
function EventCard({ event, onEventClick, onDragStart, onDragEnd, getColorClasses, variant = "default", style }: {
  event: Event; onEventClick: (e: Event) => void; onDragStart: (e: Event) => void; onDragEnd: () => void; getColorClasses: (v: string) => EventColor
  variant?: "default" | "compact" | "block"; style?: React.CSSProperties
}) {
  const c = getColorClasses(event.color)
  const bg = event.done ? "bg-[#8e8e93]" : c.bg
  const drag = !event.readOnly
  const time = `${timeOf(event.startTime)}`
  const short = variant === "block" && typeof style?.height === "number" && style.height < 40
  return (
    <button type="button" draggable={drag} onDragStart={e => { e.dataTransfer.effectAllowed = "move"; onDragStart(event) }} onDragEnd={onDragEnd}
      onClick={e => { e.stopPropagation(); onEventClick(event) }} style={style}
      title={`${event.title} · ${time}${event.category ? ` · ${event.category}` : ""}`}
      className={cn(
        "w-full min-w-0 text-left text-white transition-[filter,box-shadow] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        bg, drag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        variant === "compact" && "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-4",
        variant === "default" && "rounded-md px-2 py-1.5 text-xs",
        variant === "block" && "absolute overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-[14px] shadow-sm ring-1 ring-white/70",
        short && "flex items-center gap-1 py-0 font-medium",
      )}>
      {variant === "compact" || short ? (
        <><span className="shrink-0 tabular-nums opacity-85">{timeOf(event.startTime).replace(":00", "").replace(" ", "").toLowerCase()}</span><span className={cn("truncate", event.done && "line-through")}>{event.title}</span></>
      ) : (
        <>
          <span className={cn("block truncate font-semibold", event.done && "line-through")}>{event.title}</span>
          <span className="block truncate tabular-nums opacity-90">{time}{variant === "default" && ` – ${timeOf(event.endTime)}`}</span>
        </>
      )}
    </button>
  )
}

function MonthView({ currentDate, events, onEventClick, onDragStart, onDragEnd, onDrop, getColorClasses, onDayOpen, onCreate }: ViewProps & { currentDate: Date }) {
  const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const start = startOfWeek(first)
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const weeks = Math.ceil((((first.getDay() + 6) % 7) + lastDay.getDate()) / 7)
  const days = Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const today = new Date()
  const on = (d: Date) => events.filter(e => sameDay(e.startTime, d)).sort((a, b) => +a.startTime - +b.startTime)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map(d => <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span></div>)}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 overflow-y-auto" style={{ gridTemplateRows: `repeat(${weeks}, minmax(5.5rem, 1fr))` }}>
        {days.map((day, i) => {
          const list = on(day), inMonth = day.getMonth() === currentDate.getMonth(), isToday = sameDay(day, today)
          return (
            <div key={i} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(day)} onClick={() => onCreate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10))}
              className={cn("flex min-w-0 cursor-pointer flex-col gap-1 border-b border-r p-1 sm:p-1.5 [&:nth-child(7n)]:border-r-0 hover:bg-muted/40", !inMonth && "bg-muted/30")}>
              <button type="button" onClick={e => { e.stopPropagation(); onDayOpen?.(day) }} aria-label={day.toDateString()}
                className={cn("flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-medium tabular-nums hover:bg-muted", !inMonth && "text-muted-foreground", isToday && "bg-primary text-primary-foreground hover:bg-primary")}>
                {day.getDate()}
              </button>
              <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {list.slice(0, 3).map(e => <EventCard key={e.id} event={e} variant="compact" onEventClick={onEventClick} onDragStart={onDragStart} onDragEnd={onDragEnd} getColorClasses={getColorClasses} />)}
                {list.length > 3 && <button type="button" onClick={e => { e.stopPropagation(); onDayOpen?.(day) }} className="self-start rounded px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">+{list.length - 3} more</button>}
              </div>
              {list.length > 0 && (
                <button type="button" onClick={e => { e.stopPropagation(); onDayOpen?.(day) }} className="flex flex-wrap gap-0.5 sm:hidden" aria-label={`${list.length} events`}>
                  {list.slice(0, 4).map(e => <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", e.done ? "bg-[#8e8e93]" : getColorClasses(e.color).bg)} />)}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Week (seven days) or day (one day) on an hour grid. Opens at 7 AM, or just before now. */
function TimeGrid({ days, events, onEventClick, onDragStart, onDragEnd, onDrop, getColorClasses, onCreate, onDayOpen }: ViewProps & { days: Date[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t) }, [])
  const key = days[0].toDateString() + days.length
  useEffect(() => {
    const h = new Date().getHours(), showsToday = days.some(d => sameDay(d, new Date()))
    if (scroller.current) scroller.current.scrollTop = (showsToday && h >= 9 && h <= 18 ? h - 2 : 7) * HOUR - 6
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const cols = `3.5rem repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid border-b" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map(d => {
          const t = sameDay(d, now)
          const Head = onDayOpen ? "button" : "div"
          return (
            <Head key={d.toDateString()} {...(onDayOpen ? { type: "button" as const, onClick: () => onDayOpen(d) } : {})}
              className={cn("flex flex-col items-center gap-0.5 border-l py-2 text-xs font-medium text-muted-foreground", onDayOpen && "hover:bg-muted/40")}>
              <span className="uppercase tracking-wide">{d.toLocaleDateString("en-US", { weekday: days.length > 1 ? "short" : "long" })}</span>
              <span className={cn("flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-base font-semibold tabular-nums text-foreground", t && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
            </Head>
          )
        })}
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative grid" style={{ gridTemplateColumns: cols }}>
          {hours.map(h => (
            <Fragment key={h}>
              <div className="relative h-14 pr-2 text-right text-[11px] tabular-nums text-muted-foreground"><span className="relative -top-2">{h > 0 && hourLabel(h)}</span></div>
              {days.map(d => (
                <div key={d.toDateString()} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(d, h)}
                  onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), half = e.clientY - r.top > r.height / 2 ? 30 : 0; onCreate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, half)) }}
                  className="h-14 cursor-pointer border-l border-t hover:bg-muted/40" aria-hidden="true" />
              ))}
            </Fragment>
          ))}
          {/* events, laid over the grid per day */}
          {days.map((d, di) => {
            const list = lanes(events.filter(e => sameDay(e.startTime, d)).sort((a, b) => +a.startTime - +b.startTime))
            const base = +startOfDay(d)
            return (
              <div key={d.toDateString()} className="pointer-events-none absolute top-0 bottom-0" style={{ left: `calc(3.5rem + (100% - 3.5rem) * ${di / days.length})`, width: `calc((100% - 3.5rem) / ${days.length})` }}>
                {list.map(({ e, s, end, lane, of }) => {
                  const top = ((s - base) / 3_600_000) * HOUR, height = Math.max(((end - s) / 3_600_000) * HOUR - 2, 22)
                  return (
                    <div key={e.id} className="pointer-events-auto">
                      <EventCard event={e} variant="block" onEventClick={onEventClick} onDragStart={onDragStart} onDragEnd={onDragEnd} getColorClasses={getColorClasses}
                        style={{ top: top + 1, height, left: `calc(${(lane / of) * 100}% + 2px)`, width: `calc(${100 / of}% - 4px)` }} />
                    </div>
                  )
                })}
                {sameDay(d, now) && (
                  <div className="absolute left-0 right-0 z-10 h-0.5 bg-destructive" style={{ top: ((+now - base) / 3_600_000) * HOUR }}>
                    <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-destructive" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Everything in the month, by day. */
function ListView({ currentDate, events, onEventClick, getColorClasses }: { currentDate: Date; events: Event[]; onEventClick: (e: Event) => void; getColorClasses: (v: string) => EventColor }) {
  const inMonth = events.filter(e => e.startTime.getMonth() === currentDate.getMonth() && e.startTime.getFullYear() === currentDate.getFullYear()).sort((a, b) => +a.startTime - +b.startTime)
  const groups = inMonth.reduce<Record<string, Event[]>>((g, e) => { const k = startOfDay(e.startTime).toDateString(); (g[k] ||= []).push(e); return g }, {})
  const today = new Date()
  if (!inMonth.length) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
      <IconCalendarEvent className="h-8 w-8" stroke={1.5} />
      <p className="text-sm">Nothing this month.</p>
    </div>
  )
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {Object.entries(groups).map(([k, list]) => {
        const d = new Date(k), t = sameDay(d, today)
        return (
          <section key={k}>
            <h3 className={cn("sticky top-0 z-[1] border-b bg-card/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur", t ? "text-primary" : "text-muted-foreground")}>
              {t ? "Today · " : ""}{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h3>
            <ul>
              {list.map(e => {
                const c = getColorClasses(e.color)
                return (
                  <li key={e.id} className="border-b last:border-b-0">
                    <button type="button" onClick={() => onEventClick(e)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40">
                      <span className={cn("mt-1 h-9 w-1 shrink-0 rounded-full", e.done ? "bg-[#8e8e93]" : c.bg)} aria-hidden="true" />
                      <span className="w-20 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">{timeOf(e.startTime)}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-semibold", e.done && "text-muted-foreground line-through")}>{e.title}</span>
                        {e.description && <span className="block truncate text-sm text-muted-foreground">{e.description}</span>}
                        <span className="mt-1 flex flex-wrap gap-1">
                          {e.category && <Badge variant="secondary" className="font-normal">{e.category}</Badge>}
                          {e.tags?.map(t => <Badge key={t} variant="outline" className="font-normal">{t}</Badge>)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

