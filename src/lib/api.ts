// src/lib/api.ts
import { supabase } from "@/integrations/supabase/client";
import type {
  LoginCredentials,
  LoginResponse,
  AttendanceData,
  AttendanceResponse,
  Class,
  Student,
} from "@/types";

const isDemo = import.meta.env.VITE_DEMO_MODE === "true";

/* ---------------- helpers ---------------- */
async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

function toISO(dateLike: string) {
  // Accept YYYY-MM-DD or anything Date can parse, normalize to YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateLike)) return dateLike;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) throw new Error(`Bad date: ${dateLike}`);
  return d.toISOString().slice(0, 10);
}

/* ---------------- AUTH ---------------- */
export const auth = {
  login: async ({ email, password }: LoginCredentials): Promise<LoginResponse> => {
    if (isDemo) return { token: "demo", user_id: "demo" };

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new Error(error?.message || "Login failed");
    }

    localStorage.setItem("auth_token", data.session.access_token);
    localStorage.setItem("user_id", data.user.id);

    return { token: data.session.access_token, user_id: data.user.id };
  },

  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_id");
  },

  isAuthenticated: () =>
    !!(localStorage.getItem("auth_token") && localStorage.getItem("user_id")),

  storeAuth: (t: string, u: string) => {
    localStorage.setItem("auth_token", t);
    localStorage.setItem("user_id", u);
  },
};

/* ---------------- CLASSES ---------------- */
export const classes = {
  // Only the current teacher's classes
  getAll: async (): Promise<Class[]> => {
    const teacher_id = await getUserId();
    const { data, error } = await supabase
      .from("classes")
      .select("id, class_name")
      .eq("teacher_id", teacher_id)
      .order("class_name", { ascending: true });

    if (error) throw new Error(error.message);

    // Map UUID -> whatever your Class type expects
    return (data ?? []).map((c) => ({
      class_id: (c.id as unknown) as any,
      class_name: c.class_name,
    })) as Class[];
  },

  create: async (class_name: string, subject?: string, hourly_rate?: number) => {
    const teacher_id = await getUserId();
    const { data, error } = await supabase
      .from("classes")
      .insert([
        {
          class_name,
          subject: subject ?? null,
          hourly_rate: hourly_rate ?? null,
          teacher_id,
        },
      ])
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return data!.id as string; // UUID
  },
};

/* ---------------- STUDENTS ---------------- */
export const students = {
  // Only the current teacher's students
  getAll: async (): Promise<Student[]> => {
    const teacher_id = await getUserId();
    const { data, error } = await supabase
      .from("students")
      .select(
        "id, student_name, parent_email, payment_status, invoice_amount, last_payment_date"
      )
      .eq("teacher_id", teacher_id)
      .order("student_name", { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map((s) => ({
      student_id: (s.id as unknown) as any, // keep compatible with your type
      student_name: s.student_name,
      parent_email: s.parent_email ?? undefined,
      payment_status: (s.payment_status ?? null) as any,
      invoice_amount: (s.invoice_amount ?? null) as any,
      last_payment_date: (s.last_payment_date ?? null) as any,
    })) as Student[];
  },

  // Returns the new student's UUID
  create: async (
    student_name: string,
    opts?: { parent_email?: string; invoice_amount?: number }
  ) => {
    const teacher_id = await getUserId();
    const { data, error } = await supabase
      .from("students")
      .insert([
        {
          student_name,
          teacher_id,
          parent_email: opts?.parent_email ?? null,
          invoice_amount: opts?.invoice_amount ?? null,
        },
      ])
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return data!.id as string;
  },

  update: async (
    student_id: string,
    fields: Partial<{
      payment_status: "paid" | "pending" | "overdue" | string;
      invoice_amount: number;
      parent_email: string;
      student_name: string;
      last_payment_date: string | null;
    }>
  ) => {
    const { error } = await supabase.from("students").update(fields).eq("id", student_id);
    if (error) throw new Error(error.message);
  },

  remove: async (student_id: string) => {
    const { error } = await supabase.from("students").delete().eq("id", student_id);
    if (error) throw new Error(error.message);
  },
};

/* ---------------- ATTENDANCE ---------------- */
/**
 * Save attendance for a class/month. Will:
 * - ensure a lesson_schedule exists for each (student, date) and create if needed
 * - upsert an attendance_records row for that schedule
 *
 * Accepts either AttendanceData or AttendanceData without `user_id`
 * (to accommodate your current types).
 */
export const attendance = {
  save: async (
    payload: AttendanceData | Omit<AttendanceData, "user_id">
  ): Promise<AttendanceResponse> => {
    const teacher_id = await getUserId();

    const class_id = (payload as any).class_id as string;
    if (!class_id) throw new Error("Please create/select a class before saving.");

    let updated = 0;

    // Each record is: { student_id: string, student_name: string, [YYYY-MM-DD]: boolean, ... }
    for (const rec of (payload as any).data as Record<string, any>[]) {
      const student_id = String(rec.student_id);

      for (const [k, v] of Object.entries(rec)) {
        // Only treat date-like keys as attendance columns
        if (!/^(?:\d{4}-\d{2}-\d{2}|[A-Za-z]{3}\s\d{2})$/.test(k)) continue;

        const lesson_date = toISO(k);
        const attended = !!v;

        // 1) Find/create schedule row
        const { data: found, error: selErr } = await supabase
          .from("lesson_schedules")
          .select("id")
          .eq("class_id", class_id)
          .eq("student_id", student_id)
          .eq("lesson_date", lesson_date)
          .maybeSingle();
        if (selErr) throw new Error(selErr.message);

        let scheduleId = found?.id as string | undefined;
        if (!scheduleId) {
          const { data: ins, error: insErr } = await supabase
            .from("lesson_schedules")
            .insert([{ class_id, student_id, lesson_date }])
            .select("id")
            .single();
          if (insErr) throw new Error(insErr.message);
          scheduleId = ins!.id;
        }

        // 2) Upsert attendance_records
        const { data: existing, error: exErr } = await supabase
          .from("attendance_records")
          .select("id")
          .eq("lesson_schedule_id", scheduleId)
          .eq("student_id", student_id)
          .maybeSingle();
        if (exErr) throw new Error(exErr.message);

        if (existing?.id) {
          const { error: updErr } = await supabase
            .from("attendance_records")
            .update({
              attended,
              recorded_at: new Date().toISOString(),
              recorded_by: teacher_id,
            })
            .eq("id", existing.id);
          if (updErr) throw new Error(updErr.message);
        } else {
          const { error: addErr } = await supabase.from("attendance_records").insert([
            {
              lesson_schedule_id: scheduleId,
              student_id,
              attended,
              recorded_at: new Date().toISOString(),
              recorded_by: teacher_id,
              notes: null,
            },
          ]);
          if (addErr) throw new Error(addErr.message);
        }

        updated += 1;
      }
    }

    return { ok: true, updated, month: (payload as any).month };
  },
};
