import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getMonthOptions } from '@/lib/dateUtils';
import { Plus, BookOpen, Calendar } from 'lucide-react';
import DateSelector from './DateSelector';
import { supabase } from '@/integrations/supabase/client';

interface ClassSelectorProps {
  onSelectionComplete: (
    selectedClass: { class_id: string; class_name: string },
    month: string,
    customDates?: Date[]
  ) => void;
}

type UiClass = { id: string; class_name: string };

const ClassSelector = ({ onSelectionComplete }: ClassSelectorProps) => {
  const { toast } = useToast();

  const [availableClasses, setAvailableClasses] = useState<UiClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [customDates, setCustomDates] = useState<Date[]>([]);

  useEffect(() => {
    void loadClasses();
    // Set current month as default (e.g., "Aug 2025")
    const today = new Date();
    const currentMonthStr = today.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const currentMonth = getMonthOptions().find((o) => o.value === currentMonthStr);
    if (currentMonth) setSelectedMonth(currentMonth.value);
  }, []);

  const loadClasses = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const teacherId = userData?.user?.id;
      if (!teacherId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('classes')
        .select('id, class_name')
        .eq('teacher_id', teacherId)
        .order('class_name', { ascending: true });

      if (error) throw error;
      setAvailableClasses((data ?? []) as UiClass[]);
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

  const handleProceed = async () => {
    if (!selectedMonth) {
      toast({
        title: 'Month required',
        description: 'Please select a month to continue.',
        variant: 'destructive',
      });
      return;
    }

    let selectedClass: { class_id: string; class_name: string };

    if (isCreatingNew) {
      if (!newClassName.trim()) {
        toast({
          title: 'Class name required',
          description: 'Please enter a name for the new class.',
          variant: 'destructive',
        });
        return;
      }

      try {
        setIsLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        const teacherId = userData?.user?.id;
        if (!teacherId) throw new Error('Not authenticated');

        const { data, error } = await supabase
          .from('classes')
          .insert({ class_name: newClassName.trim(), teacher_id: teacherId })
          .select('id, class_name')
          .single();

        if (error) throw error;

        selectedClass = {
          class_id: data!.id, // ✅ UUID from DB
          class_name: data!.class_name,
        };

        // refresh dropdown (optional)
        await loadClasses();
        setIsCreatingNew(false);
        setNewClassName('');
        setSelectedClassId(selectedClass.class_id);
      } catch (e) {
        toast({
          title: 'Could not create class',
          description: e instanceof Error ? e.message : 'Please try again.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!selectedClassId) {
        toast({
          title: 'Class required',
          description: 'Please select a class to continue.',
          variant: 'destructive',
        });
        return;
      }

      const classData = availableClasses.find((c) => c.id === selectedClassId);
      if (!classData) {
        toast({
          title: 'Invalid class',
          description: 'Please select a valid class.',
          variant: 'destructive',
        });
        return;
      }

      selectedClass = {
        class_id: classData.id, // ✅ UUID
        class_name: classData.class_name,
      };
    }

    onSelectionComplete(selectedClass, selectedMonth, useCustomDates ? customDates : undefined);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid-header flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-card rounded-lg shadow-xl p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Select Class & Month</h1>
          <p className="text-muted-foreground">Choose your class and the month for attendance tracking</p>
        </div>

        <div className="space-y-4">
          {/* Month Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Month
            </Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class Selection */}
          <div className="space-y-2">
            <Label>Class</Label>
            <div className="space-y-3">
              {/* Existing Classes */}
              {!isCreatingNew && (
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select existing class" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.class_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* New Class Creation */}
              {isCreatingNew && (
                <Input
                  placeholder="Enter new class name (e.g., Form 2.22 English)"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  autoFocus
                />
              )}

              {/* Toggle Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCreatingNew((v) => !v);
                  setSelectedClassId('');
                  setNewClassName('');
                }}
                className="w-full flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {isCreatingNew ? 'Select Existing Class' : 'Create New Class'}
              </Button>
            </div>
          </div>

          {/* Lesson Scheduling */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useCustomDates"
                checked={useCustomDates}
                onChange={(e) => setUseCustomDates(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="useCustomDates">Custom lesson dates (for private lessons)</Label>
            </div>

            {useCustomDates && (
              <DateSelector selectedDates={customDates} onDatesChange={setCustomDates} month={selectedMonth} />
            )}

            {!useCustomDates && (
              <p className="text-sm text-muted-foreground p-2 bg-accent/20 rounded">
                Will use all days in {selectedMonth || 'selected month'}
              </p>
            )}
          </div>

          {/* Proceed Button */}
          <Button
            onClick={handleProceed}
            className="w-full"
            disabled={
              !selectedMonth ||
              (!selectedClassId && !isCreatingNew) ||
              (isCreatingNew && !newClassName.trim()) ||
              (useCustomDates && customDates.length === 0)
            }
          >
            Continue to Attendance
          </Button>
        </div>

        {availableClasses.length === 0 && !isCreatingNew && (
          <div className="text-center py-4 text-muted-foreground border-t">
            <p className="text-sm">No existing classes found.</p>
            <p className="text-xs">Create your first class to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassSelector;
