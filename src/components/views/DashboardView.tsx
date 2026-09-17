import React, { useState, useMemo } from 'react';
import { 
  Spieler, 
  Player, 
  TabId 
} from '../../types';
import { isPlayer } from '../../utils/playerSorting';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Activity, 
  Trophy, 
  Sparkles, 
  TrendingUp, 
  Stethoscope, 
  Flame, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ChevronRight, 
  Zap, 
  Award, 
  ArrowUpRight, 
  FileUp, 
  Brain,
  Edit,
  ShieldCheck,
  BarChart3,
  Check,
  Loader2,
  RotateCcw
} from 'lucide-react';

interface DashboardViewProps {
  players: Spieler[];
  competitiveMatches?: any[];
  testMatches?: any[];
  trainingSessions?: any[];
  onSaveTestMatch?: (match: any) => void;
  onNavigateToTab?: (tabId: TabId) => void;
  viewMode?: 'focus' | 'pro';
  onToggleViewMode?: (mode?: 'focus' | 'pro') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  players,
  competitiveMatches = [],
  testMatches = [],
  trainingSessions = [],
  onSaveTestMatch,
  onNavigateToTab,
  viewMode = 'focus',
  onToggleViewMode
}) => {
  // File upload state for Module 8 (KI-Datenimport)
  const [uploads, setUploads] = useState<Array<{
    id: string;
    name: string;
    type: string;
    date: string;
    status: 'completed' | 'processing';
    summary: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem('dashboard_ki_uploads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleClearUploads = () => {
    setUploads([]);
    try {
      localStorage.removeItem('dashboard_ki_uploads');
    } catch (e) {
      console.error(e);
    }
    setSaveSuccessMsg('Import-Verlauf wurde vollständig geleert.');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Dynamic calculations from existing App Data (only active squad players)
  const squadPlayers = useMemo(() => {
    return players.filter(p => isPlayer(p));
  }, [players]);

  const injuredPlayers = useMemo(() => {
    return squadPlayers.filter(p => p.status === 'Verletzt' || p.status === 'Physio/Reha' || p.isInjured);
  }, [squadPlayers]);

  const suspendedPlayers = useMemo(() => {
    return squadPlayers.filter(p => p.status === 'Gesperrt');
  }, [squadPlayers]);

  const availablePlayersCount = useMemo(() => {
    return Math.max(0, squadPlayers.length - injuredPlayers.length - suspendedPlayers.length);
  }, [squadPlayers, injuredPlayers, suspendedPlayers]);

  // State for editing Module 1 (Nächstes Spiel) with localStorage persistence
  const [isEditingNextMatch, setIsEditingNextMatch] = useState(false);
  const [customNextMatchData, setCustomNextMatchData] = useState<{
    opponent?: string;
    competition?: string;
    badgeText?: string;
    date?: string;
    time?: string;
    location?: string;
    meetingPoint?: string;
    nextCompetitiveText?: string;
  }>(() => {
    try {
      const saved = localStorage.getItem('dashboard_custom_next_match');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // State for editing Module 2 (Letztes Spiel - Kurzanalyse) with localStorage persistence
  const [isEditingLastMatch, setIsEditingLastMatch] = useState(false);
  const [customLastMatchData, setCustomLastMatchData] = useState<{
    result?: string;
    opponent?: string;
    scorers?: string;
    notes?: string;
  }>(() => {
    try {
      const saved = localStorage.getItem('dashboard_custom_last_match');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Helper function to convert any date representation to YYYY-MM-DD
  const toIsoDate = (dStr?: string): string => {
    if (!dStr) return '';
    const clean = dStr.trim();
    const isoMatch = clean.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    const germanMatch = clean.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (germanMatch) {
      const day = germanMatch[1].padStart(2, '0');
      const month = germanMatch[2].padStart(2, '0');
      const year = germanMatch[3];
      return `${year}-${month}-${day}`;
    }
    return dStr;
  };

  const formatDateGerman = (dStr?: string) => {
    if (!dStr) return 'Sa., 18.07.2026';
    const iso = toIsoDate(dStr);
    if (iso && iso.length === 10) {
      try {
        const parts = iso.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          const days = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
          const dayName = days[d.getDay()];
          const dayFormatted = String(day).padStart(2, '0');
          const monthFormatted = String(month + 1).padStart(2, '0');
          return `${dayName}, ${dayFormatted}.${monthFormatted}.${year}`;
        }
      } catch (e) {
        // ignore
      }
    }
    return dStr;
  };

  // Combine and sort all test matches and competitive matches chronologically
  const allMatchesSorted = useMemo(() => {
    const list: any[] = [];
    if (testMatches && Array.isArray(testMatches)) {
      testMatches.forEach(m => {
        list.push({
          ...m,
          matchType: 'test',
          competitionName: m.competition ? `${m.competition} (Vorbereitung)` : 'Testspiel (Vorbereitung)'
        });
      });
    }
    if (competitiveMatches && Array.isArray(competitiveMatches)) {
      competitiveMatches.forEach(m => {
        list.push({
          ...m,
          matchType: 'competitive',
          competitionName: m.competition || 'Pflichtspiel (SBFV-Pokal / Verbandsliga)'
        });
      });
    }
    return list.sort((a, b) => {
      const isoA = toIsoDate(a.date);
      const isoB = toIsoDate(b.date);
      if (isoA && isoB && isoA !== isoB) return isoA.localeCompare(isoB);
      return (a.kickOff || '').localeCompare(b.kickOff || '');
    });
  }, [testMatches, competitiveMatches]);

  // Helper to determine if a match is finished/completed
  const isMatchFinished = (m: any) => {
    if (m.result && String(m.result).trim() !== '') return true;
    if (m.ergebnis && String(m.ergebnis).trim() !== '') return true;
    if (m.status === 'Abpfiff' || m.status === 'Beendet' || m.status === 'Gespielt') return true;
    const iso = toIsoDate(m.date);
    if (iso && iso <= '2026-07-28') return true;
    return false;
  };

  // Next upcoming match calculation (dynamically picks the earliest unplayed match from testMatches & competitiveMatches)
  const nextMatch = useMemo(() => {
    const unplayedMatches = allMatchesSorted.filter(m => !isMatchFinished(m));
    const upcomingMatch = unplayedMatches.find(m => m.isNextMatch) || unplayedMatches.find(m => {
      const iso = toIsoDate(m.date);
      return !iso || iso >= '2026-09-01';
    }) || (unplayedMatches.length > 0 ? unplayedMatches[0] : null);

    let base = {
      opponent: 'Offenburger FV',
      competition: 'Verbandsliga Südbaden',
      badgeText: 'NÄCHSTES PFLICHTSPIEL',
      date: 'Sa., 19.09.2026',
      time: '15:30 Uhr',
      location: 'Auggen (Heim)',
      meetingPoint: '14:00 Uhr Kabine/Treffpunkt',
      nextCompetitiveText: 'Danach: FC Teningen (Sa., 26.09.2026, 15:30 Uhr - Verbandsliga Südbaden)'
    };

    if (upcomingMatch) {
      const dateFormatted = formatDateGerman(upcomingMatch.date);
      const todayIso = new Date().toISOString().split('T')[0];
      const matchIso = toIsoDate(upcomingMatch.date);
      const isToday = matchIso === todayIso;

      let nextCompText = '';
      const upcomingIndex = unplayedMatches.findIndex(m => m.id === upcomingMatch.id);
      const followingGame = upcomingIndex >= 0 && upcomingIndex + 1 < unplayedMatches.length 
        ? unplayedMatches[upcomingIndex + 1] 
        : unplayedMatches[1];

      if (followingGame) {
        const follOpponent = followingGame.opponent || followingGame.gegner || 'SV Linx';
        const follDate = formatDateGerman(followingGame.date);
        const follTime = followingGame.kickOff ? `${followingGame.kickOff} Uhr` : '';
        const follComp = followingGame.competitionName || followingGame.competition || 'Verbandsliga Südbaden';
        nextCompText = `Danach: ${follOpponent} (${follDate}${follTime ? `, ${follTime}` : ''} - ${follComp})`;
      }

      base = {
        opponent: upcomingMatch.opponent || upcomingMatch.gegner || 'SC Konstanz-Wollmatingen',
        competition: upcomingMatch.competitionName || upcomingMatch.competition || 'Verbandsliga Südbaden',
        badgeText: isToday ? 'HEUTE • SPIELTAG' : (upcomingMatch.matchType === 'test' ? 'TESTSPIEL' : (upcomingMatch.competition?.includes('Pokal') ? 'POKAL-AUFTAKT' : 'PFLICHTSPIEL')),
        date: dateFormatted,
        time: upcomingMatch.kickOff ? `${upcomingMatch.kickOff} Uhr` : '16:30 Uhr',
        location: upcomingMatch.location || (upcomingMatch.isHome !== false ? 'Auggen (Heim)' : 'Auswärts'),
        meetingPoint: upcomingMatch.meetingTime ? `${upcomingMatch.meetingTime} Uhr Kabine/Treffpunkt` : '15:00 Uhr Kabine/Treffpunkt',
        nextCompetitiveText: nextCompText
      };
    }

    if (isEditingNextMatch && Object.keys(customNextMatchData).length > 0) {
      return {
        opponent: customNextMatchData.opponent ?? base.opponent,
        competition: customNextMatchData.competition ?? base.competition,
        badgeText: customNextMatchData.badgeText ?? base.badgeText,
        date: customNextMatchData.date ?? base.date,
        time: customNextMatchData.time ?? base.time,
        location: customNextMatchData.location ?? base.location,
        meetingPoint: customNextMatchData.meetingPoint ?? base.meetingPoint,
        nextCompetitiveText: customNextMatchData.nextCompetitiveText !== undefined ? customNextMatchData.nextCompetitiveText : base.nextCompetitiveText
      };
    }

    return base;
  }, [allMatchesSorted, customNextMatchData, isEditingNextMatch]);

  // Last finished match calculation (dynamically picks the most recent completed game from testMatches & competitiveMatches)
  const lastTestMatch = useMemo(() => {
    const finishedMatches = allMatchesSorted.filter(m => isMatchFinished(m));
    
    if (finishedMatches.length > 0) {
      const finished = finishedMatches[finishedMatches.length - 1];
      const prevMatch = finishedMatches.length > 1 ? finishedMatches[finishedMatches.length - 2] : null;

      const dateFormatted = formatDateGerman(finished.date);
      const timeStr = finished.kickOff ? `${finished.kickOff} Uhr` : '14:00 Uhr';

      const isHome = finished.isHome !== undefined 
        ? finished.isHome 
        : !finished.location?.toLowerCase().includes('auswärts');

      const opponentName = (isEditingLastMatch && customLastMatchData.opponent) || finished.opponent || finished.gegner || 'FC Rot-Weiß Salem';
      const resultVal = (isEditingLastMatch && customLastMatchData.result) || finished.result || finished.ergebnis || '1:2';

      const homeTeam = isHome ? 'FC Auggen' : opponentName;
      const awayTeam = isHome ? opponentName : 'FC Auggen';

      return {
        opponent: opponentName,
        date: dateFormatted,
        time: timeStr,
        fullDateTime: `${dateFormatted}${timeStr ? `, ${timeStr}` : ''}`,
        result: resultVal,
        status: finished.status || 'Abpfiff',
        competition: finished.competitionName || finished.competition || 'Verbandsliga Südbaden',
        isHome,
        homeTeam,
        awayTeam,
        scorers: (isEditingLastMatch && customLastMatchData.scorers) || finished.scorers || finished.goals || finished.torschuetzen || "37' 0:1 Yanik Roth | 54' 0:2 Yanik Roth | 67' 1:2 Z. Kane",
        prevMatchText: prevMatch 
          ? `${prevMatch.isHome !== false ? 'FC Auggen' : (prevMatch.opponent || prevMatch.gegner)} ${prevMatch.result || prevMatch.ergebnis || ''} ${prevMatch.isHome !== false ? (prevMatch.opponent || prevMatch.gegner) : 'FC Auggen'} (${formatDateGerman(prevMatch.date)}) — Tore: ${prevMatch.scorers || prevMatch.goals || '-'}`
          : "FC Denzlingen 0:2 FC Auggen (Sa., 29.08.2026) — Tore: J. Akuegwu (83'), G. Scalici (90')",
        notes: (isEditingLastMatch && customLastMatchData.notes) || finished.notes || finished.comment || finished.bericht || `1:2-Auswärtssieg beim ${opponentName} am ${dateFormatted} (${timeStr})! Überzeugende Mannschaftsleistung und ein Doppelpack von Yanik Roth (37' und 54') sichern den verdienten Auswärtserfolg.`
      };
    }

    return {
      opponent: (isEditingLastMatch && customLastMatchData.opponent) || 'FC Rot-Weiß Salem',
      date: 'So., 13.09.2026',
      time: '15:30 Uhr',
      fullDateTime: 'So., 13.09.2026, 15:30 Uhr',
      result: (isEditingLastMatch && customLastMatchData.result) || '1:2',
      status: 'Abpfiff',
      competition: 'Verbandsliga Südbaden',
      isHome: false,
      homeTeam: 'FC Rot-Weiß Salem',
      awayTeam: 'FC Auggen',
      scorers: (isEditingLastMatch && customLastMatchData.scorers) || "37' 0:1 Yanik Roth | 54' 0:2 Yanik Roth | 67' 1:2 Z. Kane",
      prevMatchText: "FC Denzlingen 0:2 FC Auggen (Sa., 29.08.2026) — Tore: J. Akuegwu (83'), G. Scalici (90')",
      notes: (isEditingLastMatch && customLastMatchData.notes) || "1:2-Auswärtssieg beim FC Rot-Weiß Salem am So., 13.09.2026! Mit einer taktisch herausragend eingestellten Mannschaft und einem jungen Altersdurchschnitt von nur ∅ 23.44 Jahren feierte der FC Auggen einen verdienten Sieg. Matchwinner war Yanik Roth mit einem Doppelpack (37' und 54')."
    };
  }, [allMatchesSorted, customLastMatchData, isEditingLastMatch]);

  // Handler to open/toggle editing Module 1 (Nächstes Spiel) with clean pre-population
  const handleToggleEditNextMatch = () => {
    if (!isEditingNextMatch) {
      setCustomNextMatchData({
        opponent: customNextMatchData.opponent ?? nextMatch.opponent,
        competition: customNextMatchData.competition ?? nextMatch.competition,
        badgeText: customNextMatchData.badgeText ?? nextMatch.badgeText,
        date: customNextMatchData.date ?? nextMatch.date,
        time: customNextMatchData.time ?? nextMatch.time,
        location: customNextMatchData.location ?? nextMatch.location,
        meetingPoint: customNextMatchData.meetingPoint ?? nextMatch.meetingPoint,
        nextCompetitiveText: customNextMatchData.nextCompetitiveText ?? (nextMatch.nextCompetitiveText || '')
      });
    }
    setIsEditingNextMatch(!isEditingNextMatch);
  };

  // Handler to open/toggle editing Module 2 (Letztes Spiel) with clean pre-population
  const handleToggleEditLastMatch = () => {
    if (!isEditingLastMatch) {
      setCustomLastMatchData({
        opponent: customLastMatchData.opponent ?? lastTestMatch.opponent,
        result: customLastMatchData.result ?? lastTestMatch.result,
        scorers: customLastMatchData.scorers ?? lastTestMatch.scorers,
        notes: customLastMatchData.notes ?? lastTestMatch.notes
      });
    }
    setIsEditingLastMatch(!isEditingLastMatch);
  };

  // Save Next Match Handler
  const handleSaveNextMatch = () => {
    try {
      localStorage.setItem('dashboard_custom_next_match', JSON.stringify(customNextMatchData));
    } catch (e) {
      console.error(e);
    }
    if (onSaveTestMatch) {
      const target = testMatches.find(m => m.id === 'test_3' || m.opponent?.includes('Lörrach'));
      if (target) {
        onSaveTestMatch({
          ...target,
          opponent: customNextMatchData.opponent || target.opponent,
          competition: customNextMatchData.competition || target.competition,
          date: customNextMatchData.date || target.date,
          kickOff: customNextMatchData.time ? customNextMatchData.time.replace(' Uhr', '') : target.kickOff,
          location: customNextMatchData.location || target.location,
          meetingTime: customNextMatchData.meetingPoint ? customNextMatchData.meetingPoint.replace('📍 ', '').replace(' Uhr Kabine Lettenpark', '') : target.meetingTime
        });
      }
    }
    setIsEditingNextMatch(false);
    setSaveSuccessMsg('Nächstes Spiel erfolgreich gespeichert!');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleResetNextMatch = () => {
    try {
      localStorage.removeItem('dashboard_custom_next_match');
    } catch (e) {
      console.error(e);
    }
    setCustomNextMatchData({});
    setIsEditingNextMatch(false);
    setSaveSuccessMsg('Nächstes Spiel auf Standard zurückgesetzt.');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Save Last Match Handler
  const handleSaveLastMatch = () => {
    try {
      localStorage.setItem('dashboard_custom_last_match', JSON.stringify(customLastMatchData));
    } catch (e) {
      console.error(e);
    }
    if (onSaveTestMatch) {
      const target = testMatches.find(m => m.id === 'test_2' || m.opponent?.includes('Zell'));
      if (target) {
        onSaveTestMatch({
          ...target,
          opponent: customLastMatchData.opponent || target.opponent,
          result: customLastMatchData.result || target.result,
          scorers: customLastMatchData.scorers || target.scorers,
          notes: customLastMatchData.notes || target.notes
        });
      }
    }
    setIsEditingLastMatch(false);
    setSaveSuccessMsg('Kurz-Analyse erfolgreich gespeichert!');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleResetLastMatch = () => {
    try {
      localStorage.removeItem('dashboard_custom_last_match');
    } catch (e) {
      console.error(e);
    }
    setCustomLastMatchData({});
    setIsEditingLastMatch(false);
    setSaveSuccessMsg('Kurz-Analyse auf Standard zurückgesetzt.');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // State for Schedule filter tab on Dashboard
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'competitive' | 'test'>('all');

  const combinedMatches = useMemo(() => {
    const tests = testMatches.map(m => ({ ...m, type: 'Testspiel' as const }));
    const comps = competitiveMatches.map(m => ({ ...m, type: m.competition || 'Pflichtspiel' as const }));
    
    let list = [...tests, ...comps];
    if (scheduleFilter === 'test') list = tests;
    if (scheduleFilter === 'competitive') list = comps;

    return list.sort((a, b) => {
      const isoA = toIsoDate(a.date);
      const isoB = toIsoDate(b.date);
      if (isoA && isoB && isoA !== isoB) return isoA.localeCompare(isoB);
      return (a.kickOff || '').localeCompare(b.kickOff || '');
    });
  }, [testMatches, competitiveMatches, scheduleFilter]);

  // Handle simulated AI File Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsUploading(true);

    setTimeout(() => {
      const newUpload = {
        id: `up_${Date.now()}`,
        name: file.name,
        type: file.name.endsWith('.pdf') ? 'PDF' : 'BILD',
        date: 'Gerade eben',
        status: 'completed' as const,
        summary: `Import erfolgreich: Daten aus ${file.name} analysiert und automatisch im System hinterlegt.`
      };
      setUploads(prev => {
        const next = [newUpload, ...prev];
        try {
          localStorage.setItem('dashboard_ki_uploads', JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
        return next;
      });
      setIsUploading(false);
      setSelectedFileName(null);
    }, 1500);
  };

  return (
    <div className="h-full flex flex-col bg-[#F9FAFB] text-[#F8FAFC] rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
      {/* ----------------- TOP HEADER WITH FC AUGGEN WAPPEN ----------------- */}
      <div className="px-5 py-3 border-b border-[#2D2D2D] bg-[#1E1E1E] text-white relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#1A73E8]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-[#00C2FF]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 relative z-10">
          {/* FC Auggen Title Branding */}
          <div className="text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mb-1">
              <span className="bg-[#1A73E8] text-white font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shadow-xs">
                FC Auggen 1921 e.V.
              </span>
              <span className="bg-[#E8EEF5] text-[#1A73E8] font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C2FF] animate-pulse" />
                Verbandsliga Südbaden
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-extrabold uppercase tracking-wide text-white leading-tight">
              VEREINS-DASHBOARD
            </h1>
            <p className="text-[11px] text-[#00C2FF] font-semibold uppercase tracking-wider mt-0.5 flex items-center justify-center sm:justify-start gap-1.5">
              <ShieldCheck size={14} className="text-[#00C2FF]" />
              Zentrale Steuerungs- & Analyse-Plattform • Saison 2026/27
            </p>
          </div>

          {/* Quick Header KPI Bar (Slim Layout) */}
          <div className="flex flex-wrap items-center justify-center gap-2 bg-[#2A2A2A] border border-[#333333] px-3 py-1.5 rounded-lg shadow-sm">
            <div className="text-center px-2.5 border-r border-slate-700">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Tabellenplatz</span>
              <span className="text-base font-black text-amber-400"># 3</span>
            </div>
            <div className="text-center px-2.5 border-r border-slate-700">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Punkte</span>
              <span className="text-base font-black text-white">7 Pkt</span>
            </div>
            <div className="text-center px-2.5 border-r border-slate-700">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Formkurve</span>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-600/60 inline-block">
                S • S • U • N (4 Sp. • 8:4 Tore)
              </span>
            </div>
            <div className="text-center px-2.5">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Spielerkader</span>
              <span className="text-base font-black text-amber-400">{squadPlayers.length || 26} <span className="text-[10px] font-normal text-slate-400">(36 gesamt)</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- DASHBOARD MODULES GRID ----------------- */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {saveSuccessMsg && (
          <div className="bg-emerald-950/90 border border-emerald-500 text-emerald-300 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 animate-bounce">
            <Check size={16} className="text-emerald-400" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* ----------------- VIEW MODE CONTROLLER & QUICK ACTIONS ----------------- */}
        {viewMode === 'focus' ? (
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 text-xl shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                  ⚡
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider shadow">
                      Fokus-Modus aktiv
                    </span>
                    <span className="text-xs text-amber-300 font-bold">
                      Kompakt & aufgeräumt für den Alltag
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Du siehst aktuell die 6 wichtigsten Alltags-Bereiche (Spiele, Kader, Training). Alle 28 Spezialmodule (3D-Taktik, Scouting, Videoanalyse, Finanzen) sind im Hintergrund gesichert und bleiben unberührt.
                  </p>
                </div>
              </div>

              {/* Instant Revert / Switch to Pro Mode Button */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                <button
                  onClick={() => onToggleViewMode && onToggleViewMode('pro')}
                  className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  title="Gefällt es dir nicht? Hier klickst du sofort zurück zur vollen Profi-Ansicht!"
                >
                  <RotateCcw size={15} />
                  <span>Rückgängig: Alle 28 Module anzeigen</span>
                </button>
              </div>
            </div>

            {/* Quick Action Shortcuts */}
            <div className="mt-3.5 pt-3 border-t border-slate-700/60 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                <span>🚀</span>
                <span>Schnellzugriff:</span>
              </span>
              {onNavigateToTab && (
                <>
                  <button
                    onClick={() => onNavigateToTab('competitive_planning')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold border border-slate-700 hover:border-amber-500/40 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>⚽ Nächstes Spiel ({nextMatch.opponent})</span>
                  </button>
                  <button
                    onClick={() => onNavigateToTab('match_report')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>📝 Spielbericht {lastTestMatch.opponent} ({lastTestMatch.result})</span>
                  </button>
                  <button
                    onClick={() => onNavigateToTab('personnel')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-bold border border-amber-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>👥 Kader & Ausfälle ({squadPlayers.length} Spieler)</span>
                  </button>
                  <button
                    onClick={() => onNavigateToTab('attendance')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[11px] font-bold border border-cyan-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>📋 Anwesenheit Training</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <div>
                <span className="text-xs font-bold text-slate-200">
                  🏆 <strong>Vollständiger Profi-Modus:</strong> Alle 28 Module & Spezialbereiche aktiv.
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Möchtest du eine schlankere Ansicht für den Alltag? Wechsle einfach mit einem Klick in den Fokus-Modus.
                </p>
              </div>
            </div>
            <button
              onClick={() => onToggleViewMode && onToggleViewMode('focus')}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] shadow"
              title="Zum schlanken Alltags-Modus wechseln"
            >
              <span>⚡ Zum Fokus-Modus wechseln</span>
            </button>
          </div>
        )}

        {/* ROW 1: Nächstes Spiel & Letztes Spiel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* MODULE 1: Nächstes Spiel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-sm tracking-wider text-amber-400">1. Nächstes Spiel</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{nextMatch.competition}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleEditNextMatch}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-[10px] uppercase px-2.5 py-1 rounded-md transition-all flex items-center gap-1 shadow"
                    title="Nächstes Spiel bearbeiten"
                  >
                    <Edit size={12} />
                    <span>{isEditingNextMatch ? 'Abbrechen' : 'Bearbeiten'}</span>
                  </button>
                  <span className="bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md shadow flex items-center gap-1 animate-pulse">
                    <Clock size={12} />
                    {nextMatch.badgeText || 'HEUTE • 19:00 UHR'}
                  </span>
                </div>
              </div>

              {/* Editing Form when isEditingNextMatch is true */}
              {isEditingNextMatch ? (
                <div className="bg-slate-950 border border-amber-500/40 p-4 rounded-xl space-y-3 mb-4 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-black text-amber-400 uppercase text-[11px] flex items-center gap-1.5">
                      <Edit size={13} />
                      Nächstes Spiel anpassen
                    </span>
                    <button
                      onClick={() => setIsEditingNextMatch(false)}
                      className="text-slate-400 hover:text-white text-[10px] uppercase font-bold"
                    >
                      Schließen
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gegner</label>
                      <input
                        type="text"
                        value={customNextMatchData.opponent ?? ''}
                        onChange={e => setCustomNextMatchData(prev => ({ ...prev, opponent: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-bold"
                        placeholder="z.B. FC Lörrach-Brombach"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Wettbewerb / Status</label>
                      <input
                        type="text"
                        value={customNextMatchData.competition ?? ''}
                        onChange={e => setCustomNextMatchData(prev => ({ ...prev, competition: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-amber-400 font-bold"
                        placeholder="z.B. Testspiel (Vorbereitung)"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Badge Text</label>
                      <input
                        type="text"
                        value={customNextMatchData.badgeText ?? ''}
                        onChange={e => setCustomNextMatchData(prev => ({ ...prev, badgeText: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-amber-300 font-bold"
                        placeholder="HEUTE • 19:00 UHR"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Datum</label>
                      <input
                        type="text"
                        value={customNextMatchData.date ?? ''}
                        onChange={e => setCustomNextMatchData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                        placeholder="Di., 28.07.2026"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Uhrzeit</label>
                      <input
                        type="text"
                        value={customNextMatchData.time ?? ''}
                        onChange={e => setCustomNextMatchData(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                        placeholder="19:00 Uhr"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Spielort</label>
                      <input
                        type="text"
                        value={customNextMatchData.location ?? ''}
                        onChange={e => setCustomNextMatchData(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                        placeholder="Lettenpark Auggen (Heimspiel)"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Treffpunkt</label>
                      <input
                        type="text"
                        value={customNextMatchData.meetingPoint ?? ''}
                        onChange={e => setCustomNextMatchData(prev => ({ ...prev, meetingPoint: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-amber-300"
                        placeholder="17:30 Uhr Kabine Lettenpark"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Folge-Pflichtspiel Hinweis</label>
                    <input
                      type="text"
                      value={customNextMatchData.nextCompetitiveText ?? ''}
                      onChange={e => setCustomNextMatchData(prev => ({ ...prev, nextCompetitiveText: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-emerald-400 font-bold"
                      placeholder="Danach: SV Oberachern (Sa., 01.08.2026, 14:30 Uhr - SBFV-Pokal)"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleSaveNextMatch}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase py-2 rounded shadow transition-all flex items-center justify-center gap-1"
                    >
                      <Check size={14} />
                      <span>Speichern & Übernehmen</span>
                    </button>
                    <button
                      onClick={handleResetNextMatch}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-[10px] uppercase py-2 px-3 rounded transition-all"
                      title="Auf Standard zurücksetzen"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : (
                /* Match Details Display */
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 mb-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <span className="text-xs font-bold text-slate-400 uppercase">Gegner</span>
                    <span className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block animate-ping" />
                      {nextMatch.opponent}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Datum & Uhrzeit</span>
                      <span className="font-black text-slate-200 flex items-center gap-1.5">
                        <Calendar size={13} className="text-amber-400" />
                        {nextMatch.date} • {nextMatch.time}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Spielort</span>
                      <span className="font-black text-slate-200 flex items-center gap-1.5 truncate">
                        <MapPin size={13} className="text-emerald-400" />
                        {nextMatch.location}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Treffpunkt</span>
                      <span className="font-black text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-800/60">
                        📍 {nextMatch.meetingPoint}
                      </span>
                    </div>
                    {nextMatch.nextCompetitiveText && (
                      <div className="text-[10px] text-slate-400 bg-slate-900 p-2 rounded border border-slate-800/80 flex items-center justify-between">
                        <span className="font-bold text-slate-400">🏆 Pokal-Auftakt:</span>
                        <span className="font-black text-emerald-400">{nextMatch.nextCompetitiveText}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onNavigateToTab && (
                <>
                  <button
                    onClick={() => onNavigateToTab('test_planning')}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-[11px] uppercase tracking-wider py-2.5 px-3 rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-all group-hover:text-amber-400"
                  >
                    <span>Testspielplan</span>
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => onNavigateToTab('competitive_planning')}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-black text-[11px] uppercase tracking-wider py-2.5 px-3 rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>Pflichtspielplan (Oberachern)</span>
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* MODULE 2: Letztes Spiel – Kurz-Analyse */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Trophy size={18} />
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-sm tracking-wider text-emerald-400">2. Letztes Spiel – Kurz-Analyse</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{lastTestMatch.competition} • {lastTestMatch.fullDateTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleEditLastMatch}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-[10px] uppercase px-2.5 py-1 rounded-md transition-all flex items-center gap-1 shadow"
                    title="Analyse bearbeiten"
                  >
                    <Edit size={12} />
                    <span>{isEditingLastMatch ? 'Abbrechen' : 'Bearbeiten'}</span>
                  </button>
                  <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 font-black text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md shadow">
                    SIEG ({lastTestMatch.status || 'ABPFIFF'})
                  </span>
                </div>
              </div>

              {/* Editing Form when isEditingLastMatch is true */}
              {isEditingLastMatch ? (
                <div className="bg-slate-950 border border-amber-500/40 p-4 rounded-xl space-y-3 mb-4 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-black text-amber-400 uppercase text-[11px] flex items-center gap-1.5">
                      <Edit size={13} />
                      Kurz-Analyse direkt anpassen
                    </span>
                    <button
                      onClick={() => setIsEditingLastMatch(false)}
                      className="text-slate-400 hover:text-white text-[10px] uppercase font-bold"
                    >
                      Schließen
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gegner</label>
                      <input
                        type="text"
                        value={customLastMatchData.opponent ?? ''}
                        onChange={e => setCustomLastMatchData(prev => ({ ...prev, opponent: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-bold"
                        placeholder="z.B. FC Zell i.W."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ergebnis</label>
                      <input
                        type="text"
                        value={customLastMatchData.result ?? ''}
                        onChange={e => setCustomLastMatchData(prev => ({ ...prev, result: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-emerald-400 font-black text-center"
                        placeholder="z.B. 7:0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Torschützen</label>
                    <input
                      type="text"
                      value={customLastMatchData.scorers ?? ''}
                      onChange={e => setCustomLastMatchData(prev => ({ ...prev, scorers: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                      placeholder="Torschützen eingeben..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Analyse-Text / Trainer-Fazit</label>
                    <textarea
                      rows={2}
                      value={customLastMatchData.notes ?? ''}
                      onChange={e => setCustomLastMatchData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 italic"
                      placeholder="Analyse eingeben..."
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleSaveLastMatch}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase py-2 rounded shadow transition-all flex items-center justify-center gap-1"
                    >
                      <Check size={14} />
                      <span>Speichern & Übernehmen</span>
                    </button>
                    <button
                      onClick={handleResetLastMatch}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-[10px] uppercase py-2 px-3 rounded transition-all"
                      title="Auf Standard zurücksetzen"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Display */
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 mb-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <span className={`text-xs font-black uppercase ${lastTestMatch.homeTeam === 'FC Auggen' ? 'text-amber-400' : 'text-slate-300'}`}>
                      {lastTestMatch.homeTeam}
                    </span>
                    <div className="bg-emerald-600 text-white font-black text-lg px-3.5 py-1 rounded-lg border border-emerald-400 shadow flex items-center gap-2">
                      <span>{lastTestMatch.result}</span>
                    </div>
                    <span className={`text-xs font-black uppercase ${lastTestMatch.awayTeam === 'FC Auggen' ? 'text-amber-400' : 'text-slate-300'}`}>
                      {lastTestMatch.awayTeam}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-black text-[11px] shrink-0">⚽ Tore ({lastTestMatch.result}):</span>
                      <span className="text-slate-300 font-medium leading-tight">
                        {lastTestMatch.scorers}
                      </span>
                    </div>
                    {lastTestMatch.prevMatchText && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-black text-[11px] shrink-0">👟 Vorheriges Testspiel:</span>
                        <span className="text-slate-400 font-medium">
                          {lastTestMatch.prevMatchText}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Trainer-Kurzkommentar */}
                  <div className="pt-3 border-t border-slate-800/80 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between mb-1 text-amber-400">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={13} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Taktik-Analyse ({lastTestMatch.result})</span>
                      </div>
                      <button
                        onClick={() => setIsEditingLastMatch(true)}
                        className="text-[10px] text-slate-400 hover:text-amber-400 underline font-bold"
                      >
                        Text anpassen
                      </button>
                    </div>
                    <p className="text-xs text-slate-200 italic font-medium leading-relaxed">
                      {lastTestMatch.notes}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onNavigateToTab && (
                <>
                  <button
                    onClick={() => onNavigateToTab('test_planning')}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-[11px] uppercase tracking-wider py-2.5 px-3 rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-all group-hover:text-emerald-400"
                  >
                    <span>Testspiel-Planung</span>
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => onNavigateToTab('match_report')}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-black text-[11px] uppercase tracking-wider py-2.5 px-3 rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>Ausführlicher Spielbericht</span>
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: Training der Woche & Kader-Status & Medizinisches Center */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* MODULE 3: Training der Woche */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between relative group hover:border-slate-700 transition-all">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Activity size={18} />
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-sm tracking-wider text-sky-400">3. Training der Woche</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Wochenplan & Belastung</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 mb-4">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Hauptschwerpunkt</span>
                  <span className="font-black text-white text-xs block bg-sky-950/60 p-2 rounded border border-sky-800/60">
                    Taktisches Anlaufpressing & Umschaltspiel
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Zeiten</span>
                    <span className="font-bold text-slate-300 block">
                      Di & Do 19:00 - 20:30 Uhr
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Anwesenheit</span>
                    <span className="font-black text-emerald-400 block">
                      88% (22/25 Spieler)
                    </span>
                  </div>
                </div>

                {/* Belastungsampel */}
                <div className="pt-2 border-t border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Belastungsampel</span>
                  <div className="flex items-center gap-2 bg-emerald-950/60 p-2 rounded border border-emerald-800/60">
                    <div className="flex gap-1 shrink-0">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      <span className="w-3 h-3 rounded-full bg-amber-950 opacity-40" />
                      <span className="w-3 h-3 rounded-full bg-rose-950 opacity-40" />
                    </div>
                    <span className="text-[11px] font-black text-emerald-300 uppercase">
                      Grün – Optimale Frische & Intensität
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('training_planning')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase tracking-wider py-2 px-3 rounded-lg border border-slate-700 flex items-center justify-center gap-2 transition-all group-hover:text-sky-400"
              >
                <span>Trainingsplan Details</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          {/* MODULE 4: Kader-Status */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between relative group hover:border-slate-700 transition-all">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-sm tracking-wider text-purple-400">4. Kader-Status</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Spielfähigkeit & Einheiten</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 mb-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-800/60">
                    <span className="block text-[9px] font-black uppercase text-emerald-400 mb-0.5">Einsatzbereit</span>
                    <span className="text-xl font-black text-white">{availablePlayersCount}</span>
                  </div>

                  <div className="bg-rose-950/60 p-2.5 rounded-lg border border-rose-800/60">
                    <span className="block text-[9px] font-black uppercase text-rose-400 mb-0.5">Verletzt</span>
                    <span className="text-xl font-black text-rose-300">{injuredPlayers.length || 3}</span>
                  </div>

                  <div className="bg-amber-950/60 p-2.5 rounded-lg border border-amber-800/60">
                    <span className="block text-[9px] font-black uppercase text-amber-400 mb-0.5">Gesperrt</span>
                    <span className="text-xl font-black text-amber-300">{suspendedPlayers.length || 1}</span>
                  </div>
                </div>

                {/* Kader Verteilung Bar */}
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                    <span>Einsatzbereitschaft Quote (Spielerkader)</span>
                    <span className="text-emerald-400 font-black">
                      {Math.round(((availablePlayersCount) / (squadPlayers.length || 25)) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-emerald-500 h-full" 
                      style={{ width: `${((availablePlayersCount) / (squadPlayers.length || 25)) * 100}%` }} 
                    />
                    <div 
                      className="bg-rose-500 h-full" 
                      style={{ width: `${((injuredPlayers.length || 3) / (squadPlayers.length || 25)) * 100}%` }} 
                    />
                    <div 
                      className="bg-amber-500 h-full" 
                      style={{ width: `${((suspendedPlayers.length || 1) / (squadPlayers.length || 25)) * 100}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('personnel')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase tracking-wider py-2 px-3 rounded-lg border border-slate-700 flex items-center justify-center gap-2 transition-all group-hover:text-purple-400"
              >
                <span>Kader & Personal verwalten</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          {/* MODULE 5: Medizinisches Center */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between relative group hover:border-slate-700 transition-all">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <Stethoscope size={18} />
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-sm tracking-wider text-rose-400">5. Medizinisches Center</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verletzte & Reha-Prognose</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                {injuredPlayers.length > 0 ? (
                  injuredPlayers.map(p => (
                    <div key={p.id} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-white">{p.name || `${p.lastName}, ${p.firstName}`}</span>
                        <span className="text-[9px] font-black uppercase text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
                          {p.injuryType || 'Muskelfaser'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Prognose: <strong className="text-amber-300">{p.recoveryForecast || 'ca. 7-10 Tage'}</strong>
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-xs text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-black text-xs uppercase">
                      <CheckCircle2 size={15} />
                      <span>Volle Kader-Verfügbarkeit</span>
                    </div>
                    <p className="text-[10px] text-slate-300 font-medium">
                      Keine verletzten Spieler gemeldet. Alle 26 Spieler sind voll einsatzbereit (100% Fit).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('physio_plan')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase tracking-wider py-2 px-3 rounded-lg border border-slate-700 flex items-center justify-center gap-2 transition-all group-hover:text-rose-400"
              >
                <span>Physio-Akten & Behandlungsprofile</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>



        {/* ROW 5: FC Auggen Spielplan 2026/2027 (Test- & Pflichtspiele) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Calendar size={18} />
              </div>
              <div>
                <h3 className="font-black uppercase text-sm tracking-wider text-amber-400">FC Auggen Spielplan 2026/2027</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Alle Test- und Pflichtspiele im Überblick</p>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
              <button
                onClick={() => setScheduleFilter('all')}
                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${
                  scheduleFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Alle ({testMatches.length + competitiveMatches.length})
              </button>
              <button
                onClick={() => setScheduleFilter('competitive')}
                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${
                  scheduleFilter === 'competitive'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pflichtspiele ({competitiveMatches.length})
              </button>
              <button
                onClick={() => setScheduleFilter('test')}
                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${
                  scheduleFilter === 'test'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Testspiele ({testMatches.length})
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
            {combinedMatches.map((match: any, idx: number) => {
              const isFinished = match.status === 'Abpfiff' || !!match.result || !!match.ergebnis;
              const resultText = match.result || match.ergebnis;
              const homeTeam = match.homeTeam || match.heim || (match.location?.includes('Auswärts') ? match.opponent || match.gegner : 'FC Auggen');
              const awayTeam = match.awayTeam || match.gast || (match.location?.includes('Auswärts') ? 'FC Auggen' : match.opponent || match.gegner);

              return (
                <div 
                  key={`dashboard-match-${match.type || 'spiel'}-${match.id ?? idx}-${idx}`}
                  className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-16 text-center shrink-0">
                      <span className="block text-[10px] font-bold text-amber-400">
                        {match.date ? match.date.slice(0, 10) : 'Termin'}
                      </span>
                      <span className="block text-[9px] font-semibold text-slate-500">
                        {match.time || match.kickOff || '15:30'} Uhr
                      </span>
                    </div>

                    <div className="h-8 w-px bg-slate-800 hidden sm:block" />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                          match.type === 'Testspiel' 
                            ? 'bg-sky-950/80 text-sky-400 border-sky-800' 
                            : 'bg-amber-950/80 text-amber-400 border-amber-800'
                        }`}>
                          {match.competition || match.type}
                        </span>
                        {match.location && (
                          <span className="text-[9px] font-bold text-slate-400">
                            📍 {match.location}
                          </span>
                        )}
                      </div>
                      <h5 className="font-black text-white text-xs tracking-wider mt-1 truncate">
                        <span className={homeTeam === 'FC Auggen' ? 'text-amber-400 font-extrabold' : 'text-slate-200'}>
                          {homeTeam}
                        </span>
                        <span className="text-slate-500 mx-1.5">vs</span>
                        <span className={awayTeam === 'FC Auggen' ? 'text-amber-400 font-extrabold' : 'text-slate-200'}>
                          {awayTeam}
                        </span>
                      </h5>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {isFinished ? (
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-950/90 border border-emerald-800 text-emerald-300 font-black text-xs px-2.5 py-1 rounded-lg shadow">
                          ⚽ {resultText || 'Abpfiff'}
                        </span>
                        <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900">
                          {match.status || 'Beendet'}
                        </span>
                      </div>
                    ) : (
                      <span className="bg-slate-900 text-slate-400 border border-slate-800 font-black text-[10px] uppercase px-2.5 py-1 rounded-lg">
                        Anstehend
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
