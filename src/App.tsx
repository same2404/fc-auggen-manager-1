import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth'; 
import { auth, googleProvider, db, handleFirestoreError, OperationType, getWeekdayLabel, isQueryParamValid, cleanFirestoreData } from './firebase';
import { setupBackgroundSync, isQuotaExceededActive, markQuotaExceeded, isQuotaError, clearQuotaExceeded } from './lib/offlineStorage';
import { doc, setDoc, deleteField, updateDoc, deleteDoc, writeBatch, query, collection, where, getDocs, getDoc, onSnapshot } from 'firebase/firestore';
import { TABS, PLAYERS as INITIAL_PLAYERS, ATTENDANCE, COMPETITIVE_MATCHES, TEST_MATCHES, SCOUTING_DATA as INITIAL_SCOUTING, INITIAL_FINANCE_DATA, INITIAL_MEETINGS_DATA, INITIAL_TRAINING_SESSIONS, INITIAL_SUMMER_PREP, INITIAL_WINTER_PREP, YEARLY_PLAN, DEPTH_CHART, FINANCE_META, INITIAL_FORMATION, CARD_RECORDS, COMPETITIVE_MINUTES, TEST_MINUTES } from './constants';
import { TabId, Spieler, Training, Vorbereitung, Spiel, Finanz, LogEntry, Player, IndividualTrainingRecord, TrainingSession, ScoutingEntry, MeetingEntry, FinanceEntry, SummerPrepUnit, WinterPrepUnit, DayPlan } from './types';
import { useSyncedState } from './hooks/useSyncedState';
import { useCollectionSync } from './hooks/useCollectionSync';
import { migrateFirestoreData } from './utils/migration';
import { UniformMask } from './components/UniformMask';
import { KaderAgentModal } from './components/KaderAgentModal';
import { Pro3DTacticBoardModal } from './components/Pro3DTacticBoardModal';
import { AgentSystemControlCenterModal } from './components/AgentSystemControlCenterModal';
import JSZip from 'jszip';
import { TacticBoard } from './components/TacticBoard';
import { FormationView } from './components/FormationView';
import { ScoutingFormationView } from './components/ScoutingFormationView';
import { MatchPlanningView, YearlyPlanView, BudgetFinanceView, CardStatisticsSheet, RunsSWView, PhysioPlanView, IndividualSteuerungView, TrainingAttendanceView, SummerPreparationView, WinterPreparationView, TeamListView, DeveloperTasksView, TrainingPlanningView, MatchReportView, ScoutingView, MeetingsCalendarView, AccessControlView, PlayerPortalView, AcademyAnalysisView, ChampionsCupProView, DashboardView, VideoAnalysisView, Profi3DTacticBoardView, TrackerAcademyReportView } from './components/Views';
import { TechnicalErrorView } from './components/TechnicalErrorView';
import { SessionLoginView } from './components/SessionLoginView';
import { getPositionOrder, sortPlayers, isPlayer } from './utils/playerSorting';
import PersonnelView from './components/views/PersonnelView';
import { UniformView } from './components/UniformView';
import { getHolidays } from './utils/holidays';
import { 
  User, 
  Plus, 
  UserPlus,
  UserMinus,
  Search, 
  Camera, 
  Euro, 
  MessageSquare, 
  Activity, 
  Shield, 
  ChevronRight,
  TrendingUp,
  Clock,
  FileText,
  Target,
  Edit2,
  Trash2,
  Save,
  X as CloseIcon,
  MapPin,
 Timer,
  ChevronLeft,
  Calendar,
  RotateCcw,
  RefreshCw,
  Upload,
  Radio,
  Menu,
  Maximize2,
  Minimize2,
  Monitor,
  Sun,
  Moon,
  LayoutDashboard,
  Trophy,
  FolderKanban,
  Layers,
  ShieldCheck,
  UserCheck,
  Share2
} from 'lucide-react';

const KEY_TO_TAB: Record<string, string> = {
  'players': 'Spielerprofile',
  'attendance': 'Anwesenheit',
  'yearlyPlan': 'Jahresplan',
  'cardRecords': 'Karten',
  'scoutingCandidates': 'Scouting',
  'financeData': 'Finanzen',
  'financeMeta': 'Finanzen',
  'meetingsData': 'Gespräche',
  'individualTrainingData': 'Individuelle Steuerung',
  'summerPrep': 'Sommer Vorbereitung',
  'winterPrep': 'Winter Vorbereitung',
  'runRecords': 'Läufe',
  'physioEntries': 'Physio',
  'video_analysis': 'Video-Analyse',
  'formation': 'Taktiktafel',
  'depthChart': 'Kaderplanung',
  'teamPhoto': 'Teamfoto',
  'testMatches': 'Testspiele',
  'testMinutes': 'Testspiele',
  'u23Matches': 'U23 – Einsatzzeiten A‑Kader',
  'u23Minutes': 'U23 – Einsatzzeiten A‑Kader',
};

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastError, setLastError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState(() => isQuotaExceededActive());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const updateQuotaState = () => {
      setQuotaError(isQuotaExceededActive());
    };
    window.addEventListener('fca_quota_exceeded', updateQuotaState);
    window.addEventListener('fca_quota_cleared', updateQuotaState);
    window.addEventListener('fca_sync_error', updateQuotaState);
    return () => {
      window.removeEventListener('fca_quota_exceeded', updateQuotaState);
      window.removeEventListener('fca_quota_cleared', updateQuotaState);
      window.removeEventListener('fca_sync_error', updateQuotaState);
    };
  }, []);

  useEffect(() => {
    if (themeMode === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [themeMode]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleBrowserFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn("Browser fullscreen request blocked or error:", err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.warn("Exit fullscreen error:", err);
        });
      }
    }
  }, []);

  // Browsersession-Only Login: Requires fresh login on every new browser start
  const [isSessionAuthenticated, setIsSessionAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      // Clear legacy localStorage keys that would bypass session login across browser starts
      localStorage.removeItem('fca_owner_session');
      localStorage.removeItem('fca_custom_email');
      localStorage.removeItem('fca_custom_name');
      return sessionStorage.getItem('fca_session_authenticated') === 'true';
    } catch {
      return false;
    }
  });

  const [authUser, setAuthUser] = useState<any>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const isAuth = sessionStorage.getItem('fca_session_authenticated') === 'true';
      if (!isAuth) return null;
      const email = sessionStorage.getItem('fca_session_user_email') || 'samerkhaleel720@gmail.com';
      const name = sessionStorage.getItem('fca_session_user_name') || 'Samer Khaleel (Owner)';
      return {
        uid: 'session_' + email.replace(/[^a-zA-Z0-9]/g, '_'),
        email,
        displayName: name,
        isCustom: true
      };
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [ownerEmail] = useState('samerkhaleel720@gmail.com');
  // EXCLUSIVE OWNER LOCK: Default is FALSE so invited colleagues and trainers can access the app seamlessly
  const [securityLockActive, setSecurityLockActive] = useSyncedState<boolean>('securityLockActive', false, true);
  const [currentUserStatus, setCurrentUserStatus] = useState<'approved' | 'pending' | 'rejected' | null>('approved');

  const [localName, setLocalName] = useState<string>(() => {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('fca_session_user_name') || 'Samer Khaleel';
    }
    return 'Samer Khaleel';
  });
  const [localEmail, setLocalEmail] = useState<string>(() => {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('fca_session_user_email') || 'samerkhaleel720@gmail.com';
    }
    return 'samerkhaleel720@gmail.com';
  });
  const [showLocalProfileModal, setShowLocalProfileModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [dismissQuotaBanner, setDismissQuotaBanner] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fca_dismiss_quota_banner') === 'true';
    } catch {
      return false;
    }
  });

  // Strictly check if current active user is the verified owner for this session
  const isOwner = Boolean(
    isSessionAuthenticated && (
      (authUser && authUser.email?.toLowerCase() === ownerEmail.toLowerCase()) ||
      localEmail.toLowerCase() === ownerEmail.toLowerCase() ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fca_session_user_email')?.toLowerCase() === ownerEmail.toLowerCase())
    )
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      const isAuth = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fca_session_authenticated') === 'true';
      if (user && isAuth) {
        setAuthUser(user);
      } else if (!isAuth) {
        setAuthUser(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const cleanupSync = setupBackgroundSync(db);
    return () => cleanupSync();
  }, []);

  useEffect(() => {
    if (authUser) {
      const userRef = doc(db, 'app_users', authUser.uid);
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setCurrentUserStatus(docSnap.data().status || 'pending');
        } else {
          setCurrentUserStatus('pending');
        }
      }, (error) => {
        console.warn("Could not fetch current user status:", error);
        setCurrentUserStatus('pending');
      });
      return () => unsubscribe();
    } else {
      setCurrentUserStatus(null);
    }
  }, [authUser]);

  const userRegisteredRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOnline && !isQuotaExceededActive() && authUser && currentUserStatus !== 'rejected') {
      const userKey = `${authUser.uid}_${currentUserStatus}`;
      if (userRegisteredRef.current === userKey) return;
      userRegisteredRef.current = userKey;

      const userRef = doc(db, 'app_users', authUser.uid);
      setDoc(userRef, cleanFirestoreData({
        uid: authUser.uid,
        email: authUser.email || '',
        name: authUser.displayName || authUser.email?.split('@')[0] || 'User',
        role: authUser.email === ownerEmail ? 'owner' : 'viewer',
        status: currentUserStatus || 'approved',
        updatedAt: new Date().toISOString()
      }), { merge: true }).catch((err) => {
        if (isQuotaError(err)) {
          markQuotaExceeded();
        }
        console.warn("Could not automatically register/update user in cloud app_users:", err);
      });
    }
  }, [isOnline, authUser, ownerEmail, currentUserStatus]);

  const handleUnlockOwner = async (email: string, pass: string): Promise<boolean> => {
    const emailClean = email.trim().toLowerCase();
    if (emailClean !== ownerEmail.toLowerCase()) {
      return false;
    }
    if (pass !== '0000') {
      return false;
    }

    try {
      sessionStorage.setItem('fca_session_authenticated', 'true');
      sessionStorage.setItem('fca_session_user_email', ownerEmail);
      sessionStorage.setItem('fca_session_user_name', 'Samer Khaleel (Owner)');
    } catch {}

    // Clear legacy localStorage keys to ensure session expires on browser close
    try {
      localStorage.removeItem('fca_owner_session');
      localStorage.removeItem('fca_custom_email');
      localStorage.removeItem('fca_custom_name');
    } catch {}

    setIsSessionAuthenticated(true);
    setLocalName('Samer Khaleel');
    setLocalEmail(ownerEmail);

    try {
      if (navigator.onLine) {
        const cred = await signInAnonymously(auth);
        setAuthUser({
          ...cred.user,
          email: ownerEmail,
          displayName: 'Samer Khaleel (Owner)',
          isAnonymous: true
        });
      } else {
        setAuthUser({
          uid: 'owner_session_offline',
          email: ownerEmail,
          displayName: 'Samer Khaleel (Owner)',
          isCustom: true
        });
      }
    } catch {
      setAuthUser({
        uid: 'owner_session_local',
        email: ownerEmail,
        displayName: 'Samer Khaleel (Owner)',
        isCustom: true
      });
    }

    setToast({ message: 'Erfolgreich für diese Browsersession angemeldet!', id: Date.now() });
    return true;
  };

  const handleGoogleLoginOwner = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
        await signOut(auth);
        setAuthUser(null);
        setIsSessionAuthenticated(false);
        try {
          sessionStorage.removeItem('fca_session_authenticated');
          sessionStorage.removeItem('fca_session_user_email');
          sessionStorage.removeItem('fca_session_user_name');
        } catch {}
        throw new Error(`Technischer Fehler (Fehlercode 403): Das Konto ${result.user.email} ist nicht autorisiert. Zugriff gesperrt.`);
      }

      try {
        sessionStorage.setItem('fca_session_authenticated', 'true');
        sessionStorage.setItem('fca_session_user_email', ownerEmail);
        sessionStorage.setItem('fca_session_user_name', result.user.displayName || 'Samer Khaleel');
        localStorage.removeItem('fca_owner_session');
        localStorage.removeItem('fca_custom_email');
        localStorage.removeItem('fca_custom_name');
      } catch {}

      setIsSessionAuthenticated(true);
      setLocalName(result.user.displayName || 'Samer Khaleel');
      setLocalEmail(ownerEmail);

      setAuthUser(result.user);
      setToast({ message: 'Erfolgreich mit Google für diese Browsersession autorisiert!', id: Date.now() });
    } catch (err: any) {
      console.error("Google Auth failed:", err);
      throw err;
    }
  };

  const handleLogin = async () => {
    try {
      await handleGoogleLoginOwner();
    } catch (err: any) {
      setToast({ message: err.message || 'Anmeldung fehlgeschlagen.', id: Date.now() });
    }
  };

  const handleEmailPasswordLogin = async (email: string, pass: string) => {
    const emailClean = email.trim().toLowerCase();
    if (emailClean !== ownerEmail.toLowerCase()) {
      setToast({ message: 'Technischer Fehler (Fehlercode 403): Zugriff für dieses Konto verweigert. System gesperrt.', id: Date.now() });
      return;
    }

    if (pass !== '0000') {
      setToast({ message: 'Falsches Passwort! Bitte nutze das Inhaber-Passwort (0000).', id: Date.now() });
      return;
    }

    const ok = await handleUnlockOwner(emailClean, pass);
    if (ok) {
      setShowLoginModal(false);
    }
  };

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('fca_session_authenticated');
      sessionStorage.removeItem('fca_session_user_email');
      sessionStorage.removeItem('fca_session_user_name');
      localStorage.removeItem('fca_custom_email');
      localStorage.removeItem('fca_custom_name');
      localStorage.removeItem('fca_owner_session');
      localStorage.removeItem('fca_local_name');
      localStorage.removeItem('fca_local_email');
      setIsSessionAuthenticated(false);
      setAuthUser(null);
      setLocalName('Gast');
      setLocalEmail('');
      await signOut(auth);
      setToast({ message: 'Erfolgreich abgemeldet. Für erneuten Zugriff bitte neu anmelden.', id: Date.now() });
    } catch (err: any) {
      console.error("Logout failed:", err);
    }
  };

  const [requestEmail, setRequestEmail] = useState('');
  const [requestName, setRequestName] = useState('');

  const handleRequestAccess = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setToast({ message: 'Zukunft geplant.', id: Date.now() });
  };

  const [toast, setToast] = useState<{ message: string, id: number } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [navCategory, setNavCategory] = useState<'all' | 'ubersicht' | 'kader' | 'training' | 'match' | 'orga'>('ubersicht');
  const [viewMode, setViewMode] = useState<'focus' | 'pro'>(() => {
    try {
      const saved = localStorage.getItem('fca_view_mode');
      return (saved === 'pro' || saved === 'focus') ? saved : 'focus';
    } catch {
      return 'focus';
    }
  });

  const handleToggleViewMode = (mode?: 'focus' | 'pro') => {
    const nextMode = mode || (viewMode === 'focus' ? 'pro' : 'focus');
    setViewMode(nextMode);
    try {
      localStorage.setItem('fca_view_mode', nextMode);
    } catch (e) {
      console.error(e);
    }
    setToast({
      message: nextMode === 'focus'
        ? '⚡ Kompakter Alltags-Modus aktiviert (6 Kernbereiche). Mit 1 Klick rückgängig machbar!'
        : '🏆 Vollständiger Profi-Modus aktiviert (alle 28 Module & Kategorien sichtbar).',
      id: Date.now()
    });
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerProfileTab, setPlayerProfileTab] = useState<'basis' | 'finanzen' | 'notizen'>('basis');
  const [editingPlayer, setEditingPlayer] = useState<Spieler | null>(null);
  const [modalCategory, setModalCategory] = useState<'player' | 'coach' | 'staff' | 'medical'>('player');
  const [showKaderAgentModal, setShowKaderAgentModal] = useState(false);
  const [show3DProfiBoardModal, setShow3DProfiBoardModal] = useState(false);
  const [showAgentControlCenterModal, setShowAgentControlCenterModal] = useState(false);
  const [kaderAgentPreset, setKaderAgentPreset] = useState<'beste_formation' | 'topform_startelf' | 'vollbild_ordnung' | 'laufwege_profi'>('beste_formation');

  const { data: players, loading: loadingSpieler, addOrUpdateItem: saveSpieler, removeItem: deleteSpieler } = useCollectionSync<Spieler>('spieler', 'id', undefined, 'asc', true);
  const { data: training, loading: loadingTraining, addOrUpdateItem: saveTraining, removeItem: deleteTraining } = useCollectionSync<Training>('training', 'id', undefined, 'asc', true);
  const { data: spiele, loading: loadingSpiele, addOrUpdateItem: saveSpiel, removeItem: deleteSpiel } = useCollectionSync<Spiel>('spiele', 'id', undefined, 'asc', true);
  const { data: budgetFinanz, loading: loadingFinanz, addOrUpdateItem: saveFinanz, removeItem: deleteFinanz } = useCollectionSync<Finanz>('budget_finanz', 'id', undefined, 'asc', true);

  // Additional collections for full functionality
  const { data: attendance, loading: loadingAttendance, addOrUpdateItem: saveAttendance, removeItem: deleteAttendance } = useCollectionSync<any>('attendance', 'playerId', undefined, 'asc', true);
  const { data: yearlyPlan, loading: loadingYearly, addOrUpdateItem: saveYearlyPlan, removeItem: deleteYearlyPlan } = useCollectionSync<any>('yearly_plan', 'date', 'date', 'asc', true);
  const yearlyPlanRef = useRef(yearlyPlan);
  useEffect(() => {
    yearlyPlanRef.current = yearlyPlan;
  }, [yearlyPlan]);
  const { data: cardRecords, loading: loadingCards, addOrUpdateItem: saveCardRecord, removeItem: deleteCardRecord } = useCollectionSync<any>('card_records', 'playerId', undefined, 'asc', true);
  const { data: scoutingCandidates, loading: loadingScouting, addOrUpdateItem: saveScoutingCandidate, removeItem: deleteScoutingCandidate } = useCollectionSync<any>('scouting_candidates', 'id', 'createdAt', 'desc', true);
  const { data: depthChart, loading: loadingDepthChart, addOrUpdateItem: saveDepthChart } = useCollectionSync<any>('depth_chart', 'id', undefined, 'asc', true);
  const { data: financeMeta, loading: loadingFinanceMeta, addOrUpdateItem: saveFinanceMeta } = useCollectionSync<any>('finance_meta', 'id', undefined, 'asc', true);
  const { data: meetingsData, loading: loadingMeetings, addOrUpdateItem: saveMeetingEntry, removeItem: deleteMeetingEntry } = useCollectionSync<any>('meetings_data', 'id', 'date', 'desc', true);
  const { data: trainingSessions, loading: loadingSessions, addOrUpdateItem: saveTrainingSession, removeItem: deleteTrainingSession } = useCollectionSync<any>('training_sessions', 'id', undefined, 'asc', true);
  const { data: individualTrainingData, loading: loadingIndividual, addOrUpdateItem: saveIndividualTraining, removeItem: removeIndividualTraining } = useCollectionSync<any>('individual_training', 'id', undefined, 'asc', true);
  const { data: runRecords, loading: loadingRuns, addOrUpdateItem: saveRunRecord, removeItem: deleteRunRecord } = useCollectionSync<any>('run_records', 'id', undefined, 'asc', true);
  const { data: runMeta, loading: loadingRunMeta, addOrUpdateItem: saveRunMeta } = useCollectionSync<any>('run_meta', 'id', undefined, 'asc', true);
  const { data: physioEntries, loading: loadingPhysio, addOrUpdateItem: savePhysioEntry, removeItem: deletePhysioEntry } = useCollectionSync<any>('physio_entries', 'id', 'date', 'desc', true);
  const { data: formation, loading: loadingFormation, addOrUpdateItem: saveFormation } = useCollectionSync<any>('formation', 'id', undefined, 'asc', true);
  const { data: vorbereitungSommer, loading: loadingSommer, addOrUpdateItem: saveVorbereitungSommer, removeItem: removeVorbereitungSommer } = useCollectionSync<any>('vorbereitung_sommer', 'id', undefined, 'asc', true);
  const { data: vorbereitungWinter, loading: loadingWinter, addOrUpdateItem: saveVorbereitungWinter, removeItem: removeVorbereitungWinter } = useCollectionSync<any>('vorbereitung_winter', 'id', undefined, 'asc', true);
  const { data: winterPrepConfig, loading: loadingWinterConfig, addOrUpdateItem: saveWinterConfig } = useCollectionSync<any>('winter_prep_config', 'id', undefined, 'asc', true);
  const { data: matchAnalyses, loading: loadingAnalyses, addOrUpdateItem: saveMatchAnalysis, removeItem: deleteMatchAnalysis } = useCollectionSync<any>('match_analyses', 'id', undefined, 'asc', true);
  const { data: academyEvaluations, loading: loadingAcademyEvals, addOrUpdateItem: saveAcademyEvaluation, removeItem: deleteAcademyEvaluation } = useCollectionSync<any>('academy_evaluations', 'id', 'createdAt', 'desc', true);
  const { data: academyWeeklyReports, loading: loadingAcademyReports, addOrUpdateItem: saveAcademyWeeklyReport, removeItem: deleteAcademyWeeklyReport } = useCollectionSync<any>('academy_weekly_reports', 'id', 'createdAt', 'desc', true);
  const { data: trackerAcademyReports, loading: loadingTrackerReports, addOrUpdateItem: saveTrackerAcademyReport, removeItem: deleteTrackerAcademyReport } = useCollectionSync<any>('tracker_academy_reports', 'id', 'createdAt', 'desc', true);

  const { data: competitiveMatches, loading: loadingCompMatches, addOrUpdateItem: originalSaveCompMatch, removeItem: originalDeleteCompMatch } = useCollectionSync<any>('competitive_matches', 'id', 'date', 'asc', true);

  const saveCompMatch = useCallback(async (match: any) => {
    // Get the previous date if match already exists
    const existingMatch = competitiveMatches.find((m: any) => m.id === match.id);
    const oldDate = existingMatch?.date;

    await originalSaveCompMatch(match);

    // If date changed, clean up old date in yearly_plan
    if (oldDate && oldDate !== match.date && !isQuotaExceededActive() && navigator.onLine) {
      try {
        const oldDocRef = doc(db, 'yearly_plan', oldDate);
        await deleteDoc(oldDocRef);
      } catch (err) {
        if (isQuotaError(err)) markQuotaExceeded();
        console.error('Error removing old yearly_plan entry:', err);
      }
    }

    // Automatically sync to yearly_plan
    if (match.date && !isQuotaExceededActive() && navigator.onLine) {
      try {
        const docRef = doc(db, 'yearly_plan', match.date);
        await setDoc(docRef, cleanFirestoreData({
          date: match.date,
          type: 'Pflichtspiel',
          opponent: match.opponent || '',
          activity: `Pflichtspiel vs ${match.opponent || ''}`,
          time: match.kickOff || '15:30',
          location: match.location || '',
          treffpunkt: match.meetingTime || '',
          ergebnis: match.result || ''
        }), { merge: true });
      } catch (err) {
        if (isQuotaError(err)) markQuotaExceeded();
        console.error('Error auto-syncing match to yearly_plan:', err);
      }
    }
  }, [originalSaveCompMatch, competitiveMatches]);

  const deleteCompMatch = useCallback(async (id: string | number) => {
    const match = competitiveMatches.find((m: any) => m.id === id);
    await originalDeleteCompMatch(id);

    // Automatically remove from yearly_plan
    if (match && match.date && !isQuotaExceededActive() && navigator.onLine) {
      try {
        const docRef = doc(db, 'yearly_plan', match.date);
        await deleteDoc(docRef);
      } catch (err) {
        if (isQuotaError(err)) markQuotaExceeded();
        console.error('Error removing match from yearly_plan:', err);
      }
    }
  }, [originalDeleteCompMatch, competitiveMatches]);

  const { data: competitiveMinutes, loading: loadingCompMinutes, addOrUpdateItem: saveCompMinutes, removeItem: deleteCompMinutes } = useCollectionSync<any>('competitive_minutes', 'playerId', undefined, 'asc', true);

  const handleWipeAllCompetitiveMatches = useCallback(async () => {
    try {
      setToast({ message: 'Pflichtspiele werden gelöscht...', id: Date.now() });

      // 1. Delete all competitive matches
      for (const m of competitiveMatches) {
        await originalDeleteCompMatch(m.id);
        
        // Delete related yearly_plan entry if any
        if (m.date && !isQuotaExceededActive() && navigator.onLine) {
          try {
            const docRef = doc(db, 'yearly_plan', m.date);
            await deleteDoc(docRef);
          } catch (err) {
            if (isQuotaError(err)) markQuotaExceeded();
            console.warn(`Could not delete yearly_plan for date ${m.date}:`, err);
          }
        }
      }

      // 2. Also check yearlyPlan for any entries with type === 'Pflichtspiel' and delete them
      for (const entry of yearlyPlan) {
        if (entry.type === 'Pflichtspiel') {
          try {
            if (entry.date) {
              await deleteYearlyPlan(entry.date);
            }
          } catch (err) {
            console.warn(`Could not delete yearly_plan entry ${entry.date}:`, err);
          }
        }
      }

      // 3. Clear all player minutes/stats for competitive matches (competitive_minutes)
      for (const rec of competitiveMinutes) {
        try {
          await deleteCompMinutes(rec.playerId);
        } catch (err) {
          console.warn(`Could not delete competitive minutes for player ${rec.playerId}:`, err);
        }
      }

      setToast({ message: 'Erfolgreich alles gelöscht!', id: Date.now() });
    } catch (e) {
      console.error('Error wiping all competitive matches:', e);
      setToast({ message: 'Fehler beim Löschen!', id: Date.now() });
    }
  }, [competitiveMatches, originalDeleteCompMatch, yearlyPlan, deleteYearlyPlan, competitiveMinutes, deleteCompMinutes]);

  const handleRestoreCompetitiveMatches = useCallback(async () => {
    try {
      setToast({ message: '32 Pflichtspiele werden wiederhergestellt...', id: Date.now() });
      if (COMPETITIVE_MATCHES && COMPETITIVE_MATCHES.length > 0) {
        for (const m of COMPETITIVE_MATCHES) {
          await saveCompMatch(m as any);
        }
      }
      setToast({ message: '32 Pflichtspiele erfolgreich wiederhergestellt!', id: Date.now() });
    } catch (e) {
      console.error('Error restoring competitive matches:', e);
      setToast({ message: 'Fehler beim Wiederherstellen der Pflichtspiele!', id: Date.now() });
    }
  }, [saveCompMatch]);
  const { data: testMatches, loading: loadingTestMatches, addOrUpdateItem: saveTestMatch, removeItem: deleteTestMatch } = useCollectionSync<any>('test_matches', 'id', 'date', 'asc', true);
  const { data: testMinutes, loading: loadingTestMinutes, addOrUpdateItem: saveTestMinutes, removeItem: deleteTestMinutes } = useCollectionSync<any>('test_minutes', 'playerId', undefined, 'asc', true);
  const { data: u23Matches, loading: loadingU23Matches, addOrUpdateItem: saveU23Match, removeItem: deleteU23Match } = useCollectionSync<any>('u23_matches', 'id', 'date', 'asc', true);
  const { data: u23Minutes, loading: loadingU23Minutes, addOrUpdateItem: saveU23Minutes, removeItem: deleteU23Minutes } = useCollectionSync<any>('u23_minutes', 'playerId', undefined, 'asc', true);
  const { data: opponents, loading: loadingOpponents, addOrUpdateItem: saveOpponent, removeItem: deleteOpponent } = useCollectionSync<any>('opponents', 'id', 'name', 'asc', true);
  const { data: playerSessionLogs, loading: loadingSessionLogs, addOrUpdateItem: savePlayerSessionLog, removeItem: deletePlayerSessionLog } = useCollectionSync<any>('player_session_logs', 'id', undefined, 'asc', true);

  const isLoading = loadingSpieler || loadingTraining || loadingSpiele || loadingFinanz ||
                    loadingAttendance || loadingCompMatches || loadingCompMinutes || loadingYearly ||
                    loadingCards || loadingScouting || loadingDepthChart || loadingFinanceMeta || loadingMeetings || loadingSessions ||
                    loadingIndividual || loadingRuns || loadingRunMeta || loadingPhysio || loadingFormation || loadingWinterConfig ||
                    loadingSommer || loadingWinter || loadingOpponents || loadingTestMatches || loadingTestMinutes || loadingU23Matches || loadingU23Minutes || loadingAnalyses ||
                    loadingSessionLogs;

  const CLIENT_VERSION = "2026-07-07_12-30";
  useEffect(() => {
    if (navigator.onLine) {
      fetch(`/api/version?cb=${Date.now()}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.version && data.version !== CLIENT_VERSION) {
            console.log(`New app version detected on server: ${data.version} (current client is ${CLIENT_VERSION}). Auto-refreshing...`);
            const lastReload = sessionStorage.getItem('fca_last_auto_reload');
            const now = Date.now();
            if (!lastReload || now - parseInt(lastReload) > 10000) {
              sessionStorage.setItem('fca_last_auto_reload', String(now));
              setToast({ message: "Neue App-Version geladen. Aktualisiere...", id: Date.now() });
              setTimeout(() => {
                window.location.reload();
              }, 1200);
            }
          }
        })
        .catch(err => console.warn("Failed to check app version from server:", err));
    }
  }, []);

  // Sync Summer Prep to Yearly Plan
  const handleSaveVorbereitungSommer = async (item: any) => {
    await saveVorbereitungSommer(item);
    
    // Sync to yearly plan
    const dayPlan = {
      date: item.date,
      type: item.type || 'Training',
      activity: item.content || item.inhalt || '',
      time: item.time || item.start || '',
      location: item.location || item.ort || '',
      treffpunkt: item.treffpunkt || '',
      opponent: item.opponent || item.gegner || '',
      ergebnis: item.ergebnis || '',
      phase: 'summer',
      athletik: item.athletik || { start: '', end: '', notes: '' },
      vormittag: item.vormittag || { start: '', end: '', notes: '' },
      individual: item.individual || { start: '', end: '', notes: '' },
      video: item.video || { start: '', end: '', notes: '' },
      training: item.training || { start: '', end: '', notes: '' },
      te: item.te || 0,
      kw: item.kw || 0,
      notes: item.notes || ''
    };
    
    const existing = yearlyPlan.find((p: any) => p.date === item.date);
    const hasChanged = !existing || 
      existing.type !== dayPlan.type || 
      existing.activity !== dayPlan.activity ||
      existing.time !== dayPlan.time ||
      existing.location !== dayPlan.location ||
      existing.opponent !== dayPlan.opponent;

    if (hasChanged) {
      await saveYearlyPlan(dayPlan);
    }
  };

  // Sync Test Matches to Yearly Plan
  useEffect(() => {
    if (!isLoading && testMatches.length > 0) {
      const syncTests = async () => {
        const currentYearlyPlan = yearlyPlanRef.current;
        for (const m of testMatches) {
          if (!m.date) continue;
          const existing = currentYearlyPlan.find((p: any) => p.date === m.date);
          const shouldSync = !existing || (
            (existing.type || '') !== 'Testspiel' ||
            (existing.opponent || '') !== (m.opponent || '') ||
            (existing.time || '') !== (m.kickOff || '')
          );

          if (shouldSync) {
            await saveYearlyPlan({
              date: m.date,
              type: 'Testspiel',
              activity: `Testspiel vs ${m.opponent}`,
              time: m.kickOff || '',
              location: m.location || '',
              opponent: m.opponent || '',
              ergebnis: m.result || '',
              phase: (new Date(m.date) >= new Date('2026-07-06') && new Date(m.date) <= new Date('2026-08-15')) ? 'summer' : 'season'
            });
          }
        }
      };
      void syncTests();
    }
  }, [isLoading, testMatches]);

  // Sync Competitive Matches to Yearly Plan
  useEffect(() => {
    if (!isLoading && competitiveMatches.length > 0) {
      const syncComp = async () => {
        const currentYearlyPlan = yearlyPlanRef.current;
        for (const m of competitiveMatches) {
          if (!m.date) continue;
          const existing = currentYearlyPlan.find((p: any) => p.date === m.date);
          const shouldSync = !existing || (
            (existing.type || '') !== 'Pflichtspiel' ||
            (existing.opponent || '') !== (m.opponent || '') ||
            (existing.time || '') !== (m.kickOff || '')
          );

          if (shouldSync) {
            await saveYearlyPlan({
              date: m.date,
              type: 'Pflichtspiel',
              activity: `Pflichtspiel vs ${m.opponent}`,
              time: m.kickOff || '',
              location: m.location || '',
              opponent: m.opponent || '',
              ergebnis: m.result || '',
              phase: (new Date(m.date) >= new Date('2026-07-06') && new Date(m.date) <= new Date('2026-08-15')) ? 'summer' : 'season'
            });
          }
        }
      };
      void syncComp();
    } else if (!isLoading && competitiveMatches.length === 0 && COMPETITIVE_MATCHES && COMPETITIVE_MATCHES.length > 0) {
      console.log('Competitive matches empty, auto-restoring default competitive matches...');
      void handleRestoreCompetitiveMatches();
    }
  }, [isLoading, competitiveMatches, handleRestoreCompetitiveMatches]);

  // Ensure Salem match is synced to competitiveMatches & yearlyPlan
  useEffect(() => {
    if (!isLoading && competitiveMatches.length > 0) {
      const salemExists = competitiveMatches.some((m: any) => 
        (m.opponent || '').toLowerCase().includes('salem') || String(m.id) === '33'
      );
      if (!salemExists) {
        const salemMatch = COMPETITIVE_MATCHES.find((m: any) => 
          (m.opponent || '').toLowerCase().includes('salem')
        );
        if (salemMatch) {
          console.log('Synchronisiere Pflichtspiel RW Salem (1:2 Sieg) in competitiveMatches...');
          void saveCompMatch(salemMatch);
        }
      }
    }
  }, [isLoading, competitiveMatches, saveCompMatch]);

  const handleRemoveVorbereitungSommer = async (id: string) => {
    const item = vorbereitungSommer.find((u: any) => u.id === id);
    await removeVorbereitungSommer(id);
    if (item) {
      const existing = yearlyPlanRef.current.find((p: any) => p.date === item.date);
      if (existing && existing.phase === 'summer') {
        await saveYearlyPlan({ ...existing, type: 'Frei', activity: '', time: '', location: '' });
      }
    }
  };

  useEffect(() => {
    if (!isLoading && vorbereitungSommer.length > 0) {
      const syncAll = async () => {
        const currentYearlyPlan = yearlyPlanRef.current;
        const updates: DayPlan[] = [];
        for (const item of vorbereitungSommer) {
          if (!item.date) continue;
          const existing = currentYearlyPlan.find((p: any) => p.date === item.date);
          
          const shouldSync = !existing || (
            existing.phase === 'summer' && (
              (existing.type || 'Training') !== (item.type || 'Training') ||
              (existing.activity || '') !== (item.content || item.inhalt || '') ||
              (existing.time || '') !== (item.time || item.start || '') ||
              (existing.location || '') !== (item.location || item.ort || '') ||
              (existing.opponent || '') !== (item.opponent || item.gegner || '')
            )
          );

          if (shouldSync) {
            updates.push({
              date: item.date,
              type: item.type || 'Training',
              activity: item.content || item.inhalt || '',
              time: item.time || item.start || '',
              location: item.location || item.ort || '',
              treffpunkt: item.treffpunkt || '',
              opponent: item.opponent || item.gegner || '',
              ergebnis: item.ergebnis || '',
              phase: 'summer',
              athletik: item.athletik || { start: '', end: '', notes: '' },
              vormittag: item.vormittag || { start: '', end: '', notes: '' },
              individual: item.individual || { start: '', end: '', notes: '' },
              video: item.video || { start: '', end: '', notes: '' },
              training: item.training || { start: '', end: '', notes: '' },
              te: item.te || 0,
              kw: item.kw || 0,
              notes: item.notes || ''
            });
          }
        }
        
        if (updates.length > 0) {
          console.log(`[Sync] Syncing ${updates.length} summer preparation days to yearly plan...`);
          for (const update of updates) {
            await saveYearlyPlan(update);
          }
        }
      };
      
      const timeoutId = setTimeout(() => {
        void syncAll();
      }, 1000); // Debounce sync to avoid hanging on rapid changes
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, vorbereitungSommer]);

  const playersWithMinutes = useMemo(() => {
    return players.map(player => {
      const compRecord = competitiveMinutes.find((r: any) => r.playerId === player.id);
      const compTotal = (compRecord?.minutes ? Object.values(compRecord.minutes).reduce((acc: number, curr: any) => acc + (Number(curr) || 0), 0) : 0) as number;
      
      const testRecord = testMinutes.find((r: any) => r.playerId === player.id);
      const testTotal = (testRecord?.minutes ? Object.values(testRecord.minutes).reduce((acc: number, curr: any) => acc + (Number(curr) || 0), 0) : 0) as number;

      return {
        ...player,
        einsatzzeitenGesamt: compTotal,
        testEinsatzzeitenGesamt: testTotal
      };
    });
  }, [players, competitiveMinutes, testMinutes]);

  const sortedPlayers = useMemo(() => sortPlayers(playersWithMinutes), [playersWithMinutes]);

  useEffect(() => {
    const handleStateChange = (e: any) => {
      const key = e.detail.key;

      const tabName = KEY_TO_TAB[key] || 'Daten';
      const timeStr = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

      setToast({
        message: `Änderung gespeichert: ${tabName} (${dateStr}, ${timeStr} Uhr)`,
        id: Date.now()
      });
    };

    window.addEventListener('fca_state_changed', handleStateChange);

    // Clean up and optimize localStorage space on startup
    try {
      const legacyKeys = [
        'players', 'training', 'spiele', 'financeData', 'attendance', 
        'competitiveMatches', 'competitiveMinutes', 'testMatches', 'testMinutes', 
        'cardRecords', 'scoutingCandidates', 'meetingsData', 'trainingSessions', 
        'individualTrainingData', 'runRecords', 'physioEntries', 'summerPrep', 'winterPrep',
        'yearlyPlan'
      ];
      let clearedCount = 0;
      let clearedBytes = 0;
      
      for (const key of legacyKeys) {
        const fullKey = `fca_${key}`;
        const val = localStorage.getItem(fullKey);
        if (val !== null) {
          clearedCount++;
          clearedBytes += val.length * 2; // Approximate byte size for UTF-16
          localStorage.removeItem(fullKey);
        }
      }
      
      if (clearedCount > 0) {
        console.log(`[Storage Optimization] Cleaned up ${clearedCount} redundant legacy keys, freeing approx. ${(clearedBytes / 1024).toFixed(1)} KB.`);
      }
    } catch (e) {
      console.warn('Error during localStorage optimization:', e);
    }

    return () => {
      window.removeEventListener('fca_state_changed', handleStateChange);
    };
  }, []);

  useEffect(() => {
    if (!isLoading && players.length === 0 && !localStorage.getItem('fca_bootstrapped')) {
      void bootstrapData(true);
      try {
        localStorage.setItem('fca_bootstrapped', 'true');
      } catch (e) {
        console.warn('Failed to save fca_bootstrapped in localStorage', e);
      }
    }
  }, [isLoading, players.length]);

  useEffect(() => {
    if (!isLoading && scoutingCandidates.length === 0 && !localStorage.getItem('fca_scouting_bootstrapped')) {
      const seedScouting = async () => {
        if (INITIAL_SCOUTING && INITIAL_SCOUTING.length > 0) {
          for (let i = 0; i < INITIAL_SCOUTING.length; i++) {
            const c = INITIAL_SCOUTING[i];
            await saveScoutingCandidate({ ...c, createdAt: Date.now() + i } as any);
          }
        }
        try {
          localStorage.setItem('fca_scouting_bootstrapped', 'true');
        } catch (e) {
          console.warn('Failed to save fca_scouting_bootstrapped in localStorage', e);
        }
      };
      void seedScouting();
    }
  }, [isLoading, scoutingCandidates.length, INITIAL_SCOUTING, saveScoutingCandidate]);

  useEffect(() => {
    if (!isLoading && !localStorage.getItem('fca_meetings_bootstrapped_v4')) {
      const seedMeetings = async () => {
        if (meetingsData.length === 0) {
          if (INITIAL_MEETINGS_DATA && INITIAL_MEETINGS_DATA.length > 0) {
            for (const m of INITIAL_MEETINGS_DATA) {
              await saveMeetingEntry({ ...m, date: normalizeDate(m.date) } as any);
            }
          }
        } else {
          // Migration: add missing meetings from INITIAL_MEETINGS_DATA
          for (const m of INITIAL_MEETINGS_DATA) {
            const normalizedDateStr = normalizeDate(m.date);
            const exists = meetingsData.some((existing: any) => 
              existing.playerName === m.playerName && 
              existing.date === normalizedDateStr && 
              (existing as any).time === (m as any).time
            );
            if (!exists) {
              await saveMeetingEntry({ ...m, date: normalizedDateStr } as any);
            }
          }
        }
        try {
          localStorage.setItem('fca_meetings_bootstrapped_v4', 'true');
        } catch (e) {
          console.warn('Failed to save fca_meetings_bootstrapped_v4 in localStorage', e);
        }
      };
      void seedMeetings();
    }
  }, [isLoading, meetingsData.length, INITIAL_MEETINGS_DATA, saveMeetingEntry]);

  useEffect(() => {
    if (!isLoading && !localStorage.getItem('fca_comp_matches_absolute_wipe_v4')) {
      const wipeCompMatches = async () => {
        try {
          // Set flags first to prevent any multiple runs
          localStorage.setItem('fca_comp_matches_bootstrapped', 'true');
          localStorage.setItem('fca_comp_matches_wiped_v2', 'true');
          localStorage.setItem('fca_comp_matches_absolute_wipe_v4', 'true');
          
          console.log("Unconditional on-load wipe of competitive matches requested by user...");
          await handleWipeAllCompetitiveMatches();
          console.log("Automated wipe completed.");
        } catch (e) {
          console.error("Error wiping competitive matches on load:", e);
        }
      };
      void wipeCompMatches();
    }
  }, [isLoading, handleWipeAllCompetitiveMatches]);

  const bootstrappingRef = React.useRef(false);

  useEffect(() => {
    if (!isLoading && !localStorage.getItem('fca_test_matches_bootstrapped_v4') && !bootstrappingRef.current) {
      const bootstrapTestMatches = async () => {
        if (TEST_MATCHES && TEST_MATCHES.length > 0) {
          bootstrappingRef.current = true;
          try {
            // First set the flag to prevent other instances from starting
            try {
              localStorage.setItem('fca_test_matches_bootstrapped_v4', 'true');
            } catch (e) {
              console.warn('Failed to save fca_test_matches_bootstrapped_v4 in localStorage', e);
            }
            
            // Clean up old IDs if they exist in the current state
            const idsToDelete = [1, 2, '1', '2'];
            for (const id of idsToDelete) {
              const exists = testMatches.find(m => m.id === id);
              if (exists) {
                await deleteTestMatch(id);
              }
            }
            
            // Save the predefined test matches
            for (const m of TEST_MATCHES) {
              await saveTestMatch(m);
            }
            
            try {
              localStorage.setItem('fca_test_matches_bootstrapped', 'true');
            } catch (e) {
              console.warn('Failed to save fca_test_matches_bootstrapped in localStorage', e);
            }
          } catch (error) {
            console.error("Bootstrapping failed:", error);
            // Optionally remove the key so it tries again next time
            try {
              localStorage.removeItem('fca_test_matches_bootstrapped_v4');
            } catch (e) {}
            bootstrappingRef.current = false;
          }
        }
      };
      void bootstrapTestMatches();
    }
  }, [isLoading, testMatches, saveTestMatch, deleteTestMatch]);

  useEffect(() => {
    if (!isLoading && vorbereitungSommer.length > 0 && !localStorage.getItem('fca_summer_fix_1907')) {
      const fixDate = async () => {
        const targetDate = "2026-07-19";
        const exists = vorbereitungSommer.some((d: any) => d.date === targetDate);
        if (!exists) {
          const date = new Date(targetDate);
          const start = new Date("2026-07-06");
          const kw = Math.ceil((date.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
          await saveVorbereitungSommer({
            id: `fix-${targetDate}-${Date.now()}`,
            kw,
            te: vorbereitungSommer.length + 1,
            date: targetDate,
            day: "So",
            start: "19:00",
            end: "20:30",
            time: "19:00",
            type: "Frei",
            content: "Frei",
            intensity: "Niedrig",
            location: "Auggen",
            opponent: "",
            ergebnis: "",
            status: "Geplant",
            notes: ""
          });
        }
        try {
          localStorage.setItem('fca_summer_fix_1907', 'true');
        } catch (e) {
          console.warn('Failed to save fca_summer_fix_1907 in localStorage', e);
        }
      };
      void fixDate();
    }
  }, [isLoading, vorbereitungSommer, saveVorbereitungSommer]);

  // Player minutes are computed dynamically in playersWithMinutes to prevent infinite write loops and save Firebase quotas.

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [activeDetailTab, setActiveDetailTab] = useState<'analysis' | 'notes'>('analysis');
  const [isEditing, setIsEditing] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);

  useEffect(() => {
    if (showAddPlayerModal) {
      setModalCategory(editingPlayer?.category || 'player');
    }
  }, [showAddPlayerModal, editingPlayer]);
  const [showRemovePlayerModal, setShowRemovePlayerModal] = useState(false);
  const [showAddTrainingModal, setShowAddTrainingModal] = useState(false);
  const [showAddFinanzModal, setShowAddFinanzModal] = useState(false);
  const [showAddSpielModal, setShowAddSpielModal] = useState(false);
  const [showAddVorbereitungModal, setShowAddVorbereitungModal] = useState(false);
  const [showAddScoutingModal, setShowAddScoutingModal] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(new Date('2026-07-01'));
  const [scoutingViewMode, setScoutingViewMode] = useState<'table' | 'field' | 'grid' | 'depth' | 'calendar' | 'timeline'>('table');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [tacticInstructions, setTacticInstructions] = useSyncedState<string>('tacticInstructions', '', true);
  const [selectedIndividualDate, setSelectedIndividualDate] = useState(new Date().toISOString().split('T')[0]);

  const [showRemoveScoutingModal, setShowRemoveScoutingModal] = useState(false);
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
  const [selectedMeetingPlayer, setSelectedMeetingPlayer] = useState<string>('');
  const [showAddPhysioModal, setShowAddPhysioModal] = useState(false);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  const [isDevUnlocked, setIsDevUnlocked] = useState(false);
  const [devPassword, setDevPassword] = useState('');

  const handleResetScouting = async () => {
    // Removed window.confirm
    
    setToast({ message: 'Scouting-Daten werden wiederhergestellt...', id: Date.now() });
    try {
      // Delete existing
      for (const c of scoutingCandidates) {
        await deleteScoutingCandidate(c.id);
      }
      // Add initial
      if (INITIAL_SCOUTING && INITIAL_SCOUTING.length > 0) {
        for (let i = 0; i < INITIAL_SCOUTING.length; i++) {
          const c = INITIAL_SCOUTING[i];
          await saveScoutingCandidate({ ...c, createdAt: Date.now() + i } as any);
        }
      }
      setToast({ message: 'Scouting-Daten erfolgreich wiederhergestellt.', id: Date.now() });
    } catch (err) {
      console.error('Error resetting scouting data:', err);
    }
  };

  const handleResetMeetings = async () => {
    setToast({ message: 'Termine werden zurückgesetzt...', id: Date.now() });
    try {
      for (const m of meetingsData) {
        await deleteMeetingEntry(m.id);
      }
      setToast({ message: 'Termine wurden geleert.', id: Date.now() });
    } catch (err) {
      console.error('Error resetting meetings:', err);
    }
  };

  const handleImportMeetings = async () => {
    setToast({ message: 'Standard-Termine werden importiert...', id: Date.now() });
    try {
      if (INITIAL_MEETINGS_DATA && INITIAL_MEETINGS_DATA.length > 0) {
        for (const m of INITIAL_MEETINGS_DATA) {
          await saveMeetingEntry({ ...m, id: Date.now().toString() + Math.random() });
        }
      }
      setToast({ message: 'Standard-Termine erfolgreich importiert.', id: Date.now() });
    } catch (err) {
      console.error('Error importing meetings:', err);
    }
  };

  const handleEdit = () => {
    setIsEditing(!isEditing);
    const tabLabel = TABS.find(t => t.id === activeTab)?.label || activeTab;
    setToast({ message: `Bearbeitungsmodus für ${tabLabel} ${!isEditing ? 'aktiviert' : 'deaktiviert'}.`, id: Date.now() });
  };

  const handleManualSave = () => {
    setSaveStatus('saving');
    // Most data is autosaved via useCollectionSync and useSyncedState.
    // This button provides a manually triggered status check and visual feedback.
    setTimeout(() => {
      setSaveStatus('success');
      setToast({ message: 'Alle Änderungen in allen Bereichen wurden erfolgreich in der Cloud gespeichert.', id: Date.now() });
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
  };

  const handleReset = () => {
    setToast({ message: 'Reset-Funktion ist im Cloud-Modus deaktiviert.', id: Date.now() });
  };

  const deduplicatePlayers = useCallback(async () => {
    if (players.length < 2) return;

    const seen = new Map<string, Spieler>();
    const duplicates: { keep: Spieler, remove: Spieler }[] = [];

    players.forEach(p => {
      const key = `${(p.firstName || '').trim().toLowerCase()}_${(p.lastName || '').trim().toLowerCase()}`;
      if (seen.has(key)) {
        duplicates.push({ keep: seen.get(key)!, remove: p });
      } else {
        seen.set(key, p);
      }
    });

    if (duplicates.length === 0) return;

    setToast({ message: `${duplicates.length} Duplikate gefunden. Bereinigung läuft...`, id: Date.now() });

    for (const { keep, remove } of duplicates) {
      // 1. Merge data into 'keep'
      const mergedPlayer: Spieler = {
        ...remove,
        ...keep,
        notizen: keep.notizen || remove.notizen || '',
        status: keep.status || remove.status || 'Aktiv',
        geburtsdatum: keep.geburtsdatum || remove.geburtsdatum || '',
        wochentag: keep.wochentag || remove.wochentag || '',
        position: keep.position || remove.position || '',
        category: keep.category || remove.category || 'player',
        finance: {
          baseSalary: 0,
          bonusPerMatch: 0,
          ist: 0,
          ...(remove.finance || {}),
          ...(keep.finance || {})
        },
        physical: { ...(remove.physical || {}), ...(keep.physical || {}) },
        analysis: { ...(remove.analysis || {}), ...(keep.analysis || {}) },
        diagnostics: { ...(remove.diagnostics || {}), ...(keep.diagnostics || {}) },
      };

      await saveSpieler(mergedPlayer);

      // 2. Update references in all collections
      const collectionsToUpdate = [
        { data: attendance, save: saveAttendance, field: 'playerId' },
        { data: cardRecords, save: saveCardRecord, field: 'playerId' },
        { data: individualTrainingData, save: saveIndividualTraining, field: 'playerId' },
        { data: runRecords, save: saveRunRecord, field: 'playerId' },
        { data: physioEntries, save: savePhysioEntry, field: 'playerId' },
      ];

      for (const { data, save, field } of collectionsToUpdate) {
        const itemsToUpdate = data.filter((item: any) => item[field] === remove.id);
        for (const item of itemsToUpdate) {
          await save({ ...item, [field]: keep.id });
        }
      }

      // 3. Delete 'remove'
      await deleteSpieler(remove.id);
    }

    setToast({ message: 'Datenbereinigung abgeschlossen.', id: Date.now() });
  }, [players, attendance, cardRecords, individualTrainingData, runRecords, physioEntries, saveSpieler, deleteSpieler, saveAttendance, saveCardRecord, saveIndividualTraining, saveRunRecord, savePhysioEntry]);

  useEffect(() => {
    if (!isLoading && players.length > 0) {
      const timer = setTimeout(() => {
        const seen = new Set<string>();
        let hasDuplicates = false;
        players.forEach(p => {
          const key = `${(p.firstName || '').trim().toLowerCase()}_${(p.lastName || '').trim().toLowerCase()}`;
          if (seen.has(key)) hasDuplicates = true;
          seen.add(key);
        });
        if (hasDuplicates) {
          void deduplicatePlayers();
        }
      }, 5000); // Wait 5s before checking for duplicates automatically
      return () => clearTimeout(timer);
    }
  }, [isLoading, players, deduplicatePlayers]);
  const handleDeleteItem = async (collection: string, id: string, label: string = 'Eintrag') => {
    try {
      if (collection === 'spieler') await deleteSpieler(id);
      else if (collection === 'training') await deleteTraining(id);
      else if (collection === 'spiele') await deleteSpiel(id);
      else if (collection === 'budget_finanz') await deleteFinanz(id);
      else if (collection === 'scouting_candidates') await deleteScoutingCandidate(id);
      else if (collection === 'training_sessions') await deleteTrainingSession(id);
      else if (collection === 'meetings_data') await deleteMeetingEntry(id);
      else if (collection === 'competitive_matches') await deleteCompMatch(id);
      else if (collection === 'physio_entries') await deletePhysioEntry(id);
      else if (collection === 'match_analyses') await deleteMatchAnalysis(id);
      
      setToast({ message: `${label} erfolgreich gelöscht.`, id: Date.now() });
      
      if (collection === 'spieler' && selectedPlayerId === id) {
        setSelectedPlayerId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collection}/${id}`);
    }
  };

  const allProfiles = sortedPlayers.map(p => ({ ...p, isScout: false }));

  useEffect(() => {
    if (selectedPlayerId && allProfiles.length > 0 && !allProfiles.find(p => p.id === selectedPlayerId)) {
      setSelectedPlayerId(allProfiles[0].id);
    }
  }, [selectedPlayerId, players, allProfiles]);

  // Check URL parameters on mount to deep-link to specific tabs/sessions (useful for iframe printing bypass)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const sessionParam = params.get('session_id');

    if (tabParam) {
      setActiveTab(tabParam as any);
    }
    if (sessionParam) {
      setSelectedSessionId(sessionParam);
    }
  }, []);

  // Handle automatic printing once loading is complete
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoPrintParam = params.get('print');
    
    if (autoPrintParam === 'true' && !loadingSessions && trainingSessions.length > 0) {
      const timer = setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error("Auto print failed:", e);
        }
      }, 1000); // Wait 1 second to make sure React components are completely rendered
      return () => clearTimeout(timer);
    }
  }, [loadingSessions, trainingSessions]);

  // Auto-select first session if none selected
  useEffect(() => {
    if (!selectedSessionId && trainingSessions.length > 0) {
      // Only auto-select if there is no session_id in URL
      const params = new URLSearchParams(window.location.search);
      if (!params.get('session_id')) {
        setSelectedSessionId(trainingSessions[0].id);
      }
    }
  }, [selectedSessionId, trainingSessions]);

  // Auto-select first player if none selected
  useEffect(() => {
    if (!selectedPlayerId && allProfiles.length > 0) {
      setSelectedPlayerId(allProfiles[0].id);
    }
  }, [selectedPlayerId, allProfiles]);

  const selectedPlayer = allProfiles.find(p => p.id === selectedPlayerId) || allProfiles[0];

  const handleUpdatePlayer = async (updatedPlayer: Spieler) => {
    setSaveStatus('saving');
    try {
      await saveSpieler(updatedPlayer);
      
      // Update finance data if it exists
      const financeEntry = budgetFinanz.find(f => f.id === updatedPlayer.id);
      if (financeEntry) {
        await saveFinanz({
          ...financeEntry,
          name: updatedPlayer.name,
          pos: updatedPlayer.position,
          baseSalary: updatedPlayer.finance?.baseSalary || 0,
          bonusPerMatch: updatedPlayer.finance?.bonusPerMatch || 0,
          sideAgreements: updatedPlayer.finance?.sideAgreements || '',
        } as any);
      }

      // Return to player list after editing
      setSelectedPlayerId(null);
      setShowAddPlayerModal(false);
      setEditingPlayer(null);
      setSaveStatus('success');
      setToast({ message: 'Person erfolgreich aktualisiert.', id: Date.now() });
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('idle');
      handleFirestoreError(err, OperationType.UPDATE, `spieler/${updatedPlayer.id}`);
    }
  };

  const handleDeletePlayer = async (id: string, skipConfirm = true) => {
    if (!id) {
      console.warn("Löschvorgang abgebrochen: Keine ID übergeben.");
      return;
    }

    const player = players.find(p => p.id === id);
    if (!player) {
      console.warn(`Löschvorgang abgebrochen: Profil mit ID ${id} existiert nicht.`);
      return;
    }

    const playerName = (player.name || `${player.firstName || ''} ${player.lastName || ''}`).trim();

    const shouldSkip = skipConfirm === undefined ? true : skipConfirm;
    
    if (shouldSkip) {
      try {
        // 1. Hook-based local state deletions (offline-safe & instant UI update)
        await deleteSpieler(id);
        await deleteAttendance(id).catch((e) => console.warn(`deleteAttendance failed:`, e));
        await deleteCompMinutes(id).catch((e) => console.warn(`deleteCompMinutes failed:`, e));
        await deleteTestMinutes(id).catch((e) => console.warn(`deleteTestMinutes failed:`, e));
        await deleteCardRecord(id).catch((e) => console.warn(`deleteCardRecord failed:`, e));
        await deleteFinanz(id).catch((e) => console.warn(`deleteFinanz failed:`, e));

        // 2. Query-based deletions in Firestore
        const batch = writeBatch(db);
        const queryColls = [
          { name: 'individual_training', field: 'playerId' },
          { name: 'run_records', field: 'playerId' },
          { name: 'physio_entries', field: 'playerId' }
        ];

        for (const coll of queryColls) {
          if (!isQueryParamValid(id)) {
            console.warn(`Abgebrochen: Query-Parameter id für ${coll.name} ist ungültig.`);
            continue;
          }
          const q = query(collection(db, coll.name), where(coll.field, '==', id));
          const snapshot = await getDocs(q);
          snapshot.forEach(d => batch.delete(d.ref));
        }

        // Special case for meetings (uses name)
        if (playerName && isQueryParamValid(playerName)) {
          const qM = query(collection(db, 'meetings_data'), where('playerName', '==', playerName));
          const snapM = await getDocs(qM);
          snapM.forEach(d => batch.delete(d.ref));
        }

        await batch.commit().catch((e) => console.warn("Firestore batch delete failed/skipped (offline/quota):", e));

        // 3. Sync local state of query-based collections immediately for instant UI feedback
        if (typeof removeIndividualTraining === 'function') {
          const itemsToRemove = (individualTrainingData || []).filter((item: any) => item.playerId === id);
          for (const item of itemsToRemove) {
            await removeIndividualTraining(item.id).catch(() => {});
          }
        }
        if (typeof deleteRunRecord === 'function') {
          const itemsToRemove = (runRecords || []).filter((item: any) => item.playerId === id);
          for (const item of itemsToRemove) {
            await deleteRunRecord(item.id).catch(() => {});
          }
        }
        if (typeof deletePhysioEntry === 'function') {
          const itemsToRemove = (physioEntries || []).filter((item: any) => item.playerId === id);
          for (const item of itemsToRemove) {
            await deletePhysioEntry(item.id).catch(() => {});
          }
        }
        if (typeof deleteMeetingEntry === 'function' && playerName) {
          const itemsToRemove = (meetingsData || []).filter((item: any) => item.playerName === playerName);
          for (const item of itemsToRemove) {
            await deleteMeetingEntry(item.id).catch(() => {});
          }
        }

        setToast({ message: 'Person und alle zugehörigen Daten erfolgreich gelöscht.', id: Date.now() });
        if (selectedPlayerId === id) {
          setSelectedPlayerId(null);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `spieler/${id}`);
      }
    }
  };

  const handleAddPlayer = async (newPlayer: Spieler) => {
    console.log('Adding player:', newPlayer);
    setSaveStatus('saving');
    try {
      const weekday = newPlayer.geburtsdatum ? getWeekdayLabel(newPlayer.geburtsdatum) : '';
      const spieler: Spieler = {
        ...newPlayer,
        wochentag: weekday,
      };
      await saveSpieler(spieler);
      
      // Also save to finance
      await saveFinanz({
        id: newPlayer.id,
        name: newPlayer.name,
        pos: newPlayer.position,
        baseSalary: newPlayer.finance?.baseSalary || 0,
        bonusPerMatch: newPlayer.finance?.bonusPerMatch || 0,
        sideAgreements: newPlayer.finance?.sideAgreements || '',
        datum: new Date().toISOString().split('T')[0],
        wochentag: getWeekdayLabel(new Date().toISOString().split('T')[0]),
        kategorie: 'Gehalt',
        einnahmen: 0,
        ausgaben: 0,
        aktuelles_budget: 0,
        notiz: `Initialer Eintrag für ${newPlayer.name}`
      } as any);

      setShowAddPlayerModal(false);
      setEditingPlayer(null);
      setSelectedPlayerId(null);
      setSaveStatus('success');
      
      const categoryLabel = newPlayer.category === 'player' ? 'Spielerkader' : 
                          newPlayer.category === 'coach' ? 'Trainerteam' : 
                          newPlayer.category === 'staff' ? 'Teammanagement / Funktionär' : 
                          newPlayer.category === 'medical' ? 'Medizinische Abteilung (Physio / Arzt)' : 'Person';
      
      setToast({ message: `${categoryLabel} erfolgreich hinzugefügt`, id: Date.now() });
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('idle');
      handleFirestoreError(error, OperationType.CREATE, 'spieler');
    }
  };

  const handleUpdateAttendance = useCallback(async (playerId: string, session: number, status: string) => {
    console.log(`Updating attendance for player ${playerId}, session ${session} to ${status}`);
    if (isQuotaExceededActive() || !navigator.onLine) {
      setToast({ message: 'Anwesenheit lokal aktualisiert (Offline/Quota-Modus)', id: Date.now() });
      return;
    }
    try {
      const docRef = doc(db, 'attendance', playerId);
      const updateValue = status === '' ? deleteField() : status;
      
      try {
        await updateDoc(docRef, {
          [`sessions.${session}`]: updateValue
        });
      } catch (e: any) {
        if (isQuotaError(e)) {
          markQuotaExceeded();
          return;
        }
        // If document doesn't exist (code 'not-found'), create it with setDoc
        if (e.code === 'not-found') {
          if (status !== '') {
            await setDoc(docRef, cleanFirestoreData({
              playerId: playerId,
              sessions: { [session]: status }
            }));
          }
        } else {
          throw e;
        }
      }
      
      setToast({ message: 'Anwesenheit aktualisiert', id: Date.now() });
    } catch (err) {
      if (isQuotaError(err)) {
        markQuotaExceeded();
      }
      handleFirestoreError(err, OperationType.UPDATE, `attendance/${playerId}`);
    }
  }, []);

  const handleUpdateDayPlan = (date: string, field: string, value: any) => {
    const plan = yearlyPlan.find((p: any) => p.date === date) || { date };
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      saveYearlyPlan({ 
        ...(plan as any), 
        [parent]: { 
          ...((plan as any)[parent] || {}), 
          [child]: value 
        } 
      });
    } else {
      saveYearlyPlan({ ...(plan as any), [field]: value });
    }
  };

  // Handlers for Cloud Collections
  const handleSaveSpieler = async (data: Partial<Spieler>) => {
    const weekday = data.geburtsdatum ? getWeekdayLabel(data.geburtsdatum) : '';
    await saveSpieler({ ...data, wochentag: weekday } as Spieler);
    setToast({ message: 'Spieler gespeichert', id: Date.now() });
  };

  const handleSaveTraining = async (data: Partial<Training>) => {
    const weekday = data.datum ? getWeekdayLabel(data.datum) : '';
    await saveTraining({ ...data, wochentag: weekday } as Training);
    setToast({ message: 'Training gespeichert', id: Date.now() });
  };

  const handleSaveSpiel = async (data: Partial<Spiel>) => {
    const weekday = data.datum ? getWeekdayLabel(data.datum) : '';
    await saveSpiel({ ...data, wochentag: weekday } as Spiel);
    setToast({ message: 'Spiel gespeichert', id: Date.now() });
  };

  const handleSaveFinanz = async (data: Partial<Finanz>) => {
    const weekday = data.datum ? getWeekdayLabel(data.datum) : '';
    await saveFinanz({ ...data, wochentag: weekday } as Finanz);
    setToast({ message: 'Finanzdaten gespeichert', id: Date.now() });
  };

  const seasonDates = React.useMemo(() => {
    const dates: string[] = [];
    let current = new Date(2026, 6, 1); // 01.07.2026
    const end = new Date(2027, 4, 30); // 30.05.2027
    
    while (current <= end) {
      const day = current.getDay();
      // 1: Montag, 3: Mittwoch, 5: Freitag
      if (day === 1 || day === 3 || day === 5) {
        dates.push(current.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, []);

  const handleUpdateTrainingSession = (id: string, field: string, value: any) => {
    const session = trainingSessions.find((s: any) => s.id === id);
    if (!session) return;
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      saveTrainingSession({ ...session, [parent]: { ...(session as any)[parent], [child]: value } });
    } else {
      saveTrainingSession({ ...session, [field]: value });
    }
  };

  const handleUpdateIndividualTraining = (playerId: string, field: keyof IndividualTrainingRecord, value: string) => {
    const existing = individualTrainingData.find(d => d.playerId === playerId && d.date === selectedIndividualDate);
    if (existing) {
      saveIndividualTraining({ ...existing, [field]: value });
    } else {
      saveIndividualTraining({ 
        id: `${playerId}_${selectedIndividualDate}`,
        date: selectedIndividualDate, 
        playerId, 
        focus: '',
        goals: '',
        status: '',
        load: 'Normal',
        targetDate: '',
        ek: '', o: '', t: '', p: '', s: '', a: '', w: '', notes: '', 
        [field]: value 
      } as any);
    }
  };

  const handleAddTrainingSession = () => {
    const newSession: TrainingSession = {
      id: `ts${Date.now()}`,
      date: new Date().toLocaleDateString('de-DE'),
      weekday: new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date()),
      group: 'FC Auggen',
      load: 'Mittel',
      duration: '90 Min',
      weeklyFocus: '',
      sessionFocus: '',
      trainer: 'Amin',
      intensity: 'Mittel',
      players: sortPlayers(players)
        .map(p => ({ name: p.lastName, position: p.position, status: 'Aktiv' })),
      content: { warmup: '', main1: '', main2: '', closing: '' },
      importantInfo: '',
      remarks: ''
    };
    saveTrainingSession(newSession);
    setSelectedSessionId(newSession.id);
  };

  const handleSyncSquadToTraining = (sessionId: string) => {
    const session = trainingSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    // Removed window.confirm
    // Use INITIAL_PLAYERS as fallback if current players state is empty or outdated
    const sourcePlayers = (players.length > 0 ? players : INITIAL_PLAYERS) as any[];
    const squadPlayers = sortPlayers(sourcePlayers)
      .map(p => ({ 
        name: p.lastName, 
        position: p.position, 
        status: 'Aktiv' 
      }));
    handleUpdateTrainingSession(sessionId, 'players', squadPlayers);
  };

  const generateSeasonSessions = async (options?: {
    startDate?: string;
    endDate?: string;
    trainingDays?: number[]; // Day numbers: 0 for Sunday, 1 for Monday, etc.
    skipHolidays?: boolean;
    breakStart?: string;
    breakEnd?: string;
  }) => {
    const opts = {
      startDate: '2026-07-06',
      endDate: '2027-05-30',
      trainingDays: [2, 4], // Default to Tuesday & Thursday (typical for amateur club)
      skipHolidays: true,
      breakStart: '2026-12-15',
      breakEnd: '2027-01-15',
      ...options
    };

    const start = new Date(opts.startDate);
    const end = new Date(opts.endDate);
    const breakS = new Date(opts.breakStart);
    const breakE = new Date(opts.breakEnd);
    const sessions: TrainingSession[] = [];
    const yearlyPlanEntries: any[] = [];
    
    let current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      const dateStr = current.toLocaleDateString('de-DE');
      const year = current.getFullYear();
      const holidays = getHolidays(year);
      const customHoliday = yearlyPlan.find((p: any) => p.date === dateKey)?.customHolidayName;
      const isHoliday = customHoliday !== undefined ? (customHoliday !== "") : (holidays[dateKey] !== undefined);
      const holidayName = customHoliday !== undefined ? (customHoliday || null) : holidays[dateKey];

      // 1. Winter break check
      if (current >= breakS && current <= breakE) {
        yearlyPlanEntries.push({
          date: dateKey,
          type: 'Frei',
          activity: 'WINTERPAUSE',
          time: '',
          phase: 'break'
        });
        current.setDate(current.getDate() + 1);
        continue;
      }

      // 2. Check if holiday should be skipped/marked as Frei
      if (isHoliday && opts.skipHolidays) {
        yearlyPlanEntries.push({
          date: dateKey,
          type: 'Frei',
          activity: holidayName,
          time: '',
          phase: (current >= new Date('2026-07-06') && current <= new Date('2026-08-15')) ? 'summer' : 'season'
        });
        current.setDate(current.getDate() + 1);
        continue;
      }

      const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday...
      
      // 3. Check if this is a selected training day
      if (opts.trainingDays.includes(dayOfWeek)) {
        // Check if session already exists for this date
        const exists = trainingSessions.some(s => s.date === dateStr);
        if (!exists) {
          const newSession: TrainingSession = {
            id: `ts${current.getTime()}`,
            date: dateStr,
            weekday: new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(current),
            group: 'FC Auggen',
            load: 'Mittel',
            duration: '90 Min',
            weeklyFocus: '',
            sessionFocus: '',
            trainer: 'Amin',
            intensity: 'Mittel',
            players: sortPlayers((players.length > 0 ? players : INITIAL_PLAYERS) as any[])
              .filter(p => (p.category || 'player') === 'player')
              .map(p => ({ name: p.lastName, position: p.position, status: '1' })),
            content: { warmup: '', main1: '', main2: '', closing: '' },
            importantInfo: '',
            remarks: ''
          };
          sessions.push(newSession);
          
          yearlyPlanEntries.push({
            date: dateKey,
            type: 'Training',
            time: '19:00',
            activity: 'Training',
            phase: (current >= new Date('2026-07-06') && current <= new Date('2026-08-15')) ? 'summer' : 'season',
            training: { start: '19:00', end: '20:30', notes: '' }
          });
        }
      } else {
        // All other days are marked as "Frei" (Spielfrei / Trainingsfrei) in the yearly plan
        yearlyPlanEntries.push({
          date: dateKey,
          type: 'Frei',
          activity: 'SPIELFREI',
          time: '',
          phase: (current >= new Date('2026-07-06') && current <= new Date('2026-08-15')) ? 'summer' : 'season'
        });
      }

      current.setDate(current.getDate() + 1);
    }

    if (sessions.length > 0 || yearlyPlanEntries.length > 0) {
      // Save sessions
      for (const s of sessions) {
        await saveTrainingSession(s);
      }
      
      // Save yearly plans
      for (const entry of yearlyPlanEntries) {
        const existingPlan = yearlyPlan.find((p: any) => p.date === entry.date);
        if (!existingPlan) {
          await saveYearlyPlan(entry);
        } else {
          // If existing plan is a placeholder or can be updated
          if (existingPlan.type === 'Frei' && entry.type === 'Training') {
            await saveYearlyPlan({ ...existingPlan, ...entry });
          } else if (entry.activity === 'WINTERPAUSE' || (entry.activity && !existingPlan.activity)) {
            await saveYearlyPlan({ ...existingPlan, ...entry });
          }
        }
      }

      alert(`${sessions.length} Trainingseinheiten und freie Tage wurden erfolgreich generiert.`);
    } else {
      alert('Keine neuen Einheiten zu generieren (alle Daten bereits belegt).');
    }
  };

  // Attach to window for the view to call
  useEffect(() => {
    (window as any).generateSeasonSessions = generateSeasonSessions;
    (window as any).saveTrainingSession = saveTrainingSession;
    return () => { 
      delete (window as any).generateSeasonSessions;
      delete (window as any).saveTrainingSession;
    };
  }, [trainingSessions, players, saveTrainingSession, yearlyPlan, saveYearlyPlan]);

  const handleAddYouthPlayer = (sessionId: string, team: 'U23' | 'U19') => {
    const session = trainingSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const newPlayers = [...session.players, { name: `NEUER ${team} SPIELER`, position: team, status: 'Aktiv' }];
    handleUpdateTrainingSession(sessionId, 'players', newPlayers);
  };

  const getShareText = () => {
    let text = `FC AUGGEN - ${TABS.find(t => t.id === activeTab)?.label}\n\n`;
    
    if (activeTab === 'scouting') {
      scoutingCandidates.forEach((c, i) => {
        text += `${i + 1}. ${c.name.toUpperCase()} (${c.club})\n`;
        text += `   Pos: ${c.position} | Alter: ${c.age} | MW: ${c.marketValue}\n`;
        text += `   Empfehlung: ${c.recommendation}\n`;
        if (c.conversationNotes) text += `   Gespräch: ${c.conversationNotes}\n`;
        if (c.waitingTime) text += `   Antwort bis: ${c.waitingTime}\n`;
        text += `\n`;
      });
    } else if (activeTab === 'personnel') {
      players.forEach((p) => {
        text += `#${p.number} ${p.lastName} (${p.position})`;
        if (p.telefon) text += ` | Tel: ${p.telefon}`;
        if (p.email) text += ` | Mail: ${p.email}`;
        text += `\n`;
      });
    } else if (activeTab === 'meetings_calendar') {
      meetingsData.forEach((m) => {
        const name = m.playerName === 'EXTERN' ? m.manualName || 'Unbekannt' : m.playerName;
        text += `${m.date} ${m.time} - ${name}\n`;
        text += `Ort: ${m.location}\n`;
        if (m.notes) text += `Notiz: ${m.notes}\n\n`;
      });
    } else if (activeTab === 'attendance') {
      text += `Anwesenheit Übersicht:\n`;
      players.forEach(p => {
        const record = attendance.find(a => a.playerId === p.id);
        const total = record ? Object.values(record.sessions).filter(s => s === 'P').length : 0;
        text += `${p.lastName}: ${total} Einheiten\n`;
      });
    } else if (activeTab === 'budget_finance') {
      players.forEach(p => {
        text += `${p.lastName} (${p.position}): ${p.finance?.baseSalary || 0}€`;
        if (p.finance?.transferFeeIn) text += ` | Ablöse Z: ${p.finance.transferFeeIn}€`;
        if (p.finance?.transferFeeOut) text += ` | Ablöse A: ${p.finance.transferFeeOut}€`;
        text += `\n`;
      });
    } else if (activeTab === 'yearly') {
      text += "PLANUNG NÄCHSTE 7 TAGE:\n\n";
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const plan = yearlyPlan.find((p: any) => p.date === dateStr);
        if (plan) {
          text += `${dateStr}: ${plan.type} | ${plan.time} | ${plan.location}\n`;
          if (plan.activity) text += `   Aktivität: ${plan.activity}\n`;
          if (plan.treffpunkt) text += `   Treffpunkt: ${plan.treffpunkt}\n`;
          text += `\n`;
        }
      }
      if (text.endsWith("PLANUNG NÄCHSTE 7 TAGE:\n\n")) {
        text += "Keine Einträge für die nächsten 7 Tage.";
      }
    } else if (activeTab === 'physio_plan') {
      physioEntries.filter(e => e.playerId).forEach(e => {
        const p = players.find(pl => pl.id === e.playerId);
        text += `${e.date} (${e.day}) - ${p?.lastName || 'Unbekannt'}\n`;
        text += `Typ: ${e.type} | Bereich: ${e.area}\n`;
        if (e.remarks) text += `Bemerkung: ${e.remarks}\n\n`;
      });
    } else if (activeTab === 'runs_sw') {
      runRecords.forEach(r => {
        const p = players.find(pl => pl.id === r.playerId);
        const completed = Object.values(r.runs).filter(v => v === 'OK').length;
        text += `${p?.lastName}: ${completed}/15 Läufe\n`;
      });
    } else if (activeTab === 'cards') {
      cardRecords.forEach(r => {
        const p = players.find(pl => pl.id === r.playerId);
        const cards = Object.values(r.cards).filter(v => v !== '').length;
        text += `${p?.lastName}: ${cards} Karten gesamt\n`;
      });
    } else if (activeTab === 'individual_control') {
      individualTrainingData.filter(d => d.date === selectedIndividualDate).forEach(d => {
        const p = players.find(pl => pl.id === d.playerId);
        text += `${p?.lastName}: EK:${d.ek} O:${d.o} T:${d.t} P:${d.p} S:${d.s} A:${d.a} W:${d.w}\n`;
      });
    } else if (activeTab === 'trainer_view') {
      text += `FORMATION: ${formation}\n\n`;
      const savedLineup = localStorage.getItem(`fca_lineup_${formation}`);
      if (savedLineup) {
        const assignments = JSON.parse(savedLineup);
        const savedPos = localStorage.getItem(`fca_posData_${formation}`);
        if (savedPos) {
          const posData = JSON.parse(savedPos);
          posData.forEach((pos: any) => {
            const assignment = assignments[pos.id];
            let name = 'Nicht besetzt';
            if (assignment?.startsWith('manual:')) {
              name = assignment.replace('manual:', '') + ' (GAST)';
            } else if (assignment) {
              const p = players.find(player => player.id === assignment);
              if (p) name = `${p.lastName} (#${p.number})`;
            }
            text += `${pos.label}: ${name}\n`;
          });
        } else {
          text += "Aufstellung vorhanden, aber Positionsdaten fehlen.";
        }
      } else {
        text += "Keine Aufstellung für dieses System gespeichert.";
      }
    } else if (activeTab === 'training_planning') {
      const session = trainingSessions.find(s => s.id === selectedSessionId);
      if (session) {
        text += `TRAININGSEINHEIT: ${new Date(session.date).toLocaleDateString('de-DE')} (${session.weekday})\n`;
        text += `Schwerpunkt: ${session.sessionFocus || '-'}\n`;
        text += `Dauer: ${session.duration} | Belastung: ${session.load}\n`;
        text += `Trainer: ${session.trainer || 'Amin, marcel'}\n`;
        if (session.opponent) text += `Gegner: ${session.opponent}\n`;
        if (session.location) text += `Ort: ${session.location}\n`;
        
        const fieldPlayers = session.players.filter((p: any) => (p.category === 'player' || p.category === 'spieler') && (p.position || '').toUpperCase() !== 'TW');
        const keepers = session.players.filter((p: any) => (p.category === 'player' || p.category === 'spieler') && (p.position || '').toUpperCase() === 'TW');
        const staff = session.players.filter((p: any) => p.category !== 'player' && p.category !== 'spieler');
        
        const presentPlayers = fieldPlayers.filter((p: any) => p.status === '1');
        const presentKeepers = keepers.filter((p: any) => p.status === '1');
        
        text += `\nTEILNEHMER:\n`;
        text += `Spieler: ${presentPlayers.length}/${fieldPlayers.length}\n`;
        text += `TW: ${presentKeepers.length}/${keepers.length}\n`;
        text += `Staff: ${staff.filter((p: any) => p.status === '1').length}/${staff.length}\n`;
        
        text += `\nINHALT:\n`;
        text += `Aufwärmen: ${session.content.warmup}\n`;
        text += `Hauptteil 1: ${session.content.main1}\n`;
        text += `Hauptteil 2: ${session.content.main2}\n`;
        text += `Schluss: ${session.content.closing}\n`;
        if (session.importantInfo) text += `\nWichtig: ${session.importantInfo}\n`;
        if (session.remarks) text += `Bemerkungen: ${session.remarks}\n`;
      } else {
        text += "Keine Trainingseinheit ausgewählt.";
      }
    } else if (activeTab === 'competitive_planning' || activeTab === 'test_planning' || activeTab === 'u23_planning') {
      const matches = activeTab === 'competitive_planning' ? competitiveMatches : (activeTab === 'test_planning' ? testMatches : u23Matches);
      text += `${activeTab === 'competitive_planning' ? 'PFLICHTSPIELE' : (activeTab === 'test_planning' ? 'TESTSPIELE' : 'U23 – EINSATZZEITEN A-KADER')}:\n\n`;
      matches.forEach(m => {
        text += `${m.date || ''} ${m.kickOff} - ${m.opponent} (${m.isHome ? 'H' : 'A'})\n`;
        text += `Treffpunkt: ${m.meetingTime} | Ort: ${m.location}\n`;
        if (m.result) text += `Ergebnis: ${m.result}\n`;
        text += `\n`;
      });
    } else if (activeTab === 'tacticboard') {
      text += `TAKTIKBOARD - ANWEISUNGEN:\n\n${tacticInstructions || 'Keine Anweisungen vorhanden.'}`;
    } else if (activeTab === 'team_list') {
      text += "TEAMLISTE:\n\n";
      players.forEach(p => {
        text += `${p.lastName}, ${p.firstName} (#${p.number}) - ${p.position}\n`;
      });
    } else if (activeTab === 'summer_prep' || activeTab === 'winter_prep') {
      const data = activeTab === 'summer_prep' ? vorbereitungSommer : vorbereitungWinter;
      text += `${activeTab === 'summer_prep' ? 'SOMMERVORBEREITUNG' : 'WINTER-VORBEREITUNG'}:\n\n`;
      data.forEach((unit: any) => {
        text += `${unit.date} (${unit.day}) - ${unit.type}\n`;
        if (unit.activity) text += `Aktivität: ${unit.activity}\n`;
        if (unit.time) text += `Zeit: ${unit.time}\n`;
        if (unit.location) text += `Ort: ${unit.location}\n`;
        text += `\n`;
      });
    } else if (activeTab === 'developer_tasks') {
      text += "DEVELOPER ROADMAP: Interne Entwicklungsdaten.";
    } else {
      text += "Daten für diesen Reiter können aktuell nur als Datei exportiert werden.";
    }
    return text;
  };

  const handleShareText = async () => {
    const text = getShareText();
    const tabLabel = TABS.find(t => t.id === activeTab)?.label || activeTab;
    
    // Prioritize direct WhatsApp if in AI Studio area to avoid iframe share restrictions
    if (!navigator.share || window.location.href.includes('google.com') || window.location.href.includes('ais-')) {
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      await navigator.share({
        title: `FC Auggen - ${tabLabel}`,
        text: text
      });
    } catch (e) {
      console.log('Share failed, falling back to api.whatsapp.com', e);
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleEmail = () => {
    const text = getShareText();
    const subject = `FC Auggen - ${TABS.find(t => t.id === activeTab)?.label}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.assign(mailtoUrl);
  };

  const handleCopyStandaloneAppLink = () => {
    // Standalone direct app URL for colleagues (pure application without Gemini Chat or AI Studio wrapper)
    const appUrl = 'https://ais-pre-csoi3ilqxqoorgujvh2y4x-26421253027.europe-west1.run.app';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(appUrl).catch(() => {});
    }
    setToast({
      message: 'Link für Trainerkollegen kopiert! Öffnet die FC Auggen App direkt im Vollbild ohne Gemini-Chat.',
      id: Date.now()
    });
  };
















  const handleMigrateCloudData = async () => {
    setToast({ message: 'Cloud-Migration gestartet...', id: Date.now() });
    try {
      await migrateFirestoreData();
      setToast({ message: 'Cloud-Migration erfolgreich abgeschlossen.', id: Date.now() });
    } catch (err) {
      console.error('Migration error:', err);
      setToast({ message: 'Fehler bei der Cloud-Migration.', id: Date.now() });
    }
  };
  
  const handleMigrateLocalData = async () => {
    // Removed window.confirm
    
    setToast({ message: 'Migration gestartet...', id: Date.now() });
    try {
      const collections = [
        { lsKey: 'players', save: saveSpieler },
        { lsKey: 'training', save: saveTraining },
        { lsKey: 'spiele', save: saveSpiel },
        { lsKey: 'financeData', save: saveFinanz },
        { lsKey: 'attendance', save: saveAttendance },
        { lsKey: 'competitiveMatches', save: saveCompMatch },
        { lsKey: 'competitiveMinutes', save: saveCompMinutes },
        { lsKey: 'testMatches', save: saveTestMatch },
        { lsKey: 'testMinutes', save: saveTestMinutes },
        { lsKey: 'cardRecords', save: saveCardRecord },
        { lsKey: 'scoutingCandidates', save: saveScoutingCandidate },
        { lsKey: 'meetingsData', save: saveMeetingEntry },
        { lsKey: 'trainingSessions', save: saveTrainingSession },
        { lsKey: 'individualTrainingData', save: saveIndividualTraining },
        { lsKey: 'runRecords', save: saveRunRecord },
        { lsKey: 'physioEntries', save: savePhysioEntry },
        { lsKey: 'summerPrep', save: saveVorbereitungSommer },
        { lsKey: 'winterPrep', save: saveVorbereitungWinter },
      ];

      let count = 0;
      for (const col of collections) {
        const data = localStorage.getItem(`fca_${col.lsKey}`);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              await col.save(item);
              count++;
            }
          }
        }
      }
      
      // Special case for yearlyPlan (object)
      const yearlyData = localStorage.getItem('fca_yearlyPlan');
      if (yearlyData) {
        const parsed = JSON.parse(yearlyData);
        for (const [date, plan] of Object.entries(parsed)) {
          await saveYearlyPlan({ ...(plan as any), id: date, date });
          count++;
        }
      }

      setToast({ message: `Migration abgeschlossen! ${count} Einträge übertragen.`, id: Date.now() });
    } catch (err) {
      console.error('Migration error:', err);
      setToast({ message: 'Fehler bei der Daten-Migration.', id: Date.now() });
    }
  };

  const handleCloudSync = async () => {
    setToast({ message: 'Cloud-Synchronisierung gestartet...', id: Date.now() });
    try {
      const updatedCount = await migrateFirestoreData();
      setToast({ message: `Cloud-Synchronisierung abgeschlossen! ${updatedCount} Einträge normalisiert.`, id: Date.now() });
    } catch (err) {
      console.error('Cloud Sync error:', err);
      setToast({ message: 'Fehler bei der Cloud-Synchronisierung.', id: Date.now() });
    }
  };

  const getCategoryForTab = (tabId: TabId): 'ubersicht' | 'kader' | 'training' | 'match' | 'orga' => {
    if (['dashboard', 'developer_tasks', 'tacticboard'].includes(tabId)) return 'ubersicht';
    if (['personnel', 'team_list', 'player_portal', 'scouting'].includes(tabId)) return 'kader';
    if (['academy_analysis', 'attendance', 'training_planning', 'individual_control', 'runs_sw', 'summer_prep', 'winter_prep'].includes(tabId)) return 'training';
    if (['champions_cup', 'competitive_planning', 'test_planning', 'u23_planning', 'match_report', 'trainer_view', 'video_analysis'].includes(tabId)) return 'match';
    if (['yearly', 'budget_finance', 'meetings_calendar', 'physio_plan', 'access_control'].includes(tabId)) return 'orga';
    return 'ubersicht';
  };

  const handleTabClick = (tabId: TabId) => {
    setActiveTab(tabId);
    setSelectedPlayerId(null);
    setIsMobileMenuOpen(false);
    setNavCategory(getCategoryForTab(tabId));
  };

  const normalizeDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('.')) {
      const [d, m, y] = dateStr.split('.');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return dateStr;
  };

  const bootstrapData = async (silent = false) => {
    // Removed window.confirm
    
    setToast({ message: 'Daten werden wiederhergestellt...', id: Date.now() });
    try {
      // Players
      if (INITIAL_PLAYERS && INITIAL_PLAYERS.length > 0) {
        for (const p of INITIAL_PLAYERS) {
          const playerAny = p as any;
          const playerData = {
            ...p,
            physical: playerAny.physical || { height: 0, weight: 0, fat: 0, muscle: 0, water: 0 },
            analysis: playerAny.analysis || '',
            finance: {
              baseSalary: 0,
              bonusPerMatch: 0,
              ist: 0,
              sideAgreements: '',
              ...playerAny.finance
            }
          };
          await saveSpieler(playerData as any);
        }
      }

      // Attendance (40 sessions for all squad members)
      if (ATTENDANCE && ATTENDANCE.length > 0) {
        for (const a of ATTENDANCE) {
          await saveAttendance(a as any);
        }
      }
      
      // Competitive Matches
      if (COMPETITIVE_MATCHES && COMPETITIVE_MATCHES.length > 0) {
        for (const m of COMPETITIVE_MATCHES) {
          await saveCompMatch(m as any);
        }
      }

      // Test Matches
      if (TEST_MATCHES && TEST_MATCHES.length > 0) {
        for (const m of TEST_MATCHES) {
          await saveTestMatch({ ...m, id: m.id.toString() } as any);
        }
      }

      // Scouting
      if (INITIAL_SCOUTING && INITIAL_SCOUTING.length > 0) {
        for (const c of INITIAL_SCOUTING) {
          await saveScoutingCandidate(c as any);
        }
      }

      // Yearly Plan
      if (YEARLY_PLAN && Object.keys(YEARLY_PLAN).length > 0) {
        for (const [date, plan] of Object.entries(YEARLY_PLAN)) {
          const normalizedDate = normalizeDate(date);
          await saveYearlyPlan({ ...(plan as any), id: normalizedDate, date: normalizedDate });
        }
      }

      // Depth Chart
      if (DEPTH_CHART && Object.keys(DEPTH_CHART).length > 0) {
        await saveDepthChart({ id: 'main', ...DEPTH_CHART });
      }

      // Finance Meta
      if (FINANCE_META && Object.keys(FINANCE_META).length > 0) {
        await saveFinanceMeta({ id: 'current', ...FINANCE_META });
      }

      // Finance Data
      if (INITIAL_FINANCE_DATA && INITIAL_FINANCE_DATA.length > 0) {
        for (const f of INITIAL_FINANCE_DATA) {
          await saveFinanz(f as any);
        }
      }

      // Card Records
      if (CARD_RECORDS && CARD_RECORDS.length > 0) {
        for (const r of CARD_RECORDS) {
          await saveCardRecord(r as any);
        }
      }

      // Competitive Minutes
      if (COMPETITIVE_MINUTES && COMPETITIVE_MINUTES.length > 0) {
        for (const r of COMPETITIVE_MINUTES) {
          await saveCompMinutes(r as any);
        }
      }

      // Test Minutes
      if (TEST_MINUTES && TEST_MINUTES.length > 0) {
        for (const r of TEST_MINUTES) {
          await saveTestMinutes(r as any);
        }
      }

      // Meetings Data
      if (INITIAL_MEETINGS_DATA && INITIAL_MEETINGS_DATA.length > 0) {
        for (const m of INITIAL_MEETINGS_DATA) {
          await saveMeetingEntry({ ...m, date: normalizeDate(m.date) } as any);
        }
      }

      // Training Sessions
      if (INITIAL_TRAINING_SESSIONS && INITIAL_TRAINING_SESSIONS.length > 0) {
        for (const s of INITIAL_TRAINING_SESSIONS) {
          await saveTrainingSession(s as any);
        }
      }

      // Summer Preparation
      if (INITIAL_SUMMER_PREP && INITIAL_SUMMER_PREP.length > 0) {
        for (const s of INITIAL_SUMMER_PREP) {
          await saveVorbereitungSommer(s as any);
        }
      }

      // Winter Preparation
      if (INITIAL_WINTER_PREP && INITIAL_WINTER_PREP.length > 0) {
        for (const w of INITIAL_WINTER_PREP) {
          await saveVorbereitungWinter(w as any);
        }
      }

      // Formation
      if (INITIAL_FORMATION) {
        await saveFormation({ id: 'current', value: INITIAL_FORMATION });
      }

      setToast({ message: 'Daten erfolgreich wiederhergestellt!', id: Date.now() });
    } catch (error) {
      console.error('Bootstrap error:', error);
      setToast({ message: 'Fehler beim Wiederherstellen der Daten', id: Date.now() });
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            players={sortedPlayers}
            competitiveMatches={competitiveMatches}
            testMatches={testMatches}
            trainingSessions={trainingSessions}
            onSaveTestMatch={saveTestMatch}
            onNavigateToTab={(tabId) => handleTabClick(tabId)}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewMode}
          />
        );
      case 'personnel':
        return (
          <PersonnelView 
            players={sortedPlayers}
            sessionLogs={playerSessionLogs || []}
            onEditPlayer={(p) => {
              setEditingPlayer(p);
              setShowAddPlayerModal(true);
            }}
            onDeletePlayer={handleDeletePlayer}
            onUpdatePlayer={(id, field, val) => {
              const player = players.find(p => p.id === id);
              if (player) {
                const updated = { ...player, [field]: val };
                if (field === 'firstName' || field === 'lastName') {
                  updated.name = `${updated.firstName || ''} ${updated.lastName || ''}`.trim();
                }
                saveSpieler(updated);
              }
            }}
            onAddPlayer={() => {
              setEditingPlayer(null);
              setShowAddPlayerModal(true);
            }}
            isEditing={isEditing}
          />
        );
      case 'summer_prep':
        return (
          <SummerPreparationView 
            data={vorbereitungSommer} 
            onAddOrUpdate={handleSaveVorbereitungSommer} 
            onDelete={handleRemoveVorbereitungSommer}
            isEditing={isEditing} 
            setToast={setToast}
            opponents={opponents}
          />
        );
      case 'winter_prep':
        return (
          <WinterPreparationView 
            data={vorbereitungWinter} 
            onAddOrUpdate={saveVorbereitungWinter} 
            onDelete={removeVorbereitungWinter}
            isEditing={isEditing} 
            setToast={setToast}
            opponents={opponents}
          />
        );
      case 'attendance':
        return (
          <TrainingAttendanceView 
            players={sortedPlayers}
            attendance={attendance}
            onUpdateAttendance={handleUpdateAttendance}
            onUpdatePlayer={(id, field, val) => {
              const player = players.find(p => p.id === id);
              if (player) saveSpieler({ ...player, [field]: val });
            }}
            onEditPlayer={(p) => {
              setEditingPlayer(p);
              setShowAddPlayerModal(true);
            }}
            onDeletePlayer={handleDeletePlayer}
            onAddPlayer={() => {
              setEditingPlayer(null);
              setShowAddPlayerModal(true);
            }}
            onClearRangeSessions={async (start, end) => {
              try {
                const batch = writeBatch(db);
                let hasUpdates = false;
                attendance.forEach((record) => {
                  const updates: any = {};
                  let recordHasUpdates = false;
                  for (let num = start; num <= end; num++) {
                    const isNested = record.sessions && record.sessions[num] !== undefined;
                    const isFlat = record[`sessions.${num}`] !== undefined;
                    if (isNested || isFlat) {
                      updates[`sessions.${num}`] = deleteField();
                      recordHasUpdates = true;
                    }
                  }
                  if (recordHasUpdates) {
                    const docRef = doc(db, 'attendance', record.playerId);
                    batch.update(docRef, updates);
                    hasUpdates = true;
                  }
                });
                if (hasUpdates) {
                  await batch.commit();
                }
                setToast({ message: `Einheiten ${start} bis ${end} wurden gelöscht`, id: Date.now() });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `attendance/clear/range-${start}-${end}`);
              }
            }}
            onClearAllSessions={async () => {
              try {
                const batch = writeBatch(db);
                let hasUpdates = false;
                attendance.forEach((record) => {
                  const docRef = doc(db, 'attendance', record.playerId);
                  batch.update(docRef, {
                    sessions: deleteField()
                  });
                  hasUpdates = true;
                });
                if (hasUpdates) {
                  await batch.commit();
                }
                setToast({ message: `Alle Trainingseinheiten wurden gelöscht`, id: Date.now() });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `attendance/clear/all`);
              }
            }}
            onClearSession={async (sessionNum) => {
              try {
                const batch = writeBatch(db);
                let hasUpdates = false;
                attendance.forEach((record) => {
                  const isNested = record.sessions && record.sessions[sessionNum] !== undefined;
                  const isFlat = record[`sessions.${sessionNum}`] !== undefined;
                  if (isNested || isFlat) {
                    const docRef = doc(db, 'attendance', record.playerId);
                    batch.update(docRef, {
                      [`sessions.${sessionNum}`]: deleteField()
                    });
                    hasUpdates = true;
                  }
                });
                if (hasUpdates) {
                  await batch.commit();
                }
                setToast({ message: `Trainingseinheit ${sessionNum} geleert`, id: Date.now() });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `attendance/clear/${sessionNum}`);
              }
            }}
            isEditing={isEditing}
          />
        );
      case 'yearly':
        const yearlyPlanRecord = yearlyPlan.reduce((acc: any, p: any) => {
          acc[p.date] = p;
          return acc;
        }, {});
        
        return (
          <YearlyPlanView 
            yearlyPlan={yearlyPlanRecord} 
            players={sortedPlayers}
            trainingSessions={trainingSessions}
            summerPrep={vorbereitungSommer}
            testMatches={testMatches}
            competitiveMatches={competitiveMatches}
            currentMonth={currentMonth} 
            setCurrentMonth={setCurrentMonth} 
            handleUpdateDayPlan={async (dateKey, field, val) => {
              if (isQuotaExceededActive() || !navigator.onLine) {
                setToast({ message: 'Plan lokal aktualisiert (Offline/Quota-Modus)', id: Date.now() });
                return;
              }
              try {
                const docRef = doc(db, 'yearly_plan', dateKey);
                try {
                  await updateDoc(docRef, cleanFirestoreData({
                    [field]: val
                  }));
                } catch (e: any) {
                  if (isQuotaError(e)) {
                    markQuotaExceeded();
                    return;
                  }
                  if (e.code === 'not-found') {
                    // If field has dots, we need to expand it for setDoc
                    const data: any = { date: dateKey };
                    if (field.includes('.')) {
                      const [parent, child] = field.split('.');
                      data[parent] = { [child]: val };
                    } else {
                      data[field] = val;
                    }
                    await setDoc(docRef, cleanFirestoreData(data));
                  } else {
                    throw e;
                  }
                }
                setToast({ message: 'Plan aktualisiert', id: Date.now() });
              } catch (err) {
                if (isQuotaError(err)) {
                  markQuotaExceeded();
                }
                console.error('Error updating plan:', err);
                setToast({ message: 'Plan lokal gespeichert', id: Date.now() });
              }
            }} 
            isEditing={isEditing}
          />
        );
      case 'cards':
        return (
          <CardStatisticsSheet 
            players={sortedPlayers}
            competitiveMatches={competitiveMatches}
            cardRecords={cardRecords}
            handleUpdateCard={async (playerId, matchId, card) => {
              if (isQuotaExceededActive() || !navigator.onLine) {
                setToast({ message: 'Karten lokal aktualisiert (Offline/Quota-Modus)', id: Date.now() });
                return;
              }
              try {
                const docRef = doc(db, 'card_records', playerId);
                try {
                  await updateDoc(docRef, cleanFirestoreData({
                    [`cards.${matchId}`]: card
                  }));
                } catch (e: any) {
                  if (isQuotaError(e)) {
                    markQuotaExceeded();
                    return;
                  }
                  if (e.code === 'not-found') {
                    await setDoc(docRef, cleanFirestoreData({
                      playerId: playerId,
                      cards: { [matchId]: card }
                    }));
                  } else {
                    throw e;
                  }
                }
                setToast({ message: 'Karten aktualisiert', id: Date.now() });
              } catch (err) {
                if (isQuotaError(err)) {
                  markQuotaExceeded();
                }
                console.error('Error updating cards:', err);
                setToast({ message: 'Karten lokal gespeichert', id: Date.now() });
              }
            }}
            onUpdatePlayer={(id, field, val) => {
              const player = players.find(p => p.id === id);
              if (player) saveSpieler({ ...player, [field]: val });
            }}
            onDeletePlayer={handleDeletePlayer}
            setShowAddPlayerModal={setShowAddPlayerModal}
            isEditing={isEditing}
          />
        );
      case 'scouting':
        return (
          <ScoutingView 
            scoutingCandidates={scoutingCandidates}
            scoutingViewMode={scoutingViewMode}
            setScoutingViewMode={setScoutingViewMode}
            setShowAddScoutingModal={setShowAddScoutingModal}
            handleUpdateScoutingCandidate={(id, field, val) => {
              const candidate = scoutingCandidates.find((c: any) => c.id === id);
              if (candidate) saveScoutingCandidate({ ...candidate, [field]: val });
            }}
            handleRemoveScoutingCandidate={(id) => handleDeleteItem('scouting_candidates', id, 'Kandidat')}
            setShowRemoveScoutingModal={setShowRemoveScoutingModal}
            onAddScoutingCandidate={(candidate) => {
              saveScoutingCandidate({ ...candidate, id: Date.now().toString(), createdAt: Date.now() });
              setToast({ message: 'Scouting-Kandidat erfolgreich angelegt.', id: Date.now() });
            }}
            handleResetScouting={handleResetScouting}
            depthChart={depthChart[0] || {}}
            setDepthChart={(chart) => {
              const currentChart = depthChart[0] || { id: 'current' };
              void saveDepthChart({ ...currentChart, ...chart, id: 'current' });
            }}
            players={sortedPlayers}
            isEditing={isEditing}
          />
        );
      case 'budget_finance':
        return (
          <BudgetFinanceView 
            players={sortedPlayers}
            financeMeta={financeMeta[0] || { month: '2026-07', wins: 0, draws: 0, bonusPerPoint: 0 }}
            setFinanceMeta={(meta) => {
              const currentMeta = financeMeta[0] || { id: 'current', month: '2026-07', wins: 0, draws: 0, bonusPerPoint: 0 };
              const newMeta = typeof meta === 'function' ? meta(currentMeta) : meta;
              saveFinanceMeta({ ...newMeta, id: 'current' });
            }}
            handleUpdateFinance={(playerId, field, value) => {
              const player = players.find(p => p.id === playerId);
              if (player) {
                const updatedPlayer = {
                  ...player,
                  finance: {
                    ...player.finance,
                    [field]: value
                  }
                };
                saveSpieler(updatedPlayer);
              }
            }}
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            isEditing={isEditing}
          />
        );
      case 'meetings_calendar':
        return (
          <MeetingsCalendarView 
            players={sortedPlayers}
            scoutingCandidates={scoutingCandidates}
            meetingsData={meetingsData}
            handleAddMeetingEntry={() => setShowAddMeetingModal(true)}
            handleUpdateMeetingEntry={(id, field, val) => {
              const entry = meetingsData.find((m: any) => m.id === id);
              void saveMeetingEntry({ ...entry, [field]: val });
            }}
            handleRemoveMeetingEntry={(id) => handleDeleteItem('meetings_data', id, 'Termin')}
            handleResetMeetings={handleResetMeetings}
            handleImportMeetings={handleImportMeetings}
            onAddScoutingCandidate={(candidate) => {
              saveScoutingCandidate({ ...candidate, id: Date.now().toString(), createdAt: Date.now() });
              setToast({ message: 'Scouting-Kandidat erfolgreich angelegt.', id: Date.now() });
            }}
            isEditing={isEditing}
          />
        );
      case 'individual_control':
        return (
          <IndividualSteuerungView 
            players={sortedPlayers}
            individualTrainingData={individualTrainingData}
            selectedIndividualDate={selectedIndividualDate}
            setSelectedIndividualDate={setSelectedIndividualDate}
            handleUpdateIndividualTraining={(playerId, field, val) => {
              const id = `${playerId}_${selectedIndividualDate}`;
              const existingRecord = individualTrainingData.find((r: any) => r.id === id);
              
              if (field === 'delete' && existingRecord) {
                removeIndividualTraining(existingRecord.id)
                  .then(() => {
                    setToast({ message: 'Eintrag gelöscht', id: Date.now() });
                  })
                  .catch((err) => {
                    console.error('Error deleting individual training:', err);
                    setToast({ message: 'Fehler beim Löschen', id: Date.now() });
                  });
                return;
              }

              const record = existingRecord || { 
                id, 
                playerId, 
                date: selectedIndividualDate,
                focus: '',
                goals: '',
                status: '',
                load: 'Normal',
                targetDate: selectedIndividualDate,
                ek: '', o: '', t: '', p: '', s: '', a: '', w: ''
              };
              
              saveIndividualTraining({ ...record, [field]: val })
                .then(() => {
                  console.log(`Updated individual training for ${playerId} on ${selectedIndividualDate}: ${field} = ${val}`);
                })
                .catch((err) => {
                  console.error('Error updating individual training:', err);
                  setToast({ message: 'Fehler beim Speichern der Daten', id: Date.now() });
                });
            }}
            onUpdatePlayer={(id, field, val) => {
              const player = players.find(p => p.id === id);
              if (player) {
                const updated = { ...player, [field]: val };
                if (field === 'firstName' || field === 'lastName') {
                  updated.name = `${updated.firstName || ''} ${updated.lastName || ''}`.trim();
                }
                saveSpieler(updated);
              }
            }}
            onDeletePlayer={handleDeletePlayer}
            onAddPlayer={() => setShowAddPlayerModal(true)}
            onAddPlayerDirect={handleAddPlayer}
            isEditing={isEditing}
          />
        );
      case 'runs_sw':
        return (
          <RunsSWView 
            players={sortedPlayers}
            runRecords={runRecords}
            runMeta={runMeta}
            onUpdateRunRecord={(record) => {
              saveRunRecord(record)
                .then(() => {
                  console.log('Lauf-Datensatz aktualisiert:', record.id);
                })
                .catch((err) => {
                  console.error('Fehler beim Aktualisieren des Lauf-Datensatzes:', err);
                  setToast({ message: 'Fehler beim Speichern der Daten', id: Date.now() });
                });
            }}
            onUpdateRunMeta={(meta) => {
              saveRunMeta(meta)
                .then(() => {
                  setToast({ message: 'Lauf-Konfiguration gespeichert', id: Date.now() });
                })
                .catch((err) => {
                  console.error('Fehler beim Speichern der Lauf-Meta:', err);
                });
            }}
            onUpdatePlayer={(id, field, val) => {
              const player = players.find(p => p.id === id);
              if (player) {
                const updated = { ...player, [field]: val };
                if (field === 'firstName' || field === 'lastName') {
                  updated.name = `${updated.firstName || ''} ${updated.lastName || ''}`.trim();
                }
                saveSpieler(updated);
              }
            }}
            isEditing={isEditing}
          />
        );
      case 'physio_plan':
        return (
          <PhysioPlanView 
            players={sortedPlayers}
            physioEntries={physioEntries}
            onAddPhysioEntry={() => setShowAddPhysioModal(true)}
            onUpdatePhysioEntry={(entry) => {
              savePhysioEntry(entry)
                .then(() => {
                  console.log('Physio-Eintrag aktualisiert:', entry.id);
                })
                .catch((err) => {
                  console.error('Fehler beim Aktualisieren des Physio-Eintrags:', err);
                  setToast({ message: 'Fehler beim Speichern der Daten', id: Date.now() });
                });
            }}
            onUpdatePlayer={(id, field, val) => {
              const player = players.find(p => p.id === id);
              if (player) {
                const updated = { ...player, [field]: val };
                if (field === 'firstName' || field === 'lastName') {
                  updated.name = `${updated.firstName || ''} ${updated.lastName || ''}`.trim();
                }
                saveSpieler(updated);
              }
            }}
            onDeletePlayer={handleDeletePlayer}
            onDeletePhysioEntry={(id) => handleDeleteItem('physio_entries', id, 'Physio-Eintrag')}
            setShowAddPlayerModal={setShowAddPlayerModal}
            isEditing={isEditing}
          />
        );
      case 'tacticboard':
      case 'profi_3d_taktiktafel':
        return (
          <Profi3DTacticBoardView 
            players={sortedPlayers.filter(isPlayer)} 
            onNavigateToVideo={() => setActiveTab('video_analysis')}
            isEditing={isEditing}
          />
        );
      case 'trainer_view':
        return (
          <FormationView 
            players={sortedPlayers.filter(isPlayer)} 
            scoutingCandidates={scoutingCandidates}
            formation={formation.find(f => f.id === 'current')?.value || '4-4-2'} 
            onFormationChange={(f) => saveFormation({ id: 'current', value: f })} 
            isEditing={isEditing}
          />
        );
      case 'training_planning':
        return (
          <TrainingPlanningView 
            players={sortedPlayers} 
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
            onEmail={handleEmail}
            onWhatsApp={handleShareText}
            competitiveMatches={competitiveMatches}
          />
        );
      case 'developer_tasks':
        if (!isDevUnlocked && !isOwner) {
          return (
            <div className="flex flex-col items-center justify-center h-full bg-[#0A0E17] p-8">
              <div className="bg-[#121824] border border-[#2A2A2A] shadow-2xl p-8 max-w-md w-full rounded-2xl text-[#F5F5F5]">
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-4 text-[#F5F5F5]">Bereich Geschützt</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-[#C7C7C7] mb-6">Bitte Passwort eingeben, um die Dev-Roadmap freizuschalten.</p>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (devPassword === '2011') {
                      setIsDevUnlocked(true);
                      setToast({ message: 'Dev-Roadmap freigeschaltet!', id: Date.now() });
                    } else {
                      setToast({ message: 'Falsches Passwort!', id: Date.now() });
                    }
                  }}
                  className="space-y-4"
                >
                  <input 
                    type="password" 
                    value={devPassword}
                    onChange={(e) => setDevPassword(e.target.value)}
                    placeholder="PASSWORT..."
                    className="w-full bg-[#1E293B] border-2 border-[#2A2A2A] p-3 font-black text-[#F5F5F5] focus:outline-none focus:border-[#FFD54F] uppercase text-sm rounded-xl"
                    autoFocus
                  />
                  <button 
                    type="submit"
                    className="w-full bg-[#FFD54F] hover:bg-[#FFE082] text-[#0F0F0F] py-3 font-black uppercase tracking-widest rounded-xl shadow-md transition-all border border-[#FFD54F]"
                  >
                    Freischalten
                  </button>
                </form>
              </div>
            </div>
          );
        }
        return (
          <DeveloperTasksView 
            onOpenAgentControlCenter={() => setShowAgentControlCenterModal(true)} 
            isDeveloper={isOwner || isDevUnlocked}
            players={sortedPlayers.filter(isPlayer)}
            onNavigateToVideo={() => setActiveTab('video_analysis')}
            isEditing={isEditing}
            isOwner={isOwner}
            onOpen3DModal={() => setShow3DProfiBoardModal(true)}
          />
        );
      case 'competitive_planning':
        return (
          <MatchPlanningView 
            players={sortedPlayers}
            matches={competitiveMatches}
            matchMinutes={competitiveMinutes}
            opponents={opponents}
            onSaveMatch={saveCompMatch}
            onDeleteMatch={deleteCompMatch}
            onSaveMinutes={saveCompMinutes}
            onSaveOpponent={saveOpponent}
            onDeleteOpponent={deleteOpponent}
            onWipeAllMatches={handleWipeAllCompetitiveMatches}
            onRestoreMatches={handleRestoreCompetitiveMatches}
            title="Pflichtspiel-Planung"
          />
        );
      case 'test_planning':
        return (
          <MatchPlanningView 
            players={sortedPlayers}
            matches={testMatches}
            matchMinutes={testMinutes}
            opponents={opponents}
            onSaveMatch={saveTestMatch}
            onDeleteMatch={deleteTestMatch}
            onSaveMinutes={saveTestMinutes}
            onSaveOpponent={saveOpponent}
            onDeleteOpponent={deleteOpponent}
            title="Testspiel-Planung"
          />
        );
      case 'u23_planning':
        return (
          <MatchPlanningView 
            players={sortedPlayers}
            matches={u23Matches}
            matchMinutes={u23Minutes}
            opponents={opponents}
            onSaveMatch={saveU23Match}
            onDeleteMatch={deleteU23Match}
            onSaveMinutes={saveU23Minutes}
            onSaveOpponent={saveOpponent}
            onDeleteOpponent={deleteOpponent}
            title="U23 – Einsatzzeiten A‑Kader"
          />
        );
      case 'match_report':
        return (
          <MatchReportView 
            matches={competitiveMatches}
            testMatches={testMatches}
            analyses={matchAnalyses}
            onSaveAnalysis={saveMatchAnalysis}
            onDeleteAnalysis={(id) => handleDeleteItem('match_analyses', id, 'Spielbericht')}
            opponents={opponents}
            players={sortedPlayers}
          />
        );
      case 'team_list':
        return (
          <TeamListView 
            players={sortedPlayers} 
            onEditPlayer={(p) => {
              setEditingPlayer(p);
              setShowAddPlayerModal(true);
            }}
            onAddPlayer={() => {
              setEditingPlayer(null);
              setShowAddPlayerModal(true);
            }}
            isEditing={isEditing}
          />
        );
      case 'tracker_academy_report':
      case 'player_portal':
        return (
          <PlayerPortalView 
            players={sortedPlayers}
            sessionLogs={playerSessionLogs || []}
            onSaveLog={async (log) => {
              try {
                await savePlayerSessionLog(log);
                setToast({ message: 'Einheit erfolgreich gespeichert!', id: Date.now() });
              } catch (err) {
                console.error("Fehler beim Speichern des Logs:", err);
                setToast({ message: 'Fehler beim Speichern der Einheit!', id: Date.now() });
              }
            }}
            onDeleteLog={async (id) => {
              try {
                await deletePlayerSessionLog(id);
                setToast({ message: 'Einheit erfolgreich gelöscht!', id: Date.now() });
              } catch (err) {
                console.error("Fehler beim Löschen des Logs:", err);
                setToast({ message: 'Fehler beim Löschen der Einheit!', id: Date.now() });
              }
            }}
            onUpdatePlayerDiagnostics={async (playerId, diagnostics) => {
              try {
                const player = players.find(p => p.id === playerId);
                if (player) {
                  const updatedDiagnostics = {
                    ...(player.diagnostics || {}),
                    ...diagnostics
                  };
                  await saveSpieler({
                    ...player,
                    diagnostics: updatedDiagnostics
                  });
                }
              } catch (err) {
                console.error("Fehler beim Aktualisieren der Diagnostics:", err);
              }
            }}
            onUpdatePlayerStats={async (playerId, minutes, goals, assists) => {
              try {
                const player = players.find(p => p.id === playerId);
                if (player) {
                  const currentMinutes = player.einsatzzeitenGesamt || 0;
                  await saveSpieler({
                    ...player,
                    einsatzzeitenGesamt: currentMinutes + minutes
                  });
                }
              } catch (err) {
                console.error("Fehler beim Aktualisieren der Spieler-Statistiken:", err);
              }
            }}
            onUpdatePlayerDatenblatt={async (playerId, report) => {
              try {
                const player = players.find(p => p.id === playerId);
                if (player) {
                  await saveSpieler({
                    ...player,
                    datenblattReport: report
                  });
                  setToast({ message: 'Datenblatt erfolgreich gespeichert!', id: Date.now() });
                }
              } catch (err) {
                console.error("Fehler beim Aktualisieren des Datenblatts:", err);
                setToast({ message: 'Fehler beim Speichern des Datenblatts!', id: Date.now() });
              }
            }}
            onUpdatePlayerTracker={async (playerId, trackerData) => {
              try {
                const player = players.find(p => p.id === playerId);
                if (player) {
                  const existingHistory = (player.trackerHistory || []) as any[];
                  
                  // Check if trackerData is a DecodedTrackerData object or standard summary
                  const newHistoryItem = trackerData.gesamtDistanzMeter !== undefined ? {
                    id: trackerData.id || `tracker_${Date.now()}`,
                    spielerId: trackerData.spielerId || playerId,
                    name: trackerData.name || `${player.firstName} ${player.lastName}`.trim(),
                    datum: trackerData.datum || new Date().toISOString().split('T')[0],
                    uhrzeit: trackerData.uhrzeit || '18:30',
                    trainingId: trackerData.trainingId || `TR-${Date.now()}`,
                    trackerQuelle: trackerData.trackerQuelle || 'GPS-Tracker XY',
                    gesamtDistanzMeter: trackerData.gesamtDistanzMeter || 0,
                    gesamtDauerSekunden: trackerData.gesamtDauerSekunden || 0,
                    durchschnittsGeschwindigkeitKmh: trackerData.durchschnittsGeschwindigkeitKmh || 0,
                    maxGeschwindigkeitKmh: trackerData.maxGeschwindigkeitKmh || 0,
                    durchschnittsHerzfrequenz: trackerData.durchschnittsHerzfrequenz || 0,
                    maxHerzfrequenz: trackerData.maxHerzfrequenz || 0,
                    belastungsZonen: trackerData.belastungsZonen || { zone1LockerMin: 0, zone2NormalMin: 0, zone3IntensivMin: 0, zone4SehrIntensivMin: 0 },
                    sprints: trackerData.sprints || [],
                    gpsPunkte: trackerData.gpsPunkte || [],
                    fileName: trackerData.fileName || 'Tracker_Data.bin',
                    uploadedAt: trackerData.uploadedAt || new Date().toISOString()
                  } : {
                    id: `tracker_${Date.now()}`,
                    spielerId: playerId,
                    name: `${player.firstName} ${player.lastName}`.trim(),
                    datum: trackerData.uploadDate || new Date().toISOString().split('T')[0],
                    uhrzeit: '18:30',
                    trainingId: `TR-${Date.now()}`,
                    trackerQuelle: 'GPS-Tracker XY',
                    gesamtDistanzMeter: Math.round((trackerData.totalDistanceKm || 0) * 1000),
                    gesamtDauerSekunden: 5400,
                    durchschnittsGeschwindigkeitKmh: 12.5,
                    maxGeschwindigkeitKmh: trackerData.maxSpeedKmh || 28.5,
                    durchschnittsHerzfrequenz: 155,
                    maxHerzfrequenz: 188,
                    belastungsZonen: { zone1LockerMin: 20, zone2NormalMin: 30, zone3IntensivMin: 25, zone4SehrIntensivMin: 15 },
                    sprints: [],
                    gpsPunkte: [],
                    fileName: trackerData.fileName || 'Tracker_Data.bin',
                    uploadedAt: new Date().toISOString(),
                    fileUrl: trackerData.fileUrl || '',
                    matchName: trackerData.matchName || 'Spielanalyse',
                    tacticalSummary: trackerData.tacticalSummary || ''
                  };

                  await saveSpieler({
                    ...player,
                    trackerAnalysis: trackerData,
                    trackerHistory: [newHistoryItem, ...existingHistory]
                  });
                  setToast({ message: 'GPS / Tracker-Analyse erfolgreich im Spielerordner gespeichert!', id: Date.now() });
                }
              } catch (err) {
                console.error("Fehler beim Speichern der Tracker-Analyse:", err);
                setToast({ message: 'Fehler beim Speichern der Tracker-Analyse!', id: Date.now() });
              }
            }}
            onDeletePlayerTracker={async (playerId, trackerId) => {
              try {
                const player = players.find(p => p.id === playerId);
                if (player) {
                  const existingHistory = (player.trackerHistory || []) as any[];
                  const updatedHistory = existingHistory.filter((item: any) => item.id !== trackerId);
                  await saveSpieler({
                    ...player,
                    trackerHistory: updatedHistory
                  });
                  setToast({ message: 'Tracker-Eintrag erfolgreich gelöscht!', id: Date.now() });
                }
              } catch (err) {
                console.error("Fehler beim Löschen des Tracker-Eintrags:", err);
                setToast({ message: 'Fehler beim Löschen des Tracker-Eintrags!', id: Date.now() });
              }
            }}
            onUpdatePlayerMovementPoints={async (playerId, points) => {
              try {
                const player = players.find(p => p.id === playerId);
                if (player) {
                  await saveSpieler({
                    ...player,
                    movementPoints: points
                  });
                  setToast({ message: 'Bewegungsprofil erfolgreich aktualisiert!', id: Date.now() });
                }
              } catch (err) {
                console.error("Fehler beim Speichern des Bewegungsprofils:", err);
                setToast({ message: 'Fehler beim Speichern des Bewegungsprofils!', id: Date.now() });
              }
            }}
            onUpdatePlayerVideos={async (playerId, videoClips) => {
              try {
                const player = players.find(p => p.id === playerId);
                if (player) {
                  await saveSpieler({
                    ...player,
                    videoHighlights: videoClips
                  });
                  setToast({ message: 'Video-Highlights erfolgreich aktualisiert!', id: Date.now() });
                }
              } catch (err) {
                console.error("Fehler beim Speichern der Video-Highlights:", err);
                setToast({ message: 'Fehler beim Speichern der Video-Highlights!', id: Date.now() });
              }
            }}
            competitiveMatches={competitiveMatches}
            competitiveMinutes={competitiveMinutes}
            testMatches={testMatches}
            testMinutes={testMinutes}
            trackerAcademyReports={trackerAcademyReports || []}
            saveTrackerAcademyReport={saveTrackerAcademyReport}
            deleteTrackerAcademyReport={deleteTrackerAcademyReport}
            onUpdatePlayer={async (id, field, value) => {
              const p = players.find(x => x.id === id);
              if (p) {
                await saveSpieler({ ...p, [field]: value });
              }
            }}
          />
        );
      case 'access_control':
        return (
          <AccessControlView 
            ownerEmail={ownerEmail}
            securityLockActive={securityLockActive}
            onToggleSecurityLock={setSecurityLockActive}
          />
        );
      case 'video_analysis':
        return <VideoAnalysisView players={sortedPlayers} isOwner={isOwner} />;
      case 'academy_analysis':
        return (
          <AcademyAnalysisView 
            players={sortedPlayers}
            sessionEvaluations={academyEvaluations || []}
            weeklyReports={academyWeeklyReports || []}
            attendance={attendance || []}
            saveSessionEvaluation={saveAcademyEvaluation}
            deleteSessionEvaluation={deleteAcademyEvaluation}
            saveWeeklyReport={saveAcademyWeeklyReport}
            deleteWeeklyReport={deleteAcademyWeeklyReport}
          />
        );
      case 'champions_cup':
        return (
          <ChampionsCupProView 
            players={sortedPlayers}
            isEditing={isEditing}
            setToast={setToast}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
            <div className="w-20 h-20 border-4 border-dashed border-gray-300 rounded-full flex items-center justify-center">
              <Clock size={32} />
            </div>
            <p className="font-black uppercase tracking-[0.3em] text-sm">Modul in Vorbereitung...</p>
          </div>
        );
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleSyncError = (e: any) => {
      if (e.detail?.error === null) {
        setQuotaError(false);
        setLastError(null);
        setToast({ message: 'Datenbankverbindung wiederhergestellt. Daten erfolgreich synchronisiert!', id: Date.now() });
        return;
      }
      const errMessage = e.detail?.error || '';
      console.warn("Sync error caught in UI:", errMessage);
      if (errMessage.includes('Quota limit exceeded') || errMessage.toLowerCase().includes('quota')) {
        setQuotaError(true);
        setLastError('Datenbank-Limit erreicht (Tageskontingent überschritten). Offline-Modus aktiv – Änderungen werden lokal gespeichert.');
      } else {
        setLastError(errMessage || 'Synchronisierungsfehler');
      }
      setTimeout(() => setLastError(null), 10000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('fca_sync_error', handleSyncError);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('fca_sync_error', handleSyncError);
    };
  }, []);

  if (authLoading || isLoading) {
    return (
      <div className="h-screen w-screen flex-col flex items-center justify-center bg-black text-white p-8">
        <div className="w-16 h-16 border-4 border-white border-t-[#C00000] rounded-full animate-spin mb-8" />
        <h1 className="font-black uppercase tracking-[0.2em] text-2xl">FC AUGGEN</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-4">
          Daten werden synchronisiert...
        </p>
      </div>
    );
  }

  // FC AUGGEN: Login nur für diese Browsersession (bei jedem Start neu anmelden)
  // Unauthorized visitors or visitors starting a fresh browser session must log in first.
  if (!isSessionAuthenticated) {
    return (
      <SessionLoginView
        ownerEmail={ownerEmail}
        onUnlockOwner={handleUnlockOwner}
        onGoogleLogin={handleGoogleLoginOwner}
      />
    );
  }

  // EXCLUSIVE OWNER LOCK:
  // If the security lock is active and the visitor is NOT verified as Samer Khaleel,
  // display the technical error screen (HTTP 503 Service Unavailable / Connection Refused).
  if (securityLockActive && !isOwner) {
    return (
      <TechnicalErrorView
        ownerEmail={ownerEmail}
        onUnlockOwner={handleUnlockOwner}
        onGoogleLogin={handleGoogleLoginOwner}
      />
    );
  }

  return (
      <div className="flex h-screen bg-[#0A0E17] text-[#F5F5F5] font-sans overflow-hidden selection:bg-[#10B981] selection:text-[#0A0E17] print:h-auto print:overflow-visible print:bg-white">
        {quotaError && !dismissQuotaBanner && (
          <div className="fixed top-0 left-0 w-full bg-[#121824] border-b border-[#2A2A2A] text-[#F5F5F5] px-4 py-3 text-xs font-bold flex flex-wrap items-center justify-between gap-3 z-50 print:hidden shrink-0 backdrop-blur-md">
            <div className="flex items-start gap-2 max-w-3xl">
              <span className="text-base mt-0.5">⚠️</span>
              <div>
                <p className="font-black uppercase tracking-wider text-[10px] text-[#FFD54F] mb-0.5">Firestore Quota erreicht (Tageslimit überschritten)</p>
                <p className="font-medium text-[#F5F5F5] leading-relaxed">
                  Das kostenlose Tageslimit an Datenbank-Lesevorgängen/Schreibvorgängen ist aufgebraucht. 
                  <strong className="font-bold text-[#F5F5F5]"> Die App läuft vollkommen offline weiter!</strong> Deine Änderungen (wie z.B. Einheiten, Aufstellungen) werden sicher lokal in deinem Browser gespeichert.
                </p>
                <p className="font-medium text-[#C7C7C7] mt-1 flex items-center gap-1.5 bg-[#1E293B] px-2 py-0.5 rounded-lg border border-[#2A2A2A] w-fit text-[11px]">
                  <span>🕒</span>
                  <span><strong>Wie lange dauert das?</strong> Das Limit wird von Google jeden Tag automatisch um <strong>09:00 Uhr deutscher Zeit</strong> zurückgesetzt. Danach synchronisiert sich alles wieder von selbst!</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  clearQuotaExceeded();
                  setQuotaError(false);
                  setToast({ message: 'Online-Synchronisation für Inhaber wieder aktiviert!', id: Date.now() });
                }}
                className="bg-[#10B981] text-white px-3 py-1.5 text-[10px] uppercase font-black tracking-wider hover:bg-emerald-600 transition-colors rounded-xl shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                title="Synchronisation jetzt sofort erzwingen und Sperre aufheben"
              >
                Sync jetzt aktivieren
              </button>
              <button 
                onClick={() => {
                  setDismissQuotaBanner(true);
                  try {
                    localStorage.setItem('fca_dismiss_quota_banner', 'true');
                  } catch {}
                  setQuotaError(false);
                }}
                className="bg-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#2A2A2A] rounded-lg px-2.5 py-1.5 font-bold text-[10px] transition-colors border border-[#2A2A2A]"
                title="Nicht mehr anzeigen"
              >
                Nicht mehr anzeigen ✕
              </button>
            </div>
          </div>
        )}

        {/* LEFT VERTICAL SIDEBAR */}
        <aside className="w-64 bg-[#121824] border-r border-[#334155]/80 flex flex-col shrink-0 z-40 print:hidden shadow-xl">
          {/* Header Branding in Sidebar */}
          <div className="p-4 border-b border-[#334155]/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center font-black text-black text-xs shadow-[0_0_12px_rgba(245,158,11,0.5)] border border-[#FBBF24]">
                FCA
              </div>
              <div>
                <h1 className="text-xs font-black tracking-wider text-[#F8FAFC]">
                  FC AUGGEN 1921 <span className="text-[#F59E0B]">e.V.</span>
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-bold bg-[#F59E0B]/15 text-[#F59E0B] px-1.5 py-0.5 rounded border border-[#F59E0B]/30">
                    Manager 26/27
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">Verbandsliga Südbaden</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Categories List */}
          <div className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
            {/* Mode Switcher Box */}
            <div className="p-2.5 rounded-xl bg-[#0F172A] border border-[#334155]/80 shadow-md">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                  Ansichts-Modus
                </span>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                  viewMode === 'focus'
                    ? 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30'
                    : 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30'
                }`}>
                  {viewMode === 'focus' ? '⚡ Fokus' : '🏆 Profi'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#1E293B] rounded-lg border border-[#334155]">
                <button
                  onClick={() => handleToggleViewMode('focus')}
                  className={`px-2 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    viewMode === 'focus'
                      ? 'bg-[#F59E0B] text-[#0A0E17] font-black shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                  title="Kompakter Alltagsmodus mit den wichtigsten Funktionen"
                >
                  <span>⚡ Fokus</span>
                </button>
                <button
                  onClick={() => handleToggleViewMode('pro')}
                  className={`px-2 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    viewMode === 'pro'
                      ? 'bg-[#10B981] text-[#0A0E17] font-black shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                  title="Alle 28 Spezialmodule & Detailbereiche"
                >
                  <span>🏆 Profi</span>
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 px-0.5 text-[9px] text-[#94A3B8]">
                <span>{viewMode === 'focus' ? 'Alltag (6 Module)' : 'Vollständig (28)'}</span>
                <button
                  onClick={() => handleToggleViewMode(viewMode === 'focus' ? 'pro' : 'focus')}
                  className="text-[#F59E0B] hover:underline font-bold cursor-pointer"
                >
                  {viewMode === 'focus' ? '↩️ Rückgängig' : '⚡ Zu Fokus'}
                </button>
              </div>
            </div>

            {viewMode === 'focus' ? (
              <div className="space-y-1">
                <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  Kern-Bereiche (Alltag)
                </div>
                {[
                  { id: 'dashboard' as TabId, label: 'Dashboard (Zentrale)', icon: LayoutDashboard },
                  { id: 'personnel' as TabId, label: 'Kader & Ausfälle', icon: User },
                  { id: 'competitive_planning' as TabId, label: 'Pflichtspiele (Liga)', icon: Trophy },
                  { id: 'match_report' as TabId, label: 'Spielberichte', icon: FileText },
                  { id: 'attendance' as TabId, label: 'Training & Anwesenheit', icon: Activity },
                  { id: 'player_portal' as TabId, label: 'Spieler-Bereich', icon: UserCheck },
                ].map(item => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-3 cursor-pointer text-left ${
                        isActive
                          ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/40 font-bold shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                          : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]/60 border border-transparent'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-[#F59E0B]' : 'text-[#64748B]'} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}

                <div className="pt-2.5 border-t border-[#334155]/40 mt-3">
                  <button
                    onClick={() => handleToggleViewMode('pro')}
                    className="w-full px-3 py-2 rounded-xl text-[11px] font-bold bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] border border-[#334155] flex items-center justify-between transition-all cursor-pointer group shadow"
                    title="Alle Module & Kategorien anzeigen"
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} className="text-[#10B981]" />
                      <span>Alle Module ({isOwner ? 29 : 28})</span>
                    </span>
                    <span className="text-[10px] text-[#F59E0B] group-hover:translate-x-0.5 transition-transform font-mono">
                      Öffnen →
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  Kategorien (Profi-Modus)
                </div>
                {[
                  { id: 'ubersicht', label: 'Übersicht', icon: LayoutDashboard, defaultTab: 'dashboard' as TabId, tabIds: ['dashboard', 'developer_tasks', 'tacticboard'] },
                  { id: 'kader', label: 'Kader & Spieler', icon: User, defaultTab: 'personnel' as TabId, tabIds: ['personnel', 'team_list', 'player_portal', 'scouting'] },
                  { id: 'training', label: 'Training & Performance', icon: Activity, defaultTab: 'academy_analysis' as TabId, tabIds: ['academy_analysis', 'attendance', 'training_planning', 'individual_control', 'runs_sw', 'summer_prep', 'winter_prep'] },
                  { id: 'match', label: 'Match & Taktik', icon: Trophy, defaultTab: 'competitive_planning' as TabId, tabIds: ['champions_cup', 'competitive_planning', 'test_planning', 'u23_planning', 'match_report', 'trainer_view', 'video_analysis'] },
                  { id: 'orga', label: 'Organisation', icon: FolderKanban, defaultTab: 'yearly' as TabId, tabIds: ['yearly', 'budget_finance', 'meetings_calendar', 'physio_plan', 'access_control'] },
                  { id: 'all', label: isOwner ? 'Alle (29)' : 'Alle (28)', icon: Layers, defaultTab: 'dashboard' as TabId, tabIds: [] },
                ].map(cat => {
                  const isCatActive = navCategory === cat.id;
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setNavCategory(cat.id as any);
                        if (cat.id !== 'all' && !cat.tabIds.includes(activeTab)) {
                          handleTabClick(cat.defaultTab);
                        }
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-3 cursor-pointer text-left ${
                        isCatActive
                          ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/40 font-bold shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                          : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]/60 border border-transparent'
                      }`}
                    >
                      <Icon size={16} className={isCatActive ? 'text-[#F59E0B]' : 'text-[#64748B]'} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Theme Mode & Fullscreen Toggle Footer */}
          <div className="p-3 border-t border-[#334155]/40 flex items-center gap-2">
            <button
              onClick={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
              className="flex-1 px-2.5 py-2 text-xs font-medium rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] border border-[#334155] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title={themeMode === 'dark' ? 'Zu Light Mode wechseln' : 'Zu Dark Mode wechseln'}
            >
              {themeMode === 'dark' ? <Sun size={14} className="text-[#F59E0B]" /> : <Moon size={14} className="text-[#10B981]" />}
              <span>{themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              onClick={toggleBrowserFullscreen}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isFullscreen 
                  ? 'bg-[#10B981] text-[#0A0E17] border-[#10B981] font-bold shadow-[0_0_10px_rgba(16,185,129,0.5)]' 
                  : 'bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] border-[#334155]'
              }`}
              title="Browser Vollbild Modus (F11)"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>Vollbild</span>
            </button>
          </div>
        </aside>

        {/* RIGHT MAIN CONTAINER */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0A0E17]">
          {/* TAB-NAVI BAR (OPEN TEXT TABS WITH DECENT ORANGE UNDERLINE) */}
          <nav className="bg-[#121824]/90 border-b border-[#334155]/80 px-4 py-2.5 flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar shrink-0 z-30">
            {TABS.filter(tab => {
              if (tab.id === 'access_control' && !isOwner) return false;
              if (viewMode === 'focus') {
                return ['dashboard', 'personnel', 'competitive_planning', 'match_report', 'attendance', 'player_portal'].includes(tab.id);
              }
              if (navCategory === 'all') return true;
              if (navCategory === 'ubersicht') return ['dashboard', 'developer_tasks', 'tacticboard'].includes(tab.id);
              if (navCategory === 'kader') return ['personnel', 'team_list', 'player_portal', 'scouting'].includes(tab.id);
              if (navCategory === 'training') return ['academy_analysis', 'attendance', 'training_planning', 'individual_control', 'runs_sw', 'summer_prep', 'winter_prep'].includes(tab.id);
              if (navCategory === 'match') return ['champions_cup', 'competitive_planning', 'test_planning', 'u23_planning', 'match_report', 'trainer_view', 'video_analysis'].includes(tab.id);
              if (navCategory === 'orga') return ['yearly', 'budget_finance', 'meetings_calendar', 'physio_plan', 'access_control'].includes(tab.id);
              return true;
            }).map(tab => {
              const isAcademy = tab.id === 'academy_analysis';
              const isCup = tab.id === 'champions_cup';
              const isVideo = tab.id === 'video_analysis';
              const isActive = activeTab === tab.id;

              // Custom label formatting
              let displayLabel = tab.label;
              if (tab.id === 'champions_cup') displayLabel = 'Champions Cup Pro';
              if (tab.id === 'competitive_planning') displayLabel = 'Pflichtspiele';
              if (tab.id === 'test_planning') displayLabel = 'Testspiele';
              if (tab.id === 'u23_planning') displayLabel = 'U23 – Einsatzzeiten A‑Kader';
              if (tab.id === 'match_report') displayLabel = 'Spielbericht';
              if (tab.id === 'tacticboard') displayLabel = '3D-Taktiktafel (Dev-Roadmap)';
              if (tab.id === 'trainer_view') displayLabel = 'Kaderübersicht & Grundordnung';
              if (tab.id === 'video_analysis') displayLabel = 'Videoanalyse (Beta)';

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`py-1.5 text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer relative ${
                    isActive 
                      ? 'text-[#F59E0B] font-bold border-b-2 border-[#F59E0B] -mb-2.5 pb-2' 
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <span>{displayLabel}</span>
                  {isCup && (
                    <span className="text-[9px] bg-[#F59E0B]/20 text-[#F59E0B] px-1.5 py-0.5 rounded font-mono font-bold border border-[#F59E0B]/40">
                      Pro
                    </span>
                  )}
                  {isVideo && (
                    <span className="text-[9px] bg-[#06B6D4]/20 text-[#06B6D4] px-1.5 py-0.5 rounded font-mono font-bold border border-[#06B6D4]/40">
                      Beta
                    </span>
                  )}
                  {isAcademy && <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.8)]" />}
                </button>
              );
            })}

            {/* Quick Toggle & Link Sharing on the far right of the tab bar */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyStandaloneAppLink}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold border border-blue-400 text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow whitespace-nowrap"
                title="App-Link für Kollegen kopieren (ohne Gemini Chat)"
              >
                <Share2 size={12} className="text-blue-100" />
                <span>Link für Kollegen</span>
              </button>

              {viewMode === 'focus' ? (
                <button
                  onClick={() => handleToggleViewMode('pro')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow whitespace-nowrap"
                  title="Gefällt es dir nicht? Hier mit 1 Klick alle 28 Module wieder anzeigen"
                >
                  <RotateCcw size={12} className="text-emerald-400" />
                  <span>Rückgängig: Alle 28 Module</span>
                </button>
              ) : (
                <button
                  onClick={() => handleToggleViewMode('focus')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow whitespace-nowrap"
                  title="Zum kompakten Alltags-Modus wechseln"
                >
                  <span>⚡ Zum Fokus-Modus</span>
                </button>
              )}
            </div>
          </nav>

          {/* Main Content View Canvas */}
          <main className="flex-1 p-3 sm:p-5 overflow-hidden bg-[#0A0E17] text-[#F5F5F5] print:p-0 print:bg-white print:overflow-visible">
            <UniformMask 
              title={TABS.find(t => t.id === activeTab)?.label || ''}
              onOpenKaderAgent={(activeTab === 'trainer_view' || activeTab === 'tacticboard') ? ((preset) => {
                setKaderAgentPreset(preset || 'beste_formation');
                setShowKaderAgentModal(true);
              }) : undefined}
          onOpen3DTacticBoard={(activeTab === 'trainer_view' || activeTab === 'tacticboard' || activeTab === 'developer_tasks') ? (() => setShow3DProfiBoardModal(true)) : undefined}
          onShareText={handleShareText}
          onEmail={handleEmail}
          onEdit={handleEdit}
          isEditing={isEditing}
          onSave={handleManualSave}
          onReset={handleReset}
          onManageSquad={() => handleTabClick('personnel')}
          onAddPlayer={() => {
            if (activeTab === 'scouting') setShowAddScoutingModal(true);
            else if (activeTab === 'attendance' || activeTab === 'yearly') setShowAddTrainingModal(true);
            else if (activeTab === 'budget_finance') setShowAddFinanzModal(true);
            else if (activeTab === 'meetings_calendar') setShowAddMeetingModal(true);
            else if (activeTab === 'physio_plan') setShowAddPhysioModal(true);
            else if (activeTab === 'summer_prep') {
              const lastTE = vorbereitungSommer.length > 0 ? Math.max(...vorbereitungSommer.map((d: any) => typeof d.te === 'number' ? d.te : 0)) : 0;
              handleSaveVorbereitungSommer({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                kw: 1,
                te: lastTE + 1,
                date: '2026-07-06',
                day: 'Mo',
                time: '19:00',
                type: 'Training',
                content: 'NEUE EINHEIT',
                location: 'Auggen',
                intensity: 'Mittel'
              });
              setToast({ message: 'Einheit zur Sommervorbereitung hinzugefügt.', id: Date.now() });
            }
            else if (activeTab === 'winter_prep') {
              const lastTE = vorbereitungWinter.length > 0 ? Math.max(...vorbereitungWinter.map((d: any) => typeof d.te === 'number' ? d.te : 0)) : 0;
              saveVorbereitungWinter({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                kw: 1,
                te: lastTE + 1,
                date: '2027-01-16',
                day: 'Sa',
                time: '10:30',
                type: 'Training',
                content: 'NEUE EINHEIT',
                location: 'Auggen',
                intensity: 'Mittel'
              });
              setToast({ message: 'Einheit zur Wintervorbereitung hinzugefügt.', id: Date.now() });
            }
            else {
              setEditingPlayer(null);
              setShowAddPlayerModal(true);
            }
          }}
          onRemovePlayer={() => {
            if (activeTab === 'scouting') setShowRemoveScoutingModal(true);
            else if (activeTab === 'summer_prep' || activeTab === 'winter_prep') {
              setToast({ message: 'Nutzen Sie das Löschen-Symbol (Mülleimer) in der Tabelle im Bearbeiten-Modus.', id: Date.now() });
            }
            else setShowRemovePlayerModal(true);
          }}
          onMigrate={handleMigrateCloudData}
          saveStatus={saveStatus}
        >
          {renderContent()}
        </UniformMask>
      </main>

      {/* Footer */}
      <footer className="bg-black text-white text-[9px] px-6 py-2 flex justify-between items-center uppercase tracking-widest font-bold border-t-2 border-black print:hidden">
        <div className="flex items-center gap-4">
          <span className="text-[#C00000] font-black">FC AUGGEN 1921 e.V.</span>
          <span className="opacity-30">|</span>
          <span className="opacity-60">Team Management System 2026/2027</span>
        </div>
        <div className="flex items-center gap-4">
          {lastError && (
            <span className="text-red-500 text-[10px] font-black animate-pulse px-2.5 py-1 border border-red-500 bg-red-950/50 rounded mr-2 uppercase">
              ⚠️ {lastError}
            </span>
          )}
          <div className="flex items-center gap-4 opacity-75">
            <span>Status: <span className={isOnline ? "text-green-500" : "text-red-500"}>{isOnline ? 'Online' : 'Offline'}</span></span>
            <span className="opacity-30">|</span>
            {authUser ? (
              <div className="flex items-center gap-2">
                <span>
                  User: <span className="text-amber-400 font-extrabold">{authUser.displayName || authUser.email}</span>
                  {isOwner && (
                    <span className="ml-2 bg-amber-500 text-black px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wider shadow-sm border border-black animate-pulse">
                      OWNER
                    </span>
                  )}
                </span>
                <button 
                  onClick={handleLogout}
                  className="bg-[#C00000] text-white px-2 py-0.5 text-[8px] font-black uppercase border border-black hover:bg-red-700 transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>
                  User: <span className="text-amber-400 font-extrabold hover:underline cursor-pointer" onClick={() => setShowLocalProfileModal(true)}>{localName}</span>
                  {isOwner && (
                    <span className="ml-2 bg-amber-500 text-black px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wider shadow-sm border border-black animate-pulse">
                      OWNER
                    </span>
                  )}
                </span>
                <button 
                  onClick={() => setShowLocalProfileModal(true)}
                  className="bg-gray-800 text-white px-2 py-0.5 text-[8px] font-black uppercase border border-white hover:bg-gray-700 transition"
                >
                  Name/Rolle ändern
                </button>
                {isOnline && (
                  <button 
                    onClick={() => setShowLoginModal(true)}
                    className="bg-green-600 text-white px-2 py-0.5 text-[8px] font-black uppercase border border-black hover:bg-green-500 transition flex items-center gap-1"
                  >
                    <User size={10} /> Anmelden
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>

      {/* Local Profile Configuration Modal */}
      {showLocalProfileModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl shadow-2xl w-full max-w-md my-auto text-[#F8FAFC]">
            <div className="bg-[#0F172A] text-[#F8FAFC] p-4 border-b border-[#334155] rounded-t-xl flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest flex items-center gap-2">
                👤 Benutzerprofil bearbeiten
              </h3>
              <button onClick={() => setShowLocalProfileModal(false)} className="hover:rotate-90 transition-transform font-black">✕</button>
            </div>
            <form className="p-6 space-y-4" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = (formData.get('profile_name') as string || '').trim();
              const email = (formData.get('profile_email') as string || '').trim();
              
              localStorage.setItem('fca_local_name', name || 'Gast');
              localStorage.setItem('fca_local_email', email);
              
              setLocalName(name || 'Gast');
              setLocalEmail(email);
              setShowLocalProfileModal(false);
              setToast({ message: 'Profil erfolgreich gespeichert!', id: Date.now() });
            }}>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1 text-[#F8FAFC]">Anzeigename</label>
                <input 
                  type="text" 
                  name="profile_name"
                  defaultValue={localName}
                  className="w-full border border-[#334155] p-2.5 rounded-lg font-bold text-sm bg-[#121824] text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                  placeholder="Z.B. Samer Khaleel"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1 text-[#F8FAFC]">E-Mail-Adresse</label>
                <input 
                  type="email" 
                  name="profile_email"
                  defaultValue={localEmail}
                  className="w-full border border-[#334155] p-2.5 rounded-lg font-bold text-sm bg-[#121824] text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                  placeholder="name@example.com"
                />
              </div>

              <div className="pt-4 border-t border-[#334155] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLocalProfileModal(false)}
                  className="py-2 px-4 border border-[#334155] rounded-lg bg-[#121824] text-[#F8FAFC] text-xs font-black uppercase hover:bg-[#334155] transition"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-lg bg-[#10B981] text-[#0A0E17] text-xs font-black uppercase hover:bg-[#059669] transition shadow-md"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl shadow-2xl w-full max-w-md my-auto text-[#F8FAFC]">
            <div className="bg-[#E11D48] text-white p-4 border-b border-[#334155] rounded-t-xl flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest flex items-center gap-2">
                ⚽ FC AUGGEN - ANMELDUNG
              </h3>
              <button onClick={() => setShowLoginModal(false)} className="hover:rotate-90 transition-transform font-black">✕</button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Email / Password Form */}
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const email = (formData.get('login_email') as string || '').trim();
                const pass = (formData.get('login_password') as string || '').trim();
                handleEmailPasswordLogin(email, pass);
              }} className="space-y-4">
                <div className="bg-red-950/40 border border-red-800/60 p-3 text-red-300 text-xs font-bold uppercase tracking-wider rounded-lg">
                  🔒 Systeminhaber-Zugang:<br/>
                  Exklusiver Zugriff nur für <span className="text-amber-400 font-mono font-black">{ownerEmail}</span> mit dem Inhaber-Passwort.
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1 text-[#F8FAFC]">E-Mail-Adresse</label>
                  <input 
                    type="email" 
                    name="login_email"
                    id="modal_login_email"
                    defaultValue={ownerEmail}
                    required
                    className="w-full border border-[#334155] p-2.5 rounded-lg font-bold text-sm bg-[#121824] text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                    placeholder="name@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1 text-[#F8FAFC]">Passwort</label>
                  <input 
                    type="password" 
                    name="login_password"
                    required
                    className="w-full border border-[#334155] p-2.5 rounded-lg font-bold text-sm bg-[#121824] text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                    placeholder="****"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-[#10B981] text-[#0A0E17] text-xs font-black uppercase hover:bg-[#059669] rounded-lg transition shadow-md disabled:opacity-50"
                >
                  {authLoading ? 'Verbinde...' : '🔑 Als Inhaber Anmelden'}
                </button>
              </form>

              {/* Google Sign-In Option */}
              <div className="border-t border-[#334155] pt-4">
                <span className="block text-[10px] font-black uppercase tracking-wider text-[#94A3B8] mb-2 text-center">Oder über Drittanbieter</span>
                <button
                  type="button"
                  onClick={() => {
                    handleLogin();
                    setShowLoginModal(false);
                  }}
                  className="w-full py-2.5 px-4 border border-[#334155] rounded-lg bg-[#121824] text-[#F8FAFC] text-xs font-black uppercase hover:bg-[#334155] transition flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.45 1.68 14.93 1 12 1 7.35 1 3.39 3.68 1.48 7.62l3.78 2.93c.92-2.76 3.51-4.51 6.74-4.51z"/>
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.99 3.7-8.63z"/>
                    <path fill="#FBBC05" d="M5.26 14.12c-.24-.72-.38-1.5-.38-2.31s.14-1.59.38-2.31L1.48 6.57C.53 8.44 0 10.53 0 12.75s.53 4.31 1.48 6.18l3.78-2.93z"/>
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.1.74-2.51 1.18-4.23 1.18-3.23 0-5.82-1.75-6.74-4.51L1.48 16.8C3.39 20.32 7.35 23 12 23z"/>
                  </svg>
                  Mit Google Anmelden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl shadow-2xl w-full max-w-2xl my-auto text-[#F8FAFC]">
            <div className="bg-[#0F172A] text-[#F8FAFC] p-4 border-b border-[#334155] rounded-t-xl flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest flex items-center gap-2">
                <UserPlus size={20} /> {editingPlayer ? 'Spieler bearbeiten' : 'Neuer Spieler'}
              </h3>
              <button onClick={() => {
                setShowAddPlayerModal(false);
                setEditingPlayer(null);
              }} className="hover:rotate-90 transition-transform"><CloseIcon size={20} /></button>
            </div>
            <form className="p-6 space-y-6" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const birthDate = formData.get('geburtsdatum') as string;
              const num = parseInt(formData.get('number') as string) || 0;
              
              const firstName = formData.get('firstName') as string;
              const lastName = formData.get('lastName') as string;
              const name = `${firstName} ${lastName}`.trim();
              
              const p: Spieler = {
                id: editingPlayer?.id || Date.now().toString(),
                category: formData.get('category') as any,
                number: num,
                nummer: num,
                name: name,
                firstName: firstName,
                lastName: lastName,
                position: formData.get('position') as string,
                geburtsdatum: birthDate,
                wochentag: '', // Will be calculated in handleAddPlayer
                status: formData.get('status') as any || 'Aktiv',
                notizen: formData.get('notizen') as string,
                adresse: formData.get('adresse') as string,
                telefon: formData.get('telefon') as string,
                email: formData.get('email') as string,
                oberteil: formData.get('oberteil') as string,
                kurze_hose: formData.get('kurze_hose') as string,
                lange_hose: formData.get('lange_hose') as string,
                schuhe: formData.get('schuhe') as string,
                physical: {
                  height: parseInt(formData.get('height') as string) || 0,
                  weight: parseInt(formData.get('weight') as string) || 0,
                  bodyFat: parseFloat(formData.get('bodyFat') as string) || 0,
                  strongFoot: formData.get('strongFoot') as any,
                },
                finance: {
                  baseSalary: parseInt(formData.get('baseSalary') as string) || 0,
                  bonusPerMatch: parseInt(formData.get('bonusPerMatch') as string) || 0,
                  months: isNaN(parseInt(formData.get('months') as string)) ? 12 : parseInt(formData.get('months') as string),
                  transferFeeIn: parseInt(formData.get('transferFeeIn') as string) || 0,
                  transferFeeOut: parseInt(formData.get('transferFeeOut') as string) || 0,
                  ist: parseInt(formData.get('ist') as string) || 0,
                  sideAgreements: formData.get('sideAgreements') as string,
                },
                analysis: {
                  strengths: formData.get('strengths') as string,
                  weaknesses: formData.get('weaknesses') as string,
                  development: formData.get('development') as string,
                },
                injuryHistory: formData.get('injuryHistory') as string,
                professionalStatus: formData.get('professionalStatus') as string,
                education: formData.get('education') as string,
                employer: formData.get('employer') as string,
                diagnostics: {
                  sprintwert: formData.get('sprintwert') as string,
                  yoyotest: formData.get('yoyotest') as string,
                }
              };
              if (editingPlayer) {
                handleUpdatePlayer(p);
              } else {
                handleAddPlayer(p);
              }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basisdaten */}
                <div className="space-y-4">
                  <h4 className="font-black uppercase text-xs border-b-2 border-black pb-1">Basisdaten</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Kategorie</label>
                      <select 
                        name="category" 
                        value={modalCategory} 
                        onChange={(e) => setModalCategory(e.target.value as any)}
                        className="w-full border-2 border-black p-2 font-black focus:outline-none"
                      >
                        <option value="player">Spielerkader</option>
                        <option value="coach">Trainerteam</option>
                        <option value="staff">Teammanagement / Funktionär</option>
                        <option value="medical">Medizinische Abteilung (Physio / Arzt)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Nr</label>
                      <input name="number" type="number" defaultValue={editingPlayer?.nummer} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Vorname</label>
                      <input name="firstName" type="text" defaultValue={editingPlayer?.firstName} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Nachname</label>
                      <input name="lastName" type="text" defaultValue={editingPlayer?.lastName} required className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Position</label>
                      <div className="flex flex-col gap-1">
                        <input name="position" id="pos-input" type="text" defaultValue={editingPlayer?.position} required className="w-full border-2 border-black p-2 font-black focus:outline-none uppercase" />
                        <div className="flex flex-wrap gap-1">
                          {['TW', 'IV', 'RV', 'LV', 'MD', 'ZDM', 'ZMD', 'ZOM', 'LM', 'RM', 'HS', 'ST'].map(p => (
                            <button 
                              key={p} 
                              type="button" 
                              onClick={() => {
                                const input = document.getElementById('pos-input') as HTMLInputElement;
                                if (input) {
                                  input.value = p;
                                }
                              }}
                              className="text-[7px] font-black uppercase border border-black px-1.5 py-0.5 hover:bg-black hover:text-white transition-colors"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Status</label>
                      <select name="status" defaultValue={editingPlayer?.status || 'Aktiv'} className="w-full border-2 border-black p-2 font-black focus:outline-none">
                        <option value="Aktiv">Aktiv</option>
                        <option value="Inaktiv">Inaktiv</option>
                        <option value="Verletzt">Verletzt</option>
                        <option value="Abgang">Abgang</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Geburtsdatum</label>
                      <input name="geburtsdatum" type="text" defaultValue={editingPlayer?.geburtsdatum} placeholder="TT.MM.JJJJ" className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Beruflicher Status</label>
                      <select name="professionalStatus" defaultValue={editingPlayer?.professionalStatus || ''} className="w-full border-2 border-black p-2 font-black focus:outline-none">
                        <option value="">- Wählen -</option>
                        <option value="Student">Student</option>
                        <option value="Schüler">Schüler</option>
                        <option value="Ausbildung">Ausbildung</option>
                        <option value="Angestellter">Angestellter</option>
                        <option value="Selbstständig">Selbstständig</option>
                        <option value="Arbeitslos">Arbeitslos</option>
                        <option value="Arbeitssuchend">Arbeitssuchend</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Ausbildung</label>
                      <input name="education" type="text" defaultValue={editingPlayer?.education || ''} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Arbeitgeber</label>
                      <input name="employer" type="text" defaultValue={editingPlayer?.employer || ''} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase block mb-1">Verletzungshistorie</label>
                    <textarea name="injuryHistory" defaultValue={editingPlayer?.injuryHistory || ''} className="w-full border-2 border-black p-2 font-black focus:outline-none min-h-[60px]" placeholder="Bisherige Verletzungen..." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Telefon</label>
                      <input name="telefon" type="text" defaultValue={editingPlayer?.telefon} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Email</label>
                      <input name="email" type="email" defaultValue={editingPlayer?.email} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Adresse</label>
                      <input name="adresse" type="text" defaultValue={editingPlayer?.adresse} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                  </div>
                </div>

                {/* Physische Daten & Ausrüstung */}
                {modalCategory === 'player' && (
                  <div className="space-y-4">
                    <h4 className="font-black uppercase text-xs border-b-2 border-black pb-1">Physische Daten</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase block mb-1">Größe (cm)</label>
                        <input name="height" type="number" defaultValue={editingPlayer?.physical?.height} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase block mb-1">Gewicht (kg)</label>
                        <input name="weight" type="number" defaultValue={editingPlayer?.physical?.weight} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase block mb-1">Körperfett (%)</label>
                        <input name="bodyFat" type="number" step="0.1" defaultValue={editingPlayer?.physical?.bodyFat} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase block mb-1">Starker Fuß</label>
                        <select name="strongFoot" defaultValue={editingPlayer?.physical?.strongFoot || 'Rechts'} className="w-full border-2 border-black p-2 font-black focus:outline-none">
                          <option value="Rechts">Rechts</option>
                          <option value="Links">Links</option>
                          <option value="Beidfüßig">Beidfüßig</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase block mb-1">Sprintwert</label>
                        <input name="sprintwert" type="text" defaultValue={editingPlayer?.diagnostics?.sprintwert} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase block mb-1">Yoyo-Test</label>
                        <input name="yoyotest" type="text" defaultValue={editingPlayer?.diagnostics?.yoyotest} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                      </div>
                    </div>

                    <h4 className="font-black uppercase text-xs border-b-2 border-black pb-1 pt-2">Ausrüstung</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase block mb-1">Oberteil</label>
                        <input name="oberteil" type="text" defaultValue={editingPlayer?.oberteil} placeholder="Größe" className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase block mb-1">Schuhe</label>
                        <input name="schuhe" type="text" defaultValue={editingPlayer?.schuhe} placeholder="Größe" className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase block mb-1">Kurze Hose</label>
                        <input name="kurze_hose" type="text" defaultValue={editingPlayer?.kurze_hose} placeholder="Größe" className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase block mb-1">Lange Hose</label>
                        <input name="lange_hose" type="text" defaultValue={editingPlayer?.lange_hose} placeholder="Größe" className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Analyse & Finanzen */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {modalCategory === 'player' && (
                  <div className="space-y-4">
                    <h4 className="font-black uppercase text-xs border-b-2 border-black pb-1">Analyse</h4>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Stärken</label>
                      <textarea name="strengths" defaultValue={editingPlayer?.analysis?.strengths} className="w-full border-2 border-black p-2 font-black focus:outline-none text-xs" rows={2}></textarea>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Schwächen</label>
                      <textarea name="weaknesses" defaultValue={editingPlayer?.analysis?.weaknesses} className="w-full border-2 border-black p-2 font-black focus:outline-none text-xs" rows={2}></textarea>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Entwicklungspotenzial</label>
                      <textarea name="development" defaultValue={editingPlayer?.analysis?.development} className="w-full border-2 border-black p-2 font-black focus:outline-none text-xs" rows={2}></textarea>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Allgemeine Notizen</label>
                      <textarea name="notizen" defaultValue={editingPlayer?.notizen} className="w-full border-2 border-black p-2 font-black focus:outline-none text-xs" rows={2}></textarea>
                    </div>
                  </div>
                )}
                <div className={`space-y-4 ${modalCategory !== 'player' ? 'md:col-span-2' : ''}`}>
                  <h4 className="font-black uppercase text-xs border-b-2 border-black pb-1">Finanzen</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Grundgehalt</label>
                      <input name="baseSalary" type="number" defaultValue={editingPlayer?.finance?.baseSalary} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Prämie/Spiel</label>
                      <input name="bonusPerMatch" type="number" defaultValue={editingPlayer?.finance?.bonusPerMatch} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1 text-blue-600">Monate Aktiv (0-12)</label>
                      <input name="months" type="number" min="0" max="12" defaultValue={editingPlayer?.finance?.months ?? 12} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Ablöse (Zugang)</label>
                      <input name="transferFeeIn" type="number" defaultValue={editingPlayer?.finance?.transferFeeIn} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase block mb-1">Ablöse (Abgang)</label>
                      <input name="transferFeeOut" type="number" defaultValue={editingPlayer?.finance?.transferFeeOut} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase block mb-1">Nebenvereinbarungen</label>
                    <textarea name="sideAgreements" defaultValue={editingPlayer?.finance?.sideAgreements} className="w-full border-2 border-black p-2 font-black focus:outline-none text-xs" rows={2}></textarea>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => {
                  setShowAddPlayerModal(false);
                  setEditingPlayer(null);
                }} className="flex-1 bg-white text-black py-3 font-black uppercase tracking-widest hover:bg-gray-100 transition-colors border-2 border-black">
                  Abbrechen
                </button>
                <button 
                  type="submit" 
                  disabled={saveStatus === 'saving'}
                  className={`flex-1 text-white py-3 font-black uppercase tracking-widest transition-colors border-2 border-black flex items-center justify-center gap-2 ${
                    saveStatus === 'saving' ? 'bg-gray-600 cursor-wait' : 
                    saveStatus === 'success' ? 'bg-green-500' : 'bg-black hover:bg-gray-800'
                  }`}
                >
                  {saveStatus === 'saving' ? 'WIRD GESPEICHERT...' : 
                   saveStatus === 'success' ? 'GESPEICHERT!' : 
                   (editingPlayer ? 'Speichern' : 'Anlegen')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Player Modal */}
      {showRemovePlayerModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] w-full max-w-lg">
            <div className="bg-[#C00000] text-white p-4 border-b-4 border-black flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest flex items-center gap-2">
                <UserMinus size={20} /> Spieler entfernen
              </h3>
              <button onClick={() => setShowRemovePlayerModal(false)} className="hover:rotate-90 transition-transform"><CloseIcon size={20} /></button>
            </div>
            <div className="p-6">
              <p className="text-[10px] font-bold uppercase opacity-60 mb-4 italic">Wählen Sie einen Spieler aus, den Sie aus dem Kader entfernen möchten:</p>
              <div className="max-h-96 overflow-y-auto custom-scrollbar border-2 border-black">
                {players.map((p) => (
                  <div key={`remove-p-${p.id}`} className="flex items-center justify-between p-3 border-b border-black last:border-b-0 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center bg-gray-100 text-xs font-black border border-black group-hover:bg-[#C00000] group-hover:text-white transition-colors">
                        #{p.number}
                      </span>
                      <div>
                        <p className="font-black uppercase text-sm leading-none">{p.lastName}</p>
                        <p className="text-[9px] font-bold uppercase opacity-40 mt-1">{p.position}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeletePlayer(p.id, true)}
                      className="bg-white text-[#C00000] p-2 border-2 border-[#C00000] hover:bg-[#C00000] hover:text-white transition-all"
                      title="Spieler löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {players.length === 0 && (
                  <div className="p-8 text-center font-black uppercase opacity-20 italic">Keine Spieler im Kader</div>
                )}
              </div>
              <div className="mt-6">
                <button 
                  onClick={() => setShowRemovePlayerModal(false)}
                  className="w-full bg-black text-white py-3 font-black uppercase tracking-widest hover:bg-gray-800 transition-colors border-2 border-black"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Scouting Modal */}
      {showAddScoutingModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] w-full max-w-md">
            <div className="bg-black text-white p-4 border-b-4 border-black flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest flex items-center gap-2">
                <Plus size={20} /> Neuer Scouting-Kandidat
              </h3>
              <button onClick={() => setShowAddScoutingModal(false)} className="hover:rotate-90 transition-transform"><CloseIcon size={20} /></button>
            </div>
            <form className="p-6 space-y-4" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newCandidate: ScoutingEntry = {
                id: `s${Date.now()}`,
                createdAt: Date.now(),
                name: formData.get('name') as string,
                age: parseInt(formData.get('age') as string) || 0,
                position: formData.get('position') as string,
                club: formData.get('club') as string,
                marketValue: formData.get('marketValue') as string,
                recommendation: (formData.get('recommendation') as any) || 'Beobachten',
                category: (formData.get('category') as any) || 'Sonstige',
                status: (formData.get('status') as string) || 'Offen',
                date: formData.get('date') as string,
                conversationNotes: formData.get('conversationNotes') as string,
                waitingTime: formData.get('waitingTime') as string
              };
              console.log('Saving new candidate:', newCandidate);
              saveScoutingCandidate(newCandidate).then(() => {
                console.log('Scouting candidate saved successfully');
                setShowAddScoutingModal(false);
                setToast({ message: 'Scouting-Kandidat erfolgreich angelegt.', id: Date.now() });
              }).catch(err => {
                console.error('Error saving scouting candidate:', err);
                setToast({ message: 'Fehler beim Speichern des Kandidaten.', id: Date.now() });
              });
            }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase block mb-1">Name</label>
                  <input name="name" type="text" required className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase block mb-1">Datum</label>
                  <input name="date" type="text" defaultValue={new Date().toLocaleDateString('de-DE')} className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase block mb-1">Alter</label>
                  <input name="age" type="number" required className="w-full border-2 border-black p-2 font-black focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase block mb-1">Position</label>
                  <input name="position" type="text" required className="w-full border-2 border-black p-2 font-black focus:outline-none uppercase" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase block mb-1">Verein</label>
                <input name="club" type="text" required className="w-full border-2 border-black p-2 font-black focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase block mb-1">Kategorie</label>
                  <select name="category" className="w-full border-2 border-black p-2 font-black focus:outline-none uppercase">
                    <option value="Abwehr">Abwehr</option>
                    <option value="Mittelfeld">Mittelfeld</option>
                    <option value="Flügel">Flügel</option>
                    <option value="Sturm">Sturm</option>
                    <option value="Sonstige">Sonstige</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase block mb-1">Empfehlung</label>
                  <select name="recommendation" className="w-full border-2 border-black p-2 font-black focus:outline-none uppercase">
                    <option value="Beobachten">Beobachten</option>
                    <option value="Verpflichten">Verpflichten</option>
                    <option value="Kein Interesse">Kein Interesse</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase block mb-1">Marktwert</label>
                  <input name="marketValue" type="text" className="w-full border-2 border-black p-2 font-black focus:outline-none" placeholder="z.B. 500k€" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase block mb-1">Status</label>
                  <input name="status" type="text" className="w-full border-2 border-black p-2 font-black focus:outline-none" placeholder="z.B. Offen" defaultValue="Offen" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase block mb-1">Gesprächsinhalt</label>
                <textarea name="conversationNotes" className="w-full border-2 border-black p-2 font-black focus:outline-none text-xs" rows={2} placeholder="Was wurde besprochen?"></textarea>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase block mb-1">Wartezeit auf Antwort</label>
                <input name="waitingTime" type="text" className="w-full border-2 border-black p-2 font-black focus:outline-none" placeholder="z.B. 2 Wochen / Datum" />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-black text-white py-3 font-black uppercase tracking-widest hover:bg-gray-800 transition-colors border-2 border-black">
                  Kandidat anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Scouting Modal */}
      {showRemoveScoutingModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#DADADA] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#E8E8E8] text-[#1A1A1A] p-4 border-b border-[#DADADA] flex justify-between items-center">
              <h3 className="font-black uppercase tracking-wider text-[#FF4C4C] flex items-center gap-2 text-sm">
                <UserMinus size={18} /> Kandidat entfernen
              </h3>
              <button onClick={() => setShowRemoveScoutingModal(false)} className="text-[#4A4A4A] hover:text-[#1A1A1A] hover:rotate-90 transition-transform"><CloseIcon size={18} /></button>
            </div>
            <div className="p-6">
              <p className="text-xs font-bold uppercase text-[#4A4A4A] mb-4 italic">Wählen Sie einen Kandidaten aus, den Sie von der Liste entfernen möchten:</p>
              <div className="max-h-96 overflow-y-auto custom-scrollbar border border-[#DADADA] rounded-xl divide-y divide-[#DADADA] bg-[#FFFFFF]">
                {scoutingCandidates.map((c) => (
                  <div key={`remove-scout-${c.id}`} className="flex items-center justify-between p-3.5 hover:bg-[#F4F4F4] transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-[#E8E8E8] text-[#00C2FF] font-black rounded-lg border border-[#DADADA] text-xs">
                        {c.name.substring(0, 1)}
                      </div>
                      <div>
                        <p className="font-bold uppercase text-sm leading-none text-[#1A1A1A]">{c.name}</p>
                        <p className="text-[10px] font-bold uppercase text-[#4A4A4A] mt-1">{c.position} • {c.club}</p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          await deleteScoutingCandidate(c.id);
                          setToast({ message: 'Kandidat erfolgreich entfernt.', id: Date.now() });
                        } catch (err) {
                          console.error('Error removing candidate:', err);
                          setToast({ message: 'Fehler beim Entfernen des Kandidaten.', id: Date.now() });
                        }
                      }}
                      className="bg-[#FF4C4C]/10 text-[#FF4C4C] p-2 border border-[#FF4C4C]/30 hover:bg-[#FF4C4C]/20 rounded-lg transition-all"
                      title="Kandidat löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {scoutingCandidates.length === 0 && (
                  <div className="p-8 text-center font-bold uppercase text-[#4A4A4A] italic text-xs">Keine Kandidaten auf der Liste</div>
                )}
              </div>
              <div className="mt-6">
                <button 
                  onClick={() => setShowRemoveScoutingModal(false)}
                  className="w-full bg-[#E8E8E8] text-[#1A1A1A] py-3 font-bold uppercase tracking-wider hover:bg-[#D8D8D8] transition-colors rounded-xl border border-[#DADADA] text-xs"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Add Meeting Modal */}
      {showAddMeetingModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#DADADA] rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-[#E8E8E8] text-[#1A1A1A] p-4 border-b border-[#DADADA] flex justify-between items-center">
              <h3 className="font-black uppercase tracking-wider text-[#00C2FF] text-sm">Gespräch hinzufügen</h3>
              <button onClick={() => { setShowAddMeetingModal(false); setSelectedMeetingPlayer(''); }} className="text-[#4A4A4A] hover:text-[#1A1A1A] hover:rotate-90 transition-transform"><CloseIcon size={18} /></button>
            </div>
            <form className="p-6 space-y-4" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const playerName = selectedMeetingPlayer === 'NEUER SPIELER' 
                ? formData.get('customPlayerName') as string 
                : selectedMeetingPlayer;
              const isScout = scoutingCandidates.some(c => c.name === playerName);
              
              const newMeeting: MeetingEntry = {
                id: `m${Date.now()}`,
                playerName,
                date: formData.get('date') as string,
                time: formData.get('time') as string,
                location: formData.get('location') as string,
                notes: formData.get('notes') as string,
                status: formData.get('status') as any || 'Offen',
                isScout
              };
              saveMeetingEntry(newMeeting).then(() => {
                setShowAddScoutingModal(false);
                setShowAddMeetingModal(false);
                setSelectedMeetingPlayer('');
                setToast({ message: 'Termin erfolgreich angelegt', id: Date.now() });
              }).catch(err => {
                console.error('Error saving meeting:', err);
                setToast({ message: 'Fehler beim Speichern des Termins', id: Date.now() });
              });
            }}>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1.5">Spieler / Kontakt</label>
                <select 
                  name="playerType" 
                  required 
                  className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] uppercase text-xs"
                  value={selectedMeetingPlayer}
                  onChange={(e) => setSelectedMeetingPlayer(e.target.value)}
                >
                  <option value="">Wähle einen Spieler...</option>
                  <option value="NEUER SPIELER">NEUER SPIELER</option>
                  <optgroup label="KADER">
                    {sortPlayers(players).map(p => (
                      <option key={`meeting-kader-${p.id}`} value={p.lastName}>{p.lastName} (#{p.number})</option>
                    ))}
                  </optgroup>
                  <optgroup label="SCOUTING">
                    {scoutingCandidates.map(c => (
                      <option key={`meeting-scout-${c.id}`} value={c.name}>{c.name} ({c.club})</option>
                    ))}
                  </optgroup>
                </select>
                {selectedMeetingPlayer === 'NEUER SPIELER' && (
                  <div className="mt-2.5 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Name des neuen Spielers</label>
                    <input 
                      name="customPlayerName" 
                      type="text" 
                      required 
                      className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] uppercase text-xs" 
                      placeholder="NAME EINGEBEN..."
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Datum</label>
                  <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2 font-bold focus:outline-none focus:border-[#00C2FF] text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Uhrzeit</label>
                  <input name="time" type="time" required defaultValue="18:00" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2 font-bold focus:outline-none focus:border-[#00C2FF] text-xs" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Ort</label>
                <input name="location" type="text" required defaultValue="Sportheim" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] uppercase text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Status</label>
                <select name="status" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] uppercase text-xs">
                  <option value="Offen">Offen</option>
                  <option value="Zusage">Zusage</option>
                  <option value="Absage">Absage</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Notizen</label>
                <textarea name="notes" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] text-xs" rows={3} placeholder="Themen, Ziele..."></textarea>
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-[#00C2FF] text-[#0A0A0A] py-3 font-black uppercase tracking-wider rounded-xl shadow-xs hover:bg-[#00B0E6] transition-all text-xs border border-[#00C2FF]">
                  Termin speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Training Modal */}
      {showAddTrainingModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#DADADA] rounded-2xl shadow-xl w-full max-w-2xl my-auto overflow-hidden">
            <div className="bg-[#E8E8E8] text-[#1A1A1A] p-4 border-b border-[#DADADA] flex justify-between items-center">
              <h3 className="font-black uppercase tracking-wider text-[#00C2FF] text-sm">Trainingseinheit hinzufügen</h3>
              <button onClick={() => setShowAddTrainingModal(false)} className="text-[#4A4A4A] hover:text-[#1A1A1A] hover:rotate-90 transition-transform"><CloseIcon size={18} /></button>
            </div>
            <form className="p-6 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newSession: TrainingSession = {
                id: Date.now().toString(),
                date: formData.get('date') as string,
                weekday: getWeekdayLabel(formData.get('date') as string),
                group: formData.get('group') as string,
                load: formData.get('load') as string,
                duration: formData.get('duration') as string,
                weeklyFocus: formData.get('weeklyFocus') as string,
                sessionFocus: formData.get('sessionFocus') as string,
                trainer: formData.get('trainer') as string,
                intensity: formData.get('intensity') as string,
                players: players.map(p => ({ name: p.name, position: p.position, status: 'Aktiv' })),
                content: { warmup: '', main1: '', main2: '', closing: '' },
                importantInfo: '',
                remarks: ''
              };
              try {
                await saveTrainingSession(newSession);
                setShowAddTrainingModal(false);
                setToast({ message: 'Trainingseinheit erfolgreich hinzugefügt', id: Date.now() });
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, 'training_sessions');
              }
            }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Datum</label>
                  <input name="date" type="date" required className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Trainer</label>
                  <input name="trainer" type="text" defaultValue="Trainerteam" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Gruppe</label>
                  <input name="group" type="text" defaultValue="Gesamtkader" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Dauer (Min)</label>
                  <input name="duration" type="text" defaultValue="90" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Belastung</label>
                  <select name="load" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] text-xs">
                    <option value="Gering">Gering</option>
                    <option value="Mittel">Mittel</option>
                    <option value="Hoch">Hoch</option>
                    <option value="Maximal">Maximal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Intensität</label>
                  <select name="intensity" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] text-xs">
                    <option value="Regenerativ">Regenerativ</option>
                    <option value="Extensiv">Extensiv</option>
                    <option value="Intensiv">Intensiv</option>
                    <option value="Wettkampf">Wettkampf</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Wochenschwerpunkt</label>
                <input name="weeklyFocus" type="text" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#4A4A4A] block mb-1">Einheitsschwerpunkt</label>
                <input name="sessionFocus" type="text" className="w-full bg-[#FFFFFF] border border-[#DADADA] text-[#1A1A1A] rounded-xl p-2.5 font-bold focus:outline-none focus:border-[#00C2FF] text-xs" />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-[#00C2FF] text-[#0A0A0A] py-3 font-black uppercase tracking-wider rounded-xl shadow-xs hover:bg-[#00B0E6] transition-all text-xs border border-[#00C2FF]">
                  Einheit speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Physio Modal */}
      {showAddPhysioModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border-2 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md my-auto overflow-hidden text-slate-900">
            <div className="bg-slate-100 text-slate-900 p-4 border-b-2 border-black flex justify-between items-center">
              <h3 className="font-black uppercase tracking-wider text-slate-900 text-sm">Physio-Eintrag hinzufügen</h3>
              <button onClick={() => setShowAddPhysioModal(false)} className="text-slate-600 hover:text-black hover:rotate-90 transition-transform"><CloseIcon size={18} /></button>
            </div>
            <form className="p-6 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const playerId = (formData.get('playerId') as string || '').trim();
              const date = (formData.get('date') as string || '').trim();
              const diagnosis = (formData.get('diagnosis') as string || '').trim();

              if (!playerId) {
                setToast({ message: 'Fehler: Bitte einen Spieler auswählen', id: Date.now() });
                return;
              }
              if (!date) {
                setToast({ message: 'Fehler: Bitte ein gültiges Datum wählen', id: Date.now() });
                return;
              }
              if (!diagnosis) {
                setToast({ message: 'Fehler: Bitte eine Diagnose/Beschwerde eingeben', id: Date.now() });
                return;
              }

              const newEntry = {
                id: Date.now().toString(),
                playerId,
                date,
                type: formData.get('type') as string,
                diagnosis,
                treatment: (formData.get('treatment') as string || '').trim(),
                status: formData.get('status') as string,
                remarks: (formData.get('remarks') as string || '').trim()
              };
              try {
                await savePhysioEntry(newEntry);
                setShowAddPhysioModal(false);
                setToast({ message: 'Physio-Eintrag erfolgreich hinzugefügt', id: Date.now() });
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, 'physio_entries');
              }
            }}>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">Spieler</label>
                <select name="playerId" required className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 font-bold focus:outline-none focus:border-black text-xs">
                  <option value="">-- Spieler wählen --</option>
                  {sortedPlayers.map(p => (
                    <option key={`physio-opt-p-${p.id}`} value={p.id}>{p.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">Datum</label>
                <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 font-bold focus:outline-none focus:border-black text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">Typ</label>
                <select name="type" className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 font-bold focus:outline-none focus:border-black text-xs">
                  <option value="Behandlung">Behandlung</option>
                  <option value="Check-Up">Check-Up</option>
                  <option value="Reha">Reha</option>
                  <option value="Massage">Massage</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">Diagnose / Grund</label>
                <input name="diagnosis" type="text" required className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 font-bold focus:outline-none focus:border-black text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">Durchgeführte Behandlung</label>
                <input name="treatment" type="text" placeholder="Z.B. Massage, Kältetherapie" className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 font-bold focus:outline-none focus:border-black text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">Status</label>
                <select name="status" className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 font-bold focus:outline-none focus:border-black text-xs">
                  <option value="In Behandlung">In Behandlung</option>
                  <option value="Austrainiert">Austrainiert</option>
                  <option value="Spielfähig">Spielfähig</option>
                  <option value="Reha-Phase">Reha-Phase</option>
                  <option value="Langzeit">Langzeit</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">Bemerkungen</label>
                <textarea name="remarks" className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 font-bold focus:outline-none focus:border-black min-h-[60px] text-xs" />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-slate-900 text-white border border-black py-3 font-black uppercase tracking-wider rounded-xl shadow-md hover:bg-slate-800 transition-all text-xs">
                  Eintrag speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KaderAgent Profi-Modus Modal */}
      {showKaderAgentModal && (
        <KaderAgentModal
          players={players}
          onClose={() => setShowKaderAgentModal(false)}
          initialPreset={kaderAgentPreset}
          isOwner={isOwner}
        />
      )}

      {/* 3D Profi Taktiktafel Modal */}
      {show3DProfiBoardModal && isOwner && (
        <Pro3DTacticBoardModal
          players={players}
          matches={competitiveMatches}
          analyses={matchAnalyses}
          onClose={() => setShow3DProfiBoardModal(false)}
        />
      )}

      {/* Agent System Control Center Modal */}
      {showAgentControlCenterModal && (
        <AgentSystemControlCenterModal
          players={players}
          matches={competitiveMatches}
          analyses={matchAnalyses}
          onClose={() => setShowAgentControlCenterModal(false)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div key={`toast-${toast.id}`} className="fixed bottom-6 right-6 z-[200] bg-[#FFFFFF] text-[#1A1A1A] px-4 py-3 border border-[#DADADA] rounded-2xl shadow-xl animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-[#00C2FF] rounded-full animate-pulse shadow-xs" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">{toast.message}</span>
        </div>
      )}

    </div>
  );
};

export default App;
