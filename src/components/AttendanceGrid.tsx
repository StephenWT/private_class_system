import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Student, AttendanceRecord, AttendanceData } from '@/types';
import { formatDateKey, getDaysInMonth } from '@/lib/dateUtils';
import { attendance } from '@/lib/api';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StudentManager from './StudentManager';

interface AttendanceGridProps {
  selectedClass: { class_id: string; class_name: string };
  selectedMonth: string;                                   // e.g., "Aug 2025"
  customLessonDates?: Date[] | null;                       // optional custom dates
  students: Student[];
  onStudentsChange: (students: Student[]) => void;
}

const AttendanceGrid = ({
  selectedClass,
  selectedMonth,
  customLessonDates,
  students,
  onStudentsChange,
}: AttendanceGridProps) => {
  // Key attendance by "<studentId>-<YYYY-MM-DD>"
  const [attendanceData, setAttendanceData] = useState<Map<string, boolean>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [currentView, setCurrentView] = useState<'attendance' | 'students'>('students');
  const { toast } = useToast();

  // Dates sourced from DB (lesson_schedules) or localStorage fallback
  const [dbDatesIso, setDbDatesIso] = useState<string[] | null>(null);

  // "Membership": which students have any schedule rows in this class
  const [enrolledIds, setEnrolledIds] = useState<Set<string> | null>(null);

  // --- Helpers ---
  const parseMonthLabel = (label: string) => {
    // "Aug 2025" -> {start, end, startISO, endISO}
    const [mon, yearStr] = label.split(' ');
    const year = Number(yearStr);
    const monthIndex = new Date(`${mon} 1, ${year}`).getMonth();
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);
    return { start, end, startISO, endISO };
  };

  // Load planned dates from DB for class+month (fallback to localStorage if none yet)
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (customLessonDates && customLessonDates.length > 0) {
        setDbDatesIso(null);
        return;
      }
      const { startISO, endISO } = parseMonthLabel(selectedMonth);

      const { data, error } = await supabase
        .from('lesson_schedules')
        .select('lesson_date')
        .eq('class_id', selectedClass.class_id)
        .gte('lesson_date', startISO)
        .lte('lesson_date', endISO);

      if (ignore) return;

      if (error) {
        // fallback to local cache
        const local = localStorage.getItem(`lesson_dates:${selectedClass.class_id}:${selectedMonth}`);
        setDbDatesIso(local ? JSON.parse(local) : null);
      } else {
        const iso = Array.from(new Set((data ?? []).map(d => d.lesson_date as string))).sort();
        if (iso.length) {
          setDbDatesIso(iso);
        } else {
          const local = localStorage.getItem(`lesson_dates:${selectedClass.class_id}:${selectedMonth}`);
          setDbDatesIso(local ? JSON.parse(local) : null);
        }
      }
    })();
    return () => { ignore = true; };
  }, [selectedClass.class_id, selectedMonth, customLessonDates]);

  // Determine which students are "in" this class (have any schedules)
  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data, error } = await supabase
        .from('lesson_schedules')
        .select('student_id')
        .eq('class_id', selectedClass.class_id);

      if (ignore) return;

      if (error) {
        setEnrolledIds(null);
      } else {
        const ids = new Set((data ?? []).map(r => r.student_id as string));
        setEnrolledIds(ids);
      }
    })();
    return () => { ignore = true; };
  }, [selectedClass.class_id]);

  // Prefer custom dates; otherwise DB dates; otherwise full month
  const days = useMemo<Date[]>(() => {
    if (customLessonDates && customLessonDates.length > 0) return customLessonDates;
    if (dbDatesIso && dbDatesIso.length > 0) return dbDatesIso.map(s => new Date(s));
    return getDaysInMonth(selectedMonth); // derives from "Aug 2025"
  }, [customLessonDates, dbDatesIso, selectedMonth]);

  const plannedIsoDates = useMemo(() => days.map(d => d.toISOString().slice(0, 10)), [days]);

  // Apply membership filter if we have it
  const studentsForThisClass = useMemo(
    () => (enrolledIds ? students.filter(s => enrolledIds.has(s.student_id)) : students),
    [students, enrolledIds]
  );

  const keyFor = (studentId: string, isoDate: string) => `${studentId}-${isoDate}`;

  const toggleAttendance = (studentId: string, isoDate: string) => {
    const key = keyFor(studentId, isoDate);
    setAttendanceData(prev => {
      const next = new Map(prev);
      next.set(key, !prev.get(key));
      return next;
    });
  };

  const getAttendanceStatus = (studentId: string, isoDate: string): boolean => {
    const key = keyFor(studentId, isoDate);
    return attendanceData.get(key) || false; // default absent
  };

  const saveAttendance = async () => {
    if (!selectedClass.class_id) {
      toast({
        title: 'Create/select a class first',
        description: 'Please create or select a class before saving attendance.',
        variant: 'destructive',
      });
      return;
    }
    if (studentsForThisClass.length === 0) {
      toast({
        title: 'No students',
        description: 'Add at least one student to this class to save attendance.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Build records with ISO date keys (filtered students only)
      const records: AttendanceRecord[] = studentsForThisClass.map((student) => {
        const rec: AttendanceRecord = {
          student_id: student.student_id,   // string UUID
          student_name: student.student_name,
        };
        days.forEach((d) => {
          const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
          rec[iso] = getAttendanceStatus(student.student_id, iso);
        });
        return rec;
      });

      const payload: AttendanceData = {
        class_id: selectedClass.class_id,
        class_name: selectedClass.class_name,
        month: selectedMonth,
        lesson_dates: plannedIsoDates, // pass ISO dates
        data: records,
        // user_id omitted; Supabase RLS uses auth.uid()
      };

      const res = await attendance.save(payload);

      // Cache the planned dates locally so they "stick" before any schedules exist
      localStorage.setItem(
        `lesson_dates:${selectedClass.class_id}:${selectedMonth}`,
        JSON.stringify(plannedIsoDates)
      );

      toast({
        title: 'Attendance saved',
        description: `Updated ${res.updated} entries for ${res.month}.`,
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save attendance.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-primary">{selectedClass.class_name}</h2>
          <p className="text-muted-foreground">
            {selectedMonth}{' '}
            {customLessonDates && customLessonDates.length > 0
              ? `(${days.length} custom lessons)`
              : dbDatesIso && dbDatesIso.length > 0
              ? `(${dbDatesIso.length} planned lessons)`
              : '(full month)'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={currentView === 'students' ? 'default' : 'outline'}
            onClick={() => setCurrentView('students')}
            size="sm"
          >
            Manage Students ({studentsForThisClass.length})
          </Button>
          <Button
            variant={currentView === 'attendance' ? 'default' : 'outline'}
            onClick={() => setCurrentView('attendance')}
            size="sm"
            disabled={studentsForThisClass.length === 0}
          >
            Take Attendance
          </Button>
        </div>
      </div>

      {/* Content */}
      {currentView === 'students' ? (
        <StudentManager
          students={studentsForThisClass}
          onStudentsChange={onStudentsChange}
          // Pass these so StudentManager can auto-enroll new students for this class/dates
          classId={selectedClass.class_id as string}
          plannedDatesIso={plannedIsoDates}
        />
      ) : (
        <div className="space-y-4">
          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={saveAttendance}
              disabled={isSaving || studentsForThisClass.length === 0}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Attendance
                </>
              )}
            </Button>
          </div>

          {/* Attendance Grid */}
          {studentsForThisClass.length > 0 ? (
            <div className="border rounded-lg overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-grid-header border-b sticky top-0 z-10">
                      <th className="p-3 text-left font-medium border-r bg-grid-header sticky left-0 z-20 min-w-[200px]">
                        Student Name
                      </th>
                      {days.map((day) => {
                        const iso = day.toISOString().slice(0, 10);
                        return (
                          <th key={iso} className="p-2 text-center font-medium min-w-[80px] border-r">
                            <div className="text-xs text-muted-foreground">
                              {day.toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                            <div className="text-sm">{formatDateKey(day)}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {studentsForThisClass.map((student) => (
                      <tr key={student.student_id} className="border-b hover:bg-grid-hover transition-colors">
                        <td className="p-3 border-r bg-grid-cell sticky left-0 z-10">
                          <div className="flex flex-col">
                            <span className="font-medium">{student.student_name}</span>
                            {student.payment_status && (
                              <span
                                className={`text-xs px-2 py-1 rounded-full w-fit mt-1 ${
                                  student.payment_status === 'paid'
                                    ? 'bg-green-100 text-green-800'
                                    : student.payment_status === 'overdue'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {student.payment_status}
                              </span>
                            )}
                          </div>
                        </td>
                        {days.map((day) => {
                          const iso = day.toISOString().slice(0, 10);
                          const isPresent = getAttendanceStatus(student.student_id, iso);
                          return (
                            <td key={iso} className="p-1 text-center border-r">
                              <button
                                onClick={() => toggleAttendance(student.student_id, iso)}
                                className={`w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                                  isPresent
                                    ? 'bg-present border-present text-white'
                                    : 'bg-white border-border hover:border-present/50'
                                }`}
                                title={`${student.student_name} - ${iso}: ${isPresent ? 'Present' : 'Absent'}`}
                              >
                                {isPresent && '✓'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <ArrowLeft className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Add students first to take attendance</p>
              <p className="text-sm">Go to "Manage Students" to add students to this class</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceGrid;
