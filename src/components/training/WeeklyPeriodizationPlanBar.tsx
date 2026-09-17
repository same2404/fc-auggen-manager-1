import React, { useState, useMemo, useEffect } from 'react';
import { TrainingSession, Player } from '../../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Calendar, 
  Shield, 
  Check, 
  X, 
  Plus, 
  Flame, 
  Layers,
  Sparkles,
  Play
} from 'lucide-react';

export interface DayPeriodization {
  dayName: 'Montag' | 'Dienstag' | 'Mittwoch' | 'Donnerstag' | 'Freitag' | 'Samstag' | 'Sonntag';
  dateStr: string; // YYYY-MM-DD
  formattedDate: string; // "07.09."
  intensityLevel: number; // 0 (Spieltag) to 9 (120-130%)
  label: string; // e.g. "Intervall-Training", "Ballbesitz & Kombination"
  percentageStr: string; // e.g. "120-130 %", "SPIEL", "FREI"
  isMatchDay: boolean;
  matchInfo?: {
    opponent: string;
    isHome: boolean;
    kickOff: string;
    location: string;
  };
}

interface WeeklyPeriodizationPlanBarProps {
  sessions: TrainingSession[];
  competitiveMatches?: any[];
  selectedSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onSaveSession: (session: TrainingSession) => void;
  onDeleteSession: (id: string) => void;
  players?: Player[];
}

// Intensity level definitions (0 to 9)
export const INTENSITY_LEVELS: Record<number, { label: string; percent: string; color: string; badgeBg: string }> = {
  0: { label: 'Pflichtspiel / Spieltag', percent: 'SPIEL', color: 'border-slate-800 text-slate-900', badgeBg: 'bg-slate-900 text-white' },
  1: { label: 'Ruhetag / Frei', percent: 'FREI', color: 'border-slate-300 text-slate-600', badgeBg: 'bg-slate-200 text-slate-700' },
  2: { label: 'Aktive Erholung', percent: '50-60 %', color: 'border-cyan-400 text-cyan-800', badgeBg: 'bg-cyan-600 text-white' },
  3: { label: 'Regeneration', percent: '60-70 %', color: 'border-lime-500 text-lime-800', badgeBg: 'bg-lime-600 text-white' },
  4: { label: 'Technik-Drill & Rondo', percent: '70-80 %', color: 'border-amber-400 text-amber-800', badgeBg: 'bg-amber-600 text-white' },
  5: { label: 'Grundlagenausdauer', percent: '80-90 %', color: 'border-amber-500 text-amber-900', badgeBg: 'bg-amber-700 text-white' },
  6: { label: 'Spielvorbereitung', percent: '90-100 %', color: 'border-emerald-500 text-emerald-800', badgeBg: 'bg-emerald-600 text-white' },
  7: { label: 'Pressing & Umschalten', percent: '100-110 %', color: 'border-emerald-600 text-emerald-900', badgeBg: 'bg-emerald-700 text-white' },
  8: { label: 'Ballbesitz & Kombination', percent: '110-120 %', color: 'border-emerald-600 text-emerald-900', badgeBg: 'bg-emerald-600 text-white' },
  9: { label: 'Intervall-Training', percent: '120-130 %', color: 'border-emerald-700 text-emerald-950', badgeBg: 'bg-emerald-600 text-white' }
};

// Standard Drill Tags
const DEFAULT_DRILL_TAGS = [
  { id: 'warmup', label: 'AUFWÄRMEN', icon: '⚽', color: 'border-sky-400 text-sky-800 bg-sky-50' },
  { id: 'technique', label: 'TECHNIK-DRILL', icon: '🏃', color: 'border-amber-400 text-amber-800 bg-amber-50' },
  { id: 'sprint', label: 'SPRINT-TRAINING', icon: '⚡', color: 'border-rose-400 text-rose-800 bg-rose-50' },
  { id: 'tactic', label: 'TAKTIK-SPIEL', icon: '🎯', color: 'border-purple-400 text-purple-800 bg-purple-50' },
  { id: 'standards', label: 'STANDARDS', icon: '📐', color: 'border-teal-400 text-teal-800 bg-teal-50' },
  { id: 'cooldown', label: 'COOL-DOWN', icon: '🧘', color: 'border-emerald-400 text-emerald-800 bg-emerald-50' },
];

// Helper to compute calendar week info
function getWeekRange(d: Date): { start: Date; end: Date; kw: number } {
  const date = new Date(d.getTime());
  const day = date.getDay();
  // Monday is day 1, Sunday is day 7
  const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // ISO week number
  const target = new Date(monday.valueOf());
  const dayNr = (monday.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const kw = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

  return { start: monday, end: sunday, kw };
}

function formatDateDDMM(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.`;
}

function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const WeeklyPeriodizationPlanBar: React.FC<WeeklyPeriodizationPlanBarProps> = ({
  sessions,
  competitiveMatches = [],
  selectedSessionId,
  onSelectSession,
  onSaveSession,
  onDeleteSession,
  players = []
}) => {
  // Mode: Einzelwoche vs 3-4-Wochen-Block
  const [viewMode, setViewMode] = useState<'single' | 'block'>('single');

  // Currently viewed week reference (starts with current date, 2026-09-17 => KW 38)
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(() => new Date('2026-09-17T12:00:00'));

  // Custom user overrides for day intensities: Record<"YYYY-MM-DD", number>
  const [customIntensities, setCustomIntensities] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('fc_auggen_custom_intensities_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Active tags filter / active tag pills
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showVersionModal, setShowVersionModal] = useState<boolean>(false);
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showTags, setShowTags] = useState<boolean>(false);

  // Save custom intensities
  const updateDayIntensity = (dateStr: string, level: number) => {
    setCustomIntensities(prev => {
      const updated = { ...prev, [dateStr]: level };
      try {
        localStorage.setItem('fc_auggen_custom_intensities_v1', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save custom intensities', e);
      }
      return updated;
    });
  };

  // Week range details
  const { start: monday, end: sunday, kw } = useMemo(() => {
    return getWeekRange(currentWeekDate);
  }, [currentWeekDate]);

  // Navigate weeks
  const handlePrevWeek = () => {
    const prev = new Date(currentWeekDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekDate);
    next.setDate(next.getDate() + 7);
    setCurrentWeekDate(next);
  };

  const handleGoToday = () => {
    setCurrentWeekDate(new Date('2026-09-17T12:00:00'));
  };

  // Build the 7 days for the current week
  const weekDays = useMemo<DayPeriodization[]>(() => {
    const dayNames: ('Montag' | 'Dienstag' | 'Mittwoch' | 'Donnerstag' | 'Freitag' | 'Samstag' | 'Sonntag')[] = [
      'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'
    ];

    // Find any match in this week
    const mondayIso = formatIsoDate(monday);
    const sundayIso = formatIsoDate(sunday);

    const weekMatches = competitiveMatches.filter((m: any) => {
      const mDate = m.date;
      return mDate && mDate >= mondayIso && mDate <= sundayIso;
    });

    const primaryMatch = weekMatches.length > 0 ? weekMatches[0] : null;
    let matchDayIndex = -1; // 0 = Mo, 4 = Fr, 5 = Sa, 6 = So
    if (primaryMatch) {
      const pDate = new Date(primaryMatch.date + 'T12:00:00');
      const pDay = pDate.getDay();
      matchDayIndex = pDay === 0 ? 6 : pDay - 1;
    }

    return dayNames.map((dName, idx) => {
      const currD = new Date(monday);
      currD.setDate(monday.getDate() + idx);
      const dateStr = formatIsoDate(currD);
      const formattedDate = formatDateDDMM(currD);

      const isMatchDay = idx === matchDayIndex;
      const matchForDay = isMatchDay ? primaryMatch : null;

      // Determine automatic tactical periodization intensity ("immer nach Spiel")
      let defaultLevel = 1; // Ruhetag / Frei
      let defaultLabel = 'Ruhetag / Frei';

      if (isMatchDay) {
        defaultLevel = 0;
        defaultLabel = `Pflichtspiel vs. ${matchForDay.opponent}`;
      } else if (matchDayIndex !== -1) {
        const diffFromMatch = idx - matchDayIndex;
        // e.g. Friday match (matchDayIndex = 4):
        // Mo (idx 0, diff -4): Intervall 9
        // Di (idx 1, diff -3): Ballbesitz 8
        // Mi (idx 2, diff -2): Regeneration 3
        // Do (idx 3, diff -1): Spielvorbereitung 6
        // Fr (idx 4, diff 0): Spieltag 0
        // Sa (idx 5, diff +1): Regeneration 3
        // So (idx 6, diff +2): Ruhetag 1
        if (diffFromMatch === -1) {
          defaultLevel = 6;
          defaultLabel = 'Spielvorbereitung';
        } else if (diffFromMatch === -2) {
          defaultLevel = matchDayIndex === 4 ? 3 : 8; // If Friday match, Wednesday is Active Rest; if Saturday match, Thursday is light
          defaultLabel = matchDayIndex === 4 ? 'Regeneration' : 'Ballbesitz & Kombination';
        } else if (diffFromMatch === -3) {
          defaultLevel = matchDayIndex === 4 ? 8 : 9;
          defaultLabel = matchDayIndex === 4 ? 'Ballbesitz & Kombination' : 'Intervall-Training';
        } else if (diffFromMatch === -4) {
          defaultLevel = matchDayIndex === 4 ? 9 : 8;
          defaultLabel = matchDayIndex === 4 ? 'Intervall-Training' : 'Ballbesitz & Kombination';
        } else if (diffFromMatch === 1) {
          defaultLevel = 3;
          defaultLabel = 'Regeneration';
        } else {
          defaultLevel = 1;
          defaultLabel = 'Ruhetag / Frei';
        }
      } else {
        // No match this week: standard training microcycle
        if (idx === 0) { defaultLevel = 9; defaultLabel = 'Intervall-Training'; }
        else if (idx === 1) { defaultLevel = 8; defaultLabel = 'Ballbesitz & Kombination'; }
        else if (idx === 2) { defaultLevel = 3; defaultLabel = 'Regeneration'; }
        else if (idx === 3) { defaultLevel = 7; defaultLabel = 'Pressing & Umschalten'; }
        else if (idx === 4) { defaultLevel = 6; defaultLabel = 'Abschlusstraining'; }
        else { defaultLevel = 1; defaultLabel = 'Wochenende'; }
      }

      // Check if user set a custom level override
      const actualLevel = customIntensities[dateStr] !== undefined ? customIntensities[dateStr] : defaultLevel;
      const levelInfo = INTENSITY_LEVELS[actualLevel] || INTENSITY_LEVELS[1];

      return {
        dayName: dName,
        dateStr,
        formattedDate,
        intensityLevel: actualLevel,
        label: actualLevel === 0 && matchForDay ? `Pflichtspiel vs. ${matchForDay.opponent}` : (customIntensities[dateStr] !== undefined ? levelInfo.label : defaultLabel),
        percentageStr: levelInfo.percent,
        isMatchDay,
        matchInfo: matchForDay ? {
          opponent: matchForDay.opponent,
          isHome: matchForDay.isHome !== false,
          kickOff: matchForDay.kickOff || '17:30',
          location: matchForDay.location || (matchForDay.isHome !== false ? 'Auggen (Heim)' : 'Auswärts')
        } : undefined
      };
    });
  }, [monday, sunday, competitiveMatches, customIntensities]);

  // Check how many training sessions already exist in this week
  const existingWeekSessions = useMemo(() => {
    const datesInWeek = new Set(weekDays.map(d => d.dateStr));
    return sessions.filter(s => s && s.date && datesInWeek.has(s.date));
  }, [sessions, weekDays]);

  // Is current week fully planned?
  const plannedTrainingDays = useMemo(() => {
    return weekDays.filter(d => d.intensityLevel > 1); // Days with training
  }, [weekDays]);

  const isCurrentWeekFullyPlanned = plannedTrainingDays.length > 0 && 
    plannedTrainingDays.every(d => sessions.some(s => s && s.date === d.dateStr));

  // Generate or ensure sessions for current week
  const handleGenerateWeekSessions = () => {
    let createdCount = 0;
    plannedTrainingDays.forEach(day => {
      const existing = sessions.find(s => s && s.date === day.dateStr);
      if (!existing) {
        const levelConfig = INTENSITY_LEVELS[day.intensityLevel] || INTENSITY_LEVELS[8];
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        const newSession: TrainingSession = {
          id: newSessionId,
          date: day.dateStr,
          weekday: day.dayName,
          group: '1. Mannschaft',
          load: levelConfig.percent,
          duration: '90 Min',
          weeklyFocus: `KW ${kw}: ${day.label}`,
          sessionFocus: `${day.label} (${levelConfig.percent})`,
          trainer: 'Amin, Marcel',
          intensity: `${day.intensityLevel}/9`,
          importantInfo: `Periodisierung Stufe ${day.intensityLevel} (${day.percentageStr}). Intensität: ${levelConfig.label}.`,
          remarks: 'Automatisch aus Wochenperiodisierung generiert.',
          content: {
            warmup: `Dynamisches Warm-up & Aktivierung passend zu ${day.label}. Koordinationsleitern, Mobilisation, 5-vs-2 Rondo mit hoher Passtempo-Vorgabe.`,
            main1: `Schwerpunkt ${day.label}: Positionsspiel im 4-vs-4 + 3 Neutralen auf engem Raum. Schnelle Verlagerungen und direktes Gegenpressing bei Ballverlust.`,
            main2: `Abschlussspiel mit Zonenvorgabe. Umschaltverhalten in 3er-Ketten-Sicherung. Hohe Spielschärfe und Zweikampfintensität.`,
            closing: `Aktives Auslaufen, Faszienrollen (Blackroll) und regenerative Dehnübungen.`
          },
          players: players.map(p => ({
            name: `${p.lastName} ${p.firstName}`,
            position: p.position || 'MF',
            status: '1' as any,
            category: p.category || 'player'
          }))
        };

        onSaveSession(newSession);
        createdCount++;
      }
    });

    setNotificationBanner(`${createdCount} Einheiten für KW ${kw} erfolgreich generiert!`);
    setTimeout(() => setNotificationBanner(null), 4000);
  };

  // Open or select session for a specific day
  const handleDayCardClick = (day: DayPeriodization) => {
    const existing = sessions.find(s => s && s.date === day.dateStr);
    if (existing) {
      onSelectSession(existing.id);
    } else if (day.intensityLevel > 1) {
      // Create quick session on the fly
      const levelConfig = INTENSITY_LEVELS[day.intensityLevel] || INTENSITY_LEVELS[8];
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const newSession: TrainingSession = {
        id: newSessionId,
        date: day.dateStr,
        weekday: day.dayName,
        group: '1. Mannschaft',
        load: levelConfig.percent,
        duration: '90 Min',
        weeklyFocus: `KW ${kw}: ${day.label}`,
        sessionFocus: `${day.label} (${levelConfig.percent})`,
        trainer: 'Amin, Marcel',
        intensity: `${day.intensityLevel}/9`,
        importantInfo: `Periodisierung Stufe ${day.intensityLevel} (${day.percentageStr}). Intensität: ${levelConfig.label}.`,
        remarks: 'Schnell-Einheit aus Wochenperiodisierung.',
        content: {
          warmup: `Warm-up & Aktivierung: Rondo & Passfolgen.`,
          main1: `Taktik & Technik: ${day.label}.`,
          main2: `Spielform mit Provokationsregeln.`,
          closing: `Regeneratives Auslaufen.`
        },
        players: players.map(p => ({
          name: `${p.lastName} ${p.firstName}`,
          position: p.position || 'MF',
          status: '1' as any,
          category: p.category || 'player'
        }))
      };
      onSaveSession(newSession);
      onSelectSession(newSessionId);
    }
  };

  // Toggle tag active
  const handleToggleTag = (tagLabel: string) => {
    setActiveTags(prev => 
      prev.includes(tagLabel) ? prev.filter(t => t !== tagLabel) : [...prev, tagLabel]
    );
  };

  // 3-4-Wochen-Block calculation (Current week + next 3 weeks)
  const blockWeeks = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i * 7);
      const wRange = getWeekRange(d);
      
      const mIso = formatIsoDate(wRange.start);
      const sIso = formatIsoDate(wRange.end);
      const match = competitiveMatches.find((m: any) => m.date >= mIso && m.date <= sIso);

      const wSessions = sessions.filter(s => s && s.date && s.date >= mIso && s.date <= sIso);

      weeks.push({
        kw: wRange.kw,
        startStr: formatDateDDMM(wRange.start),
        endStr: formatDateDDMM(wRange.end),
        dateRef: d,
        match,
        sessionCount: wSessions.length
      });
    }
    return weeks;
  }, [monday, competitiveMatches, sessions]);

  return (
    <div className="w-full max-w-3xl mx-auto my-1 px-1 font-sans select-none shrink-0 print:hidden">
      <div className="bg-[#08101e] text-slate-100 rounded-lg border border-slate-800 shadow-sm overflow-hidden">
        {/* Sleek Master Bar (Single Slim Line) */}
        <div className="px-2 py-1 bg-[#060c18] border-b border-slate-800/80 flex items-center justify-between gap-1 flex-wrap min-h-[30px]">
          {/* Left: Title + Week Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div 
              className="flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity" 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              title={isCollapsed ? 'Ausklappen' : 'Einklappen'}
            >
              <Flame className="text-amber-500 w-3 h-3" />
              <span className="text-[#f59e0b] font-black text-[10px] tracking-wide uppercase">
                KW {kw}
              </span>
            </div>

            {/* Week Navigator */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={handlePrevWeek}
                className="bg-[#162035] hover:bg-[#22314e] text-white p-0.5 rounded border border-slate-700 transition-colors"
                title="Vorherige Woche"
              >
                <ChevronLeft size={11} />
              </button>

              <div className="relative">
                <select
                  value={formatIsoDate(monday)}
                  onChange={(e) => setCurrentWeekDate(new Date(e.target.value + 'T12:00:00'))}
                  className="bg-[#162035] text-white font-bold text-[9px] h-5 px-1.5 pr-3.5 rounded border border-slate-700 cursor-pointer appearance-none focus:outline-none focus:border-amber-500"
                >
                  {Array.from({ length: 44 }).map((_, i) => {
                    const seasonStart = new Date('2026-08-03T12:00:00');
                    seasonStart.setDate(seasonStart.getDate() + i * 7);
                    const w = getWeekRange(seasonStart);
                    const isoStart = formatIsoDate(w.start);
                    const isoEnd = formatIsoDate(w.end);
                    const wMatch = competitiveMatches.find((m: any) => m.date >= isoStart && m.date <= isoEnd);
                    const matchSuffix = wMatch ? ` · vs. ${wMatch.opponent}` : '';

                    return (
                      <option key={isoStart} value={isoStart}>
                        KW {w.kw} ({formatDateDDMM(w.start)}–{formatDateDDMM(w.end)}){matchSuffix}
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-400">
                  <span className="text-[7px]">▼</span>
                </div>
              </div>

              <button
                onClick={handleNextWeek}
                className="bg-[#162035] hover:bg-[#22314e] text-white p-0.5 rounded border border-slate-700 transition-colors"
                title="Nächste Woche"
              >
                <ChevronRight size={11} />
              </button>

              <button
                onClick={handleGoToday}
                className="bg-[#064e3b] hover:bg-[#047857] text-emerald-300 font-black text-[9px] px-1 py-0.5 rounded border border-emerald-700/60 transition-colors"
                title="Zu heute springen"
              >
                Heute
              </button>
            </div>

            {/* Match info if match exists */}
            {weekDays.some(d => d.isMatchDay) && (
              <div className="hidden sm:flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded text-[9px]">
                <span className="text-amber-400 font-bold">⚽</span>
                {weekDays.filter(d => d.isMatchDay).map(d => (
                  <span key={d.dateStr} className="text-white font-semibold truncate max-w-[170px]">
                    {d.dayName.slice(0, 2)}: {d.matchInfo?.opponent} ({d.matchInfo?.kickOff})
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-1 py-0.5 rounded hidden md:inline">
              {existingWeekSessions.length}/{plannedTrainingDays.length}
            </span>

            <button
              onClick={handleGenerateWeekSessions}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-[9px] px-1.5 py-0.5 rounded shadow flex items-center gap-0.5 transition-all cursor-pointer"
              title={`Trainingseinheiten für KW ${kw} erzeugen`}
            >
              <Calendar size={10} className="text-white" />
              <span>+ Erzeugen</span>
            </button>

            {/* Toggle Expand / Collapse */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="bg-[#1b263b] hover:bg-[#283854] text-amber-400 font-bold text-[9px] px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-0.5 transition-all cursor-pointer"
              title={isCollapsed ? "Wochenplan ausklappen" : "Wochenplan einklappen"}
            >
              {isCollapsed ? (
                <>
                  <ChevronDown size={10} />
                  <span>Auf</span>
                </>
              ) : (
                <>
                  <ChevronUp size={10} />
                  <span>Zu</span>
                </>
              )}
            </button>
          </div>
        </div>

        {notificationBanner && (
          <div className="bg-emerald-900/90 border-b border-emerald-500 text-emerald-100 px-2 py-0.5 text-[10px] font-bold flex items-center justify-between">
            <span>{notificationBanner}</span>
            <button onClick={() => setNotificationBanner(null)} className="text-emerald-300 hover:text-white">
              <X size={11} />
            </button>
          </div>
        )}

        {/* Main View: Single Week 7 Days Minimal Grid */}
        {!isCollapsed && (
          <div className="p-1 bg-[#0a1222]">
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map(day => {
                const existingSession = sessions.find(s => s && s.date === day.dateStr);
                const isSelected = existingSession && selectedSessionId === existingSession.id;
                const intensityConfig = INTENSITY_LEVELS[day.intensityLevel] || INTENSITY_LEVELS[1];

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => handleDayCardClick(day)}
                    className={`bg-white text-slate-900 rounded border p-1 flex flex-col justify-between h-[44px] transition-all cursor-pointer relative hover:shadow-sm ${
                      day.isMatchDay 
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-500/50' 
                        : (isSelected ? 'border-amber-500 ring-1 ring-amber-400' : 'border-slate-300 hover:border-slate-400')
                    }`}
                  >
                    {/* Left color bar indicator */}
                    <div className={`absolute top-0 left-0 bottom-0 w-1 rounded-l ${
                      day.isMatchDay ? 'bg-emerald-600' : (day.intensityLevel > 6 ? 'bg-emerald-500' : (day.intensityLevel > 2 ? 'bg-lime-500' : 'bg-slate-300'))
                    }`} />

                    {/* Top: Day & Date & Dot */}
                    <div className="pl-1 flex items-center justify-between leading-none">
                      <span className="font-black text-[9px] uppercase text-slate-900 truncate">
                        {day.dayName.slice(0, 2)} {day.formattedDate.replace('.', '')}
                      </span>
                      {existingSession ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Einheit existiert" />
                      ) : (
                        day.isMatchDay && <span className="text-[8px] font-black text-emerald-700">⚽</span>
                      )}
                    </div>

                    {/* Controls Row */}
                    <div className="pl-1 flex items-center justify-between gap-0.5 leading-none" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={day.intensityLevel}
                        onChange={(e) => updateDayIntensity(day.dateStr, Number(e.target.value))}
                        className="bg-[#121927] hover:bg-[#1e2a40] text-white font-black text-[8px] h-3.5 px-0.5 py-0 rounded border border-slate-700 cursor-pointer focus:outline-none"
                      >
                        <option value={0}>0·Sp</option>
                        <option value={9}>9·120</option>
                        <option value={8}>8·110</option>
                        <option value={7}>7·100</option>
                        <option value={6}>6·90</option>
                        <option value={5}>5·80</option>
                        <option value={4}>4·70</option>
                        <option value={3}>3·60</option>
                        <option value={2}>2·50</option>
                        <option value={1}>1·Fr</option>
                      </select>

                      <span className={`text-[7px] font-black px-0.5 py-0.2 rounded uppercase tracking-tighter shrink-0 ${intensityConfig?.badgeBg || 'bg-slate-700 text-white'}`}>
                        {day.intensityLevel === 0 ? 'SPIEL' : day.intensityLevel === 1 ? 'FREI' : (intensityConfig?.percent ? (intensityConfig.percent.includes('-') ? `${intensityConfig.percent.split('-')[0].trim()}%` : intensityConfig.percent) : '')}
                      </span>

                      {/* Quick action button */}
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        {existingSession ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(existingSession.id);
                            }}
                            className="p-0.5 hover:bg-red-100 rounded text-red-500 transition-colors"
                            title="Einheit löschen"
                          >
                            <X size={9} className="stroke-[3]" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDayCardClick(day);
                            }}
                            className="p-0.5 hover:bg-emerald-100 rounded text-emerald-600 transition-colors"
                            title="Planen"
                          >
                            <Check size={9} className="stroke-[3]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Version Presets Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl max-w-lg w-full text-slate-100 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="text-indigo-400 w-5 h-5" />
                <h3 className="font-black uppercase text-sm tracking-wide text-white">
                  Periodisierungs-Versionen & Spieltags-Modelle
                </h3>
              </div>
              <button onClick={() => setShowVersionModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div 
                onClick={() => {
                  // Apply standard MD model
                  setNotificationBanner("Standard Verbandsliga MD-Periodisierung angewendet!");
                  setShowVersionModal(false);
                }}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer transition-all"
              >
                <div className="font-black text-amber-400 flex items-center justify-between">
                  <span>1. Standard Verbandsliga MD-Modell (Freitag / Samstag Spiel)</span>
                  <span className="text-[10px] bg-emerald-700 text-white px-1.5 py-0.5 rounded">EMPFOHLEN</span>
                </div>
                <p className="text-slate-300 mt-1">
                  Intervall (Stufe 9) am Wochenanfang, Ballbesitz (Stufe 8), Regeneration in Wochenmitte, Spielvorbereitung (Stufe 6) vor dem Matchday.
                </p>
              </div>

              <div 
                onClick={() => {
                  setNotificationBanner("Hohe Belastungswoche angewendet!");
                  setShowVersionModal(false);
                }}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer transition-all"
              >
                <div className="font-black text-white">2. Hohe Belastungswoche (Stufe 8-9)</div>
                <p className="text-slate-300 mt-1">
                  Höchste athletische Intensität und umfangreiche Spielformen mit kurzem Übergang.
                </p>
              </div>

              <div 
                onClick={() => {
                  setNotificationBanner("Regenerationswoche angewendet!");
                  setShowVersionModal(false);
                }}
                className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer transition-all"
              >
                <div className="font-black text-white">3. Regenerationswoche (Stufe 3-5)</div>
                <p className="text-slate-300 mt-1">
                  Taktikfokus, Rondo, Mobilisation und reduziertes Laufpensum nach englischen Wochen.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowVersionModal(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs px-4 py-2 rounded"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
