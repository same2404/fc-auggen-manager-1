import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCw,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  Save,
  Lock,
  Unlock,
  Sparkles,
  Move,
  Target,
  Shield,
  Zap,
  CheckCircle2,
  X,
  Edit3,
  Flame,
  ArrowRight,
  Eye,
  ChevronDown,
  Layers,
  Info,
  Check,
  Award,
  Users
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query } from 'firebase/firestore';
import { db, cleanFirestoreData } from '../firebase';
import { isQuotaExceededActive, isQuotaError, markQuotaExceeded } from '../lib/offlineStorage';
import { Player } from '../types';

export interface SetPiecePosition {
  id: string;
  name: string;
  number: number | string;
  team: 'own' | 'opponent';
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  role?: string;
  highlighted?: boolean;
  locked?: boolean;
}

export interface SetPieceRun {
  id: string;
  playerId?: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  type: 'own_run' | 'opponent_run';
}

export interface SetPieceBallPath {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  targetLabel?: string;
}

export interface SetPieceVariant {
  id: string;
  name: string;
  type: 'ecke' | 'freistoss' | 'einwurf' | 'elfmeter';
  side: 'links' | 'rechts' | 'mitte';
  mode: 'offensiv' | 'defensiv';
  rotation: 0 | 90 | 180 | 270;
  positions: SetPiecePosition[];
  runs: SetPieceRun[];
  ballPath?: SetPieceBallPath;
  notes: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface SetPieceHalfPitchEditorProps {
  players?: Player[];
}

// Default initial preset items
const INITIAL_SET_PIECES: SetPieceVariant[] = [
  {
    id: 'sp_ecke_off_l',
    name: 'Eckball Links: Variante Kurzer Pfosten & Rückraum',
    type: 'ecke',
    side: 'links',
    mode: 'offensiv',
    rotation: 0,
    positions: [
      { id: 'p1', name: 'B. Dischinger', number: 10, team: 'own', xPercent: 6, yPercent: 6, role: 'Schütze', highlighted: true },
      { id: 'p2', name: 'J. Kalchschmidt', number: 8, team: 'own', xPercent: 42, yPercent: 22, role: 'Kurzer Pfosten', highlighted: true },
      { id: 'p3', name: 'C. Akuegwu', number: 9, team: 'own', xPercent: 55, yPercent: 28, role: 'Zielspieler / Langer Pfosten' },
      { id: 'p4', name: 'L. Boutagrat', number: 7, team: 'own', xPercent: 50, yPercent: 45, role: 'Rückraum-Schütze', highlighted: true },
      { id: 'p5', name: 'S. Walther', number: 4, team: 'own', xPercent: 48, yPercent: 32, role: 'Blocker' },
      { id: 'p6', name: 'M. Saur', number: 5, team: 'own', xPercent: 62, yPercent: 35, role: 'Zweiter Pfosten' },
      { id: 'p7', name: 'Y. Nothstein', number: 17, team: 'own', xPercent: 32, yPercent: 65, role: 'Absicherung' },
      { id: 'p8', name: 'L. Lais', number: 6, team: 'own', xPercent: 68, yPercent: 68, role: 'Absicherung' },
      // Opponents
      { id: 'op1', name: 'Gegner TW', number: 'TW', team: 'opponent', xPercent: 50, yPercent: 12, role: 'Torwart' },
      { id: 'op2', name: 'Gegner IV 1', number: 'IV', team: 'opponent', xPercent: 45, yPercent: 20, role: 'Erster Pfosten' },
      { id: 'op3', name: 'Gegner IV 2', number: 'IV', team: 'opponent', xPercent: 55, yPercent: 22, role: 'Manndeckung' },
      { id: 'op4', name: 'Gegner LV', number: 'LV', team: 'opponent', xPercent: 38, yPercent: 25, role: 'Kurzer Pfosten' }
    ],
    runs: [
      { id: 'r1', playerId: 'p2', fromX: 42, fromY: 22, toX: 38, toY: 15, color: '#10b981', type: 'own_run' },
      { id: 'r2', playerId: 'p4', fromX: 50, fromY: 45, toX: 48, toY: 32, color: '#06b6d4', type: 'own_run' }
    ],
    ballPath: {
      fromX: 6,
      fromY: 6,
      toX: 38,
      toY: 15,
      targetLabel: 'Kurzer Pfosten'
    },
    notes: 'Dischinger schlägt scharf mit Schnitt zum Tor auf den kurzen Pfosten. Kalchschmidt kreuzt dynamisch, Boutagrat lauert im Rückraum auf den zweiten Ball.',
    description: 'Eckballvariante Links (Offensiv) mit Auftaktfurcht und Einlaufen über den kurzen Pfosten.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sp_freistoss_off_r',
    name: 'Freistoß Halbfeld Rechts: Staffelung 16m',
    type: 'freistoss',
    side: 'rechts',
    mode: 'offensiv',
    rotation: 0,
    positions: [
      { id: 'p1', name: 'B. Dischinger', number: 10, team: 'own', xPercent: 78, yPercent: 65, role: 'Freistoßschütze', highlighted: true },
      { id: 'p2', name: 'C. Akuegwu', number: 9, team: 'own', xPercent: 45, yPercent: 35, role: 'Kopfballungeheuer' },
      { id: 'p3', name: 'M. Saur', number: 5, team: 'own', xPercent: 55, yPercent: 35, role: 'Langer Pfosten' },
      { id: 'p4', name: 'J. Kalchschmidt', number: 8, team: 'own', xPercent: 35, yPercent: 38, role: 'Kurzer Pfosten' },
      // Opponents
      { id: 'op1', name: 'Mauer 1', number: 'M1', team: 'opponent', xPercent: 68, yPercent: 52 },
      { id: 'op2', name: 'Mauer 2', number: 'M2', team: 'opponent', xPercent: 62, yPercent: 52 },
      { id: 'op3', name: 'Gegner TW', number: 'TW', team: 'opponent', xPercent: 50, yPercent: 12 }
    ],
    runs: [
      { id: 'r1', playerId: 'p2', fromX: 45, fromY: 35, toX: 52, toY: 20, color: '#10b981', type: 'own_run' }
    ],
    ballPath: {
      fromX: 78,
      fromY: 65,
      toX: 52,
      toY: 20,
      targetLabel: 'Elfmeterpunkt'
    },
    notes: 'Ball wird mit Zug vom Tor weg auf Höhe Elfmeterpunkt serviert. Akuegwu läuft aus der Tiefe mit hohem Tempo ein.',
    description: 'Halbfeld-Freistoß aus halbrechter Position.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sp_einwurf_l',
    name: 'Einwurf Halbfeld Links: Klatschen & Tiefe',
    type: 'einwurf',
    side: 'links',
    mode: 'offensiv',
    rotation: 0,
    positions: [
      { id: 'p1', name: 'S. Walther', number: 4, team: 'own', xPercent: 3, yPercent: 50, role: 'Einwerfer' },
      { id: 'p2', name: 'L. Boutagrat', number: 7, team: 'own', xPercent: 22, yPercent: 45, role: 'Wandspieler', highlighted: true },
      { id: 'p3', name: 'J. Kalchschmidt', number: 8, team: 'own', xPercent: 30, yPercent: 60, role: 'Tiefenlauf' }
    ],
    runs: [
      { id: 'r1', playerId: 'p2', fromX: 22, fromY: 45, toX: 15, toY: 48, color: '#10b981', type: 'own_run' },
      { id: 'r2', playerId: 'p3', fromX: 30, fromY: 60, toX: 25, toY: 30, color: '#06b6d4', type: 'own_run' }
    ],
    ballPath: {
      fromX: 3,
      fromY: 50,
      toX: 15,
      toY: 48,
      targetLabel: 'Kurzer Einwurf'
    },
    notes: 'Einwurf auf Boutagrat, der per Direktabnahme klatschen lässt. Kalchschmidt startet zeitgleich in die hinterlaufene Lücke.',
    description: 'Weiter/Schneller Einwurf auf der linken Außenbahn.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const SetPieceHalfPitchEditor: React.FC<SetPieceHalfPitchEditorProps> = ({ players = [] }) => {
  // Saved Set Pieces List
  const [setPieces, setSetPieces] = useState<SetPieceVariant[]>(() => {
    try {
      const saved = localStorage.getItem('fc_auggen_set_pieces_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load local set pieces', e);
    }
    return INITIAL_SET_PIECES;
  });

  // Selected Active Variant
  const [selectedId, setSelectedId] = useState<string>(INITIAL_SET_PIECES[0].id);
  const currentVariant = setPieces.find(s => s.id === selectedId) || setPieces[0] || INITIAL_SET_PIECES[0];

  // Editor Working State
  const [positions, setPositions] = useState<SetPiecePosition[]>(currentVariant.positions || []);
  const [runs, setRuns] = useState<SetPieceRun[]>(currentVariant.runs || []);
  const [ballPath, setBallPath] = useState<SetPieceBallPath | undefined>(currentVariant.ballPath);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(currentVariant.rotation || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Text Fields State
  const [variantName, setVariantName] = useState(currentVariant.name);
  const [notesText, setNotesText] = useState(currentVariant.notes || '');
  const [descText, setDescText] = useState(currentVariant.description || '');

  // Inline Editing Toggles
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  // Active Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    nodeId: string | null;
    x: number;
    y: number;
  }>({ visible: false, nodeId: null, x: 0, y: 0 });

  // Drawing mode for run paths / ball path
  const [drawingRunForPlayerId, setDrawingRunForPlayerId] = useState<string | null>(null);
  const [drawingBallPath, setDrawingBallPath] = useState(false);
  const [selectedRolePickerNodeId, setSelectedRolePickerNodeId] = useState<string | null>(null);

  // Pitch Container Reference
  const pitchRef = useRef<HTMLDivElement>(null);
  const [isDraggingNodeId, setIsDraggingNodeId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Animation Engine State
  const [isPlaying, setIsPlaying] = useState(false);
  const [animProgress, setAnimProgress] = useState(0); // 0 to 100
  const [animSpeed, setAnimSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);
  const [showTargetZones, setShowTargetZones] = useState(false);

  // Animation Loop
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setAnimProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1.5 * animSpeed;
        });
      }, 30);
    } else {
      setAnimProgress(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, animSpeed]);

  const handleSaveAnimationToCollection = async () => {
    try {
      const animDoc = {
        id: `anim_${selectedId}_${Date.now()}`,
        variantId: selectedId,
        title: variantName,
        type: currentVariant.type,
        positions,
        runs,
        ballPath,
        speed: animSpeed,
        updatedAt: new Date().toISOString()
      };
      if (!isQuotaExceededActive() && navigator.onLine) {
        await setDoc(doc(db, 'animations', animDoc.id), cleanFirestoreData(animDoc));
      }
      showToast('Animation erfolgreich gespeichert!');
    } catch (err) {
      if (isQuotaError(err)) {
        markQuotaExceeded();
      }
      console.error('Error saving animation to collection:', err);
    }
  };

  // Sync with Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, 'set_pieces'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const loaded: SetPieceVariant[] = [];
          snapshot.forEach((docSnap) => {
            loaded.push({ id: docSnap.id, ...docSnap.data() } as SetPieceVariant);
          });
          if (loaded.length > 0) {
            setSetPieces(loaded);
          }
        }
      }, (err) => {
        console.warn('Firestore set_pieces offline or error:', err);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Firestore setup error:', err);
    }
  }, []);

  // When selected variant changes, load its attributes
  useEffect(() => {
    const v = setPieces.find(s => s.id === selectedId) || setPieces[0];
    if (v) {
      setPositions(v.positions || []);
      setRuns(v.runs || []);
      setBallPath(v.ballPath);
      setRotation(v.rotation || 0);
      setVariantName(v.name);
      setNotesText(v.notes || '');
      setDescText(v.description || '');
    }
  }, [selectedId]);

  // Local storage cache persistence
  const persistToStorageAndDb = async (updatedPieces: SetPieceVariant[]) => {
    setSetPieces(updatedPieces);
    try {
      localStorage.setItem('fc_auggen_set_pieces_v2', JSON.stringify(updatedPieces));
    } catch (e) {
      console.error(e);
    }

    // Save active piece to Firestore if available
    const active = updatedPieces.find(s => s.id === selectedId);
    if (active && db && !isQuotaExceededActive() && navigator.onLine) {
      try {
        await setDoc(doc(db, 'set_pieces', active.id), cleanFirestoreData(active), { merge: true });
      } catch (err) {
        if (isQuotaError(err)) {
          markQuotaExceeded();
        }
        console.warn('Failed saving to firestore:', err);
      }
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Save changes to current variant
  const handleSaveCurrentVariant = async () => {
    const updated: SetPieceVariant = {
      ...currentVariant,
      name: variantName,
      positions,
      runs,
      ballPath,
      rotation,
      notes: notesText,
      description: descText,
      updatedAt: new Date().toISOString()
    };

    const nextList = setPieces.map(s => s.id === updated.id ? updated : s);
    await persistToStorageAndDb(nextList);
    showToast(`Standard-Variante "${variantName}" erfolgreich gespeichert!`);
  };

  // Create a brand new set piece
  const handleCreateNewVariant = () => {
    const newId = `sp_custom_${Date.now()}`;
    const newPiece: SetPieceVariant = {
      id: newId,
      name: 'Neue Standard-Variante (Frei gestaltbar)',
      type: 'ecke',
      side: 'links',
      mode: 'offensiv',
      rotation: 0,
      positions: [
        { id: 'p_ball', name: 'Ball / Ausführer', number: '⚽', team: 'own', xPercent: 8, yPercent: 8, role: 'Schütze', highlighted: true },
        { id: 'p_1', name: 'Spieler 1', number: 10, team: 'own', xPercent: 45, yPercent: 25, role: 'Zielspieler' },
        { id: 'p_2', name: 'Spieler 2', number: 8, team: 'own', xPercent: 55, yPercent: 35, role: 'Rückraum' },
        { id: 'op_1', name: 'Gegner TW', number: 'TW', team: 'opponent', xPercent: 50, yPercent: 12, role: 'Torwart' }
      ],
      runs: [],
      notes: 'Geben Sie hier Ihre taktischen Anweisungen und Absprachen ein...',
      description: 'Kurze Beschreibung der Variante...',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextList = [newPiece, ...setPieces];
    persistToStorageAndDb(nextList);
    setSelectedId(newId);
    showToast('Neue Standard-Variante erstellt!');
  };

  // Delete current variant
  const handleDeleteCurrentVariant = () => {
    if (setPieces.length <= 1) {
      showToast('Es muss mindestens eine Standard-Variante vorhanden sein!');
      return;
    }
    const nextList = setPieces.filter(s => s.id !== selectedId);
    persistToStorageAndDb(nextList);
    setSelectedId(nextList[0].id);
    showToast('Standard-Variante gelöscht.');
  };

  // Pitch click handler for dragging / context menu / drawing paths
  const handlePitchClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const xPct = Math.round((clickX / rect.width) * 100);
    const yPct = Math.round((clickY / rect.height) * 100);

    // If we are currently drawing a run path for a player
    if (drawingRunForPlayerId) {
      const p = positions.find(pos => pos.id === drawingRunForPlayerId);
      if (p) {
        const newRun: SetPieceRun = {
          id: `run_${Date.now()}`,
          playerId: p.id,
          fromX: p.xPercent,
          fromY: p.yPercent,
          toX: xPct,
          toY: yPct,
          color: p.team === 'own' ? '#10b981' : '#f43f5e',
          type: p.team === 'own' ? 'own_run' : 'opponent_run'
        };
        setRuns(prev => [...prev, newRun]);
        showToast(`Laufweg für ${p.name} gezeichnet!`);
      }
      setDrawingRunForPlayerId(null);
      setContextMenu({ visible: false, nodeId: null, x: 0, y: 0 });
      return;
    }

    // If drawing ball path
    if (drawingBallPath) {
      // ball starting from corner or player
      const ballNode = positions.find(p => p.role === 'Schütze' || p.name.includes('Ball')) || positions[0];
      const startX = ballNode ? ballNode.xPercent : 10;
      const startY = ballNode ? ballNode.yPercent : 10;

      setBallPath({
        fromX: startX,
        fromY: startY,
        toX: xPct,
        toY: yPct,
        targetLabel: yPct < 20 ? 'Torraum / Kurzer Pfosten' : 'Elfmeterpunkt / Rückraum'
      });
      setDrawingBallPath(false);
      showToast('Ballweg gezeichnet!');
      return;
    }

    // Close context menu if clicked on open pitch background
    setContextMenu({ visible: false, nodeId: null, x: 0, y: 0 });
    setSelectedRolePickerNodeId(null);
  };

  // Node Dragging Handlers
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = positions.find(p => p.id === nodeId);
    if (node?.locked) return; // Locked position cannot be dragged
    setIsDraggingNodeId(nodeId);
  };

  const handlePitchMouseMove = (e: React.MouseEvent | MouseEvent | TouchEvent) => {
    if (!isDraggingNodeId || !pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();

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

    const xPct = Math.max(2, Math.min(98, Math.round((((clientX - rect.left) / rect.width) * 100) * 10) / 10));
    const yPct = Math.max(2, Math.min(98, Math.round((((clientY - rect.top) / rect.height) * 100) * 10) / 10));

    setPositions(prev => prev.map(p => p.id === isDraggingNodeId ? { ...p, xPercent: xPct, yPercent: yPct } : p));
  };

  const handlePitchMouseUp = () => {
    setIsDraggingNodeId(null);
  };

  // Global window listeners for uninterrupted smooth dragging
  useEffect(() => {
    if (!isDraggingNodeId) return;

    const onWindowMove = (e: MouseEvent | TouchEvent) => {
      handlePitchMouseMove(e);
    };

    const onWindowUp = () => {
      setIsDraggingNodeId(null);
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
  }, [isDraggingNodeId]);

  // Node Click -> Open Context Menu
  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const node = positions.find(p => p.id === nodeId);
    if (!node) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setContextMenu({
      visible: true,
      nodeId,
      x: Math.min(x, rect.width - 200),
      y: Math.min(y, rect.height - 220)
    });
  };

  // Context Menu Actions
  const handleToggleHighlight = (nodeId: string) => {
    setPositions(prev => prev.map(p => p.id === nodeId ? { ...p, highlighted: !p.highlighted } : p));
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleToggleLock = (nodeId: string) => {
    setPositions(prev => prev.map(p => p.id === nodeId ? { ...p, locked: !p.locked } : p));
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleAssignRole = (nodeId: string, roleName: string) => {
    setPositions(prev => prev.map(p => p.id === nodeId ? { ...p, role: roleName } : p));
    setSelectedRolePickerNodeId(null);
    setContextMenu(prev => ({ ...prev, visible: false }));
    showToast(`Rolle "${roleName}" zugewiesen.`);
  };

  const handleAddPlayerNode = (team: 'own' | 'opponent') => {
    const isOwn = team === 'own';
    const count = positions.filter(p => p.team === team).length + 1;
    const newNode: SetPiecePosition = {
      id: `p_add_${Date.now()}`,
      name: isOwn ? `Spieler ${count}` : `Gegner ${count}`,
      number: count,
      team,
      xPercent: isOwn ? 45 : 55,
      yPercent: isOwn ? 40 : 20,
      role: isOwn ? 'Feldspieler' : 'Verteidiger'
    };
    setPositions(prev => [...prev, newNode]);
    showToast(`${isOwn ? 'Eigener Spieler' : 'Gegnerischer Spieler'} hinzugefügt.`);
  };

  const handleRemoveNode = (nodeId: string) => {
    setPositions(prev => prev.filter(p => p.id !== nodeId));
    setRuns(prev => prev.filter(r => r.playerId !== nodeId));
    setContextMenu(prev => ({ ...prev, visible: false }));
    showToast('Spieler entfernt.');
  };

  // Rotation cycle: 0 -> 90 -> 180 -> 270 -> 0
  const handleRotatePitch = () => {
    const nextRot = (rotation + 90) % 360 as 0 | 90 | 180 | 270;
    setRotation(nextRot);
    showToast(`Spielfeld gedreht auf ${nextRot}°`);
  };

  // Change type / side / mode
  const handleChangeType = (type: 'ecke' | 'freistoss' | 'einwurf' | 'elfmeter') => {
    const updated = { ...currentVariant, type };
    setSetPieces(prev => prev.map(s => s.id === selectedId ? updated : s));
  };

  const handleChangeSide = (side: 'links' | 'rechts' | 'mitte') => {
    const updated = { ...currentVariant, side };
    setSetPieces(prev => prev.map(s => s.id === selectedId ? updated : s));
  };

  const handleChangeMode = (mode: 'offensiv' | 'defensiv') => {
    const updated = { ...currentVariant, mode };
    setSetPieces(prev => prev.map(s => s.id === selectedId ? updated : s));
  };

  return (
    <div className={`space-y-6 transition-all ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto' : ''}`}>
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 bg-emerald-500 text-slate-950 font-black text-xs px-4 py-3 rounded-xl shadow-2xl border border-emerald-300 flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BAR & VARIANT SELECTOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 font-black flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Target size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={variantName}
                      onChange={(e) => setVariantName(e.target.value)}
                      className="bg-slate-950 border border-emerald-500 text-white font-black text-lg px-3 py-1 rounded-xl focus:outline-none"
                    />
                    <button
                      onClick={() => setIsEditingTitle(false)}
                      className="bg-emerald-500 text-slate-950 p-1.5 rounded-lg font-bold"
                    >
                      <Check size={16} />
                    </button>
                  </div>
                ) : (
                  <h3
                    onClick={() => setIsEditingTitle(true)}
                    className="font-black text-xl uppercase tracking-wider text-white flex items-center gap-2 group cursor-pointer hover:text-emerald-400 transition-colors"
                  >
                    <span>{variantName}</span>
                    <Edit3 size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Interaktives Halbfeld-Studio: Positionen verschieben, Laufwege zeichnen, Varianten verwalten
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCreateNewVariant}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs uppercase px-3.5 py-2 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 shadow"
            >
              <Plus size={15} />
              Neue Variante
            </button>

            <button
              onClick={handleSaveCurrentVariant}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-4 py-2 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
            >
              <Save size={16} />
              Speichern
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase border transition-all flex items-center gap-1.5 shadow-md ${
                isFullscreen
                  ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/40 hover:border-amber-400'
              }`}
              title={isFullscreen ? 'Vollbild beenden' : 'Vollbildmodus aktivieren'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isFullscreen ? 'Vollbild Beenden' : '🖥️ Vollbild'}</span>
            </button>
          </div>
        </div>

        {/* VARIANT PICKER & PROPERTIES TOGGLES */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
          {/* Variant Selector Dropdown */}
          <div className="md:col-span-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
              Gespeicherte Standard-Variante wählen:
            </label>
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-emerald-400 font-bold text-xs p-3 rounded-xl focus:outline-none focus:border-emerald-500 appearance-none pr-8 cursor-pointer"
              >
                {setPieces.map(sp => (
                  <option key={sp.id} value={sp.id}>
                    {sp.type === 'ecke' && '⚽ Eckball'}
                    {sp.type === 'freistoss' && '🎯 Freistoß'}
                    {sp.type === 'einwurf' && '🤾 Einwurf'}
                    {sp.type === 'elfmeter' && '🥅 Elfmeter'} ({sp.side.toUpperCase()} - {sp.mode.toUpperCase()}) — {sp.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Standard Type Buttons */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
              Standard-Typ:
            </label>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
              <button
                onClick={() => handleChangeType('ecke')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${currentVariant.type === 'ecke' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
              >
                Ecke
              </button>
              <button
                onClick={() => handleChangeType('freistoss')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${currentVariant.type === 'freistoss' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
              >
                Freistoß
              </button>
              <button
                onClick={() => handleChangeType('einwurf')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${currentVariant.type === 'einwurf' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
              >
                Einwurf
              </button>
            </div>
          </div>

          {/* Side & Mode Controls */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
              Ausrichtung & Modus:
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                <button
                  onClick={() => handleChangeSide('links')}
                  className={`flex-1 py-1 rounded-lg text-center ${currentVariant.side === 'links' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400'}`}
                >
                  Links
                </button>
                <button
                  onClick={() => handleChangeSide('mitte')}
                  className={`flex-1 py-1 rounded-lg text-center ${currentVariant.side === 'mitte' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400'}`}
                >
                  Mitte
                </button>
                <button
                  onClick={() => handleChangeSide('rechts')}
                  className={`flex-1 py-1 rounded-lg text-center ${currentVariant.side === 'rechts' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400'}`}
                >
                  Rechts
                </button>
              </div>

              <button
                onClick={() => handleChangeMode(currentVariant.mode === 'offensiv' ? 'defensiv' : 'offensiv')}
                className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase border transition-all ${
                  currentVariant.mode === 'offensiv'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                    : 'bg-rose-950 text-rose-400 border-rose-500/40'
                }`}
              >
                {currentVariant.mode === 'offensiv' ? '⚽ Offensiv' : '🛡️ Defensiv'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN PITCH & TACTICAL BOARD WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* INTERACTIVE HALF-PITCH CANVAS */}
        <div className="lg:col-span-3 bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 shadow-2xl relative overflow-hidden flex flex-col items-center">
          {/* Pitch Control Bar */}
          <div className="w-full flex flex-wrap items-center justify-between mb-3 px-2 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                Spielfeld-Rotation: {rotation}°
              </span>
              <button
                onClick={handleRotatePitch}
                className="bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all"
              >
                <RotateCw size={13} />
                Drehen (90°)
              </button>

              <button
                onClick={() => setShowTargetZones(!showTargetZones)}
                className={`text-xs font-bold px-3 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                  showTargetZones ? 'bg-amber-400 text-slate-950 border-amber-300 font-black' : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <Layers size={13} />
                Zonen-Overlay
              </button>
            </div>

            {/* Animation Playback Controls (Antigravity System) */}
            <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
              <button
                onClick={() => {
                  if (!isPlaying) {
                    setIsPlaying(true);
                    handleSaveAnimationToCollection();
                  } else {
                    setIsPlaying(false);
                  }
                }}
                className={`text-xs font-black px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md ${
                  isPlaying ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {isPlaying ? '⏹ Animation Stoppen' : '▶ Animation Abspielen'}
              </button>

              <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400">
                <span>Tempo:</span>
                {([0.5, 1, 1.5, 2] as const).map(spd => (
                  <button
                    key={spd}
                    onClick={() => setAnimSpeed(spd)}
                    className={`px-1.5 py-0.5 rounded ${animSpeed === spd ? 'bg-emerald-500 text-slate-950 font-black' : 'hover:bg-slate-800'}`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAddPlayerNode('own')}
                className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 font-bold text-[11px] px-2.5 py-1 rounded-lg border border-emerald-600/40"
              >
                + Spieler
              </button>
              <button
                onClick={() => handleAddPlayerNode('opponent')}
                className="bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[11px] px-2.5 py-1 rounded-lg border border-rose-600/40"
              >
                + Gegner
              </button>
            </div>
          </div>

          {/* Interactive Half Pitch SVG / HTML Stage */}
          <div
            ref={pitchRef}
            onClick={handlePitchClick}
            onMouseMove={handlePitchMouseMove}
            onMouseUp={handlePitchMouseUp}
            className="relative w-full h-[520px] bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950/40 rounded-xl border border-emerald-500/30 overflow-hidden cursor-crosshair select-none shadow-inner"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.4s ease-out'
            }}
          >
            {/* Field Lines SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-emerald-500/30 fill-none" strokeWidth="2">
              {/* Outer boundary */}
              <rect x="2%" y="2%" width="96%" height="96%" rx="8" />

              {/* Goal Area & Penalty Box */}
              <rect x="25%" y="2%" width="50%" height="28%" />
              <rect x="36%" y="2%" width="28%" height="10%" />

              {/* Penalty Spot & Arc */}
              <circle cx="50%" cy="18%" r="3" className="fill-emerald-400" />
              <path d="M 40% 30% A 12 12 0 0 0 60% 30%" strokeDasharray="4 4" />

              {/* Target Zones Overlay */}
              {showTargetZones && (
                <g className="opacity-70">
                  <rect x="25%" y="2%" width="20%" height="15%" className="fill-amber-500/20 stroke-amber-400" strokeDasharray="3 3" />
                  <text x="35%" y="9%" className="fill-amber-300 text-[10px] font-black" textAnchor="middle">Kurzer Pfosten</text>

                  <rect x="55%" y="2%" width="20%" height="15%" className="fill-amber-500/20 stroke-amber-400" strokeDasharray="3 3" />
                  <text x="65%" y="9%" className="fill-amber-300 text-[10px] font-black" textAnchor="middle">Langer Pfosten</text>

                  <rect x="25%" y="30%" width="50%" height="12%" className="fill-cyan-500/20 stroke-cyan-400" strokeDasharray="3 3" />
                  <text x="50%" y="36%" className="fill-cyan-300 text-[10px] font-black" textAnchor="middle">Rückraum 16m</text>
                </g>
              )}

              {/* Goal Post Line */}
              <line x1="42%" y1="2%" x2="58%" y2="2%" strokeWidth="5" className="stroke-white" />

              {/* Corner Arcs */}
              <path d="M 2% 8% A 10 10 0 0 0 8% 2%" />
              <path d="M 92% 2% A 10 10 0 0 0 98% 8%" />

              {/* Halfway Line & Center Arc */}
              <line x1="2%" y1="90%" x2="98%" y2="90%" />
              <path d="M 38% 90% A 20 20 0 0 1 62% 90%" />

              {/* SVG Markers for Arrows */}
              <defs>
                <marker id="arrow-own" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                </marker>
                <marker id="arrow-opponent" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                </marker>
                <marker id="arrow-ball" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" />
                </marker>
              </defs>

              {/* Draw Player Run Arrows */}
              {runs.map((r) => (
                <line
                  key={r.id}
                  x1={`${r.fromX}%`}
                  y1={`${r.fromY}%`}
                  x2={`${r.toX}%`}
                  y2={`${r.toY}%`}
                  stroke={r.color}
                  strokeWidth="3"
                  strokeDasharray={r.type === 'opponent_run' ? '4 4' : undefined}
                  markerEnd={r.type === 'own_run' ? 'url(#arrow-own)' : 'url(#arrow-opponent)'}
                />
              ))}

              {/* Draw Ball Path Line */}
              {ballPath && (
                <g>
                  <line
                    x1={`${ballPath.fromX}%`}
                    y1={`${ballPath.fromY}%`}
                    x2={`${ballPath.toX}%`}
                    y2={`${ballPath.toY}%`}
                    stroke="#fbbf24"
                    strokeWidth="4"
                    strokeDasharray="6 4"
                    markerEnd="url(#arrow-ball)"
                  />
                  {/* Ball Target Spot Circle */}
                  <circle cx={`${ballPath.toX}%`} cy={`${ballPath.toY}%`} r="12" className="fill-amber-400/20 stroke-amber-400" strokeWidth="2" />
                </g>
              )}
            </svg>

            {/* Ball Path Target Badge */}
            {ballPath && ballPath.targetLabel && (
              <div
                className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2 bg-amber-400 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 rounded shadow-lg border border-amber-200"
                style={{ left: `${ballPath.toX}%`, top: `${ballPath.toY + 4}%` }}
              >
                🎯 {ballPath.targetLabel}
              </div>
            )}

            {/* PLAYER NODES */}
            {positions.map((pos) => {
              const isOwn = pos.team === 'own';
              const playerRun = runs.find(r => r.playerId === pos.id);
              let displayX = pos.xPercent;
              let displayY = pos.yPercent;

              if (isPlaying && playerRun) {
                const factor = Math.min(1, animProgress / 100);
                displayX = playerRun.fromX + (playerRun.toX - playerRun.fromX) * factor;
                displayY = playerRun.fromY + (playerRun.toY - playerRun.fromY) * factor;
              }

              return (
                <div
                  key={pos.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, pos.id)}
                  onClick={(e) => handleNodeClick(e, pos.id)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing transition-all ${
                    pos.highlighted ? 'scale-125 z-30 ring-4 ring-amber-400/60 rounded-full' : 'z-20 hover:scale-110'
                  }`}
                  style={{ left: `${displayX}%`, top: `${displayY}%` }}
                >
                  {/* Circle Badge */}
                  <div className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center shadow-2xl border-2 ${
                    isOwn
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 border-white'
                      : 'bg-gradient-to-br from-rose-600 to-red-800 text-white border-slate-950'
                  }`}>
                    {pos.number || pos.name.substring(0, 2)}
                  </div>

                  {/* Name & Role Tag */}
                  <div className="mt-1 text-center whitespace-nowrap">
                    <span className="text-[9px] font-bold text-white bg-slate-950/90 px-1.5 py-0.5 rounded border border-slate-800 shadow block">
                      {pos.name}
                    </span>
                    {pos.role && (
                      <span className="text-[8px] font-mono text-amber-300 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/30 block mt-0.5">
                        {pos.role}
                      </span>
                    )}
                  </div>

                  {/* Locked indicator */}
                  {pos.locked && (
                    <div className="absolute -top-1 -right-1 bg-slate-900 text-amber-400 p-0.5 rounded-full border border-amber-500/40">
                      <Lock size={10} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* KONTEXT-MENÜ (Appears directly when clicking a player) */}
            {contextMenu.visible && contextMenu.nodeId && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-2 shadow-2xl space-y-1 w-52 text-xs"
                style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const activeNode = positions.find(p => p.id === contextMenu.nodeId);
                  if (!activeNode) return null;
                  return (
                    <>
                      <div className="px-2 py-1.5 border-b border-slate-800 font-black text-amber-300 text-[11px] uppercase flex items-center justify-between">
                        <span>{activeNode.name} (#{activeNode.number})</span>
                        <button onClick={() => setContextMenu(prev => ({ ...prev, visible: false }))} className="text-slate-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>

                      {/* 1. Laufweg hinzufügen */}
                      <button
                        onClick={() => {
                          setDrawingRunForPlayerId(activeNode.id);
                          showToast(`Klicken Sie auf das Spielfeld, um den Laufweg für ${activeNode.name} festzulegen.`);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-emerald-400 font-bold flex items-center gap-2 transition-colors"
                      >
                        <ArrowRight size={14} />
                        <span>Laufweg hinzufügen</span>
                      </button>

                      {/* 2. Ballweg von hier zeichnen */}
                      <button
                        onClick={() => {
                          setDrawingBallPath(true);
                          showToast('Klicken Sie auf das Spielfeld, um den Zielpunkt des Balles festzulegen.');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-amber-300 font-bold flex items-center gap-2 transition-colors"
                      >
                        <Target size={14} />
                        <span>Ballweg zeichnen</span>
                      </button>

                      {/* 3. Spieler hervorheben */}
                      <button
                        onClick={() => handleToggleHighlight(activeNode.id)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-200 font-bold flex items-center gap-2 transition-colors"
                      >
                        <Sparkles size={14} className="text-amber-400" />
                        <span>{activeNode.highlighted ? 'Hervorhebung aufheben' : 'Spieler hervorheben'}</span>
                      </button>

                      {/* 4. Rolle zuweisen */}
                      <div className="relative">
                        <button
                          onClick={() => setSelectedRolePickerNodeId(selectedRolePickerNodeId === activeNode.id ? null : activeNode.id)}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-200 font-bold flex items-center justify-between transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Layers size={14} className="text-teal-400" />
                            <span>Rolle zuweisen</span>
                          </span>
                          <ChevronDown size={12} />
                        </button>

                        {selectedRolePickerNodeId === activeNode.id && (
                          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 space-y-1 mt-1">
                            {['Schütze', 'Kurzer Pfosten', 'Langer Pfosten', 'Rückraum', 'Blocker', 'Mauer', 'Absicherung', 'Torwart'].map((r) => (
                              <button
                                key={r}
                                onClick={() => handleAssignRole(activeNode.id, r)}
                                className="w-full text-left px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-emerald-400 hover:bg-slate-900 rounded"
                              >
                                • {r}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 5. Position sperren / freigeben */}
                      <button
                        onClick={() => handleToggleLock(activeNode.id)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-300 font-bold flex items-center gap-2 transition-colors"
                      >
                        {activeNode.locked ? <Unlock size={14} className="text-emerald-400" /> : <Lock size={14} className="text-amber-400" />}
                        <span>{activeNode.locked ? 'Position freigeben' : 'Position sperren'}</span>
                      </button>

                      {/* 6. Entfernen */}
                      <button
                        onClick={() => handleRemoveNode(activeNode.id)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-950/50 text-rose-400 font-bold flex items-center gap-2 transition-colors border-t border-slate-800 mt-1"
                      >
                        <Trash2 size={14} />
                        <span>Spieler entfernen</span>
                      </button>
                    </>
                  );
                })()}
              </motion.div>
            )}
          </div>
        </div>

        {/* INLINE EDITABLE TACTICAL NOTES & INSTRUCTIONS PANEL */}
        <div className="space-y-6">
          {/* Notes & Explanation Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-black text-sm uppercase text-amber-400 flex items-center gap-2 tracking-wider">
                <Edit3 size={16} />
                Taktik-Notizen & Erklärungen
              </h4>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800 uppercase font-semibold">Inline-Edit</span>
            </div>

            {/* Description (Inline Editable) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-300">Kurzbeschreibung:</label>
              {isEditingDesc ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={descText}
                    onChange={(e) => setDescText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 p-3 rounded-xl focus:border-amber-400 focus:outline-none font-medium"
                  />
                  <button
                    onClick={() => setIsEditingDesc(false)}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Übernehmen
                  </button>
                </div>
              ) : (
                <p
                  onClick={() => setIsEditingDesc(true)}
                  className="text-xs text-slate-100 bg-slate-950 p-3.5 rounded-xl border border-slate-800 cursor-pointer hover:border-amber-400 transition-colors leading-relaxed font-medium"
                >
                  {descText || 'Klicken Sie hier, um eine Beschreibung einzugeben...'}
                </p>
              )}
            </div>

            {/* Tactical Notes (Inline Editable) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-amber-400">Standard-Anweisung / Ablauf:</label>
              {isEditingNotes ? (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 p-3 rounded-xl focus:border-amber-400 focus:outline-none font-medium"
                  />
                  <button
                    onClick={() => setIsEditingNotes(false)}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Übernehmen
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditingNotes(true)}
                  className="text-xs text-slate-100 bg-slate-950 p-3.5 rounded-xl border border-slate-800 cursor-pointer hover:border-amber-400 transition-colors leading-relaxed whitespace-pre-line font-medium"
                >
                  {notesText || 'Klicken Sie hier, um taktische Notizen hinzuzufügen...'}
                </div>
              )}
            </div>

            {/* Clear All Lines Action */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setRuns([]);
                  setBallPath(undefined);
                  showToast('Alle Lauf- & Ballwege zurückgesetzt.');
                }}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-800/50 px-3 py-1.5 rounded-xl transition-all"
              >
                <Trash2 size={13} />
                Laufwege zurücksetzen
              </button>

              <button
                onClick={handleDeleteCurrentVariant}
                className="text-xs font-bold text-slate-300 hover:text-rose-400 bg-slate-950 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-xl transition-all"
              >
                Variante löschen
              </button>
            </div>
          </div>

          {/* Player Roster & Roles List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl text-white">
            <h4 className="font-black text-xs uppercase text-emerald-400 tracking-wider flex items-center gap-2">
              <Users size={15} className="text-emerald-400" />
              Aufstellung ({positions.length} Spieler auf dem Feld)
            </h4>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  onClick={(e) => handleNodeClick(e, pos.id)}
                  className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs hover:border-amber-400 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-full font-black text-[10px] flex items-center justify-center shrink-0 ${
                      pos.team === 'own' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                    }`}>
                      {pos.number || '•'}
                    </span>
                    <div>
                      <span className="font-bold text-slate-100 block text-xs">{pos.name}</span>
                      {pos.role && <span className="text-[10px] text-amber-400 font-mono font-bold block">{pos.role}</span>}
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {pos.xPercent}%, {pos.yPercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
