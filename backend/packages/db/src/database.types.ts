// Generated from the MGC-02-LeadPortal Supabase project (ref fzpzyftefquczmcydmzz).
// Regenerate after every migration: pnpm --filter @mgc/db gen:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] }
type T<R, I, U = Partial<I>> = { Row: R; Insert: I; Update: U; Relationships: Rel[] }
type E = Database['public']['Enums']

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' }
  public: {
    Tables: {
      audit_log: T<
        { action: string; actor: string | null; at: string; data: Json; entity: string; entity_id: string | null; firm_id: string; id: number },
        { action: string; actor?: string | null; at?: string; data?: Json; entity: string; entity_id?: string | null; firm_id: string; id?: never }
      >
      campaign_runs: T<
        { campaign_id: string; finished_at: string | null; firm_id: string; id: string; recipients: number; started_at: string },
        { campaign_id: string; finished_at?: string | null; firm_id: string; id?: string; recipients?: number; started_at?: string }
      >
      campaigns: T<
        { active: boolean; audience: string | null; body: string; channels: E['channel'][]; created_at: string; created_by: string | null; firm_id: string; id: string; kind: E['campaign_kind']; name: string; subject: string | null; trigger: string | null },
        { active?: boolean; audience?: string | null; body: string; channels: E['channel'][]; created_at?: string; created_by?: string | null; firm_id: string; id?: string; kind: E['campaign_kind']; name: string; subject?: string | null; trigger?: string | null }
      >
      consents: T<
        { captured_at: string; channel: E['channel']; contact_id: string; evidence: Json; firm_id: string; id: number; source: string; status: E['consent_status'] },
        { captured_at?: string; channel: E['channel']; contact_id: string; evidence?: Json; firm_id: string; id?: never; source: string; status: E['consent_status'] }
      >
      contacts: T<
        { created_at: string; email: string | null; email_opted_out: boolean; firm_id: string; id: string; name: string; phone_e164: string | null; sms_opted_out: boolean; time_zone: string | null; twenty_opportunity_id: string | null; twenty_person_id: string | null; updated_at: string },
        { created_at?: string; email?: string | null; email_opted_out?: boolean; firm_id: string; id?: string; name: string; phone_e164?: string | null; sms_opted_out?: boolean; time_zone?: string | null; twenty_opportunity_id?: string | null; twenty_person_id?: string | null; updated_at?: string }
      >
      documents: T<
        { contact_id: string | null; created_at: string; documenso_id: string | null; firm_id: string; id: string; sent_at: string | null; signed_at: string | null; status: E['document_status']; storage_path: string | null; title: string; twenty_opportunity_id: string | null },
        { contact_id?: string | null; created_at?: string; documenso_id?: string | null; firm_id: string; id?: string; sent_at?: string | null; signed_at?: string | null; status?: E['document_status']; storage_path?: string | null; title: string; twenty_opportunity_id?: string | null }
      >
      firm_invites: T<
        { accepted_at: string | null; created_at: string; email: string; expires_at: string; firm_id: string; id: string; invited_by: string | null; role: E['member_role']; token: string },
        { accepted_at?: string | null; created_at?: string; email: string; expires_at?: string; firm_id: string; id?: string; invited_by?: string | null; role?: E['member_role']; token?: string }
      >
      firm_members: T<
        { created_at: string; display_name: string | null; firm_id: string; role: E['member_role']; user_id: string },
        { created_at?: string; display_name?: string | null; firm_id: string; role?: E['member_role']; user_id: string }
      >
      firm_twenty: T<
        { api_key_encrypted: string; base_url: string; created_at: string; firm_id: string; workspace_id: string },
        { api_key_encrypted: string; base_url: string; created_at?: string; firm_id: string; workspace_id: string }
      >
      firms: T<
        { created_at: string; id: string; instant_reply: string | null; name: string; postal_address: string | null; slug: string; time_zone: string },
        { created_at?: string; id?: string; instant_reply?: string | null; name: string; postal_address?: string | null; slug: string; time_zone?: string }
      >
      messages: T<
        { body: string; campaign_run_id: string | null; channel: E['channel']; contact_id: string | null; created_at: string; direction: E['message_direction']; firm_id: string; id: string; idempotency_key: string | null; provider_id: string | null; send_after: string | null; status: E['message_status']; status_reason: string | null; subject: string | null; updated_at: string },
        { body: string; campaign_run_id?: string | null; channel: E['channel']; contact_id?: string | null; created_at?: string; direction: E['message_direction']; firm_id: string; id?: string; idempotency_key?: string | null; provider_id?: string | null; send_after?: string | null; status: E['message_status']; status_reason?: string | null; subject?: string | null; updated_at?: string }
      >
      sending_setup: T<
        { email_domain: string | null; email_status: E['setup_status']; firm_id: string; resend_domain_id: string | null; sms_status: E['setup_status']; twilio_number: string | null; twilio_subaccount_sid: string | null; updated_at: string },
        { email_domain?: string | null; email_status?: E['setup_status']; firm_id: string; resend_domain_id?: string | null; sms_status?: E['setup_status']; twilio_number?: string | null; twilio_subaccount_sid?: string | null; updated_at?: string }
      >
      webhook_events: T<
        { error: string | null; external_id: string; firm_id: string | null; id: number; payload: Json; processed_at: string | null; received_at: string; signature_ok: boolean; source: string },
        { error?: string | null; external_id: string; firm_id?: string | null; id?: never; payload: Json; processed_at?: string | null; received_at?: string; signature_ok: boolean; source: string }
      >
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: {
      campaign_kind: 'automatic' | 'one_off'
      channel: 'email' | 'sms'
      consent_status: 'granted' | 'revoked'
      document_status: 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired'
      member_role: 'admin' | 'member' | 'read_only'
      message_direction: 'outbound' | 'inbound'
      message_status: 'queued' | 'held' | 'deferred' | 'sent' | 'delivered' | 'failed' | 'skipped' | 'received'
      setup_status: 'not_started' | 'pending' | 'verified' | 'failed'
    }
    CompositeTypes: { [_ in never]: never }
  }
}
