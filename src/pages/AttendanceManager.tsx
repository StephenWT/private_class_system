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
  const [selectedClass, setSelectedClass] = useState<{ class_id: number | null; class_name: string } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [customLessonDates, setCustomLessonDates] = useState<Date[] | null>(null);
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [activeTab, setActiveTab] = useState('attendance');
  const { toast } = useToast();

  const handleClassSelection = async (classData: { class_id: number | null; class_name: string }, month: string, customDates?: Date[]) => {
    setSelectedClass(classData);
    setSelectedMonth(month);
    setCustomLessonDates(customDates || null);
    setIsLoadingStudents(true);

    try {
      // Load students - in demo mode this will return empty array for new classes
      const studentData = classData.class_id ? await students.getAll() : [];
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

  const handleBackToSelection = () => {
    setCurrentStep('select');
    setSelectedClass(null);
    setSelectedMonth('');
    setCustomLessonDates(null);
    setStudentList([]);
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
              <ClassManager />
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