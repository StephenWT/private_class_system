import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import ClassSelector from '@/components/ClassSelector';
import AttendanceGrid from '@/components/AttendanceGrid';
import ClassManager from '@/components/ClassManager';
import { Student } from '@/types';
import { students } from '@/lib/api';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AttendanceManagerProps {
  onLogout: () => void;
}

const AttendanceManager = ({ onLogout }: AttendanceManagerProps) => {
  const [currentStep, setCurrentStep] = useState<'select' | 'attendance'>('select');
  const [selectedClass, setSelectedClass] = useState<{ class_id: string; class_name: string } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [customLessonDates, setCustomLessonDates] = useState<Date[] | null>(null);
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [activeTab, setActiveTab] = useState('attendance');
  const { toast } = useToast();

  const handleClassSelection = async (classData: { class_id: string; class_name: string }, month: string, customDates?: Date[]) => {
    setSelectedClass(classData);
    setSelectedMonth(month);
    setCustomLessonDates(customDates || null);
    setIsLoadingStudents(true);

    try {
      // Load students enrolled in this specific class
      const studentData = await loadStudentsForClass(classData.class_id);
      setStudentList(studentData);
      setCurrentStep('attendance');
    } catch (error) {
      toast({
        title: "Error loading students",
        description: error instanceof Error ? error.message : "Failed to load students",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const loadStudentsForClass = async (classId: string): Promise<Student[]> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const teacherId = userData?.user?.id;
      if (!teacherId) throw new Error('User not authenticated');

      // Get students enrolled in this class via lesson_schedules
      const { data: schedules, error: schedError } = await supabase
        .from('lesson_schedules')
        .select('student_id')
        .eq('class_id', classId);

      if (schedError) throw schedError;

      const studentIds = Array.from(new Set((schedules ?? []).map(s => s.student_id)));
      
      if (studentIds.length === 0) {
        return [];
      }

      // Get student details
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, student_name, parent_email, payment_status, invoice_amount, last_payment_date')
        .in('id', studentIds)
        .eq('teacher_id', teacherId)
        .order('student_name', { ascending: true });

      if (studentError) throw studentError;

      return (studentData ?? []).map((s) => ({
        student_id: s.id,
        student_name: s.student_name,
        parent_email: s.parent_email ?? undefined,
        payment_status: (s.payment_status ?? null) as any,
        invoice_amount: (s.invoice_amount ?? null) as any,
        last_payment_date: (s.last_payment_date ?? null) as any,
      }));
    } catch (error) {
      console.error('Error loading students for class:', error);
      return [];
    }
  };

  const handleTakeAttendanceFromClassManager = async (classData: { class_id: string; class_name: string }) => {
    // Set current month as default
    const today = new Date();
    const currentMonthStr = today.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    await handleClassSelection(classData, currentMonthStr);
  };

  const handleBackToSelection = () => {
    setCurrentStep('select');
    setSelectedClass(null);
    setSelectedMonth('');
    setCustomLessonDates(null);
    setStudentList([]);
    setActiveTab('attendance');
  };

  if (isLoadingStudents) {
    return (
      <div className="min-h-screen bg-background">
        <Header onLogout={onLogout} />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading students...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onLogout={onLogout} />
      
      {currentStep === 'select' ? (
        <div className="container mx-auto px-4 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="attendance" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Take Attendance
              </TabsTrigger>
              <TabsTrigger value="classes" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Manage Classes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attendance">
              <ClassSelector onSelectionComplete={handleClassSelection} />
            </TabsContent>

            <TabsContent value="classes">
              <ClassManager onTakeAttendance={handleTakeAttendanceFromClassManager} />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={handleBackToSelection}
              className="flex items-center gap-2 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Main Menu
            </Button>
          </div>

          {selectedClass && (
            <AttendanceGrid
              selectedClass={selectedClass}
              selectedMonth={selectedMonth}
              customLessonDates={customLessonDates}
              students={studentList}
              onStudentsChange={setStudentList}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceManager;