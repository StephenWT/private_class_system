import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Plus, Trash2, DollarSign, Users, Edit, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import StudentManager from './StudentManager';
import { Student } from '@/types';
import { students as studentsApi } from '@/lib/api';

interface Class {
  id: string;
  class_name: string;
  subject?: string | null;
  hourly_rate?: number | null;
  student_count?: number;
}

interface ClassManagerProps {
  onTakeAttendance?: (classData: { class_id: string; class_name: string }) => void;
}

const ClassManager = ({ onTakeAttendance }: ClassManagerProps) => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [managingStudentsClass, setManagingStudentsClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [newClass, setNewClass] = useState({
    class_name: '',
    subject: '',
    hourly_rate: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  useEffect(() => {
    void loadClasses();
  }, []);

  const loadClasses = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const teacherId = userData?.user?.id;
      if (!teacherId) throw new Error('User not authenticated');

      // 1) Load classes for this teacher
      const { data: cls, error: clsErr } = await supabase
        .from('classes')
        .select('id, class_name, subject, hourly_rate')
        .eq('teacher_id', teacherId)
        .order('class_name', { ascending: true });

      if (clsErr) throw clsErr;

      const classList = (cls ?? []) as Class[];
      const classIds = classList.map((c) => c.id);

      // 2) For student_count, count distinct student_id per class via lesson_schedules
      let counts: Record<string, number> = {};
      if (classIds.length > 0) {
        const { data: scheds, error: sErr } = await supabase
          .from('lesson_schedules')
          .select('class_id, student_id')
          .in('class_id', classIds);

        if (sErr) throw sErr;

        const map = new Map<string, Set<string>>();
        (scheds ?? []).forEach((r) => {
          if (!map.has(r.class_id)) map.set(r.class_id, new Set());
          map.get(r.class_id)!.add(r.student_id);
        });
        counts = Object.fromEntries([...map.entries()].map(([k, v]) => [k, v.size]));
      }

      setClasses(classList.map((c) => ({ ...c, student_count: counts[c.id] ?? 0 })));
    } catch (error) {
      toast({
        title: 'Error loading classes',
        description: error instanceof Error ? error.message : 'Failed to load classes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addClass = async () => {
    const name = newClass.class_name.trim();
    if (!name) {
      toast({
        title: 'Class name required',
        description: 'Please enter a class name',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const teacherId = userData?.user?.id;
      if (!teacherId) throw new Error('User not authenticated');

      const subject = newClass.subject.trim() || null;
      const rate = newClass.hourly_rate ? Number(newClass.hourly_rate) : null;

      const { data, error } = await supabase
        .from('classes')
        .insert([{ class_name: name, subject, hourly_rate: rate, teacher_id: teacherId }])
        .select('id, class_name, subject, hourly_rate')
        .single();

      if (error) throw error;

      toast({ title: 'Class added', description: `${name} has been added successfully` });
      setNewClass({ class_name: '', subject: '', hourly_rate: '' });
      setIsAddingClass(false);

      // Optimistic update with student_count 0
      setClasses((prev) => [{ ...(data as Class), student_count: 0 }, ...prev]);
    } catch (error) {
      toast({
        title: 'Error adding class',
        description: error instanceof Error ? error.message : 'Failed to add class',
        variant: 'destructive',
      });
    }
  };

  const updateClass = async () => {
    if (!editingClass) return;

    const name = editingClass.class_name.trim();
    if (!name) {
      toast({
        title: 'Class name required',
        description: 'Please enter a class name',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('classes')
        .update({
          class_name: name,
          subject: editingClass.subject?.trim() || null,
          hourly_rate: editingClass.hourly_rate || null,
        })
        .eq('id', editingClass.id);

      if (error) throw error;

      toast({ title: 'Class updated', description: `${name} has been updated successfully` });
      setEditingClass(null);
      
      // Update local state
      setClasses((prev) => prev.map((c) => (c.id === editingClass.id ? editingClass : c)));
    } catch (error) {
      toast({
        title: 'Error updating class',
        description: error instanceof Error ? error.message : 'Failed to update class',
        variant: 'destructive',
      });
    }
  };

  const deleteClass = async (classId: string, className: string) => {
    if (!confirm(`Are you sure you want to delete "${className}"? This will also delete all associated students and attendance records.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;

      setClasses((prev) => prev.filter((c) => c.id !== classId));
      toast({ title: 'Class deleted', description: `${className} has been deleted` });
    } catch (error) {
      toast({
        title: 'Error deleting class',
        description: error instanceof Error ? error.message : 'Failed to delete class',
        variant: 'destructive',
      });
    }
  };

  const loadStudentsForClass = async (classId: string) => {
    setIsLoadingStudents(true);
    try {
      // Get students enrolled in this class via lesson_schedules
      const { data: schedules, error: schedError } = await supabase
        .from('lesson_schedules')
        .select('student_id')
        .eq('class_id', classId);

      if (schedError) throw schedError;

      const studentIds = Array.from(new Set((schedules ?? []).map(s => s.student_id)));
      
      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      // Get student details
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, student_name, parent_email, payment_status, invoice_amount, last_payment_date')
        .in('id', studentIds)
        .order('student_name', { ascending: true });

      if (studentError) throw studentError;

      const formattedStudents: Student[] = (studentData ?? []).map((s) => ({
        student_id: s.id,
        student_name: s.student_name,
        parent_email: s.parent_email ?? undefined,
        payment_status: (s.payment_status ?? null) as any,
        invoice_amount: (s.invoice_amount ?? null) as any,
        last_payment_date: (s.last_payment_date ?? null) as any,
      }));

      setStudents(formattedStudents);
    } catch (error) {
      toast({
        title: 'Error loading students',
        description: error instanceof Error ? error.message : 'Failed to load students',
        variant: 'destructive',
      });
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleManageStudents = async (cls: Class) => {
    setManagingStudentsClass(cls);
    await loadStudentsForClass(cls.id);
  };

  const handleStudentsChange = (updatedStudents: Student[]) => {
    setStudents(updatedStudents);
    // Update student count in classes list
    setClasses(prev => prev.map(c => 
      c.id === managingStudentsClass?.id 
        ? { ...c, student_count: updatedStudents.length }
        : c
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Student management view
  if (managingStudentsClass) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Manage Students - {managingStudentsClass.class_name}
            </h2>
            <p className="text-muted-foreground">Add, remove, and manage students for this class</p>
          </div>
          <div className="flex gap-2">
            {onTakeAttendance && (
              <Button
                onClick={() => onTakeAttendance({ 
                  class_id: managingStudentsClass.id, 
                  class_name: managingStudentsClass.class_name 
                })}
                className="flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                Take Attendance
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setManagingStudentsClass(null)}
            >
              Back to Classes
            </Button>
          </div>
        </div>

        {isLoadingStudents ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <StudentManager
            students={students}
            onStudentsChange={handleStudentsChange}
            classId={managingStudentsClass.id}
            plannedDatesIso={[]} // Will be set when taking attendance
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <CardTitle>Manage Classes</CardTitle>
            </div>
            <Button onClick={() => setIsAddingClass((v) => !v)} size="sm" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Class
            </Button>
          </div>
          <CardDescription>Create and manage your teaching classes</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {isAddingClass && (
            <Card className="bg-accent/20">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Class Name *</Label>
                    <Input
                      placeholder="e.g., Form 2.22 English"
                      value={newClass.class_name}
                      onChange={(e) => setNewClass({ ...newClass, class_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      placeholder="e.g., Mathematics"
                      value={newClass.subject}
                      onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly Rate</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="50.00"
                      value={newClass.hourly_rate}
                      onChange={(e) => setNewClass({ ...newClass, hourly_rate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={addClass} size="sm">
                    Add Class
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAddingClass(false);
                      setNewClass({ class_name: '', subject: '', hourly_rate: '' });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {classes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No classes created yet</p>
                <p className="text-sm">Add your first class to get started</p>
              </div>
            ) : (
              classes.map((cls) => (
                <Card key={cls.id} className="bg-card">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{cls.class_name}</h4>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {cls.subject && <span>Subject: {cls.subject}</span>}
                          {cls.hourly_rate != null && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              <span>{cls.hourly_rate}/hour</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{cls.student_count ?? 0} students</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageStudents(cls)}
                          className="flex items-center gap-2"
                        >
                          <Users className="w-4 h-4" />
                          Manage Students
                        </Button>
                        
                        {onTakeAttendance && (
                          <Button
                            size="sm"
                            onClick={() => onTakeAttendance({ 
                              class_id: cls.id, 
                              class_name: cls.class_name 
                            })}
                            className="flex items-center gap-2"
                          >
                            <ArrowRight className="w-4 h-4" />
                            Take Attendance
                          </Button>
                        )}

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingClass({ ...cls })}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Class</DialogTitle>
                              <DialogDescription>
                                Update the class information
                              </DialogDescription>
                            </DialogHeader>
                            
                            {editingClass && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Class Name *</Label>
                                  <Input
                                    value={editingClass.class_name}
                                    onChange={(e) => setEditingClass({ 
                                      ...editingClass, 
                                      class_name: e.target.value 
                                    })}
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label>Subject</Label>
                                  <Input
                                    value={editingClass.subject || ''}
                                    onChange={(e) => setEditingClass({ 
                                      ...editingClass, 
                                      subject: e.target.value 
                                    })}
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label>Hourly Rate</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editingClass.hourly_rate || ''}
                                    onChange={(e) => setEditingClass({ 
                                      ...editingClass, 
                                      hourly_rate: e.target.value ? Number(e.target.value) : null 
                                    })}
                                  />
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button onClick={updateClass}>
                                    Update Class
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => setEditingClass(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteClass(cls.id, cls.class_name)}
                          className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassManager;