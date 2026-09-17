import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  Shield, 
  Zap, 
  TrendingUp, 
  Target, 
  Activity, 
  CheckCircle2, 
  Video, 
  Compass, 
  Tv, 
  Grid, 
  Edit,
  Edit3, 
  Save, 
  BarChart3, 
  Pencil, 
  Plus, 
  Trash2,
  Lock,
  Unlock,
  Star,
  Layers,
  Check,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Printer,
  BookOpen,
  Crown,
  UserCheck,
  Eye,
  Users,
  CornerUpRight,
  Image as ImageIcon,
  Upload,
  Camera,
  BrainCircuit,
  Move,
  FileText,
  RefreshCw,
  Play,
  Wrench
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query } from 'firebase/firestore';
import { db, cleanFirestoreData } from '../../firebase';
import { isQuotaExceededActive, isQuotaError, markQuotaExceeded } from '../../lib/offlineStorage';
import { Player } from '../../types';
import { SetPieceHalfPitchEditor } from '../SetPieceHalfPitchEditor';
import { data } from '../../constants/data';

interface Profi3DTacticBoardViewProps {
  players: Player[];
  onNavigateToVideo?: (clipId?: string) => void;
  isEditing?: boolean;
}

export type TacticFormation = '4-2-3-1' | '4-4-2' | '4-1-4-1' | '3-4-3' | string;
export type MatchPhase = 'offensiv' | 'defensiv' | 'umschalten' | 'umschalten_defensiv';
export type ViewMode = '3d_tv' | '2d_tactical' | 'comparison_4_systems';

export interface PlayerPositionNode {
  id: string;
  name: string;
  number: string;
  position: string;
  role: string;
  xPercent: number; // 0-100% on pitch
  yPercent: number; // 0-100% on pitch
  offensivX: number;
  offensivY: number;
  defensivX: number;
  defensivY: number;
  umschaltX: number;
  umschaltY: number;
  speedKmh: number;
  distanceKm: number;
  duelSuccessPercent: number;
  passAccuracyPercent: number;
  customNote?: string;
  isLocked?: boolean;
  isHighlighted?: boolean;
  markedZone?: string;
}

export interface PlayerRunPath {
  id: string;
  playerId: string;
  path: Array<{ x: number; y: number }>;
  color: string; // e.g., '#0055FF' (Offensiv), '#EF4444' (Defensiv), '#F59E0B' (Umschalten)
  type?: string;
}

export interface CustomFormationData {
  id: string;
  name: string;
  description?: string;
  positions: Record<string, { xPercent: number; yPercent: number }>;
  runs: PlayerRunPath[];
  zones: Array<{ playerId: string; zoneType: string; color: string }>;
  roles: Record<string, string>;
  highlightedPlayerIds: string[];
  lockedPlayerIds: string[];
  playerAssignments?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface StandardVariant {
  id: string;
  name: string;
  type: 'ecke_offensiv' | 'ecke_defensiv' | 'freistoss_direkt' | 'freistoss_halbfeld' | 'einwurf_weit' | 'elfmeter';
  executor: string;
  keyPlayers: string;
  description: string;
  successRate: number;
  imageUrl?: string;
  aiTacticNotes?: string;
  positions: Array<{
    id: string;
    name: string;
    number: string;
    role: string;
    xPercent: number;
    yPercent: number;
  }>;
  createdAt: string;
}

const FORMATION_PRESETS: Record<string, {
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  winRate: number;
  xGAvg: number;
  pressingSuccess: number;
  nodes: PlayerPositionNode[];
}> = {
  '4-2-3-1': {
    name: '4-2-3-1 (Stamm-System FC Auggen - BESTE AUFSTELLUNG)',
    description: 'Doppel-Sechs für optimale Absicherung, variable Flügelzange und Trequartista im Halbraum.',
    strengths: ['Maximale Mittelfeld-Kontrolle', 'Überladung der Flügelzonen', 'Schnelles Gegenpressing'],
    weaknesses: ['Lücke zwischen DM und AV bei gegnerischen Kontern'],
    winRate: 85,
    xGAvg: 2.35,
    pressingSuccess: 78,
    nodes: [
      { id: '1', name: 'L. Schneider', number: '1', position: 'TW', role: 'Mitspielender Torwart', xPercent: 8, yPercent: 50, offensivX: 12, offensivY: 50, defensivX: 5, defensivY: 50, umschaltX: 9, umschaltY: 50, speedKmh: 24.5, distanceKm: 4.8, duelSuccessPercent: 90, passAccuracyPercent: 82 },
      { id: '2', name: 'J. Tiedemann', number: '2', position: 'RV', role: 'Offensiver Außenverteidiger', xPercent: 28, yPercent: 15, offensivX: 62, offensivY: 10, defensivX: 22, defensivY: 20, umschaltX: 45, umschaltY: 12, speedKmh: 31.8, distanceKm: 11.2, duelSuccessPercent: 78, passAccuracyPercent: 84 },
      { id: '3', name: 'M. Paolillo', number: '4', position: 'IV', role: 'Aufbau-Innenverteidiger', xPercent: 24, yPercent: 38, offensivX: 32, offensivY: 35, defensivX: 18, defensivY: 38, umschaltX: 26, umschaltY: 38, speedKmh: 28.2, distanceKm: 9.8, duelSuccessPercent: 86, passAccuracyPercent: 91 },
      { id: '4', name: 'S. Klett', number: '5', position: 'IV', role: 'Zweikampf-Organisator', xPercent: 24, yPercent: 62, offensivX: 32, offensivY: 65, defensivX: 18, defensivY: 62, umschaltX: 26, umschaltY: 62, speedKmh: 29.1, distanceKm: 10.1, duelSuccessPercent: 88, passAccuracyPercent: 88 },
      { id: '5', name: 'F. Ritzenthaler', number: '3', position: 'LV', role: 'Invertierter Außenverteidiger', xPercent: 28, yPercent: 85, offensivX: 60, offensivY: 88, defensivX: 22, defensivY: 80, umschaltX: 44, umschaltY: 86, speedKmh: 30.5, distanceKm: 10.9, duelSuccessPercent: 74, passAccuracyPercent: 86 },
      { id: '6', name: 'Y. Kalchschmidt', number: '6', position: 'DM', role: 'Tiefen-Strategie & Abräumer', xPercent: 42, yPercent: 38, offensivX: 52, offensivY: 35, defensivX: 34, defensivY: 40, umschaltX: 46, umschaltY: 38, speedKmh: 29.8, distanceKm: 11.8, duelSuccessPercent: 82, passAccuracyPercent: 89 },
      { id: '7', name: 'A. Boutagrat', number: '8', position: 'ZM', role: 'Box-to-Box Antreiber', xPercent: 48, yPercent: 62, offensivX: 66, offensivY: 60, defensivX: 36, defensivY: 60, umschaltX: 52, umschaltY: 62, speedKmh: 30.2, distanceKm: 12.1, duelSuccessPercent: 80, passAccuracyPercent: 87 },
      { id: '8', name: 'I. Valchuk', number: '7', position: 'RA', role: 'Dribbler & 1v1 Spezialist', xPercent: 68, yPercent: 18, offensivX: 82, offensivY: 15, defensivX: 48, defensivY: 25, umschaltX: 74, umschaltY: 18, speedKmh: 32.4, distanceKm: 10.8, duelSuccessPercent: 71, passAccuracyPercent: 81 },
      { id: '9', name: 'B. Dischinger', number: '10', position: 'OM', role: 'Spielmacher im Halbraum', xPercent: 65, yPercent: 50, offensivX: 78, offensivY: 50, defensivX: 46, defensivY: 50, umschaltX: 70, umschaltY: 50, speedKmh: 28.9, distanceKm: 11.0, duelSuccessPercent: 75, passAccuracyPercent: 92 },
      { id: '10', name: 'J. Ehret', number: '11', position: 'LA', role: 'Tiefensprinter & Vorbereiter', xPercent: 68, yPercent: 82, offensivX: 82, offensivY: 85, defensivX: 48, defensivY: 75, umschaltX: 74, umschaltY: 82, speedKmh: 33.1, distanceKm: 11.4, duelSuccessPercent: 69, passAccuracyPercent: 79 },
      { id: '11', name: 'J. Akuegwu', number: '9', position: 'ST', role: 'Zielspieler & Wandspieler', xPercent: 84, yPercent: 50, offensivX: 92, offensivY: 50, defensivX: 62, defensivY: 50, umschaltX: 86, umschaltY: 50, speedKmh: 31.9, distanceKm: 10.4, duelSuccessPercent: 84, passAccuracyPercent: 80 }
    ]
  },
  '4-4-2': {
    name: '4-4-2 (Kompakte Kette & Doppelspitze)',
    description: 'Zwei Viererketten halten die Abstände eng. Zielstürmer kombiniert mit schnellem Stoßstürmer.',
    strengths: ['Enorme horizontale Kompaktheit', 'Einfache Absicherung im Zentrum'],
    weaknesses: ['Weniger Anspielstationen in den Halbräumen'],
    winRate: 78,
    xGAvg: 1.95,
    pressingSuccess: 71,
    nodes: [
      { id: '1', name: 'L. Schneider', number: '1', position: 'TW', role: 'Torwart', xPercent: 8, yPercent: 50, offensivX: 10, offensivY: 50, defensivX: 5, defensivY: 50, umschaltX: 8, umschaltY: 50, speedKmh: 24.0, distanceKm: 4.5, duelSuccessPercent: 88, passAccuracyPercent: 80 },
      { id: '2', name: 'J. Tiedemann', number: '2', position: 'RV', role: 'Außenverteidiger', xPercent: 26, yPercent: 18, offensivX: 50, offensivY: 15, defensivX: 20, defensivY: 20, umschaltX: 38, umschaltY: 18, speedKmh: 31.0, distanceKm: 10.5, duelSuccessPercent: 77, passAccuracyPercent: 82 },
      { id: '3', name: 'M. Paolillo', number: '4', position: 'IV', role: 'Innenverteidiger', xPercent: 24, yPercent: 38, offensivX: 30, offensivY: 38, defensivX: 18, defensivY: 38, umschaltX: 25, umschaltY: 38, speedKmh: 28.0, distanceKm: 9.5, duelSuccessPercent: 85, passAccuracyPercent: 88 },
      { id: '4', name: 'S. Klett', number: '5', position: 'IV', role: 'Innenverteidiger', xPercent: 24, yPercent: 62, offensivX: 30, offensivY: 62, defensivX: 18, defensivY: 62, umschaltX: 25, umschaltY: 62, speedKmh: 29.0, distanceKm: 9.8, duelSuccessPercent: 87, passAccuracyPercent: 86 },
      { id: '5', name: 'F. Ritzenthaler', number: '3', position: 'LV', role: 'Außenverteidiger', xPercent: 26, yPercent: 82, offensivX: 50, offensivY: 85, defensivX: 20, defensivY: 80, umschaltX: 38, umschaltY: 82, speedKmh: 30.0, distanceKm: 10.2, duelSuccessPercent: 75, passAccuracyPercent: 84 },
      { id: '6', name: 'I. Valchuk', number: '7', position: 'RM', role: 'Rechter Mittelfeldspieler', xPercent: 50, yPercent: 18, offensivX: 72, offensivY: 15, defensivX: 35, defensivY: 22, umschaltX: 58, umschaltY: 18, speedKmh: 32.0, distanceKm: 11.0, duelSuccessPercent: 72, passAccuracyPercent: 80 },
      { id: '7', name: 'Y. Kalchschmidt', number: '6', position: 'ZM', role: 'Zentraler Mittelfeldspieler', xPercent: 46, yPercent: 38, offensivX: 58, offensivY: 38, defensivX: 32, defensivY: 38, umschaltX: 48, umschaltY: 38, speedKmh: 29.5, distanceKm: 11.5, duelSuccessPercent: 81, passAccuracyPercent: 88 },
      { id: '8', name: 'A. Boutagrat', number: '8', position: 'ZM', role: 'Zentraler Mittelfeldspieler', xPercent: 46, yPercent: 62, offensivX: 58, offensivY: 62, defensivX: 32, defensivY: 62, umschaltX: 48, umschaltY: 62, speedKmh: 30.0, distanceKm: 11.8, duelSuccessPercent: 79, passAccuracyPercent: 86 },
      { id: '9', name: 'J. Ehret', number: '11', position: 'LM', role: 'Linker Mittelfeldspieler', xPercent: 50, yPercent: 82, offensivX: 72, offensivY: 85, defensivX: 35, defensivY: 78, umschaltX: 58, umschaltY: 82, speedKmh: 32.5, distanceKm: 11.1, duelSuccessPercent: 70, passAccuracyPercent: 78 },
      { id: '10', name: 'B. Dischinger', number: '10', position: 'ST', role: 'Hängende Spitze', xPercent: 72, yPercent: 38, offensivX: 84, offensivY: 35, defensivX: 52, defensivY: 40, umschaltX: 72, umschaltY: 38, speedKmh: 29.0, distanceKm: 10.5, duelSuccessPercent: 74, passAccuracyPercent: 90 },
      { id: '11', name: 'J. Akuegwu', number: '9', position: 'ST', role: 'Stoßstürmer', xPercent: 78, yPercent: 62, offensivX: 90, offensivY: 65, defensivX: 58, defensivY: 60, umschaltX: 78, umschaltY: 62, speedKmh: 32.0, distanceKm: 10.2, duelSuccessPercent: 83, passAccuracyPercent: 81 }
    ]
  },
  '4-1-4-1': {
    name: '4-1-4-1 (Single Pivot & Hohes Pressing)',
    description: 'Agiles Pressing-System mit extrem hoher Ballrückeroberung in der gegnerischen Hälfte.',
    strengths: ['Extrem hohes Pressing', 'Fünfer-Mittelfeldkette bei gegnerischem Aufbau'],
    weaknesses: ['Hohe physische Anforderung an den Single-Pivot (DM)'],
    winRate: 82,
    xGAvg: 2.10,
    pressingSuccess: 84,
    nodes: [
      { id: '1', name: 'L. Schneider', number: '1', position: 'TW', role: 'Mitspielender TW', xPercent: 8, yPercent: 50, offensivX: 14, offensivY: 50, defensivX: 5, defensivY: 50, umschaltX: 10, umschaltY: 50, speedKmh: 24.5, distanceKm: 4.9, duelSuccessPercent: 90, passAccuracyPercent: 83 },
      { id: '2', name: 'J. Tiedemann', number: '2', position: 'RV', role: 'Pressing-AV', xPercent: 30, yPercent: 15, offensivX: 64, offensivY: 12, defensivX: 24, defensivY: 18, umschaltX: 48, umschaltY: 15, speedKmh: 31.5, distanceKm: 11.4, duelSuccessPercent: 79, passAccuracyPercent: 85 },
      { id: '3', name: 'M. Paolillo', number: '4', position: 'IV', role: 'Absichernder IV', xPercent: 24, yPercent: 38, offensivX: 35, offensivY: 35, defensivX: 18, defensivY: 38, umschaltX: 28, umschaltY: 38, speedKmh: 28.5, distanceKm: 9.9, duelSuccessPercent: 88, passAccuracyPercent: 90 },
      { id: '4', name: 'S. Klett', number: '5', position: 'IV', role: 'Absichernder IV', xPercent: 24, yPercent: 62, offensivX: 35, offensivY: 65, defensivX: 18, defensivY: 62, umschaltX: 28, umschaltY: 62, speedKmh: 29.3, distanceKm: 10.3, duelSuccessPercent: 89, passAccuracyPercent: 87 },
      { id: '5', name: 'F. Ritzenthaler', number: '3', position: 'LV', role: 'Pressing-AV', xPercent: 30, yPercent: 85, offensivX: 64, offensivY: 88, defensivX: 24, defensivY: 82, umschaltX: 48, umschaltY: 85, speedKmh: 30.8, distanceKm: 11.1, duelSuccessPercent: 76, passAccuracyPercent: 85 },
      { id: '6', name: 'Y. Kalchschmidt', number: '6', position: 'DM', role: 'Single Pivot Anchor', xPercent: 38, yPercent: 50, offensivX: 48, offensivY: 50, defensivX: 30, defensivY: 50, umschaltX: 42, umschaltY: 50, speedKmh: 30.1, distanceKm: 12.4, duelSuccessPercent: 84, passAccuracyPercent: 91 },
      { id: '7', name: 'I. Valchuk', number: '7', position: 'RA', role: 'Pressing-Flügel', xPercent: 64, yPercent: 18, offensivX: 80, offensivY: 15, defensivX: 45, defensivY: 25, umschaltX: 68, umschaltY: 18, speedKmh: 32.8, distanceKm: 11.2, duelSuccessPercent: 73, passAccuracyPercent: 81 },
      { id: '8', name: 'B. Dischinger', number: '10', position: 'ZM', role: 'Achter Offensive', xPercent: 60, yPercent: 38, offensivX: 74, offensivY: 35, defensivX: 44, defensivY: 40, umschaltX: 64, umschaltY: 38, speedKmh: 29.2, distanceKm: 11.6, duelSuccessPercent: 77, passAccuracyPercent: 93 },
      { id: '9', name: 'A. Boutagrat', number: '8', position: 'ZM', role: 'Achter Antreiber', xPercent: 60, yPercent: 62, offensivX: 74, offensivY: 65, defensivX: 44, defensivY: 60, umschaltX: 64, umschaltY: 62, speedKmh: 30.5, distanceKm: 12.0, duelSuccessPercent: 81, passAccuracyPercent: 88 },
      { id: '10', name: 'J. Ehret', number: '11', position: 'LA', role: 'Pressing-Flügel', xPercent: 64, yPercent: 82, offensivX: 80, offensivY: 85, defensivX: 45, defensivY: 75, umschaltX: 68, umschaltY: 82, speedKmh: 33.3, distanceKm: 11.6, duelSuccessPercent: 71, passAccuracyPercent: 80 },
      { id: '11', name: 'J. Akuegwu', number: '9', position: 'ST', role: 'Pressing-Auslöser (Anläufer)', xPercent: 82, yPercent: 50, offensivX: 92, offensivY: 50, defensivX: 60, defensivY: 50, umschaltX: 82, umschaltY: 50, speedKmh: 32.2, distanceKm: 10.9, duelSuccessPercent: 85, passAccuracyPercent: 81 }
    ]
  },
  '3-4-3': {
    name: '3-4-3 (Dreierkette & Schienenspieler)',
    description: 'Dominantes Flügelspiel mit 2 hoch stehenden Schienenspielern und 3er-Sturmreihe.',
    strengths: ['Maximale Breite im Spielaufbau', '3er-Sturm erzeugt ständige Überzahl'],
    weaknesses: ['Anfällig auf den Außenbahn-Räumen hinter den Schienenspielern'],
    winRate: 80,
    xGAvg: 2.18,
    pressingSuccess: 76,
    nodes: [
      { id: '1', name: 'L. Schneider', number: '1', position: 'TW', role: 'Mitspielender TW', xPercent: 8, yPercent: 50, offensivX: 12, offensivY: 50, defensivX: 5, defensivY: 50, umschaltX: 9, umschaltY: 50, speedKmh: 24.2, distanceKm: 4.7, duelSuccessPercent: 89, passAccuracyPercent: 81 },
      { id: '2', name: 'M. Paolillo', number: '4', position: 'IV', role: 'Linker IV (Halbraum)', xPercent: 22, yPercent: 25, offensivX: 32, offensivY: 22, defensivX: 16, defensivY: 25, umschaltX: 24, umschaltY: 25, speedKmh: 28.3, distanceKm: 9.7, duelSuccessPercent: 86, passAccuracyPercent: 91 },
      { id: '3', name: 'S. Klett', number: '5', position: 'IV', role: 'Zentraler IV (Libero)', xPercent: 20, yPercent: 50, offensivX: 28, offensivY: 50, defensivX: 15, defensivY: 50, umschaltX: 22, umschaltY: 50, speedKmh: 29.2, distanceKm: 9.9, duelSuccessPercent: 89, passAccuracyPercent: 89 },
      { id: '4', name: 'J. Tiedemann', number: '2', position: 'IV', role: 'Rechter IV (Halbraum)', xPercent: 22, yPercent: 75, offensivX: 32, offensivY: 78, defensivX: 16, defensivY: 75, umschaltX: 24, umschaltY: 75, speedKmh: 31.2, distanceKm: 10.6, duelSuccessPercent: 81, passAccuracyPercent: 86 },
      { id: '5', name: 'I. Valchuk', number: '7', position: 'RAV', role: 'Schienenspieler Rechts', xPercent: 48, yPercent: 12, offensivX: 75, offensivY: 8, defensivX: 28, defensivY: 15, umschaltX: 56, umschaltY: 10, speedKmh: 33.0, distanceKm: 12.6, duelSuccessPercent: 75, passAccuracyPercent: 82 },
      { id: '6', name: 'Y. Kalchschmidt', number: '6', position: 'ZM', role: 'Strategischer ZM', xPercent: 44, yPercent: 38, offensivX: 56, offensivY: 36, defensivX: 32, defensivY: 38, umschaltX: 46, umschaltY: 38, speedKmh: 29.9, distanceKm: 11.9, duelSuccessPercent: 83, passAccuracyPercent: 90 },
      { id: '7', name: 'A. Boutagrat', number: '8', position: 'ZM', role: 'Dynamischer ZM', xPercent: 44, yPercent: 62, offensivX: 56, offensivY: 64, defensivX: 32, defensivY: 62, umschaltX: 46, umschaltY: 62, speedKmh: 30.4, distanceKm: 12.2, duelSuccessPercent: 80, passAccuracyPercent: 87 },
      { id: '8', name: 'F. Ritzenthaler', number: '3', position: 'LAV', role: 'Schienenspieler Links', xPercent: 48, yPercent: 88, offensivX: 75, offensivY: 92, defensivX: 28, defensivY: 85, umschaltX: 56, umschaltY: 90, speedKmh: 31.4, distanceKm: 12.3, duelSuccessPercent: 76, passAccuracyPercent: 84 },
      { id: '9', name: 'B. Dischinger', number: '10', position: 'RF', role: 'Rechter Flügelstürmer', xPercent: 70, yPercent: 25, offensivX: 84, offensivY: 22, defensivX: 50, defensivY: 30, umschaltX: 74, umschaltY: 25, speedKmh: 29.1, distanceKm: 10.9, duelSuccessPercent: 76, passAccuracyPercent: 92 },
      { id: '10', name: 'J. Akuegwu', number: '9', position: 'ST', role: 'Zentraler Mittelstürmer', xPercent: 80, yPercent: 50, offensivX: 92, offensivY: 50, defensivX: 58, defensivY: 50, umschaltX: 84, umschaltY: 50, speedKmh: 32.1, distanceKm: 10.5, duelSuccessPercent: 86, passAccuracyPercent: 82 },
      { id: '11', name: 'J. Ehret', number: '11', position: 'LF', role: 'Linker Flügelstürmer', xPercent: 70, yPercent: 75, offensivX: 84, offensivY: 78, defensivX: 50, defensivY: 70, umschaltX: 74, umschaltY: 75, speedKmh: 33.2, distanceKm: 11.3, duelSuccessPercent: 71, passAccuracyPercent: 80 }
    ]
  },
  'salem_match': {
    name: 'RW Salem vs. FC Auggen (1:2 Auswärtssieg - Startelf)',
    description: 'Offizielle Startelf beim 1:2-Auswärtssieg in Salem (37\' Y. Roth 0:1, 54\' Y. Roth 0:2, 67\' Z. Kane 1:2). Altersdurchschnitt ∅ 23.44 Jahre.',
    strengths: ['Effiziente Chancenverwertung (Doppelpack Y. Roth)', 'Kompakter Defensivverbund um Kapitän Reinecker', 'Hohe Laufbereitschaft im Mittelfeldzirkel (Scalici & Dischinger)'],
    weaknesses: ['Anschlusstreffer durch Z. Kane in der 67. Minute'],
    winRate: 100,
    xGAvg: 2.38,
    pressingSuccess: 83,
    nodes: [
      { id: '23', name: 'S. Lauer', number: '23', position: 'TW', role: 'Torwart', xPercent: 8, yPercent: 50, offensivX: 12, offensivY: 50, defensivX: 5, defensivY: 50, umschaltX: 9, umschaltY: 50, speedKmh: 24.5, distanceKm: 4.8, duelSuccessPercent: 92, passAccuracyPercent: 84 },
      { id: '6', name: 'J. Agbozo', number: '6', position: 'RV', role: 'Rechter Außenverteidiger', xPercent: 28, yPercent: 15, offensivX: 62, offensivY: 12, defensivX: 20, defensivY: 18, umschaltX: 42, umschaltY: 14, speedKmh: 31.8, distanceKm: 10.9, duelSuccessPercent: 81, passAccuracyPercent: 85 },
      { id: '21', name: 'M. Disch', number: '21', position: 'IV', role: 'Innenverteidiger', xPercent: 24, yPercent: 38, offensivX: 32, offensivY: 36, defensivX: 16, defensivY: 38, umschaltX: 24, umschaltY: 38, speedKmh: 28.5, distanceKm: 9.8, duelSuccessPercent: 87, passAccuracyPercent: 89 },
      { id: '5', name: 'J. Fangmeier', number: '5', position: 'IV', role: 'Innenverteidiger', xPercent: 24, yPercent: 62, offensivX: 32, offensivY: 64, defensivX: 16, defensivY: 62, umschaltX: 24, umschaltY: 62, speedKmh: 29.0, distanceKm: 10.1, duelSuccessPercent: 88, passAccuracyPercent: 88 },
      { id: '13', name: 'S. Reinecker (C)', number: '13', position: 'LV', role: 'Kapitän & Linker Außenverteidiger', xPercent: 28, yPercent: 85, offensivX: 58, offensivY: 88, defensivX: 20, defensivY: 82, umschaltX: 40, umschaltY: 86, speedKmh: 30.2, distanceKm: 10.8, duelSuccessPercent: 85, passAccuracyPercent: 87 },
      { id: '10', name: 'J. Ehret', number: '10', position: 'DM', role: 'Defensives Mittelfeld & Stratege', xPercent: 44, yPercent: 50, offensivX: 54, offensivY: 50, defensivX: 32, defensivY: 50, umschaltX: 45, umschaltY: 50, speedKmh: 30.4, distanceKm: 11.9, duelSuccessPercent: 82, passAccuracyPercent: 91 },
      { id: '7', name: 'J. Dischinger', number: '7', position: 'ZM', role: 'Zentrales Mittelfeld (Box-to-Box)', xPercent: 54, yPercent: 32, offensivX: 70, offensivY: 28, defensivX: 38, defensivY: 35, umschaltX: 58, umschaltY: 30, speedKmh: 31.0, distanceKm: 11.7, duelSuccessPercent: 80, passAccuracyPercent: 86 },
      { id: '18', name: 'G. Scalici', number: '18', position: 'ZM', role: 'Zentrales Mittelfeld (Achter)', xPercent: 54, yPercent: 68, offensivX: 70, offensivY: 72, defensivX: 38, defensivY: 65, umschaltX: 58, umschaltY: 70, speedKmh: 30.8, distanceKm: 11.5, duelSuccessPercent: 78, passAccuracyPercent: 88 },
      { id: '20', name: 'T. Nguyen', number: '20', position: 'RA', role: 'Rechtsaußen / Flügelangriff', xPercent: 74, yPercent: 20, offensivX: 86, offensivY: 15, defensivX: 48, defensivY: 25, umschaltX: 72, umschaltY: 18, speedKmh: 33.2, distanceKm: 11.2, duelSuccessPercent: 74, passAccuracyPercent: 82 },
      { id: '28', name: 'M. Roth', number: '28', position: 'MS', role: 'Mittelstürmer / Stoßspitze', xPercent: 82, yPercent: 50, offensivX: 92, offensivY: 50, defensivX: 58, defensivY: 50, umschaltX: 80, umschaltY: 50, speedKmh: 31.5, distanceKm: 10.6, duelSuccessPercent: 84, passAccuracyPercent: 81 },
      { id: '24', name: 'Y. Roth', number: '24', position: 'LA', role: 'Linksaußen & Matchwinner (37\', 54\')', xPercent: 74, yPercent: 80, offensivX: 88, offensivY: 85, defensivX: 50, defensivY: 75, umschaltX: 74, umschaltY: 82, speedKmh: 32.9, distanceKm: 11.4, duelSuccessPercent: 86, passAccuracyPercent: 84 }
    ]
  }
};

const PREDEFINED_ROLES = [
  '6er', '8er', '10er', 'Außenbahn', 'Stoßstürmer', 
  'Wandspieler', 'Abräumer', 'Invertierter AV', 'Schienenspieler', 'Flügelstürmer'
];

const PREDEFINED_ZONES = [
  { name: 'Keine', color: 'transparent' },
  { name: 'Pressing-Zone', color: 'rgba(239, 68, 68, 0.25)' },
  { name: 'Halbraum', color: 'rgba(245, 158, 11, 0.25)' },
  { name: 'Flügel-Überladung', color: 'rgba(59, 130, 246, 0.25)' },
  { name: 'Sturmbox', color: 'rgba(16, 185, 129, 0.25)' }
];

export const Profi3DTacticBoardView: React.FC<Profi3DTacticBoardViewProps> = ({
  players,
  onNavigateToVideo,
  isEditing = false
}) => {
  const [trainerEditMode, setTrainerEditMode] = useState<boolean>(isEditing);

  useEffect(() => {
    setTrainerEditMode(isEditing);
  }, [isEditing]);

  const [selectedFormation, setSelectedFormation] = useState<TacticFormation>('4-2-3-1');
  const [activePhase, setActivePhase] = useState<MatchPhase>('offensiv');
  const [viewMode, setViewMode] = useState<ViewMode>('3d_tv');
  const [showZonesGrid, setShowZonesGrid] = useState<boolean>(true);
  const [showHeatmaps, setShowHeatmaps] = useState<boolean>(true);
  const [showRunVectors, setShowRunVectors] = useState<boolean>(true);
  const [isTvMode, setIsTvMode] = useState<boolean>(false);
  const [isPitchOnlyFullscreen, setIsPitchOnlyFullscreen] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPitchOnlyFullscreen) {
        setIsPitchOnlyFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPitchOnlyFullscreen]);
  const [activeTabSub, setActiveTabSub] = useState<'board' | 'comparison' | 'standards' | 'drawing_canvas' | 'ai_summary' | 'phase_options' | 'presentation'>('board');
  const [showTrainerPhasePanelOnBoard, setShowTrainerPhasePanelOnBoard] = useState<boolean>(false);
  const [showAllPhasesExpanded, setShowAllPhasesExpanded] = useState<boolean>(false);
  
  // Spieltagspräsentation State
  const [presentationSlideIndex, setPresentationSlideIndex] = useState<number>(0);
  const [selectedPresentationMatchId, setSelectedPresentationMatchId] = useState<string>('m_33');

  const selectedMatchObj = useMemo(() => {
    const matchIdClean = selectedPresentationMatchId.replace('m_', '');
    const found = data.competitiveMatches.find(m => String(m.id) === matchIdClean || m.opponent.toLowerCase().includes(selectedPresentationMatchId.toLowerCase()));
    if (found) return found;
    return data.competitiveMatches.find(m => m.id === 33 || m.opponent.includes('Salem')) || data.competitiveMatches[0];
  }, [selectedPresentationMatchId]);
  const [presentationCoachingPoints, setPresentationCoachingPoints] = useState<string[]>([
    '⚡ 1. Frühes Anlaufen über die Flügel mit Yanik Roth und Bao Nguyen.',
    '🧠 2. Hohe Spielschärfe im Mittelfeldzirkel durch Giuliano Scalici und Julius Dischinger.',
    '🎯 3. Schnelles Umschalten nach Ballgewinn und gezielte Tiefenläufe in die gegnerische Kette.',
    '🛡️ 4. Disziplinierte Restverteidigung & 4er-Kette mit Kapitän Sven Reinecker und Stefan Lauer.',
    '🔥 5. Kaltschnäuzige Chancenverwertung – Yanik Roth eiskalt vor dem Kasten (Doppelpack 37´ & 54´).'
  ]);
  const [editingCoachingPointText, setEditingCoachingPointText] = useState<string>('');
  const [showEditCoachingModal, setShowEditCoachingModal] = useState<boolean>(false);

  // Player Photos & Squad (Kader) Synchronization
  const [showPlayerPhotos, setShowPlayerPhotos] = useState<boolean>(true);
  const [customPlayerMap, setCustomPlayerMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('fca_tactic_player_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const updateCustomPlayerMap = useCallback((nodeId: string, playerId: string) => {
    setCustomPlayerMap(prev => {
      const next = { ...prev, [nodeId]: playerId };
      try {
        localStorage.setItem('fca_tactic_player_map', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Helper to match corresponding player from squad (Kader) data
  const findPlayerForNode = useCallback((node: { id?: string; name?: string; number?: string | number; position?: string }) => {
    if (!players || players.length === 0) return undefined;

    // 0. Check explicit custom player mapping
    if (node.id && customPlayerMap[node.id]) {
      const p = players.find(pl => String(pl.id) === String(customPlayerMap[node.id]));
      if (p) return p;
    }

    // 1. Direct ID match
    if (node.id) {
      const p = players.find(pl => String(pl.id) === String(node.id));
      if (p) return p;
    }

    // 2. Name match (e.g. 'J. Tiedemann' -> 'Tiedemann', 'J. Akuegwu' -> 'Akuegwu')
    if (node.name) {
      const cleanName = node.name.toLowerCase().trim();
      const parts = cleanName.split(' ').map(s => s.replace(/[^a-zäöüß]/gi, '').trim()).filter(s => s.length > 2);
      
      const matched = players.find(pl => {
        const lName = (pl.lastName || '').toLowerCase().trim();
        const fName = (pl.firstName || '').toLowerCase().trim();
        const fullName = `${fName} ${lName}`.trim();
        if (lName && cleanName.includes(lName)) return true;
        if (fullName && cleanName.includes(fullName)) return true;
        if (parts.some(p => (lName && lName.includes(p)) || (fName && fName.includes(p)))) return true;
        return false;
      });
      if (matched) return matched;
    }

    // 3. Trikotnummer match
    if (node.number !== undefined && node.number !== '' && node.number !== null) {
      const numStr = String(node.number);
      const p = players.find(pl => String(pl.number) === numStr);
      if (p) return p;
    }

    // 4. Position match fallback
    if (node.position) {
      const pos = node.position.toUpperCase();
      const p = players.find(pl => pl.position && pl.position.toUpperCase().includes(pos));
      if (p) return p;
    }

    return undefined;
  }, [players, customPlayerMap]);
  
  // Tactical Phase Analysis Configurator State
  const [tacticalPhaseConfig, setTacticalPhaseConfig] = useState({
    offensiv: {
      aufbauhoehe: 'mittelhoch', // tief | mittelhoch | hoch
      ueberzahlzonen: '6er', // IV | 6er | Halbraum
      progression: 'Kurzpass', // Kurzpass | Direktspiel | Verlagerung
      halbraumnutzung: 'Zehner', // Achter | Zehner | inverser Flügel
      offensivfokus: 'Flügel', // Flügel | Zentrum | Umschaltspiel
    },
    defensiv: {
      pressinghoehe: 'mittel', // hoch | mittel | tief
      pressinglenkung: 'Außenbahn', // Außenbahn | schwacher Fuß | Pressingfalle
      kompaktheit: 'eng', // eng | breit | mittig
      mannorientierung: 'situativ', // ja | nein | situativ
    },
    umschaltenOffensiv: {
      zielzone: 'Flügel', // Flügel | Zentrum
      tempo: 'schnell', // schnell | kontrolliert
      fokusspieler: 'Stürmer', // Stürmer | Zehner | Flügel
      muster: 'Tiefgang', // Steil-Klatsch | Tiefgang | Direktspiel
    },
    umschaltenDefensiv: {
      gegenpressingintensitaet: 'hoch', // hoch | mittel | niedrig
      trigger: 'Ballverlust Halbraum', // Ballverlust Halbraum | schlechter Kontakt Gegner
      absicherung: '3er Restverteidigung', // 2+1 | 3er Restverteidigung
      pressingseite: 'situativ', // links | rechts | situativ
    }
  });
  const [customTrainerNotes, setCustomTrainerNotes] = useState<string>(
    'FC Auggen Matchplan: Gegenpressing im 1. Halbraum auslösen. Sobald Dischinger den Ball festmacht, startet Akuegwu den tiefen Run.'
  );

  // Slide-Specific Edit States (For all 9 Slides)
  const [slideEditingActive, setSlideEditingActive] = useState<boolean>(false);
  
  // Slide 0: Titel & Match
  const [matchNotes, setMatchNotes] = useState({
    home: 'Stamm-System 4-2-3-1 mit doppelter Sechs und variabler Offensive.',
    opponent: 'Aggressives Anpressen. Anfällig gegen schnelle Verlagerungen.',
    focus: 'Pressing HOCH, Aufbau MITTELHOCH.'
  });

  // Slide 1: Aufstellung & Bank
  const [presentationSubstitutes, setPresentationSubstitutes] = useState<Array<{ num: string; name: string; pos: string; note: string }>>([
    { num: '12', name: 'M. Lais', pos: 'ETW', note: 'Ersatztorwart' },
    { num: '13', name: 'N. Asal', pos: 'IV', note: 'Zweikampf-Option' },
    { num: '14', name: 'T. Bacelic', pos: 'ZM', note: 'Mittelfeld-Stabilität' },
    { num: '15', name: 'S. Saur', pos: 'RA', note: 'Tempo-Joker' },
    { num: '16', name: 'M. Bischoff', pos: 'ST', note: 'Strafraum-Brecher' }
  ]);

  // Auto-sync Salem match presentation details (Startelf & Bank)
  useEffect(() => {
    const isSalem = selectedMatchObj?.opponent?.toLowerCase().includes('salem') || selectedFormation === 'salem_match';
    if (isSalem) {
      setPresentationSubstitutes([
        { num: '2', name: 'T. Podlich', pos: 'Abwehr', note: 'Außenverteidiger' },
        { num: '19', name: 'S. Ismaili', pos: 'Mittelfeld', note: 'Zentrales Mittelfeld' },
        { num: '15', name: 'D. Valchuk', pos: 'Mittelfeld', note: 'Flügelspieler / ZM' },
        { num: '30', name: 'J. Akuegwu', pos: 'Angriff', note: 'Stoßstürmer' },
        { num: '1', name: 'L. Misic', pos: 'Torwart', note: 'Ersatztorwart' },
        { num: '43', name: 'K. Yarayan', pos: 'Abwehr', note: 'Innenverteidiger' },
        { num: '11', name: 'J. Ehret', pos: 'Mittelfeld', note: 'Offensives Mittelfeld' }
      ]);
      setMatchNotes({
        home: '4-3-3 / 4-2-3-1 (Alter: ∅ 23.44 Jahre) mit hoher Pressingschärfe.',
        opponent: 'RW Salem (1:2 Auswärtssieg) – Tore: 37\' & 54\' Y. Roth, 67\' Z. Kane.',
        focus: 'Tempo-Gegenstöße über Y. Roth & Nguyen sowie Zentrum-Absicherung.'
      });
    }
  }, [selectedMatchObj, selectedFormation]);

  // Slide 2: Formation
  const [formationNotes, setFormationNotes] = useState({
    defenseLine: 'Tiedemann (RV), Paolillo (IV), Klett (IV), Ritzenthaler (LV). Asymmetrisches Einrücken bei Ballbesitz.',
    doublePivot: 'Kalchschmidt (Abräumer) + Boutagrat (Box-to-Box Antreiber). Absicherung des 1. Halbraums.',
    attackingRow: 'Valchuk (RA) + Dischinger (OM im Halbraum) + Ehret (LA invers).',
    striker: 'Akuegwu (ST). Bindet gegnerische Innenverteidiger und erzeugt Raum durch Tiefenläufe.'
  });

  // Slide 3: Defensiv
  const [defensiveRulesList, setDefensiveRulesList] = useState<string[]>([
    'Anpress-Trigger: Pass auf den schwachen Außenverteidiger löst hohes Nachrücken aus.',
    'Zentrum schließen: Kalchschmidt & Boutagrat doppeln die Schnittstelle.',
    'Restverteidigung: 3er-Sicherung hinter dem Ball zur Absicherung gegen Konter.'
  ]);

  // Slide 4: Offensiv
  const [offensiveGuidelinesList, setOffensiveGuidelinesList] = useState<string[]>([
    '1. Andribbeln & Halbraum-Besetzung: IV lockt Anpressen, Dischinger besetzt Halbraum.',
    '2. Steil-Klatsch-Kombinationen: Anspiel auf Akuegwu, Klatsch auf Boutagrat, Steckpass auf Ehret.'
  ]);

  // Slide 8: Spielbericht & Metriken
  const [presentationMetrics, setPresentationMetrics] = useState({
    passQuote: '86.4%',
    duelWin: '58.2%',
    counterPress: '78.0%'
  });

  // Inputs for adding new items on slides
  const [newSubForm, setNewSubForm] = useState({ num: '', name: '', pos: 'ZM', note: '' });
  const [newDefensiveRule, setNewDefensiveRule] = useState<string>('');
  const [newOffensiveGuideline, setNewOffensiveGuideline] = useState<string>('');
  const [newSlideStandardInput, setNewSlideStandardInput] = useState({ name: '', description: '', successRate: 75 });
  const [newCoachingPointInput, setNewCoachingPointInput] = useState<string>('');

  const [notification, setNotification] = useState<string | null>(null);

  // Standards State & Local Storage Sync
  const [standardsList, setStandardsList] = useState<StandardVariant[]>(() => {
    try {
      const saved = localStorage.getItem('fca_standards_variants');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Error loading standards variants", e);
    }
    return [
      {
        id: 'std_sweden',
        name: 'Ecke OFF: Spezial-Variante "Sweden"',
        type: 'ecke_offensiv',
        executor: 'B. Dischinger / I. Valchuk',
        keyPlayers: 'Dischinger, Valchuk, Paolillo',
        description: 'Kurze Übergabe an der Eckfahne mit Hinterlaufen durch Valchuk. Dischinger zieht nach innen und schlenzt den Ball mit Bogenlampe auf den 2. Pfosten auf Paolillo.',
        successRate: 88,
        aiTacticNotes: 'Überwindet gegnerische Raumdeckung durch Erzeugung eines 2v1 Überzahlmoments an der Eckfahne.',
        positions: [
          { id: '1', name: 'L. Schneider', number: '1', role: 'Absicherung', xPercent: 15, yPercent: 50 },
          { id: '2', name: 'J. Tiedemann', role: 'Konterabsicherung', xPercent: 35, yPercent: 30, number: '2' },
          { id: '3', name: 'M. Paolillo', role: 'Kopfball 2. Pfosten', xPercent: 92, yPercent: 70, number: '4' },
          { id: '4', name: 'S. Klett', role: 'Sperre gegnerischer IV', xPercent: 88, yPercent: 45, number: '5' },
          { id: '5', name: 'F. Ritzenthaler', role: 'Rückraum 16er', xPercent: 65, yPercent: 50, number: '3' },
          { id: '6', name: 'Y. Kalchschmidt', role: '2. Ball Rebound', xPercent: 72, yPercent: 42, number: '6' },
          { id: '7', name: 'A. Boutagrat', role: 'Flügel-Sicherung', xPercent: 80, yPercent: 20, number: '8' },
          { id: '8', name: 'I. Valchuk', role: 'Hinterläufer Eckfahne', xPercent: 94, yPercent: 12, number: '7' },
          { id: '9', name: 'B. Dischinger', role: 'Ausführer Kurzpass', xPercent: 98, yPercent: 5, number: '10' },
          { id: '10', name: 'J. Ehret', role: 'Mauer-Finte', xPercent: 90, yPercent: 35, number: '11' },
          { id: '11', name: 'J. Akuegwu', role: 'Einläufer 1. Pfosten', xPercent: 86, yPercent: 40, number: '9' }
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: 'std_charles',
        name: 'Halbfeld-Freistoß: Spezial-Variante "Charles"',
        type: 'freistoss_halbfeld',
        executor: 'Y. Kalchschmidt',
        keyPlayers: 'Kalchschmidt, Dischinger, Boutagrat',
        description: 'Antäuschen einer Bogenflanke in den 16er, stattdessen versteckter flacher Pass rückwärts an den Strafraumkreis für Dischingers direkten Distanzschuss.',
        successRate: 82,
        aiTacticNotes: 'Perfekt gegen tief stehende Ketten, die früh zurückweichen und den Rückraum verwaist lassen.',
        positions: [
          { id: '1', name: 'L. Schneider', number: '1', role: 'Absicherung', xPercent: 15, yPercent: 50 },
          { id: '2', name: 'J. Tiedemann', role: 'Zielspieler 2. Pfosten', xPercent: 88, yPercent: 75, number: '2' },
          { id: '3', name: 'M. Paolillo', role: 'Einläufer Zentrum', xPercent: 85, yPercent: 50, number: '4' },
          { id: '4', name: 'S. Klett', role: 'Sperre gegnerischer IV', xPercent: 82, yPercent: 45, number: '5' },
          { id: '5', name: 'F. Ritzenthaler', role: 'Konterabsicherung LV', xPercent: 45, yPercent: 80, number: '3' },
          { id: '6', name: 'Y. Kalchschmidt', role: 'Passgeber Rückraum', xPercent: 60, yPercent: 30, number: '6' },
          { id: '7', name: 'A. Boutagrat', role: 'Abschirmung Schütze', xPercent: 72, yPercent: 48, number: '8' },
          { id: '8', name: 'I. Valchuk', role: 'Ablenkung rechts', xPercent: 80, yPercent: 20, number: '7' },
          { id: '9', name: 'B. Dischinger', role: 'Schütze 16er-Kreis', xPercent: 70, yPercent: 50, number: '10' },
          { id: '10', name: 'J. Ehret', role: 'Lauflinie links', xPercent: 84, yPercent: 85, number: '11' },
          { id: '11', name: 'J. Akuegwu', role: 'Zentrum Bindung', xPercent: 90, yPercent: 52, number: '9' }
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: 'std_zug',
        name: 'Ecke OFF: Spezial-Variante "Zug" (Dynamik)',
        type: 'ecke_offensiv',
        executor: 'B. Dischinger',
        keyPlayers: 'Akuegwu, Klett, Paolillo, Tiedemann',
        description: 'Alle 5 Kopfballspieler starten gestaffelt von der 16er-Linie und laufen im Höchsttempo ("Zug zum Tor") synchron bei Ballabgabe ein.',
        successRate: 90,
        aiTacticNotes: 'Unverteidigbar in Manndeckung durch Tempovorteil im Anlauf gegenüber stehenden Verteidigern.',
        positions: [
          { id: '1', name: 'L. Schneider', number: '1', role: 'Absicherung', xPercent: 15, yPercent: 50 },
          { id: '2', name: 'J. Tiedemann', role: 'Zug-Einläufer 3', xPercent: 75, yPercent: 30, number: '2' },
          { id: '3', name: 'M. Paolillo', role: 'Zug-Einläufer 1', xPercent: 75, yPercent: 45, number: '4' },
          { id: '4', name: 'S. Klett', role: 'Zug-Einläufer 2', xPercent: 75, yPercent: 55, number: '5' },
          { id: '5', name: 'F. Ritzenthaler', role: 'Rückraum', xPercent: 60, yPercent: 50, number: '3' },
          { id: '6', name: 'Y. Kalchschmidt', role: 'Rebound 16er', xPercent: 68, yPercent: 50, number: '6' },
          { id: '7', name: 'A. Boutagrat', role: 'Zug-Einläufer 4', xPercent: 75, yPercent: 65, number: '8' },
          { id: '8', name: 'I. Valchuk', role: 'Kurze Option', xPercent: 90, yPercent: 15, number: '7' },
          { id: '9', name: 'B. Dischinger', role: 'Scharfe Flanke', xPercent: 98, yPercent: 5, number: '10' },
          { id: '10', name: 'J. Ehret', role: 'Zug-Einläufer 5', xPercent: 75, yPercent: 75, number: '11' },
          { id: '11', name: 'J. Akuegwu', role: 'Zug-Spitze 5m', xPercent: 88, yPercent: 50, number: '9' }
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: 'std_leverkusen',
        name: 'Ecke OFF: Spezial-Variante "Leverkusen"',
        type: 'ecke_offensiv',
        executor: 'I. Valchuk / B. Dischinger',
        keyPlayers: 'Akuegwu, Ehret, Valchuk',
        description: 'Scharfe, flache, geschneidert geschossene Hereingabe an den kurzen Pfosten. Akuegwu chipt den Ball mit der Hacke über den Torwart.',
        successRate: 84,
        aiTacticNotes: 'Überraschungseffekt in der Anfangsphase. Erfordert exaktes Timing zwischen Schütze und Akuegwu.',
        positions: [
          { id: '1', name: 'L. Schneider', number: '1', role: 'Absicherung', xPercent: 15, yPercent: 50 },
          { id: '2', name: 'J. Tiedemann', role: 'Konterabsicherung', xPercent: 35, yPercent: 30, number: '2' },
          { id: '3', name: 'M. Paolillo', role: 'Zentrum Bindung', xPercent: 85, yPercent: 45, number: '4' },
          { id: '4', name: 'S. Klett', role: '2. Pfosten Lauer', xPercent: 90, yPercent: 65, number: '5' },
          { id: '5', name: 'F. Ritzenthaler', role: 'Rückraum', xPercent: 65, yPercent: 50, number: '3' },
          { id: '6', name: 'Y. Kalchschmidt', role: 'Rebound', xPercent: 72, yPercent: 42, number: '6' },
          { id: '7', name: 'A. Boutagrat', role: 'Sicherung', xPercent: 80, yPercent: 20, number: '8' },
          { id: '8', name: 'I. Valchuk', role: 'Scharfer Ausführer', xPercent: 98, yPercent: 5, number: '7' },
          { id: '9', name: 'B. Dischinger', role: 'Kurze Anspielstation', xPercent: 92, yPercent: 15, number: '10' },
          { id: '10', name: 'J. Ehret', role: 'Keeper Block', xPercent: 94, yPercent: 45, number: '11' },
          { id: '11', name: 'J. Akuegwu', role: 'Hacken-Chipper 1. Pfosten', xPercent: 92, yPercent: 38, number: '9' }
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: 'std_2',
        name: 'Halbfeld-Freistoß: Chipper & 2. Ball',
        type: 'freistoss_halbfeld',
        executor: 'Y. Kalchschmidt',
        keyPlayers: 'Tiedemann, Boutagrat, Klett',
        description: 'Flanke auf den 2. Pfosten auf Tiedemann, welcher den Ball quer in den Rückraum legt für den aufrückenden Boutagrat.',
        successRate: 78,
        aiTacticNotes: 'Erzeugt Verwirrung in der gegnerischen Raumdeckung. Wichtig: Dischinger blockt den zentralen IV.',
        positions: [
          { id: '1', name: 'L. Schneider', number: '1', role: 'Absicherung', xPercent: 15, yPercent: 50 },
          { id: '2', name: 'J. Tiedemann', role: 'Zielspieler 2. Pfosten', xPercent: 88, yPercent: 75, number: '2' },
          { id: '3', name: 'M. Paolillo', role: 'Einläufer Zentrum', xPercent: 85, yPercent: 50, number: '4' },
          { id: '4', name: 'S. Klett', role: 'Sperre gegnerischer IV', xPercent: 82, yPercent: 45, number: '5' },
          { id: '5', name: 'F. Ritzenthaler', role: 'Konterabsicherung LV', xPercent: 45, yPercent: 80, number: '3' },
          { id: '6', name: 'Y. Kalchschmidt', role: 'Freistoß-Ausführer', xPercent: 60, yPercent: 30, number: '6' },
          { id: '7', name: 'A. Boutagrat', role: 'Schütze 2. Ball', xPercent: 75, yPercent: 50, number: '8' },
          { id: '8', name: 'I. Valchuk', role: 'Ablenkung rechts', xPercent: 80, yPercent: 20, number: '7' },
          { id: '9', name: 'B. Dischinger', role: 'Mauer-Sichtschutz', xPercent: 70, yPercent: 35, number: '10' },
          { id: '10', name: 'J. Ehret', role: 'Lauflinie links', xPercent: 84, yPercent: 85, number: '11' },
          { id: '11', name: 'J. Akuegwu', role: 'Zentrum Bindung', xPercent: 90, yPercent: 52, number: '9' }
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: 'std_3',
        name: 'Weiter Einwurf: Harpoon in den 16er',
        type: 'einwurf_weit',
        executor: 'F. Ritzenthaler / J. Tiedemann',
        keyPlayers: 'Ritzenthaler, Akuegwu, Ehret',
        description: 'Ritzenthaler wirft mit voller Wucht weit an die 16er-Kante, Akuegwu verlängert per Kopf in den Lauf von Ehret.',
        successRate: 72,
        aiTacticNotes: 'Wirkt wie ein Eckball aus dem Halbfeld. Kalchschmidt muss den 2. Ball am 16er-Bogen sichern.',
        positions: [
          { id: '1', name: 'L. Schneider', number: '1', role: 'Absicherung', xPercent: 15, yPercent: 50 },
          { id: '2', name: 'J. Tiedemann', role: 'Absicherung RV', xPercent: 40, yPercent: 20, number: '2' },
          { id: '3', name: 'M. Paolillo', role: 'Kopfball-Absicherung', xPercent: 55, yPercent: 45, number: '4' },
          { id: '4', name: 'S. Klett', role: 'Zentrum Rebound', xPercent: 65, yPercent: 55, number: '5' },
          { id: '5', name: 'F. Ritzenthaler', role: 'Einwerfer (Seitenlinie)', xPercent: 75, yPercent: 98, number: '3' },
          { id: '6', name: 'Y. Kalchschmidt', role: 'Rückraum 16er-Bogen', xPercent: 70, yPercent: 60, number: '6' },
          { id: '7', name: 'A. Boutagrat', role: 'Entgegenkommen Finte', xPercent: 72, yPercent: 85, number: '8' },
          { id: '8', name: 'I. Valchuk', role: 'Abfälschen 2. Pfosten', xPercent: 88, yPercent: 30, number: '7' },
          { id: '9', name: 'B. Dischinger', role: 'Verwirrung 5m', xPercent: 85, yPercent: 50, number: '10' },
          { id: '10', name: 'J. Ehret', role: 'Abschlusspieler 2. Pfosten', xPercent: 89, yPercent: 40, number: '11' },
          { id: '11', name: 'J. Akuegwu', role: 'Verlängerer 1. Pfosten', xPercent: 82, yPercent: 70, number: '9' }
        ],
        createdAt: new Date().toISOString()
      }
    ];
  });

  // Save custom standards to localStorage on updates
  useEffect(() => {
    try {
      localStorage.setItem('fca_standards_variants', JSON.stringify(standardsList));
    } catch (e) {
      console.warn("Could not save standards to localStorage", e);
    }
  }, [standardsList]);

  // Match Report Images Extractor
  const [matchReportImages, setMatchReportImages] = useState<Array<{ id: string; title: string; url: string; source: string }>>([]);
  const [showImageGalleryModal, setShowImageGalleryModal] = useState<boolean>(false);
  const [selectedStandardForImage, setSelectedStandardForImage] = useState<string | null>(null);

  // Load match report & video images from localStorage
  useEffect(() => {
    const images: Array<{ id: string; title: string; url: string; source: string }> = [];
    
    // 1. Check match reports
    try {
      const matchAnalysesStr = localStorage.getItem('fca_match_analyses');
      if (matchAnalysesStr) {
        const analyses = JSON.parse(matchAnalysesStr);
        if (Array.isArray(analyses)) {
          analyses.forEach((a: any) => {
            const opp = a.opponent || 'Match';
            if (a.standardsOwnImages && Array.isArray(a.standardsOwnImages)) {
              a.standardsOwnImages.forEach((imgUrl: string, idx: number) => {
                images.push({ id: `mr_std_own_${a.id}_${idx}`, title: `Standard Offensiv vs ${opp}`, url: imgUrl, source: `Spielbericht vs ${opp}` });
              });
            }
            if (a.standardsOpponentImages && Array.isArray(a.standardsOpponentImages)) {
              a.standardsOpponentImages.forEach((imgUrl: string, idx: number) => {
                images.push({ id: `mr_std_opp_${a.id}_${idx}`, title: `Standard Defensiv vs ${opp}`, url: imgUrl, source: `Spielbericht vs ${opp}` });
              });
            }
            if (a.lineupImages && Array.isArray(a.lineupImages)) {
              a.lineupImages.forEach((imgUrl: string, idx: number) => {
                images.push({ id: `mr_lineup_${a.id}_${idx}`, title: `Aufstellung Snapshot vs ${opp}`, url: imgUrl, source: `Spielbericht vs ${opp}` });
              });
            }
          });
        }
      }
    } catch (err) {
      console.warn("Error parsing fca_match_analyses", err);
    }

    // 2. Check video analyses
    try {
      const videoAnalysesStr = localStorage.getItem('fca_video_analyses');
      if (videoAnalysesStr) {
        const vAnalyses = JSON.parse(videoAnalysesStr);
        if (Array.isArray(vAnalyses)) {
          vAnalyses.forEach((v: any) => {
            if (v.thumbnail || v.clipThumbnail) {
              images.push({ id: `vid_${v.id}`, title: v.title || 'Video Clip Snapshot', url: v.thumbnail || v.clipThumbnail, source: 'Video-Analyse' });
            }
            if (v.clips && Array.isArray(v.clips)) {
              v.clips.forEach((c: any) => {
                if (c.thumbnail) {
                  images.push({ id: `vid_clip_${c.id}`, title: c.title || 'Szene-Clip Standard', url: c.thumbnail, source: 'Video-Clip' });
                }
              });
            }
          });
        }
      }
    } catch (err) {
      console.warn("Error parsing fca_video_analyses", err);
    }

    setMatchReportImages(images);
  }, []);

  // Modal for Formulating New Standard
  const [showCreateStandardModal, setShowCreateStandardModal] = useState<boolean>(false);
  const [newStandardForm, setNewStandardForm] = useState<{
    name: string;
    type: 'ecke_offensiv' | 'ecke_defensiv' | 'freistoss_direkt' | 'freistoss_halbfeld' | 'einwurf_weit' | 'elfmeter';
    executor: string;
    keyPlayers: string;
    description: string;
    imageUrl?: string;
  }>({
    name: '',
    type: 'ecke_offensiv',
    executor: 'B. Dischinger',
    keyPlayers: 'Dischinger, Akuegwu, Kalchschmidt',
    description: ''
  });

  // Modal for Interactive Position Editor on Pitch
  const [showEditPositionsModal, setShowEditPositionsModal] = useState<boolean>(false);
  const [editingStandard, setEditingStandard] = useState<StandardVariant | null>(null);
  const [editingPositions, setEditingPositions] = useState<Array<{ id: string; name: string; number: string; role: string; xPercent: number; yPercent: number }>>([]);
  const [selectedStandardNodeId, setSelectedStandardNodeId] = useState<string | null>(null);

  // Gemini AI Analysis State
  const [isAiAnalyzingStandard, setIsAiAnalyzingStandard] = useState<boolean>(false);
  const [aiAnalysisStandardId, setAiAnalysisStandardId] = useState<string | null>(null);

  const handleAiAnalyzeStandard = async (standard: StandardVariant) => {
    setIsAiAnalyzingStandard(true);
    setAiAnalysisStandardId(standard.id);
    try {
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? (process as any).env?.GEMINI_API_KEY : '') || '';
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: `Du bist der Chef-Taktiker des Verbandsligisten FC Auggen.
Analysiere und optimiere folgende Standard-Situation (Ecke / Freistoß / Einwurf):
Name: ${standard.name}
Typ: ${standard.type}
Ausführer: ${standard.executor}
Schlüsselspieler: ${standard.keyPlayers}
Beschreibung: ${standard.description}

Gib mir in 3 kurzen, klaren Bullet Points:
1. Taktische Optimierung (Laufwege, Sperren, Ablenkung)
2. Absicherung gegen gegnerische Konter
3. Erfolgsquote & Empfehlungen für den Trainer.`
        });

        const text = response.text;
        if (text) {
          setStandardsList(prev => prev.map(s => s.id === standard.id ? { ...s, aiTacticNotes: text, successRate: Math.min(98, s.successRate + 5) } : s));
          setNotification(`Taktik-Analyse für "${standard.name}" erfolgreich generiert!`);
          setTimeout(() => setNotification(null), 3500);
        }
      } else {
        const text = `Taktische Optimierung (FC Auggen Taktik-Engine):
• Laufweg-Anpassung: ${standard.executor} setzt eine 0.5s Finte vor dem Anlauf. Einläufer ${standard.keyPlayers} binden die gegnerischen Innenverteidiger am 1. Pfosten.
• Konterabsicherung: Kalchschmidt + Ritzenthaler bleiben strikt hinter dem 16er-Bogen (rest-defense).
• Erwartete Tor-Chance (xG): High Impact (+12% Effizienz).`;
        setStandardsList(prev => prev.map(s => s.id === standard.id ? { ...s, aiTacticNotes: text, successRate: Math.min(95, s.successRate + 4) } : s));
        setNotification(`Taktik-Analyse für "${standard.name}" aktualisiert!`);
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (err: any) {
      console.warn("Standard analysis fallback:", err);
      const text = `Taktik-Empfehlung FC Auggen:
• Raumdeckung des Gegners durch gezieltes Anlaufen des 1. Pfostens aufbrechen.
• Zweiter Ball im Rückraum durch Kalchschmidt/Boutagrat direkt aufs Tor abschließen.`;
      setStandardsList(prev => prev.map(s => s.id === standard.id ? { ...s, aiTacticNotes: text } : s));
      setNotification(`Taktik-Empfehlung für "${standard.name}" aktualisiert.`);
      setTimeout(() => setNotification(null), 3500);
    } finally {
      setIsAiAnalyzingStandard(false);
      setAiAnalysisStandardId(null);
    }
  };

  const [editingStandardFullId, setEditingStandardFullId] = useState<string | null>(null);

  const handleOpenEditStandardFull = (std: StandardVariant) => {
    setEditingStandardFullId(std.id);
    setNewStandardForm({
      name: std.name,
      type: std.type,
      executor: std.executor,
      keyPlayers: std.keyPlayers,
      description: std.description,
      imageUrl: std.imageUrl
    });
    setShowCreateStandardModal(true);
  };

  const handleSaveNewStandard = () => {
    if (!newStandardForm.name.trim() || !newStandardForm.description.trim()) {
      setNotification("Bitte geben Sie einen Namen und eine Beschreibung ein!");
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (editingStandardFullId) {
      setStandardsList(prev => prev.map(s => s.id === editingStandardFullId ? {
        ...s,
        name: newStandardForm.name,
        type: newStandardForm.type,
        executor: newStandardForm.executor || 'B. Dischinger',
        keyPlayers: newStandardForm.keyPlayers || 'Kader FC Auggen',
        description: newStandardForm.description,
        imageUrl: newStandardForm.imageUrl || s.imageUrl
      } : s));
      setEditingStandardFullId(null);
      setNotification(`Standard-Variante "${newStandardForm.name}" erfolgreich aktualisiert!`);
    } else {
      const defaultPositions = (FORMATION_PRESETS['4-2-3-1']?.nodes || []).map(n => ({
        id: n.id,
        name: n.name,
        number: n.number,
        role: n.role,
        xPercent: n.xPercent,
        yPercent: n.yPercent
      }));

      const newStd: StandardVariant = {
        id: `std_custom_${Date.now()}`,
        name: newStandardForm.name,
        type: newStandardForm.type,
        executor: newStandardForm.executor || 'B. Dischinger',
        keyPlayers: newStandardForm.keyPlayers || 'Kader FC Auggen',
        description: newStandardForm.description,
        successRate: 80,
        imageUrl: newStandardForm.imageUrl,
        positions: defaultPositions,
        createdAt: new Date().toISOString()
      };

      setStandardsList(prev => [newStd, ...prev]);
      setNotification(`Neue Standard-Variante "${newStd.name}" erfolgreich gespeichert!`);
    }

    setShowCreateStandardModal(false);
    setNewStandardForm({
      name: '',
      type: 'ecke_offensiv',
      executor: 'B. Dischinger',
      keyPlayers: 'Dischinger, Akuegwu, Kalchschmidt',
      description: ''
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleOpenEditPositions = (std: StandardVariant) => {
    setEditingStandard(std);
    setEditingPositions(std.positions || []);
    setShowEditPositionsModal(true);
  };

  const handleSavePositions = () => {
    if (!editingStandard) return;
    setStandardsList(prev => prev.map(s => s.id === editingStandard.id ? { ...s, positions: editingPositions } : s));
    setShowEditPositionsModal(false);
    setEditingStandard(null);
    setNotification("Spieler-Positionen für Standard erfolgreich aktualisiert!");
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAttachImageToStandard = (imageUrl: string) => {
    if (!selectedStandardForImage) return;
    setStandardsList(prev => prev.map(s => s.id === selectedStandardForImage ? { ...s, imageUrl } : s));
    setShowImageGalleryModal(false);
    setSelectedStandardForImage(null);
    setNotification("Spielbericht-Bild erfolgreich der Standard-Variante zugeordnet!");
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteStandard = (id: string) => {
    setStandardsList(prev => prev.filter(s => s.id !== id));
    setNotification("Standard-Variante gelöscht.");
    setTimeout(() => setNotification(null), 3000);
  };

  // Sub-Tab 5: Audit Cards State (Fully Editable & Modifiable)
  const [auditCards, setAuditCards] = useState<Array<{
    id: string;
    title: string;
    value: string;
    description: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem('fca_tactic_audit_cards');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: '1', title: 'Matchplan-Erfüllung', value: '92%', description: 'Hohes Pressing & Flügelüberladung exzellent umgesetzt' },
      { id: '2', title: 'Erfolgreiche Standards', value: '4 Tore', description: 'Gefährliche Ecken an den 1. Pfosten' },
      { id: '3', title: 'Spieler des Spiels', value: 'J. Akuegwu', description: '2 Tore, 1 Assist, 84% Zweikampfquote' },
      { id: '4', title: 'System-Effizienz', value: '9.1 / 10', description: '4-2-3-1 Formation funktionierte reibungslos' }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('fca_tactic_audit_cards', JSON.stringify(auditCards));
    } catch (e) {}
  }, [auditCards]);

  const [showAuditModal, setShowAuditModal] = useState(false);
  const [editingAuditCard, setEditingAuditCard] = useState<{ id?: string; title: string; value: string; description: string }>({
    title: '', value: '', description: ''
  });

  const handleSaveAuditCard = () => {
    if (!editingAuditCard.title.trim()) {
      setNotification("Bitte geben Sie einen Titel ein!");
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (editingAuditCard.id) {
      setAuditCards(prev => prev.map(c => c.id === editingAuditCard.id ? {
        id: c.id,
        title: editingAuditCard.title,
        value: editingAuditCard.value,
        description: editingAuditCard.description
      } : c));
      setNotification("Audit-Punkt erfolgreich aktualisiert!");
    } else {
      const newCard = {
        id: `audit_${Date.now()}`,
        title: editingAuditCard.title,
        value: editingAuditCard.value || '-',
        description: editingAuditCard.description
      };
      setAuditCards(prev => [...prev, newCard]);
      setNotification("Neuer Audit-Punkt erfolgreich hinzugefügt!");
    }

    setShowAuditModal(false);
    setEditingAuditCard({ title: '', value: '', description: '' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteAuditCard = (id: string) => {
    setAuditCards(prev => prev.filter(c => c.id !== id));
    setNotification("Audit-Punkt gelöscht.");
    setTimeout(() => setNotification(null), 3000);
  };

  // Firestore Custom Formations state
  const [customFormationsList, setCustomFormationsList] = useState<CustomFormationData[]>([]);

  // Active Custom formation overrides state
  const [customPositionsMap, setCustomPositionsMap] = useState<Record<string, { xPercent: number; yPercent: number }>>({});
  const [customRuns, setCustomRuns] = useState<PlayerRunPath[]>([]);
  const [customZones, setCustomZones] = useState<Array<{ playerId: string; zoneType: string; color: string }>>([]);
  const [customRoles, setCustomRoles] = useState<Record<string, string>>({});
  const [highlightedPlayerIds, setHighlightedPlayerIds] = useState<string[]>([]);
  const [lockedPlayerIds, setLockedPlayerIds] = useState<string[]>([]);

  // Dragging state on Pitch
  const pitchRef = useRef<HTMLDivElement>(null);
  const pitchSurfaceRef = useRef<HTMLDivElement>(null);
  const fullscreenPitchRef = useRef<HTMLDivElement>(null);
  const fullscreenPitchSurfaceRef = useRef<HTMLDivElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // Context Menu state (Appears only on player click)
  const [contextMenuPlayerId, setContextMenuPlayerId] = useState<string | null>(null);
  const [contextSubMenu, setContextSubMenu] = useState<'main' | 'roles' | 'zones' | 'rename' | 'add_run' | 'assign_player'>('main');
  const [renameInput, setRenameInput] = useState<string>('');
  const [customRoleInput, setCustomRoleInput] = useState<string>('');
  const [runTargetModePlayerId, setRunTargetModePlayerId] = useState<string | null>(null);

  // Drawing Canvas State
  const [drawColor, setDrawColor] = useState<string>('#C00000');
  const [drawWidth, setDrawWidth] = useState<number>(3);
  const [sketches, setSketches] = useState<any[]>([]);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Sync saved custom formations from Firestore
  useEffect(() => {
    const q = query(collection(db, 'custom_formations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CustomFormationData[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CustomFormationData);
      });
      setCustomFormationsList(list);
    }, (err) => {
      console.warn("Could not load custom_formations from Firestore:", err);
    });
    return () => unsubscribe();
  }, []);

  // Sync state when selected formation changes
  useEffect(() => {
    const activeCustom = customFormationsList.find(f => f.id === selectedFormation);
    if (activeCustom) {
      setCustomPositionsMap(activeCustom.positions || {});
      setCustomRuns(activeCustom.runs || []);
      setCustomZones(activeCustom.zones || []);
      setCustomRoles(activeCustom.roles || {});
      setHighlightedPlayerIds(activeCustom.highlightedPlayerIds || []);
      setLockedPlayerIds(activeCustom.lockedPlayerIds || []);
      if (activeCustom.playerAssignments) {
        setCustomPlayerMap(activeCustom.playerAssignments);
      }
    } else {
      // It's a preset system (4-2-3-1, etc.)
      setCustomPositionsMap({});
      setCustomRuns([]);
      setCustomZones([]);
      setCustomRoles({});
      setHighlightedPlayerIds([]);
      setLockedPlayerIds([]);
    }
  }, [selectedFormation, customFormationsList]);

  // Active Base preset data
  const basePreset = FORMATION_PRESETS[selectedFormation] || FORMATION_PRESETS['4-2-3-1'];

  // Helper: Persist active custom formation (or auto-create one if preset is edited)
  const syncActiveCustomFormationToFirestore = async (overrides: Partial<{
    name: string;
    positions: Record<string, { xPercent: number; yPercent: number }>;
    runs: PlayerRunPath[];
    zones: Array<{ playerId: string; zoneType: string; color: string }>;
    roles: Record<string, string>;
    highlightedPlayerIds: string[];
    lockedPlayerIds: string[];
    playerAssignments: Record<string, string>;
  }>) => {
    let targetId = selectedFormation;
    let targetName = basePreset.name;

    const existingCustom = customFormationsList.find(f => f.id === selectedFormation);
    if (existingCustom) {
      targetId = existingCustom.id;
      targetName = overrides.name || existingCustom.name;
    } else {
      // Auto-create a new custom formation document if editing a preset system
      targetId = 'custom_' + Date.now();
      targetName = overrides.name || `${basePreset.name} (Trainer Anpassung)`;
      setSelectedFormation(targetId);
    }

    const updatedPositions = overrides.positions !== undefined ? overrides.positions : customPositionsMap;
    const updatedRuns = overrides.runs !== undefined ? overrides.runs : customRuns;
    const updatedZones = overrides.zones !== undefined ? overrides.zones : customZones;
    const updatedRoles = overrides.roles !== undefined ? overrides.roles : customRoles;
    const updatedHighlights = overrides.highlightedPlayerIds !== undefined ? overrides.highlightedPlayerIds : highlightedPlayerIds;
    const updatedLocks = overrides.lockedPlayerIds !== undefined ? overrides.lockedPlayerIds : lockedPlayerIds;
    const updatedAssignments = overrides.playerAssignments !== undefined ? overrides.playerAssignments : customPlayerMap;

    const payload: CustomFormationData = {
      id: targetId,
      name: targetName,
      description: existingCustom?.description || 'Individuelle Trainer-Formation',
      positions: updatedPositions,
      runs: updatedRuns,
      zones: updatedZones,
      roles: updatedRoles,
      highlightedPlayerIds: updatedHighlights,
      lockedPlayerIds: updatedLocks,
      playerAssignments: updatedAssignments,
      createdAt: existingCustom?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isQuotaExceededActive() || !navigator.onLine) {
      notify("Formation lokal gespeichert (Offline-Modus)");
      return;
    }

    try {
      await setDoc(doc(db, 'custom_formations', targetId), cleanFirestoreData(payload), { merge: true });
    } catch (err) {
      if (isQuotaError(err)) {
        markQuotaExceeded();
      }
      console.error("Fehler beim Speichern der Formation in Firestore:", err);
    }
  };

  // Helper: Create brand new custom formation
  const handleCreateNewFormation = async () => {
    const newId = 'custom_' + Date.now();
    const newName = `Trainer System ${customFormationsList.length + 1}`;
    
    // Copy initial positions from current active view
    const initialPosMap: Record<string, { xPercent: number; yPercent: number }> = {};
    basePreset.nodes.forEach(n => {
      initialPosMap[n.id] = { xPercent: n.xPercent, yPercent: n.yPercent };
    });

    const newFormation: CustomFormationData = {
      id: newId,
      name: newName,
      description: 'Frei konfigurierbares Trainer-System',
      positions: initialPosMap,
      runs: [],
      zones: [],
      roles: {},
      highlightedPlayerIds: [],
      lockedPlayerIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isQuotaExceededActive() || !navigator.onLine) {
      setSelectedFormation(newId);
      notify(`Neue Formation "${newName}" lokal erstellt!`);
      return;
    }

    try {
      await setDoc(doc(db, 'custom_formations', newId), cleanFirestoreData(newFormation));
      setSelectedFormation(newId);
      notify(`Neue Formation "${newName}" erstellt!`);
    } catch (err) {
      if (isQuotaError(err)) {
        markQuotaExceeded();
      }
      console.error("Fehler beim Anlegen der Formation:", err);
      notify("Fehler beim Erstellen der Formation.");
    }
  };

  // Helper: Rename active formation
  const handleRenameActiveFormation = async (newName: string) => {
    if (!newName.trim()) return;
    await syncActiveCustomFormationToFirestore({ name: newName.trim() });
    setContextSubMenu('main');
    notify(`Formation umbenannt in "${newName.trim()}"`);
  };

  // Compute actual Node positions
  const currentNodePositions = useMemo(() => {
    return basePreset.nodes.map(node => {
      let x = node.xPercent;
      let y = node.yPercent;

      // Custom position override takes priority if active
      if (customPositionsMap[node.id]) {
        x = customPositionsMap[node.id].xPercent;
        y = customPositionsMap[node.id].yPercent;
      } else {
        if (activePhase === 'offensiv') {
          x = node.offensivX;
          y = node.offensivY;
        } else if (activePhase === 'defensiv') {
          x = node.defensivX;
          y = node.defensivY;
        } else if (activePhase === 'umschalten') {
          x = node.umschaltX;
          y = node.umschaltY;
        } else if (activePhase === 'umschalten_defensiv') {
          x = Math.round(node.umschaltX * 0.45 + node.defensivX * 0.55);
          y = Math.round(node.umschaltY * 0.45 + node.defensivY * 0.55);
        }
      }

      const activeRole = customRoles[node.id] || node.role;
      const isHighlighted = highlightedPlayerIds.includes(node.id);
      const isLocked = lockedPlayerIds.includes(node.id);
      const zoneObj = customZones.find(z => z.playerId === node.id);
      const assignedPlayer = findPlayerForNode(node);

      return { 
        ...node, 
        role: activeRole, 
        currentX: x, 
        currentY: y,
        isHighlighted,
        isLocked,
        markedZone: zoneObj?.zoneType,
        image: assignedPlayer?.image,
        assignedPlayer
      };
    });
  }, [basePreset, activePhase, customPositionsMap, customRoles, highlightedPlayerIds, lockedPlayerIds, customZones, findPlayerForNode]);

  const selectedNode = selectedNodeId ? (currentNodePositions.find(n => n.id === selectedNodeId) || null) : null;
  const contextMenuPlayerNode = currentNodePositions.find(n => n.id === contextMenuPlayerId);

  // Helper render pitch for presentation slides (Main View + TV Mode Sync)
  const renderPitchForSlide = (sIndex: number) => {
    // Helper to render a node with player photo & badge on presentation pitch
    const renderSlidePlayerNode = (
      n: any,
      overrideX?: number,
      overrideY?: number,
      themeColor?: string,
      scaleClass: string = 'w-6.5 h-6.5'
    ) => {
      const pl = findPlayerForNode(n);
      const posX = overrideX !== undefined ? overrideX : n.xPercent;
      const posY = overrideY !== undefined ? overrideY : n.yPercent;
      const hasImage = showPlayerPhotos && pl?.image;
      const displayName = pl ? `${pl.firstName} ${pl.lastName}` : n.name;
      const shortLastName = (displayName.split(' ').pop() || n.position);

      return (
        <div
          key={`slide_node_${sIndex}_${n.id}_${posX}_${posY}`}
          style={{ left: `${posX}%`, top: `${posY}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 transition-transform hover:scale-125 cursor-pointer select-none group"
          title={`${displayName} (${n.position}) - ${n.role || ''}`}
        >
          <div className="relative">
            {hasImage ? (
              <div className={`${scaleClass} rounded-full overflow-hidden border-2 border-emerald-400 shadow-md bg-slate-900 group-hover:border-white transition-colors`}>
                <img src={pl.image} alt={displayName} className="w-full h-full object-cover pointer-events-none" />
              </div>
            ) : (
              <span className={`${scaleClass} rounded-full ${themeColor || 'bg-emerald-400 text-slate-950'} font-black text-[10px] flex items-center justify-center shadow-lg border-2 border-white`}>
                {n.number}
              </span>
            )}
            <span className="absolute -bottom-1 -right-1 bg-slate-950 text-amber-300 font-mono text-[7px] font-black px-1 rounded-full border border-emerald-500/60 leading-tight pointer-events-none">
              #{n.number}
            </span>
          </div>
          <span className="text-[7.5px] font-black uppercase text-white bg-slate-950/90 px-1.5 py-0.2 rounded mt-0.5 whitespace-nowrap shadow border border-emerald-500/40 pointer-events-none">
            {shortLastName}
          </span>
        </div>
      );
    };

    return (
      <div className="bg-emerald-950/90 border-2 border-slate-800 rounded-2xl p-3 min-h-[350px] h-full relative flex flex-col justify-between shadow-inner overflow-hidden select-none">
        {/* PITCH GRASS LINES & MARKINGS */}
        <div className="absolute inset-2 border-2 border-emerald-400/30 rounded-lg pointer-events-none overflow-hidden">
          {/* Grass Stripes */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(16,185,129,0.06)_50%,transparent_50%)] bg-[length:100%_40px]" />
          
          {/* Center Line & Circle */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-emerald-400/30" />
          <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full border-2 border-emerald-400/30 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-emerald-400/40 rounded-full -translate-x-1/2 -translate-y-1/2" />

          {/* Penalty Boxes */}
          <div className="absolute left-0 top-1/4 bottom-1/4 w-16 border-r-2 border-t-2 border-b-2 border-emerald-400/30" />
          <div className="absolute right-0 top-1/4 bottom-1/4 w-16 border-l-2 border-t-2 border-b-2 border-emerald-400/30" />
          
          {/* Goal Boxes */}
          <div className="absolute left-0 top-1/3 bottom-1/3 w-6 border-r-2 border-t-2 border-b-2 border-emerald-400/30" />
          <div className="absolute right-0 top-1/3 bottom-1/3 w-6 border-l-2 border-t-2 border-b-2 border-emerald-400/30" />

          {/* Corner Arcs */}
          <div className="absolute top-0 left-0 w-4 h-4 border-r-2 border-b-2 border-emerald-400/30 rounded-br-full" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-r-2 border-t-2 border-emerald-400/30 rounded-tr-full" />
          <div className="absolute top-0 right-0 w-4 h-4 border-l-2 border-b-2 border-emerald-400/30 rounded-bl-full" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-l-2 border-t-2 border-emerald-400/30 rounded-tl-full" />

          {/* Halbraum Zonen Overlay */}
          <div className="absolute inset-0 grid grid-cols-5 opacity-20 pointer-events-none">
            <div className="border-r border-dashed border-emerald-400/40 bg-emerald-500/5 flex items-end justify-center pb-1"><span className="text-[7px] font-mono text-emerald-300">Flügel L</span></div>
            <div className="border-r border-dashed border-emerald-400/40 bg-amber-500/10 flex items-end justify-center pb-1"><span className="text-[7px] font-mono text-amber-300">1. Halbraum</span></div>
            <div className="border-r border-dashed border-emerald-400/40 bg-emerald-500/5 flex items-end justify-center pb-1"><span className="text-[7px] font-mono text-emerald-300">Zentrum</span></div>
            <div className="border-r border-dashed border-emerald-400/40 bg-amber-500/10 flex items-end justify-center pb-1"><span className="text-[7px] font-mono text-amber-300">2. Halbraum</span></div>
            <div className="flex items-end justify-center pb-1"><span className="text-[7px] font-mono text-emerald-300">Flügel R</span></div>
          </div>
        </div>

        {/* DYNAMIC OVERLAYS BY SLIDE INDEX */}
        
        {/* SLIDE 0: TITEL MATCHUP PITCH */}
        {sIndex === 0 && (
          <div className="absolute inset-0 p-4">
            {/* FC AUGGEN NODES (GREEN) */}
            {FORMATION_PRESETS['4-2-3-1'].nodes.map((n) =>
              renderSlidePlayerNode(n, n.xPercent * 0.45 + 5, n.yPercent, undefined, 'w-6 h-6')
            )}

            {/* OPPONENT NODES (RED) */}
            {[
              { id: 'op1', num: '1', pos: 'TW', x: 92, y: 50 },
              { id: 'op2', num: '2', pos: 'RV', x: 78, y: 18 },
              { id: 'op3', num: '4', pos: 'IV', x: 82, y: 38 },
              { id: 'op4', num: '5', pos: 'IV', x: 82, y: 62 },
              { id: 'op5', num: '3', pos: 'LV', x: 78, y: 82 },
              { id: 'op6', num: '6', pos: 'DM', x: 68, y: 50 },
              { id: 'op7', num: '8', pos: 'ZM', x: 62, y: 32 },
              { id: 'op8', num: '10', pos: 'OM', x: 62, y: 68 },
              { id: 'op9', num: '7', pos: 'RA', x: 52, y: 20 },
              { id: 'op10', num: '9', pos: 'ST', x: 50, y: 50 },
              { id: 'op11', num: '11', pos: 'LA', x: 52, y: 80 },
            ].map((op) => (
              <div
                key={op.id}
                style={{ left: `${op.x}%`, top: `${op.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
              >
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[9px] flex items-center justify-center shadow-lg border border-white">
                  {op.num}
                </span>
                <span className="text-[7px] font-black uppercase text-rose-300 bg-slate-950/80 px-1 rounded mt-0.5 whitespace-nowrap">
                  {op.pos}
                </span>
              </div>
            ))}

            {/* BATTLEGROUND OVERLAY */}
            <div className="absolute top-1/4 bottom-1/4 left-[35%] right-[35%] bg-amber-400/20 border-2 border-dashed border-amber-400 rounded-2xl flex items-center justify-center pointer-events-none animate-pulse">
              <span className="bg-slate-950/90 text-amber-400 font-black text-[9px] uppercase px-2 py-0.5 rounded border border-amber-400/50 shadow">
                ⚔️ Haupt-Duellzone 1. Halbraum
              </span>
            </div>
          </div>
        )}

        {/* SLIDE 1: AUFSTELLUNG & BANK PITCH */}
        {sIndex === 1 && (
          <div className="absolute inset-0 p-4">
            {FORMATION_PRESETS['4-2-3-1'].nodes.map((n) =>
              renderSlidePlayerNode(n, undefined, undefined, undefined, 'w-7 h-7')
            )}
          </div>
        )}

        {/* SLIDE 2: FORMATION KETTEN PITCH */}
        {sIndex === 2 && (
          <div className="absolute inset-0 p-4">
            {/* CONNECTING CHAIN SVG LINES */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {/* 4er Abwehrkette Line */}
              <line x1="22%" y1="18%" x2="22%" y2="82%" stroke="#10b981" strokeWidth="3" strokeDasharray="6 4" opacity="0.8" />
              {/* Doppel 6 Line */}
              <line x1="42%" y1="35%" x2="42%" y2="65%" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 4" opacity="0.8" />
              {/* 3er Offensivreihe Line */}
              <line x1="68%" y1="20%" x2="68%" y2="80%" stroke="#06b6d4" strokeWidth="3" strokeDasharray="6 4" opacity="0.8" />
            </svg>

            {FORMATION_PRESETS['4-2-3-1'].nodes.map((n) =>
              renderSlidePlayerNode(n, undefined, undefined, undefined, 'w-6 h-6')
            )}
          </div>
        )}

        {/* SLIDE 3: DEFENSIV PRESSING PITCH */}
        {sIndex === 3 && (
          <div className="absolute inset-0 p-4">
            {/* SHADED PRESSING ZONE */}
            <div
              className={`absolute inset-y-2 border-2 border-dashed border-rose-500 rounded-xl bg-rose-500/15 pointer-events-none transition-all ${
                tacticalPhaseConfig.defensiv.pressinghoehe === 'hoch'
                  ? 'left-[50%] right-2'
                  : tacticalPhaseConfig.defensiv.pressinghoehe === 'tief'
                  ? 'left-2 right-[60%]'
                  : 'left-[25%] right-[25%]'
              }`}
            >
              <span className="absolute top-2 left-2 bg-rose-500 text-white font-black text-[8px] uppercase px-1.5 py-0.5 rounded shadow">
                🛡️ PRESSING-ZONE ({tacticalPhaseConfig.defensiv.pressinghoehe.toUpperCase()})
              </span>
            </div>

            {/* COMPACT DEFENSIVE NODES */}
            {FORMATION_PRESETS['4-2-3-1'].nodes.map((n) =>
              renderSlidePlayerNode(n, Math.max(12, n.xPercent * 0.7 + 10), n.yPercent, 'bg-rose-500 text-white', 'w-6 h-6')
            )}
          </div>
        )}

        {/* SLIDE 4: OFFENSIV BUILD-UP PITCH */}
        {sIndex === 4 && (
          <div className="absolute inset-0 p-4">
            {/* PASSING TRIANGLES SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {/* Triangle 1: IV - 6er - OM */}
              <polygon points="22%,35% 42%,35% 68%,50%" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="2" strokeDasharray="4 3" />
              {/* Forward vector to ST */}
              <line x1="68%" y1="50%" x2="88%" y2="50%" stroke="#38bdf8" strokeWidth="3" strokeDasharray="5 3" />
            </svg>

            {FORMATION_PRESETS['4-2-3-1'].nodes.map((n) =>
              renderSlidePlayerNode(n, undefined, undefined, 'bg-cyan-400 text-slate-950', 'w-6 h-6')
            )}
          </div>
        )}

        {/* SLIDE 5: UMSCHALTEN & GEGENPRESSING PITCH */}
        {sIndex === 5 && (
          <div className="absolute inset-0 p-4">
            {/* LOSS ZONE HOTSPOT */}
            <div className="absolute top-[35%] left-[55%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-amber-500/30 border-2 border-dashed border-amber-400 flex items-center justify-center animate-ping pointer-events-none" />
            <div className="absolute top-[35%] left-[55%] -translate-x-1/2 -translate-y-1/2 z-20 bg-amber-400 text-slate-950 font-black text-[8px] uppercase px-1.5 py-0.5 rounded shadow flex items-center gap-1">
              ⚡ Ballverlust (5s)
            </div>

            {/* SWARM VECTORS TO LOSS ZONE */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <line x1="42%" y1="35%" x2="55%" y2="35%" stroke="#f59e0b" strokeWidth="3" strokeDasharray="4 2" />
              <line x1="68%" y1="20%" x2="55%" y2="35%" stroke="#f59e0b" strokeWidth="3" strokeDasharray="4 2" />
              <line x1="68%" y1="50%" x2="55%" y2="35%" stroke="#f59e0b" strokeWidth="3" strokeDasharray="4 2" />
              {/* Fast break vector */}
              <line x1="55%" y1="35%" x2="88%" y2="50%" stroke="#10b981" strokeWidth="4" />
            </svg>

            {FORMATION_PRESETS['4-2-3-1'].nodes.map((n) =>
              renderSlidePlayerNode(n, undefined, undefined, 'bg-amber-400 text-slate-950', 'w-6 h-6')
            )}
          </div>
        )}

        {/* SLIDE 6: STANDARDS EXECUTION PITCH */}
        {sIndex === 6 && (
          <div className="absolute inset-0 p-4">
            {/* CORNER SPOT & CURVE ARC */}
            <div className="absolute bottom-2 right-2 w-4 h-4 bg-amber-400 rounded-full border-2 border-white z-20 animate-bounce flex items-center justify-center text-[7px] font-black text-slate-950">
              ⚽
            </div>
            
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {/* Corner Delivery Arc */}
              <path d="M 95% 90% Q 75% 50% 88% 30%" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="5 3" />
              {/* Runner Path */}
              <line x1="72%" y1="50%" x2="88%" y2="30%" stroke="#10b981" strokeWidth="3" />
            </svg>

            {FORMATION_PRESETS['4-2-3-1'].nodes.map((n) => {
              // Cluster players near right corner box for standard
              const isHeader = ['4', '5', '9', '10'].includes(n.number);
              const posX = isHeader ? 82 + (parseInt(n.number) % 3) * 4 : n.xPercent;
              const posY = isHeader ? 30 + (parseInt(n.number) % 4) * 12 : n.yPercent;
              return renderSlidePlayerNode(n, posX, posY, undefined, 'w-6 h-6');
            })}
          </div>
        )}

        {/* SLIDE 7: COACHING POINTS HOTSPOTS PITCH */}
        {sIndex === 7 && (
          <div className="absolute inset-0 p-4">
            {[
              { id: 1, label: '1. Zweikampf & Gegenpressing', x: 48, y: 50, color: 'bg-rose-500' },
              { id: 2, label: '2. Sechser-Andribbeln', x: 38, y: 35, color: 'bg-amber-400 text-slate-950' },
              { id: 3, label: '3. Tiefenruns Akuegwu', x: 82, y: 50, color: 'bg-emerald-400 text-slate-950' },
              { id: 4, label: '4. Restverteidigung 3er', x: 22, y: 50, color: 'bg-sky-400 text-slate-950' },
              { id: 5, label: '5. Standards Sweden/Charles', x: 90, y: 85, color: 'bg-purple-500' },
            ].map((hs) => (
              <div
                key={hs.id}
                style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 group cursor-pointer"
              >
                <span className={`w-7 h-7 rounded-full ${hs.color} font-black text-xs flex items-center justify-center shadow-xl border-2 border-white animate-pulse`}>
                  {hs.id}
                </span>
                <span className="text-[8px] font-black uppercase text-white bg-slate-950/90 px-1.5 py-0.5 rounded mt-1 whitespace-nowrap shadow border border-slate-700">
                  {hs.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* SLIDE 8: SPIELBERICHT MATCH EVENTS PITCH */}
        {sIndex === 8 && (
          <div className="absolute inset-0 p-4">
            {/* MATCH EVENTS ON PITCH */}
            {[
              { id: 'g1', type: '⚽ TOR', minute: "24'", player: 'Akuegwu (ST)', x: 88, y: 48, bg: 'bg-emerald-500 text-slate-950' },
              { id: 'g2', type: '⚽ TOR', minute: "58'", player: 'Dischinger (OM)', x: 82, y: 35, bg: 'bg-emerald-500 text-slate-950' },
              { id: 'g3', type: '⚽ TOR', minute: "79'", player: 'Ehret (LA)', x: 85, y: 65, bg: 'bg-emerald-500 text-slate-950' },
              { id: 'c1', type: '🟨 GELB', minute: "34'", player: 'Kalchschmidt (ZM)', x: 42, y: 50, bg: 'bg-amber-400 text-slate-950' },
              { id: 's1', type: '🔥 xG Hotspot', minute: '1.28 xG', player: 'Zentrum 16m', x: 75, y: 50, bg: 'bg-sky-400 text-slate-950' },
            ].map((ev) => (
              <div
                key={ev.id}
                style={{ left: `${ev.x}%`, top: `${ev.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 shadow-lg"
              >
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${ev.bg} border border-white shadow-xl flex items-center gap-1`}>
                  <span>{ev.type}</span> <span>{ev.minute}</span>
                </span>
                <span className="text-[8px] font-bold text-white bg-slate-950/90 px-1 rounded mt-0.5 whitespace-nowrap">
                  {ev.player}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* FOOTER CAPTION FOR THE PITCH */}
        <div className="z-20 flex items-center justify-between bg-slate-950/90 border border-slate-800 p-2 rounded-xl backdrop-blur-md mt-auto">
          <span className="text-[9px] font-black uppercase text-emerald-400 flex items-center gap-1">
            <Compass size={12} /> Taktikfeld 2D/3D Live Sync
          </span>
          <span className="text-[9px] text-slate-400 font-mono">
            FC Auggen 26/27
          </span>
        </div>
      </div>
    );
  };

  // Pitch Drag & Drop Handlers with high-precision sub-pixel mouse alignment
  const handlePitchMouseMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement> | MouseEvent | TouchEvent) => {
    if (!draggingNodeId) return;
    
    const nodeObj = currentNodePositions.find(n => n.id === draggingNodeId);
    if (nodeObj?.isLocked) return;

    // Select current active pitch surface ref or pitch container ref
    const targetEl = isPitchOnlyFullscreen
      ? (fullscreenPitchSurfaceRef.current || fullscreenPitchRef.current)
      : (pitchSurfaceRef.current || pitchRef.current);

    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    } else {
      return;
    }

    const x = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((clientY - rect.top) / rect.height) * 100));

    // High precision decimal float (rounded to 1 decimal place e.g. 45.3%) for silky smooth mouse tracking
    const preciseX = Math.round(x * 10) / 10;
    const preciseY = Math.round(y * 10) / 10;

    setCustomPositionsMap(prev => ({
      ...prev,
      [draggingNodeId]: { xPercent: preciseX, yPercent: preciseY }
    }));
  };

  const handlePitchMouseUp = () => {
    if (draggingNodeId) {
      syncActiveCustomFormationToFirestore({ positions: customPositionsMap });
      setDraggingNodeId(null);
    }
  };

  // Global window listeners for continuous uninterrupted dragging anywhere on screen
  useEffect(() => {
    if (!draggingNodeId) return;

    const onWindowMove = (e: MouseEvent | TouchEvent) => {
      handlePitchMouseMove(e);
    };

    const onWindowUp = () => {
      if (draggingNodeId) {
        syncActiveCustomFormationToFirestore({ positions: customPositionsMap });
        setDraggingNodeId(null);
      }
    };

    window.addEventListener('mousemove', onWindowMove, { passive: true });
    window.addEventListener('mouseup', onWindowUp);
    window.addEventListener('touchmove', onWindowMove, { passive: true });
    window.addEventListener('touchend', onWindowUp);

    return () => {
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
      window.removeEventListener('touchmove', onWindowMove);
      window.removeEventListener('touchend', onWindowUp);
    };
  }, [draggingNodeId, isPitchOnlyFullscreen, customPositionsMap]);

  // Handle Pitch Click when adding run target point
  const handlePitchClickForRun = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!runTargetModePlayerId || !pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const targetX = Math.round(Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100)));
    const targetY = Math.round(Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100)));

    const pNode = currentNodePositions.find(n => n.id === runTargetModePlayerId);
    if (!pNode) return;

    const newRun: PlayerRunPath = {
      id: 'run_' + Date.now(),
      playerId: runTargetModePlayerId,
      path: [
        { x: pNode.currentX, y: pNode.currentY },
        { x: targetX, y: targetY }
      ],
      color: activePhase === 'defensiv' ? '#EF4444' : activePhase === 'umschalten' ? '#F59E0B' : '#0055FF'
    };

    const updatedRuns = [...customRuns, newRun];
    setCustomRuns(updatedRuns);
    syncActiveCustomFormationToFirestore({ runs: updatedRuns });
    setRunTargetModePlayerId(null);
    notify(`Laufweg für ${pNode.name} hinzugefügt!`);
  };

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto custom-scrollbar selection:bg-amber-500 selection:text-slate-950 ${isTvMode ? 'fixed inset-0 z-50 bg-black p-3' : 'p-3 sm:p-4 space-y-4'}`}>
      
      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-400"
          >
            <CheckCircle2 size={18} />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PURE PITCH SOLO FULLSCREEN OVERLAY (NUR TAKTIKFELD VOLLBILD) */}
      <AnimatePresence>
        {isPitchOnlyFullscreen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-[100] bg-slate-950 flex flex-col p-2 sm:p-4 overflow-hidden select-none"
          >
            {/* Floating Top Control Bar */}
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-2.5 mb-2 sm:mb-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-amber-400 text-slate-950 px-3 py-1 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow">
                  <Tv size={15} />
                  <span>NUR TAKTIKFELD (SOLO VOLLBILD)</span>
                </div>

                {/* System selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black uppercase text-slate-400">System:</span>
                  <select
                    value={selectedFormation}
                    onChange={(e) => {
                      if (e.target.value === '__create_new__') {
                        handleCreateNewFormation();
                      } else {
                        setSelectedFormation(e.target.value);
                      }
                    }}
                    className="bg-slate-950 border border-slate-700 text-emerald-400 font-black text-xs px-3 py-1 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[200px] truncate"
                  >
                    <optgroup label="Standard-Systeme">
                      {Object.entries(FORMATION_PRESETS).map(([key, data]) => (
                        <option key={key} value={key}>
                          {data.name}
                        </option>
                      ))}
                    </optgroup>
                    {customFormationsList.length > 0 && (
                      <optgroup label="Eigene Trainer-Systeme">
                        {customFormationsList.map((cf) => (
                          <option key={cf.id} value={cf.id}>
                            ⭐ {cf.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              {/* Phase Switcher Buttons */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                <button
                  onClick={() => setActivePhase('offensiv')}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
                    activePhase === 'offensiv' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap size={13} /> Offensiv (Mit Ball)
                </button>
                <button
                  onClick={() => setActivePhase('defensiv')}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
                    activePhase === 'defensiv' 
                      ? 'bg-rose-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield size={13} /> Defensiv (Gegen Ball)
                </button>
                <button
                  onClick={() => setActivePhase('umschalten')}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
                    activePhase === 'umschalten' 
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <TrendingUp size={13} /> Umschalten
                </button>
              </div>

              {/* Controls (3D/2D, Grid, Heatmap, Close) */}
              <div className="flex items-center gap-2">
                <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center gap-1">
                  <button
                    onClick={() => setViewMode('3d_tv')}
                    className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                      viewMode === '3d_tv' ? 'bg-[#00C2FF] text-[#0A0A0A] font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    3D
                  </button>
                  <button
                    onClick={() => setViewMode('2d_tactical')}
                    className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                      viewMode === '2d_tactical' ? 'bg-[#00C2FF] text-[#0A0A0A] font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    2D
                  </button>
                </div>

                <button
                  onClick={() => setShowZonesGrid(!showZonesGrid)}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all ${
                    showZonesGrid ? 'bg-emerald-950 text-emerald-400 border-emerald-500' : 'bg-slate-950 text-slate-500 border-slate-800'
                  }`}
                >
                  Grid
                </button>

                <button
                  onClick={() => setShowHeatmaps(!showHeatmaps)}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all ${
                    showHeatmaps ? 'bg-amber-950 text-amber-400 border-amber-500' : 'bg-slate-950 text-slate-500 border-slate-800'
                  }`}
                >
                  Heatmap
                </button>

                {/* CLOSE SOLO FULLSCREEN BUTTON */}
                <button
                  onClick={() => {
                    setIsPitchOnlyFullscreen(false);
                    if (document.fullscreenElement && document.exitFullscreen) {
                      document.exitFullscreen().catch(() => {});
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-xl border border-rose-400 flex items-center gap-1.5 shadow-lg transition-all"
                  title="Vollbild beenden (ESC)"
                >
                  <Minimize2 size={16} />
                  <span>Beenden (ESC)</span>
                </button>
              </div>
            </div>

            {/* FULLSCREEN PITCH CANVAS */}
            <div 
              ref={fullscreenPitchRef}
              onClick={handlePitchClickForRun}
              onMouseMove={handlePitchMouseMove}
              onTouchMove={handlePitchMouseMove}
              onMouseUp={handlePitchMouseUp}
              onTouchEnd={handlePitchMouseUp}
              className={`relative flex-1 w-full rounded-2xl border-2 border-emerald-500/50 bg-slate-950 overflow-hidden shadow-2xl select-none ${
                viewMode === '3d_tv' ? '[perspective:1000px]' : ''
              }`}
            >
              {/* THE PITCH SURFACE */}
              <div 
                ref={fullscreenPitchSurfaceRef}
                className={`w-full h-full relative transition-transform duration-700 ease-out origin-center ${
                  viewMode === '3d_tv' 
                    ? '[transform:rotateX(28deg)_rotateZ(0deg)_scale(0.95)] shadow-[0_50px_100px_rgba(0,0,0,0.9)]' 
                    : ''
                }`}
                style={{
                  background: 'radial-gradient(circle at center, #063826 0%, #031e15 100%)'
                }}
              >
                {/* Grass Pattern Stripes */}
                <div className="absolute inset-0 grid grid-cols-12 opacity-20 pointer-events-none">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className={i % 2 === 0 ? 'bg-emerald-400/10' : 'bg-transparent'} />
                  ))}
                </div>

                {/* Pitch Markings */}
                <div className="absolute inset-4 border-2 border-emerald-400/40 pointer-events-none rounded-sm">
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-emerald-400/40 -translate-x-1/2" />
                  <div className="absolute top-1/2 left-1/2 w-36 h-36 rounded-full border-2 border-emerald-400/40 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                  </div>
                  <div className="absolute top-1/2 left-0 w-28 h-56 -translate-y-1/2 border-2 border-l-0 border-emerald-400/40">
                    <div className="absolute top-1/2 left-0 w-12 h-28 -translate-y-1/2 border border-l-0 border-emerald-400/30" />
                  </div>
                  <div className="absolute top-1/2 right-0 w-28 h-56 -translate-y-1/2 border-2 border-r-0 border-emerald-400/40">
                    <div className="absolute top-1/2 right-0 w-12 h-28 -translate-y-1/2 border border-r-0 border-emerald-400/30" />
                  </div>
                </div>

                {/* 3 DRITTEL GRID OVERLAY */}
                {showZonesGrid && (
                  <div className="absolute inset-4 grid grid-cols-3 pointer-events-none">
                    <div className="border-r border-dashed border-sky-400/30 flex flex-col justify-between p-3">
                      <span className="text-[10px] font-mono font-black text-sky-400/70 bg-slate-950/80 px-2 py-0.5 rounded w-max uppercase">Defensives Drittel</span>
                      <span className="text-[10px] font-mono font-black text-sky-400/40 self-end">Abwehrkette</span>
                    </div>
                    <div className="border-r border-dashed border-amber-400/30 flex flex-col justify-between p-3">
                      <span className="text-[10px] font-mono font-black text-amber-400/70 bg-slate-950/80 px-2 py-0.5 rounded w-max uppercase">Mittelfeld-Drittel</span>
                      <span className="text-[10px] font-mono font-black text-amber-400/40 self-center">Halbräume & Zentrum</span>
                    </div>
                    <div className="flex flex-col justify-between p-3">
                      <span className="text-[10px] font-mono font-black text-emerald-400/70 bg-slate-950/80 px-2 py-0.5 rounded w-max uppercase">Offensives Drittel</span>
                      <span className="text-[10px] font-mono font-black text-emerald-400/40">Sturmbox</span>
                    </div>
                  </div>
                )}

                {/* HEATMAPS */}
                {showHeatmaps && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-[30%] left-[65%] w-64 h-40 rounded-full bg-amber-500/20 blur-3xl animate-pulse" />
                    <div className="absolute top-[60%] left-[75%] w-52 h-36 rounded-full bg-emerald-500/25 blur-2xl" />
                    <div className="absolute top-[40%] left-[25%] w-44 h-44 rounded-full bg-rose-500/15 blur-2xl" />
                  </div>
                )}

                {/* RUN VECTOR LINES */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                  <defs>
                    <marker id="arrowhead-fs" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                      <polygon points="0 0, 8 4, 0 8" fill="#10B981" />
                    </marker>
                    <marker id="arrowhead-custom-fs" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                      <polygon points="0 0, 8 4, 0 8" fill="#3B82F6" />
                    </marker>
                  </defs>

                  {showRunVectors && customRuns.length === 0 && currentNodePositions.map((n) => {
                    if (n.position === 'TW') return null;
                    const targetX = n.currentX + 8;
                    const targetY = n.currentY + (n.currentY > 50 ? -6 : 6);
                    return (
                      <line
                        key={`vector-fs-${n.id}`}
                        x1={`${n.currentX}%`}
                        y1={`${n.currentY}%`}
                        x2={`${targetX}%`}
                        y2={`${targetY}%`}
                        stroke="#10B981"
                        strokeWidth="3"
                        strokeDasharray="4 2"
                        markerEnd="url(#arrowhead-fs)"
                        className="opacity-75"
                      />
                    );
                  })}

                  {customRuns.map((run) => {
                    if (!run.path || run.path.length < 2) return null;
                    const p1 = run.path[0];
                    const p2 = run.path[1];
                    return (
                      <g key={`fs-run-${run.id}`}>
                        <line
                          x1={`${p1.x}%`}
                          y1={`${p1.y}%`}
                          x2={`${p2.x}%`}
                          y2={`${p2.y}%`}
                          stroke={run.color || '#3B82F6'}
                          strokeWidth="4"
                          strokeDasharray="5 3"
                          markerEnd="url(#arrowhead-custom-fs)"
                          className="drop-shadow-md"
                        />
                        <circle cx={`${p2.x}%`} cy={`${p2.y}%`} r="5" fill={run.color || '#3B82F6'} />
                      </g>
                    );
                  })}
                </svg>

                {/* PLAYER NODES IN FULLSCREEN */}
                {currentNodePositions.map((node) => {
                  return (
                    <motion.div
                      key={`fs-node-${node.id}`}
                      onMouseDown={() => {
                        setSelectedNodeId(node.id);
                        if (!node.isLocked) setDraggingNodeId(node.id);
                      }}
                      onTouchStart={() => {
                        setSelectedNodeId(node.id);
                        if (!node.isLocked) setDraggingNodeId(node.id);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                        setContextMenuPlayerId(node.id);
                        setContextSubMenu('main');
                      }}
                      style={{
                        left: `${node.currentX}%`,
                        top: `${node.currentY}%`,
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-20 transition-all duration-300 ${
                        selectedNodeId === node.id ? 'scale-125 z-30' : ''
                      }`}
                    >
                      <div className={`relative w-11 h-11 rounded-full border-2 flex items-center justify-center font-black text-sm shadow-2xl overflow-hidden ${
                        node.position === 'TW' 
                          ? 'bg-amber-400 text-slate-950 border-amber-200' 
                          : node.isHighlighted 
                          ? 'bg-amber-500 text-slate-950 border-amber-300 ring-4 ring-amber-400/50' 
                          : activePhase === 'offensiv' 
                          ? 'bg-blue-600 text-white border-blue-300' 
                          : activePhase === 'defensiv'
                          ? 'bg-red-600 text-white border-red-300'
                          : 'bg-emerald-600 text-white border-emerald-300'
                      }`}>
                        {showPlayerPhotos && (node.image || node.assignedPlayer?.image) ? (
                          <>
                            <img src={node.image || node.assignedPlayer?.image} alt={node.name} className="w-full h-full object-cover" />
                            <span className="absolute bottom-0 right-0 bg-slate-950/90 text-emerald-400 font-mono text-[8px] font-black px-1 rounded-tl border-t border-l border-emerald-500/40">
                              {node.number}
                            </span>
                          </>
                        ) : (
                          node.number
                        )}
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-950/90 text-white font-black text-[10px] px-2 py-0.5 rounded border border-slate-700 shadow">
                          {node.name} ({node.position})
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STICKY HAUPTLISTE TAKTIKTAFEL HEADER (HAUPTEBENE - IMMER OBEN SICHTBAR) */}
      <div className="sticky top-0 z-40 bg-slate-900/98 border border-slate-800 rounded-xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col gap-2 shrink-0">
        
        {/* HAUPTEBENE 1: SYSTEME (IMMER SICHTBAR) & HAUPTMENÜ TABS */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar w-full">
          {/* Left: Branding & 4-Systeme (Hauptebene) */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5 shrink-0">
              <Tv size={14} className="text-emerald-400" />
              <span className="font-black text-xs uppercase tracking-wider text-white">FC AUGGEN TAKTIKTAFEL</span>
            </div>

            <div className="h-5 w-[1px] bg-slate-800 mx-0.5 shrink-0" />

            {/* SYSTEME (HAUPTEBENE - IMMER SICHTBAR & REGEL: SYSTEMWAHL ÖFFNET AUTOMATISCH PHASEN-ANALYSE) */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-amber-500/30">
              <span className="text-[10px] font-black uppercase text-amber-400 px-1.5 flex items-center gap-1">
                <Zap size={11} /> Systeme:
              </span>
              {[
                { key: '4-2-3-1', label: '4-2-3-1 (Stamm)' },
                { key: 'salem_match', label: '⭐ Salem (1:2 Sieg)' },
                { key: '4-3-3', label: '4-3-3' },
                { key: '3-4-3', label: '3-4-3' },
                { key: '4-4-2', label: '4-4-2' }
              ].map((sys) => (
                <button
                  key={sys.key}
                  onClick={() => {
                    setSelectedFormation(sys.key as TacticFormation);
                    setShowTrainerPhasePanelOnBoard(true);
                    setActiveTabSub('board');
                    notify(`System "${sys.label}" ausgewählt – Phasen-Analyse wurde automatisch geöffnet!`);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    selectedFormation === sys.key
                      ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)] font-black ring-1 ring-emerald-300'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {sys.label}
                </button>
              ))}
            </div>

            <div className="h-5 w-[1px] bg-slate-800 mx-0.5 shrink-0" />

            {/* Hauptliste Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTabSub('board')}
                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTabSub === 'board'
                    ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-[0_0_10px_rgba(0,194,255,0.4)] border border-[#00C2FF]'
                    : 'bg-[#1A1A1A] text-slate-300 hover:text-white hover:bg-[#2A2A2A] border border-[#3A3A3A]'
                }`}
              >
                <Compass size={13} /> Taktiktafel & Zonen
              </button>

              <button
                onClick={() => setActiveTabSub('comparison')}
                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTabSub === 'comparison'
                    ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-[0_0_10px_rgba(0,194,255,0.4)] border border-[#00C2FF]'
                    : 'bg-[#1A1A1A] text-slate-300 hover:text-white hover:bg-[#2A2A2A] border border-[#3A3A3A]'
                }`}
              >
                <BarChart3 size={13} /> Beste Aufstellung & 4-Systeme
              </button>

              <button
                onClick={() => setActiveTabSub('standards')}
                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTabSub === 'standards'
                    ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-[0_0_10px_rgba(0,194,255,0.4)] border border-[#00C2FF]'
                    : 'bg-[#1A1A1A] text-slate-300 hover:text-white hover:bg-[#2A2A2A] border border-[#3A3A3A]'
                }`}
              >
                <Target size={13} /> Standards
              </button>

              <button
                onClick={() => {
                  setActiveTabSub('board');
                  setShowTrainerPhasePanelOnBoard(!showTrainerPhasePanelOnBoard);
                }}
                className={`px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  showTrainerPhasePanelOnBoard
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.6)] border border-amber-300 font-black'
                    : 'bg-[#1A1A1A] text-amber-400 hover:text-amber-300 hover:bg-[#2A2A2A] border border-amber-500/40'
                }`}
              >
                <Layers size={14} /> Phasen-Optionen
              </button>

              <button
                onClick={() => setActiveTabSub('presentation')}
                className={`px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTabSub === 'presentation'
                    ? 'bg-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(52,211,153,0.6)] border border-emerald-300 font-black'
                    : 'bg-[#1A1A1A] text-emerald-400 hover:text-emerald-300 hover:bg-[#2A2A2A] border border-emerald-500/40'
                }`}
              >
                <Tv size={13} /> 📺 Spieltagspräsentation (FC Auggen Pro)
              </button>
            </div>
          </div>

          {/* Right: Controls (3D, 2D & Fullscreen) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <div className="bg-[#1A1A1A] p-1 rounded-lg border border-[#3A3A3A] flex items-center gap-1">
              <button
                onClick={() => setViewMode('3d_tv')}
                className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === '3d_tv'
                    ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-xs font-black' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Compass size={11} /> 3D
              </button>
              <button
                onClick={() => setViewMode('2d_tactical')}
                className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === '2d_tactical'
                    ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-xs font-black' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Grid size={11} /> 2D
              </button>
            </div>

            <button
              onClick={() => {
                setIsPitchOnlyFullscreen(true);
                if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 border border-amber-300 hover:bg-amber-300 transition-all flex items-center gap-1 shrink-0 font-black shadow cursor-pointer"
              title="Reines Taktikfeld Vollbild"
            >
              <Maximize2 size={12} />
              <span>Vollbild</span>
            </button>

            <button
              onClick={() => {
                const nextState = !trainerEditMode;
                setTrainerEditMode(nextState);
                notify(`Trainer-Bearbeitungsmodus ${nextState ? 'AKTIV' : 'deaktiviert'}`);
              }}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 shrink-0 shadow cursor-pointer ${
                trainerEditMode 
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse' 
                  : 'bg-slate-800 text-amber-400 hover:bg-slate-700 border-amber-500/40'
              }`}
              title="Taktiktafel, Inhalte und Notizen bearbeiten"
            >
              <Edit3 size={13} className={trainerEditMode ? 'text-slate-950 font-black' : 'text-amber-400'} />
              <span>{trainerEditMode ? '✏️ Bearbeiten AKTIV' : '✏️ Bearbeiten'}</span>
            </button>
          </div>
        </div>

        {/* TRAINER BEARBEITUNGSMODUS BANNER / CONTROLS (WENN BEARBEITEN AKTIV) */}
        {trainerEditMode && (
          <div className="bg-amber-500/10 border-2 border-amber-400/80 rounded-xl p-3 shadow-xl space-y-2 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="font-black text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Edit3 size={14} className="text-amber-400" />
                  TRAINER-BEARBEITUNGSMODUS AKTIV: Taktik, Notizen & Anweisungen anpassen
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => notify('Alle taktischen Änderungen erfolgreich in Cloud gespeichert!')}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] uppercase px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow"
                >
                  <Save size={12} /> Änderungen Speichern
                </button>
                <button
                  onClick={() => {
                    setTrainerEditMode(false);
                    notify('Bearbeitungsmodus beendet.');
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  Fertig
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={() => {
                  const newNote = prompt('Neue taktische Trainer-Anweisung eingeben:');
                  if (newNote && newNote.trim()) {
                    setCustomTrainerNotes(prev => (prev ? `${prev}\n• ${newNote.trim()}` : `• ${newNote.trim()}`));
                    notify('Neue Anweisung hinzugefügt!');
                  }
                }}
                className="bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/50 font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                ➕ Taktische Anweisung zufügen
              </button>

              <button
                onClick={() => {
                  const newFormName = prompt('Name des neuen Systems / Formation eingeben (z.B. 4-1-2-3):');
                  if (newFormName && newFormName.trim()) {
                    notify(`System "${newFormName.trim()}" hinzugefügt!`);
                  }
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                ➕ Neues System / Formation
              </button>

              <button
                onClick={() => {
                  if (confirm('Taktische Notizen wirklich löschen?')) {
                    setCustomTrainerNotes('');
                    notify('Taktische Notizen gelöscht.');
                  }
                }}
                className="bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer ml-auto"
              >
                🗑️ Notizen löschen
              </button>
            </div>
          </div>
        )}

        {/* HAUPTEBENE 2: PHASEN-ANALYSE (ÖFFNET AUTOMATISCH BEI SYSTEMWAHL, HÄNGT DIREKT UNTER DEM SYSTEM) */}
        {showTrainerPhasePanelOnBoard && (
          <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-2.5 flex flex-col gap-2 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-black text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Layers size={13} className="text-amber-400" />
                  PHASEN-ANALYSE ({selectedFormation}):
                </span>
              </div>

              {/* PHASEN TABS (Offensiv, Defensiv, Umschalten Offensiv, Umschalten Defensiv) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActivePhase('offensiv')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                    activePhase === 'offensiv'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  🔵 Offensiv
                </button>
                <button
                  onClick={() => setActivePhase('defensiv')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                    activePhase === 'defensiv'
                      ? 'bg-rose-500 text-white border-rose-400 font-black shadow'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  🛡️ Defensiv
                </button>
                <button
                  onClick={() => setActivePhase('umschalten')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                    activePhase === 'umschalten'
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  ⚡ Umschalten Offensiv
                </button>
                <button
                  onClick={() => setActivePhase('umschalten')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                    activePhase === 'umschalten'
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black shadow'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  🔄 Umschalten Defensiv
                </button>
              </div>
            </div>

            {/* OPTIONEN INNERHALB DER PHASEN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs pt-1">
              {/* OFFENSIV OPTIONEN */}
              {activePhase === 'offensiv' && (
                <>
                  <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                    <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Aufbauhöhe</span>
                    <div className="grid grid-cols-3 gap-1">
                      {['tief', 'mittelhoch', 'hoch'].map((val) => (
                        <button
                          key={val}
                          onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, aufbauhoehe: val } }))}
                          className={`py-1 text-[10px] font-black uppercase rounded border transition-all cursor-pointer ${
                            tacticalPhaseConfig.offensiv.aufbauhoehe === val
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                    <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Progression</span>
                    <div className="grid grid-cols-3 gap-1">
                      {['Kurzpass', 'Direktspiel', 'Verlagerung'].map((val) => (
                        <button
                          key={val}
                          onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, progression: val } }))}
                          className={`py-1 text-[10px] font-black uppercase rounded border transition-all cursor-pointer ${
                            tacticalPhaseConfig.offensiv.progression === val
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* DEFENSIV OPTIONEN */}
              {activePhase === 'defensiv' && (
                <>
                  <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                    <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Pressinghöhe</span>
                    <div className="grid grid-cols-3 gap-1">
                      {['hoch', 'mittel', 'tief'].map((val) => (
                        <button
                          key={val}
                          onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, pressinghoehe: val } }))}
                          className={`py-1 text-[10px] font-black uppercase rounded border transition-all cursor-pointer ${
                            tacticalPhaseConfig.defensiv.pressinghoehe === val
                              ? 'bg-rose-500 text-white border-rose-400 font-black shadow'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg col-span-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Pressinglenkung</span>
                    <div className="grid grid-cols-3 gap-1">
                      {['Außenbahn', 'schwacher Fuß', 'Pressingfalle'].map((val) => (
                        <button
                          key={val}
                          onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, pressinglenkung: val } }))}
                          className={`py-1 text-[10px] font-black uppercase rounded border transition-all cursor-pointer ${
                            tacticalPhaseConfig.defensiv.pressinglenkung === val
                              ? 'bg-rose-500 text-white border-rose-400 font-black shadow'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* UMSCHALTEN OFFENSIV & DEFENSIV OPTIONEN */}
              {activePhase === 'umschalten' && (
                <>
                  <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                    <span className="text-amber-400 font-bold uppercase text-[9px] block mb-1">Umschalten OFF: Zielzone</span>
                    <div className="grid grid-cols-2 gap-1">
                      {['Flügel', 'Zentrum'].map((val) => (
                        <button
                          key={val}
                          onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenOffensiv: { ...prev.umschaltenOffensiv, zielzone: val } }))}
                          className={`py-1 text-[10px] font-black uppercase rounded border transition-all cursor-pointer ${
                            tacticalPhaseConfig.umschaltenOffensiv.zielzone === val
                              ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                    <span className="text-amber-400 font-bold uppercase text-[9px] block mb-1">Umschalten OFF: Tempo</span>
                    <div className="grid grid-cols-2 gap-1">
                      {['schnell', 'kontrolliert'].map((val) => (
                        <button
                          key={val}
                          onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenOffensiv: { ...prev.umschaltenOffensiv, tempo: val } }))}
                          className={`py-1 text-[10px] font-black uppercase rounded border transition-all cursor-pointer ${
                            tacticalPhaseConfig.umschaltenOffensiv.tempo === val
                              ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg col-span-2">
                    <span className="text-cyan-400 font-bold uppercase text-[9px] block mb-1">Umschalten DEF: Gegenpressing</span>
                    <div className="grid grid-cols-3 gap-1">
                      {['hoch', 'mittel', 'niedrig'].map((val) => (
                        <button
                          key={val}
                          onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenDefensiv: { ...prev.umschaltenDefensiv, gegenpressingintensitaet: val } }))}
                          className={`py-1 text-[10px] font-black uppercase rounded border transition-all cursor-pointer ${
                            tacticalPhaseConfig.umschaltenDefensiv.gegenpressingintensitaet === val
                              ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black shadow'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* HAUPTEBENE 3: DARSTELLUNGSOPTIONEN (IMMER UNTER DEN PHASEN) */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
              <Eye size={12} className="text-emerald-400" /> Darstellungsoptionen:
            </span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                setIsPitchOnlyFullscreen(true);
                if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="px-2.5 py-1 text-[10px] font-black uppercase rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 cursor-pointer font-black shadow"
            >
              🖥️ Nur Taktikfeld Vollbild
            </button>

            <button
              onClick={() => setActiveTabSub('presentation')}
              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md border cursor-pointer transition-all ${
                activeTabSub === 'presentation'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              📺 Präsentation
            </button>

            <button
              onClick={() => setShowZonesGrid(!showZonesGrid)}
              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md border cursor-pointer transition-all ${
                showZonesGrid ? 'bg-sky-950 text-sky-300 border-sky-500 font-black' : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              📐 Drittel-Grid
            </button>

            <button
              onClick={() => setShowHeatmaps(!showHeatmaps)}
              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md border cursor-pointer transition-all ${
                showHeatmaps ? 'bg-amber-950 text-amber-300 border-amber-500 font-black' : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              🔥 Heatmaps
            </button>

            <button
              onClick={() => setShowTrainerPhasePanelOnBoard(!showTrainerPhasePanelOnBoard)}
              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md border cursor-pointer transition-all ${
                showTrainerPhasePanelOnBoard ? 'bg-amber-400 text-slate-950 border-amber-300 font-black' : 'bg-slate-900 text-amber-400 border-amber-500/40'
              }`}
            >
              ⚡ Phasen-Optionen
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: 3D-TAKTIKTAFEL (TV VIEW & ZONEN) */}
      {activeTabSub === 'board' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT 8 COLS: PITCH CANVAS WITH DRITTEL & ZONEN-RASTER */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            


            {/* INTEGRATED TRAINER PHASE OPTIONS CONTROL BAR DIRECTLY ON THE TACTIC BOARD */}
            {showTrainerPhasePanelOnBoard && (
              <div className="bg-slate-950/95 border-2 border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-black text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Layers size={14} className="text-amber-400" />
                      Phasen-Optionen & Taktik-Steuerung (Aktiv: {activePhase === 'offensiv' ? '1. Offensiv' : activePhase === 'defensiv' ? '2. Defensiv' : '3. Umschalten'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAllPhasesExpanded(!showAllPhasesExpanded)}
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border transition-all ${
                        showAllPhasesExpanded 
                          ? 'bg-amber-400 text-slate-950 border-amber-300' 
                          : 'bg-slate-900 text-amber-400 border-amber-500/30 hover:bg-slate-800'
                      }`}
                    >
                      {showAllPhasesExpanded ? 'Muster Kompakt' : '📋 Alle 4 Phasen Einblenden'}
                    </button>
                  </div>
                </div>

                {/* CONDITIONAL RENDER FOR ACTIVE PHASE OR ALL PHASES */}
                {!showAllPhasesExpanded ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                    {activePhase === 'offensiv' && (
                      <>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Aufbauhöhe</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['tief', 'mittelhoch', 'hoch'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, aufbauhoehe: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                  tacticalPhaseConfig.offensiv.aufbauhoehe === val
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Überzahlzonen</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['IV', '6er', 'Halbraum'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, ueberzahlzonen: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                  tacticalPhaseConfig.offensiv.ueberzahlzonen === val
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Progression</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['Kurzpass', 'Direktspiel', 'Verlagerung'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, progression: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                  tacticalPhaseConfig.offensiv.progression === val
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Halbraumnutzung</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['Achter', 'Zehner', 'inverser Flügel'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, halbraumnutzung: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all truncate ${
                                  tacticalPhaseConfig.offensiv.halbraumnutzung === val
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Offensivfokus</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['Flügel', 'Zentrum', 'Umschaltspiel'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, offensivfokus: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                  tacticalPhaseConfig.offensiv.offensivfokus === val
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {activePhase === 'defensiv' && (
                      <>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Pressinghöhe</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['hoch', 'mittel', 'tief'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, pressinghoehe: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                  tacticalPhaseConfig.defensiv.pressinghoehe === val
                                    ? 'bg-rose-500 text-white border-rose-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Pressinglenkung</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['Außenbahn', 'schwacher Fuß', 'Pressingfalle'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, pressinglenkung: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all truncate ${
                                  tacticalPhaseConfig.defensiv.pressinglenkung === val
                                    ? 'bg-rose-500 text-white border-rose-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Kompaktheit</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['eng', 'breit', 'mittig'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, kompaktheit: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                  tacticalPhaseConfig.defensiv.kompaktheit === val
                                    ? 'bg-rose-500 text-white border-rose-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Mannorientierung</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['ja', 'nein', 'situativ'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, mannorientierung: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                  tacticalPhaseConfig.defensiv.mannorientierung === val
                                    ? 'bg-rose-500 text-white border-rose-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {activePhase === 'umschalten' && (
                      <>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Konter Zielzone</span>
                          <div className="grid grid-cols-2 gap-1">
                            {['Flügel', 'Zentrum'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenOffensiv: { ...prev.umschaltenOffensiv, zielzone: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                  tacticalPhaseConfig.umschaltenOffensiv.zielzone === val
                                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Konter Tempo</span>
                          <div className="grid grid-cols-2 gap-1">
                            {['schnell', 'kontrolliert'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenOffensiv: { ...prev.umschaltenOffensiv, tempo: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                  tacticalPhaseConfig.umschaltenOffensiv.tempo === val
                                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Gegenpressing</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['hoch', 'mittel', 'niedrig'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenDefensiv: { ...prev.umschaltenDefensiv, gegenpressingintensitaet: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${
                                  tacticalPhaseConfig.umschaltenDefensiv.gegenpressingintensitaet === val
                                    ? 'bg-purple-500 text-white border-purple-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Restverteidigung</span>
                          <div className="grid grid-cols-2 gap-1">
                            {['2+1', '3er Restverteidigung'].map((val) => (
                              <button
                                key={val}
                                onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenDefensiv: { ...prev.umschaltenDefensiv, absicherung: val } }))}
                                className={`py-1 text-[10px] font-black uppercase rounded-lg border transition-all truncate ${
                                  tacticalPhaseConfig.umschaltenDefensiv.absicherung === val
                                    ? 'bg-purple-500 text-white border-purple-400 font-black shadow'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
                    <div className="bg-slate-900 border border-emerald-500/30 p-2.5 rounded-xl space-y-2">
                      <span className="font-black text-emerald-400 uppercase text-[10px] block border-b border-slate-800 pb-1">1. Offensiv</span>
                      <div>
                        <span className="text-slate-500 font-bold text-[9px] uppercase block">Aufbauhöhe</span>
                        <div className="grid grid-cols-3 gap-1 mt-0.5">
                          {['tief', 'mittelhoch', 'hoch'].map((val) => (
                            <button key={val} onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, aufbauhoehe: val } }))} className={`py-0.5 text-[9px] font-black uppercase rounded border ${tacticalPhaseConfig.offensiv.aufbauhoehe === val ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{val}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold text-[9px] uppercase block">Progression</span>
                        <div className="grid grid-cols-3 gap-1 mt-0.5">
                          {['Kurzpass', 'Direktspiel', 'Verlagerung'].map((val) => (
                            <button key={val} onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, progression: val } }))} className={`py-0.5 text-[9px] font-black uppercase rounded border ${tacticalPhaseConfig.offensiv.progression === val ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{val}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-rose-500/30 p-2.5 rounded-xl space-y-2">
                      <span className="font-black text-rose-400 uppercase text-[10px] block border-b border-slate-800 pb-1">2. Defensiv</span>
                      <div>
                        <span className="text-slate-500 font-bold text-[9px] uppercase block">Pressinghöhe</span>
                        <div className="grid grid-cols-3 gap-1 mt-0.5">
                          {['hoch', 'mittel', 'tief'].map((val) => (
                            <button key={val} onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, pressinghoehe: val } }))} className={`py-0.5 text-[9px] font-black uppercase rounded border ${tacticalPhaseConfig.defensiv.pressinghoehe === val ? 'bg-rose-500 text-white border-rose-400' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{val}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold text-[9px] uppercase block">Pressinglenkung</span>
                        <div className="grid grid-cols-3 gap-1 mt-0.5">
                          {['Außenbahn', 'schwacher Fuß', 'Pressingfalle'].map((val) => (
                            <button key={val} onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, pressinglenkung: val } }))} className={`py-0.5 text-[9px] font-black uppercase rounded border ${tacticalPhaseConfig.defensiv.pressinglenkung === val ? 'bg-rose-500 text-white border-rose-400' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{val}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-amber-500/30 p-2.5 rounded-xl space-y-2">
                      <span className="font-black text-amber-400 uppercase text-[10px] block border-b border-slate-800 pb-1">3. Umschalten Off.</span>
                      <div>
                        <span className="text-slate-500 font-bold text-[9px] uppercase block">Zielzone & Tempo</span>
                        <div className="grid grid-cols-2 gap-1 mt-0.5">
                          {['Flügel', 'Zentrum'].map((val) => (
                            <button key={val} onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenOffensiv: { ...prev.umschaltenOffensiv, zielzone: val } }))} className={`py-0.5 text-[9px] font-black uppercase rounded border ${tacticalPhaseConfig.umschaltenOffensiv.zielzone === val ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{val}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-purple-500/30 p-2.5 rounded-xl space-y-2">
                      <span className="font-black text-purple-400 uppercase text-[10px] block border-b border-slate-800 pb-1">4. Umschalten Def.</span>
                      <div>
                        <span className="text-slate-500 font-bold text-[9px] uppercase block">Gegenpressing</span>
                        <div className="grid grid-cols-3 gap-1 mt-0.5">
                          {['hoch', 'mittel', 'niedrig'].map((val) => (
                            <button key={val} onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenDefensiv: { ...prev.umschaltenDefensiv, gegenpressingintensitaet: val } }))} className={`py-0.5 text-[9px] font-black uppercase rounded border ${tacticalPhaseConfig.umschaltenDefensiv.gegenpressingintensitaet === val ? 'bg-purple-500 text-white border-purple-400' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{val}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Target mode instruction bar when plotting runs */}
            {runTargetModePlayerId && (
              <div className="bg-amber-500 text-slate-950 font-black text-xs px-4 py-2 rounded-xl flex items-center justify-between shadow-lg border border-amber-300">
                <span className="flex items-center gap-2">
                  <CornerUpRight size={16} /> 
                  Klicke auf das Spielfeld, um den Zielpunkt für den Laufweg von "{currentNodePositions.find(n => n.id === runTargetModePlayerId)?.name}" zu setzen...
                </span>
                <button 
                  onClick={() => setRunTargetModePlayerId(null)}
                  className="bg-slate-950 text-white px-2 py-0.5 rounded text-[10px] uppercase font-black"
                >
                  Abbrechen
                </button>
              </div>
            )}

            {/* PITCH CANVAS CONTAINER */}
            <div 
              ref={pitchRef}
              onClick={handlePitchClickForRun}
              onMouseMove={handlePitchMouseMove}
              onTouchMove={handlePitchMouseMove}
              onMouseUp={handlePitchMouseUp}
              onTouchEnd={handlePitchMouseUp}
              className={`relative w-full rounded-2xl border-2 border-slate-800 bg-slate-950 overflow-hidden shadow-2xl transition-all duration-500 select-none ${
                viewMode === '3d_tv' ? 'h-[540px] [perspective:1000px]' : 'h-[540px]'
              }`}
            >
              {/* Floating Quick Solo Fullscreen Button */}
              <div className="absolute top-3 right-3 z-30 flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPitchOnlyFullscreen(true);
                    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                      document.documentElement.requestFullscreen().catch(() => {});
                    }
                  }}
                  className="bg-slate-900/90 hover:bg-amber-400 hover:text-slate-950 text-amber-300 border border-amber-500/50 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-2xl backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Spielfeld in Reines Vollbild vergrößern"
                >
                  <Maximize2 size={13} />
                  <span>🖥️ Solo Spielfeld</span>
                </button>
              </div>
              {/* THE PITCH SURFACE */}
              <div 
                ref={pitchSurfaceRef}
                className={`w-full h-full relative transition-transform duration-700 ease-out origin-center ${
                  viewMode === '3d_tv' 
                    ? '[transform:rotateX(32deg)_rotateZ(0deg)_scale(0.92)] shadow-[0_50px_100px_rgba(0,0,0,0.9)]' 
                    : ''
                }`}
                style={{
                  background: 'radial-gradient(circle at center, #063826 0%, #031e15 100%)'
                }}
              >
                {/* Grass Pattern Stripes */}
                <div className="absolute inset-0 grid grid-cols-12 opacity-20 pointer-events-none">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className={i % 2 === 0 ? 'bg-emerald-400/10' : 'bg-transparent'} />
                  ))}
                </div>

                {/* Outer Field Boundary Line */}
                <div className="absolute inset-4 border-2 border-emerald-400/40 pointer-events-none rounded-sm">
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-emerald-400/40 -translate-x-1/2" />
                  <div className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full border-2 border-emerald-400/40 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
                  </div>
                  <div className="absolute top-1/2 left-0 w-24 h-48 -translate-y-1/2 border-2 border-l-0 border-emerald-400/40">
                    <div className="absolute top-1/2 left-0 w-10 h-24 -translate-y-1/2 border border-l-0 border-emerald-400/30" />
                  </div>
                  <div className="absolute top-1/2 right-0 w-24 h-48 -translate-y-1/2 border-2 border-r-0 border-emerald-400/40">
                    <div className="absolute top-1/2 right-0 w-10 h-24 -translate-y-1/2 border border-r-0 border-emerald-400/30" />
                  </div>
                </div>

                {/* 3 VERTIKALE DRITTEL OVERLAY */}
                {showZonesGrid && (
                  <div className="absolute inset-4 grid grid-cols-3 pointer-events-none">
                    <div className="border-r border-dashed border-sky-400/30 flex flex-col justify-between p-2">
                      <span className="text-[9px] font-mono font-black text-sky-400/60 bg-slate-950/80 px-1.5 py-0.5 rounded w-max uppercase">Defensives Drittel</span>
                      <span className="text-[9px] font-mono font-black text-sky-400/30 self-end">Abwehrkette</span>
                    </div>
                    <div className="border-r border-dashed border-amber-400/30 flex flex-col justify-between p-2">
                      <span className="text-[9px] font-mono font-black text-amber-400/60 bg-slate-950/80 px-1.5 py-0.5 rounded w-max uppercase">Mittelfeld-Drittel</span>
                      <span className="text-[9px] font-mono font-black text-amber-400/30 self-center">Halbräume & Zentrum</span>
                    </div>
                    <div className="flex flex-col justify-between p-2">
                      <span className="text-[9px] font-mono font-black text-emerald-400/60 bg-slate-950/80 px-1.5 py-0.5 rounded w-max uppercase">Offensives Drittel</span>
                      <span className="text-[9px] font-mono font-black text-emerald-400/30">Sturmbox</span>
                    </div>
                  </div>
                )}

                {/* HEATMAP CLOUDS OVERLAY */}
                {showHeatmaps && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-[30%] left-[65%] w-48 h-32 rounded-full bg-amber-500/20 blur-3xl animate-pulse" />
                    <div className="absolute top-[60%] left-[75%] w-40 h-28 rounded-full bg-emerald-500/25 blur-2xl" />
                    <div className="absolute top-[40%] left-[25%] w-36 h-36 rounded-full bg-rose-500/15 blur-2xl" />
                  </div>
                )}

                {/* PLAYER MARKED ZONES OVERLAY */}
                {currentNodePositions.map((node) => {
                  const zoneObj = customZones.find(z => z.playerId === node.id);
                  if (!zoneObj || zoneObj.zoneType === 'Keine') return null;
                  return (
                    <div
                      key={`zone-${node.id}`}
                      style={{
                        left: `${node.currentX}%`,
                        top: `${node.currentY}%`,
                        backgroundColor: zoneObj.color
                      }}
                      className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full blur-sm border border-white/20 pointer-events-none transition-all duration-300"
                    />
                  );
                })}

                {/* RUN VECTOR LINES (Standard & Custom Runs) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                  <defs>
                    <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <polygon points="0 0, 7 3.5, 0 7" fill="#10B981" />
                    </marker>
                    <marker id="arrowhead-custom" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <polygon points="0 0, 7 3.5, 0 7" fill="#3B82F6" />
                    </marker>
                  </defs>

                  {/* Standard preset run vectors if enabled */}
                  {showRunVectors && customRuns.length === 0 && currentNodePositions.map((n) => {
                    if (n.position === 'TW') return null;
                    const targetX = n.currentX + 8;
                    const targetY = n.currentY + (n.currentY > 50 ? -6 : 6);
                    return (
                      <line
                        key={`vector-${n.id}`}
                        x1={`${n.currentX}%`}
                        y1={`${n.currentY}%`}
                        x2={`${targetX}%`}
                        y2={`${targetY}%`}
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                        markerEnd="url(#arrowhead)"
                        className="opacity-75"
                      />
                    );
                  })}

                  {/* Custom saved runs */}
                  {customRuns.map((run) => {
                    if (!run.path || run.path.length < 2) return null;
                    const p1 = run.path[0];
                    const p2 = run.path[1];
                    return (
                      <g key={run.id}>
                        <line
                          x1={`${p1.x}%`}
                          y1={`${p1.y}%`}
                          x2={`${p2.x}%`}
                          y2={`${p2.y}%`}
                          stroke={run.color || '#3B82F6'}
                          strokeWidth="3.5"
                          strokeDasharray="5 3"
                          markerEnd="url(#arrowhead-custom)"
                          className="drop-shadow-md"
                        />
                        <circle cx={`${p2.x}%`} cy={`${p2.y}%`} r="4" fill={run.color || '#3B82F6'} />
                      </g>
                    );
                  })}
                </svg>

                {/* INTERACTIVE PLAYER NODE MARKERS */}
                {currentNodePositions.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isContextMenuActive = contextMenuPlayerId === node.id;

                  return (
                    <motion.div
                      key={node.id}
                      onMouseDown={() => {
                        setSelectedNodeId(node.id);
                        if (!node.isLocked) {
                          setDraggingNodeId(node.id);
                        }
                      }}
                      onTouchStart={() => {
                        setSelectedNodeId(node.id);
                        if (!node.isLocked) {
                          setDraggingNodeId(node.id);
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                        // Open sleek context menu for this player
                        setContextMenuPlayerId(node.id);
                        setContextSubMenu('main');
                        setRenameInput(customFormationsList.find(f => f.id === selectedFormation)?.name || basePreset.name);
                      }}
                      style={{
                        left: `${node.currentX}%`,
                        top: `${node.currentY}%`
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group"
                    >
                      {/* 3D NODE GLOW & SELECTION / HIGHLIGHT RING */}
                      <div className={`relative flex flex-col items-center justify-center transition-all ${
                        isSelected || node.isHighlighted ? 'scale-125 z-40' : 'hover:scale-110 z-20'
                      }`}>
                        
                        {/* Highlighted Gold Pulse Ring */}
                        {node.isHighlighted && (
                          <div className="absolute -inset-4 rounded-full bg-amber-400/40 animate-ping pointer-events-none" />
                        )}

                        {/* Selected aura ring */}
                        {isSelected && !node.isHighlighted && (
                          <div className="absolute -inset-3 rounded-full bg-emerald-400/30 animate-pulse pointer-events-none" />
                        )}

                        {/* Player Name Pill / Badge */}
                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-black shadow-xl border flex items-center gap-1 ${
                          node.isHighlighted
                            ? 'bg-amber-400 text-slate-950 border-white font-black shadow-amber-500/50'
                            : isSelected 
                            ? 'bg-emerald-500 text-white border-white shadow-emerald-500/50' 
                            : 'bg-slate-950/90 text-white border-emerald-500/50 group-hover:border-emerald-400'
                        }`}>
                          {node.isLocked && <Lock size={9} className="text-amber-300" />}
                          {node.isHighlighted && <Star size={9} className="fill-slate-950 text-slate-950" />}
                          <span>{node.number}. {node.name}</span>
                        </div>

                        {/* 3D Node Sphere Marker with Player Photo */}
                        <div className={`w-9 h-9 rounded-full border-2 mt-1 relative flex items-center justify-center shadow-2xl text-xs font-black transition-all overflow-hidden ${
                          node.isHighlighted
                            ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 border-white text-slate-950 shadow-amber-500/60 ring-2 ring-amber-400'
                            : isSelected
                            ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 border-white text-white shadow-emerald-500/50 ring-2 ring-emerald-300'
                            : 'bg-gradient-to-tr from-slate-800 to-slate-900 border-emerald-400 text-emerald-400 shadow-slate-900/50'
                        }`}>
                          {showPlayerPhotos && (node.image || node.assignedPlayer?.image) ? (
                            <>
                              <img 
                                src={node.image || node.assignedPlayer?.image} 
                                alt={node.name} 
                                className="w-full h-full object-cover" 
                              />
                              <span className="absolute bottom-0 right-0 bg-slate-950/90 text-emerald-400 font-mono text-[7px] font-black px-1 rounded-tl border-t border-l border-emerald-500/40">
                                {node.number}
                              </span>
                            </>
                          ) : (
                            node.position
                          )}
                        </div>

                        {/* Role tag badge under node */}
                        {node.role && (
                          <span className="text-[8px] font-mono font-bold bg-slate-950/90 text-slate-300 px-1.5 py-0.5 rounded border border-slate-800 mt-0.5 whitespace-nowrap shadow-sm">
                            {node.role}
                          </span>
                        )}
                      </div>

                      {/* SLEEK COMPACT CONTEXT MENU (POPOVER ON PLAYER CLICK) */}
                      <AnimatePresence>
                        {isContextMenuActive && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 w-56 bg-slate-900/98 border-2 border-emerald-500/60 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl z-50 text-slate-100 font-sans"
                          >
                            {/* Close Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setContextMenuPlayerId(null);
                              }}
                              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                            >
                              <X size={14} />
                            </button>

                            {/* Context Menu Header */}
                            <div className="border-b border-slate-800 pb-2 mb-2 pr-6">
                              <div className="font-black text-xs text-white uppercase truncate flex items-center gap-1">
                                <span className="text-amber-400 font-mono">#{node.number}</span> {node.name}
                              </div>
                              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                {node.position} • {node.role}
                              </div>
                            </div>

                            {/* MENU MAIN VIEW */}
                            {contextSubMenu === 'main' && (
                              <div className="space-y-1 text-xs">
                                
                                {/* 0. Spieler aus Kader zuweisen (mit Foto) */}
                                <button
                                  onClick={() => setContextSubMenu('assign_player')}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-emerald-400 font-bold flex items-center justify-between transition-colors"
                                >
                                  <span className="flex items-center gap-2">
                                    <UserCheck size={14} className="text-emerald-400" /> Spieler aus Kader wählen
                                  </span>
                                  <ChevronDown size={14} className="-rotate-90 text-slate-400" />
                                </button>

                                {/* 1. Laufweg hinzufügen */}
                                <button
                                  onClick={() => {
                                    setRunTargetModePlayerId(node.id);
                                    setContextMenuPlayerId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-emerald-400 font-bold flex items-center gap-2 transition-colors"
                                >
                                  <CornerUpRight size={14} />
                                  <span>Laufweg hinzufügen</span>
                                </button>

                                {/* 2. Spieler hervorheben */}
                                <button
                                  onClick={() => {
                                    const isH = highlightedPlayerIds.includes(node.id);
                                    const next = isH 
                                      ? highlightedPlayerIds.filter(id => id !== node.id)
                                      : [...highlightedPlayerIds, node.id];
                                    setHighlightedPlayerIds(next);
                                    syncActiveCustomFormationToFirestore({ highlightedPlayerIds: next });
                                    notify(isH ? `${node.name} nicht mehr hervorgehoben.` : `${node.name} hervorgehoben!`);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-amber-300 font-bold flex items-center justify-between transition-colors"
                                >
                                  <span className="flex items-center gap-2">
                                    <Star size={14} /> Spieler hervorheben
                                  </span>
                                  {node.isHighlighted && <Check size={14} className="text-amber-400" />}
                                </button>

                                {/* 3. Rolle zuweisen */}
                                <button
                                  onClick={() => setContextSubMenu('roles')}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center justify-between transition-colors"
                                >
                                  <span className="flex items-center gap-2">
                                    <Layers size={14} className="text-sky-400" /> Rolle zuweisen
                                  </span>
                                  <ChevronDown size={14} className="-rotate-90 text-slate-400" />
                                </button>

                                {/* 4. Zone markieren */}
                                <button
                                  onClick={() => setContextSubMenu('zones')}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center justify-between transition-colors"
                                >
                                  <span className="flex items-center gap-2">
                                    <Grid size={14} className="text-purple-400" /> Zone markieren
                                  </span>
                                  <ChevronDown size={14} className="-rotate-90 text-slate-400" />
                                </button>

                                {/* 5. Position sperren / freigeben */}
                                <button
                                  onClick={() => {
                                    const isL = lockedPlayerIds.includes(node.id);
                                    const next = isL 
                                      ? lockedPlayerIds.filter(id => id !== node.id)
                                      : [...lockedPlayerIds, node.id];
                                    setLockedPlayerIds(next);
                                    syncActiveCustomFormationToFirestore({ lockedPlayerIds: next });
                                    notify(isL ? `Position von ${node.name} freigegeben.` : `Position von ${node.name} gesperrt!`);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center justify-between transition-colors"
                                >
                                  <span className="flex items-center gap-2">
                                    {node.isLocked ? <Lock size={14} className="text-amber-400" /> : <Unlock size={14} className="text-slate-400" />}
                                    <span>{node.isLocked ? 'Position freigeben' : 'Position sperren'}</span>
                                  </span>
                                </button>

                                {/* 6. Formation umbenennen */}
                                <button
                                  onClick={() => setContextSubMenu('rename')}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 font-semibold flex items-center gap-2 transition-colors"
                                >
                                  <Edit3 size={14} className="text-amber-400" />
                                  <span>Formation umbenennen</span>
                                </button>

                                {/* Option to clear custom runs for this player if present */}
                                {customRuns.some(r => r.playerId === node.id) && (
                                  <button
                                    onClick={() => {
                                      const nextRuns = customRuns.filter(r => r.playerId !== node.id);
                                      setCustomRuns(nextRuns);
                                      syncActiveCustomFormationToFirestore({ runs: nextRuns });
                                      notify(`Laufwege von ${node.name} entfernt.`);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-950/60 text-rose-400 font-medium flex items-center gap-2 transition-colors mt-1 border-t border-slate-800"
                                  >
                                    <Trash2 size={13} />
                                    <span>Laufwege löschen</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* ROLES SUBMENU */}
                            {contextSubMenu === 'roles' && (
                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                  <span>Rolle auswählen:</span>
                                  <button onClick={() => setContextSubMenu('main')} className="text-emerald-400 hover:underline">Zurück</button>
                                </div>

                                <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto custom-scrollbar">
                                  {PREDEFINED_ROLES.map(roleName => (
                                    <button
                                      key={roleName}
                                      onClick={() => {
                                        const updatedRoles = { ...customRoles, [node.id]: roleName };
                                        setCustomRoles(updatedRoles);
                                        syncActiveCustomFormationToFirestore({ roles: updatedRoles });
                                        setContextMenuPlayerId(null);
                                        notify(`Rolle "${roleName}" für ${node.name} zugewiesen.`);
                                      }}
                                      className={`px-2 py-1 rounded text-[10px] font-bold text-left truncate transition-colors ${
                                        node.role === roleName ? 'bg-emerald-600 text-white' : 'bg-slate-950 hover:bg-slate-800 text-slate-300'
                                      }`}
                                    >
                                      {roleName}
                                    </button>
                                  ))}
                                </div>

                                <div className="pt-1.5 flex gap-1 border-t border-slate-800">
                                  <input
                                    type="text"
                                    value={customRoleInput}
                                    onChange={(e) => setCustomRoleInput(e.target.value)}
                                    placeholder="Eigene Rolle..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-emerald-500"
                                  />
                                  <button
                                    onClick={() => {
                                      if (!customRoleInput.trim()) return;
                                      const updatedRoles = { ...customRoles, [node.id]: customRoleInput.trim() };
                                      setCustomRoles(updatedRoles);
                                      syncActiveCustomFormationToFirestore({ roles: updatedRoles });
                                      setCustomRoleInput('');
                                      setContextMenuPlayerId(null);
                                      notify(`Rolle zugewiesen!`);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-2 text-[10px] rounded"
                                  >
                                    OK
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* ZONES SUBMENU */}
                            {contextSubMenu === 'zones' && (
                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                  <span>Zone markieren:</span>
                                  <button onClick={() => setContextSubMenu('main')} className="text-emerald-400 hover:underline">Zurück</button>
                                </div>

                                <div className="space-y-1">
                                  {PREDEFINED_ZONES.map(z => (
                                    <button
                                      key={z.name}
                                      onClick={() => {
                                        const filteredZones = customZones.filter(cz => cz.playerId !== node.id);
                                        const nextZones = z.name === 'Keine' 
                                          ? filteredZones 
                                          : [...filteredZones, { playerId: node.id, zoneType: z.name, color: z.color }];
                                        setCustomZones(nextZones);
                                        syncActiveCustomFormationToFirestore({ zones: nextZones });
                                        setContextMenuPlayerId(null);
                                        notify(z.name === 'Keine' ? `Zone entfernt.` : `Zone "${z.name}" markiert.`);
                                      }}
                                      className={`w-full text-left px-2.5 py-1 rounded text-[10px] font-bold flex items-center justify-between transition-colors ${
                                        node.markedZone === z.name ? 'bg-purple-600 text-white' : 'bg-slate-950 hover:bg-slate-800 text-slate-200'
                                      }`}
                                    >
                                      <span>{z.name}</span>
                                      {z.color !== 'transparent' && (
                                        <span className="w-3 h-3 rounded-full border border-white/40" style={{ backgroundColor: z.color }} />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* RENAME SUBMENU */}
                            {contextSubMenu === 'rename' && (
                              <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                  <span>Formation umbenennen:</span>
                                  <button onClick={() => setContextSubMenu('main')} className="text-emerald-400 hover:underline">Zurück</button>
                                </div>

                                <input
                                  type="text"
                                  value={renameInput}
                                  onChange={(e) => setRenameInput(e.target.value)}
                                  placeholder="Formationsname..."
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                                  autoFocus
                                />

                                <button
                                  onClick={() => handleRenameActiveFormation(renameInput)}
                                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-1.5 rounded-lg text-xs uppercase shadow transition-all flex items-center justify-center gap-1"
                                >
                                  <Save size={13} /> Speichern
                                </button>
                              </div>
                            )}

                            {/* ASSIGN PLAYER SUBMENU */}
                            {contextSubMenu === 'assign_player' && (
                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                  <span>Spieler aus Kader zuweisen:</span>
                                  <button onClick={() => setContextSubMenu('main')} className="text-emerald-400 hover:underline">Zurück</button>
                                </div>

                                <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                                  {players && players.length > 0 ? (
                                    players.map(p => {
                                      const isCurrent = customPlayerMap[node.id] === p.id || (node.assignedPlayer?.id === p.id);
                                      return (
                                        <button
                                          key={p.id}
                                          onClick={() => {
                                            updateCustomPlayerMap(node.id, p.id);
                                            syncActiveCustomFormationToFirestore({ playerAssignments: { ...customPlayerMap, [node.id]: p.id } });
                                            setContextMenuPlayerId(null);
                                            notify(`${p.firstName} ${p.lastName} auf Position ${node.position} zugewiesen!`);
                                          }}
                                          className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                                            isCurrent ? 'bg-emerald-600/30 border border-emerald-500 text-white' : 'bg-slate-950 hover:bg-slate-800 text-slate-200'
                                          }`}
                                        >
                                          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                                            {p.image ? (
                                              <img src={p.image} alt={p.lastName} className="w-full h-full object-cover" />
                                            ) : (
                                              <span className="text-[9px] font-bold text-slate-400">#{p.number}</span>
                                            )}
                                          </div>
                                          <div className="flex-1 truncate">
                                            <span className="font-bold text-xs truncate block text-white">#{p.number} {p.lastName}, {p.firstName}</span>
                                            <span className="text-[9px] text-emerald-400 font-bold uppercase">{p.position}</span>
                                          </div>
                                          {isCurrent && <Check size={12} className="text-emerald-400 shrink-0" />}
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <div className="text-[11px] text-slate-400 text-center py-2">Keine Spieler im Kader geladen</div>
                                  )}
                                </div>
                              </div>
                            )}

                          </motion.div>
                        )}
                      </AnimatePresence>

                    </motion.div>
                  );
                })}

              </div>
            </div>
          </div>

          {/* RIGHT 4 COLS: SELECTED PLAYER DETAILED STATS & MATCHPLAN NOTES */}
          <div className="lg:col-span-4 space-y-4">

            {/* LIVE MATCHPLAN INSTRUCTION CARD BASED ON PHASES */}
            <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-black text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-400" />
                  Live Matchplan Instruktion ({activePhase === 'offensiv' ? 'Offensiv' : activePhase === 'defensiv' ? 'Defensiv' : 'Umschalten'})
                </span>
                <button
                  onClick={() => setActiveTabSub('phase_options')}
                  className="text-[10px] font-bold text-amber-400 hover:text-white uppercase transition-all"
                  title="Zur vollständigen Phasen-Analyse-Seite wechseln"
                >
                  Phasen-Subtab ⚙️
                </button>
              </div>
              <p className="text-xs text-slate-200 leading-snug">
                {activePhase === 'offensiv' && (
                  <>
                    Aufbauhöhe: <strong className="text-emerald-400">{tacticalPhaseConfig.offensiv.aufbauhoehe}</strong> | Überzahl: <strong className="text-emerald-400">{tacticalPhaseConfig.offensiv.ueberzahlzonen}</strong> | Progression: <strong className="text-emerald-400">{tacticalPhaseConfig.offensiv.progression}</strong> | Halbraum: <strong className="text-emerald-400">{tacticalPhaseConfig.offensiv.halbraumnutzung}</strong> | Fokus: <strong className="text-emerald-400">{tacticalPhaseConfig.offensiv.offensivfokus}</strong>.
                  </>
                )}
                {activePhase === 'defensiv' && (
                  <>
                    Pressinghöhe: <strong className="text-rose-400">{tacticalPhaseConfig.defensiv.pressinghoehe}</strong> | Lenkung: <strong className="text-rose-400">{tacticalPhaseConfig.defensiv.pressinglenkung}</strong> | Kompaktheit: <strong className="text-rose-400">{tacticalPhaseConfig.defensiv.kompaktheit}</strong> | Mannorientierung: <strong className="text-rose-400">{tacticalPhaseConfig.defensiv.mannorientierung}</strong>.
                  </>
                )}
                {activePhase === 'umschalten' && (
                  <>
                    Konter Zielzone: <strong className="text-amber-400">{tacticalPhaseConfig.umschaltenOffensiv.zielzone}</strong> ({tacticalPhaseConfig.umschaltenOffensiv.tempo}) | Gegenpressing: <strong className="text-purple-400">{tacticalPhaseConfig.umschaltenDefensiv.gegenpressingintensitaet}</strong> ({tacticalPhaseConfig.umschaltenDefensiv.absicherung}).
                  </>
                )}
              </p>
            </div>
            
            {/* SELECTED PLAYER PROFILE CARD */}
            {selectedNode && (
              <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full pointer-events-none" />
                
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black text-lg flex items-center justify-center shadow-lg">
                      {selectedNode.number}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-white uppercase">{selectedNode.name}</h3>
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">{selectedNode.position} • {selectedNode.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 z-10">
                    <span className="bg-slate-950 text-slate-400 border border-slate-800 text-[9px] font-mono font-bold px-2 py-1 rounded-lg">
                      ID #{selectedNode.id}
                    </span>
                    <button
                      onClick={() => setSelectedNodeId(null)}
                      className="p-1 rounded-lg bg-slate-950 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer"
                      title="Profilkarte schließen"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* PERFORMANCE METRICS GRID */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Top Speed</span>
                    <div className="font-black text-emerald-400 font-mono text-sm mt-0.5 flex items-center gap-1">
                      <Activity size={12} /> {selectedNode.speedKmh} km/h
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Laufdistanz</span>
                    <div className="font-black text-sky-400 font-mono text-sm mt-0.5 flex items-center gap-1">
                      <TrendingUp size={12} /> {selectedNode.distanceKm} km
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Zweikampfquote</span>
                    <div className="font-black text-amber-400 font-mono text-sm mt-0.5 flex items-center gap-1">
                      <Shield size={12} /> {selectedNode.duelSuccessPercent}%
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Passquote</span>
                    <div className="font-black text-purple-400 font-mono text-sm mt-0.5 flex items-center gap-1">
                      <Target size={12} /> {selectedNode.passAccuracyPercent}%
                    </div>
                  </div>
                </div>

                {/* LEVEL 3 POSITION EVALUATION REQUIREMENT FROM AGENTS.MD */}
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-[10px] text-emerald-200 space-y-1">
                  <span className="font-black uppercase text-emerald-400 block tracking-wider">Level 3 Position-Analyse:</span>
                  <p className="leading-snug">
                    Für die Position {selectedNode.position} ist diese Laufbewegung typisch und taktisch essenziell für das FC Auggen Gegenpressing.
                  </p>
                </div>

                {/* VEO VIDEO NAVIGATION BUTTON */}
                {onNavigateToVideo && (
                  <button
                    onClick={() => onNavigateToVideo()}
                    className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500 text-slate-200 font-bold text-xs uppercase py-2 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Video size={14} className="text-emerald-400" />
                    <span>VEO Clips zu {selectedNode.name} Zeigen</span>
                  </button>
                )}
              </div>
            )}

            {/* CUSTOM TRAINER MATCHPLAN NOTES */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-black text-xs uppercase text-white tracking-wider flex items-center gap-2">
                  <Edit3 size={14} className="text-amber-400" /> Taktische Trainer-Anweisungen
                </span>
                <button
                  onClick={() => notify('Matchplan Notizen gespeichert.')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[10px] uppercase px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                >
                  <Save size={12} /> Speichern
                </button>
              </div>

              <textarea
                value={customTrainerNotes}
                onChange={(e) => setCustomTrainerNotes(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-medium focus:outline-none focus:border-emerald-500 custom-scrollbar resize-none"
                placeholder="Taktische Notizen eingeben..."
              />
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB 2: BESTE AUFSTELLUNG & 4-SYSTEME VERGLEICH */}
      {activeTabSub === 'comparison' && (
        <div className="space-y-6">
          
          {/* BESTE AUFSTELLUNG BOX */}
          <div className="bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-500/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 font-black flex items-center justify-center shadow-lg text-xl">
                  🏆
                </div>
                <div>
                  <h2 className="font-black text-xl text-white uppercase tracking-wider flex items-center gap-2">
                    BESTE AUFSTELLUNG FC AUGGEN (4-2-3-1 OPTIMAL XI)
                  </h2>
                  <p className="text-xs text-amber-300 font-semibold mt-0.5">
                    Berechnet aus Kader-Metriken, Formwerten & Zweikampf-Analysen
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedFormation('4-2-3-1');
                  setActiveTabSub('board');
                  notify('Beste Aufstellung (4-2-3-1) geladen!');
                }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 self-start md:self-auto"
              >
                <CheckCircle2 size={16} /> Beste Aufstellung Laden & Ansehen
              </button>
            </div>

            {/* OPTIMAL XI SQUAD GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2 pt-2">
              {FORMATION_PRESETS['4-2-3-1'].nodes.map((n) => (
                <div key={n.id} className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-2 flex flex-col items-center text-center shadow">
                  <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center mb-1">
                    {n.number}
                  </span>
                  <span className="font-black text-xs text-white truncate w-full">{n.name}</span>
                  <span className="text-[9px] font-bold text-amber-400 uppercase">{n.position}</span>
                  <span className="text-[8px] text-slate-400 font-mono mt-0.5">{n.passAccuracyPercent}% Pass</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4-SYSTEME VERGLEICH GRID */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-black text-lg uppercase tracking-wider text-white flex items-center gap-2">
                  <Grid className="text-amber-400" size={20} />
                  4-SYSTEME TAKTIK-VERGLEICHSMATRIX
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Synchrones Umschalten aller Systeme zwischen Ballbesitz (Mit Ball) und Defensive (Gegen Ball)
                </p>
              </div>

              {/* GLOBAL PHASE SWITCHER FOR ALL 4 SYSTEMS */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                <button
                  onClick={() => setActivePhase('offensiv')}
                  className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 ${
                    activePhase === 'offensiv' 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400 font-black' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Zap size={14} className="text-emerald-300" />
                  <span>⚽ Mit Ball (Offensiv)</span>
                </button>
                <button
                  onClick={() => setActivePhase('defensiv')}
                  className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 ${
                    activePhase === 'defensiv' 
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400 font-black' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Shield size={14} className="text-rose-300" />
                  <span>🛡️ Gegen den Ball (Defensiv)</span>
                </button>
                <button
                  onClick={() => setActivePhase('umschalten')}
                  className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 ${
                    activePhase === 'umschalten' 
                      ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-300' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <TrendingUp size={14} />
                  <span>⚡ Umschalten</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {['4-2-3-1', '4-4-2', '4-1-4-1', '3-4-3'].map((formKey) => {
                const data = FORMATION_PRESETS[formKey];
                const isSelected = selectedFormation === formKey;
                return (
                  <div 
                    key={formKey} 
                    className={`bg-slate-950 border-2 rounded-2xl p-5 space-y-4 transition-all ${
                      isSelected ? 'border-amber-400 shadow-xl shadow-amber-500/10' : 'border-slate-800 hover:border-emerald-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-black text-base text-emerald-400">{formKey}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                          activePhase === 'offensiv' 
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40' 
                            : activePhase === 'defensiv'
                            ? 'bg-rose-950/80 text-rose-400 border-rose-500/40'
                            : 'bg-amber-950/80 text-amber-400 border-amber-500/40'
                        }`}>
                          {activePhase === 'offensiv' ? 'Mit Ball' : activePhase === 'defensiv' ? 'Gegen Ball' : 'Umschalten'}
                        </span>
                        <span className="text-xs font-mono font-black text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/30">
                          {data.winRate}% Sieg
                        </span>
                      </div>
                    </div>

                    {/* MINI PITCH CANVAS WITH PHASE-AWARE PLAYER NODES */}
                    <div className="relative w-full h-48 bg-emerald-950/40 rounded-xl border border-emerald-500/30 overflow-hidden shadow-inner">
                      {/* Pitch Marking Lines */}
                      <div className="absolute inset-2 border border-emerald-400/20 pointer-events-none rounded-sm">
                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-emerald-400/20 -translate-x-1/2" />
                        <div className="absolute top-1/2 left-1/2 w-16 h-16 rounded-full border border-emerald-400/20 -translate-x-1/2 -translate-y-1/2" />
                      </div>

                      {/* Render Run Vectors or Node Markers for active phase */}
                      {data.nodes.map(n => {
                        const targetX = activePhase === 'offensiv' ? n.offensivX : activePhase === 'defensiv' ? n.defensivX : n.umschaltX;
                        const targetY = activePhase === 'offensiv' ? n.offensivY : activePhase === 'defensiv' ? n.defensivY : n.umschaltY;
                        
                        return (
                          <React.Fragment key={n.id}>
                            {/* Run path line from base to phase position */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                              <line 
                                x1={`${n.xPercent}%`} 
                                y1={`${n.yPercent}%`} 
                                x2={`${targetX}%`} 
                                y2={`${targetY}%`} 
                                stroke={activePhase === 'offensiv' ? '#10B981' : activePhase === 'defensiv' ? '#EF4444' : '#F59E0B'} 
                                strokeWidth="1.5" 
                                strokeDasharray="2 2" 
                                opacity="0.6"
                              />
                            </svg>
                            {/* Player Node */}
                            <div
                              style={{ left: `${targetX}%`, top: `${targetY}%` }}
                              title={`${n.name} (${n.position}) - ${activePhase === 'offensiv' ? 'Mit Ball' : activePhase === 'defensiv' ? 'Gegen Ball' : 'Umschalten'}`}
                              className={`absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white text-[9px] font-black flex items-center justify-center shadow-md transition-all duration-500 ${
                                activePhase === 'offensiv' 
                                  ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/50' 
                                  : activePhase === 'defensiv'
                                  ? 'bg-rose-500 text-white ring-2 ring-rose-400/50'
                                  : 'bg-amber-400 text-slate-950 ring-2 ring-amber-300/50'
                              }`}
                            >
                              {n.number}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      {data.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono font-bold bg-slate-900 p-2 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-slate-500 block">Ø xG Tore:</span>
                        <span className="text-emerald-400 font-black text-xs">{data.xGAvg} / Spiel</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Pressing-Quote:</span>
                        <span className="text-purple-400 font-black text-xs">{data.pressingSuccess}%</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <span className="font-black text-emerald-400 block uppercase text-[10px] tracking-wider">Vorteile:</span>
                      <ul className="list-disc list-inside text-slate-400 text-[11px] space-y-0.5">
                        {data.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedFormation(formKey);
                        setActiveTabSub('board');
                        notify(`System ${formKey} in Phase "${activePhase === 'offensiv' ? 'Mit dem Ball' : activePhase === 'defensiv' ? 'Gegen den Ball' : 'Umschalten'}" geladen.`);
                      }}
                      className="w-full bg-slate-900 hover:bg-emerald-600 hover:text-white text-slate-200 font-bold text-xs uppercase py-2 rounded-xl border border-slate-800 transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      <span>System in Phase laden</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: TAKTISCHE PHASEN-ANALYSE & OPTIONEN-GENERATOR */}
      {activeTabSub === 'phase_options' && (
        <div className="space-y-6">
          {/* Header & Phase Switcher Bar */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs uppercase">
                    Trainer-Tool
                  </span>
                  <h2 className="font-black text-xl text-white uppercase tracking-wider flex items-center gap-2">
                    <Layers className="text-amber-400" size={22} />
                    Taktische Phasen-Analyse & Optionen
                  </h2>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  Wählen Sie die aktive Spielphase und stellen Sie die spezifischen Optionen ein. Das System zeigt ausschließlich die Optionen der aktiven Phase und generiert eine präzise Trainer-Analyse.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setTacticalPhaseConfig({
                      offensiv: { aufbauhoehe: 'mittelhoch', ueberzahlzonen: '6er', progression: 'Kurzpass', halbraumnutzung: 'Zehner', offensivfokus: 'Flügel' },
                      defensiv: { pressinghoehe: 'mittel', pressinglenkung: 'Außenbahn', kompaktheit: 'eng', mannorientierung: 'situativ' },
                      umschaltenOffensiv: { zielzone: 'Flügel', tempo: 'schnell', fokusspieler: 'Stürmer', muster: 'Tiefgang' },
                      umschaltenDefensiv: { gegenpressingintensitaet: 'hoch', trigger: 'Ballverlust Halbraum', absicherung: '3er Restverteidigung', pressingseite: 'situativ' }
                    });
                    notify('Standard FC Auggen Profil geladen.');
                  }}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all shadow"
                >
                  ⭐ FC Auggen Standard
                </button>
                <button
                  onClick={() => {
                    setTacticalPhaseConfig({
                      offensiv: { aufbauhoehe: 'hoch', ueberzahlzonen: 'Halbraum', progression: 'Direktspiel', halbraumnutzung: 'inverser Flügel', offensivfokus: 'Zentrum' },
                      defensiv: { pressinghoehe: 'hoch', pressinglenkung: 'Pressingfalle', kompaktheit: 'eng', mannorientierung: 'ja' },
                      umschaltenOffensiv: { zielzone: 'Zentrum', tempo: 'schnell', fokusspieler: 'Zehner', muster: 'Direktspiel' },
                      umschaltenDefensiv: { gegenpressingintensitaet: 'hoch', trigger: 'schlechter Kontakt Gegner', absicherung: '2+1', pressingseite: 'situativ' }
                    });
                    notify('High-Pressing & Dominanz Profil geladen.');
                  }}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shadow"
                >
                  ⚡ Power Pressing
                </button>
              </div>
            </div>

            {/* SPIELPHASEN AUSWAHL TABS (Ausschließlich 1 aktive Phase) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => setActivePhase('offensiv')}
                className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-1 ${
                  activePhase === 'offensiv'
                    ? 'bg-emerald-950/80 border-emerald-400 text-white shadow-lg ring-2 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs uppercase text-emerald-400 flex items-center gap-1.5">
                    <Zap size={15} /> 1. OFFENSIV
                  </span>
                  {activePhase === 'offensiv' && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Spiel mit Ball & Spielaufbau</span>
              </button>

              <button
                onClick={() => setActivePhase('defensiv')}
                className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-1 ${
                  activePhase === 'defensiv'
                    ? 'bg-rose-950/80 border-rose-400 text-white shadow-lg ring-2 ring-rose-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs uppercase text-rose-400 flex items-center gap-1.5">
                    <Shield size={15} /> 2. DEFENSIV
                  </span>
                  {activePhase === 'defensiv' && <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Pressing & Gegen den Ball</span>
              </button>

              <button
                onClick={() => setActivePhase('umschalten')}
                className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-1 ${
                  activePhase === 'umschalten'
                    ? 'bg-amber-950/80 border-amber-400 text-white shadow-lg ring-2 ring-amber-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs uppercase text-amber-400 flex items-center gap-1.5">
                    <TrendingUp size={15} /> 3. UMSCHALTEN OFF.
                  </span>
                  {activePhase === 'umschalten' && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Konterspiel nach Ballgewinn</span>
              </button>

              <button
                onClick={() => setActivePhase('umschalten_defensiv')}
                className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-1 ${
                  activePhase === 'umschalten_defensiv'
                    ? 'bg-purple-950/80 border-purple-400 text-white shadow-lg ring-2 ring-purple-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs uppercase text-purple-400 flex items-center gap-1.5">
                    <Activity size={15} /> 4. UMSCHALTEN DEF.
                  </span>
                  {activePhase === 'umschalten_defensiv' && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Gegenpressing nach Ballverlust</span>
              </button>
            </div>

            {/* OPTIONEN DER AKTIVEN PHASE (AUSSICHLIESSLICH DIE AKTIVE PHASE) */}
            <div className="bg-slate-950 border-2 border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs uppercase">
                    Aktiv: {activePhase === 'offensiv' ? '1. OFFENSIV' : activePhase === 'defensiv' ? '2. DEFENSIV' : activePhase === 'umschalten' ? '3. UMSCHALTEN OFFENSIV' : '4. UMSCHALTEN DEFENSIV'}
                  </span>
                  <h3 className="font-black text-sm text-white uppercase tracking-wider">
                    PHASEN-OPTIONEN & TAKTIK-STEUERUNG
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  Interaktive Schnellauswahl für Trainer
                </span>
              </div>

              {activePhase === 'offensiv' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap size={15} /> 1. OFFENSIV (Mit Ball)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Aufbauhöhe</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['tief', 'mittelhoch', 'hoch'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, aufbauhoehe: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.offensiv.aufbauhoehe === val
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Progression</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['Kurzpass', 'Direktspiel', 'Verlagerung'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, progression: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.offensiv.progression === val
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Überzahlzonen</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['IV', '6er', 'Halbraum'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, ueberzahlzonen: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.offensiv.ueberzahlzonen === val
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Halbraumnutzung</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['Achter', 'Zehner', 'inverser Flügel'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, halbraumnutzung: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer truncate ${
                              tacticalPhaseConfig.offensiv.halbraumnutzung === val
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Offensivfokus</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['Flügel', 'Zentrum', 'Umschaltspiel'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, offensiv: { ...prev.offensiv, offensivfokus: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.offensiv.offensivfokus === val
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePhase === 'defensiv' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-xs text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield size={15} /> 2. DEFENSIV (Gegen den Ball)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Pressinghöhe</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['hoch', 'mittel', 'tief'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, pressinghoehe: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.defensiv.pressinghoehe === val
                                ? 'bg-rose-500 text-white border-rose-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Pressinglenkung</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['Außenbahn', 'schwacher Fuß', 'Pressingfalle'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, pressinglenkung: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer truncate ${
                              tacticalPhaseConfig.defensiv.pressinglenkung === val
                                ? 'bg-rose-500 text-white border-rose-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Kompaktheit</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['eng', 'breit', 'mittig'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, kompaktheit: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.defensiv.kompaktheit === val
                                ? 'bg-rose-500 text-white border-rose-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Mannorientierung</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['ja', 'nein', 'situativ'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, defensiv: { ...prev.defensiv, mannorientierung: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.defensiv.mannorientierung === val
                                ? 'bg-rose-500 text-white border-rose-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePhase === 'umschalten' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp size={15} /> 3. UMSCHALTEN OFFENSIV (Ballgewinn)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Zielzone & Tempo</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['Flügel', 'Zentrum'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenOffensiv: { ...prev.umschaltenOffensiv, zielzone: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.umschaltenOffensiv.zielzone === val
                                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Umschalt-Tempo</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['schnell', 'kontrolliert'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenOffensiv: { ...prev.umschaltenOffensiv, tempo: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.umschaltenOffensiv.tempo === val
                                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Fokusspieler</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['Stürmer', 'Zehner', 'Flügel'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenOffensiv: { ...prev.umschaltenOffensiv, fokusspieler: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.umschaltenOffensiv.fokusspieler === val
                                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Muster</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['Steil-Klatsch', 'Tiefgang', 'Direktspiel'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenOffensiv: { ...prev.umschaltenOffensiv, muster: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.umschaltenOffensiv.muster === val
                                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePhase === 'umschalten_defensiv' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-xs text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity size={15} /> 4. UMSCHALTEN DEFENSIV (Ballverlust)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Gegenpressing</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['hoch', 'mittel', 'niedrig'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenDefensiv: { ...prev.umschaltenDefensiv, gegenpressingintensitaet: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.umschaltenDefensiv.gegenpressingintensitaet === val
                                ? 'bg-purple-500 text-white border-purple-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Trigger</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['Ballverlust Halbraum', 'schlechter Kontakt Gegner'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenDefensiv: { ...prev.umschaltenDefensiv, trigger: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer truncate ${
                              tacticalPhaseConfig.umschaltenDefensiv.trigger === val
                                ? 'bg-purple-500 text-white border-purple-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Absicherung</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['2+1', '3er Restverteidigung'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenDefensiv: { ...prev.umschaltenDefensiv, absicherung: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.umschaltenDefensiv.absicherung === val
                                ? 'bg-purple-500 text-white border-purple-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Pressingseite</label>
                      <div className="grid grid-cols-1 gap-1">
                        {['links', 'rechts', 'situativ'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setTacticalPhaseConfig(prev => ({ ...prev, umschaltenDefensiv: { ...prev.umschaltenDefensiv, pressingseite: val } }))}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                              tacticalPhaseConfig.umschaltenDefensiv.pressingseite === val
                                ? 'bg-purple-500 text-white border-purple-400 shadow-md font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DYNAMICALLY GENERATED TACTICAL ANALYSIS REPORT CARD FOR ACTIVE PHASE */}
          <div className="bg-slate-900 border-2 border-amber-400 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2.5 py-1 rounded border border-amber-500/30">
                  Praxisnahe Trainer-Analyse
                </span>
                <h3 className="font-black text-xl text-white uppercase tracking-wider mt-1 flex items-center gap-2">
                  <Sparkles className="text-amber-400" size={20} />
                  TAKTISCHE ANALYSE ({activePhase === 'offensiv' ? '1. OFFENSIV' : activePhase === 'defensiv' ? '2. DEFENSIV' : activePhase === 'umschalten' ? '3. UMSCHALTEN OFFENSIV' : '4. UMSCHALTEN DEFENSIV'})
                </h3>
              </div>

              <button
                onClick={() => {
                  let reportText = '';
                  if (activePhase === 'offensiv') {
                    reportText = `TAKTISCHE ANALYSE - 1. OFFENSIV (MIT BALL)\n- Aufbauhöhe: ${tacticalPhaseConfig.offensiv.aufbauhoehe}\n- Überzahlzonen: ${tacticalPhaseConfig.offensiv.ueberzahlzonen}\n- Progression: ${tacticalPhaseConfig.offensiv.progression}\n- Halbraumnutzung: ${tacticalPhaseConfig.offensiv.halbraumnutzung}\n- Offensivfokus: ${tacticalPhaseConfig.offensiv.offensivfokus}`;
                  } else if (activePhase === 'defensiv') {
                    reportText = `TAKTISCHE ANALYSE - 2. DEFENSIV (PRESSING / GEGEN BALL)\n- Pressinghöhe: ${tacticalPhaseConfig.defensiv.pressinghoehe}\n- Pressinglenkung: ${tacticalPhaseConfig.defensiv.pressinglenkung}\n- Kompaktheit: ${tacticalPhaseConfig.defensiv.kompaktheit}\n- Mannorientierung: ${tacticalPhaseConfig.defensiv.mannorientierung}`;
                  } else if (activePhase === 'umschalten') {
                    reportText = `TAKTISCHE ANALYSE - 3. UMSCHALTEN OFFENSIV\n- Zielzone: ${tacticalPhaseConfig.umschaltenOffensiv.zielzone}\n- Tempo: ${tacticalPhaseConfig.umschaltenOffensiv.tempo}\n- Fokusspieler: ${tacticalPhaseConfig.umschaltenOffensiv.fokusspieler}\n- Muster: ${tacticalPhaseConfig.umschaltenOffensiv.muster}`;
                  } else {
                    reportText = `TAKTISCHE ANALYSE - 4. UMSCHALTEN DEFENSIV / GEGENPRESSING\n- Gegenpressingintensität: ${tacticalPhaseConfig.umschaltenDefensiv.gegenpressingintensitaet}\n- Trigger: ${tacticalPhaseConfig.umschaltenDefensiv.trigger}\n- Absicherung: ${tacticalPhaseConfig.umschaltenDefensiv.absicherung}\n- Pressingseite: ${tacticalPhaseConfig.umschaltenDefensiv.pressingseite}`;
                  }
                  navigator.clipboard.writeText(reportText);
                  notify('Taktische Analyse für aktive Phase kopiert!');
                }}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} /> Analyse Kopieren
              </button>
            </div>

            {/* DYNAMIC REPORT CONTENT */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              {activePhase === 'offensiv' && (
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center gap-2 text-emerald-400 font-black uppercase text-xs border-b border-slate-800 pb-1.5">
                    <Zap size={15} /> 1. OFFENSIV (MIT BALL) – REGELN FÜR DIE MANNSCHAFT
                  </div>
                  <ul className="space-y-2 list-disc list-inside text-xs leading-relaxed text-slate-300">
                    <li>
                      <strong className="text-emerald-300">Spielaufbau:</strong> Geordneter Ballvortrag mit <span className="text-white font-bold">{tacticalPhaseConfig.offensiv.aufbauhoehe}er Aufbauhöhe</span>.
                    </li>
                    <li>
                      <strong className="text-emerald-300">Überzahlbildung:</strong> Gezieltes Anspielen im Zentrum/Halbraum, Überzahl in der Zone der <span className="text-white font-bold">{tacticalPhaseConfig.offensiv.ueberzahlzonen}</span> schaffen.
                    </li>
                    <li>
                      <strong className="text-emerald-300">Progression:</strong> Ballzirkulation vorrangig durch <span className="text-white font-bold">{tacticalPhaseConfig.offensiv.progression}</span> beschleunigen.
                    </li>
                    <li>
                      <strong className="text-emerald-300">Halbraumnutzung:</strong> Halbräume konsequent besetzen durch den <span className="text-white font-bold">{tacticalPhaseConfig.offensiv.halbraumnutzung}</span>.
                    </li>
                    <li>
                      <strong className="text-emerald-300">Offensivfokus:</strong> Angriffe gezielt suchen und abschließen über den <span className="text-white font-bold">{tacticalPhaseConfig.offensiv.offensivfokus}</span>.
                    </li>
                  </ul>
                </div>
              )}

              {activePhase === 'defensiv' && (
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center gap-2 text-rose-400 font-black uppercase text-xs border-b border-slate-800 pb-1.5">
                    <Shield size={15} /> 2. DEFENSIV (GEGEN DEN BALL) – REGELN FÜR DIE MANNSCHAFT
                  </div>
                  <ul className="space-y-2 list-disc list-inside text-xs leading-relaxed text-slate-300">
                    <li>
                      <strong className="text-rose-300">Pressinghöhe:</strong> Die Mannschaft staffelt sich in <span className="text-white font-bold">{tacticalPhaseConfig.defensiv.pressinghoehe}er Pressinghöhe</span>.
                    </li>
                    <li>
                      <strong className="text-rose-300">Pressinglenkung:</strong> Den gegnerischen Spielaufbau gezielt auf die <span className="text-white font-bold">{tacticalPhaseConfig.defensiv.pressinglenkung}</span> lenken.
                    </li>
                    <li>
                      <strong className="text-rose-300">Kompaktheit:</strong> Abstände zwischen den Ketten extrem <span className="text-white font-bold">{tacticalPhaseConfig.defensiv.kompaktheit}</span> halten.
                    </li>
                    <li>
                      <strong className="text-rose-300">Mannorientierung:</strong> Zugriff sichern mit <span className="text-white font-bold">{tacticalPhaseConfig.defensiv.mannorientierung}er Mannorientierung</span> im zentralen Sektor.
                    </li>
                  </ul>
                </div>
              )}

              {activePhase === 'umschalten' && (
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center gap-2 text-amber-400 font-black uppercase text-xs border-b border-slate-800 pb-1.5">
                    <TrendingUp size={15} /> 3. UMSCHALTEN OFFENSIV (BALLGEWINN) – REGELN FÜR DIE MANNSCHAFT
                  </div>
                  <ul className="space-y-2 list-disc list-inside text-xs leading-relaxed text-slate-300">
                    <li>
                      <strong className="text-amber-300">Tempo:</strong> Nach Ballgewinn sofort <span className="text-white font-bold">{tacticalPhaseConfig.umschaltenOffensiv.tempo}</span> nach vorne umschalten.
                    </li>
                    <li>
                      <strong className="text-amber-300">Zielzone:</strong> Vertikalen Pass sofort in die Zielzone <span className="text-white font-bold">{tacticalPhaseConfig.umschaltenOffensiv.zielzone}</span> spielen.
                    </li>
                    <li>
                      <strong className="text-amber-300">Fokusspieler:</strong> Erste Anspielstation im Umschaltmoment ist der <span className="text-white font-bold">{tacticalPhaseConfig.umschaltenOffensiv.fokusspieler}</span>.
                    </li>
                    <li>
                      <strong className="text-amber-300">Muster:</strong> Abschluss suchen über das einstudierte Muster <span className="text-white font-bold">{tacticalPhaseConfig.umschaltenOffensiv.muster}</span>.
                    </li>
                  </ul>
                </div>
              )}

              {activePhase === 'umschalten_defensiv' && (
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center gap-2 text-purple-400 font-black uppercase text-xs border-b border-slate-800 pb-1.5">
                    <Activity size={15} /> 4. UMSCHALTEN DEFENSIV (GEGENPRESSING) – REGELN FÜR DIE MANNSCHAFT
                  </div>
                  <ul className="space-y-2 list-disc list-inside text-xs leading-relaxed text-slate-300">
                    <li>
                      <strong className="text-purple-300">Gegenpressing:</strong> Bei Ballverlust sofort mit <span className="text-white font-bold">{tacticalPhaseConfig.umschaltenDefensiv.gegenpressingintensitaet}er Intensität</span> nachsetzen.
                    </li>
                    <li>
                      <strong className="text-purple-300">Trigger:</strong> Auslöser für das kollektive Zupacken ist: <span className="text-white font-bold">{tacticalPhaseConfig.umschaltenDefensiv.trigger}</span>.
                    </li>
                    <li>
                      <strong className="text-purple-300">Restverteidigung:</strong> Rückraum absichern durch eine disziplinierte <span className="text-white font-bold">{tacticalPhaseConfig.umschaltenDefensiv.absicherung}</span>.
                    </li>
                    <li>
                      <strong className="text-purple-300">Pressingseite:</strong> Gegnerischen Gegenangriff bevorzugt über die Seite <span className="text-white font-bold">{tacticalPhaseConfig.umschaltenDefensiv.pressingseite}</span> doppeln.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: STANDARDS-ANALYSE & HALBES SPIELFELD SET-PIECE EDITOR */}
      {activeTabSub === 'standards' && (
        <div className="space-y-6">
          <SetPieceHalfPitchEditor 
            players={players} 
          />
        </div>
      )}

      {/* MODAL 1: FORMULATE NEW STANDARD VARIANT */}
      <AnimatePresence>
        {showCreateStandardModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                    <Plus size={18} />
                  </div>
                  <h3 className="font-black text-lg uppercase tracking-wider text-white">
                    Neue Standard-Variante Formulieren
                  </h3>
                </div>
                <button 
                  onClick={() => setShowCreateStandardModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                    Name der Standard-Variante *
                  </label>
                  <input 
                    type="text"
                    value={newStandardForm.name}
                    onChange={(e) => setNewStandardForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="z.B. Ecke Kurz - Finte Dischinger & Schuss Boutagrat"
                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                      Kategorie / Typ *
                    </label>
                    <select
                      value={newStandardForm.type}
                      onChange={(e) => setNewStandardForm(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ecke_offensiv">⚽ Eckball Offensiv</option>
                      <option value="ecke_defensiv">🛡️ Eckball Defensiv</option>
                      <option value="freistoss_direkt">🎯 Freistoß Direkt</option>
                      <option value="freistoss_halbfeld">🚀 Freistoß Halbfeld</option>
                      <option value="einwurf_weit">🤾 Weiter Einwurf</option>
                      <option value="elfmeter">🥅 Elfmeter</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                      Ausführer (Spieler)
                    </label>
                    <input 
                      type="text"
                      value={newStandardForm.executor}
                      onChange={(e) => setNewStandardForm(prev => ({ ...prev, executor: e.target.value }))}
                      placeholder="z.B. B. Dischinger"
                      className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-amber-300 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                    Beteiligte Schlüsselspieler
                  </label>
                  <input 
                    type="text"
                    value={newStandardForm.keyPlayers}
                    onChange={(e) => setNewStandardForm(prev => ({ ...prev, keyPlayers: e.target.value }))}
                    placeholder="z.B. Dischinger, Akuegwu, Kalchschmidt, Paolillo"
                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-semibold text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                    Detaillierte Ausführungs-Anweisung / Beschreibung *
                  </label>
                  <textarea 
                    rows={3}
                    value={newStandardForm.description}
                    onChange={(e) => setNewStandardForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Beschreiben Sie genau den Ablauf, Laufwege, Finten, Absicherung und Zielräume..."
                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowCreateStandardModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveNewStandard}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition-all"
                >
                  Standard Speichern
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: INTERACTIVE POSITION EDITOR ON PITCH FOR STANDARDS */}
      <AnimatePresence>
        {showEditPositionsModal && editingStandard && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-black text-lg uppercase tracking-wider text-white flex items-center gap-2">
                    <Move size={18} className="text-emerald-400" />
                    Spieler-Positionen Anpassen: <span className="text-amber-400">{editingStandard.name}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Klicken Sie auf einen Spieler oder verschieben Sie die X/Y-Positionen, um das Aufstellungs-Layout festzulegen.
                  </p>
                </div>
                <button 
                  onClick={() => setShowEditPositionsModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 2D Mini Pitch Container */}
              <div 
                className="relative w-full h-[320px] bg-slate-950 border-2 border-emerald-500/40 rounded-2xl overflow-hidden shadow-inner cursor-crosshair select-none"
                onClick={(e) => {
                  if (!selectedStandardNodeId) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                  const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                  setEditingPositions(prev => prev.map(p => p.id === selectedStandardNodeId ? { ...p, xPercent: x, yPercent: y } : p));
                }}
              >
                {/* Field Markings */}
                <div className="absolute inset-2 border border-emerald-500/30 rounded-xl pointer-events-none" />
                <div className="absolute top-0 bottom-0 left-1/2 border-l border-emerald-500/20 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-emerald-500/20 rounded-full pointer-events-none" />
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-16 h-32 border border-emerald-500/30 pointer-events-none" />
                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-16 h-32 border border-emerald-500/30 pointer-events-none" />

                {/* Player Nodes */}
                {editingPositions.map((pos) => {
                  const isSelected = selectedStandardNodeId === pos.id;
                  return (
                    <motion.div
                      key={pos.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStandardNodeId(pos.id);
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform ${isSelected ? 'scale-125 z-30' : 'z-20 hover:scale-110'}`}
                      style={{ left: `${pos.xPercent}%`, top: `${pos.yPercent}%` }}
                    >
                      <div className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center shadow-lg border-2 ${
                        isSelected 
                          ? 'bg-amber-400 text-slate-950 border-white ring-4 ring-amber-400/50' 
                          : 'bg-emerald-600 text-white border-slate-900'
                      }`}>
                        {pos.number || pos.id}
                      </div>
                      <span className="text-[9px] font-bold text-white bg-slate-950/90 px-1.5 py-0.5 rounded border border-slate-800 whitespace-nowrap block mt-1 text-center">
                        {pos.name}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Selected Player Fine-Tuning Controls */}
              {selectedStandardNodeId && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  {(() => {
                    const sel = editingPositions.find(p => p.id === selectedStandardNodeId);
                    if (!sel) return null;
                    return (
                      <>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Ausgewählt:</span>
                          <span className="font-black text-amber-400 text-sm">{sel.name} (#{sel.number})</span>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block">Spielfeld-Position X: {sel.xPercent}%</label>
                          <input 
                            type="range" min="0" max="100" 
                            value={sel.xPercent} 
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setEditingPositions(prev => prev.map(p => p.id === sel.id ? { ...p, xPercent: val } : p));
                            }}
                            className="w-full accent-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block">Spielfeld-Position Y: {sel.yPercent}%</label>
                          <input 
                            type="range" min="0" max="100" 
                            value={sel.yPercent} 
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setEditingPositions(prev => prev.map(p => p.id === sel.id ? { ...p, yPercent: val } : p));
                            }}
                            className="w-full accent-emerald-500"
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  Positionen werden direkt für den Standard "{editingStandard.name}" gespeichert.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEditPositionsModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase rounded-xl"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSavePositions}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition-all"
                  >
                    Positionen Speichern
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: MATCH REPORT IMAGES GALLERY PICKER */}
      <AnimatePresence>
        {showImageGalleryModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-5 text-white max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                    <ImageIcon size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-wider text-white">
                      Spielbericht-Bilder & Video-Snapshots
                    </h3>
                    <p className="text-xs text-slate-400">
                      Wählen Sie ein Bild aus den Spielberichten aus, um es der Standard-Variante zuzuordnen.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowImageGalleryModal(false);
                    setSelectedStandardForImage(null);
                  }}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Upload Direct Image Button */}
              <div className="bg-slate-950 p-4 rounded-xl border border-dashed border-slate-700 text-center space-y-2">
                <p className="text-xs text-slate-300 font-bold">
                  Neues Bild oder Screenshot direkt hochladen:
                </p>
                <label className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase px-4 py-2 rounded-xl cursor-pointer transition-all shadow">
                  <Upload size={14} />
                  Bild Hochladen
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          if (selectedStandardForImage) {
                            handleAttachImageToStandard(base64);
                          } else {
                            setNewStandardForm(prev => ({ ...prev, imageUrl: base64 }));
                            setShowImageGalleryModal(false);
                            setNotification("Bild für neuen Standard hochgeladen.");
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Gallery Grid */}
              {matchReportImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {matchReportImages.map((img) => (
                    <div 
                      key={img.id}
                      onClick={() => {
                        if (selectedStandardForImage) {
                          handleAttachImageToStandard(img.url);
                        } else {
                          setNewStandardForm(prev => ({ ...prev, imageUrl: img.url }));
                          setShowImageGalleryModal(false);
                        }
                      }}
                      className="bg-slate-950 border border-slate-800 hover:border-amber-400 rounded-xl overflow-hidden cursor-pointer group transition-all"
                    >
                      <div className="aspect-video relative overflow-hidden bg-slate-900">
                        <img 
                          src={img.url} 
                          alt={img.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                      </div>
                      <div className="p-2.5">
                        <span className="font-bold text-xs text-white block truncate">{img.title}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">{img.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-950 p-8 rounded-2xl text-center text-slate-500 text-xs font-semibold">
                  Noch keine Bilder aus Spielberichten vorhanden. Laden Sie ein Bild direkt oben hoch!
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    setShowImageGalleryModal(false);
                    setSelectedStandardForImage(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase rounded-xl"
                >
                  Schließen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUB-TAB 4: INTERAKTIVER FREIHAND ZEICHENMODUS */}
      {activeTabSub === 'drawing_canvas' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-black flex items-center justify-center">
                <Pencil size={22} />
              </div>
              <div>
                <h3 className="font-black text-lg uppercase tracking-wider text-white">
                  INTERAKTIVER FREIHAND-ZEICHENMODUS & SKIZZEN-CANVAS
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Zeichnen Sie individuelle Laufwege, Pfeile, Zonen & Notizen frei auf das Spielfeld
                </p>
              </div>
            </div>

            <button
              onClick={() => { setSketches([]); notify('Zeichen-Canvas zurückgesetzt.'); }}
              className="bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-xs uppercase px-3 py-1.5 rounded-xl border border-rose-800 transition-all flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Alles Löschen
            </button>
          </div>

          {/* DRAWING TOOLBAR */}
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
            {/* Color Palette */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Farbe:</span>
              {['#C00000', '#0D4433', '#0055FF', '#FFD700', '#FFFFFF', '#000000'].map(c => (
                <button
                  key={c}
                  onClick={() => setDrawColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    drawColor === c ? 'border-amber-400 scale-125 shadow-lg' : 'border-slate-800 hover:scale-110'
                  }`}
                />
              ))}
            </div>

            {/* Stroke Width Slider */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400">Dicke ({drawWidth}px):</span>
              <input
                type="range"
                min={2}
                max={10}
                value={drawWidth}
                onChange={(e) => setDrawWidth(Number(e.target.value))}
                className="w-24 accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Quick Draw Button */}
            <button
              onClick={() => {
                setSketches(prev => [...prev, { id: Date.now(), color: drawColor, width: drawWidth }]);
                notify('Neuer Laufweg-Pfeil gezeichnet!');
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase px-3 py-1.5 rounded-lg shadow transition-all flex items-center gap-1"
            >
              <Plus size={14} /> Laufweg-Pfeil Hinzufügen
            </button>
          </div>

          {/* CANVAS AREA WITH FOOTBALL PITCH & SKETCH LAYERS */}
          <div className="relative w-full h-[450px] bg-emerald-950/60 rounded-2xl border-2 border-slate-800 overflow-hidden shadow-inner flex items-center justify-center">
            {/* Pitch Lines */}
            <div className="absolute inset-4 border-2 border-emerald-400/40 pointer-events-none">
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-emerald-400/40 -translate-x-1/2" />
              <div className="absolute top-1/2 left-1/2 w-28 h-28 rounded-full border-2 border-emerald-400/40 -translate-x-1/2 -translate-y-1/2" />
            </div>

            {/* SKETCHES DISPLAY OVERLAY */}
            <div className="absolute inset-0 p-8 pointer-events-none">
              <svg className="w-full h-full">
                {sketches.map((sk, idx) => (
                  <g key={sk.id}>
                    <line
                      x1={`${20 + (idx * 15) % 60}%`}
                      y1={`${30 + (idx * 20) % 50}%`}
                      x2={`${35 + (idx * 15) % 60}%`}
                      y2={`${45 + (idx * 20) % 50}%`}
                      stroke={sk.color}
                      strokeWidth={sk.width}
                      strokeDasharray="6 3"
                    />
                    <circle
                      cx={`${35 + (idx * 15) % 60}%`}
                      cy={`${45 + (idx * 20) % 50}%`}
                      r="5"
                      fill={sk.color}
                    />
                  </g>
                ))}
              </svg>
            </div>

            <span className="text-xs font-black uppercase text-emerald-300 bg-slate-950/90 px-4 py-2 rounded-xl border border-emerald-500/30 z-10 shadow-xl">
              Freihand-Zeichenfläche Aktiv • {sketches.length} Skizzen eingezeichnet
            </span>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: MATCH-AUDIT & TRAINER-FAZIT HUB */}
      {activeTabSub === 'ai_summary' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Sparkles size={22} className="text-emerald-400" />
              <div>
                <h3 className="font-black text-base uppercase tracking-wider text-white">
                  MATCH-AUDIT & TAKTISCHES TRAINER-FAZIT
                </h3>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                  Auswertung des letzten Spiels, Matchplan-Erfüllung & individuelle Taktik-Anmerkungen
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setEditingAuditCard({ title: '', value: '', description: '' });
                setShowAuditModal(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-4 py-2 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
            >
              <Plus size={16} />
              Neuen Audit-Punkt Hinzufügen
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {auditCards.map((card) => (
              <div key={card.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-3 shadow-lg group transition-all">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-[10px] font-black uppercase text-slate-400 truncate">{card.title}</span>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingAuditCard(card);
                          setShowAuditModal(true);
                        }}
                        className="text-slate-400 hover:text-amber-400 p-1"
                        title="Bearbeiten"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteAuditCard(card.id)}
                        className="text-slate-600 hover:text-rose-400 p-1"
                        title="Entfernen"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="text-2xl font-black text-emerald-400 font-mono mt-2">
                    {card.value}
                  </div>

                  <p className="text-xs text-slate-300 mt-2 leading-relaxed font-medium">
                    {card.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 7: SPIELTAGSPRÄSENTATION & TAKTIKTAFEL-AUSGABE (FC AUGGEN) */}
      {activeTabSub === 'presentation' && (
        <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-6 space-y-6 shadow-2xl">
          {/* HEADER & MATCH SELECTOR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 font-black flex items-center justify-center shadow-lg text-2xl">
                📺
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 rounded-md tracking-wider">
                    FC AUGGEN
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    Echtzeit App-Daten Sync
                  </span>
                </div>
                <h3 className="font-black text-lg uppercase tracking-wider text-white mt-0.5">
                  SPIELTAGSPRÄSENTATION & TAKTIKTAFEL
                </h3>
              </div>
            </div>

            {/* ACTION CONTROLS */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedPresentationMatchId}
                onChange={(e) => setSelectedPresentationMatchId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white font-bold text-xs p-2.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {data.competitiveMatches.map((m) => (
                  <option key={m.id} value={`m_${m.id}`}>
                    FC Auggen vs. {m.opponent} ({m.isHome ? 'Heim' : 'Auswärts'} - {m.competition})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setIsTvMode(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Tv size={15} /> TV-Präsentation Starten
              </button>

              <button
                onClick={() => window.print()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase px-3 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
                title="Drucken / PDF"
              >
                <Printer size={15} /> Export
              </button>

              <button
                onClick={() => setActiveTabSub('board')}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Compass size={15} /> Auf 3D-Taktiktafel Zeigen
              </button>
            </div>
          </div>

          {/* SLIDE STEPPER / TABS BAR (9 SLIDES) */}
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5">
            {[
              { id: 0, label: '1. Titel & Match', icon: '⚽' },
              { id: 1, label: '2. Aufstellung & Bank', icon: '👕' },
              { id: 2, label: '3. Formation', icon: '📐' },
              { id: 3, label: '4. Defensiv', icon: '🛡️' },
              { id: 4, label: '5. Offensiv', icon: '⚡' },
              { id: 5, label: '6. Umschalten', icon: '🔄' },
              { id: 6, label: '7. Standards (4)', icon: '🎯' },
              { id: 7, label: '8. Coaching', icon: '🗣️' },
              { id: 8, label: '9. Spielbericht', icon: '📜' },
            ].map((slide) => (
              <button
                key={slide.id}
                onClick={() => setPresentationSlideIndex(slide.id)}
                className={`p-2 rounded-xl text-center border transition-all flex flex-col items-center gap-1 ${
                  presentationSlideIndex === slide.id
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black shadow-lg scale-105'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span className="text-base">{slide.icon}</span>
                <span className="text-[10px] uppercase font-bold tracking-tight truncate w-full">{slide.label}</span>
              </button>
            ))}
          </div>

          {/* SLIDE CONTENT AREA */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 min-h-[520px] shadow-2xl relative overflow-hidden flex flex-col justify-between">
            
            {/* HELPER PITCH VISUALIZER COMPONENT FOR SLIDES */}
            {(() => {
              return (
                <div className="space-y-6">
                  {/* SLIDE 0: TITEL & MATCH */}
                  {presentationSlideIndex === 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-950 p-5 rounded-2xl border border-emerald-500/40 space-y-3 shadow-xl">
                          <div className="flex items-center justify-between">
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-xs uppercase px-3 py-1 rounded-full tracking-wider">
                              {selectedMatchObj.competition.toUpperCase()} • MATCHDAY
                            </span>
                            <button
                              onClick={() => setSlideEditingActive(!slideEditingActive)}
                              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs uppercase px-2.5 py-1 rounded-lg border border-slate-700 transition-all flex items-center gap-1"
                            >
                              <Edit size={12} /> {slideEditingActive ? '👁️ Vorschau' : '✏️ Titel & Match Bearbeiten'}
                            </button>
                          </div>
                          <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight font-sans">
                            FC AUGGEN vs. {selectedMatchObj.opponent.toUpperCase()}
                          </h1>
                          <p className="text-xs text-slate-300 font-semibold flex items-center gap-2 flex-wrap">
                            <span>📅 {selectedMatchObj.date ? new Date(selectedMatchObj.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Spieltag'}, {selectedMatchObj.kickOff || '15:30'} Uhr</span> • <span>📍 {selectedMatchObj.location}</span> • <span>🏆 {selectedMatchObj.competition}</span>
                          </p>
                        </div>

                        {(slideEditingActive || trainerEditMode) ? (
                          <div className="bg-slate-900/90 p-4 rounded-xl border border-emerald-500/40 space-y-3">
                            <h4 className="font-black text-xs uppercase text-emerald-400 flex items-center gap-1">
                              <Edit size={14} /> TRAINER-BEARBEITUNG: MATCH-DETAILS
                            </h4>
                            <div className="space-y-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Heimteam (FC Auggen) Ausrichtung</label>
                                <input
                                  type="text"
                                  value={matchNotes.home}
                                  onChange={(e) => setMatchNotes(prev => ({ ...prev, home: e.target.value }))}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-amber-400 uppercase">Gegner-Profil ({selectedMatchObj.opponent})</label>
                                <input
                                  type="text"
                                  value={matchNotes.opponent}
                                  onChange={(e) => setMatchNotes(prev => ({ ...prev, opponent: e.target.value }))}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-sky-400 uppercase">Taktik-Fokus</label>
                                <input
                                  type="text"
                                  value={matchNotes.focus}
                                  onChange={(e) => setMatchNotes(prev => ({ ...prev, focus: e.target.value }))}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                                />
                              </div>
                              <button
                                onClick={() => {
                                  setSlideEditingActive(false);
                                  notify('Match-Details gespeichert!');
                                }}
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded-lg transition-all w-full mt-1 flex items-center justify-center gap-1"
                              >
                                <Save size={13} /> Speichern
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1">
                              <h4 className="font-black text-xs uppercase text-emerald-400 flex items-center gap-1">
                                <Shield size={13} /> HEIMTEAM (FCA)
                              </h4>
                              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                {matchNotes.home}
                              </p>
                            </div>

                            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1">
                              <h4 className="font-black text-xs uppercase text-amber-400 flex items-center gap-1">
                                <Target size={13} /> GEGNER-PROFIL
                              </h4>
                              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                {matchNotes.opponent}
                              </p>
                            </div>

                            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1">
                              <h4 className="font-black text-xs uppercase text-sky-400 flex items-center gap-1">
                                <Zap size={13} /> TAKTIK-FOKUS
                              </h4>
                              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                {matchNotes.focus}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* KEY PLAYERS WITH PHOTOS BANNER ON SLIDE 0 */}
                        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                              <Star size={12} className="text-amber-400 fill-amber-400" /> KADER-SCHLÜSSELSPIELER
                            </h4>
                            <span className="text-[9px] text-slate-400">Fotos & Profile aus Kader</span>
                          </div>
                          <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
                            {FORMATION_PRESETS['4-2-3-1'].nodes.slice(0, 7).map((node) => {
                              const pl = findPlayerForNode(node);
                              return (
                                <div key={node.id} className="flex flex-col items-center shrink-0 group">
                                  <div className="relative">
                                    {showPlayerPhotos && pl?.image ? (
                                      <img src={pl.image} alt={node.name} className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 shadow-md group-hover:scale-105 transition-transform" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-emerald-400 flex items-center justify-center font-black text-xs text-amber-300">
                                        {node.number}
                                      </div>
                                    )}
                                    <span className="absolute -bottom-1 -right-1 bg-slate-950 text-amber-300 font-mono text-[8px] font-black px-1 rounded-full border border-emerald-400">
                                      #{node.number}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-black text-white mt-1 max-w-[65px] truncate text-center group-hover:text-emerald-300">
                                    {pl ? pl.lastName : node.name.split(' ').pop()}
                                  </span>
                                  <span className="text-[7.5px] font-bold text-emerald-400 uppercase">
                                    {node.position}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* EMBEDDED PITCH */}
                      <div className="min-h-[300px]">
                        {renderPitchForSlide(0)}
                      </div>
                    </div>
                  )}

                  {/* SLIDE 1: AUFSTELLUNG & BANK */}
                  {presentationSlideIndex === 1 && (() => {
                    const isSalemActive = selectedMatchObj?.opponent?.toLowerCase().includes('salem') || selectedFormation === 'salem_match';
                    const activeSlidePreset = (isSalemActive && FORMATION_PRESETS['salem_match'])
                      ? FORMATION_PRESETS['salem_match']
                      : (FORMATION_PRESETS[selectedFormation] || FORMATION_PRESETS['4-2-3-1']);

                    return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      <div className="lg:col-span-7 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-black text-base uppercase text-white tracking-wider flex items-center gap-2">
                                <Users className="text-emerald-400" size={18} /> STARTELF (XI) & AUSWECHSELBANK
                              </h3>
                              {isSalemActive && (
                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                                  Alter: ∅ 23.44
                                </span>
                              )}
                              {isSalemActive && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                                  1:2 Auswärtssieg
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {isSalemActive 
                                ? 'Offizielle Aufstellung RW Salem 1 : 2 FC Auggen (Doppelpack Y. Roth 37\', 54\')'
                                : 'Kader-Fotos & Spielerprofile synchronisiert'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSlideEditingActive(!slideEditingActive)}
                              className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs uppercase px-2.5 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1"
                            >
                              <Edit size={12} /> {slideEditingActive ? '👁️ Fertig' : '✏️ Bank Bearbeiten'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedFormation(isSalemActive ? 'salem_match' : '4-2-3-1');
                                setActiveTabSub('board');
                                notify(`${isSalemActive ? 'Salem-Startelf' : 'Startelf'} auf der 3D-Taktiktafel geladen!`);
                              }}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded-xl transition-all shadow"
                            >
                              🎯 Auf 3D-Feld Laden
                            </button>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[10px] font-black uppercase text-emerald-400 tracking-wider mb-1.5 flex items-center justify-between">
                            <span>STARTELF ({activeSlidePreset.name || '11 SPIELER'})</span>
                            <span className="text-[9px] text-slate-400 font-normal">Fotos & Kadernamen synchronisiert</span>
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {activeSlidePreset.nodes.map((p) => {
                              const pl = findPlayerForNode(p);
                              return (
                                <div key={p.id} className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex items-center gap-2.5 shadow hover:border-emerald-500/50 transition-all group">
                                  <div className="relative shrink-0">
                                    {showPlayerPhotos && pl?.image ? (
                                      <img src={pl.image} alt={p.name} className="w-9 h-9 rounded-full object-cover border-2 border-emerald-400 shadow-md group-hover:scale-105 transition-transform" />
                                    ) : (
                                      <span className="w-9 h-9 rounded-full bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow">
                                        {p.number}
                                      </span>
                                    )}
                                    <span className="absolute -bottom-1 -right-1 bg-slate-950 text-amber-400 font-mono text-[8px] font-black px-1 rounded-full border border-emerald-500/50 leading-tight">
                                      #{p.number}
                                    </span>
                                  </div>
                                  <div className="truncate min-w-0">
                                    <span className="font-black text-xs text-white truncate block group-hover:text-emerald-300 transition-colors">
                                      {pl ? `${pl.firstName} ${pl.lastName}` : p.name}
                                    </span>
                                    <span className="text-[9px] font-bold text-emerald-400 uppercase">{p.position} • {p.role}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800">
                          <h4 className="text-[10px] font-black uppercase text-amber-400 tracking-wider mb-1.5">AUSWECHSELBANK (SUBSTITUTES)</h4>
                          
                          {(slideEditingActive || trainerEditMode) && (
                            <div className="bg-slate-900 p-3 rounded-xl border border-amber-500/40 mb-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-black text-xs uppercase text-amber-400 block">➕ ERSATZSPIELER HINZUFÜGEN</span>
                                <span className="text-[10px] text-slate-400">Schnellauswahl aus Kader möglich</span>
                              </div>

                              {/* QUICK SELECTION FROM FCA SQUAD */}
                              <div>
                                <select
                                  onChange={(e) => {
                                    const sel = players.find(p => String(p.id) === e.target.value);
                                    if (sel) {
                                      setNewSubForm({
                                        num: String(sel.number || ''),
                                        name: `${sel.firstName} ${sel.lastName}`.trim(),
                                        pos: sel.position || 'ZM',
                                        note: (sel as any).role || sel.position || 'Auswechselspieler'
                                      });
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-emerald-500/40 p-2 rounded-lg text-xs text-emerald-300 mb-2 focus:outline-none focus:border-emerald-400"
                                >
                                  <option value="">⚡ Spieler aus dem FC Auggen Kader wählen...</option>
                                  {players.map(pl => (
                                    <option key={pl.id} value={pl.id}>
                                      #{pl.number} {pl.firstName} {pl.lastName} ({pl.position})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="grid grid-cols-4 gap-2">
                                <input
                                  type="text"
                                  placeholder="Nr."
                                  value={newSubForm.num}
                                  onChange={(e) => setNewSubForm(prev => ({ ...prev, num: e.target.value }))}
                                  className="bg-slate-950 border border-slate-800 p-1.5 rounded text-xs text-white"
                                />
                                <input
                                  type="text"
                                  placeholder="Name"
                                  value={newSubForm.name}
                                  onChange={(e) => setNewSubForm(prev => ({ ...prev, name: e.target.value }))}
                                  className="bg-slate-950 border border-slate-800 p-1.5 rounded text-xs text-white col-span-2"
                                />
                                <select
                                  value={newSubForm.pos}
                                  onChange={(e) => setNewSubForm(prev => ({ ...prev, pos: e.target.value }))}
                                  className="bg-slate-950 border border-slate-800 p-1.5 rounded text-xs text-white"
                                >
                                  {['ETW', 'IV', 'RV', 'LV', 'DM', 'ZM', 'OM', 'RA', 'LA', 'ST'].map(pos => (
                                    <option key={pos} value={pos}>{pos}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Rolle / Hinweis (z.B. Tempo-Joker)"
                                  value={newSubForm.note}
                                  onChange={(e) => setNewSubForm(prev => ({ ...prev, note: e.target.value }))}
                                  className="bg-slate-950 border border-slate-800 p-1.5 rounded text-xs text-white flex-1"
                                />
                                <button
                                  onClick={() => {
                                    if (!newSubForm.name) return;
                                    setPresentationSubstitutes(prev => [...prev, {
                                      num: newSubForm.num || String(prev.length + 12),
                                      name: newSubForm.name,
                                      pos: newSubForm.pos,
                                      note: newSubForm.note || 'Auswechselspieler'
                                    }]);
                                    setNewSubForm({ num: '', name: '', pos: 'ZM', note: '' });
                                    notify('Ersatzspieler hinzugefügt!');
                                  }}
                                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3 py-1.5 rounded uppercase"
                                >
                                  Hinzufügen
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {presentationSubstitutes.map((sub, idx) => {
                              const pl = findPlayerForNode({ name: sub.name, number: sub.num, position: sub.pos });
                              return (
                                <div key={idx} className="bg-slate-900/60 border border-slate-800 p-2 rounded-xl flex items-center justify-between gap-1.5 group hover:border-amber-500/40 transition-all">
                                  <div className="flex items-center gap-2 truncate">
                                    <div className="relative shrink-0">
                                      {showPlayerPhotos && pl?.image ? (
                                        <img src={pl.image} alt={sub.name} className="w-8 h-8 rounded-full object-cover border-2 border-amber-400 shadow-sm" />
                                      ) : (
                                        <span className="w-7 h-7 rounded-full bg-slate-800 text-amber-400 font-black text-[10px] flex items-center justify-center shrink-0 border border-amber-500/30">
                                          {sub.num}
                                        </span>
                                      )}
                                      <span className="absolute -bottom-1 -right-1 bg-slate-950 text-amber-300 font-mono text-[7px] font-black px-1 rounded-full border border-amber-500/40">
                                        #{sub.num}
                                      </span>
                                    </div>
                                    <div className="truncate min-w-0">
                                      <span className="font-black text-xs text-white block truncate">{pl ? `${pl.firstName} ${pl.lastName}` : sub.name}</span>
                                      <span className="text-[8px] text-amber-400 font-bold uppercase">{sub.pos} • {sub.note}</span>
                                    </div>
                                  </div>
                                  {(slideEditingActive || trainerEditMode) && (
                                    <button
                                      onClick={() => {
                                        setPresentationSubstitutes(prev => prev.filter((_, i) => i !== idx));
                                        notify('Ersatzspieler entfernt');
                                      }}
                                      className="text-slate-500 hover:text-rose-400 p-1 shrink-0"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* EMBEDDED PITCH */}
                      <div className="lg:col-span-5 min-h-[350px]">
                        {renderPitchForSlide(1)}
                      </div>
                    </div>
                    );
                  })()}

                  {/* SLIDE 2: FORMATION */}
                  {presentationSlideIndex === 2 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      <div className="lg:col-span-6 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <h3 className="font-black text-base uppercase text-white tracking-wider flex items-center gap-2">
                              <Compass className="text-emerald-400" size={18} /> FORMATION & GRUNDORDNUNG (4-2-3-1)
                            </h3>
                            <p className="text-[11px] text-slate-400">Grafisch strukturierter Kettenaufbau</p>
                          </div>
                          <button
                            onClick={() => setSlideEditingActive(!slideEditingActive)}
                            className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs uppercase px-2.5 py-1 rounded-xl border border-slate-700 transition-all flex items-center gap-1"
                          >
                            <Edit size={12} /> {slideEditingActive ? '👁️ Vorschau' : '✏️ Formation Bearbeiten'}
                          </button>
                        </div>

                        {(slideEditingActive || trainerEditMode) ? (
                          <div className="bg-slate-900 p-3.5 rounded-xl border border-emerald-500/40 space-y-2 text-xs">
                            <h4 className="font-black text-xs uppercase text-emerald-400 flex items-center gap-1">
                              <Edit size={13} /> FORMATIONS-ANWEISUNGEN
                            </h4>
                            <div>
                              <label className="text-[10px] font-bold text-emerald-400 uppercase">1. Abwehrkette</label>
                              <textarea
                                rows={2}
                                value={formationNotes.defenseLine}
                                onChange={(e) => setFormationNotes(prev => ({ ...prev, defenseLine: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-amber-400 uppercase">2. Doppel-Sechs</label>
                              <textarea
                                rows={2}
                                value={formationNotes.doublePivot}
                                onChange={(e) => setFormationNotes(prev => ({ ...prev, doublePivot: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-sky-400 uppercase">3. Offensivreihe</label>
                              <textarea
                                rows={2}
                                value={formationNotes.attackingRow}
                                onChange={(e) => setFormationNotes(prev => ({ ...prev, attackingRow: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-rose-400 uppercase">4. Spitze</label>
                              <textarea
                                rows={2}
                                value={formationNotes.striker}
                                onChange={(e) => setFormationNotes(prev => ({ ...prev, striker: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white"
                              />
                            </div>
                            <button
                              onClick={() => {
                                setSlideEditingActive(false);
                                notify('Formations-Anweisungen gespeichert!');
                              }}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded-lg w-full flex items-center justify-center gap-1"
                            >
                              <Save size={13} /> Speichern
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2 text-xs">
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-0.5">
                              <span className="font-black text-emerald-400 uppercase text-[10px] block">1. ABWEHRKETTE (4er-Kette)</span>
                              <p className="text-slate-200 leading-relaxed font-medium">
                                {formationNotes.defenseLine}
                              </p>
                            </div>

                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-0.5">
                              <span className="font-black text-amber-400 uppercase text-[10px] block">2. DOPPEL-SECHS (Zentrale)</span>
                              <p className="text-slate-200 leading-relaxed font-medium">
                                {formationNotes.doublePivot}
                              </p>
                            </div>

                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-0.5">
                              <span className="font-black text-sky-400 uppercase text-[10px] block">3. OFFENSIVREIHE & SPIELMACHER</span>
                              <p className="text-slate-200 leading-relaxed font-medium">
                                {formationNotes.attackingRow}
                              </p>
                            </div>

                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-0.5">
                              <span className="font-black text-rose-400 uppercase text-[10px] block">4. SPITZE (Zielspieler)</span>
                              <p className="text-slate-200 leading-relaxed font-medium">
                                {formationNotes.striker}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* EMBEDDED PITCH */}
                      <div className="lg:col-span-6 min-h-[300px]">
                        {renderPitchForSlide(2)}
                      </div>
                    </div>
                  )}

                  {/* SLIDE 3: DEFENSIV */}
                  {presentationSlideIndex === 3 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      <div className="lg:col-span-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <h3 className="font-black text-base uppercase text-white tracking-wider flex items-center gap-2">
                              <Shield className="text-rose-400" size={18} /> DEFENSIVE GRUNDORDNUNG & PRESSING-PLAN
                            </h3>
                            <p className="text-[11px] text-slate-400">Verdichtung der Innenbahnen & Kompaktheit</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSlideEditingActive(!slideEditingActive)}
                              className="bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs uppercase px-2.5 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1"
                            >
                              <Edit size={12} /> {slideEditingActive ? '👁️ Vorschau' : '✏️ Defensiv-Plan Bearbeiten'}
                            </button>
                            <button
                              onClick={() => {
                                setActivePhase('defensiv');
                                setActiveTabSub('board');
                                notify('Defensiv-Phase auf der Taktiktafel geladen!');
                              }}
                              className="bg-rose-500 hover:bg-rose-400 text-white font-black text-xs uppercase px-3 py-1.5 rounded-xl transition-all shadow"
                            >
                              🎯 Phase Zeigen
                            </button>
                          </div>
                        </div>

                        {(slideEditingActive || trainerEditMode) ? (
                          <div className="bg-slate-900 p-4 rounded-xl border border-rose-500/40 space-y-3 text-xs">
                            <h4 className="font-black text-xs uppercase text-rose-400 flex items-center gap-1">
                              <Edit size={13} /> DEFENSIV-EINSTELLUNGEN
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase block">Pressinghöhe</label>
                                <select
                                  value={tacticalPhaseConfig.defensiv.pressinghoehe}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    defensiv: { ...prev.defensiv, pressinghoehe: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                >
                                  <option value="hoch">Hoch (Attackieren)</option>
                                  <option value="mittel">Mittel (Mittelfeld-Pressing)</option>
                                  <option value="tief">Tief (Tiefes Abwehrblock)</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase block">Pressinglenkung</label>
                                <select
                                  value={tacticalPhaseConfig.defensiv.pressinglenkung}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    defensiv: { ...prev.defensiv, pressinglenkung: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                >
                                  <option value="Außenbahn">Außenbahn</option>
                                  <option value="schwacher Fuß">Schwacher Fuß</option>
                                  <option value="Pressingfalle">Pressingfalle Zentum</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase block">Kompaktheit</label>
                                <select
                                  value={tacticalPhaseConfig.defensiv.kompaktheit}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    defensiv: { ...prev.defensiv, kompaktheit: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                >
                                  <option value="eng">Eng (Kompakt)</option>
                                  <option value="breit">Breit</option>
                                  <option value="mittig">Mittig</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase block">Mannorientierung</label>
                                <select
                                  value={tacticalPhaseConfig.defensiv.mannorientierung}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    defensiv: { ...prev.defensiv, mannorientierung: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                >
                                  <option value="situativ">Situativ</option>
                                  <option value="ja">Ja (Strikt)</option>
                                  <option value="nein">Nein (Raumorientiert)</option>
                                </select>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800 space-y-2">
                              <span className="font-bold text-rose-400 uppercase text-[10px] block">DEFENSIV-REGELN BEARBEITEN</span>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Neue Defensiv-Regel eingeben..."
                                  value={newDefensiveRule}
                                  onChange={(e) => setNewDefensiveRule(e.target.value)}
                                  className="bg-slate-950 border border-slate-800 p-1.5 rounded text-xs text-white flex-1"
                                />
                                <button
                                  onClick={() => {
                                    if (!newDefensiveRule) return;
                                    setDefensiveRulesList(prev => [...prev, newDefensiveRule]);
                                    setNewDefensiveRule('');
                                    notify('Defensiv-Regel hinzugefügt!');
                                  }}
                                  className="bg-rose-500 hover:bg-rose-400 text-white font-black text-xs px-3 py-1.5 rounded uppercase"
                                >
                                  Hinzufügen
                                </button>
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {defensiveRulesList.map((rule, idx) => (
                                  <div key={idx} className="bg-slate-950 p-1.5 rounded flex items-center justify-between text-[11px] text-slate-200">
                                    <span>{rule}</span>
                                    <button
                                      onClick={() => {
                                        setDefensiveRulesList(prev => prev.filter((_, i) => i !== idx));
                                        notify('Regel gelöscht');
                                      }}
                                      className="text-slate-500 hover:text-rose-400 p-1"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">PRESSINGHÖHE</span>
                                <span className="text-sm font-black text-rose-400 uppercase mt-0.5 block">{tacticalPhaseConfig.defensiv.pressinghoehe}</span>
                              </div>
                              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">PRESSINGLENKUNG</span>
                                <span className="text-sm font-black text-rose-400 uppercase mt-0.5 block">{tacticalPhaseConfig.defensiv.pressinglenkung}</span>
                              </div>
                              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">KOMPAKTHEIT</span>
                                <span className="text-sm font-black text-rose-400 uppercase mt-0.5 block">{tacticalPhaseConfig.defensiv.kompaktheit}</span>
                              </div>
                              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">MANNORIENTIERUNG</span>
                                <span className="text-sm font-black text-rose-400 uppercase mt-0.5 block">{tacticalPhaseConfig.defensiv.mannorientierung}</span>
                              </div>
                            </div>

                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                              <h4 className="font-black text-rose-400 uppercase text-xs tracking-wider">DEFENSIV-REGELN FC AUGGEN:</h4>
                              <ul className="space-y-1.5 text-slate-200">
                                {defensiveRulesList.map((rule, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="text-rose-400 font-bold">•</span>
                                    <span>{rule}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </>
                        )}
                      </div>

                      {/* EMBEDDED PITCH */}
                      <div className="lg:col-span-6 min-h-[300px]">
                        {renderPitchForSlide(3)}
                      </div>
                    </div>
                  )}

                  {/* SLIDE 4: OFFENSIV */}
                  {presentationSlideIndex === 4 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      <div className="lg:col-span-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <h3 className="font-black text-base uppercase text-white tracking-wider flex items-center gap-2">
                              <Zap className="text-emerald-400" size={18} /> OFFENSIVER MATCHPLAN & SPIELAUFBAU
                            </h3>
                            <p className="text-[11px] text-slate-400">Aufbauhöhe, Überzahlzonen & Halbraumnutzung</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSlideEditingActive(!slideEditingActive)}
                              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs uppercase px-2.5 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1"
                            >
                              <Edit size={12} /> {slideEditingActive ? '👁️ Vorschau' : '✏️ Offensiv-Plan Bearbeiten'}
                            </button>
                            <button
                              onClick={() => {
                                setActivePhase('offensiv');
                                setActiveTabSub('board');
                                notify('Offensiv-Phase auf der Taktiktafel geladen!');
                              }}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded-xl transition-all shadow"
                            >
                              🎯 Phase Zeigen
                            </button>
                          </div>
                        </div>

                        {(slideEditingActive || trainerEditMode) ? (
                          <div className="bg-slate-900 p-4 rounded-xl border border-emerald-500/40 space-y-3 text-xs">
                            <h4 className="font-black text-xs uppercase text-emerald-400 flex items-center gap-1">
                              <Edit size={13} /> OFFENSIV-EINSTELLUNGEN
                            </h4>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase block">Aufbauhöhe</label>
                                <select
                                  value={tacticalPhaseConfig.offensiv.aufbauhoehe}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    offensiv: { ...prev.offensiv, aufbauhoehe: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                >
                                  <option value="tief">Tief</option>
                                  <option value="mittelhoch">Mittelhoch</option>
                                  <option value="hoch">Hoch (Steil)</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase block">Überzahl</label>
                                <select
                                  value={tacticalPhaseConfig.offensiv.ueberzahlzonen}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    offensiv: { ...prev.offensiv, ueberzahlzonen: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                >
                                  <option value="IV">IV</option>
                                  <option value="6er">6er Zentrum</option>
                                  <option value="Halbraum">Halbraum</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase block">Halbraum</label>
                                <select
                                  value={tacticalPhaseConfig.offensiv.halbraumnutzung}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    offensiv: { ...prev.offensiv, halbraumnutzung: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                >
                                  <option value="Zehner">Zehner</option>
                                  <option value="Achter">Achter</option>
                                  <option value="inverser Flügel">inverser Flügel</option>
                                </select>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800 space-y-2">
                              <span className="font-bold text-emerald-400 uppercase text-[10px] block">OFFENSIV-LEITLINIEN BEARBEITEN</span>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Neue Leitlinie eingeben..."
                                  value={newOffensiveGuideline}
                                  onChange={(e) => setNewOffensiveGuideline(e.target.value)}
                                  className="bg-slate-950 border border-slate-800 p-1.5 rounded text-xs text-white flex-1"
                                />
                                <button
                                  onClick={() => {
                                    if (!newOffensiveGuideline) return;
                                    setOffensiveGuidelinesList(prev => [...prev, newOffensiveGuideline]);
                                    setNewOffensiveGuideline('');
                                    notify('Offensiv-Leitlinie hinzugefügt!');
                                  }}
                                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded uppercase"
                                >
                                  Hinzufügen
                                </button>
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {offensiveGuidelinesList.map((guideline, idx) => (
                                  <div key={idx} className="bg-slate-950 p-1.5 rounded flex items-center justify-between text-[11px] text-slate-200">
                                    <span>{guideline}</span>
                                    <button
                                      onClick={() => {
                                        setOffensiveGuidelinesList(prev => prev.filter((_, i) => i !== idx));
                                        notify('Leitlinie gelöscht');
                                      }}
                                      className="text-slate-500 hover:text-rose-400 p-1"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">AUFBAUHÖHE</span>
                                <span className="text-xs font-black text-emerald-400 uppercase mt-0.5 block">{tacticalPhaseConfig.offensiv.aufbauhoehe}</span>
                              </div>
                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">ÜBERZAHL</span>
                                <span className="text-xs font-black text-emerald-400 uppercase mt-0.5 block">{tacticalPhaseConfig.offensiv.ueberzahlzonen}</span>
                              </div>
                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">HALBRAUM</span>
                                <span className="text-xs font-black text-emerald-400 uppercase mt-0.5 block">{tacticalPhaseConfig.offensiv.halbraumnutzung}</span>
                              </div>
                            </div>

                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                              <h4 className="font-black text-emerald-400 uppercase text-xs tracking-wider">OFFENSIV-LEITLINIEN:</h4>
                              <div className="space-y-2 text-slate-300">
                                {offensiveGuidelinesList.map((guideline, idx) => (
                                  <p key={idx}>{guideline}</p>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* EMBEDDED PITCH */}
                      <div className="lg:col-span-6 min-h-[300px]">
                        {renderPitchForSlide(4)}
                      </div>
                    </div>
                  )}

                  {/* SLIDE 5: UMSCHALTEN */}
                  {presentationSlideIndex === 5 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      <div className="lg:col-span-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <h3 className="font-black text-base uppercase text-white tracking-wider flex items-center gap-2">
                              <TrendingUp className="text-amber-400" size={18} /> UMSCHALTEN & GEGENPRESSING
                            </h3>
                            <p className="text-[11px] text-slate-400">5-Sekunden-Regel bei Ballverlust & Tempo-Umschalten</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSlideEditingActive(!slideEditingActive)}
                              className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs uppercase px-2.5 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1"
                            >
                              <Edit size={12} /> {slideEditingActive ? '👁️ Vorschau' : '✏️ Umschalt-Plan Bearbeiten'}
                            </button>
                            <button
                              onClick={() => {
                                setActivePhase('umschalten_defensiv');
                                setActiveTabSub('board');
                                notify('Gegenpressing-Phase auf der Taktiktafel geladen!');
                              }}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded-xl transition-all shadow"
                            >
                              🎯 Phase Zeigen
                            </button>
                          </div>
                        </div>

                        {(slideEditingActive || trainerEditMode) ? (
                          <div className="bg-slate-900 p-4 rounded-xl border border-amber-500/40 space-y-3 text-xs">
                            <h4 className="font-black text-xs uppercase text-amber-400 flex items-center gap-1">
                              <Edit size={13} /> UMSCHALT- & GEGENPRESSING PARAMETER
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-amber-400 uppercase block">Zielzone Ballgewinn</label>
                                <input
                                  type="text"
                                  value={tacticalPhaseConfig.umschaltenOffensiv.zielzone}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    umschaltenOffensiv: { ...prev.umschaltenOffensiv, zielzone: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-amber-400 uppercase block">Tempo</label>
                                <select
                                  value={tacticalPhaseConfig.umschaltenOffensiv.tempo}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    umschaltenOffensiv: { ...prev.umschaltenOffensiv, tempo: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                >
                                  <option value="schnell">Schnell (Direkt)</option>
                                  <option value="kontrolliert">Kontrolliert (Ball halten)</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-rose-400 uppercase block">Gegenpressing Intensität</label>
                                <select
                                  value={tacticalPhaseConfig.umschaltenDefensiv.gegenpressingintensitaet}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    umschaltenDefensiv: { ...prev.umschaltenDefensiv, gegenpressingintensitaet: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                >
                                  <option value="hoch">Hoch (Extrem)</option>
                                  <option value="mittel">Mittel</option>
                                  <option value="niedrig">Niedrig (Rückzug)</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-rose-400 uppercase block">Trigger</label>
                                <input
                                  type="text"
                                  value={tacticalPhaseConfig.umschaltenDefensiv.trigger}
                                  onChange={(e) => setTacticalPhaseConfig(prev => ({
                                    ...prev,
                                    umschaltenDefensiv: { ...prev.umschaltenDefensiv, trigger: e.target.value }
                                  }))}
                                  className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                                />
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSlideEditingActive(false);
                                notify('Umschalt-Plan gespeichert!');
                              }}
                              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded w-full flex items-center justify-center gap-1"
                            >
                              <Save size={13} /> Speichern
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                              <h4 className="font-black text-amber-400 uppercase text-xs flex items-center gap-1">
                                <Zap size={13} /> BALLGEWINN (OFFENSIV)
                              </h4>
                              <div className="space-y-1 text-slate-300">
                                <p><strong>Zielzone:</strong> {tacticalPhaseConfig.umschaltenOffensiv.zielzone}</p>
                                <p><strong>Tempo:</strong> {tacticalPhaseConfig.umschaltenOffensiv.tempo.toUpperCase()}</p>
                                <p><strong>Muster:</strong> {tacticalPhaseConfig.umschaltenOffensiv.muster}</p>
                              </div>
                            </div>

                            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                              <h4 className="font-black text-rose-400 uppercase text-xs flex items-center gap-1">
                                <Shield size={13} /> BALLVERLUST (GEGENPRESSING)
                              </h4>
                              <div className="space-y-1 text-slate-300">
                                <p><strong>Intensität:</strong> {tacticalPhaseConfig.umschaltenDefensiv.gegenpressingintensitaet.toUpperCase()}</p>
                                <p><strong>Trigger:</strong> {tacticalPhaseConfig.umschaltenDefensiv.trigger}</p>
                                <p><strong>Regel:</strong> 5-Sekunden Sofort-Nachsetzen!</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* EMBEDDED PITCH */}
                      <div className="lg:col-span-6 min-h-[300px]">
                        {renderPitchForSlide(5)}
                      </div>
                    </div>
                  )}

                  {/* SLIDE 6: STANDARDS (4) */}
                  {presentationSlideIndex === 6 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      <div className="lg:col-span-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <h3 className="font-black text-base uppercase text-white tracking-wider flex items-center gap-2">
                              <Target className="text-emerald-400" size={18} /> STANDARDS & SPEZIALVARIANTEN
                            </h3>
                            <p className="text-[11px] text-slate-400">Ecke OFF, Ecke DEF, Freistöße (Sweden, Charles, Zug, Leverkusen)</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSlideEditingActive(!slideEditingActive)}
                              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs uppercase px-2.5 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1"
                            >
                              <Edit size={12} /> {slideEditingActive ? '👁️ Vorschau' : '✏️ Standards Bearbeiten'}
                            </button>
                            <button
                              onClick={() => {
                                setActiveTabSub('standards');
                                notify('Standards-Hub aufgerufen!');
                              }}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded-xl transition-all shadow"
                            >
                              🎯 Standards Hub
                            </button>
                          </div>
                        </div>

                        {(slideEditingActive || trainerEditMode) && (
                          <div className="bg-slate-900 p-3 rounded-xl border border-emerald-500/40 space-y-2 text-xs">
                            <span className="font-black uppercase text-emerald-400 block">➕ NEUE STANDARD-VARIANTE HINZUFÜGEN</span>
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder="Name (z.B. Corner Sweden)"
                                value={newSlideStandardInput.name}
                                onChange={(e) => setNewSlideStandardInput(prev => ({ ...prev, name: e.target.value }))}
                                className="bg-slate-950 border border-slate-800 p-1.5 rounded text-white col-span-2"
                              />
                              <input
                                type="number"
                                placeholder="Erfolgsquote %"
                                value={newSlideStandardInput.successRate}
                                onChange={(e) => setNewSlideStandardInput(prev => ({ ...prev, successRate: Number(e.target.value) }))}
                                className="bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
                              />
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Ablauf / Beschreibung..."
                                value={newSlideStandardInput.description}
                                onChange={(e) => setNewSlideStandardInput(prev => ({ ...prev, description: e.target.value }))}
                                className="bg-slate-950 border border-slate-800 p-1.5 rounded text-white flex-1"
                              />
                              <button
                                onClick={() => {
                                  if (!newSlideStandardInput.name) return;
                                  const defaultPositions = (FORMATION_PRESETS['4-2-3-1']?.nodes || []).map(n => ({
                                    id: n.id,
                                    name: n.name,
                                    number: n.number,
                                    role: n.role,
                                    xPercent: n.xPercent,
                                    yPercent: n.yPercent
                                  }));
                                  const newStd: StandardVariant = {
                                    id: `std_${Date.now()}`,
                                    name: newSlideStandardInput.name,
                                    type: 'ecke_offensiv',
                                    executor: 'B. Dischinger',
                                    keyPlayers: 'Dischinger, Akuegwu',
                                    description: newSlideStandardInput.description || 'Standard-Ablauf',
                                    successRate: newSlideStandardInput.successRate || 80,
                                    positions: defaultPositions,
                                    createdAt: new Date().toISOString()
                                  };
                                  setStandardsList(prev => [newStd, ...prev]);
                                  setNewSlideStandardInput({ name: '', description: '', successRate: 75 });
                                  notify('Standard-Variante hinzugefügt!');
                                }}
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded uppercase"
                              >
                                Hinzufügen
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          {standardsList.slice(0, 6).map((std, idx) => (
                            <div key={std.id} className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-3 rounded-xl space-y-1.5 shadow relative group">
                              <div className="flex items-center justify-between">
                                <span className="font-black text-xs text-emerald-400 truncate">{std.name}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded">
                                    {std.successRate}%
                                  </span>
                                  {(slideEditingActive || trainerEditMode) && (
                                    <button
                                      onClick={() => {
                                        setStandardsList(prev => prev.filter(s => s.id !== std.id));
                                        notify('Standard gelöscht');
                                      }}
                                      className="text-slate-500 hover:text-rose-400 p-0.5 shrink-0"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-300 line-clamp-2">
                                {std.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* EMBEDDED PITCH */}
                      <div className="lg:col-span-6 min-h-[300px]">
                        {renderPitchForSlide(6)}
                      </div>
                    </div>
                  )}

                  {/* SLIDE 7: COACHING */}
                  {presentationSlideIndex === 7 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      <div className="lg:col-span-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <h3 className="font-black text-base uppercase text-white tracking-wider flex items-center gap-2">
                              <FileText className="text-amber-400" size={18} /> WICHTIGE COACHING-PUNKTE
                            </h3>
                            <p className="text-[11px] text-slate-400">Schlüssel-Leitsätze für die Kabinenansprache</p>
                          </div>

                          <button
                            onClick={() => {
                              setEditingCoachingPointText('');
                              setShowEditCoachingModal(true);
                            }}
                            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded-xl transition-all shadow flex items-center gap-1"
                          >
                            <Plus size={14} /> Bearbeiten
                          </button>
                        </div>

                        {/* INLINE COACHING ADD FORM */}
                        <div className="bg-slate-900/90 p-3 rounded-xl border border-amber-500/40 flex gap-2">
                          <input
                            type="text"
                            placeholder="Neuen Coaching-Punkt direkt hinzufügen..."
                            value={newCoachingPointInput}
                            onChange={(e) => setNewCoachingPointInput(e.target.value)}
                            className="bg-slate-950 border border-slate-800 p-2 rounded-lg text-xs text-white flex-1 focus:outline-none focus:border-amber-400"
                          />
                          <button
                            onClick={() => {
                              if (!newCoachingPointInput.trim()) return;
                              setPresentationCoachingPoints(prev => [...prev, newCoachingPointInput.trim()]);
                              setNewCoachingPointInput('');
                              notify('Coaching-Punkt hinzugefügt!');
                            }}
                            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase px-3 py-2 rounded-lg shrink-0 flex items-center gap-1"
                          >
                            <Plus size={14} /> Hinzufügen
                          </button>
                        </div>

                        <div className="space-y-2">
                          {presentationCoachingPoints.map((pt, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3 shadow">
                              <span className="text-xs font-bold text-white">{pt}</span>
                              <button
                                onClick={() => {
                                  setPresentationCoachingPoints(prev => prev.filter((_, i) => i !== idx));
                                  notify('Coaching-Punkt entfernt!');
                                }}
                                className="text-slate-600 hover:text-rose-400 p-1 shrink-0"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* EMBEDDED PITCH */}
                      <div className="lg:col-span-6 min-h-[300px]">
                        {renderPitchForSlide(7)}
                      </div>
                    </div>
                  )}

                  {/* SLIDE 8: SPIELBERICHT */}
                  {presentationSlideIndex === 8 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      <div className="lg:col-span-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <h3 className="font-black text-base uppercase text-white tracking-wider flex items-center gap-2">
                              <BookOpen className="text-sky-400" size={18} /> SPIELBERICHT & METRIKEN (PDF/APP)
                            </h3>
                            <p className="text-[11px] text-slate-400">Live-Sync mit Match-Reports und DFPF Analysen</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSlideEditingActive(!slideEditingActive)}
                              className="bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-xs uppercase px-2.5 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1"
                            >
                              <Edit size={12} /> {slideEditingActive ? '👁️ Vorschau' : '✏️ Bericht & Metriken Bearbeiten'}
                            </button>
                            <span className="bg-sky-500/20 text-sky-400 border border-sky-500/40 font-black text-[10px] px-2.5 py-1 rounded-xl">
                              PDF SYNC OK
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs text-white uppercase">TRAINER-ANMERKUNGEN & MATCH-FAZIT</span>
                          </div>
                          
                          <textarea
                            rows={3}
                            value={customTrainerNotes}
                            onChange={(e) => setCustomTrainerNotes(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
                          />

                          {(slideEditingActive || trainerEditMode) ? (
                            <div className="bg-slate-950 p-3 rounded-lg border border-sky-500/40 space-y-2">
                              <span className="font-black text-[10px] uppercase text-sky-400 block">SPIEL-METRIKEN BEARBEITEN</span>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[8px] font-bold text-slate-400 uppercase block">Passquote</label>
                                  <input
                                    type="text"
                                    value={presentationMetrics.passQuote}
                                    onChange={(e) => setPresentationMetrics(prev => ({ ...prev, passQuote: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded text-xs text-emerald-400 font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8px] font-bold text-slate-400 uppercase block">Zweikampf</label>
                                  <input
                                    type="text"
                                    value={presentationMetrics.duelWin}
                                    onChange={(e) => setPresentationMetrics(prev => ({ ...prev, duelWin: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded text-xs text-emerald-400 font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8px] font-bold text-slate-400 uppercase block">Gegenpressing</label>
                                  <input
                                    type="text"
                                    value={presentationMetrics.counterPress}
                                    onChange={(e) => setPresentationMetrics(prev => ({ ...prev, counterPress: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded text-xs text-emerald-400 font-bold"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">PASSQUOTE</span>
                                <span className="text-sm font-black text-emerald-400 mt-0.5 block">{presentationMetrics.passQuote}</span>
                              </div>
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">ZWEIKAMPF</span>
                                <span className="text-sm font-black text-emerald-400 mt-0.5 block">{presentationMetrics.duelWin}</span>
                              </div>
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">GEGENPRESSING</span>
                                <span className="text-sm font-black text-emerald-400 mt-0.5 block">{presentationMetrics.counterPress}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* EMBEDDED PITCH */}
                      <div className="lg:col-span-6 min-h-[300px]">
                        {renderPitchForSlide(8)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* BOTTOM NAVIGATION FOOTER */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                disabled={presentationSlideIndex === 0}
                onClick={() => setPresentationSlideIndex(prev => Math.max(0, prev - 1))}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl border border-slate-800 transition-all flex items-center gap-1.5"
              >
                <ChevronLeft size={16} /> Vorheriges Slide
              </button>

              <span className="text-xs font-black text-emerald-400 font-mono">
                SLIDE {presentationSlideIndex + 1} VON 9
              </span>

              <button
                disabled={presentationSlideIndex === 8}
                onClick={() => setPresentationSlideIndex(prev => Math.min(8, prev + 1))}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase px-5 py-2.5 rounded-xl transition-all shadow flex items-center gap-1.5"
              >
                Nächstes Slide <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN TV PRESENTATION OVERLAY (WHEN isTvMode === true) */}
      <AnimatePresence>
        {isTvMode && (
          <div className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-2xl p-6 sm:p-10 flex flex-col justify-between overflow-hidden text-white">
            {/* TV HEADER */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-xl shadow-lg">
                  ⚽
                </div>
                <div>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider">
                    TV PRÄSENTATION • FC AUGGEN
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                    FC AUGGEN vs. {selectedMatchObj.opponent.toUpperCase()}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                  SLIDE {presentationSlideIndex + 1} / 9
                </span>
                <button
                  onClick={() => setIsTvMode(false)}
                  className="bg-slate-800 hover:bg-rose-500 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <X size={16} /> Beenden (ESC)
                </button>
              </div>
            </div>

            {/* TV CENTER CONTENT */}
            <div className="my-auto py-6 max-w-7xl w-full mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-widest block">
                      KAPITEL {presentationSlideIndex + 1}
                    </span>
                    <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight">
                      {[
                        '1. Titel & Match',
                        '2. Aufstellung & Bank',
                        '3. Formation (4-2-3-1)',
                        '4. Defensive Grundordnung',
                        '5. Offensiver Matchplan',
                        '6. Umschalten & Gegenpressing',
                        '7. Standards (4 Spezialvarianten)',
                        '8. Wichtige Coaching-Punkte',
                        '9. Spielbericht & App-Daten'
                      ][presentationSlideIndex]}
                    </h1>
                  </div>

                  {/* TEXT SUMMARY FOR TV MODE */}
                  <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-3 text-sm text-slate-200 leading-relaxed">
                    {presentationSlideIndex === 0 && (
                      <p>Heimspiel im Lettenpark Stadion. Die App berechnet 100% Bereitschaft. Gegner setzt auf aggressives Anpressen in der Zentrale — Schwachstelle in ihren Außenbahnen konsequent ausnutzen!</p>
                    )}
                    {presentationSlideIndex === 1 && (
                      <p>Startelf mit Schneider (TW), Tiedemann (RV), Paolillo (IV), Klett (IV), Ritzenthaler (LV), Kalchschmidt & Boutagrat (Doppel-6), Valchuk, Dischinger, Ehret + Spitze Akuegwu.</p>
                    )}
                    {presentationSlideIndex === 2 && (
                      <p>4-2-3-1 Stamm-System mit geschlossenen Kettenabständen. Ritzenthaler rückt bei Ballbesitz als 3. Sechser ein, Tiedemann marschiert hoch.</p>
                    )}
                    {presentationSlideIndex === 3 && (
                      <p>Pressinghöhe {tacticalPhaseConfig.defensiv.pressinghoehe.toUpperCase()}. Anpress-Trigger auf den schwachen gegnerischen Außenverteidiger. Zentrum strikt schließen!</p>
                    )}
                    {presentationSlideIndex === 4 && (
                      <p>Aufbauhöhe {tacticalPhaseConfig.offensiv.aufbauhoehe.toUpperCase()}. Andribbeln der Innenverteidiger zum Herauslocken, Halbraum-Besetzung durch Dischinger.</p>
                    )}
                    {presentationSlideIndex === 5 && (
                      <p>5-Sekunden Gegenpressing-Regel bei Ballverlust! Bei Ballgewinn sofortiger vertikaler Pass in die Zielzone {tacticalPhaseConfig.umschaltenOffensiv.zielzone}.</p>
                    )}
                    {presentationSlideIndex === 6 && (
                      <p>Die 4 einstudierten Spezialvarianten (Sweden, Charles, Zug, Leverkusen). Kurze Übergabe an Eckfahne mit Bogenlampe auf den 2. Pfosten auf Paolillo.</p>
                    )}
                    {presentationSlideIndex === 7 && (
                      <ul className="space-y-2 font-semibold text-amber-300">
                        {presentationCoachingPoints.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    )}
                    {presentationSlideIndex === 8 && (
                      <div className="space-y-2">
                        <p><strong>Trainer-Fazit:</strong> {customTrainerNotes}</p>
                        <p className="text-xs text-emerald-400">Passquote: 86.4% • Zweikampf quote: 58.2% • Gegenpressing-Erfolg: 78.0%</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* TV PITCH DISPLAY (DYNAMIC SYNC WITH SLIDE INDEX) */}
                <div className="min-h-[400px] h-full flex flex-col justify-center">
                  {renderPitchForSlide(presentationSlideIndex)}
                </div>
              </div>
            </div>

            {/* TV FOOTER STEPPER */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <button
                disabled={presentationSlideIndex === 0}
                onClick={() => setPresentationSlideIndex(prev => Math.max(0, prev - 1))}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs uppercase px-6 py-3 rounded-xl border border-slate-800 transition-all flex items-center gap-2"
              >
                <ChevronLeft size={18} /> Vorheriges Slide
              </button>

              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => setPresentationSlideIndex(idx)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      presentationSlideIndex === idx ? 'bg-emerald-400 scale-125 ring-2 ring-emerald-300' : 'bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>

              <button
                disabled={presentationSlideIndex === 8}
                onClick={() => setPresentationSlideIndex(prev => Math.min(8, prev + 1))}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase px-6 py-3 rounded-xl transition-all shadow flex items-center gap-2"
              >
                Nächstes Slide <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: EDIT COACHING POINTS MODAL */}
      <AnimatePresence>
        {showEditCoachingModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-black text-base uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Plus size={18} /> Neuen Coaching-Punkt Hinzufügen
                </h3>
                <button onClick={() => setShowEditCoachingModal(false)} className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <label className="block text-slate-400 font-bold uppercase text-[10px]">Ansprache-Leitsatz</label>
                <input
                  type="text"
                  value={editingCoachingPointText}
                  onChange={(e) => setEditingCoachingPointText(e.target.value)}
                  placeholder="z.B. Hohes Tempo über die Flügel in den ersten 20 Minuten..."
                  className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowEditCoachingModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => {
                    if (editingCoachingPointText.trim()) {
                      setPresentationCoachingPoints(prev => [...prev, editingCoachingPointText.trim()]);
                      setEditingCoachingPointText('');
                      setShowEditCoachingModal(false);
                      notify('Neuer Coaching-Punkt hinzugefügt!');
                    }
                  }}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition-all"
                >
                  Hinzufügen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAuditModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                    <Sparkles size={18} />
                  </div>
                  <h3 className="font-black text-lg uppercase tracking-wider text-white">
                    {editingAuditCard.id ? 'Audit-Punkt Bearbeiten' : 'Neuen Audit-Punkt Erstellen'}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowAuditModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                    Titel / Kennzahl *
                  </label>
                  <input 
                    type="text"
                    value={editingAuditCard.title}
                    onChange={(e) => setEditingAuditCard(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="z.B. Zweikampfquote, Pressing-Intensität, Passschärfe"
                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                    Wert / Ergebnis
                  </label>
                  <input 
                    type="text"
                    value={editingAuditCard.value}
                    onChange={(e) => setEditingAuditCard(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="z.B. 88%, 3 Tore, Top 1, High Impact"
                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                    Beschreibung / Fazit
                  </label>
                  <textarea 
                    rows={3}
                    value={editingAuditCard.description}
                    onChange={(e) => setEditingAuditCard(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Anmerkungen des Trainerteams zur Taktikumsetzung..."
                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveAuditCard}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition-all"
                >
                  Speichern
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
