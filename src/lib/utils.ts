import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges Tailwind classes; the helper shadcn components import from "@/lib/utils". */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
