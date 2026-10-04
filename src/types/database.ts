export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrganizationRole = "owner" | "manager" | "reception" | "professional";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "arrived"
  | "in_service"
  | "finished"
  | "cancelled"
  | "no_show";

export type AvailabilityBlockKind = "absence" | "block" | "closure";
export type NotificationChannel = "in_app" | "email" | "whatsapp" | "sms" | "push";

export type AttendanceStatus = "working" | "on_break" | "finished";
export type AttendanceSource = "self" | "pin_kiosk" | "correction";
export type AttendanceAction = "start" | "break_start" | "break_end" | "end" | "correct";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          currency: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          currency?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          timezone?: string;
          currency?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_memberships: {
        Row: {
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: OrganizationRole;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          timezone: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          timezone?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          timezone?: string;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      studio_professionals: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          display_name: string;
          email: string | null;
          phone: string | null;
          calendar_color: string;
          online_booking_enabled: boolean;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          display_name: string;
          email?: string | null;
          phone?: string | null;
          calendar_color?: string;
          online_booking_enabled?: boolean;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          email?: string | null;
          phone?: string | null;
          calendar_color?: string;
          online_booking_enabled?: boolean;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      studio_working_hours: {
        Row: {
          id: string;
          organization_id: string;
          professional_id: string;
          location_id: string;
          weekday: number;
          starts_at: string;
          ends_at: string;
          active: boolean;
          time_window: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          professional_id: string;
          location_id: string;
          weekday: number;
          starts_at: string;
          ends_at: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          weekday?: number;
          starts_at?: string;
          ends_at?: string;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      studio_working_breaks: {
        Row: {
          id: string;
          organization_id: string;
          working_hour_id: string;
          label: string | null;
          starts_at: string;
          ends_at: string;
          active: boolean;
          time_window: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          working_hour_id: string;
          label?: string | null;
          starts_at: string;
          ends_at: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string | null;
          starts_at?: string;
          ends_at?: string;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      studio_clients: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string | null;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          internal_notes: string | null;
          team_notes: string | null;
          private_notes: string | null;
          active: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id?: string | null;
          first_name: string;
          last_name?: string;
          phone?: string | null;
          email?: string | null;
          internal_notes?: string | null;
          team_notes?: string | null;
          private_notes?: string | null;
          active?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string | null;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          email?: string | null;
          internal_notes?: string | null;
          team_notes?: string | null;
          private_notes?: string | null;
          active?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      studio_appointments: {
        Row: {
          id: string;
          organization_id: string;
          location_id: string;
          client_id: string;
          status: AppointmentStatus;
          starts_at: string;
          ends_at: string;
          client_name_snapshot: string;
          client_phone_snapshot: string | null;
          operational_notes: string | null;
          cancellation_reason: string | null;
          booking_source: "studio" | "online";
          public_reference: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          location_id: string;
          client_id: string;
          status?: AppointmentStatus;
          starts_at: string;
          ends_at: string;
          client_name_snapshot: string;
          client_phone_snapshot?: string | null;
          operational_notes?: string | null;
          cancellation_reason?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: AppointmentStatus;
          starts_at?: string;
          ends_at?: string;
          operational_notes?: string | null;
          cancellation_reason?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      studio_appointment_items: {
        Row: {
          id: string;
          organization_id: string;
          appointment_id: string;
          service_id: string;
          professional_id: string;
          position: number;
          starts_at: string;
          ends_at: string;
          service_name_snapshot: string;
          professional_name_snapshot: string;
          duration_minutes: number;
          buffer_before_minutes: number;
          buffer_after_minutes: number;
          price_amount: number;
          currency: string;
          tax_rate_percent: number;
          price_includes_tax: boolean;
          blocks_time: boolean;
          occupied_range: unknown;
          actual_started_at: string | null;
          actual_finished_at: string | null;
          actual_duration_seconds: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          appointment_id: string;
          service_id: string;
          professional_id: string;
          position?: number;
          starts_at: string;
          ends_at: string;
          service_name_snapshot: string;
          professional_name_snapshot: string;
          duration_minutes: number;
          buffer_before_minutes?: number;
          buffer_after_minutes?: number;
          price_amount: number;
          currency: string;
          tax_rate_percent: number;
          price_includes_tax: boolean;
          blocks_time?: boolean;
          occupied_range?: unknown;
          actual_started_at?: string | null;
          actual_finished_at?: string | null;
          actual_duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          professional_id?: string;
          position?: number;
          starts_at?: string;
          ends_at?: string;
          professional_name_snapshot?: string;
          blocks_time?: boolean;
          actual_started_at?: string | null;
          actual_finished_at?: string | null;
          actual_duration_seconds?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      studio_availability_blocks: {
        Row: {
          id: string;
          organization_id: string;
          location_id: string | null;
          professional_id: string | null;
          block_kind: AvailabilityBlockKind;
          starts_at: string;
          ends_at: string;
          reason: string | null;
          blocked_range: unknown;
          active: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          location_id?: string | null;
          professional_id?: string | null;
          block_kind: AvailabilityBlockKind;
          starts_at: string;
          ends_at: string;
          reason?: string | null;
          active?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          location_id?: string | null;
          professional_id?: string | null;
          block_kind?: AvailabilityBlockKind;
          starts_at?: string;
          ends_at?: string;
          reason?: string | null;
          active?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          id: number;
          organization_id: string;
          event_id: number;
          channel: NotificationChannel;
          recipient_user_id: string | null;
          recipient_client_id: string | null;
          recipient_address: string | null;
          template_key: string;
          title: string;
          body: string;
          data: Json;
          status: "pending" | "sent" | "delivered" | "failed" | "skipped";
          attempts: number;
          max_attempts: number;
          next_attempt_at: string;
          locked_at: string | null;
          last_error: string | null;
          sent_at: string | null;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: never;
          organization_id: string;
          event_id: number;
          channel: NotificationChannel;
          recipient_user_id?: string | null;
          recipient_client_id?: string | null;
          recipient_address?: string | null;
          template_key: string;
          title: string;
          body: string;
          data?: Json;
          status?: "pending" | "sent" | "delivered" | "failed" | "skipped";
          attempts?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          locked_at?: string | null;
          last_error?: string | null;
          sent_at?: string | null;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "sent" | "delivered" | "failed" | "skipped";
          attempts?: number;
          next_attempt_at?: string;
          locked_at?: string | null;
          last_error?: string | null;
          sent_at?: string | null;
          read_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      studio_attendance_sessions: {
        Row: {
          id: string;
          organization_id: string;
          location_id: string | null;
          user_id: string;
          professional_id: string | null;
          started_at: string;
          ended_at: string | null;
          status: AttendanceStatus;
          source: AttendanceSource;
          corrected: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      studio_attendance_breaks: {
        Row: {
          id: string;
          organization_id: string;
          session_id: string;
          started_at: string;
          ended_at: string | null;
          kind: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      studio_attendance_events: {
        Row: {
          id: string;
          organization_id: string;
          session_id: string | null;
          user_id: string;
          actor_id: string | null;
          action: AttendanceAction;
          source: AttendanceSource;
          before_state: Json | null;
          after_state: Json | null;
          reason: string | null;
          idempotency_key: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_organization_member: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
      has_studio_capability: {
        Args: { p_organization_id: string; p_capability_key: string };
        Returns: boolean;
      };
      get_professional_day: {
        Args: { p_organization_id: string; p_date: string };
        Returns: {
          appointment_id: string;
          item_id: string;
          status: AppointmentStatus;
          starts_at: string;
          ends_at: string;
          service_name: string | null;
          professional_name: string | null;
          scheduled_duration_minutes: number | null;
          actual_started_at: string | null;
          actual_finished_at: string | null;
          actual_duration_seconds: number | null;
          client_name: string | null;
          client_team_notes: string | null;
        }[];
      };
      can_operate_studio_item: {
        Args: { p_organization_id: string; p_appointment_id: string; p_item_id: string };
        Returns: boolean;
      };
      start_studio_service: {
        Args: { p_organization_id: string; p_appointment_id: string; p_item_id: string };
        Returns: string;
      };
      finish_studio_service: {
        Args: { p_organization_id: string; p_appointment_id: string; p_item_id: string };
        Returns: { actual_finished_at: string; actual_duration_seconds: number }[];
      };
      change_studio_appointment_status: {
        Args: {
          p_organization_id: string;
          p_appointment_id: string;
          p_status: AppointmentStatus;
          p_cancellation_reason?: string | null;
        };
        Returns: undefined;
      };
      reschedule_studio_appointment: {
        Args: {
          p_organization_id: string;
          p_appointment_id: string;
          p_professional_id: string;
          p_starts_at: string;
          p_operational_notes?: string | null;
        };
        Returns: undefined;
      };
      get_studio_client_notices: {
        Args: { p_organization_id: string; p_client_ids: string[] };
        Returns: {
          client_id: string;
          notice: string;
          updated_at: string | null;
          updated_by_name: string | null;
        }[];
      };
      get_studio_availability_blocks: {
        Args: { p_organization_id: string; p_from: string; p_to: string };
        Returns: {
          block_id: string;
          block_kind: AvailabilityBlockKind;
          location_id: string | null;
          location_name: string | null;
          professional_id: string | null;
          professional_name: string | null;
          starts_at: string;
          ends_at: string;
          reason: string | null;
          can_manage: boolean;
        }[];
      };
      get_studio_agenda_v3: {
        Args: {
          p_organization_id: string;
          p_from_date: string;
          p_to_date: string;
          p_location_id?: string | null;
          p_professional_id?: string | null;
        };
        Returns: {
          appointment_id: string;
          location_id: string;
          client_id: string;
          status: AppointmentStatus;
          starts_at: string;
          ends_at: string;
          client_name: string | null;
          client_phone: string | null;
          client_email: string | null;
          client_team_notes: string | null;
          operational_notes: string | null;
          cancellation_reason: string | null;
          item_id: string;
          service_id: string;
          professional_id: string;
          service_name: string | null;
          professional_name: string | null;
          duration_minutes: number | null;
          buffer_before_minutes: number | null;
          buffer_after_minutes: number | null;
          price_amount: number | null;
          currency: string | null;
          tax_rate_percent: number | null;
          price_includes_tax: boolean | null;
          item_position: number;
          item_starts_at: string;
          item_ends_at: string;
        }[];
      };
      get_my_notifications: {
        Args: {
          p_organization_id: string;
          p_limit?: number;
          p_unread_only?: boolean;
        };
        Returns: {
          delivery_id: number;
          event_type: string;
          title: string;
          body: string;
          data: Json;
          read_at: string | null;
          created_at: string;
        }[];
      };
      count_my_unread_notifications: {
        Args: { p_organization_id: string };
        Returns: number;
      };
      mark_notification_read: {
        Args: { p_organization_id: string; p_delivery_id: number };
        Returns: undefined;
      };
      mark_all_notifications_read: {
        Args: { p_organization_id: string };
        Returns: number;
      };
      studio_attendance_clock: {
        Args: {
          p_organization_id: string;
          p_location_id: string | null;
          p_action: AttendanceAction;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      studio_attendance_clock_with_pin: {
        Args: {
          p_organization_id: string;
          p_location_id: string | null;
          p_user_id: string;
          p_pin: string;
          p_action: AttendanceAction;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      studio_attendance_kiosk_roster: {
        Args: { p_organization_id: string };
        Returns: { user_id: string; display_name: string; status: AttendanceStatus | "idle" }[];
      };
      studio_attendance_correct: {
        Args: {
          p_organization_id: string;
          p_session_id: string | null;
          p_user_id: string | null;
          p_started_at: string;
          p_ended_at: string | null;
          p_breaks: Json | null;
          p_reason: string;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      studio_attendance_can_view_team: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      get_staff_organization_settings: {
        Args: { p_organization_id: string };
        Returns: { staff_individual_time_clock_enabled: boolean };
      };
    };
  };
};
