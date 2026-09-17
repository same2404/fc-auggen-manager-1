import React, { useState, useMemo } from 'react';
import { 
  Trophy, Medal, Star, Flame, Zap, Target, Shield, Crown, Brain, 
  Award, Calendar, Check, Plus, Edit3, Trash2, ChevronRight, 
  UserCheck, RotateCcw, Sparkles, Activity, Users, Info, ChevronDown,
  ChevronUp, CheckCircle2, ArrowRight, AlertTriangle
} from 'lucide-react';
import { Spieler } from '../../types';
import { useSyncedState } from '../../hooks/useSyncedState';

export interface ChampionsCupProViewProps {
  players: Spieler[];
  isEditing?: boolean;
  setToast?: (toast: { message: string; id: number }) => void;
}

export interface CupSessionEntry {
  id: string;
  date: string;
  unitNumber: number; // 1 to 15
  unitTitle: string;
  placements: Record<string, number>; // playerName -> 1, 2, 3, 4 (4 = participant), 0 = absent
  fairplayBonus: Record<string, boolean>; // playerName -> boolean (+1 pt)
  mvpPlayer?: string; // playerName (+1 pt)
  notes?: string;
  createdAt: number;
}

export interface KoMatch {
  id: string;
  stage: 'VF' | 'HF' | 'FINALE';
  p1: string;
  p2: string;
  score1?: number;
  score2?: number;
  winner?: string;
}

// 15 Elite Training Units
export const ELITE_TRAINING_UNITS = [
  { id: 1, title: 'Positionsspiel-Grundlagen (Juego de Posición)', desc: 'Rondo 4v2 · Positionsspiel 5v5+3 · Raumaufteilung' },
  { id: 2, title: 'Tiki-Taka Ballzirkulation', desc: 'Kurzpassspiel 1-Kontakt · Rondo Pressure 6v3 · Ballbesitz-Ketten' },
  { id: 3, title: 'Gegenpressing Elite', desc: 'Sofortiges Anlaufen nach Ballverlust (5-Sekunden-Regel) · Umschaltspiel · Zugriff im letzten Drittel' },
  { id: 4, title: 'Flügelspiel & Tempo', desc: 'Außenbahnläufe · Flanken unter Druck · Diagonalpässe hinter die Kette' },
  { id: 5, title: 'Umschaltmomente Offensiv/Defensiv', desc: 'Konterspiel nach Balleroberung · schnelles Rückzugsverhalten' },
  { id: 6, title: 'Pressing-Trigger-Training', desc: 'Koordiniertes Anlaufen · Pressing-Auslöser erkennen und nutzen' },
  { id: 7, title: 'Salida Lavolpiana (Aufbauspiel von hinten)', desc: 'Spielaufbau über Innenverteidiger & Torwart · Überzahl im Aufbau' },
  { id: 8, title: 'Räume schaffen & besetzen', desc: 'Positionswechsel · Drittmann-Läufe · Tiefenstaffelung' },
  { id: 9, title: 'Explosivität & Antrittsschnelligkeit', desc: 'Reaktionssprints · kurze Antritte · Beschleunigung aus der Bewegung' },
  { id: 10, title: '1-gegen-1 Meisterschaft', desc: 'Offensives Dribbling gegen Einzelgegner · defensives Zweikampfverhalten' },
  { id: 11, title: 'Standardsituationen Elite', desc: 'Einstudierte Eckball- und Freistoßvarianten · Einwurf-Automatismen' },
  { id: 12, title: 'Abschluss unter Gegnerdruck', desc: 'Torschuss in Überzahl-/Unterzahlsituationen · One-Touch-Finish' },
  { id: 13, title: 'Kompaktheit & Zonenverteidigung', desc: 'Verschieben als Einheit · Abstände halten · Linienspiel' },
  { id: 14, title: 'Overload-Situationen', desc: 'Bewusste Überzahlspiele (4v3, 3v2) zur Entscheidungsfindung' },
  { id: 15, title: 'Matchday-Simulation', desc: 'Vollzeitsimulation mit allen Prinzipien kombiniert, unter Wettkampfdruck' },
];

export const BADGE_DEFINITIONS = [
  { id: 'scharfschuetze', name: '🎯 Scharfschütze', desc: '3x oder mehr 1. Platz in einer Saison', icon: Target, color: 'from-amber-500 to-yellow-600' },
  { id: 'blitzstart', name: '⚡ Blitzstart', desc: 'schnellste Zeit in 2 Speed-Übungen', icon: Zap, color: 'from-cyan-500 to-blue-600' },
  { id: 'spielmacher', name: '🧠 Spielmacher', desc: 'beste Passquote über 3 Einheiten in Folge', icon: Brain, color: 'from-purple-500 to-indigo-600' },
  { id: 'mauer', name: '🛡️ Mauer', desc: 'meiste gewonnene Zweikämpfe', icon: Shield, color: 'from-emerald-500 to-teal-600' },
  { id: 'mvp_koenig', name: '👑 MVP-König', desc: 'Meiste MVP-Wahlen in der Saison', icon: Crown, color: 'from-rose-500 to-red-600' },
];

export const ChampionsCupProView: React.FC<ChampionsCupProViewProps> = ({
  players,
  isEditing = true,
  setToast,
}) => {
  const [activeTab, setActiveTab] = useState<'ranking' | 'add_unit' | 'curriculum' | 'badges' | 'playoffs'>('ranking');
  const [rankingPeriod, setRankingPeriod] = useState<'season' | 'month'>('season');
  const [showAddModal, setShowAddModal] = useState(false);

  // Synced state
  const [cupSessions, setCupSessions] = useSyncedState<CupSessionEntry[]>('championsCupSessions', []);
  const [manualBadges, setManualBadges] = useSyncedState<Record<string, string[]>>('championsCupBadges', {});
  const [koMatches, setKoMatches] = useSyncedState<KoMatch[]>('championsCupKoTree', []);
  const [wasSeeded, setWasSeeded] = useSyncedState<boolean>('championsCupWasSeeded', false);
  const [trainingUnits, setTrainingUnits] = useSyncedState<Array<{ id: number; title: string; desc: string }>>('championsCupUnits', ELITE_TRAINING_UNITS);
  const [editingUnitModal, setEditingUnitModal] = useState<{ id: number; title: string; desc: string; isNew?: boolean } | null>(null);

  // Custom Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: 'danger' | 'amber';
    onConfirm: () => void;
  } | null>(null);

  // Filter only actual squad players
  const squadPlayers = useMemo(() => {
    if (!players || !Array.isArray(players)) return [];
    const nonPlayerKeywords = [
      "trainer", "coach", "physio", "arzt", "manager", "betreuer", 
      "funktionär", "funktionaer", "staff", "official", "medical", 
      "athletik", "leiter", "sportlicher"
    ];

    return players.filter(p => {
      if (p.category && p.category !== "player") return false;
      const pos = (p.position || "").toLowerCase();
      if (nonPlayerKeywords.some(kw => pos.includes(kw))) return false;
      const fullName = (p.name || `${p.firstName || ""} ${p.lastName || ""}`).toLowerCase();
      if (nonPlayerKeywords.some(kw => fullName.includes(kw))) return false;
      return true;
    });
  }, [players]);

  // Form state for creating/editing a session
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formUnitNumber, setFormUnitNumber] = useState<number>(() => {
    if (cupSessions.length === 0) return 1;
    const lastNum = cupSessions[cupSessions.length - 1].unitNumber;
    return lastNum >= 15 ? 1 : lastNum + 1;
  });
  const [formPlacements, setFormPlacements] = useState<Record<string, number>>({});
  const [formFairplay, setFormFairplay] = useState<Record<string, boolean>>({});
  const [formMvp, setFormMvp] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  // Seed sample initial data if empty so view looks populated right away
  React.useEffect(() => {
    if (!wasSeeded && cupSessions.length === 0 && squadPlayers.length > 0) {
      const pNames = squadPlayers.map(p => p.name || `${p.firstName} ${p.lastName}`.trim());
      if (pNames.length >= 3) {
        const sampleSessions: CupSessionEntry[] = [
          {
            id: 'sample_1',
            date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
            unitNumber: 1,
            unitTitle: ELITE_TRAINING_UNITS[0].title,
            placements: { [pNames[0]]: 1, [pNames[1]]: 2, [pNames[2]]: 3, ...(pNames[3] ? { [pNames[3]]: 4 } : {}) },
            fairplayBonus: { [pNames[0]]: true, [pNames[1]]: true },
            mvpPlayer: pNames[0],
            notes: 'Starker Auftakt im Juego de Posición!',
            createdAt: Date.now() - 7 * 86400000
          },
          {
            id: 'sample_2',
            date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
            unitNumber: 2,
            unitTitle: ELITE_TRAINING_UNITS[1].title,
            placements: { [pNames[1]]: 1, [pNames[0]]: 2, [pNames[2]]: 3, ...(pNames[3] ? { [pNames[3]]: 4 } : {}) },
            fairplayBonus: { [pNames[1]]: true },
            mvpPlayer: pNames[1],
            notes: 'Sehr hohes Pass-Tempo.',
            createdAt: Date.now() - 4 * 86400000
          },
          {
            id: 'sample_3',
            date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
            unitNumber: 3,
            unitTitle: ELITE_TRAINING_UNITS[2].title,
            placements: { [pNames[0]]: 1, [pNames[2]]: 2, [pNames[1]]: 3, ...(pNames[3] ? { [pNames[3]]: 4 } : {}) },
            fairplayBonus: { [pNames[0]]: true, [pNames[2]]: true },
            mvpPlayer: pNames[0],
            notes: 'Aggressives Gegenpressing im 3. Drittel.',
            createdAt: Date.now() - 1 * 86400000
          }
        ];
        setCupSessions(sampleSessions);
        setWasSeeded(true);
      }
    }
  }, [wasSeeded, cupSessions.length, squadPlayers, setCupSessions, setWasSeeded]);

  // Calculate Standings
  const standings = useMemo(() => {
    const stats: Record<string, {
      pName: string;
      totalPoints: number;
      firstPlaces: number;
      secondPlaces: number;
      thirdPlaces: number;
      participations: number;
      fairplayBonuses: number;
      mvpVotes: number;
    }> = {};

    // Initialize for all squad players
    squadPlayers.forEach(p => {
      const name = p.name || `${p.firstName} ${p.lastName}`.trim();
      stats[name] = {
        pName: name,
        totalPoints: 0,
        firstPlaces: 0,
        secondPlaces: 0,
        thirdPlaces: 0,
        participations: 0,
        fairplayBonuses: 0,
        mvpVotes: 0,
      };
    });

    // Determine relevant sessions based on period
    let filteredSessions = cupSessions;
    if (rankingPeriod === 'month') {
      // Last 4 weeks / 12 sessions
      filteredSessions = cupSessions.slice(-12);
    }

    filteredSessions.forEach(session => {
      // Placements
      Object.entries(session.placements || {}).forEach(([pName, placement]) => {
        if (!stats[pName]) {
          stats[pName] = { pName, totalPoints: 0, firstPlaces: 0, secondPlaces: 0, thirdPlaces: 0, participations: 0, fairplayBonuses: 0, mvpVotes: 0 };
        }
        if (placement === 1) {
          stats[pName].totalPoints += 5;
          stats[pName].firstPlaces += 1;
          stats[pName].participations += 1;
        } else if (placement === 2) {
          stats[pName].totalPoints += 3;
          stats[pName].secondPlaces += 1;
          stats[pName].participations += 1;
        } else if (placement === 3) {
          stats[pName].totalPoints += 2;
          stats[pName].thirdPlaces += 1;
          stats[pName].participations += 1;
        } else if (placement === 4) {
          stats[pName].totalPoints += 1;
          stats[pName].participations += 1;
        }
      });

      // Fairplay Bonus (+1)
      Object.entries(session.fairplayBonus || {}).forEach(([pName, isBonus]) => {
        if (isBonus && stats[pName]) {
          stats[pName].totalPoints += 1;
          stats[pName].fairplayBonuses += 1;
        }
      });

      // MVP (+1)
      if (session.mvpPlayer && stats[session.mvpPlayer]) {
        stats[session.mvpPlayer].totalPoints += 1;
        stats[session.mvpPlayer].mvpVotes += 1;
      }
    });

    // Convert to array and sort by totalPoints DESC, then firstPlaces DESC, then mvpVotes DESC
    return Object.values(stats).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
      return b.mvpVotes - a.mvpVotes;
    });
  }, [squadPlayers, cupSessions, rankingPeriod]);

  // Automatic badge calculation
  const computedBadges = useMemo(() => {
    const badgesMap: Record<string, string[]> = {};

    standings.forEach(st => {
      const list: string[] = [...(manualBadges[st.pName] || [])];

      // 🎯 Scharfschütze: 3x or more 1st place
      if (st.firstPlaces >= 3 && !list.includes('scharfschuetze')) {
        list.push('scharfschuetze');
      }
      // 👑 MVP-König: Most MVP votes if >= 2
      if (st.mvpVotes >= 2 && !list.includes('mvp_koenig')) {
        list.push('mvp_koenig');
      }

      badgesMap[st.pName] = list;
    });

    return badgesMap;
  }, [standings, manualBadges]);

  // Handle saving new / edited session
  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();

    const currentUnit = trainingUnits.find(u => u.id === formUnitNumber);
    const unitTitle = currentUnit ? currentUnit.title : `Einheit ${formUnitNumber}`;

    const newSession: CupSessionEntry = {
      id: editingSessionId || `cup_session_${Date.now()}`,
      date: formDate,
      unitNumber: formUnitNumber,
      unitTitle,
      placements: formPlacements,
      fairplayBonus: formFairplay,
      mvpPlayer: formMvp || undefined,
      notes: formNotes,
      createdAt: Date.now()
    };

    if (editingSessionId) {
      setCupSessions(prev => prev.map(s => s.id === editingSessionId ? newSession : s));
      setToast?.({ message: 'Trainingseinheit erfolgreich aktualisiert!', id: Date.now() });
    } else {
      setCupSessions(prev => [...prev, newSession]);
      setToast?.({ message: `Einheit #${formUnitNumber} ("${unitTitle}") gespeichert!`, id: Date.now() });
    }

    // Reset form
    setEditingSessionId(null);
    setFormPlacements({});
    setFormFairplay({});
    setFormMvp('');
    setFormNotes('');
    setShowAddModal(false);
    setActiveTab('ranking');
  };

  const handleEditSession = (session: CupSessionEntry) => {
    setEditingSessionId(session.id);
    setFormDate(session.date);
    setFormUnitNumber(session.unitNumber);
    setFormPlacements({ ...session.placements });
    setFormFairplay({ ...session.fairplayBonus });
    setFormMvp(session.mvpPlayer || '');
    setFormNotes(session.notes || '');
    setShowAddModal(true);
  };

  const handleDeleteSession = (id: string) => {
    setConfirmModal({
      title: 'Gewertete Einheit löschen',
      message: 'Möchtest du diese gewertete Trainingseinheit wirklich aus der Historie entfernen?',
      confirmLabel: 'Einheit löschen',
      confirmVariant: 'danger',
      onConfirm: () => {
        setCupSessions(prev => prev.filter(s => s.id !== id));
        setToast?.({ message: 'Wertenheit gelöscht.', id: Date.now() });
      }
    });
  };

  const handleToggleBadge = (playerName: string, badgeId: string) => {
    setManualBadges(prev => {
      const current = prev[playerName] || [];
      const updated = current.includes(badgeId) 
        ? current.filter(b => b !== badgeId)
        : [...current, badgeId];
      return { ...prev, [playerName]: updated };
    });
    setToast?.({ message: 'Badge-Status aktualisiert.', id: Date.now() });
  };

  // Seed / Reset K.O. Tournament Bracket (Top 8 Saisontabelle)
  const handleInitializeKoBracket = () => {
    const top8 = standings.slice(0, 8).map(s => s.pName);
    if (top8.length < 8) {
      setToast?.({ message: 'Mindestens 8 Spieler in der Saisontabelle erforderlich!', id: Date.now() });
      return;
    }

    // Seed Viertelfinale (VF1: #1 vs #8, VF2: #4 vs #5, VF3: #3 vs #6, VF4: #2 vs #7)
    const matches: KoMatch[] = [
      { id: 'vf1', stage: 'VF', p1: top8[0], p2: top8[7] },
      { id: 'vf2', stage: 'VF', p1: top8[3], p2: top8[4] },
      { id: 'vf3', stage: 'VF', p1: top8[2], p2: top8[5] },
      { id: 'vf4', stage: 'VF', p1: top8[1], p2: top8[6] },
      // HF
      { id: 'hf1', stage: 'HF', p1: 'Sieger VF1', p2: 'Sieger VF2' },
      { id: 'hf2', stage: 'HF', p1: 'Sieger VF3', p2: 'Sieger VF4' },
      // Finale
      { id: 'finale', stage: 'FINALE', p1: 'Sieger HF1', p2: 'Sieger HF2' }
    ];

    setKoMatches(matches);
    setToast?.({ message: 'K.O.-Phase mit den Top 8 Spielern gestartet!', id: Date.now() });
  };

  const handleUpdateKoWinner = (matchId: string, winnerName: string) => {
    setKoMatches(prev => {
      const updated = prev.map(m => m.id === matchId ? { ...m, winner: winnerName } : m);
      
      // Update HF1 if VF1 or VF2 winner updated
      const vf1 = updated.find(m => m.id === 'vf1');
      const vf2 = updated.find(m => m.id === 'vf2');
      const hf1 = updated.find(m => m.id === 'hf1');
      if (hf1 && (vf1?.winner || vf2?.winner)) {
        if (vf1?.winner) hf1.p1 = vf1.winner;
        if (vf2?.winner) hf1.p2 = vf2.winner;
      }

      // Update HF2 if VF3 or VF4 winner updated
      const vf3 = updated.find(m => m.id === 'vf3');
      const vf4 = updated.find(m => m.id === 'vf4');
      const hf2 = updated.find(m => m.id === 'hf2');
      if (hf2 && (vf3?.winner || vf4?.winner)) {
        if (vf3?.winner) hf2.p1 = vf3.winner;
        if (vf4?.winner) hf2.p2 = vf4.winner;
      }

      // Update FINALE if HF1 or HF2 winner updated
      const finale = updated.find(m => m.id === 'finale');
      if (finale && (hf1?.winner || hf2?.winner)) {
        if (hf1?.winner) finale.p1 = hf1.winner;
        if (hf2?.winner) finale.p2 = hf2.winner;
      }

      return updated;
    });
  };

  // Reset functions
  const handleResetAll = () => {
    setConfirmModal({
      title: '⚠️ ALLES AUF 0 ZURÜCKSETZEN',
      message: 'Möchtest du wirklich ALLE Daten löschen? Dies setzt alle gewerteten Einheiten, Tabellenpunkte, Badges und K.O.-Turnierstände unwiderruflich auf 0 zurück.',
      confirmLabel: 'Ja, alles auf 0 zurücksetzen',
      confirmVariant: 'danger',
      onConfirm: () => {
        setCupSessions([]);
        setManualBadges({});
        setKoMatches([]);
        setWasSeeded(true);
        try {
          localStorage.removeItem('fca_championsCupSessions');
          localStorage.removeItem('fca_championsCupBadges');
          localStorage.removeItem('fca_championsCupKoTree');
          localStorage.setItem('fca_championsCupWasSeeded', 'true');
        } catch (e) {
          console.warn('LocalStorage clear error', e);
        }
        setToast?.({ message: 'Alle Champions Cup PRO Daten wurden vollständig auf 0 zurückgesetzt!', id: Date.now() });
      }
    });
  };

  const handleResetSessions = () => {
    setConfirmModal({
      title: 'Tabelle & Wertung auf 0 zurücksetzen',
      message: 'Möchtest du alle gewerteten Einheiten und gesammelten Punkte aus der Tabelle löschen?',
      confirmLabel: 'Ja, Wertungen löschen',
      confirmVariant: 'danger',
      onConfirm: () => {
        setCupSessions([]);
        setWasSeeded(true);
        try {
          localStorage.removeItem('fca_championsCupSessions');
          localStorage.setItem('fca_championsCupWasSeeded', 'true');
        } catch (e) {
          console.warn('LocalStorage clear error', e);
        }
        setToast?.({ message: 'Tabelle & Wertung wurden auf 0 zurückgesetzt!', id: Date.now() });
      }
    });
  };

  const handleClearKoBracket = () => {
    setConfirmModal({
      title: 'K.O.-Baum löschen',
      message: 'Möchtest du den K.O.-Turnierbaum vollständig zurücksetzen?',
      confirmLabel: 'K.O.-Baum löschen',
      confirmVariant: 'danger',
      onConfirm: () => {
        setKoMatches([]);
        try {
          localStorage.removeItem('fca_championsCupKoTree');
        } catch (e) {
          console.warn('LocalStorage clear error', e);
        }
        setToast?.({ message: 'K.O.-Baum gelöscht.', id: Date.now() });
      }
    });
  };

  const handleDeleteUnit = (id: number) => {
    setConfirmModal({
      title: `Einheit #${id} löschen`,
      message: `Möchtest du die Trainingseinheit #${id} wirklich aus dem Curriculum löschen?`,
      confirmLabel: 'Einheit löschen',
      confirmVariant: 'danger',
      onConfirm: () => {
        setTrainingUnits(prev => prev.filter(u => u.id !== id));
        setToast?.({ message: `Einheit #${id} gelöscht.`, id: Date.now() });
      }
    });
  };

  const handleResetUnitsToDefault = () => {
    setConfirmModal({
      title: 'Standard-Trainingseinheiten wiederherstellen',
      message: 'Möchtest du alle Einheiten des Curriculums auf die 15 originalen Standard-Themen zurücksetzen?',
      confirmLabel: 'Standard wiederherstellen',
      confirmVariant: 'amber',
      onConfirm: () => {
        setTrainingUnits(ELITE_TRAINING_UNITS);
        setToast?.({ message: '15 Standard-Trainingseinheiten wiederhergestellt.', id: Date.now() });
      }
    });
  };

  const handleResetBadges = () => {
    setConfirmModal({
      title: 'Badges zurücksetzen',
      message: 'Möchtest du alle manuell vergebenen Badges löschen?',
      confirmLabel: 'Badges zurücksetzen',
      confirmVariant: 'danger',
      onConfirm: () => {
        setManualBadges({});
        try {
          localStorage.removeItem('fca_championsCupBadges');
        } catch (e) {
          console.warn('LocalStorage clear error', e);
        }
        setToast?.({ message: 'Alle Badges zurückgesetzt.', id: Date.now() });
      }
    });
  };

  const championsCupWinner = useMemo(() => {
    const finaleMatch = koMatches.find(m => m.id === 'finale');
    return finaleMatch?.winner;
  }, [koMatches]);

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER BANNER */}
      <div className="bg-[#0F1C2E] border border-[#1E293B] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-[#00C2FF]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C2FF]/15 text-[#00C2FF] border border-[#00C2FF]/30 mb-3 shadow-xs">
              <Trophy className="w-4 h-4 text-[#00C2FF]" />
              <span>FC Auggen · Elite Trainingsliga</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>FC Auggen – Champions Cup PRO</span>
              <span className="text-xs bg-[#00C2FF] text-slate-950 font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                PRO
              </span>
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Laufende Wertung nach jeder Trainingseinheit · Automatische Monats- & Saisonwertung mit 15 Elite-Themen, Badges & K.O.-Finale!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditingSessionId(null);
                setFormPlacements({});
                setFormFairplay({});
                setFormMvp('');
                setFormNotes('');
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 bg-[#1A73E8] hover:bg-blue-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 border border-[#00C2FF]/40"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Einheit werten</span>
            </button>

            <button
              onClick={handleResetAll}
              className="px-3 py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-bold text-xs rounded-xl shadow flex items-center gap-2 transition-all"
              title="Alle Punkte, Einheiten & Badges auf 0 zurücksetzen"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>Alles auf 0 zurücksetzen</span>
            </button>
          </div>
        </div>

        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#1E293B]">
          <div className="bg-[#111827] border border-[#1E293B] p-3.5 rounded-xl">
            <div className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#00C2FF]" />
              <span>Gewertete Einheiten</span>
            </div>
            <div className="text-xl font-black text-white mt-1">{cupSessions.length} <span className="text-xs text-slate-400 font-normal">Einheiten</span></div>
          </div>

          <div className="bg-[#111827] border border-[#1E293B] p-3.5 rounded-xl">
            <div className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-blue-400" />
              <span>Aktuelles Thema</span>
            </div>
            <div className="text-xs font-bold text-[#00C2FF] truncate mt-1">
              {cupSessions.length > 0 
                ? `#${cupSessions[cupSessions.length - 1].unitNumber}: ${trainingUnits.find(u => u.id === cupSessions[cupSessions.length - 1].unitNumber)?.title || 'Unbekannt'}`
                : 'Einheit #1 (Start)'}
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1E293B] p-3.5 rounded-xl">
            <div className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Spitzenreiter</span>
            </div>
            <div className="text-sm font-extrabold text-white truncate mt-1">
              {standings[0] ? `🥇 ${standings[0].pName} (${standings[0].totalPoints} Pkt)` : '-'}
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1E293B] p-3.5 rounded-xl">
            <div className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#00C2FF]" />
              <span>Saison-Finale</span>
            </div>
            <div className="text-xs font-bold text-[#00C2FF] truncate mt-1">
              {championsCupWinner ? `🏆 Sieger: ${championsCupWinner}` : 'Top 8 K.O.-Phase'}
            </div>
          </div>
        </div>
      </div>

      {/* VIEW TABS NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#DADADA] pb-3">
        <button
          onClick={() => setActiveTab('ranking')}
          className={`px-4 py-2.5 rounded-xl text-xs uppercase font-bold flex items-center gap-2 transition-all ${
            activeTab === 'ranking' 
              ? 'bg-[#00C2FF] text-[#0A0A0A] font-black shadow-[0_0_10px_rgba(0,194,255,0.4)] border border-[#00C2FF]' 
              : 'bg-[#E8E8E8] text-[#4A4A4A] hover:text-[#F8FAFC] hover:bg-[#D8D8D8] border border-[#DADADA]'
          }`}
        >
          <Trophy className="w-4 h-4 text-[#0A0A0A]" />
          <span>Tabelle & Wertung</span>
        </button>

        <button
          onClick={() => setActiveTab('curriculum')}
          className={`px-4 py-2.5 rounded-xl text-xs uppercase font-bold flex items-center gap-2 transition-all ${
            activeTab === 'curriculum' 
              ? 'bg-[#00C2FF] text-[#0A0A0A] font-black shadow-[0_0_10px_rgba(0,194,255,0.4)] border border-[#00C2FF]' 
              : 'bg-[#E8E8E8] text-[#4A4A4A] hover:text-[#F8FAFC] hover:bg-[#D8D8D8] border border-[#DADADA]'
          }`}
        >
          <Calendar className="w-4 h-4 text-[#0A0A0A]" />
          <span>Die 15 Elite-Einheiten</span>
        </button>

        <button
          onClick={() => setActiveTab('badges')}
          className={`px-4 py-2.5 rounded-xl text-xs uppercase font-bold flex items-center gap-2 transition-all ${
            activeTab === 'badges' 
              ? 'bg-[#00C2FF] text-[#0A0A0A] font-black shadow-[0_0_10px_rgba(0,194,255,0.4)] border border-[#00C2FF]' 
              : 'bg-[#E8E8E8] text-[#4A4A4A] hover:text-[#F8FAFC] hover:bg-[#D8D8D8] border border-[#DADADA]'
          }`}
        >
          <Award className="w-4 h-4 text-[#0A0A0A]" />
          <span>Badges & Trophäen</span>
        </button>

        <button
          onClick={() => setActiveTab('playoffs')}
          className={`px-4 py-2.5 rounded-xl text-xs uppercase font-bold flex items-center gap-2 transition-all ${
            activeTab === 'playoffs' 
              ? 'bg-[#00C2FF] text-[#0A0A0A] font-black shadow-[0_0_10px_rgba(0,194,255,0.4)] border border-[#00C2FF]' 
              : 'bg-[#E8E8E8] text-[#4A4A4A] hover:text-[#F8FAFC] hover:bg-[#D8D8D8] border border-[#DADADA]'
          }`}
        >
          <Flame className="w-4 h-4 text-[#0A0A0A]" />
          <span>K.O.-Phase & Finale</span>
        </button>
      </div>

      {/* TAB 1: RANKING & STANDINGS */}
      {activeTab === 'ranking' && (
        <div className="space-y-6">
          {/* Sub filter (Month vs Season) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded-xl gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRankingPeriod('season')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rankingPeriod === 'season'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏆 Saisonwertung (6 Monate)
              </button>

              <button
                onClick={() => setRankingPeriod('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rankingPeriod === 'month'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📅 Monatswertung (4 Wochen)
              </button>

              <button
                onClick={handleResetSessions}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/60 shadow flex items-center gap-1.5 transition-all"
                title="Punkte und Einheiten der Tabelle auf 0 zurücksetzen"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Tabelle & Wertung auf 0 zurücksetzen</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 hidden sm:block">
              {rankingPeriod === 'season' 
                ? 'Gesamttabelle entscheidet über K.O.-Qualifikation (Top 8)' 
                : 'Rollierende Wertung der letzten 12 Trainingseinheiten'}
            </div>
          </div>

          {/* STANDINGS TABLE */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>
                  {rankingPeriod === 'season' ? 'Saisontabelle – Champions Cup PRO' : 'Monatstabelle – Aktuelle Phase'}
                </span>
              </h2>
              <span className="text-xs font-mono text-slate-400">
                {squadPlayers.length} Kader-Spieler
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-800">
                    <th className="p-3 w-12 text-center">Platz</th>
                    <th className="p-3">Spieler</th>
                    <th className="p-3 text-center">Punkte</th>
                    <th className="p-3 text-center">🥇 1. Platz</th>
                    <th className="p-3 text-center">🥈 2. Platz</th>
                    <th className="p-3 text-center">🥉 3. Platz</th>
                    <th className="p-3 text-center">Einsatz-Bonus</th>
                    <th className="p-3 text-center">👑 MVP</th>
                    <th className="p-3">Badges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {standings.map((st, idx) => {
                    const isTop1 = idx === 0;
                    const isTop3 = idx < 3;
                    const isTop8 = idx < 8;
                    const playerBadges = computedBadges[st.pName] || [];

                    return (
                      <tr 
                        key={st.pName} 
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isTop1 ? 'bg-amber-950/20' : isTop8 ? 'bg-slate-900/40' : ''
                        }`}
                      >
                        <td className="p-3 text-center font-black">
                          {idx === 0 && <span className="text-amber-400 font-extrabold">🥇 1.</span>}
                          {idx === 1 && <span className="text-slate-300 font-extrabold">🥈 2.</span>}
                          {idx === 2 && <span className="text-amber-600 font-extrabold">🥉 3.</span>}
                          {idx >= 3 && <span className={isTop8 ? 'text-amber-200/80 font-bold' : 'text-slate-500'}>{idx + 1}.</span>}
                        </td>

                        <td className="p-3 font-bold text-white flex items-center gap-2">
                          <span>{st.pName}</span>
                          {isTop8 && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold">
                              K.O. Top 8
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <span className="font-mono font-black text-sm text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/30">
                            {st.totalPoints} Pkt
                          </span>
                        </td>

                        <td className="p-3 text-center font-mono font-bold text-slate-200">
                          {st.firstPlaces}x
                        </td>

                        <td className="p-3 text-center font-mono text-slate-300">
                          {st.secondPlaces}x
                        </td>

                        <td className="p-3 text-center font-mono text-slate-400">
                          {st.thirdPlaces}x
                        </td>

                        <td className="p-3 text-center font-mono text-emerald-400 font-bold">
                          +{st.fairplayBonuses}
                        </td>

                        <td className="p-3 text-center font-mono text-rose-400 font-bold">
                          👑 {st.mvpVotes}
                        </td>

                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {playerBadges.map(bId => {
                              const bDef = BADGE_DEFINITIONS.find(b => b.id === bId);
                              if (!bDef) return null;
                              return (
                                <span 
                                  key={bId} 
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700"
                                  title={bDef.desc}
                                >
                                  {bDef.name}
                                </span>
                              );
                            })}
                            {playerBadges.length === 0 && <span className="text-slate-600 italic text-[11px]">-</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* LOGGED SESSIONS HISTORY */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-extrabold text-white mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-red-500" />
                Historie aller gewerteten Einheiten
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">{cupSessions.length} Einheiten</span>
                {cupSessions.length > 0 && (
                  <button
                    onClick={handleResetSessions}
                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    title="Alle Einheiten und deren Punkte löschen"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Alle Einheiten löschen</span>
                  </button>
                )}
              </div>
            </h3>

            {cupSessions.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 text-center">
                Noch keine Einheiten gewertet. Klicke auf "Einheit werten", um Ergebnisse einzutragen!
              </p>
            ) : (
              <div className="space-y-3">
                {cupSessions.slice().reverse().map((session) => (
                  <div key={session.id} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded">
                          Einheit #{session.unitNumber}
                        </span>
                        <span className="text-xs font-bold text-white">{session.unitTitle}</span>
                        <span className="text-[11px] font-mono text-slate-500 ml-auto md:ml-0">({session.date})</span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-slate-300 mt-2">
                        {Object.entries(session.placements || {}).map(([pName, placement]) => {
                          if (placement === 0) return null;
                          return (
                            <span key={pName} className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px]">
                              {placement === 1 && '🥇 '}
                              {placement === 2 && '🥈 '}
                              {placement === 3 && '🥉 '}
                              {placement === 4 && '⚽ '}
                              <strong>{pName}</strong> ({placement === 1 ? '5Pkt' : placement === 2 ? '3Pkt' : placement === 3 ? '2Pkt' : '1Pkt'})
                              {session.fairplayBonus[pName] && ' +1 Bonus'}
                            </span>
                          );
                        })}
                        {session.mvpPlayer && (
                          <span className="bg-rose-950/80 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded text-[11px] font-bold">
                            👑 MVP: {session.mvpPlayer} (+1)
                          </span>
                        )}
                      </div>

                      {session.notes && (
                        <p className="text-xs text-slate-400 italic mt-1.5">"{session.notes}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => handleEditSession(session)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 border border-slate-700 transition-colors"
                        title="Einheit korrigieren"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Bearbeiten</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-950 text-rose-400 rounded-lg text-xs font-bold border border-slate-700 transition-colors"
                        title="Einheit löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DIE 15 ELITE-TRAININGSEINHEITEN (CURRICULUM) */}
      {activeTab === 'curriculum' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white mb-2 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <span>Die 15 Elite-Trainingseinheiten (Positionsspiel & Pressing)</span>
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                Inspiriert von der Trainingsmethodik führender Top-Akademien (Positionsspiel, Gegenpressing, Ballzirkulation) — läuft fortlaufend im Kreis: 3x pro Woche = ca. alle 5 Wochen einmal komplett durch. Du kannst alle Einheiten frei anpassen und bearbeiten!
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => setEditingUnitModal({ id: trainingUnits.length + 1, title: '', desc: '', isNew: true })}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Einheit hinzufügen</span>
              </button>

              <button
                onClick={handleResetUnitsToDefault}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                title="15 Standard-Trainingseinheiten wiederherstellen"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Standard wiederherstellen</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trainingUnits.map((unit) => (
              <div 
                key={unit.id} 
                className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 p-4 rounded-xl shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black px-2.5 py-0.5 rounded-lg">
                      Einheit #{unit.id}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingUnitModal({ ...unit, isNew: false })}
                        className="p-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-md border border-slate-700 text-[11px] font-bold flex items-center gap-1 px-2"
                        title="Einheit bearbeiten"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Bearbeiten</span>
                      </button>
                      {trainingUnits.length > 1 && (
                        <button
                          onClick={() => handleDeleteUnit(unit.id)}
                          className="p-1 bg-slate-800 hover:bg-rose-950 text-rose-400 rounded-md border border-slate-700"
                          title="Einheit löschen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-extrabold text-white mb-1.5">
                    {unit.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {unit.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-medium">Wertung: 5 - 3 - 2 - 1 Pkt</span>
                  <button
                    onClick={() => {
                      setFormUnitNumber(unit.id);
                      setEditingSessionId(null);
                      setFormPlacements({});
                      setFormFairplay({});
                      setFormMvp('');
                      setShowAddModal(true);
                    }}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <span>Jetzt werten</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: BADGES & TROPHÄEN */}
      {activeTab === 'badges' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white mb-1 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span>Auszeichnungen & Badges Übersicht</span>
              </h2>
              <p className="text-xs text-slate-300">
                Vergebe Auszeichnungen für besondere Einzelleistungen oder erstelle automatische Trophäen für die Spieler.
              </p>
            </div>
            <button
              onClick={handleResetBadges}
              className="px-3.5 py-2 text-xs font-bold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 rounded-xl transition-all shadow flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Badges zurücksetzen</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BADGE_DEFINITIONS.map(b => {
              const Icon = b.icon;
              return (
                <div key={b.id} className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 p-4 rounded-2xl shadow-xl flex items-start gap-3 transition-all">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${b.color} text-white shadow-lg shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">{b.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* BADGE ASSIGNMENT MATRIX */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-extrabold text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Badges pro Kader-Spieler verwalten:</span>
            </h3>
            <div className="space-y-2">
              {squadPlayers.map(p => {
                const pName = p.name || `${p.firstName} ${p.lastName}`.trim();
                const assigned = computedBadges[pName] || [];

                return (
                  <div key={pName} className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="text-xs font-bold text-white">{pName}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {BADGE_DEFINITIONS.map(b => {
                        const hasBadge = assigned.includes(b.id);
                        return (
                          <button
                            key={b.id}
                            onClick={() => handleToggleBadge(pName, b.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                              hasBadge 
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-400 font-black shadow' 
                                : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {b.name} {hasBadge && '✓'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: K.O.-PHASE & FINALE */}
      {activeTab === 'playoffs' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-red-950 via-slate-900 to-amber-950 border border-amber-500/30 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>6-Monate Saisonabschluss</span>
              </div>
              <h2 className="text-xl font-black text-white">🔥 K.O.-Phase: Die Top 8 der Saison</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Die besten 8 Spieler der Saisontabelle treten im K.O.-Turnier (Viertelfinale → Halbfinale → Finale) um den Pokal des Champions Cup PRO an!
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleInitializeKoBracket}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Top 8 K.O.-Baum laden / neu starten</span>
              </button>
              {koMatches.length > 0 && (
                <button
                  onClick={handleClearKoBracket}
                  className="px-3 py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/50 font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>K.O.-Baum löschen</span>
                </button>
              )}
            </div>
          </div>

          {/* TROPHY CEREMONY BANNER IF WINNER */}
          {championsCupWinner && (
            <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 p-6 rounded-2xl shadow-2xl text-slate-950 text-center space-y-2 border-2 border-amber-200 animate-pulse">
              <Trophy className="w-12 h-12 mx-auto text-slate-950" />
              <h2 className="text-2xl font-black uppercase tracking-wider">🏆 SIEGEREHRUNG – SAISONSIEGER 🏆</h2>
              <p className="text-lg font-black text-slate-900">
                HERZLICHEN GLÜCKWUNSCH AN <span className="underline decoration-slate-900 decoration-4">{championsCupWinner}</span>!
              </p>
              <p className="text-xs font-bold text-slate-800">
                Pokalsieger & MVP des FC Auggen – Champions Cup PRO!
              </p>
            </div>
          )}

          {/* K.O. BRACKET VIEW */}
          {koMatches.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-2xl shadow-xl text-center space-y-3">
              <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-sm font-bold text-white">Noch keine K.O.-Phase gestartet.</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Klicke oben auf "Top 8 K.O.-Baum laden", um die qualifizierten Top-8 Spieler der Saisontabelle automatisch einzusetzen.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* VIERTELFINALE */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Viertelfinale (VF)</span>
                </h3>
                {koMatches.filter(m => m.stage === 'VF').map(match => (
                  <div key={match.id} className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 p-3.5 rounded-2xl shadow-xl space-y-2.5 transition-all">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Match {match.id.toUpperCase()}</div>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className={match.winner === match.p1 ? 'text-amber-300 font-black' : 'text-slate-200'}>{match.p1}</span>
                      <button
                        onClick={() => handleUpdateKoWinner(match.id, match.p1)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${match.winner === match.p1 ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow border border-amber-400' : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700'}`}
                      >
                        Sieg
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold border-t border-slate-800/80 pt-2">
                      <span className={match.winner === match.p2 ? 'text-amber-300 font-black' : 'text-slate-200'}>{match.p2}</span>
                      <button
                        onClick={() => handleUpdateKoWinner(match.id, match.p2)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${match.winner === match.p2 ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow border border-amber-400' : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700'}`}
                      >
                        Sieg
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* HALBFINALE */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Halbfinale (HF)</span>
                </h3>
                {koMatches.filter(m => m.stage === 'HF').map(match => (
                  <div key={match.id} className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 p-3.5 rounded-2xl shadow-xl space-y-2.5 transition-all">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Match {match.id.toUpperCase()}</div>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className={match.winner === match.p1 ? 'text-amber-300 font-black' : 'text-slate-200'}>{match.p1}</span>
                      <button
                        onClick={() => handleUpdateKoWinner(match.id, match.p1)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${match.winner === match.p1 ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow border border-amber-400' : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700'}`}
                      >
                        Sieg
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold border-t border-slate-800/80 pt-2">
                      <span className={match.winner === match.p2 ? 'text-amber-300 font-black' : 'text-slate-200'}>{match.p2}</span>
                      <button
                        onClick={() => handleUpdateKoWinner(match.id, match.p2)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${match.winner === match.p2 ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow border border-amber-400' : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700'}`}
                      >
                        Sieg
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* FINALE */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>GROSSES FINALE</span>
                </h3>
                {koMatches.filter(m => m.stage === 'FINALE').map(match => (
                  <div key={match.id} className="bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/50 border-2 border-amber-500/60 p-4.5 rounded-2xl space-y-3.5 shadow-2xl">
                    <div className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span>FINALE UM DEN POKAL</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-black">
                      <span className={match.winner === match.p1 ? 'text-amber-300' : 'text-white'}>{match.p1}</span>
                      <button
                        onClick={() => handleUpdateKoWinner(match.id, match.p1)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${match.winner === match.p1 ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-lg border border-amber-300' : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'}`}
                      >
                        POKALSIEGER
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-sm font-black border-t border-slate-800/80 pt-2.5">
                      <span className={match.winner === match.p2 ? 'text-amber-300' : 'text-white'}>{match.p2}</span>
                      <button
                        onClick={() => handleUpdateKoWinner(match.id, match.p2)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${match.winner === match.p2 ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-lg border border-amber-300' : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'}`}
                      >
                        POKALSIEGER
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT TRAINING SESSION EVALUATION */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>{editingSessionId ? 'Trainingseinheit korrigieren' : 'Neue Einheit werten'}</span>
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Datum:</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Themen-Einheit (1 bis 15):</label>
                  <select
                    value={formUnitNumber}
                    onChange={(e) => setFormUnitNumber(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500"
                  >
                    {trainingUnits.map(u => (
                      <option key={u.id} value={u.id}>
                        Einheit #{u.id}: {u.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Placements for each squad player */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-extrabold text-amber-400 block">
                  Platzierung pro Spieler (1. Platz = 5 Pkt, 2. = 3 Pkt, 3. = 2 Pkt, Teilgenommen = 1 Pkt):
                </label>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {squadPlayers.map(p => {
                    const pName = p.name || `${p.firstName} ${p.lastName}`.trim();
                    const currentPlacement = formPlacements[pName] || 0;
                    const hasFairplay = !!formFairplay[pName];

                    return (
                      <div key={pName} className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">{pName}</span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { val: 1, label: '🥇 1. (5P)' },
                            { val: 2, label: '🥈 2. (3P)' },
                            { val: 3, label: '🥉 3. (2P)' },
                            { val: 4, label: '⚽ Teilg. (1P)' },
                            { val: 0, label: 'Abwesend' },
                          ].map(opt => (
                            <button
                              type="button"
                              key={opt.val}
                              onClick={() => setFormPlacements(prev => ({ ...prev, [pName]: opt.val }))}
                              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                currentPlacement === opt.val
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => setFormFairplay(prev => ({ ...prev, [pName]: !prev[pName] }))}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                              hasFairplay
                                ? 'bg-emerald-600 text-white border-emerald-400 font-black'
                                : 'bg-slate-900 text-slate-500 border-slate-800'
                            }`}
                            title="Einsatz / Fairplay Bonus (+1 Pkt)"
                          >
                            +1 Fairplay
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MVP Player Select */}
              <div className="pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-rose-400 block mb-1">
                  👑 MVP der Einheit (Mitspieler-Wahl) (+1 Bonumpunkt):
                </label>
                <select
                  value={formMvp}
                  onChange={(e) => setFormMvp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Kein MVP gewählt --</option>
                  {squadPlayers.map(p => {
                    const pName = p.name || `${p.firstName} ${p.lastName}`.trim();
                    return (
                      <option key={pName} value={pName}>👑 {pName}</option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Anmerkungen / Notizen:</label>
                <input
                  type="text"
                  placeholder="z.B. Starkes Umschalten, Hohe Intensität..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg"
                >
                  {editingSessionId ? 'Änderungen speichern' : 'Einheit eintragen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDITING UNIT MODAL */}
      {editingUnitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <span>{editingUnitModal.isNew ? 'Neue Trainingseinheit anlegen' : `Einheit #${editingUnitModal.id} bearbeiten`}</span>
              </h3>
              <button
                onClick={() => setEditingUnitModal(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Einheit-Nummer (#):</label>
                <input
                  type="number"
                  value={editingUnitModal.id}
                  onChange={(e) => setEditingUnitModal({ ...editingUnitModal, id: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:border-amber-500"
                  min={1}
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Titel der Einheit:</label>
                <input
                  type="text"
                  value={editingUnitModal.title}
                  onChange={(e) => setEditingUnitModal({ ...editingUnitModal, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-amber-500"
                  placeholder="z.B. Positionsspiel-Grundlagen (Juego de Posición)"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Beschreibung / Schwerpunkte & Übungen:</label>
                <textarea
                  value={editingUnitModal.desc}
                  onChange={(e) => setEditingUnitModal({ ...editingUnitModal, desc: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 h-24 focus:outline-none focus:border-amber-500 leading-relaxed"
                  placeholder="z.B. Rondo 4v2 · Positionsspiel 5v5+3 · Raumaufteilung"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingUnitModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingUnitModal.title.trim()) return;
                  setTrainingUnits(prev => {
                    const exists = prev.some(u => u.id === editingUnitModal.id && !editingUnitModal.isNew);
                    if (exists) {
                      return prev.map(u => u.id === editingUnitModal.id ? { id: editingUnitModal.id, title: editingUnitModal.title, desc: editingUnitModal.desc } : u);
                    } else {
                      return [...prev.filter(u => u.id !== editingUnitModal.id), { id: editingUnitModal.id, title: editingUnitModal.title, desc: editingUnitModal.desc }].sort((a,b) => a.id - b.id);
                    }
                  });
                  setToast?.({ message: `Einheit #${editingUnitModal.id} gespeichert!`, id: Date.now() });
                  setEditingUnitModal(null);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-3 rounded-xl border shrink-0 ${
                confirmModal.confirmVariant === 'amber'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white leading-snug">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal(null);
                  action();
                }}
                className={`px-4 py-2 font-black text-xs rounded-xl shadow-lg transition-all ${
                  confirmModal.confirmVariant === 'amber'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {confirmModal.confirmLabel || 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChampionsCupProView;
