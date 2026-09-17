import React, { useState, useMemo } from 'react';
import { Player, Match, MatchMinuteRecord, Opponent } from '../../types';
import { isPlayer } from '../../utils/playerSorting';
import { Calendar, MapPin, Clock, Save, ChevronRight, ChevronLeft, Timer, Users, Trash2, Edit2, Plus, X, ChevronDown, LayoutGrid, List, ExternalLink, Trophy, Target, RotateCcw, Download, Award, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MatchPlanningViewProps {
  players: Player[];
  matches: Match[];
  matchMinutes: MatchMinuteRecord[];
  opponents: Opponent[];
  onSaveMatch: (match: Match) => Promise<void>;
  onDeleteMatch: (id: string | number) => Promise<void>;
  onSaveMinutes: (record: MatchMinuteRecord) => Promise<void>;
  onSaveOpponent: (opponent: Opponent) => Promise<void>;
  onDeleteOpponent: (id: string) => Promise<void>;
  onWipeAllMatches?: () => Promise<void>;
  onRestoreMatches?: () => Promise<void>;
  title?: string;
}

// KW calculation helper
const getKW = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
};

export const MatchPlanningView: React.FC<MatchPlanningViewProps> = ({
  players,
  matches,
  matchMinutes,
  opponents,
  onSaveMatch,
  onDeleteMatch,
  onSaveMinutes,
  onSaveOpponent,
  onDeleteOpponent,
  onWipeAllMatches,
  onRestoreMatches,
  title = "Pflichtspiel-Planung"
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string | number>(matches[0]?.id || '');
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'table'>(title.includes('Test') ? 'table' : 'list');
  const [showOpponentModal, setShowOpponentModal] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  // Helper component for local state inputs to prevent hanging
  const EditableField = ({ 
    value, 
    onSave, 
    type = "text", 
    className = "", 
    isTextArea = false,
    listId = "",
    placeholder = ""
  }: { 
    value: string, 
    onSave: (val: string) => void, 
    type?: string, 
    className?: string,
    isTextArea?: boolean,
    listId?: string,
    placeholder?: string
  }) => {
    const [localValue, setLocalValue] = useState(value);
    
    React.useEffect(() => {
      setLocalValue(value);
    }, [value]);

    if (isTextArea) {
      return (
        <textarea 
          placeholder={placeholder}
          className={className}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => {
            if (localValue !== value) onSave(localValue);
          }}
        />
      );
    }

    return (
      <input 
        type={type}
        list={listId}
        placeholder={placeholder}
        className={className}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          if (localValue !== value) onSave(localValue);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (localValue !== value) onSave(localValue);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    );
  };
  const [editingOpponent, setEditingOpponent] = useState<Opponent | null>(null);
  const [newOpponentName, setNewOpponentName] = useState('');
  const [showDeleteMatchConfirm, setShowDeleteMatchConfirm] = useState(false);
  const [opponentToDelete, setOpponentToDelete] = useState<Opponent | null>(null);
  const [playerToReset, setPlayerToReset] = useState<Player | null>(null);

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'TBD';
    if (dateStr.includes('.')) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('de-DE');
  };

  const parseMatchDate = (dateStr?: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  const selectedMatch = useMemo(() => 
    matches.find(m => m.id === selectedMatchId),
    [matches, selectedMatchId]
  );

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const dateA = parseMatchDate(a.date);
      const dateB = parseMatchDate(b.date);
      if (dateA && dateB && dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      return (Number(a.index) || 0) - (Number(b.index) || 0);
    });
  }, [matches]);

  const matchStats = useMemo(() => {
    let played = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    const scorerMap: Record<string, number> = {};

    matches.forEach(m => {
      if (m.result && m.result.includes(':')) {
        played++;
        const parts = m.result.split(':').map(s => parseInt(s.trim(), 10));
        if (!isNaN(parts[0]) && !isNaN(parts[1])) {
          const teamGoals = m.isHome ? parts[0] : parts[1];
          const oppGoals = m.isHome ? parts[1] : parts[0];
          goalsFor += teamGoals;
          goalsAgainst += oppGoals;

          if (teamGoals > oppGoals) wins++;
          else if (teamGoals === oppGoals) draws++;
          else losses++;
        }
      }

      if (m.scorers) {
        const tokens = m.scorers.split(/[,;\n]/);
        tokens.forEach(tok => {
          const cleaned = tok.trim();
          if (cleaned) {
            const countMatch = cleaned.match(/(.*?)\((\d+)\)/);
            if (countMatch) {
              const name = countMatch[1].trim();
              const cnt = parseInt(countMatch[2], 10) || 1;
              scorerMap[name] = (scorerMap[name] || 0) + cnt;
            } else {
              scorerMap[cleaned] = (scorerMap[cleaned] || 0) + 1;
            }
          }
        });
      }
    });

    const topScorers = Object.entries(scorerMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      total: matches.length,
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      diff: goalsFor - goalsAgainst,
      topScorers
    };
  }, [matches]);

  const handleExportICS = (matchToExport?: Match) => {
    const listToExport = matchToExport ? [matchToExport] : sortedMatches;
    if (listToExport.length === 0) return;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FC Auggen Match Plan//NONSGML v1.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${title}`
    ];

    listToExport.forEach(m => {
      const matchDateStr = parseMatchDate(m.date);
      const matchDate = matchDateStr ? new Date(matchDateStr + 'T' + (m.kickOff || '15:00')) : new Date();
      const endDate = new Date(matchDate.getTime() + 2 * 60 * 60 * 1000);
      const formatDateToICS = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      lines.push(
        'BEGIN:VEVENT',
        `UID:match-${m.id}-${Date.now()}@fc-auggen`,
        `DTSTAMP:${formatDateToICS(new Date())}`,
        `DTSTART:${formatDateToICS(matchDate)}`,
        `DTEND:${formatDateToICS(endDate)}`,
        `SUMMARY:[${m.isHome ? 'Heim' : 'Auswärts'}] FC Auggen vs. ${m.opponent}`,
        `LOCATION:${m.location || 'Auggen'}`,
        `DESCRIPTION:Anstoß: ${m.kickOff || 'TBD'} Uhr\\nTreffpunkt: ${m.meetingTime || 'TBD'} Uhr\\nErgebnis: ${m.result || 'Noch nicht gespielt'}\\nTorschützen: ${m.scorers || '-'}\\nNotizen: ${m.notes || '-'}`,
        'END:VEVENT'
      );
    });

    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = matchToExport ? `spiel_${matchToExport.opponent.toLowerCase().replace(/[^a-z0-9]/g, '_')}.ics` : `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleMatchChange = (field: keyof Match, value: any) => {
    if (!selectedMatch) return;
    onSaveMatch({ ...selectedMatch, [field]: value });
  };

  const handleAddMatch = async () => {
    const newIndex = matches.length > 0 ? Math.max(...matches.map(m => Number(m.index) || 0)) + 1 : 1;
    const newMatch: Match = {
      id: `match_${Date.now()}`,
      index: newIndex,
      opponent: 'NEUER GEGNER',
      location: 'Auggen',
      isHome: true,
      kickOff: '15:30',
      endTime: '17:15',
      meetingTime: '14:15',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    };
    await onSaveMatch(newMatch);
    setSelectedMatchId(newMatch.id);
  };

  const handleDeleteMatch = async () => {
    if (!selectedMatchId) return;
    
    const currentIdx = sortedMatches.findIndex(m => m.id === selectedMatchId);
    await onDeleteMatch(selectedMatchId);
    
    // Select another match
    if (sortedMatches.length > 1) {
      const nextIdx = currentIdx > 0 ? currentIdx - 1 : 1;
      setSelectedMatchId(sortedMatches[nextIdx].id);
    } else {
      setSelectedMatchId('');
    }
    setShowDeleteMatchConfirm(false);
  };

  const handleSaveOpponent = async () => {
    if (!newOpponentName.trim()) return;
    const opponent: Opponent = {
      id: editingOpponent?.id || `opp_${Date.now()}`,
      name: newOpponentName.trim()
    };
    await onSaveOpponent(opponent);
    setEditingOpponent(null);
    setNewOpponentName('');
  };

  const handleMinuteChange = (playerId: string, field: 'start' | 'end' | 'notes', value: string) => {
    if (!selectedMatchId) return;
    
    const record = matchMinutes.find(r => r.playerId === playerId) || {
      playerId,
      minutes: {},
      details: {}
    };

    const currentDetails = record.details || {};
    const currentMinutes = record.minutes || {};
    
    const matchDetails = currentDetails[selectedMatchId] || { start: '', end: '', notes: '' };
    const updatedDetails = { ...matchDetails, [field]: value };
    
    // Calculate minutes
    let minutes = 0;
    const start = field === 'start' ? value : updatedDetails.start;
    const end = field === 'end' ? value : updatedDetails.end;
    
    if (start && end) {
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      if (endTotal > startTotal) {
        minutes = endTotal - startTotal;
      }
    }

    onSaveMinutes({
      ...record,
      details: { ...currentDetails, [selectedMatchId]: updatedDetails },
      minutes: { ...currentMinutes, [selectedMatchId]: minutes }
    });
  };

  const calculateTotalMinutes = (playerId: string) => {
    const record = matchMinutes.find(r => r.playerId === playerId);
    if (!record || !record.minutes) return 0;
    return Object.values(record.minutes).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  };

  const handleResetPlayerMinutes = async (playerId: string) => {
    const record = matchMinutes.find(r => r.playerId === playerId);
    if (!record) return;

    await onSaveMinutes({
      ...record,
      minutes: {},
      details: {}
    });
    setPlayerToReset(null);
  };

  return (
    <div className="space-y-6 p-2 sm:p-4 bg-[#0F0F0F] text-[#F5F5F5] min-h-screen rounded-xl border border-[#2A2A2A] shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1A1A1A] p-5 rounded-xl border border-[#2A2A2A] shadow-md">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-[#F5F5F5] flex items-center gap-2">
            <Trophy className="text-[#FFD54F]" size={26} />
            {title}
          </h2>
          
          <div className="flex items-center gap-1.5 bg-[#202020] p-1 rounded-lg border border-[#2A2A2A]">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === 'list' 
                  ? 'bg-[#FFD54F] text-[#0F0F0F] font-black shadow-[0_0_10px_rgba(255,213,79,0.4)] border border-[#FFD54F]' 
                  : 'text-[#C7C7C7] hover:text-[#F5F5F5] hover:bg-[#2A2A2A]'
              }`}
            >
              <LayoutGrid size={14} />
              Übersicht
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === 'table' 
                  ? 'bg-[#FFD54F] text-[#0F0F0F] font-black shadow-[0_0_10px_rgba(255,213,79,0.4)] border border-[#FFD54F]' 
                  : 'text-[#C7C7C7] hover:text-[#F5F5F5] hover:bg-[#2A2A2A]'
              }`}
            >
              <List size={14} />
              Tabellen-Plan
            </button>
            <button
              onClick={() => setViewMode('detail')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === 'detail' 
                  ? 'bg-[#FFD54F] text-[#0F0F0F] font-black shadow-[0_0_10px_rgba(255,213,79,0.4)] border border-[#FFD54F]' 
                  : 'text-[#C7C7C7] hover:text-[#F5F5F5] hover:bg-[#2A2A2A]'
              }`}
            >
              <Target size={14} />
              Spiel-Details
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {onRestoreMatches && (
            <button 
              onClick={onRestoreMatches}
              className="bg-[#202020] text-[#F5F5F5] hover:bg-[#2A2A2A] border border-[#2A2A2A] px-3 py-2 font-black uppercase text-xs transition-colors flex items-center gap-2 rounded-lg shadow-xs"
              title="Alle 32 Pflichtspiele der Saison 2026/2027 wiederherstellen"
            >
              <RotateCcw size={14} className="text-[#FFD54F]" /> Pflichtspiele wiederherstellen
            </button>
          )}
          {onWipeAllMatches && (
            confirmWipe ? (
              <div className="flex gap-1 items-center bg-rose-950/40 p-1 border border-rose-800 rounded-lg">
                <span className="text-[10px] font-black uppercase text-rose-300 px-1">Sicher?</span>
                <button 
                  onClick={async () => {
                    await onWipeAllMatches();
                    setConfirmWipe(false);
                  }}
                  className="bg-rose-600 text-white px-2 py-1 font-black uppercase text-[10px] hover:bg-rose-700 transition-colors flex items-center gap-1 rounded"
                >
                  <Trash2 size={12} /> Ja, alle löschen
                </button>
                <button 
                  onClick={() => setConfirmWipe(false)}
                  className="bg-[#202020] text-[#F5F5F5] px-2 py-1 font-black uppercase text-[10px] hover:bg-[#2A2A2A] transition-colors border border-[#2A2A2A] rounded"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setConfirmWipe(true)}
                className="bg-rose-950/30 text-rose-400 border border-rose-800/60 px-4 py-2 font-black uppercase text-xs hover:bg-rose-900/40 transition-colors flex items-center gap-2 rounded-lg"
                title="Alle Pflichtspiele, Tabellenplanung und Spielerstatistiken komplett zurücksetzen"
              >
                <Trash2 size={14} /> Alle löschen
              </button>
            )
          )}
          <button 
            onClick={() => handleExportICS()}
            className="bg-[#202020] text-[#F5F5F5] hover:bg-[#2A2A2A] border border-[#2A2A2A] px-4 py-2 font-black uppercase text-xs rounded-lg transition-colors flex items-center gap-2 shadow-xs"
            title="Spieltermine als ICS-Kalenderdatei exportieren"
          >
            <Download size={14} className="text-[#FFD54F]" /> Kalender (.ics)
          </button>
          <button 
            onClick={handleAddMatch}
            className="bg-[#FFD54F] hover:bg-[#FFE082] text-[#0F0F0F] px-4 py-2 font-black uppercase text-xs rounded-lg transition-colors flex items-center gap-2 shadow-md border border-[#FFD54F]"
          >
            <Plus size={14} /> Neues Spiel
          </button>
          <button 
            onClick={() => setShowOpponentModal(true)}
            className="bg-[#202020] text-[#F5F5F5] hover:bg-[#2A2A2A] border border-[#2A2A2A] px-4 py-2 font-black uppercase text-xs rounded-lg transition-colors flex items-center gap-2"
          >
            <Users size={14} /> Gegner verwalten
          </button>
        </div>
      </div>

      {/* Aggregated Statistics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] p-4 rounded-xl shadow-md flex items-center justify-between text-[#F5F5F5]">
          <div>
            <div className="text-[10px] font-black uppercase text-[#C7C7C7] tracking-wider">Spiele & Bilanz</div>
            <div className="text-2xl font-black text-[#F5F5F5]">{matchStats.played} / {matchStats.total}</div>
            <div className="text-[10px] font-bold text-[#00D47A] uppercase">
              {matchStats.wins}S - {matchStats.draws}U - {matchStats.losses}N
            </div>
          </div>
          <Trophy className="text-[#FFD54F] h-8 w-8 opacity-90" />
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] p-4 rounded-xl shadow-md flex items-center justify-between text-[#F5F5F5]">
          <div>
            <div className="text-[10px] font-black uppercase text-[#C7C7C7] tracking-wider">Torverhältnis</div>
            <div className="text-2xl font-black text-[#F5F5F5]">{matchStats.goalsFor} : {matchStats.goalsAgainst}</div>
            <div className="text-[10px] font-bold text-[#FFD54F] uppercase">
              Diff: {matchStats.diff > 0 ? `+${matchStats.diff}` : matchStats.diff}
            </div>
          </div>
          <Target className="text-[#FFD54F] h-8 w-8 opacity-90" />
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] p-4 rounded-xl shadow-md flex items-center justify-between col-span-2 sm:col-span-2 text-[#F5F5F5]">
          <div className="w-full">
            <div className="text-[10px] font-black uppercase text-[#C7C7C7] tracking-wider mb-1 flex items-center gap-1">
              <Award size={12} className="text-[#FFD54F]" /> Top-Torschützen ({title.includes('Test') ? 'Testspiele' : 'Pflichtspiele'})
            </div>
            {matchStats.topScorers.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {matchStats.topScorers.map(([name, goals]) => (
                  <span key={name} className="bg-[#202020] border border-[#2A2A2A] text-[#F5F5F5] px-2.5 py-1 rounded-md font-black text-[10px] uppercase flex items-center gap-1">
                    {name}: <span className="text-[#FFD54F] font-extrabold">{goals} Tore</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-[#C7C7C7]/60 italic">Noch keine Torschützen erfasst</span>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-12"
          >
            {/* Next Match Highlight (if any upcoming) */}
            {(() => {
              const now = new Date().toISOString().split('T')[0];
              const upcoming = sortedMatches.filter(m => {
                if (!m.date) return false;
                const dateISO = m.date.includes('.') ? m.date.split('.').reverse().join('-') : m.date;
                return dateISO >= now;
              }).sort((a,b) => {
                const dateA = (a.date || '').includes('.') ? a.date.split('.').reverse().join('-') : (a.date || '');
                const dateB = (b.date || '').includes('.') ? b.date.split('.').reverse().join('-') : (b.date || '');
                return dateA.localeCompare(dateB);
              });
              const nextMatch = upcoming[0];
              
              if (!nextMatch) return null;
              
              return (
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] p-6 rounded-xl shadow-lg text-[#F5F5F5] relative overflow-hidden group">
                  <div className="absolute right-[-20px] top-[-20px] opacity-5 rotate-12 group-hover:rotate-0 transition-transform duration-700 text-[#FFD54F]">
                    <Trophy size={200} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2.5 h-2.5 bg-[#FFD54F] rounded-full animate-pulse shadow-[0_0_8px_rgba(255,213,79,0.8)]" />
                      <span className="text-xs font-black uppercase tracking-[0.3em] text-[#FFD54F]">Nächstes Spiel</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                      <div>
                        <h3 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter italic leading-none mb-3 text-[#F5F5F5]">
                          {nextMatch.opponent}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-xs font-black uppercase">
                          <span className="flex items-center gap-2 bg-[#202020] border border-[#2A2A2A] px-3 py-1.5 rounded-md text-[#F5F5F5]">
                            <Calendar size={14} className="text-[#FFD54F]" /> {formatDate(nextMatch.date)}
                          </span>
                          <span className="flex items-center gap-2 bg-[#202020] border border-[#2A2A2A] px-3 py-1.5 rounded-md text-[#F5F5F5]">
                            <Clock size={14} className="text-[#FFD54F]" /> {nextMatch.kickOff} Uhr
                          </span>
                          <span className="flex items-center gap-2 bg-[#202020] border border-[#2A2A2A] px-3 py-1.5 rounded-md text-[#F5F5F5]">
                            <MapPin size={14} className="text-[#FFD54F]" /> {nextMatch.location}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedMatchId(nextMatch.id);
                          setViewMode('detail');
                        }}
                        className="bg-[#FFD54F] hover:bg-[#FFE082] text-[#0F0F0F] px-8 py-3 font-black uppercase text-sm rounded-lg transition-all shadow-md border border-[#FFD54F]"
                      >
                        Details & Zeiten
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* All Matches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedMatches.map((match) => (
                <motion.div
                  key={match.id}
                  whileHover={{ scale: 1.01 }}
                  className="bg-[#202020] border border-[#2A2A2A] rounded-xl shadow-md hover:border-[#FFD54F] transition-all cursor-pointer flex flex-col group overflow-hidden"
                  onClick={() => {
                    setSelectedMatchId(match.id);
                    setViewMode('detail');
                  }}
                >
                  <div className="p-4 bg-[#1A1A1A] text-[#F5F5F5] flex justify-between items-start border-b border-[#2A2A2A]">
                    <div>
                      <div className="text-[8px] font-black uppercase tracking-[0.2em] text-[#FFD54F] mb-1">
                        {title.includes('Test') ? 'TESTSPIEL' : 'PFLICHTSPIEL'}
                      </div>
                      <div className="text-lg font-black uppercase truncate max-w-[180px] text-[#F5F5F5]">
                        {match.opponent}
                      </div>
                    </div>
                    <div className="bg-[#202020] text-[#FFD54F] border border-[#FFD54F]/30 px-2.5 py-1 rounded font-black text-xs uppercase">
                       {match.isHome ? 'HEIM' : 'AW'}
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-[#FFD54F]" />
                      <span className="text-[10px] font-black uppercase whitespace-nowrap text-[#F5F5F5]">
                        {formatDate(match.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-[#FFD54F]" />
                      <span className="text-[10px] font-black uppercase text-[#F5F5F5]">{match.kickOff || '--:--'} Uhr</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                       <MapPin size={14} className="text-[#FFD54F]" />
                      <span className="text-[10px] font-black uppercase truncate text-[#C7C7C7]">{match.location}</span>
                    </div>

                    {match.result && (
                      <div className="col-span-2 bg-[#1A1A1A] p-2.5 rounded-md border border-[#2A2A2A] flex justify-between items-center text-[11px] font-black">
                        <span className="text-[#C7C7C7] text-[9px] uppercase">Ergebnis:</span>
                        <span className="bg-[#FFD54F] text-[#0F0F0F] px-2.5 py-0.5 rounded text-xs font-black">{match.result}</span>
                      </div>
                    )}

                    {match.scorers && (
                      <div className="col-span-2 text-[10px] bg-[#1A1A1A] p-2.5 rounded-md border border-[#2A2A2A] text-[#F5F5F5]">
                        <span className="font-black text-[#FFD54F] uppercase block mb-0.5">⚽ Torschützen:</span>
                        <span className="font-bold text-[#F5F5F5]">{match.scorers}</span>
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3 flex justify-between items-center text-[9px] font-black uppercase border-t border-[#2A2A2A] bg-[#1A1A1A]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportICS(match);
                      }}
                      className="text-[#FFD54F] hover:underline flex items-center gap-1"
                      title="Termin im Kalender speichern"
                    >
                      <Download size={12} /> ICS Kalender
                    </button>
                    <div className="group-hover:text-[#FFD54F] transition-colors flex items-center gap-1 text-[#C7C7C7]">
                      Details <ExternalLink size={12} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : viewMode === 'table' ? (
          <motion.div
            key="table"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-md overflow-hidden text-[#F5F5F5]"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left shrink-0">
                <thead>
                  <tr className="bg-[#202020] text-[#F5F5F5] text-[10px] font-black uppercase tracking-widest border-b border-[#2A2A2A]">
                    <th className="p-3 border-r border-[#2A2A2A] w-12 text-center">ID</th>
                    <th className="p-3 border-r border-[#2A2A2A] w-12 text-center">KW</th>
                    <th className="p-3 border-r border-[#2A2A2A] w-32">Datum</th>
                    <th className="p-3 border-r border-[#2A2A2A] w-20">Anstoß</th>
                    <th className="p-3 border-r border-[#2A2A2A] w-20 text-center">H/A</th>
                    <th className="p-3 border-r border-[#2A2A2A] min-w-[180px]">Gegner</th>
                    <th className="p-3 border-r border-[#2A2A2A] min-w-[130px]">Ort</th>
                    <th className="p-3 border-r border-[#2A2A2A] w-24 text-center">Ergebnis</th>
                    <th className="p-3 border-r border-[#2A2A2A] min-w-[160px]">Torschützen</th>
                    <th className="p-3 border-r border-[#2A2A2A] w-20 text-center">Treff</th>
                    <th className="p-3 border-r border-[#2A2A2A] w-20 text-center">Ende</th>
                    <th className="p-3 border-r border-[#2A2A2A] min-w-[180px]">Notizen</th>
                    <th className="p-3 border-r border-[#2A2A2A] w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {sortedMatches.map((match) => (
                    <tr key={match.id} className="hover:bg-[#202020] transition-colors border-b border-[#2A2A2A] text-[#F5F5F5]">
                      <td className="p-3 border-r border-[#2A2A2A] font-black text-center text-[#FFD54F]">{match.index}</td>
                      <td className="p-3 border-r border-[#2A2A2A] font-black text-center text-[10px] text-[#C7C7C7]">{getKW(match.date || '')}</td>
                      <td className="p-3 border-r border-[#2A2A2A]">
                        <EditableField 
                          type="date"
                          className="w-full bg-transparent focus:outline-none font-bold text-[#F5F5F5]"
                          value={match.date || ''}
                          onSave={(val) => onSaveMatch({ ...match, date: val })}
                        />
                      </td>
                      <td className="p-3 border-r border-[#2A2A2A]">
                        <EditableField 
                          type="time"
                          className="w-full bg-transparent focus:outline-none font-black text-[#FFD54F]"
                          value={match.kickOff || ''}
                          onSave={(val) => onSaveMatch({ ...match, kickOff: val })}
                        />
                      </td>
                      <td className="p-3 border-r border-[#2A2A2A] text-center">
                        <select 
                          className="bg-[#202020] text-[#FFD54F] border border-[#2A2A2A] rounded px-1.5 py-0.5 font-black uppercase text-[10px] focus:outline-none cursor-pointer"
                          value={match.isHome ? 'H' : 'A'}
                          onChange={(e) => onSaveMatch({ ...match, isHome: e.target.value === 'H' })}
                        >
                          <option value="H">Heim</option>
                          <option value="A">AW</option>
                        </select>
                      </td>
                      <td className="p-3 border-r border-[#2A2A2A]">
                        <EditableField 
                          listId="opponents-list-table"
                          className="w-full bg-transparent focus:outline-none font-black uppercase text-[12px] text-[#F5F5F5]"
                          value={match.opponent || ''}
                          onSave={(val) => onSaveMatch({ ...match, opponent: val })}
                        />
                        <datalist id="opponents-list-table">
                          {opponents.map(opp => <option key={opp.id} value={opp.name} />)}
                        </datalist>
                      </td>
                      <td className="p-3 border-r border-[#2A2A2A]">
                        <EditableField 
                          className="w-full bg-transparent focus:outline-none font-bold text-[10px] uppercase text-[#C7C7C7]"
                          value={match.location || ''}
                          onSave={(val) => onSaveMatch({ ...match, location: val })}
                        />
                      </td>
                      <td className="p-3 border-r border-[#2A2A2A] text-center">
                        <EditableField 
                          placeholder="z.B. 3:1"
                          className="w-full bg-transparent focus:outline-none font-black text-xs text-rose-400 text-center uppercase"
                          value={match.result || ''}
                          onSave={(val) => onSaveMatch({ ...match, result: val })}
                        />
                      </td>
                      <td className="p-3 border-r border-[#2A2A2A]">
                        <EditableField 
                          placeholder="Torschützen..."
                          className="w-full bg-transparent focus:outline-none font-bold text-[10px] text-[#F5F5F5]"
                          value={match.scorers || ''}
                          onSave={(val) => onSaveMatch({ ...match, scorers: val })}
                        />
                      </td>
                      <td className="p-3 border-r border-[#2A2A2A] text-center">
                         <EditableField 
                          type="time"
                          className="w-full bg-transparent focus:outline-none font-black text-[#C7C7C7]"
                          value={match.meetingTime || ''}
                          onSave={(val) => onSaveMatch({ ...match, meetingTime: val })}
                        />
                      </td>
                      <td className="p-3 border-r border-[#2A2A2A] text-center">
                        <EditableField 
                          type="time"
                          className="w-full bg-transparent focus:outline-none font-black text-[#C7C7C7]"
                          value={match.endTime || ''}
                          onSave={(val) => onSaveMatch({ ...match, endTime: val })}
                        />
                      </td>
                      <td className="p-3 border-r border-[#2A2A2A]">
                        <EditableField 
                          className="w-full bg-transparent focus:outline-none italic text-[#C7C7C7] text-[10px]"
                          value={match.notes || ''}
                          onSave={(val) => onSaveMatch({ ...match, notes: val })}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => {
                            setSelectedMatchId(match.id);
                            setShowDeleteMatchConfirm(true);
                          }}
                          className="text-rose-400 hover:text-rose-300 p-1 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedMatches.length === 0 && (
                    <tr>
                      <td colSpan={13} className="p-12 text-center italic text-[#C7C7C7]/60">Keine Spiele angelegt</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-[#202020] text-center border-t border-[#2A2A2A]">
              <button 
                onClick={handleAddMatch}
                className="bg-[#FFD54F] hover:bg-[#FFE082] text-[#0F0F0F] px-8 py-3 font-black uppercase text-xs rounded-lg transition-all shadow-md border border-[#FFD54F]"
              >
                + Weiteres Spiel hinzufügen
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {selectedMatch ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] shadow-md rounded-xl p-6 text-[#F5F5F5]">
              <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2 text-[#F5F5F5] border-b border-[#2A2A2A] pb-3">
                <Calendar className="h-6 w-6 text-[#FFD54F]" /> Spiel-Details
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-black uppercase text-[#4A4A4A] tracking-wider">GEGNER</label>
                    <div className="flex gap-3 items-center">
                      <button 
                        onClick={() => handleExportICS(selectedMatch)}
                        className="text-[10px] font-black uppercase text-[#1A73E8] hover:underline flex items-center gap-1"
                        title="Diesen Spieltermin als ICS-Kalenderdatei herunterladen"
                      >
                        <Download size={12} /> ICS Export
                      </button>
                      <button 
                        onClick={() => setShowDeleteMatchConfirm(true)}
                        className="text-[10px] font-black uppercase text-rose-400 hover:underline"
                      >
                        Spiel löschen
                      </button>
                    </div>
                  </div>
                  <div className="relative group">
                    <EditableField 
                      listId="opponents-list-planning"
                      className="w-full border border-[#2A2A2A] p-2.5 font-black bg-[#202020] text-[#F5F5F5] focus:border-[#FFD54F] focus:outline-none uppercase rounded-lg text-sm" 
                      value={selectedMatch.opponent} 
                      onSave={(val) => handleMatchChange('opponent', val)}
                    />
                    <datalist id="opponents-list-planning">
                      {opponents.map((opp) => (
                        <option key={opp.id} value={opp.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black uppercase flex items-center gap-1 text-rose-400 tracking-wider">
                      <Trophy className="h-3 w-3 text-rose-400" /> ERGEBNIS / ENDSTAND
                    </label>
                    <EditableField 
                      placeholder="z.B. 3:1"
                      className="w-full border border-[#2A2A2A] p-2.5 font-black text-sm bg-[#202020] text-rose-400 placeholder-[#C7C7C7]/50 focus:border-[#FFD54F] rounded-lg text-center"
                      value={selectedMatch.result || ''} 
                      onSave={(val) => handleMatchChange('result', val)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-[#C7C7C7] tracking-wider">HEIM / AUSWÄRTS</label>
                    <select 
                      className="w-full border border-[#2A2A2A] p-2.5 font-bold bg-[#202020] text-[#F5F5F5] focus:border-[#FFD54F] rounded-lg text-sm cursor-pointer"
                      value={selectedMatch.isHome ? 'Heim' : 'Auswärts'}
                      onChange={(e) => handleMatchChange('isHome', e.target.value === 'Heim')}
                    >
                      <option value="Heim">Heim</option>
                      <option value="Auswärts">Auswärts</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-[#C7C7C7] tracking-wider flex items-center gap-1">
                    ⚽ TORSCHÜTZEN (NAME, MIN / ANZAHL)
                  </label>
                  <EditableField 
                    placeholder="z.B. J. Ehret (2), D. Valchuk (45')"
                    className="w-full border border-[#2A2A2A] p-2.5 font-bold bg-[#202020] text-[#FFD54F] placeholder-[#C7C7C7]/50 focus:border-[#FFD54F] rounded-lg text-xs"
                    value={selectedMatch.scorers || ''} 
                    onSave={(val) => handleMatchChange('scorers', val)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black uppercase text-[#C7C7C7] tracking-wider">DATUM</label>
                    <EditableField 
                      type="date" 
                      className="w-full border border-[#2A2A2A] p-2.5 font-bold bg-[#202020] text-[#F5F5F5] focus:border-[#FFD54F] rounded-lg text-sm"
                      value={selectedMatch.date || ''} 
                      onSave={(val) => handleMatchChange('date', val)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-[#C7C7C7] tracking-wider flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-[#FFD54F]" /> ORT
                    </label>
                    <EditableField 
                      className="w-full border border-[#2A2A2A] p-2.5 font-bold bg-[#202020] text-[#F5F5F5] focus:border-[#FFD54F] rounded-lg text-sm"
                      value={selectedMatch.location || ''} 
                      onSave={(val) => handleMatchChange('location', val)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black uppercase text-[#C7C7C7] tracking-wider flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[#FFD54F]" /> BEGINN
                    </label>
                    <EditableField 
                      type="time" 
                      className="w-full border border-[#2A2A2A] p-2.5 font-bold bg-[#202020] text-[#F5F5F5] focus:border-[#FFD54F] rounded-lg text-sm"
                      value={selectedMatch.kickOff || ''} 
                      onSave={(val) => handleMatchChange('kickOff', val)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-[#C7C7C7] tracking-wider flex items-center gap-1">
                      <Timer className="h-3 w-3 text-[#FFD54F]" /> ENDE
                    </label>
                    <EditableField 
                      type="time" 
                      className="w-full border border-[#2A2A2A] p-2.5 font-bold bg-[#202020] text-[#F5F5F5] focus:border-[#FFD54F] rounded-lg text-sm"
                      value={selectedMatch.endTime || ''} 
                      onSave={(val) => handleMatchChange('endTime', val)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-[#C7C7C7] tracking-wider">NOTIZEN</label>
                  <EditableField 
                    isTextArea
                    className="w-full border border-[#2A2A2A] p-2.5 font-bold bg-[#202020] text-[#F5F5F5] placeholder-[#C7C7C7]/50 focus:border-[#FFD54F] rounded-lg min-h-[100px] text-xs"
                    value={selectedMatch.notes || ''}
                    onSave={(val) => handleMatchChange('notes', val)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2">
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-md overflow-hidden">
              <div className="p-5 border-b border-[#2A2A2A] flex items-center justify-between bg-[#202020]">
                <h3 className="text-xl font-black uppercase text-[#F5F5F5] flex items-center gap-2">
                  <Users className="text-[#FFD54F] h-5 w-5" /> SPIELER-EINSATZZEITEN
                </h3>
                <div className="text-xs font-bold uppercase text-[#C7C7C7]">
                  Wird automatisch berechnet
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#202020] text-[#F5F5F5] uppercase text-xs font-black tracking-widest border-b border-[#2A2A2A]">
                      <th className="p-4">SPIELER</th>
                      <th className="p-4">GESAMT</th>
                      <th className="p-4">START</th>
                      <th className="p-4">ENDE</th>
                      <th className="p-4 text-center">MIN</th>
                      <th className="p-4">NOTIZEN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2A2A]">
                    {players.filter(isPlayer).map(player => {
                      const record = matchMinutes.find(r => r.playerId === player.id);
                      const details = record?.details?.[selectedMatchId] || { start: '', end: '', notes: '' };
                      const minutes = record?.minutes?.[selectedMatchId] || 0;
                      const totalMinutes = calculateTotalMinutes(player.id);

                      return (
                        <tr key={player.id} className="hover:bg-[#202020] transition-colors text-[#F5F5F5]">
                          <td className="p-4 font-black uppercase text-sm text-[#F5F5F5]">
                            {player.lastName}
                          </td>
                          <td className="p-4 text-xs font-bold text-[#FFD54F]">
                            <div className="flex items-center gap-2">
                              {totalMinutes} MIN
                              {totalMinutes > 0 && (
                                <button 
                                  onClick={() => setPlayerToReset(player)}
                                  className="text-rose-400 hover:text-rose-300 transition-colors"
                                  title="Alle Zeiten für diesen Spieler zurücksetzen"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <EditableField 
                              type="time" 
                              className="border border-[#2A2A2A] bg-[#202020] text-[#F5F5F5] p-1.5 font-bold text-xs w-28 rounded-md text-center focus:border-[#FFD54F]" 
                              value={details.start}
                              onSave={(val) => handleMinuteChange(player.id, 'start', val)}
                            />
                          </td>
                          <td className="p-4">
                            <EditableField 
                              type="time" 
                              className="border border-[#2A2A2A] bg-[#202020] text-[#F5F5F5] p-1.5 font-bold text-xs w-28 rounded-md text-center focus:border-[#FFD54F]" 
                              value={details.end}
                              onSave={(val) => handleMinuteChange(player.id, 'end', val)}
                            />
                          </td>
                          <td className="p-4 text-center font-black text-lg text-[#00D47A]">
                            {minutes}
                          </td>
                          <td className="p-4">
                            <EditableField 
                              className="w-full border border-[#2A2A2A] bg-[#202020] text-[#F5F5F5] p-1.5 font-bold text-xs rounded-md focus:border-[#FFD54F]" 
                              value={details.notes}
                              onSave={(val) => handleMinuteChange(player.id, 'notes', val)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
          ) : (
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] p-12 text-center rounded-xl shadow-md">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-[#C7C7C7]/40" />
              <h3 className="text-xl font-black uppercase text-[#C7C7C7]">Kein Spiel ausgewählt</h3>
              <p className="text-xs font-bold text-[#C7C7C7]/60 mt-2">Bitte wähle ein Spiel aus der Übersicht oder erstelle ein neues.</p>
            </div>
          )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Opponent Management Modal */}
      <AnimatePresence>
        {showOpponentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1A1A] border border-[#2A2A2A] shadow-2xl rounded-xl w-full max-w-2xl overflow-hidden text-[#F5F5F5]"
            >
              <div className="bg-[#202020] text-[#F5F5F5] p-4 flex justify-between items-center border-b border-[#2A2A2A]">
                <h3 className="font-black uppercase tracking-widest flex items-center gap-2 text-[#F5F5F5] text-sm">
                  <Users size={18} className="text-[#FFD54F]" /> Gegner-Verwaltung
                </h3>
                <button onClick={() => setShowOpponentModal(false)} className="text-[#C7C7C7] hover:text-[#F5F5F5] transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    className="flex-1 bg-[#202020] border border-[#2A2A2A] rounded-lg p-2.5 font-bold uppercase text-[#F5F5F5] text-xs focus:border-[#FFD54F] focus:outline-none"
                    placeholder="Gegner Name..."
                    value={newOpponentName}
                    onChange={(e) => setNewOpponentName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveOpponent()}
                  />
                  <button 
                    onClick={handleSaveOpponent}
                    className="bg-[#FFD54F] hover:bg-[#FFE082] text-[#0F0F0F] px-6 py-2.5 font-black uppercase text-xs rounded-lg transition-colors shadow-md border border-[#FFD54F]"
                  >
                    {editingOpponent ? 'Speichern' : 'Hinzufügen'}
                  </button>
                  {editingOpponent && (
                    <button 
                      onClick={() => {
                        setEditingOpponent(null);
                        setNewOpponentName('');
                      }}
                      className="bg-[#202020] text-[#F5F5F5] px-4 py-2.5 font-black uppercase text-xs hover:bg-[#2A2A2A] transition-colors border border-[#2A2A2A] rounded-lg"
                    >
                      Abbrechen
                    </button>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto border border-[#2A2A2A] rounded-xl overflow-hidden bg-[#1A1A1A]">
                  <table className="w-full border-collapse">
                    <thead className="bg-[#202020] sticky top-0 border-b border-[#2A2A2A] text-[#F5F5F5]">
                      <tr>
                        <th className="p-3 text-left text-[10px] font-black uppercase tracking-widest">Gegner Name</th>
                        <th className="p-3 text-right text-[10px] font-black uppercase tracking-widest">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A2A2A]">
                      {opponents.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="p-8 text-center text-xs font-bold text-[#C7C7C7]/60 italic">
                            Keine Gegner hinterlegt.
                          </td>
                        </tr>
                      ) : (
                        opponents.map(opp => (
                          <tr key={opp.id} className="hover:bg-[#202020] transition-colors">
                            <td className="p-3 font-bold uppercase text-xs text-[#F5F5F5]">{opp.name}</td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => {
                                    setEditingOpponent(opp);
                                    setNewOpponentName(opp.name);
                                  }}
                                  className="p-1 text-[#FFD54F] hover:underline transition-colors"
                                  title="Bearbeiten"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => setOpponentToDelete(opp)}
                                  className="p-1 text-rose-400 hover:underline transition-colors"
                                  title="Löschen"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Match Confirm Modal */}
      <AnimatePresence>
        {showDeleteMatchConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1A1A] border border-[#2A2A2A] shadow-2xl rounded-xl w-full max-w-md p-6 text-[#F5F5F5]"
            >
              <h3 className="text-xl font-black uppercase mb-4 text-[#F5F5F5]">Spiel löschen?</h3>
              <p className="font-bold text-xs text-[#C7C7C7] mb-6">Möchtest du dieses Spiel wirklich unwiderruflich löschen?</p>
              <div className="flex gap-4">
                <button 
                  onClick={handleDeleteMatch}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 font-black uppercase text-xs rounded-lg transition-colors shadow-md"
                >
                  Ja, löschen
                </button>
                <button 
                  onClick={() => setShowDeleteMatchConfirm(false)}
                  className="flex-1 bg-[#202020] hover:bg-[#2A2A2A] text-[#F5F5F5] py-3 font-black uppercase text-xs rounded-lg transition-colors border border-[#2A2A2A]"
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Opponent Confirm Modal */}
      <AnimatePresence>
        {opponentToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1A1A] border border-[#2A2A2A] shadow-2xl rounded-xl w-full max-w-md p-6 text-[#F5F5F5]"
            >
              <h3 className="text-xl font-black uppercase mb-4 text-[#F5F5F5]">Gegner löschen?</h3>
              <p className="font-bold text-xs text-[#C7C7C7] mb-6">Möchtest du den Gegner "{opponentToDelete.name}" wirklich löschen?</p>
              <div className="flex gap-4">
                <button 
                  onClick={async () => {
                    await onDeleteOpponent(opponentToDelete.id);
                    setOpponentToDelete(null);
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 font-black uppercase text-xs rounded-lg transition-colors shadow-md"
                >
                  Ja, löschen
                </button>
                <button 
                  onClick={() => setOpponentToDelete(null)}
                  className="flex-1 bg-[#202020] hover:bg-[#2A2A2A] text-[#F5F5F5] py-3 font-black uppercase text-xs rounded-lg transition-colors border border-[#2A2A2A]"
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Player Minutes Confirm Modal */}
      <AnimatePresence>
        {playerToReset && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1A1A] border border-[#2A2A2A] shadow-2xl rounded-xl w-full max-w-md p-6 text-[#F5F5F5]"
            >
              <h3 className="text-xl font-black uppercase mb-4 text-[#F5F5F5]">Zeiten zurücksetzen?</h3>
              <p className="font-bold text-xs text-[#C7C7C7] mb-6">
                Möchtest du wirklich alle Einsatzzeiten für <span className="text-[#FFD54F] font-black">{playerToReset.lastName}</span> über alle Spiele hinweg auf 0 setzen?
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => handleResetPlayerMinutes(playerToReset.id)}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 font-black uppercase text-xs rounded-lg transition-colors shadow-md"
                >
                  Ja, zurücksetzen
                </button>
                <button 
                  onClick={() => setPlayerToReset(null)}
                  className="flex-1 bg-[#202020] hover:bg-[#2A2A2A] text-[#F5F5F5] py-3 font-black uppercase text-xs rounded-lg transition-colors border border-[#2A2A2A]"
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
