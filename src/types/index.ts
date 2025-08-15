// src/types/index.ts

export interface User {
  user_id: string;
  email: string;
  token: string;
}

/** Supabase uses UUID strings for IDs */
export interface Class {
  class_id: string;
  class_name: string;
}

export type PaymentStatus = 'paid' | 'pending' | 'overdue' | null;

export interface Student {
  student_id: string;
  student_name: string;
  parent_email?: string;
  payment_status: PaymentStatus;
  last_payment_date?: string | null;
  invoice_amount?: number | null;
}

/**
 * Attendance rows add dynamic keys for each date.
 * We save dates as ISO "YYYY-MM-DD" keys → boolean (present/absent).
 */
export interface AttendanceRecord {
  student_id: string;
  student_name: string;
  [isoDate: string]: boolean | string | undefined;
}

export interface AttendanceData {
  class_id: string;
  class_name: string;
  month: string;
  lesson_dates?: string[];
  data: AttendanceRecord[];
  user_id?: string;
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
