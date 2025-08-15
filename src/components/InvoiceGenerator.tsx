import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Calculator } from 'lucide-react';

interface Student {
  id: string;
  student_name: string;
  parent_email?: string;
}

interface Class {
  id: string;
  class_name: string;
  hourly_rate?: number | null;
}

interface AttendanceData {
  student_id: string;
  attended_sessions: number;
  total_sessions: number;
}

const InvoiceGenerator = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // "YYYY-MM"
  const [hourlyRate, setHourlyRate] = useState('50');
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadStudents();
    } else {
      setStudents([]);
      setSelectedStudent('');
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass && selectedStudent && selectedMonth) {
      loadAttendanceData();
    } else {
      setAttendanceData(null);
    }
  }, [selectedClass, selectedStudent, selectedMonth]);

  const loadClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, class_name, hourly_rate')
        .order('class_name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      toast({
        title: 'Error loading classes',
        description: error instanceof Error ? error.message : 'Failed to load classes',
        variant: 'destructive',
      });
    }
  };

  const loadStudents = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const teacherId = userData?.user?.id;
      if (!teacherId) throw new Error('Not authenticated');

      // RLS should already scope by teacher_id, but this extra filter is fine.
      const { data, error } = await supabase
        .from('students')
        .select('id, student_name, parent_email')
        .eq('teacher_id', teacherId)
        .order('student_name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      toast({
        title: 'Error loading students',
        description: error instanceof Error ? error.message : 'Failed to load students',
        variant: 'destructive',
      });
    }
  };

  const loadAttendanceData = async () => {
    try {
      // selectedMonth is "YYYY-MM"
      const startDate = new Date(`${selectedMonth}-01`);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      const startISO = startDate.toISOString().slice(0, 10);
      const endISO = endDate.toISOString().slice(0, 10);

      // 1) lesson_schedules for class+student within month
      const { data: schedules, error: schedulesError } = await supabase
        .from('lesson_schedules')
        .select('id, lesson_date')
        .eq('class_id', selectedClass)
        .eq('student_id', selectedStudent)
        .gte('lesson_date', startISO)
        .lte('lesson_date', endISO)
        .order('lesson_date', { ascending: true });

      if (schedulesError) throw schedulesError;

      const scheduleIds = (schedules ?? []).map(s => s.id);
      const totalSessions = scheduleIds.length;

      if (totalSessions === 0) {
        setAttendanceData({
          student_id: selectedStudent,
          attended_sessions: 0,
          total_sessions: 0,
        });
        return;
      }

      // 2) attendance_records for those schedules
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('lesson_schedule_id, attended')
        .in('lesson_schedule_id', scheduleIds);

      if (attendanceError) throw attendanceError;

      const attendedSessions = (attendance ?? []).filter(a => a.attended).length;

      setAttendanceData({
        student_id: selectedStudent,
        attended_sessions: attendedSessions,
        total_sessions: totalSessions,
      });
    } catch (error) {
      toast({
        title: 'Error loading attendance',
        description: error instanceof Error ? error.message : 'Failed to load attendance data',
        variant: 'destructive',
      });
    }
  };

  const generateInvoice = async () => {
    if (!attendanceData || !selectedClass || !selectedStudent || !selectedMonth) return;

    setIsGenerating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const teacherId = userData?.user?.id;
      if (!teacherId) throw new Error('User not authenticated');

      const rate = parseFloat(hourlyRate || '0');
      const totalAmount = attendanceData.attended_sessions * rate;

      const todayISO = new Date().toISOString().slice(0, 10);
      const due = new Date();
      due.setDate(due.getDate() + 30);
      const dueISO = due.toISOString().slice(0, 10);

      // If your DB has a DEFAULT or trigger for invoice_number, omit it here and let DB fill it.
      // Otherwise, try RPC; if not present, use a safe local fallback.
      let invoice_number: string | undefined = undefined;
      try {
        const { data: invNum, error: rpcErr } = await supabase.rpc('generate_invoice_number');
        if (!rpcErr && invNum) invoice_number = invNum as string;
      } catch {
        // ignore – fallback next
      }
      if (!invoice_number) {
        invoice_number = `INV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      }

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          student_id: selectedStudent,
          teacher_id: teacherId,
          invoice_number,                // omit this if you want DB default to run instead
          total_amount: totalAmount,
          due_date: dueISO,
          invoice_date: todayISO,        // good to set explicitly
          status: 'pending',
          notes: `Invoice for ${selectedMonth} — ${attendanceData.attended_sessions}/${attendanceData.total_sessions} sessions attended`,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice line item
      const { error: lineItemError } = await supabase
        .from('invoice_line_items')
        .insert({
          invoice_id: invoice.id,
          description: `Tutoring sessions for ${selectedMonth}`,
          quantity: attendanceData.attended_sessions,
          unit_price: rate,
          total_price: totalAmount,
        });

      if (lineItemError) throw lineItemError;

      toast({
        title: 'Invoice generated',
        description: `Created for ${attendanceData.attended_sessions} sessions — $${totalAmount.toFixed(2)}.`,
      });

      // Reset just student + summary (keep class/rate/month for quicker repeats)
      setSelectedStudent('');
      setAttendanceData(null);
    } catch (error) {
      toast({
        title: 'Error generating invoice',
        description: error instanceof Error ? error.message : 'Failed to generate invoice',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedClassData = classes.find(c => c.id === selectedClass);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <CardTitle>Generate Invoice</CardTitle>
        </div>
        <CardDescription>Create invoices based on student attendance</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Class</Label>
            <Select
              value={selectedClass}
              onValueChange={(value) => {
                setSelectedClass(value);
                setSelectedStudent('');
                const cls = classes.find(c => c.id === value);
                if (cls?.hourly_rate != null) {
                  setHourlyRate(String(cls.hourly_rate));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.class_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Student</Label>
            <Select
              value={selectedStudent}
              onValueChange={setSelectedStudent}
              disabled={!selectedClass}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.student_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Month</Label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              placeholder="YYYY-MM"
            />
          </div>

          <div className="space-y-2">
            <Label>Hourly Rate</Label>
            <Input
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>
        </div>

        {attendanceData && (
          <Card className="bg-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-primary" />
                <h4 className="font-semibold">Attendance Summary</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Sessions attended:</span>
                  <div className="font-bold">{attendanceData.attended_sessions}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total sessions:</span>
                  <div className="font-bold">{attendanceData.total_sessions}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Rate per session:</span>
                  <div className="font-bold">${hourlyRate}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total amount:</span>
                  <div className="font-bold text-primary">
                    ${(attendanceData.attended_sessions * parseFloat(hourlyRate || '0')).toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          onClick={generateInvoice}
          disabled={!attendanceData || isGenerating}
          className="w-full flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          {isGenerating ? 'Generating...' : 'Generate Invoice'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default InvoiceGenerator;
