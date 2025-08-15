// src/types/index.ts

export interface User {
  user_id: string;
  email: string;
  token: string;
}

/** Supabase uses UUID strings for IDs */
export interface Class {
  class_id: string;      // was number | null
  class_name: string;
}

export type PaymentStatus = 'paid' | 'pending' | 'overdue' | null;

export interface Student {
  student_id: string;    // already string ✅
  student_name: string;
  parent_email?: string;
  payment_status: PaymentStatus;          // was optional; make explicit and allow null
  last_payment_date?: string | null;      // allow null
  invoice_amount?: number | null;         // allow null
}

/**
 * Attendance rows add dynamic keys for each date.
 * We save dates as ISO "YYYY-MM-DD" keys → boolean (present/absent).
 */
export interface AttendanceRecord {
  student_id: string;                     // was number
  student_name: string;
  [isoDate: string]: boolean | string | undefined;
}

export interface AttendanceData {
  class_id: string;                       // was number | null
  class_name: string;
  month: string;                          // e.g. "Aug 2025"
  lesson_dates?: string[];                // ISO dates, e.g. ["2025-08-14", ...]
  data: AttendanceRecord[];
  user_id?: string;                       // was required; now optional (Supabase uses auth.uid())
}

export interface AttendanceResponse {
  ok: boolean;
  updated: number;
  month: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user_id: string;
}
