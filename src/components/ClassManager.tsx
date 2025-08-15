import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Plus, Trash2, DollarSign, Users, MoreVertical, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Class {
  id: string;
  class_name: string;
  subject?: string | null;
  hourly_rate?: number | null;
  student_count?: number;
}

const ClassManager = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClass, setNewClass] = useState({
    class_name: '',
    subject: '',
    hourly_rate: '',
  });
  const [isLoading, setIsLoading] = useState(true);

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

  const deleteClass = async (classId: string, className: string) => {
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

  /* ---------- NEW: helpers for Actions menu ---------- */

  const editClassName = async (id: string, current: string) => {
    const next = prompt('New class name', current)?.trim();
    if (!next || next === current) return;
    const { error } = await supabase.from('classes').update({ class_name: next }).eq('id', id);
    if (error) {
      toast({ title: 'Could not update name', description: error.message, variant: 'destructive' });
      return;
    }
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, class_name: next } : c)));
    toast({ title: 'Class name updated' });
  };

  const editRate = async (id: string, current?: number | null) => {
    const defaultVal = current != null ? String(current) : '';
    const nextStr = prompt('New hourly rate (blank to clear)', defaultVal);
    if (nextStr === null) return; // user cancelled
    const trimmed = nextStr.trim();

    const next = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && Number.isNaN(next)) {
      toast({ title: 'Invalid rate', description: 'Enter a number or leave blank to clear.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('classes').update({ hourly_rate: next }).eq('id', id);
    if (error) {
      toast({ title: 'Could not update rate', description: error.message, variant: 'destructive' });
      return;
    }
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, hourly_rate: next ?? undefined } : c)));
    toast({ title: 'Hourly rate updated' });
  };

  /* --------------------------------------------------- */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
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
                    <X className="w-4 h-4" />
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

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {/* NEW actions */}
                          <DropdownMenuItem onClick={() => editClassName(cls.id, cls.class_name)}>
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => editRate(cls.id, cls.hourly_rate)}>
                            Edit hourly rate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteClass(cls.id, cls.class_name)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Class
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
