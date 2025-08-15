export const formatMonthYear = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    year: 'numeric' 
  });
};

export const formatDateKey = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: '2-digit' 
  });
};

export const getDaysInMonth = (month: string): Date[] => {
  // Parse "Jul 2025" format
  const [monthName, year] = month.split(' ');
  const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
  const yearNum = parseInt(year);
  
  const firstDay = new Date(yearNum, monthIndex, 1);
  const lastDay = new Date(yearNum, monthIndex + 1, 0);
  
  const days: Date[] = [];
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  
  return days;
};

export const getMonthOptions = (): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [];
  const currentDate = new Date();
  
  // Generate 6 months: 2 past, current, 3 future
  for (let i = -2; i <= 3; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    const value = formatMonthYear(date);
    options.push({ value, label: value });
  }
  
  return options;
};