import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Mail, DollarSign, User } from 'lucide-react';

import { Student } from '@/types';
import { students as studentsApi } from '@/lib/api'; // Supabase-backed API for students
import { supabase } from '@/integrations/supabase/client';

interface StudentManagerProps {
  students: Student[];
  onStudentsChange: (students: Student[]) => void;

  /** Optional — if provided, a new student will be "enrolled" into this class */
  classId?: string;

  /** Optional — ISO dates (YYYY-MM-DD) to create lesson_schedules rows for this class */
  plannedDatesIso?: string[];
}

const StudentManager = ({ students, onStudentsChange, classId, plannedDatesIso }: StudentManagerProps) => {
  const { toast } = useToast();
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const [newStudent, setNewStudent] = useState({
    name: '',
    parentEmail: '',
    paymentStatus: 'pending' as Student['payment_status'],
    invoiceAmount: '',
  });

  const emailLooksValid = (e: string) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // CREATE (persist) + auto-enroll via lesson_schedules
  const addStudent = async () => {
    const name = newStudent.name.trim();
    if (!name) return;
    if (!emailLooksValid(newStudent.parentEmail)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    try {
      setIsBusy(true);

      // 1) Create student in DB
      const id = await studentsApi.create(name, {
        parent_email: newStudent.parentEmail.trim() || undefined,
        invoice_amount: newStudent.invoiceAmount ? parseFloat(newStudent.invoiceAmount) : undefined,
        // payment_status saved separately below (optional)
      });

      // 2) Persist non-default payment status
      if (newStudent.paymentStatus && newStudent.paymentStatus !== 'pending') {
        await studentsApi.update(id, { payment_status: newStudent.paymentStatus });
      }

      // 3) Auto-enroll: create lesson_schedules rows for this class & planned dates (if provided)
      if (classId && plannedDatesIso && plannedDatesIso.length > 0) {
        const rows = plannedDatesIso.map((date) => ({
          class_id: classId,
          student_id: id,
          lesson_date: date, // YYYY-MM-DD
        }));

        // Insert schedules; ignore duplicate errors gracefully
        const { error } = await supabase.from('lesson_schedules').insert(rows);
        if (error && (error as any).code !== '23505') {
          // 23505 = unique violation; if you don't have a unique constraint, this won't appear
          // You can choose to toast a warning here if desired.
          // For now, we don't block student creation on this.
          console.warn('lesson_schedules insert warning:', error);
        }
      }

      // 4) Update local state
      const student: Student = {
        student_id: id, // UUID from Supabase
        student_name: name,
        parent_email: newStudent.parentEmail.trim() || undefined,
        payment_status: newStudent.paymentStatus,
        invoice_amount: newStudent.invoiceAmount ? parseFloat(newStudent.invoiceAmount) : undefined,
        last_payment_date: newStudent.paymentStatus === 'paid' ? new Date().toISOString().slice(0, 10) : null,
      };

      onStudentsChange([...students, student]);
      setNewStudent({ name: '', parentEmail: '', paymentStatus: 'pending', invoiceAmount: '' });
      setIsAddingStudent(false);
      toast({ title: 'Student added' });
    } catch (e) {
      toast({
        title: 'Could not add student',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsBusy(false);
    }
  };

  // DELETE (persist)
  const removeStudent = async (studentId: string) => {
    try {
      setIsBusy(true);
      await studentsApi.remove(String(studentId));
      onStudentsChange(students.filter((s) => String(s.student_id) !== String(studentId)));
      toast({ title: 'Student removed' });
    } catch (e) {
      toast({
        title: 'Could not remove student',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsBusy(false);
    }
  };

  // UPDATE payment status (persist)
  const updatePaymentStatus = async (studentId: string, status: Student['payment_status']) => {
    try {
      setIsBusy(true);
      await studentsApi.update(String(studentId), { payment_status: status });

      const today = new Date().toISOString().slice(0, 10);
      const updatedStudents = students.map((student) =>
        String(student.student_id) === String(studentId)
          ? {
              ...student,
              payment_status: status,
              last_payment_date: status === 'paid' ? today : student.last_payment_date ?? null,
            }
          : student
      );

      onStudentsChange(updatedStudents);
      toast({ title: 'Payment status updated' });
    } catch (e) {
      toast({
        title: 'Could not update status',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const getPaymentBadgeColor = (status?: Student['payment_status']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <User className="w-4 h-4" />
          Students ({students.length})
        </h3>
        <Button size="sm" onClick={() => setIsAddingStudent(true)} disabled={isAddingStudent || isBusy}>
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </div>

      {/* Add Student Form */}
      {isAddingStudent && (
        <div className="p-4 border rounded-lg bg-accent/20 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="studentName">Student Name *</Label>
              <Input
                id="studentName"
                placeholder="Student name"
                value={newStudent.name}
                onChange={(e) => setNewStudent((prev) => ({ ...prev, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="parentEmail">Parent Email</Label>
              <Input
                id="parentEmail"
                type="email"
                placeholder="parent@email.com"
                value={newStudent.parentEmail}
                onChange={(e) => setNewStudent((prev) => ({ ...prev, parentEmail: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="paymentStatus">Payment Status</Label>
              <Select
                value={newStudent.paymentStatus}
                onValueChange={(value: Student['payment_status']) =>
                  setNewStudent((prev) => ({ ...prev, paymentStatus: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="invoiceAmount">Invoice Amount</Label>
              <Input
                id="invoiceAmount"
                type="number"
                placeholder="0.00"
                value={newStudent.invoiceAmount}
                onChange={(e) => setNewStudent((prev) => ({ ...prev, invoiceAmount: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={addStudent} disabled={!newStudent.name.trim() || isBusy}>
              Add Student
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddingStudent(false);
                setNewStudent({ name: '', parentEmail: '', paymentStatus: 'pending', invoiceAmount: '' });
              }}
              disabled={isBusy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Students List */}
      <div className="space-y-2">
        {students.map((student) => (
          <div
            key={String(student.student_id)}
            className="flex items-center justify-between p-3 border rounded-lg bg-card"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{student.student_name}</span>
                <Badge className={getPaymentBadgeColor(student.payment_status)}>
                  {student.payment_status || 'pending'}
                </Badge>
              </div>

              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                {student.parent_email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {student.parent_email}
                  </span>
                )}
                {student.invoice_amount != null && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />${student.invoice_amount}
                  </span>
                )}
                {student.last_payment_date && (
                  <span className="text-xs">
                    Last paid: {new Date(student.last_payment_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={(student.payment_status || 'pending') as Student['payment_status']}
                onValueChange={(value: Student['payment_status']) =>
                  updatePaymentStatus(String(student.student_id), value)
                }
                disabled={isBusy}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => removeStudent(String(student.student_id))}
                disabled={isBusy}
                className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {students.length === 0 && !isAddingStudent && (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
          <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No students added yet</p>
          <p className="text-sm">Click "Add Student" to get started</p>
        </div>
      )}
    </div>
  );
};

export default StudentManager;
