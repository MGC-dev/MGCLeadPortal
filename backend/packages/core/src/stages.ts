/** Pipeline stages, in order. A lead can be marked Lost from any stage except a closed one. */
export const STAGES = [
  { id: 'new', label: 'New Enquiry' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'consult', label: 'Consultation' },
  { id: 'contract', label: 'Contract Sent' },
  { id: 'signed', label: 'Signed' },
  { id: 'delivered', label: 'Services Provided' },
] as const;

export type OpenStage = (typeof STAGES)[number]['id'];
export type Stage = OpenStage | 'lost';

export const STAGE_IDS: readonly Stage[] = [...STAGES.map((s) => s.id), 'lost'];

export const LOST_REASONS = [
  'Went with another firm',
  'No response',
  'Fee too high',
  'Not a case we take',
  'Conflict of interest',
  'Outside our area',
  'Other',
] as const;
export type LostReason = (typeof LOST_REASONS)[number];

export const isClosed = (s: Stage): boolean => s === 'delivered' || s === 'lost';

export function stageIndex(s: Stage): number {
  return s === 'lost' ? -1 : STAGES.findIndex((x) => x.id === s);
}

/**
 * Whether a lead may move from one stage to another.
 * Leads move forward or back between open stages, can be marked lost from any open stage,
 * and a lost lead can be reopened as a new enquiry. Services Provided is final.
 */
export function canMove(from: Stage, to: Stage): boolean {
  if (from === to) return false;
  if (from === 'delivered') return false;
  if (from === 'lost') return to === 'new';
  return true;
}
