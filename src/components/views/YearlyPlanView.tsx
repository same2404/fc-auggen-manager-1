import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Activity, 
  Plus, 
  Target,
  Shield,
  Star,
  List,
  LayoutGrid,
  GripHorizontal,
  ZoomIn,
  ZoomOut,
  AlignLeft,
  CalendarDays,
  CalendarRange,
  Dribbble,
  Flag,
  Landmark,
  Users,
  Search,
  Edit2,
  Trash2,
  TableProperties,
  X,
  Gift,
  Sparkles,
  Check
} from 'lucide-react';
import { getHolidays } from '../../utils/holidays';

interface YearlyPlanViewProps {
  yearlyPlan: Record<string, any>;
  players: any[];
  trainingSessions: any[];
  summerPrep?: any[];
  testMatches?: any[];
  competitiveMatches?: any[];
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  handleUpdateDayPlan: (dateKey: string, field: string, value: any) => void;
  isEditing?: boolean;
}

export const YearlyPlanView: React.FC<YearlyPlanViewProps> = ({
  yearlyPlan,
  players,
  trainingSessions,
  summerPrep = [],
  testMatches = [],
  competitiveMatches = [],
  currentMonth,
  setCurrentMonth,
  handleUpdateDayPlan,
  isEditing = false
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar' | 'list'>('list');
  const [calendarMode, setCalendarMode] = useState<'month' | 'week' | 'year'>('year');
  const [timelineZoom, setTimelineZoom] = useState<'year' | 'quarter' | 'month'>('year');
  const [selectedEventDate, setSelectedEventDate] = useState<string | null>(null);
  const [showGenModal, setShowGenModal] = useState(false);
  const [genOptions, setGenOptions] = useState({
    startDate: '2026-07-06',
    endDate: '2027-05-30',
    trainingDays: [2, 4], // Tuesday & Thursday as default training days
    skipHolidays: true,
    breakStart: '2026-12-15',
    breakEnd: '2027-01-15'
  });

  const toggleTrainingDay = (day: number) => {
    setGenOptions(prev => {
      const active = prev.trainingDays.includes(day);
      const updated = active 
        ? prev.trainingDays.filter(d => d !== day)
        : [...prev.trainingDays, day];
      return { ...prev, trainingDays: updated };
    });
  };

  const [sidebarTab, setSidebarTab] = useState<'status' | 'birthdays'>('status');
  const [birthdaySearch, setBirthdaySearch] = useState('');

  const birthdaysByMonthDay = useMemo(() => {
    const map: Record<string, Array<{ id: string; name: string; firstName?: string; lastName?: string; geburtsdatum: string; category: string; birthYear?: number; categoryLabel: string }>> = {};
    if (!players || !Array.isArray(players)) return map;
    
    const categoryLabels: Record<string, string> = {
      player: 'Spielerkader',
      coach: 'Trainerteam',
      staff: 'Teammanagement / Funktionär',
      medical: 'Medizinische Abteilung'
    };

    players.forEach((p: any) => {
      if (!p.geburtsdatum) return;
      
      let month = '';
      let day = '';
      let birthYear = 0;
      
      if (p.geburtsdatum.includes('-')) {
        const parts = p.geburtsdatum.split('-');
        if (parts.length >= 3) {
          birthYear = parseInt(parts[0], 10);
          month = String(parseInt(parts[1], 10)).padStart(2, '0');
          day = String(parseInt(parts[2], 10)).padStart(2, '0');
        }
      } else if (p.geburtsdatum.includes('.')) {
        const parts = p.geburtsdatum.split('.');
        if (parts.length >= 3) {
          // DD.MM.YYYY
          birthYear = parseInt(parts[2], 10);
          month = String(parseInt(parts[1], 10)).padStart(2, '0');
          day = String(parseInt(parts[0], 10)).padStart(2, '0');
        }
      }
      
      if (month && day) {
        const key = `${month}-${day}`;
        if (!map[key]) {
          map[key] = [];
        }
        map[key].push({
          id: p.id,
          name: p.lastName || p.name || '',
          firstName: p.firstName,
          lastName: p.lastName,
          geburtsdatum: p.geburtsdatum,
          category: p.category || 'player',
          categoryLabel: categoryLabels[p.category] || 'Sonstige',
          birthYear: birthYear || undefined
        });
      }
    });
    
    return map;
  }, [players]);

  const getBirthdaysForDate = (dateKey: string) => {
    const parts = dateKey.split('-');
    if (parts.length < 3) return [];
    const monthDayKey = `${parts[1]}-${parts[2]}`;
    const people = birthdaysByMonthDay[monthDayKey] || [];
    const targetYear = parseInt(parts[0], 10);
    
    return people.map(p => {
      let age: number | undefined = undefined;
      if (p.birthYear) {
        age = targetYear - p.birthYear;
      }
      return {
        ...p,
        age
      };
    });
  };

  const sortedBirthdays = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      geburtsdatum: string;
      category: string;
      month: number;
      day: number;
      birthYear?: number;
      formattedDate: string;
      categoryLabel: string;
    }> = [];
    
    const categoryLabels: Record<string, string> = {
      player: 'Spielerkader',
      coach: 'Trainerteam',
      staff: 'Teammanagement / Funktionär',
      medical: 'Medizinische Abteilung'
    };

    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    Object.entries(birthdaysByMonthDay).forEach(([monthDayKey, people]) => {
      const [mStr, dStr] = monthDayKey.split('-');
      const month = parseInt(mStr, 10);
      const day = parseInt(dStr, 10);
      
      people.forEach(p => {
        list.push({
          id: p.id,
          name: p.name,
          geburtsdatum: p.geburtsdatum,
          category: p.category,
          month,
          day,
          birthYear: p.birthYear,
          formattedDate: `${day}. ${monthNames[month - 1]}`,
          categoryLabel: categoryLabels[p.category] || 'Sonstige'
        });
      });
    });

    return list.sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    });
  }, [birthdaysByMonthDay]);

  const filteredBirthdays = useMemo(() => {
    return sortedBirthdays.filter(p => 
      p.name.toLowerCase().includes(birthdaySearch.toLowerCase()) ||
      p.categoryLabel.toLowerCase().includes(birthdaySearch.toLowerCase())
    );
  }, [sortedBirthdays, birthdaySearch]);

  const getDayHolidayName = (dateKey: string) => {
    const planData = yearlyPlan[dateKey];
    if (planData && planData.customHolidayName !== undefined && planData.customHolidayName !== null) {
      return planData.customHolidayName || null;
    }
    const year = parseInt(dateKey.split('-')[0], 10);
    const calculatedHolidays = getHolidays(year);
    return calculatedHolidays[dateKey] || null;
  };

  const mergedData = useMemo(() => {
    const data: Record<string, any> = {};
    const startDate = new Date('2026-06-01');
    const endDate = new Date('2027-07-31');
    
    let current = new Date(startDate);
    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0];
      const dateStr = current.toLocaleDateString('de-DE');
      
      const planData = yearlyPlan[dateKey] || {};
      const session = trainingSessions.find(s => s.date === dateStr);
      const summerEntry = summerPrep.find(s => s.date === dateKey);
      const testMatch = testMatches.find(m => m.date === dateKey);
      const compMatch = competitiveMatches.find(m => m.date === dateKey);

      // Phases
      let phase: 'summer' | 'winter' | 'season' | 'break' = 'season';
      const summerS = new Date('2026-07-06');
      const summerE = new Date('2026-08-15');
      const breakS = new Date('2026-12-15');
      const breakE = new Date('2027-01-15');
      const winterS = new Date('2027-01-16');
      const winterE = new Date('2027-03-15');

      if (current >= summerS && current <= summerE) phase = 'summer';
      else if (current >= breakS && current <= breakE) phase = 'break';
      else if (current >= winterS && current <= winterE) phase = 'winter';

      data[dateKey] = {
        ...planData,
        type: planData.type || (testMatch ? 'Testspiel' : (compMatch ? 'Pflichtspiel' : (phase === 'break' ? 'Frei' : (session ? 'Training' : 'Frei')))),
        activity: planData.activity || (testMatch ? `Testspiel vs ${testMatch.opponent}` : (compMatch ? `Pflichtspiel vs ${compMatch.opponent}` : (phase === 'break' ? 'WINTERPAUSE' : (session?.sessionFocus || session?.weeklyFocus || '')))),
        time: planData.time || testMatch?.kickOff || compMatch?.kickOff || '19:00',
        location: planData.location || testMatch?.location || compMatch?.location || '',
        opponent: planData.opponent || testMatch?.opponent || compMatch?.opponent || '',
        treffpunkt: planData.treffpunkt || testMatch?.meetingTime || compMatch?.meetingTime || '',
        ergebnis: planData.ergebnis || testMatch?.result || compMatch?.result || '',
        phase: planData.phase || phase,
        ...(summerEntry ? {
          kw: summerEntry.kw,
          te: summerEntry.te,
          type: summerEntry.type || planData.type,
          activity: summerEntry.content || summerEntry.inhalt || planData.activity,
          time: summerEntry.time || planData.time,
          location: summerEntry.location || planData.location,
          opponent: summerEntry.opponent || planData.opponent,
          status: summerEntry.status || planData.status,
          notes: summerEntry.notes || planData.notes,
          treffpunkt: summerEntry.treffpunkt || planData.treffpunkt,
          ergebnis: summerEntry.ergebnis || planData.ergebnis
        } : {})
      };

      current.setDate(current.getDate() + 1);
    }
    return data;
  }, [yearlyPlan, trainingSessions, summerPrep, testMatches, competitiveMatches]);
  const onlyPlayers = useMemo(() => {
    return players.filter(p => p.category !== 'coach' && p.category !== 'staff' && p.category !== 'medical');
  }, [players]);

  const [listSearch, setListSearch] = useState('');
  const [listGroupBy, setListGroupBy] = useState<'month' | 'phase'>('month');
  const [selectedListDate, setSelectedListDate] = useState<string | null>('2026-07-06');

  const [listPhaseFilter, setListPhaseFilter] = useState<'all' | 'summer' | 'season' | 'winter' | 'break'>('all');

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const monthName = currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const changeMonth = (offset: number) => {
    const next = new Date(currentMonth);
    next.setMonth(currentMonth.getMonth() + offset);
    setCurrentMonth(next);
  };

  const changeWeek = (offset: number) => {
    const next = new Date(currentMonth);
    next.setDate(currentMonth.getDate() + (offset * 7));
    setCurrentMonth(next);
  };

  const typeColors: Record<string, string> = {
    'Training': 'bg-blue-950/80 text-[#60A5FA] border-[#3B82F6] font-bold shadow-[0_0_8px_rgba(59,130,246,0.3)]',
    'Spiel': 'bg-rose-950/90 text-[#FF4C4C] border-[#FF4C4C] font-bold shadow-[0_0_8px_rgba(255,76,76,0.4)]',
    'Frei': 'bg-emerald-950/80 text-[#00D47A] border-[#00D47A] font-bold shadow-[0_0_8px_rgba(0,212,122,0.3)]',
    'Event': 'bg-yellow-950/80 text-[#FACC15] border-[#FACC15] font-bold shadow-[0_0_8px_rgba(250,204,21,0.3)]',
    'Pflichtspiel': 'bg-rose-950/90 text-[#FF4C4C] border-[#FF4C4C] font-bold shadow-[0_0_8px_rgba(255,76,76,0.4)]',
    'Testspiel': 'bg-amber-950/90 text-[#FFD54F] border-[#FFD54F] font-bold shadow-[0_0_8px_rgba(255,213,79,0.3)]',
    'Turnier': 'bg-purple-950/80 text-[#C084FC] border-[#A855F7] font-bold shadow-[0_0_8px_rgba(168,85,247,0.3)]',
    'Meeting': 'bg-teal-950/80 text-[#2DD4BF] border-[#00C2A8] font-bold shadow-[0_0_8px_rgba(0,194,168,0.3)]',
  };

  const phaseColors: Record<string, string> = {
    'summer': 'border-l-4 border-amber-500 bg-amber-950/30 text-[#F5F5F5]',
    'winter': 'border-l-4 border-cyan-500 bg-cyan-950/30 text-[#F5F5F5]',
    'break': 'border-l-4 border-gray-500 bg-gray-900/60 text-[#C7C7C7]',
    'season': 'border-l-4 border-[#00D47A] bg-emerald-950/30 text-[#F5F5F5]',
  };

  const typeIcons: Record<string, React.ReactNode> = {
    'Training': <Dribbble size={10} />,
    'Spiel': <Target size={10} />,
    'Pflichtspiel': <Shield size={10} />,
    'Testspiel': <Flag size={10} />,
    'Turnier': <Star size={10} />,
    'Meeting': <Users size={10} />,
    'Frei': <MapPin size={10} />,
    'Event': <Landmark size={10} />
  };

  const handleDragStart = (e: React.DragEvent, dateKey: string) => {
    e.dataTransfer.setData('text/plain', dateKey);
  };

  const handleDrop = (e: React.DragEvent, targetDateKey: string) => {
    e.preventDefault();
    const sourceDateKey = e.dataTransfer.getData('text/plain');
    if (sourceDateKey && sourceDateKey !== targetDateKey) {
      const sourceData = yearlyPlan[sourceDateKey];
      if (sourceData) {
        // Move event
        handleUpdateDayPlan(targetDateKey, 'type', sourceData.type || 'Training');
        handleUpdateDayPlan(targetDateKey, 'time', sourceData.time || '');
        handleUpdateDayPlan(targetDateKey, 'content', sourceData.content || '');
        // Clear source
        handleUpdateDayPlan(sourceDateKey, 'type', 'Frei');
        handleUpdateDayPlan(sourceDateKey, 'time', '');
        handleUpdateDayPlan(sourceDateKey, 'content', '');
      }
    }
  };

  const renderFullYearCalendar = () => {
    const years = [currentMonth.getFullYear()];
    const startMonth = 6; // July
    const months = [];
    
    for (let i = 0; i < 12; i++) {
      const displayMonth = new Date(currentMonth.getFullYear(), startMonth + i, 1);
      const daysInM = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0).getDate();
      const firstDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1).getDay();
      const offset = firstDay === 0 ? 6 : firstDay - 1;
      
      // Calculate month stats
      let matchCount = 0;
      let trainingCount = 0;
      let birthdayCount = 0;
      let holidayCount = 0;

      for (let d = 1; d <= daysInM; d++) {
        const dateKey = `${displayMonth.getFullYear()}-${String(displayMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayData = mergedData[dateKey];
        if (dayData?.type === 'Spiel' || dayData?.type === 'Pflichtspiel' || dayData?.type === 'Testspiel') matchCount++;
        else if (dayData?.type === 'Training') trainingCount++;
        
        if (getDayHolidayName(dateKey)) holidayCount++;
        if (getBirthdaysForDate(dateKey).length > 0) birthdayCount += getBirthdaysForDate(dateKey).length;
      }

      const dayCells = [];
      for (let j = 0; j < offset; j++) {
        dayCells.push(<div key={`empty-${i}-${j}`} className="h-8 w-full bg-slate-950/30 border border-slate-900/40 rounded-xs" />);
      }

      for (let d = 1; d <= daysInM; d++) {
        const dateKey = `${displayMonth.getFullYear()}-${String(displayMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayData = mergedData[dateKey];
        const holidayName = getDayHolidayName(dateKey);
        const isToday = dateKey === new Date().toISOString().split('T')[0];
        const dObj = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), d);
        const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

        let cellBgClass = 'bg-slate-900/60 text-slate-200 border-slate-800/70 hover:bg-slate-800/80';
        let cellTextClass = 'text-slate-200 font-bold';
        const isCustomType = dayData && dayData.type;

        if (isToday) {
          cellBgClass = 'bg-amber-400 text-slate-950 font-black border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)] z-10 scale-[1.02]';
          cellTextClass = 'text-slate-950 font-black';
        } else if (isCustomType && dayData.type === 'Frei') {
          cellBgClass = 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50 hover:bg-emerald-900/60';
          cellTextClass = 'text-emerald-300 font-bold';
        } else if (isCustomType && (dayData.type === 'Spiel' || dayData.type === 'Pflichtspiel' || dayData.type === 'Testspiel')) {
          cellBgClass = 'bg-rose-950/60 text-rose-300 border-rose-700/60 hover:bg-rose-900/80 shadow-xs';
          cellTextClass = 'text-rose-200 font-black';
        } else if (isCustomType && dayData.type === 'Training') {
          cellBgClass = 'bg-blue-950/50 text-blue-300 border-blue-700/50 hover:bg-blue-900/70 shadow-xs';
          cellTextClass = 'text-blue-200 font-bold';
        } else if (isCustomType && dayData.type === 'Meeting') {
          cellBgClass = 'bg-teal-950/50 text-teal-300 border-teal-700/50 hover:bg-teal-900/70';
          cellTextClass = 'text-teal-200 font-bold';
        } else if (isCustomType && dayData.type === 'Event') {
          cellBgClass = 'bg-yellow-950/50 text-amber-300 border-amber-700/50 hover:bg-amber-900/70';
          cellTextClass = 'text-amber-200 font-bold';
        } else if (holidayName) {
          cellBgClass = 'bg-amber-950/40 text-amber-300 border-amber-700/50 hover:bg-amber-900/60';
          cellTextClass = 'text-amber-300 font-bold';
        } else if (isWeekend) {
          cellBgClass = 'bg-slate-950/60 text-slate-400 border-slate-800/40 hover:bg-slate-900/80';
        }

        const dayBirthdays = getBirthdaysForDate(dateKey);

        dayCells.push(
          <div 
            key={d} 
            onClick={() => setSelectedEventDate(dateKey)}
            className={`h-8 border rounded-xs flex flex-col items-center justify-center relative cursor-pointer transition-all duration-200 group hover:border-amber-400 hover:shadow-xs
              ${cellBgClass}`}
          >
             <span className={`text-[9.5px] ${cellTextClass}`}>{d}</span>
             {holidayName && (
               <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_6px_#f59e0b]" title={holidayName} />
             )}
             {dayBirthdays.length > 0 && (
               <div className="absolute top-0.5 left-0.5 text-[7px]" title={`Geburtstag: ${dayBirthdays.map(p => p.name).join(', ')}`}>
                 🎂
               </div>
             )}
             {dayData && dayData.type !== 'Frei' && (
               <div className="flex gap-0.5 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${typeColors[dayData.type]?.split(' ')[0] || 'bg-slate-400'}`} />
               </div>
             )}
             {/* Tooltip for entry */}
             {(dayData?.activity || holidayName || dayBirthdays.length > 0) && (
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-slate-100 text-[8.5px] p-2 whitespace-nowrap rounded-md font-bold uppercase pointer-events-none shadow-2xl">
                 {holidayName ? <span className="text-amber-300">{holidayName}</span> : ''} 
                 {dayBirthdays.length > 0 ? (holidayName ? ' | ' : '') + '🎂 ' + dayBirthdays.map(p => `${p.name} (${p.age || '?'})`).join(', ') : ''}
                 {dayData?.activity ? ((holidayName || dayBirthdays.length > 0) ? ' | ' : '') + dayData.activity : ''}
               </div>
             )}
          </div>
        );
      }

      months.push(
        <div key={i} className="group relative bg-slate-900/65 backdrop-blur-md border border-slate-700/60 hover:border-amber-400/60 rounded-xl overflow-hidden shadow-lg hover:shadow-amber-500/10 transition-all duration-300 flex flex-col">
          <div className="bg-gradient-to-r from-slate-900/95 via-slate-800/90 to-slate-900/95 text-amber-400 text-[10px] font-black uppercase tracking-wider text-center py-2 border-b border-slate-700/60 flex items-center justify-between px-2.5 shadow-xs">
            <span className="flex items-center gap-1 text-slate-100 font-extrabold text-[10.5px]">
              <Calendar size={11} className="text-amber-400 shrink-0" />
              {displayMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-1 text-[8px] font-bold">
              {matchCount > 0 && (
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1 py-0.2 rounded font-black" title={`${matchCount} Spiele`}>
                  ⚽ {matchCount}
                </span>
              )}
              {trainingCount > 0 && (
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1 py-0.2 rounded font-black" title={`${trainingCount} Trainingseinheiten`}>
                  🏃 {trainingCount}
                </span>
              )}
              {birthdayCount > 0 && (
                <span className="bg-pink-500/20 text-pink-300 border border-pink-500/40 px-1 py-0.2 rounded font-black" title={`${birthdayCount} Geburtstage`}>
                  🎂 {birthdayCount}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-7 text-[8.5px] font-black uppercase text-center border-b border-slate-800/80 py-1 text-slate-400 bg-slate-950/40 backdrop-blur-xs">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, idx) => (
              <div key={idx} className={idx >= 5 ? 'text-amber-400/70 font-black' : ''}>{day}</div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-slate-950/20 p-1 gap-0.5">
            {dayCells}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto custom-scrollbar p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
          {months}
        </div>
      </div>
    );
  };

  const renderMonthCalendar = () => {
    const days = [];
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square bg-slate-950/30 border border-slate-800/40 rounded-md"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = mergedData[dateKey] || { type: 'Frei', content: '', time: '19:00' };
      const holidayName = getDayHolidayName(dateKey);
      
      const dayBirthdays = getBirthdaysForDate(dateKey);
      
      days.push(
        <div 
          key={d} 
          className={`aspect-square bg-slate-900/60 backdrop-blur-xs border border-slate-800/80 p-2 flex flex-col gap-1 group hover:border-amber-400/80 transition-all overflow-hidden cursor-pointer rounded-md ${holidayName ? 'bg-amber-950/25 border-amber-700/50' : ''} ${dayBirthdays.length > 0 ? 'bg-pink-950/25 border-pink-700/60' : ''}`}
          draggable
          onDragStart={(e) => handleDragStart(e, dateKey)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, dateKey)}
          onClick={() => setSelectedEventDate(dateKey)}
        >
          <div className="flex justify-between items-start">
            <span className={`text-[10px] font-black ${d === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth() ? 'bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-slate-100'}`}>
              {d}
            </span>
            <div className="flex flex-col items-end gap-1">
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[7.5px] font-black uppercase ${typeColors[dayData.type] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                {typeIcons[dayData.type] || <Dribbble size={8} />}
                <span>{dayData.type?.substring(0, 3)}</span>
              </div>
              {holidayName && (
                <span className="text-[6.5px] font-black uppercase text-amber-300 bg-amber-950/90 border border-amber-800/90 px-1 rounded max-w-[60px] truncate" title={holidayName}>
                  {holidayName}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-1 mt-1">
            {dayData.time && <div className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1"><Clock size={8} /> {dayData.time}</div>}
            {dayData.content && <div className="text-[9px] font-bold italic text-slate-200 leading-tight line-clamp-2">{dayData.content}</div>}
            {dayBirthdays.length > 0 && (
              <div className="mt-auto space-y-0.5 pt-1 border-t border-dashed border-pink-800/60">
                {dayBirthdays.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-[8px] bg-pink-950/80 text-pink-300 border border-pink-800/80 rounded px-1 py-0.5 truncate font-bold" title={`${p.name} (${p.categoryLabel})`}>
                    🎂 {p.name} ({p.age !== undefined ? p.age : '?'})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-xl flex flex-col overflow-hidden text-slate-100">
        <div className="grid grid-cols-7 bg-gradient-to-r from-slate-900/90 via-slate-800/90 to-slate-900/90 text-amber-400 text-[10.5px] font-black uppercase tracking-wider text-center py-2.5 border-b border-slate-700/60 backdrop-blur-md shadow-xs">
          {['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 overflow-y-auto custom-scrollbar p-1.5 gap-1">
          {days}
        </div>
      </div>
    );
  };

  const renderWeekCalendar = () => {
    // Calculate start of week (Monday)
    const startOfWeek = new Date(currentMonth);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const dayData = mergedData[dateKey] || { type: 'Frei', content: '', time: '19:00' };
      const holidayName = getDayHolidayName(dateKey);

      const dayBirthdays = getBirthdaysForDate(dateKey);

      days.push(
        <div 
          key={i} 
          className={`flex-1 bg-slate-900/60 backdrop-blur-xs border-r border-slate-800/80 p-4 flex flex-col gap-2 hover:bg-slate-800/80 transition-colors ${holidayName ? 'bg-amber-950/20' : ''} ${dayBirthdays.length > 0 ? 'bg-pink-950/20' : ''}`}
          draggable
          onDragStart={(e) => handleDragStart(e, dateKey)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, dateKey)}
          onClick={() => setSelectedEventDate(dateKey)}
        >
          <div className="flex justify-between items-start border-b border-slate-800/80 pb-2">
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][i]}</div>
              <div className={`text-lg font-bold ${currentDate.getDate() === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() ? 'text-amber-400 font-black' : 'text-slate-100'}`}>
                {currentDate.getDate()}.{currentDate.getMonth() + 1}.
              </div>
            </div>
            {holidayName && (
              <span className="text-[7px] font-bold uppercase text-amber-300 bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded self-start max-w-[80px] truncate" title={holidayName}>
                {holidayName}
              </span>
            )}
          </div>
          <div className={`flex-1 p-3 rounded-xl border ${typeColors[dayData.type] || 'bg-slate-800 border-slate-700 text-slate-100'}`}>
            <div className="flex items-center gap-2 mb-2">
              {typeIcons[dayData.type] || <Dribbble size={12} />}
              <span className="text-[10px] font-bold uppercase">{dayData.type}</span>
            </div>
            {dayData.time && <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mb-2"><Clock size={10} /> {dayData.time}</div>}
            {dayData.content && <div className="text-xs italic text-slate-200">{dayData.content}</div>}
            {dayBirthdays.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[8px] font-bold uppercase text-pink-400 tracking-wider flex items-center gap-1">🎂 Geburtstage:</div>
                {dayBirthdays.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[9px] bg-pink-950/80 border border-pink-800/80 text-pink-200 font-bold p-1 rounded">
                    <span>🎂</span>
                    <span className="truncate">{p.name} ({p.age !== undefined ? p.age : '?'})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-x-auto custom-scrollbar">
          {days}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const groupedData: Record<string, any[]> = {};
    
    Object.entries(mergedData).forEach(([dateKey, dayData]) => {
      const date = new Date(dateKey);
      
      // Filtering
      if (listSearch && !dateKey.includes(listSearch) && !dayData.activity?.toLowerCase().includes(listSearch.toLowerCase()) && !dayData.type?.toLowerCase().includes(listSearch.toLowerCase())) {
        return;
      }

      // Main view filter: only show specific types unless a specific phase is selected
      if (listPhaseFilter === 'all') {
        const allowedTypes = ['Pflichtspiel', 'Testspiel', 'Training', 'Event'];
        if (!allowedTypes.includes(dayData.type)) return;
      } else if (dayData.phase !== listPhaseFilter) {
        return;
      }

      let groupKey = '';
      if (listGroupBy === 'month') {
        groupKey = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      } else {
        const phase = dayData.phase || 'season';
        groupKey = phase === 'summer' ? 'Sommerplan (06.07. - 15.08.)' : 
                   phase === 'winter' ? 'Wintervorbereitung (16.01. - 15.03.)' : 
                   phase === 'break' ? 'Winterpause (15.12. - 15.01.)' : 'Saison';
      }

      if (!groupedData[groupKey]) groupedData[groupKey] = [];
      groupedData[groupKey].push({ dateKey, ...dayData });
    });

    return (
      <div className="h-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-md flex flex-col overflow-hidden text-[#F5F5F5]">
        <div className="p-4 border-b border-[#2A2A2A] bg-[#202020] flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex border border-[#2A2A2A] rounded-lg overflow-hidden bg-[#1A1A1A]">
              <button 
                onClick={() => setListPhaseFilter('all')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase transition-all ${listPhaseFilter === 'all' ? 'bg-[#FFD54F] text-[#0F0F0F] font-black' : 'bg-[#1A1A1A] text-[#C7C7C7] hover:bg-[#202020]'}`}
              >
                Gesamtplan
              </button>
              <button 
                onClick={() => setListPhaseFilter('summer')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase border-l border-[#2A2A2A] transition-all ${listPhaseFilter === 'summer' ? 'bg-[#FFD54F] text-[#0F0F0F] font-black' : 'bg-[#1A1A1A] text-[#C7C7C7] hover:bg-[#202020]'}`}
              >
                Sommerplan
              </button>
              <button 
                onClick={() => setListPhaseFilter('season')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase border-l border-[#2A2A2A] transition-all ${listPhaseFilter === 'season' ? 'bg-[#FFD54F] text-[#0F0F0F] font-black' : 'bg-[#1A1A1A] text-[#C7C7C7] hover:bg-[#202020]'}`}
              >
                Saison
              </button>
              <button 
                onClick={() => setListPhaseFilter('winter')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase border-l border-[#2A2A2A] transition-all ${listPhaseFilter === 'winter' ? 'bg-[#FFD54F] text-[#0F0F0F] font-black' : 'bg-[#1A1A1A] text-[#C7C7C7] hover:bg-[#202020]'}`}
              >
                Wintervorbereitung
              </button>
              <button 
                onClick={() => setListPhaseFilter('break')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase border-l border-[#2A2A2A] transition-all ${listPhaseFilter === 'break' ? 'bg-gray-700 text-white font-black' : 'bg-[#1A1A1A] text-[#C7C7C7] hover:bg-[#202020]'}`}
              >
                Winterpause
              </button>
            </div>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C7C7C7]" />
            <input 
              type="text"
              placeholder="Suchen..."
              className="w-full pl-10 pr-4 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-[#F5F5F5] placeholder-[#888888] text-xs font-bold uppercase focus:outline-none focus:border-[#FFD54F]"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-[#C7C7C7] tracking-wider">Gruppieren nach:</span>
            <div className="flex border border-[#2A2A2A] rounded-lg overflow-hidden bg-[#1A1A1A]">
              <button 
                onClick={() => setListGroupBy('month')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase transition-all ${listGroupBy === 'month' ? 'bg-[#FFD54F] text-[#0F0F0F] font-black' : 'bg-[#1A1A1A] text-[#C7C7C7] hover:bg-[#202020]'}`}
              >
                Monat
              </button>
              <button 
                onClick={() => setListGroupBy('phase')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase border-l border-[#2A2A2A] transition-all ${listGroupBy === 'phase' ? 'bg-[#FFD54F] text-[#0F0F0F] font-black' : 'bg-[#1A1A1A] text-[#C7C7C7] hover:bg-[#202020]'}`}
              >
                Phase
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-950">
          <div className="space-y-8 pb-8">
            {Object.entries(groupedData).map(([group, items]) => (
              <div key={group} className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-[0.15em] bg-white border border-slate-300 text-slate-900 px-3.5 py-1.5 rounded-lg inline-block mb-2 shadow-sm">{group}</h3>
                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-md bg-white">
                  <table className="w-full border-collapse text-[10px] font-bold text-slate-900 bg-white">
                    <thead className="bg-slate-200 text-slate-900 border-b-2 border-slate-300 sticky top-0 z-10 uppercase text-xs font-black">
                      {listPhaseFilter === 'summer' ? (
                        <tr>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-8">KW</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-8">TE</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-24">Datum</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-12">Tag</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-16">Zeit</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-16">Treff</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-24">Typ</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left">Inhalt / Aktivität</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-24">Ort</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-32">Gegner</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-20">Ergebnis</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-24">Status</th>
                          <th className="p-2.5 text-slate-900 text-left w-32">Notizen</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-24">Datum</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-16">Tag</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-20">Typ</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-16">Zeit</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left">Inhalt / Aktivität</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-left w-24">Ort</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-center w-12">ATH</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-center w-12">VOR</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-center w-12">IND</th>
                          <th className="p-2.5 border-r border-slate-300 text-slate-900 text-center w-12">VID</th>
                          <th className="p-2.5 text-slate-900 text-center w-12">TR</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const date = new Date(item.dateKey);
                        const isSelected = selectedListDate === item.dateKey;
                        const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
                        const dayBirthdays = getBirthdaysForDate(item.dateKey);
                        const holidayName = getDayHolidayName(item.dateKey);
                        
                        if (listPhaseFilter === 'summer') {
                          return (
                            <tr 
                              key={item.dateKey} 
                              className={`border-b border-slate-200 hover:bg-amber-50/80 cursor-pointer transition-colors ${isSelected ? 'bg-amber-100/90 border-amber-300' : 'bg-white even:bg-slate-50/80'} text-slate-900`}
                              onClick={() => setSelectedListDate(item.dateKey)}
                            >
                              <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-500">{item.kw || '-'}</td>
                              <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-500">{item.te || '-'}</td>
                              <td className="p-2 border-r border-slate-200 font-black text-slate-900">{date.toLocaleDateString('de-DE')}</td>
                              <td className="p-2 border-r border-slate-200 uppercase font-bold text-slate-700">{weekday}</td>
                              <td className="p-2 border-r border-slate-200">
                                <input 
                                  type="text"
                                  className="w-full bg-transparent font-black text-slate-900 focus:text-amber-600 focus:outline-none"
                                  value={item.time || ''}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'time', e.target.value)}
                                  disabled={!isEditing}
                                />
                              </td>
                              <td className="p-2 border-r border-slate-200">
                                <input 
                                  type="text"
                                  className="w-full bg-transparent font-bold text-slate-800 focus:text-amber-600 focus:outline-none"
                                  value={item.treffpunkt || ''}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'treffpunkt', e.target.value)}
                                  disabled={!isEditing}
                                />
                              </td>
                              <td className="p-2 border-r border-slate-200">
                                <select 
                                  className={`px-1.5 py-0.5 rounded border text-[8px] font-black uppercase inline-flex items-center gap-1 cursor-pointer bg-slate-900 text-amber-300 border-slate-800 shadow-xs ${typeColors[item.type] || ''}`}
                                  value={item.type}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'type', e.target.value)}
                                  disabled={!isEditing}
                                >
                                  {Object.keys(typeColors).map(t => <option key={t} value={t} className="bg-slate-900 text-white">{t}</option>)}
                                </select>
                              </td>
                              <td className="p-2 border-r border-slate-200">
                                <div className="flex flex-col">
                                  <input 
                                    type="text"
                                    className="w-full bg-transparent font-black uppercase text-[11px] text-slate-900 focus:text-amber-600 focus:outline-none placeholder:text-slate-400"
                                    value={item.activity || ''}
                                    onChange={(e) => handleUpdateDayPlan(item.dateKey, 'activity', e.target.value)}
                                    disabled={!isEditing}
                                    placeholder="-"
                                  />
                                  <input 
                                    type="text"
                                    className="w-full bg-transparent text-[9.5px] text-slate-600 italic font-medium focus:text-amber-600 focus:outline-none placeholder:text-slate-400"
                                    value={item.content || ''}
                                    onChange={(e) => handleUpdateDayPlan(item.dateKey, 'content', e.target.value)}
                                    disabled={!isEditing}
                                    placeholder="Notizen..."
                                  />
                                  {(holidayName || dayBirthdays.length > 0) && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {holidayName && (
                                        <span className="text-[7.5px] font-black uppercase text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                                          🎉 {holidayName}
                                        </span>
                                      )}
                                      {dayBirthdays.map((p, idx) => (
                                        <span key={idx} className="text-[7.5px] font-black uppercase text-pink-900 bg-pink-100 border border-pink-300 px-1.5 py-0.5 rounded flex items-center gap-0.5" title={p.categoryLabel}>
                                          🎂 {p.name} ({p.age !== undefined ? p.age : '?'})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 border-r border-slate-200">
                                <input 
                                  type="text"
                                  className="w-full bg-transparent uppercase font-bold text-slate-800 focus:text-amber-600 focus:outline-none"
                                  value={item.location || ''}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'location', e.target.value)}
                                  disabled={!isEditing}
                                />
                              </td>
                              <td className="p-2 border-r border-slate-200">
                                <input 
                                  type="text"
                                  className="w-full bg-transparent uppercase font-bold text-slate-800 focus:text-amber-600 focus:outline-none"
                                  value={item.opponent || ''}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'opponent', e.target.value)}
                                  disabled={!isEditing}
                                />
                              </td>
                              <td className="p-2 border-r border-slate-200">
                                <input 
                                  type="text"
                                  className="w-full bg-transparent font-black text-center text-slate-900 focus:text-amber-600 focus:outline-none"
                                  value={item.ergebnis || ''}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'ergebnis', e.target.value)}
                                  disabled={!isEditing}
                                />
                              </td>
                              <td className="p-2 border-r border-slate-200">
                                <input 
                                  type="text"
                                  className="w-full bg-transparent uppercase font-bold text-slate-800 focus:text-amber-600 focus:outline-none"
                                  value={item.status || 'Geplant'}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'status', e.target.value)}
                                  disabled={!isEditing}
                                />
                              </td>
                              <td className="p-2">
                                <input 
                                  type="text"
                                  className="w-full bg-transparent text-[9.5px] text-slate-600 focus:text-amber-600 focus:outline-none"
                                  value={item.notes || ''}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'notes', e.target.value)}
                                  disabled={!isEditing}
                                />
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr 
                            key={item.dateKey} 
                            className={`border-b border-slate-200 hover:bg-amber-50/80 cursor-pointer transition-colors ${isSelected ? 'bg-amber-100/90 border-amber-300' : 'bg-white even:bg-slate-50/80'} text-slate-900`}
                            onClick={() => setSelectedListDate(item.dateKey)}
                          >
                            <td className="p-2 border-r border-slate-200 font-black text-slate-900">{date.toLocaleDateString('de-DE')}</td>
                            <td className="p-2 border-r border-slate-200 uppercase font-bold text-slate-700">{weekday}</td>
                            <td className="p-2 border-r border-slate-200">
                              <select 
                                className={`px-1.5 py-0.5 rounded border text-[8px] font-black uppercase inline-flex items-center gap-1 cursor-pointer bg-slate-900 text-amber-300 border-slate-800 shadow-xs ${typeColors[item.type] || ''}`}
                                value={item.type}
                                onChange={(e) => handleUpdateDayPlan(item.dateKey, 'type', e.target.value)}
                                disabled={!isEditing}
                              >
                                {Object.keys(typeColors).map(t => <option key={t} value={t} className="bg-slate-900 text-white">{t}</option>)}
                              </select>
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input 
                                type="text"
                                className="w-full bg-transparent font-black text-slate-900 focus:text-amber-600 focus:outline-none"
                                value={item.time || ''}
                                onChange={(e) => handleUpdateDayPlan(item.dateKey, 'time', e.target.value)}
                                disabled={!isEditing}
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <div className="flex items-center justify-between group/row">
                                <div className="flex flex-col flex-1">
                                  <input 
                                    type="text"
                                    className="w-full bg-transparent font-black uppercase text-[11px] text-slate-900 focus:text-amber-600 focus:outline-none placeholder:text-slate-400"
                                    value={item.activity || ''}
                                    onChange={(e) => handleUpdateDayPlan(item.dateKey, 'activity', e.target.value)}
                                    disabled={!isEditing}
                                    placeholder="-"
                                  />
                                  <input 
                                    type="text"
                                    className="w-full bg-transparent text-[9.5px] text-slate-600 italic font-medium focus:text-amber-600 focus:outline-none placeholder:text-slate-400"
                                    value={item.content || ''}
                                    onChange={(e) => handleUpdateDayPlan(item.dateKey, 'content', e.target.value)}
                                    disabled={!isEditing}
                                    placeholder="Notizen..."
                                  />
                                  {(holidayName || dayBirthdays.length > 0) && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {holidayName && (
                                        <span className="text-[7.5px] font-black uppercase text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                                          🎉 {holidayName}
                                        </span>
                                      )}
                                      {dayBirthdays.map((p, idx) => (
                                        <span key={idx} className="text-[7.5px] font-black uppercase text-pink-900 bg-pink-100 border border-pink-300 px-1.5 py-0.5 rounded flex items-center gap-0.5" title={p.categoryLabel}>
                                          🎂 {p.name} ({p.age !== undefined ? p.age : '?'})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEventDate(item.dateKey);
                                  }}
                                  className="opacity-0 group-hover/row:opacity-100 p-1 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all rounded"
                                >
                                  <Edit2 size={10} />
                                </button>
                              </div>
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input 
                                type="text"
                                className="w-full bg-transparent uppercase font-bold text-slate-800 focus:text-amber-600 focus:outline-none"
                                value={item.location || ''}
                                onChange={(e) => handleUpdateDayPlan(item.dateKey, 'location', e.target.value)}
                                disabled={!isEditing}
                                placeholder="-"
                              />
                            </td>
                            <td 
                              className={`p-2 border-r border-slate-200 text-center font-black cursor-pointer hover:bg-slate-100 ${item.athletik?.start ? 'text-emerald-600 font-extrabold' : 'text-slate-400'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateDayPlan(item.dateKey, 'athletik.start', item.athletik?.start ? '' : '09:00');
                              }}
                              title="Athletikeinheit umschalten (09:00 Uhr)"
                            >
                              {item.athletik?.start ? (
                                <input 
                                  type="text"
                                  className="w-full bg-transparent text-center text-[8.5px] font-black focus:outline-none text-emerald-600"
                                  value={item.athletik.start}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'athletik.start', e.target.value)}
                                />
                              ) : (
                                '-'
                              )}
                            </td>
                            <td 
                              className={`p-2 border-r border-slate-200 text-center font-black cursor-pointer hover:bg-slate-100 ${item.vormittag?.start ? 'text-emerald-600 font-extrabold' : 'text-slate-400'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateDayPlan(item.dateKey, 'vormittag.start', item.vormittag?.start ? '' : '10:30');
                              }}
                              title="Vormittagseinheit umschalten (10:30 Uhr)"
                            >
                              {item.vormittag?.start ? (
                                <input 
                                  type="text"
                                  className="w-full bg-transparent text-center text-[8.5px] font-black focus:outline-none text-emerald-600"
                                  value={item.vormittag.start}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'vormittag.start', e.target.value)}
                                />
                              ) : (
                                '-'
                              )}
                            </td>
                            <td 
                              className={`p-2 border-r border-slate-200 text-center font-black cursor-pointer hover:bg-slate-100 ${item.individual?.start ? 'text-emerald-600 font-extrabold' : 'text-slate-400'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateDayPlan(item.dateKey, 'individual.start', item.individual?.start ? '' : '14:00');
                              }}
                              title="Individualeinheit umschalten (14:00 Uhr)"
                            >
                              {item.individual?.start ? (
                                <input 
                                  type="text"
                                  className="w-full bg-transparent text-center text-[8.5px] font-black focus:outline-none text-emerald-600"
                                  value={item.individual.start}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'individual.start', e.target.value)}
                                />
                              ) : (
                                '-'
                              )}
                            </td>
                            <td 
                              className={`p-2 border-r border-slate-200 text-center font-black cursor-pointer hover:bg-slate-100 ${item.video?.start ? 'text-emerald-600 font-extrabold' : 'text-slate-400'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateDayPlan(item.dateKey, 'video.start', item.video?.start ? '' : '17:00');
                              }}
                              title="Videoanalyse umschalten (17:00 Uhr)"
                            >
                              {item.video?.start ? (
                                <input 
                                  type="text"
                                  className="w-full bg-transparent text-center text-[8.5px] font-black focus:outline-none text-emerald-600"
                                  value={item.video.start}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'video.start', e.target.value)}
                                />
                              ) : (
                                '-'
                              )}
                            </td>
                            <td 
                              className={`p-2 text-center font-black cursor-pointer hover:bg-slate-100 ${item.training?.start ? 'text-emerald-600 font-extrabold' : 'text-slate-400'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateDayPlan(item.dateKey, 'training.start', item.training?.start ? '' : '19:00');
                              }}
                              title="Haupttraining umschalten (19:00 Uhr)"
                            >
                              {item.training?.start ? (
                                <input 
                                  type="text"
                                  className="w-full bg-transparent text-center text-[8.5px] font-black focus:outline-none text-emerald-600"
                                  value={item.training.start}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateDayPlan(item.dateKey, 'training.start', e.target.value)}
                                />
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    // Generate months for timeline
    const months = [];
    const startYear = currentMonth.getFullYear();
    
    let numMonths = 12;
    if (timelineZoom === 'quarter') numMonths = 3;
    if (timelineZoom === 'month') numMonths = 1;

    for (let i = 0; i < numMonths; i++) {
      const mDate = new Date(startYear, currentMonth.getMonth() + i, 1);
      const mDays = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
      
      const days = [];
      for (let d = 1; d <= mDays; d++) {
        const dateKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayData = yearlyPlan[dateKey];
        
        days.push(
          <div 
            key={d} 
            className="flex-shrink-0 w-12 flex flex-col border-r border-[#334155] group cursor-pointer hover:bg-[#121824]"
            draggable
            onDragStart={(e) => handleDragStart(e, dateKey)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, dateKey)}
            onClick={() => setSelectedEventDate(dateKey)}
          >
            <div className={`h-6 flex items-center justify-center text-[8px] font-bold border-b border-[#334155] ${mDate.getDay() === 0 || mDate.getDay() === 6 ? 'bg-[#121824] text-[#94A3B8]' : 'bg-[#1E293B] text-[#F8FAFC]'}`}>
              {d}.
            </div>
            <div className="flex-1 p-1 relative min-h-[60px] bg-[#1E293B]">
              {dayData && dayData.type !== 'Frei' && (
                <div className={`absolute inset-1 rounded-sm border flex flex-col items-center justify-center p-0.5 ${typeColors[dayData.type] || 'bg-[#121824] border-[#334155] text-[#F8FAFC]'}`}>
                  {typeIcons[dayData.type]}
                </div>
              )}
            </div>
          </div>
        );
      }

      months.push(
        <div key={i} className="flex flex-col border-r border-[#334155]">
          <div className="bg-[#121824] text-[#F8FAFC] text-[10px] font-bold uppercase tracking-wider py-1 px-2 sticky left-0 border-b border-[#334155]">
            {mDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          </div>
          <div className="flex flex-1">
            {days}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full bg-[#1E293B] border border-[#334155] rounded-xl shadow-xs flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-x-auto custom-scrollbar">
          {months}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 bg-[#0A0E17] text-[#F8FAFC]">
      {/* 1. Header Mask (Exact Design Language as Spieler-Bereich / Scouting 📝) */}
      <div className="bg-[#121824] text-[#F8FAFC] border border-[#334155] p-6 rounded-2xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="bg-[#10B981] text-[#0A0E17] font-black text-[9px] px-2.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-1.5 w-fit">
            <Sparkles size={11} /> JAHRESPLAN 26/27 • SAISON-ORGANISATOR
          </span>
          <h1 className="text-3xl font-black uppercase leading-none mt-2 text-[#F8FAFC]">
            JAHRESPLAN & SAISONKALENDER 2026/2027
          </h1>
          <p className="text-xs font-semibold text-[#94A3B8] mt-1 uppercase tracking-wider flex items-center gap-2">
            <Activity size={13} className="text-[#10B981]" />
            FC AUGGEN 1921 • TRAININGS-, SPIEL- & EVENT-ORGANISATION
          </p>
        </div>
        <div className="shrink-0 font-mono text-xs text-right bg-[#0A0E17] p-2.5 border border-[#334155] rounded-lg">
          <p className="font-bold text-[#F8FAFC]">STATUS: JAHRESPLAN AKTIV</p>
          <p className="text-[10px] text-[#10B981] mt-1">
            SAISON: 2026/2027 • {viewMode === 'calendar' ? 'KALENDER' : viewMode === 'list' ? 'LISTEN-ANSICHT' : 'TIMELINE'}
          </p>
        </div>
      </div>

      {/* 2. View Switcher Tabs Bar (Matches Scouting & Player design language) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-[#121824] border border-[#334155]/80 rounded-xl shadow-lg select-none">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-[280px]">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 font-bold text-xs uppercase tracking-wider transition-all rounded-lg flex items-center justify-center gap-2 border ${
              viewMode === 'calendar'
                ? 'bg-[#10B981] text-[#0A0E17] font-black border-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-[#1E293B]/60 text-[#94A3B8] border-[#334155]/60 hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <CalendarDays size={15} /> <span>📅 Kalender</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 font-bold text-xs uppercase tracking-wider transition-all rounded-lg flex items-center justify-center gap-2 border ${
              viewMode === 'list'
                ? 'bg-[#10B981] text-[#0A0E17] font-black border-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-[#1E293B]/60 text-[#94A3B8] border-[#334155]/60 hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <AlignLeft size={15} /> <span>📋 Liste</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 font-bold text-xs uppercase tracking-wider transition-all rounded-lg flex items-center justify-center gap-2 border ${
              viewMode === 'timeline'
                ? 'bg-[#10B981] text-[#0A0E17] font-black border-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-[#1E293B]/60 text-[#94A3B8] border-[#334155]/60 hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <List size={15} /> <span>⏱️ Timeline</span>
          </button>
        </div>

        {/* Date and View Sub-controls */}
        <div className="flex flex-wrap items-center gap-3">
          {viewMode === 'calendar' && (
            <div className="flex bg-[#0A0E17] border border-[#334155] p-1 rounded-lg">
              <button 
                onClick={() => setCalendarMode('year')} 
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${calendarMode === 'year' ? 'bg-[#10B981] text-[#0A0E17] font-black' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
              >
                Jahr
              </button>
              <button 
                onClick={() => setCalendarMode('month')} 
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${calendarMode === 'month' ? 'bg-[#10B981] text-[#0A0E17] font-black' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
              >
                Monat
              </button>
              <button 
                onClick={() => setCalendarMode('week')} 
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${calendarMode === 'week' ? 'bg-[#10B981] text-[#0A0E17] font-black' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
              >
                Woche
              </button>
            </div>
          )}

          {viewMode === 'timeline' && (
            <div className="flex bg-[#0A0E17] border border-[#334155] p-1 rounded-lg">
              <button 
                onClick={() => setTimelineZoom('year')} 
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${timelineZoom === 'year' ? 'bg-[#10B981] text-[#0A0E17] font-black' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
              >
                Jahr
              </button>
              <button 
                onClick={() => setTimelineZoom('quarter')} 
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${timelineZoom === 'quarter' ? 'bg-[#10B981] text-[#0A0E17] font-black' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
              >
                Quartal
              </button>
              <button 
                onClick={() => setTimelineZoom('month')} 
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${timelineZoom === 'month' ? 'bg-[#10B981] text-[#0A0E17] font-black' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
              >
                Monat
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-[#0A0E17] border border-[#334155] px-2 py-1 rounded-xl">
            <span className="text-xs font-mono font-bold uppercase text-[#F8FAFC] px-1">
              {viewMode === 'calendar' && calendarMode === 'week' 
                ? `KW ${Math.ceil((currentMonth.getDate() - currentMonth.getDay() + 1) / 7)}` 
                : monthName}
            </span>
            <button onClick={() => viewMode === 'calendar' && calendarMode === 'week' ? changeWeek(-1) : changeMonth(-1)} className="p-1 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] rounded transition-all"><ChevronLeft size={14} /></button>
            <button onClick={() => setCurrentMonth(new Date())} className="px-2 text-[10px] font-bold uppercase text-[#10B981] hover:bg-[#1E293B] rounded transition-all">Heute</button>
            <button onClick={() => viewMode === 'calendar' && calendarMode === 'week' ? changeWeek(1) : changeMonth(1)} className="p-1 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] rounded transition-all"><ChevronRight size={14} /></button>
          </div>

          <button 
            type="button"
            onClick={() => {
              const todayStr = new Date().toISOString().split('T')[0];
              setSelectedEventDate(todayStr);
            }}
            className="bg-[#10B981] hover:bg-[#059669] text-[#0A0E17] font-black text-xs px-3.5 py-2 rounded-xl border border-[#10B981] transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Trainingseinheit hinzufügen</span>
          </button>

          {isEditing && (
            <button 
              onClick={() => setShowGenModal(true)}
              className="bg-[#EF4444] hover:bg-[#DC2626] text-[#F8FAFC] px-3.5 py-2 text-xs font-black uppercase rounded-xl border border-[#EF4444] transition-all shadow-md flex items-center gap-1.5"
            >
              Saison generieren
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col bg-[#0F0F0F]">
          {viewMode === 'calendar' && calendarMode === 'year' && renderFullYearCalendar()}
          {viewMode === 'calendar' && calendarMode === 'month' && renderMonthCalendar()}
          {viewMode === 'calendar' && calendarMode === 'week' && renderWeekCalendar()}
          {viewMode === 'timeline' && renderTimeline()}
          {viewMode === 'list' && renderListView()}
        </div>

        {/* Sidebar (Right Side): Player Status or Birthdays */}
        <div className="w-80 bg-[#1A1A1A] border-l border-[#2A2A2A] flex flex-col shrink-0 text-[#F5F5F5]">
          {/* Tab Switcher */}
          <div className="flex border-b border-[#2A2A2A] bg-[#202020]">
            <button
              onClick={() => setSidebarTab('status')}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center transition-all flex items-center justify-center gap-1.5 border-r border-[#2A2A2A]
                ${sidebarTab === 'status' ? 'bg-[#1A1A1A] text-[#FFD54F] border-b-2 border-[#FFD54F]' : 'bg-[#202020] hover:bg-[#1A1A1A] text-[#C7C7C7]'}`}
            >
              <Users size={12} />
              Kader & Status
            </button>
            <button
              onClick={() => setSidebarTab('birthdays')}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center transition-all flex items-center justify-center gap-1.5
                ${sidebarTab === 'birthdays' ? 'bg-[#1A1A1A] text-pink-400 border-b-2 border-pink-400' : 'bg-[#202020] hover:bg-[#1A1A1A] text-[#C7C7C7]'}`}
            >
              <Gift size={12} />
              Geburtstage
            </button>
          </div>

          {sidebarTab === 'status' ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-[#1A1A1A]">
              <div className="p-4 border-b border-[#2A2A2A] bg-[#202020] flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold uppercase text-[10px] tracking-wider flex items-center gap-2 text-[#F5F5F5]">
                    <Users size={14} className="text-[#FFD54F]" /> Kader & Status
                  </h3>
                  <span className="text-[10px] font-bold bg-[#1A1A1A] text-[#FFD54F] px-2 py-0.5 rounded-full border border-[#2A2A2A]">{onlyPlayers.length}</span>
                </div>
                {selectedListDate && (
                  <div className="text-[9px] font-bold bg-[#1A1A1A] text-[#FFD54F] border border-[#2A2A2A] px-2.5 py-1 rounded-lg flex items-center justify-between">
                    <span>{new Date(selectedListDate).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-[#202020] border-b border-[#2A2A2A] text-[#C7C7C7] z-10">
                    <tr>
                      <th className="text-[8px] font-bold uppercase p-2 text-left border-r border-[#2A2A2A]">Spieler</th>
                      <th className="text-[8px] font-bold uppercase p-2 text-center border-r border-[#2A2A2A]">Pos</th>
                      <th className="text-[8px] font-bold uppercase p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onlyPlayers.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '')).map((player: any) => {
                      // Find training session for selected date
                      let status = '-';
                      if (selectedListDate) {
                        const [y, m, d] = selectedListDate.split('-').map(Number);
                        const dateObj = new Date(y, m - 1, d);
                        const selectedDateStr = dateObj.toLocaleDateString('de-DE');
                        const session = trainingSessions.find(s => s.date === selectedDateStr);
                        const playerInSession = session?.players?.find((p: any) => p.name === player.lastName);
                        status = playerInSession?.status || '-';
                      }

                      const getStatusStyle = (s: string) => {
                        switch(s) {
                          case '1': return 'bg-emerald-950/80 text-[#00D47A] border-[#00D47A]';
                          case 'A': return 'bg-blue-950/80 text-[#60A5FA] border-[#3B82F6]';
                          case 'B': return 'bg-rose-950/90 text-[#FF4C4C] border-[#FF4C4C]';
                          case 'K': return 'bg-yellow-950/80 text-[#FACC15] border-[#FACC15]';
                          default: return 'bg-[#202020] text-[#C7C7C7] border-[#2A2A2A]';
                        }
                      };

                      const handleStatusToggle = () => {
                        if (!isEditing || !selectedListDate) return;
                        
                        const statuses = ['-', '1', 'A', 'B', 'K'];
                        const currentIndex = statuses.indexOf(status);
                        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                        
                        const [y, m, d] = selectedListDate.split('-').map(Number);
                        const dateObj = new Date(y, m - 1, d);
                        const selectedDateStr = dateObj.toLocaleDateString('de-DE');
                        
                        let session = trainingSessions.find(s => s.date === selectedDateStr);
                        
                        if (!session) {
                          // Create session if it doesn't exist
                          const newSession = {
                            id: `ts${Date.now()}`,
                            date: selectedDateStr,
                            weekday: new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(dateObj),
                            group: 'FC Auggen',
                            load: 'Mittel',
                            duration: '90 Min',
                            weeklyFocus: '',
                            sessionFocus: '',
                            trainer: 'Amin',
                            intensity: 'Mittel',
                            players: onlyPlayers.map(p => ({ 
                              name: p.lastName, 
                              position: p.position, 
                              status: p.id === player.id ? nextStatus : '-' 
                            })),
                            content: { warmup: '', main1: '', main2: '', closing: '' },
                            importantInfo: '',
                            remarks: ''
                          };
                          (window as any).saveTrainingSession?.(newSession);
                        } else {
                          // Update existing session
                          const updatedPlayers = [...(session.players || [])];
                          const playerIdx = updatedPlayers.findIndex(p => p.name === player.lastName);
                          
                          if (playerIdx > -1) {
                            updatedPlayers[playerIdx] = { ...updatedPlayers[playerIdx], status: nextStatus as any };
                          } else {
                            updatedPlayers.push({ name: player.lastName, position: player.position, status: nextStatus as any });
                          }
                          
                          (window as any).saveTrainingSession?.({ ...session, players: updatedPlayers });
                        }
                      };

                      return (
                        <tr key={player.id} className="border-b border-[#2A2A2A] hover:bg-[#202020] transition-colors">
                          <td className="p-2 border-r border-[#2A2A2A]">
                            <div className="text-[10px] font-bold leading-tight text-[#F5F5F5]">{player.lastName}</div>
                          </td>
                          <td className="p-2 text-center border-r border-[#2A2A2A]">
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-[#202020] text-[#F5F5F5] border border-[#2A2A2A] rounded-xs">{player.position}</span>
                          </td>
                          <td className="p-2 text-center">
                            <button 
                              onClick={handleStatusToggle}
                              disabled={!isEditing}
                              className={`text-[10px] font-bold w-6 h-6 flex items-center justify-center mx-auto rounded-xs border transition-all ${getStatusStyle(status)} ${isEditing ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'cursor-default'}`}
                            >
                              {status}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-[#2A2A2A] bg-[#202020] text-[8px] font-bold grid grid-cols-2 gap-2 shrink-0 text-[#C7C7C7]">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-950 border border-[#00D47A] rounded-xs"></div> 1: Training</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-950 border border-[#3B82F6] rounded-xs"></div> A: Aufbau</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-rose-950 border border-[#FF4C4C] rounded-xs"></div> B: Verletzt</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-yellow-950 border border-[#FACC15] rounded-xs"></div> K: Kader 1</div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden bg-[#1A1A1A]">
              <div className="p-4 border-b border-[#2A2A2A] bg-[#202020] flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold uppercase text-[10px] tracking-wider flex items-center gap-2 text-[#F5F5F5]">
                    <Gift size={14} className="text-pink-400" /> Geburtstag-Liste
                  </h3>
                  <span className="text-[10px] font-bold bg-pink-950/80 text-pink-300 border border-pink-800 px-2 py-0.5 rounded-full">
                    {filteredBirthdays.length}
                  </span>
                </div>
                {/* Search */}
                <div className="relative mt-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888888]" />
                  <input
                    type="text"
                    placeholder="Suchen..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-[10px] font-medium text-[#F5F5F5] focus:outline-none focus:border-[#FFD54F] transition-all placeholder:text-[#888888]"
                    value={birthdaySearch}
                    onChange={(e) => setBirthdaySearch(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-[#1A1A1A]">
                {filteredBirthdays.length === 0 ? (
                  <div className="text-center py-8 text-[#C7C7C7] text-xs font-bold">
                    Keine Geburtstage gefunden.
                  </div>
                ) : (
                  filteredBirthdays.map((p) => {
                    // Check if birthday is today
                    const today = new Date();
                    const isToday = p.month === (today.getMonth() + 1) && p.day === today.getDate();
                    
                    return (
                      <div 
                        key={p.id}
                        onClick={() => {
                          const targetYear = currentMonth.getFullYear();
                          const targetDate = new Date(targetYear, p.month - 1, p.day);
                          setCurrentMonth(targetDate);
                          const dateKey = `${targetYear}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
                          setSelectedEventDate(dateKey);
                        }}
                        className={`p-2.5 border rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-between
                          ${isToday ? 'bg-pink-950/80 border-pink-500 text-pink-200' : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#FFD54F] text-[#F5F5F5]'}`}
                      >
                        <div className="space-y-1 min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            {isToday && <span className="animate-bounce">🎂</span>}
                            <div className="text-[10px] font-bold leading-tight text-[#F5F5F5] truncate">{p.name}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-[#202020] text-[#C7C7C7] rounded border border-[#2A2A2A] truncate max-w-[120px]" title={p.categoryLabel}>
                              {p.category === 'player' ? 'Spieler' : p.category === 'coach' ? 'Trainer' : p.category === 'staff' ? 'Funktionär' : p.category === 'medical' ? 'Medizin' : p.categoryLabel}
                            </span>
                            <span className="text-[8px] font-bold text-[#C7C7C7]">
                              {p.formattedDate}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right shrink-0">
                          {p.birthYear ? (
                            <span className="text-[9px] font-bold text-pink-300 bg-pink-950/80 border border-pink-800 px-1.5 py-0.5 rounded">
                              wird {new Date().getFullYear() - p.birthYear}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-[#C7C7C7]">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="p-3 bg-[#1A1A1A] border-t border-[#2A2A2A] flex justify-between items-center shrink-0">
        <div className="flex gap-4 flex-wrap">
          {Object.entries(typeColors).map(([type, colorClass]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 border ${colorClass} rounded-xs flex items-center justify-center`}>
                {typeIcons[type]}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-[#C7C7C7]">{type}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border border-amber-800 bg-amber-950/80 flex items-center justify-center relative">
              <div className="w-1.5 h-1.5 bg-[#FFD54F] rounded-full shadow-[0_0_4px_#FFD54F]" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-[#FFD54F]">Feiertage</span>
          </div>
        </div>
        <p className="text-[8px] font-bold uppercase opacity-50 text-[#C7C7C7] italic">Drag & Drop zum Verschieben</p>
      </div>

      {/* Event Detail Modal */}
      {selectedEventDate && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col text-[#F5F5F5] overflow-hidden">
            <div className="bg-[#202020] text-[#F5F5F5] p-4 border-b border-[#2A2A2A] flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-xs text-[#10B981] flex items-center gap-2">
                <Dribbble size={16} className="text-[#10B981]" />
                Trainingseinheit / Event bearbeiten
              </h3>
              <button onClick={() => setSelectedEventDate(null)} className="hover:text-[#10B981] text-[#C7C7C7] transition-colors p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar max-h-[75vh]">
              {/* Quick Presets for 1-Click Training Setup */}
              <div className="space-y-1.5 bg-[#202020] p-3 border border-[#2A2A2A] rounded-xl">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#10B981] flex items-center gap-1">
                  <Sparkles size={12} /> Schnell-Auswahl / Quick Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateDayPlan(selectedEventDate, 'type', 'Training');
                      handleUpdateDayPlan(selectedEventDate, 'time', '19:00 - 20:30');
                      handleUpdateDayPlan(selectedEventDate, 'activity', 'Haupttraining FC Auggen');
                      handleUpdateDayPlan(selectedEventDate, 'training.start', '19:00');
                      handleUpdateDayPlan(selectedEventDate, 'training.end', '20:30');
                    }}
                    className="p-1.5 bg-[#10B981]/10 hover:bg-[#10B981]/25 border border-[#10B981]/40 text-[#10B981] rounded-lg text-[9px] font-bold text-left transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>⚽</span> <span>Haupttraining 19:00</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateDayPlan(selectedEventDate, 'type', 'Training');
                      handleUpdateDayPlan(selectedEventDate, 'time', '09:00 - 10:15');
                      handleUpdateDayPlan(selectedEventDate, 'activity', 'Athletik & Kraft');
                      handleUpdateDayPlan(selectedEventDate, 'athletik.start', '09:00');
                      handleUpdateDayPlan(selectedEventDate, 'athletik.end', '10:15');
                    }}
                    className="p-1.5 bg-blue-950/50 hover:bg-blue-900/60 border border-blue-700/50 text-blue-300 rounded-lg text-[9px] font-bold text-left transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>🏋️</span> <span>Athletik 09:00</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateDayPlan(selectedEventDate, 'type', 'Training');
                      handleUpdateDayPlan(selectedEventDate, 'time', '18:15 - 18:45');
                      handleUpdateDayPlan(selectedEventDate, 'activity', 'Videoanalyse & Taktik');
                      handleUpdateDayPlan(selectedEventDate, 'video.start', '18:15');
                      handleUpdateDayPlan(selectedEventDate, 'video.end', '18:45');
                    }}
                    className="p-1.5 bg-teal-950/50 hover:bg-teal-900/60 border border-teal-700/50 text-teal-300 rounded-lg text-[9px] font-bold text-left transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>🎥</span> <span>Videoanalyse</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateDayPlan(selectedEventDate, 'type', 'Testspiel');
                      handleUpdateDayPlan(selectedEventDate, 'time', '19:00');
                      handleUpdateDayPlan(selectedEventDate, 'activity', 'Testspiel');
                      handleUpdateDayPlan(selectedEventDate, 'treffpunkt', '17:45');
                    }}
                    className="p-1.5 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-700/50 text-amber-300 rounded-lg text-[9px] font-bold text-left transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>🚩</span> <span>Testspiel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateDayPlan(selectedEventDate, 'type', 'Pflichtspiel');
                      handleUpdateDayPlan(selectedEventDate, 'time', '15:00');
                      handleUpdateDayPlan(selectedEventDate, 'activity', 'Verbandsliga Match');
                      handleUpdateDayPlan(selectedEventDate, 'treffpunkt', '13:30 Kabine');
                    }}
                    className="p-1.5 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-700/50 text-rose-300 rounded-lg text-[9px] font-bold text-left transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>🏆</span> <span>Pflichtspiel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateDayPlan(selectedEventDate, 'type', 'Frei');
                      handleUpdateDayPlan(selectedEventDate, 'time', '');
                      handleUpdateDayPlan(selectedEventDate, 'activity', 'Trainingsfrei / Regeneration');
                    }}
                    className="p-1.5 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 rounded-lg text-[9px] font-bold text-left transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>🧘</span> <span>Trainingsfrei</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] block mb-1">Datum</label>
                  <input 
                    type="date"
                    className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                    value={selectedEventDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedEventDate(e.target.value);
                      }
                    }}
                  />
                  <div className="text-[9px] font-medium text-[#94A3B8] mt-1">
                    {new Date(selectedEventDate).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] block mb-1">Saisonphase</label>
                  <select 
                    className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold uppercase text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                    value={mergedData[selectedEventDate]?.phase || 'season'}
                    onChange={(e) => handleUpdateDayPlan(selectedEventDate, 'phase', e.target.value)}
                  >
                    <option value="summer">Sommervorbereitung</option>
                    <option value="season">Saison</option>
                    <option value="winter">Wintervorbereitung</option>
                    <option value="break">Pause</option>
                  </select>
                </div>
              </div>

              {/* Geburtstag-Anzeige im Modal */}
              {(() => {
                const dayBirthdays = getBirthdaysForDate(selectedEventDate);
                if (dayBirthdays.length === 0) return null;
                return (
                  <div className="bg-pink-950/70 border border-pink-800/80 p-3 space-y-1 rounded-xl">
                    <div className="text-[9px] font-black uppercase text-pink-300 tracking-wider flex items-center gap-1.5">
                      <Gift size={12} className="text-pink-400 fill-pink-400" />
                      Geburtstage an diesem Tag!
                    </div>
                    <div className="space-y-1.5">
                      {dayBirthdays.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs font-bold text-pink-200">
                          <span className="flex items-center gap-1">
                            🎂 <strong className="text-pink-100">{p.name}</strong> ({p.categoryLabel})
                          </span>
                          {p.age !== undefined && (
                            <span className="bg-pink-900 text-pink-200 border border-pink-700 text-[9px] px-1.5 py-0.5 rounded font-black">
                              wird {p.age} Jahre alt!
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] block mb-1">Typ / Art des Termins</label>
                  <select 
                    className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold uppercase text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                    value={mergedData[selectedEventDate]?.type || 'Training'}
                    onChange={(e) => handleUpdateDayPlan(selectedEventDate, 'type', e.target.value)}
                  >
                    {Object.keys(typeColors).map(type => (
                      <option key={type} value={type} className="bg-[#202020] text-[#F5F5F5]">{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] block mb-1">Uhrzeit / Zeitfenster</label>
                  <input 
                    type="text"
                    className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold uppercase text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                    placeholder="z.B. 19:00 - 20:30"
                    value={mergedData[selectedEventDate]?.time || ''}
                    onChange={(e) => handleUpdateDayPlan(selectedEventDate, 'time', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] block mb-1">Fokus & Thema der Einheit</label>
                  <input 
                    type="text"
                    className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold uppercase text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                    placeholder="z.B. Taktik & Umschaltspiel"
                    value={mergedData[selectedEventDate]?.activity || ''}
                    onChange={(e) => handleUpdateDayPlan(selectedEventDate, 'activity', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] block mb-1">Austragungsort / Platz</label>
                  <input 
                    type="text"
                    className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold uppercase text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                    placeholder="z.B. Rasenplatz Auggen"
                    value={mergedData[selectedEventDate]?.location || ''}
                    onChange={(e) => handleUpdateDayPlan(selectedEventDate, 'location', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] block mb-1">Treffpunkt & Anreise</label>
                  <input 
                    type="text"
                    className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold uppercase text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                    placeholder="z.B. 18:30 Uhr Kabine"
                    value={mergedData[selectedEventDate]?.treffpunkt || ''}
                    onChange={(e) => handleUpdateDayPlan(selectedEventDate, 'treffpunkt', e.target.value)}
                  />
                </div>
                {(mergedData[selectedEventDate]?.type === 'Testspiel' || mergedData[selectedEventDate]?.type === 'Pflichtspiel' || mergedData[selectedEventDate]?.type === 'Spiel') && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] block mb-1">Gegner / Verein</label>
                    <input 
                      type="text"
                      className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold uppercase text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                      placeholder="Gegnerischer Verein"
                      value={mergedData[selectedEventDate]?.opponent || ''}
                      onChange={(e) => handleUpdateDayPlan(selectedEventDate, 'opponent', e.target.value)}
                    />
                  </div>
                )}
              </div>

              {(mergedData[selectedEventDate]?.type === 'Testspiel' || mergedData[selectedEventDate]?.type === 'Pflichtspiel' || mergedData[selectedEventDate]?.type === 'Spiel') && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] block mb-1">Ergebnis</label>
                  <input 
                    type="text"
                    className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold uppercase text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                    placeholder="z.B. 3:1"
                    value={mergedData[selectedEventDate]?.ergebnis || ''}
                    onChange={(e) => handleUpdateDayPlan(selectedEventDate, 'ergebnis', e.target.value)}
                  />
                </div>
              )}

              {/* Detailed Sessions Section */}
              <div className="space-y-3 border-t border-[#2A2A2A] pt-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#10B981] flex items-center gap-1.5">
                  <Clock size={14} /> Tagesstruktur & Einheiten
                </h4>
                {[
                  { label: 'Athletik / Kraft', key: 'athletik', defaultTime: '09:00' },
                  { label: 'Vormittagseinheit', key: 'vormittag', defaultTime: '10:30' },
                  { label: 'Individualtraining', key: 'individual', defaultTime: '14:00' },
                  { label: 'Videoanalyse / Taktik', key: 'video', defaultTime: '18:15' },
                  { label: 'Haupttraining (Feld)', key: 'training', defaultTime: '19:00' }
                ].map(session => (
                  <div key={session.key} className="p-3 bg-[#202020] border border-[#2A2A2A] rounded-xl space-y-2">
                    <div className="text-[10px] font-black uppercase text-[#C7C7C7] flex justify-between items-center">
                      <span>{session.label}</span>
                      {mergedData[selectedEventDate]?.[session.key]?.start ? (
                        <span className="text-[8px] bg-emerald-950 text-[#00D47A] border border-emerald-800 px-1.5 py-0.2 rounded font-black">Aktiv</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateDayPlan(selectedEventDate, `${session.key}.start`, session.defaultTime)}
                          className="text-[8px] text-[#10B981] hover:underline font-bold"
                        >
                          + Aktivieren ({session.defaultTime})
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="text"
                        placeholder="Start (z.B. 19:00)"
                        className="p-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded text-[10px] font-bold uppercase text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                        value={mergedData[selectedEventDate]?.[session.key]?.start || ''}
                        onChange={(e) => handleUpdateDayPlan(selectedEventDate, `${session.key}.start`, e.target.value)}
                      />
                      <input 
                        type="text"
                        placeholder="Ende (z.B. 20:30)"
                        className="p-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded text-[10px] font-bold uppercase text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                        value={mergedData[selectedEventDate]?.[session.key]?.end || ''}
                        onChange={(e) => handleUpdateDayPlan(selectedEventDate, `${session.key}.end`, e.target.value)}
                      />
                    </div>
                    <input 
                      type="text"
                      placeholder="Anmerkungen / Trainingsform..."
                      className="w-full p-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded text-[10px] font-medium text-[#F5F5F5] focus:outline-none focus:border-[#10B981]"
                      value={mergedData[selectedEventDate]?.[session.key]?.notes || ''}
                      onChange={(e) => handleUpdateDayPlan(selectedEventDate, `${session.key}.notes`, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Feiertags-Verwaltung */}
              <div className="space-y-3 border-t border-[#2A2A2A] pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5 text-[#FFD54F]">
                    <Flag size={14} className="text-[#FFD54F]" />
                    Feiertags- & Sonderregelung (BW)
                  </h4>
                  {getDayHolidayName(selectedEventDate) && (
                    <span className="text-[7px] bg-amber-950 text-[#FFD54F] border border-amber-800 font-bold px-1.5 py-0.5 rounded uppercase">
                      Aktiv
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-[#C7C7C7] bg-[#202020] p-2.5 border border-[#2A2A2A] rounded-xl">
                    {(() => {
                      const calcH = getHolidays(parseInt(selectedEventDate.split('-')[0], 10))[selectedEventDate];
                      const customH = yearlyPlan[selectedEventDate]?.customHolidayName;
                      if (customH === "") {
                        return (
                          <span>
                            Regulärer Feiertag (<span className="line-through">{calcH}</span>) wurde für diesen Tag <strong className="text-[#FF4C4C]">deaktiviert</strong>.
                          </span>
                        );
                      } else if (customH) {
                        return (
                          <span>
                            Benutzerdefinierter Feiertag: <strong className="text-[#FFD54F]">{customH}</strong> {calcH ? `(ersetzt regulären Feiertag: ${calcH})` : ''}
                          </span>
                        );
                      } else if (calcH) {
                        return (
                          <span>
                            Regulärer Feiertag in BW: <strong className="text-[#FFD54F]">{calcH}</strong>
                          </span>
                        );
                      } else {
                        return <span>Kein gesetzlicher Feiertag an diesem Tag.</span>;
                      }
                    })()}
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-[#C7C7C7]">Feiertagsname ändern / hinzufügen</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          className="flex-1 p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold text-[#F5F5F5] focus:outline-none focus:border-[#FFD54F] placeholder-[#888888]"
                          placeholder={getHolidays(parseInt(selectedEventDate.split('-')[0], 10))[selectedEventDate] || "z.B. Vereinsjubiläum"}
                          value={yearlyPlan[selectedEventDate]?.customHolidayName !== undefined ? (yearlyPlan[selectedEventDate]?.customHolidayName || '') : ''}
                          onChange={(e) => handleUpdateDayPlan(selectedEventDate, 'customHolidayName', e.target.value)}
                        />
                        {(yearlyPlan[selectedEventDate]?.customHolidayName !== undefined && yearlyPlan[selectedEventDate]?.customHolidayName !== null) && (
                          <button
                            onClick={() => handleUpdateDayPlan(selectedEventDate, 'customHolidayName', null)}
                            className="px-2.5 py-1 bg-[#2A2A2A] hover:bg-[#333333] text-[#F5F5F5] text-[9px] font-black uppercase tracking-wider transition-colors rounded-lg border border-[#3A3A3A]"
                            title="Auf Standard zurücksetzen"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Toggle Buttons */}
                    {(() => {
                      const calcH = getHolidays(parseInt(selectedEventDate.split('-')[0], 10))[selectedEventDate];
                      const customH = yearlyPlan[selectedEventDate]?.customHolidayName;
                      if (calcH && customH !== "") {
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateDayPlan(selectedEventDate, 'customHolidayName', '')}
                            className="w-full py-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800 text-red-300 text-[9px] font-black uppercase tracking-wider transition-colors rounded-lg text-center cursor-pointer"
                          >
                            Feiertag für diesen Tag deaktivieren
                          </button>
                        );
                      } else if (calcH && customH === "") {
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateDayPlan(selectedEventDate, 'customHolidayName', null)}
                            className="w-full py-1.5 bg-blue-950/60 hover:bg-blue-900/80 border border-blue-800 text-blue-300 text-[9px] font-black uppercase tracking-wider transition-colors rounded-lg text-center cursor-pointer"
                          >
                            Regulären Feiertag wieder aktivieren
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] block mb-1">Trainingsnotizen & Anweisungen</label>
                <textarea 
                  className="w-full h-24 p-3 bg-[#202020] border border-[#2A2A2A] rounded-xl text-sm font-medium text-[#F5F5F5] focus:outline-none focus:border-[#10B981] resize-none"
                  placeholder="Details zur Einheit, Trainingsinhalte, Bälle/Material, Notizen..."
                  value={mergedData[selectedEventDate]?.content || ''}
                  onChange={(e) => handleUpdateDayPlan(selectedEventDate, 'content', e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 bg-[#202020] border-t border-[#2A2A2A] flex justify-between items-center gap-2">
              <button 
                onClick={() => {
                  handleUpdateDayPlan(selectedEventDate, 'type', 'Frei');
                  handleUpdateDayPlan(selectedEventDate, 'time', '');
                  handleUpdateDayPlan(selectedEventDate, 'activity', '');
                  handleUpdateDayPlan(selectedEventDate, 'content', '');
                  handleUpdateDayPlan(selectedEventDate, 'location', '');
                  handleUpdateDayPlan(selectedEventDate, 'treffpunkt', '');
                  handleUpdateDayPlan(selectedEventDate, 'opponent', '');
                  handleUpdateDayPlan(selectedEventDate, 'ergebnis', '');
                  // Clear detailed sessions
                  ['athletik', 'vormittag', 'individual', 'video', 'training'].forEach(key => {
                    handleUpdateDayPlan(selectedEventDate, `${key}.start`, '');
                    handleUpdateDayPlan(selectedEventDate, `${key}.end`, '');
                    handleUpdateDayPlan(selectedEventDate, `${key}.notes`, '');
                  });
                  setSelectedEventDate(null);
                }}
                className="px-3.5 py-2 bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40 text-[10px] font-black uppercase tracking-wider hover:bg-[#EF4444] hover:text-white transition-all flex items-center gap-1.5 rounded-lg cursor-pointer"
              >
                <Trash2 size={13} /> <span>Einheit löschen</span>
              </button>
              
              <button 
                onClick={() => setSelectedEventDate(null)}
                className="px-5 py-2 bg-[#10B981] text-[#0A0E17] font-black text-xs uppercase tracking-wider hover:bg-[#059669] transition-all flex items-center gap-1.5 rounded-lg shadow-md cursor-pointer ml-auto"
              >
                <Check size={14} /> <span>Speichern & Schließen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showGenModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl flex flex-col text-[#F5F5F5] overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-[#202020] text-[#F5F5F5] flex justify-between items-center border-b border-[#2A2A2A]">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-[#F5F5F5]">
                <Calendar size={16} className="text-[#FFD54F]" />
                Saison-Planung generieren
              </h2>
              <button 
                onClick={() => setShowGenModal(false)}
                className="hover:text-[#FF4C4C] text-[#C7C7C7] transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {/* Zeitraum */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7]">Zeitraum</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase tracking-wider text-[#888888]">Start</span>
                    <input 
                      type="date"
                      className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold text-[#F5F5F5] focus:outline-none focus:border-[#FFD54F]"
                      value={genOptions.startDate}
                      onChange={(e) => setGenOptions(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase tracking-wider text-[#888888]">Ende</span>
                    <input 
                      type="date"
                      className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold text-[#F5F5F5] focus:outline-none focus:border-[#FFD54F]"
                      value={genOptions.endDate}
                      onChange={(e) => setGenOptions(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Trainings-Wochentage */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7]">Trainings-Wochentage</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Montag', value: 1 },
                    { label: 'Dienstag', value: 2 },
                    { label: 'Mittwoch', value: 3 },
                    { label: 'Donnerstag', value: 4 },
                    { label: 'Freitag', value: 5 },
                    { label: 'Samstag', value: 6 },
                    { label: 'Sonntag', value: 0 },
                  ].map(day => {
                    const isChecked = genOptions.trainingDays.includes(day.value);
                    return (
                      <label 
                        key={day.value}
                        className={`flex items-center gap-2 p-2 border rounded-xl text-[10px] font-black uppercase cursor-pointer select-none transition-all
                          ${isChecked ? 'bg-amber-950/60 border-[#FFD54F] text-[#FFD54F]' : 'bg-[#202020] border-[#2A2A2A] hover:border-[#FFD54F] text-[#C7C7C7]'}`}
                      >
                        <input 
                          type="checkbox"
                          className="hidden"
                          checked={isChecked}
                          onChange={() => toggleTrainingDay(day.value)}
                        />
                        <div className={`w-3.5 h-3.5 border border-current flex items-center justify-center text-[8px] rounded ${isChecked ? 'bg-[#FFD54F] text-[#0F0F0F]' : 'bg-[#1A1A1A]'}`}>
                          {isChecked && '✓'}
                        </div>
                        {day.label}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[8px] font-medium text-[#888888] italic">Nicht ausgewählte Wochentage werden im Jahresplan automatisch als freie Tage ("Spielfrei") markiert.</p>
              </div>

              {/* Feiertage */}
              <div className="space-y-2 bg-amber-950/40 p-3 border border-amber-800/80 rounded-xl">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#FFD54F]">Feiertage (Baden-Württemberg)</label>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    className="rounded border-[#2A2A2A] text-[#FFD54F] focus:ring-[#FFD54F]"
                    checked={genOptions.skipHolidays}
                    onChange={(e) => setGenOptions(prev => ({ ...prev, skipHolidays: e.target.checked }))}
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#F5F5F5]">Feiertage als freie Tage markieren</span>
                </label>
                <p className="text-[8px] font-medium text-[#C7C7C7] italic">Überspringt automatisch das Generieren von Einheiten an Feiertagen und markiert sie als "Frei".</p>
              </div>

              {/* Winterpause */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#C7C7C7]">Winterpause</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase tracking-wider text-[#888888]">Pause von</span>
                    <input 
                      type="date"
                      className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold text-[#F5F5F5] focus:outline-none focus:border-[#FFD54F]"
                      value={genOptions.breakStart}
                      onChange={(e) => setGenOptions(prev => ({ ...prev, breakStart: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase tracking-wider text-[#888888]">Pause bis</span>
                    <input 
                      type="date"
                      className="w-full p-2 bg-[#202020] border border-[#2A2A2A] rounded-lg text-xs font-bold text-[#F5F5F5] focus:outline-none focus:border-[#FFD54F]"
                      value={genOptions.breakEnd}
                      onChange={(e) => setGenOptions(prev => ({ ...prev, breakEnd: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#202020] border-t border-[#2A2A2A] flex justify-end gap-2">
              <button 
                onClick={() => setShowGenModal(false)}
                className="px-4 py-2 border border-[#2A2A2A] rounded-lg text-[10px] font-black uppercase tracking-widest text-[#C7C7C7] hover:bg-[#2A2A2A] transition-colors"
              >
                Abbrechen
              </button>
              <button 
                onClick={async () => {
                  setShowGenModal(false);
                  if ((window as any).generateSeasonSessions) {
                    await (window as any).generateSeasonSessions(genOptions);
                  }
                }}
                className="px-6 py-2 bg-[#FFD54F] text-[#0F0F0F] text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm hover:bg-[#ffe082] transition-all"
              >
                Generieren starten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
