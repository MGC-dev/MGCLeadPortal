// In-memory mock database persisted to localStorage.
// Replace this file (and the services in ./index.ts) with real DB/API calls later;
// the UI only talks to the services.
import { seed } from './mockData'
import type { Activity, AgendaItem, Campaign, Client, Invoice, Lead, LegalDocument, Matter, Message, Service } from '../types'

interface Tables {
  agenda: AgendaItem[]
  messages: Message[]
  services: Service[]
  leads: Lead[]
  clients: Client[]
  matters: Matter[]
  documents: LegalDocument[]
  invoices: Invoice[]
  campaigns: Campaign[]
  activities: Activity[]
}
const KEY = 'legal-crm-db-v5'

function load(): Tables {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return structuredClone(seed) as Tables
}

const state: Tables = load()
const listeners = new Set<() => void>()
let version = 0

export const db = {
  table<K extends keyof Tables>(name: K): Tables[K] {
    return state[name]
  },
  commit() {
    version++
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
    listeners.forEach(l => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },
  version: () => version,
  reset() {
    localStorage.removeItem(KEY)
    location.reload()
  },
}

export const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 9)}`
export const delay = <T,>(v: T, ms = 60) => new Promise<T>(r => setTimeout(() => r(v), ms))
