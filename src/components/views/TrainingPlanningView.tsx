import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSyncedState } from '../../hooks/useSyncedState';
import { ExternalPerson, Player, TrainingSession, TrainingDocumentGlobal, TrainingDocumentContent } from '../../types';
import { isPlayer } from '../../utils/playerSorting';
import { useCollectionSync } from '../../hooks/useCollectionSync';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db, cleanFirestoreData } from '../../firebase';
import { isQuotaExceededActive, isQuotaError, markQuotaExceeded } from '../../lib/offlineStorage';
import { 
  Plus, 
  Trash2, 
  Save, 
  Edit2, 
  Mail, 
  MessageCircle, 
  Calendar,
  Clock,
  Activity,
  Users,
  ChevronRight,
  ChevronLeft,
  FileText,
  Maximize2,
  X,
  RotateCw,
  RotateCcw,
  Undo2,
  Redo2,
  History,
  User,
  UserPlus,
  Briefcase,
  Shield,
  ImageIcon,
  Share2,
  Upload,
  Printer
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { fixOklchForHtml2Canvas } from '../../utils/pdfExportHelper';
import { 
  Document as DocxDocument, 
  Packer as DocxPacker, 
  Paragraph as DocxParagraph, 
  TextRun as DocxTextRun, 
  Table as DocxTable, 
  TableRow as DocxTableRow, 
  TableCell as DocxTableCell, 
  WidthType as DocxWidthType, 
  BorderStyle as DocxBorderStyle, 
  ImageRun as DocxImageRun, 
  AlignmentType as DocxAlignmentType, 
  HeadingLevel as DocxHeadingLevel 
} from 'docx';
import { sortPlayers } from '../../utils/playerSorting';
import { VideoSection } from '../VideoSection';
import { WeeklyPeriodizationPlanBar } from '../training/WeeklyPeriodizationPlanBar';

interface TrainingPlanningViewProps {
  players: Player[];
  selectedSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onEmail?: () => void;
  onWhatsApp?: () => void;
  competitiveMatches?: any[];
}

// Exakte 9 Stufen gemäß Schaubild für Belastungs- und Intensitätssteuerung
export interface TrainingIntensityStage {
  level: number;
  label: string;
  percent: string;
  duration: string;
  colorName: string;
  bg: string;
  text: string;
  border: string;
}

export const TRAINING_INTENSITY_STAGES: TrainingIntensityStage[] = [
  { level: 1, label: 'Stufe 1', percent: '40–50%', duration: '0–10 Min.', colorName: 'Pastell-Mintgrün', bg: '#dcfce7', text: '#064e3b', border: '#86efac' },
  { level: 2, label: 'Stufe 2', percent: '40–60%', duration: '0–15 Min.', colorName: 'Hellgrün', bg: '#bbf7d0', text: '#064e3b', border: '#4ade80' },
  { level: 3, label: 'Stufe 3', percent: '50–60%', duration: '0–20 Min.', colorName: 'Frischgrün', bg: '#86efac', text: '#064e3b', border: '#22c55e' },
  { level: 4, label: 'Stufe 4', percent: '50–70%', duration: '10–25 Min.', colorName: 'Signalgrün', bg: '#4ade80', text: '#052e16', border: '#16a34a' },
  { level: 5, label: 'Stufe 5', percent: '60–75%', duration: '10–30 Min.', colorName: 'Kräftiges Smaragdgrün', bg: '#10b981', text: '#ffffff', border: '#059669' },
  { level: 6, label: 'Stufe 6', percent: '60–80%', duration: '10–35 Min.', colorName: 'Sattes Grün', bg: '#059669', text: '#ffffff', border: '#047857' },
  { level: 7, label: 'Stufe 7', percent: '70–80%', duration: '15–45 Min.', colorName: 'Waldgrün', bg: '#047857', text: '#ffffff', border: '#065f46' },
  { level: 8, label: 'Stufe 8', percent: '70–90%', duration: '15–60 Min.', colorName: 'Dunkelgrün', bg: '#065f46', text: '#ffffff', border: '#022c22' },
  { level: 9, label: 'Stufe 9', percent: '80–100%', duration: '10–110 Min.', colorName: 'Tiefes Schwarzgrün', bg: '#022c22', text: '#ffffff', border: '#000000' }
];

export function getSessionIntensityStage(load?: any, intensity?: any): TrainingIntensityStage {
  const fallback = TRAINING_INTENSITY_STAGES[4] || {
    level: 5,
    label: 'Stufe 5',
    percent: '60–75%',
    duration: '10–30 Min.',
    colorName: 'Kräftiges Smaragdgrün',
    bg: '#10b981',
    text: '#ffffff',
    border: '#059669'
  };

  try {
    const loadStr = (load !== null && load !== undefined) ? String(load).trim() : '';
    const intensityStr = (intensity !== null && intensity !== undefined) ? String(intensity).trim() : '';

    // Check if it's already an exact level label e.g. "Stufe 3" or contains "Stufe X"
    const stufeMatch = loadStr.match(/stufe\s*(\d+)/i) || intensityStr.match(/stufe\s*(\d+)/i);
    if (stufeMatch) {
      const lvl = parseInt(stufeMatch[1], 10);
      const found = TRAINING_INTENSITY_STAGES.find(s => s.level === lvl);
      if (found) return found;
    }

    // Check direct single digit 1-9
    if (/^[1-9]$/.test(loadStr)) {
      const lvl = parseInt(loadStr, 10);
      const found = TRAINING_INTENSITY_STAGES.find(s => s.level === lvl);
      if (found) return found;
    }
    if (/^[1-9]$/.test(intensityStr)) {
      const lvl = parseInt(intensityStr, 10);
      const found = TRAINING_INTENSITY_STAGES.find(s => s.level === lvl);
      if (found) return found;
    }

    // Word boundaries for single digit
    const numMatch = loadStr.match(/\b([1-9])\b/);
    if (numMatch) {
      const lvl = parseInt(numMatch[1], 10);
      const found = TRAINING_INTENSITY_STAGES.find(s => s.level === lvl);
      if (found) return found;
    }

    const combined = (loadStr + ' ' + intensityStr).toLowerCase();
    if (combined.includes('gering') || combined.includes('ruhe') || combined.includes('frei')) return TRAINING_INTENSITY_STAGES[0];
    if (combined.includes('maximal')) return TRAINING_INTENSITY_STAGES[8];
    if (combined.includes('hoch') && !combined.includes('mittel-hoch')) return TRAINING_INTENSITY_STAGES[6];
    if (combined.includes('mittel-hoch')) return TRAINING_INTENSITY_STAGES[4];
    if (combined.includes('mittel')) return TRAINING_INTENSITY_STAGES[2];

    return fallback;
  } catch {
    return fallback;
  }
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = "white"; // Solid background in case of transparent png
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => {
        resolve(base64); // Fallback to original base64 if loading fails
      };
    };
    reader.onerror = error => reject(error);
  });
};

const compressImage = (base64: string, maxWidth = 1000, maxHeight = 1000, quality = 0.75): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = "white"; // Handle transparency for jpeg
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64); // Fallback to original if compression fails
  });
};

const base64ToUint8Array = (base64: string) => {
  try {
    const parts = base64.split(',');
    const binaryString = window.atob(parts[1] || parts[0]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Base64 conversion failed", e);
    return null;
  }
};

const ImageLightbox: React.FC<{
  image: string;
  onClose: () => void;
  onUpdate?: (newBase64: string) => void;
  isEditing?: boolean;
}> = ({ image, onClose, onUpdate, isEditing }) => {
  const [rotation, setRotation] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdate) {
      try {
        const base64 = await fileToBase64(file);
        onUpdate(base64);
      } catch (err) {
        console.error("Update failed", err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">
      <div className="absolute top-4 right-4 flex gap-4">
        {isEditing && onUpdate && (
          <>
            <button 
              onClick={handleRotate}
              className="p-3 bg-[#1E293B]/10 hover:bg-[#1E293B]/20 text-white rounded-full transition-colors flex items-center gap-2 font-black uppercase text-[10px]"
            >
              <RotateCw size={20} /> Rotieren
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors flex items-center gap-2 font-black uppercase text-[10px]"
            >
              <Upload size={20} /> Ersetzen
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*" 
            />
          </>
        )}
        <button 
          onClick={onClose}
          className="p-3 bg-[#1E293B]/10 hover:bg-[#1E293B]/20 text-white rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>
      
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <img 
          src={image} 
          alt="Lightbox" 
          className="max-w-full max-h-full object-contain transition-transform duration-300"
          style={{ transform: `rotate(${rotation}deg)` }}
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};

const ImageUpload: React.FC<{ 
  onUpload: (base64: string | string[]) => void; 
  onDelete?: () => void;
  currentImage?: string;
  className?: string;
  label?: string;
  isEditing?: boolean;
}> = ({ onUpload, onDelete, currentImage, className, label, isEditing }) => {
  const [showLightbox, setShowLightbox] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        const compressed = await compressImage(base64);
        onUpload(compressed);
      } catch (err) {
        console.error("Upload failed", err);
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!isEditing) return;
    
    // Try from items (Standard)
    const items = e.clipboardData.items;
    const imageBlobs: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) imageBlobs.push(blob);
      }
    }

    if (imageBlobs.length > 0) {
      try {
        const processed = await Promise.all(imageBlobs.map(async (blob) => {
          const base64 = await fileToBase64(blob);
          return compressImage(base64);
        }));
        if (processed.length === 1) {
          onUpload(processed[0]);
        } else {
          onUpload(processed);
        }
      } catch (err) {
        console.error("Paste failed", err);
      }
      return;
    }

    // Try from files (Fallback)
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const imageFiles: File[] = [];
      for (let i = 0; i < e.clipboardData.files.length; i++) {
        if (e.clipboardData.files[i].type.startsWith('image/')) {
          imageFiles.push(e.clipboardData.files[i]);
        }
      }
      if (imageFiles.length > 0) {
        try {
          const processed = await Promise.all(imageFiles.map(async (file) => {
            const base64 = await fileToBase64(file);
            return compressImage(base64);
          }));
          if (processed.length === 1) {
            onUpload(processed[0]);
          } else {
            onUpload(processed);
          }
        } catch (err) {
          console.error("Paste Fallback failed", err);
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imageFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          imageFiles.push(files[i]);
        }
      }

      if (imageFiles.length > 0) {
        try {
          const processed = await Promise.all(imageFiles.map(async (file) => {
            const base64 = await fileToBase64(file);
            return compressImage(base64);
          }));
          if (processed.length === 1) {
            onUpload(processed[0]);
          } else {
            onUpload(processed);
          }
        } catch (err) {
          console.error("Drop failed", err);
        }
      }
    }
  };

  return (
    <div 
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      tabIndex={isEditing ? 0 : undefined}
      className={`relative transition-all outline-none focus-within:ring-2 focus-within:ring-blue-400 focus:ring-2 focus:ring-blue-400 ${isDragging ? 'bg-blue-50 ring-2 ring-blue-500 scale-102' : ''} ${className}`}
    >
      {currentImage ? (
        <>
          <div className="relative group border border-black/20 overflow-hidden w-full h-full">
            <img 
              src={currentImage} 
              alt="Training" 
              className="w-full h-full object-contain cursor-pointer transition-transform group-hover:scale-105" 
              referrerPolicy="no-referrer"
              onClick={() => setShowLightbox(true)}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <Maximize2 size={24} className="text-white" />
            </div>
            {isEditing && (
              <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {onDelete && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="bg-red-600 text-white p-1 hover:bg-neutral-800 transition-colors"
                    title="Löschen"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <div className="bg-blue-600 text-white p-1 cursor-pointer hover:bg-neutral-800 transition-colors relative" title="Ersetzen">
                    <Upload size={12} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </div>
              </div>
            )}
          </div>
          {showLightbox && (
            <ImageLightbox 
              image={currentImage} 
              onClose={() => setShowLightbox(false)} 
              onUpdate={onUpload}
              isEditing={isEditing}
            />
          )}
        </>
      ) : isEditing ? (
        <div className="relative border-2 border-dashed border-black/10 hover:border-black/30 transition-colors flex flex-col items-center justify-center p-2 cursor-pointer group w-full h-full min-h-[100px]">
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange} 
            className={`absolute inset-0 opacity-0 cursor-pointer ${isDragging ? 'pointer-events-none' : ''}`}
          />
          <Upload size={14} className="mb-1 opacity-40 group-hover:opacity-100 transition-opacity" />
          <span className="text-[7px] font-black uppercase opacity-40 group-hover:opacity-100 transition-opacity text-center leading-tight px-1">
            {label || "HOCHLADEN / KLICKEN & STRG+V / DRAG & DROP"}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export const ensureSessionDefaults = (session?: Partial<TrainingSession> | null): TrainingSession => {
  const today = new Date();
  if (!session) {
    return {
      id: Date.now().toString(),
      date: today.toISOString().split('T')[0],
      weekday: today.toLocaleDateString('de-DE', { weekday: 'long' }),
      group: 'FC Auggen',
      load: 'Stufe 5',
      duration: '10–30 Min.',
      weeklyFocus: '',
      sessionFocus: '',
      trainer: 'Amin, marcel',
      intensity: '60–75%',
      status: 'Geplant',
      opponent: '',
      location: 'Auggen',
      trainingDocumentId: null,
      players: [],
      content: {
        warmup: '',
        warmupDuration: '',
        warmupImages: [],
        main1: '',
        main1Duration: '',
        main1Images: [],
        main2: '',
        main2Duration: '',
        main2Images: [],
        closing: '',
        closingDuration: '',
        closingImages: []
      },
      importantInfo: '',
      importantInfoImages: [],
      remarks: '',
      remarksImages: [],
      videoClips: []
    };
  }

  return {
    id: session.id || Date.now().toString(),
    date: session.date || today.toISOString().split('T')[0],
    weekday: session.weekday || (session.date ? new Date(session.date).toLocaleDateString('de-DE', { weekday: 'long' }) : 'Montag'),
    group: session.group || 'FC Auggen',
    load: session.load || 'Stufe 5',
    duration: session.duration || '10–30 Min.',
    weeklyFocus: session.weeklyFocus || '',
    sessionFocus: session.sessionFocus || '',
    trainer: session.trainer || 'Amin, marcel',
    intensity: session.intensity || '60–75%',
    status: session.status || 'Geplant',
    opponent: session.opponent || '',
    location: session.location || 'Auggen',
    trainingDocumentId: session.trainingDocumentId || null,
    players: Array.isArray(session.players) ? session.players.filter(Boolean) : [],
    content: {
      warmup: session.content?.warmup || '',
      warmupDuration: session.content?.warmupDuration || '',
      warmupImages: Array.isArray(session.content?.warmupImages) ? session.content.warmupImages : [],
      main1: session.content?.main1 || '',
      main1Duration: session.content?.main1Duration || '',
      main1Images: Array.isArray(session.content?.main1Images) ? session.content.main1Images : [],
      main2: session.content?.main2 || '',
      main2Duration: session.content?.main2Duration || '',
      main2Images: Array.isArray(session.content?.main2Images) ? session.content.main2Images : [],
      closing: session.content?.closing || '',
      closingDuration: session.content?.closingDuration || '',
      closingImages: Array.isArray(session.content?.closingImages) ? session.content.closingImages : []
    },
    importantInfo: session.importantInfo || '',
    importantInfoImages: Array.isArray(session.importantInfoImages) ? session.importantInfoImages : [],
    remarks: session.remarks || '',
    remarksImages: Array.isArray(session.remarksImages) ? session.remarksImages : [],
    videoClips: Array.isArray(session.videoClips) ? session.videoClips : []
  };
};

export const TrainingPlanningView: React.FC<TrainingPlanningViewProps> = ({ 
  players, 
  selectedSessionId, 
  onSelectSession,
  onEmail,
  onWhatsApp,
  competitiveMatches = []
}) => {
  const { data: rawSessions, addOrUpdateItem: saveSession, removeItem: deleteSession } = useCollectionSync<TrainingSession>('training_sessions', 'id', 'date', 'asc');
  const sessions = useMemo(() => Array.isArray(rawSessions) ? rawSessions.filter(Boolean) : [], [rawSessions]);
  const { data: globalDocs, addOrUpdateItem: saveGlobalDoc, removeItem: deleteGlobalDoc } = useCollectionSync<TrainingDocumentGlobal>('training_documents_global', 'id');
  const [externalPersons] = useSyncedState<ExternalPerson[]>('external_persons_v1', []);
  const [lastSavedSquad, setLastSavedSquad] = useSyncedState<any[]>('last_training_squad_v1', []);
  const [isEditing, setIsEditing] = useState(false);
  const [localSession, setLocalSession] = useState<TrainingSession | null>(() => {
    if (Array.isArray(rawSessions) && rawSessions.length > 0) {
      const target = rawSessions.find(s => s && s.id === selectedSessionId) || rawSessions[0];
      return target ? ensureSessionDefaults(target) : null;
    }
    return null;
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [manualPlayerName, setManualPlayerName] = useState('');
  const [manualPlayerPos, setManualPlayerPos] = useState('');
  const [manualPlayerCategory, setManualPlayerCategory] = useState<'player' | 'coach' | 'staff' | 'medical'>('player');
  const [notification, setNotification] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const [selectedLibraryDocId, setSelectedLibraryDocId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [modalDragActive, setModalDragActive] = useState(false);
  const [undoStack, setUndoStack] = useState<TrainingSession[]>([]);
  const [redoStack, setRedoStack] = useState<TrainingSession[]>([]);
  const [initialSessionSnapshot, setInitialSessionSnapshot] = useState<TrainingSession | null>(null);

  // Exakte Belastungs- & Intensitätsstufe gemäß Schaubild (Stufe 1–9)
  const activeStage = useMemo(() => {
    try {
      if (!localSession) return TRAINING_INTENSITY_STAGES[4]; // Standard: Stufe 5
      return getSessionIntensityStage(localSession.load, localSession.intensity) || TRAINING_INTENSITY_STAGES[4];
    } catch {
      return TRAINING_INTENSITY_STAGES[4];
    }
  }, [localSession?.load, localSession?.intensity]);

  const handleSelectIntensityStage = (stage: TrainingIntensityStage) => {
    if (!localSession) return;
    const updated = {
      ...localSession,
      load: stage.label,
      intensity: stage.percent,
      duration: stage.duration
    };
    setLocalSession(updated);
    setNotification(`⚡ ${stage.label} gewählt (${stage.percent} • ${stage.duration})`);
    setTimeout(() => setNotification(null), 2500);

    // Trainer-Selbstbestimmung: Sofortige Speicherung per Klick (auch ohne vorheriges "Bearbeiten")
    if (!isEditing && localSession.id) {
      saveSession(updated);
    }
  };

  // Bulk Generation Settings & Undo History
  const [genStartDate, setGenStartDate] = useState<string>('2026-07-06');
  const [genEndDate, setGenEndDate] = useState<string>('2026-08-21');
  const [genMode, setGenMode] = useState<'daily' | 'days47' | 'custom'>('days47');
  const [genTrainer, setGenTrainer] = useState<string>('Amin, marcel');
  const [bulkUndoSnapshot, setBulkUndoSnapshot] = useState<TrainingSession[] | null>(null);
  const [bulkGeneratedIds, setBulkGeneratedIds] = useState<string[]>([]);

  const handleFileUpload = async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const fileList = Array.from(files);
      setNotification(`${fileList.length} Dokumente werden vorbereitet...`);
      
      let successCount = 0;
      let lastDocId = '';

      for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          setNotification(`Hochladen: ${i + 1}/${fileList.length} - ${file.name}`);
          
          if (file.size > 700 * 1024) {
              setNotification(`Upps! ${file.name} ist zu groß. Max 700KB erlaubt.`);
              await new Promise(r => setTimeout(r, 2000));
              continue;
          }

          try {
              const base64 = await fileToBase64(file);
              const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
              lastDocId = docId;
              
              if (!isQuotaExceededActive() && navigator.onLine) {
                try {
                  await setDoc(doc(db, 'training_documents_content', docId), cleanFirestoreData({
                      id: docId,
                      base64: base64
                  }));
                } catch (writeErr) {
                  if (isQuotaError(writeErr)) {
                    markQuotaExceeded();
                  }
                }
              }

              const newDoc: TrainingDocumentGlobal = {
                  id: docId,
                  name: file.name,
                  url: '', 
                  uploadedAt: new Date().toISOString(),
                  mimeType: file.type || 'application/octet-stream'
              };
              await saveGlobalDoc(newDoc as any);
              successCount++;
          } catch (err) {
              console.error(`Upload failed for ${file.name}:`, err);
          }
      }

      if (successCount > 0) {
          setSelectedLibraryDocId(lastDocId);
          if (successCount === 1 && localSession && localSession.id) {
              const updatedSession = { ...localSession, trainingDocumentId: lastDocId };
              await saveSession(updatedSession as any);
              setLocalSession(updatedSession as any);
              setNotification("Erfolgreich hochgeladen & zugewiesen!");
          } else {
              setNotification(`${successCount} Dokument(e) erfolgreich zur Bibliothek hinzugefügt!`);
          }
      } else {
          setNotification("Keine Dokumente hochgeladen.");
      }
      
      setTimeout(() => setNotification(null), 3000);
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const pushUndoState = () => {
    if (localSession) {
      const copy = JSON.parse(JSON.stringify(localSession));
      setUndoStack(prev => [...prev.slice(-30), copy]);
      setRedoStack([]);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !localSession) return;
    const previousState = undoStack[undoStack.length - 1];
    const nextUndoStack = undoStack.slice(0, undoStack.length - 1);

    const currentCopy = JSON.parse(JSON.stringify(localSession));
    setRedoStack(prev => [...prev, currentCopy]);
    setUndoStack(nextUndoStack);
    setLocalSession(previousState);
    saveSession(previousState);
    setNotification("Änderung rückgängig gemacht");
    setTimeout(() => setNotification(null), 2000);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !localSession) return;
    const nextState = redoStack[redoStack.length - 1];
    const nextRedoStack = redoStack.slice(0, redoStack.length - 1);

    const currentCopy = JSON.parse(JSON.stringify(localSession));
    setUndoStack(prev => [...prev, currentCopy]);
    setRedoStack(nextRedoStack);
    setLocalSession(nextState);
    saveSession(nextState);
    setNotification("Änderung wiederhergestellt");
    setTimeout(() => setNotification(null), 2000);
  };

  const handleRestoreInitial = () => {
    if (!initialSessionSnapshot || !localSession) return;
    pushUndoState();
    const restored = JSON.parse(JSON.stringify(initialSessionSnapshot));
    setLocalSession(restored);
    saveSession(restored);
    setNotification("Ursprünglicher Stand wiederhergestellt");
    setTimeout(() => setNotification(null), 2000);
  };

  const addManualPlayer = () => {
    if (!manualPlayerName || !localSession) return;
    pushUndoState();
    
    const newPlayerEntry = {
      name: manualPlayerName,
      position: manualPlayerPos || 'EXTERN',
      status: '1' as any,
      category: manualPlayerCategory
    };
    
    const updatedPlayers = sortPlayers([...(localSession.players || []), newPlayerEntry]);
    const updatedSession = { ...localSession, players: updatedPlayers };
    setLocalSession(updatedSession);
    if (isEditing) {
      saveSession(updatedSession);
    }
    setManualPlayerName('');
    setManualPlayerPos('');
    setManualPlayerCategory('player'); // Reset to default
    setNotification(`${manualPlayerName} hinzugefügt`);
    setTimeout(() => setNotification(null), 2000);
  };

  const normalizeCategory = (cat?: string) => {
    if (!cat) return 'player';
    const c = cat.toLowerCase();
    
    // Players
    if (c === 'spieler' || c === 'player') return 'player';
    
    // Coaches
    if (['trainer', 'co-trainer', 'tw-trainer', 'athletik', 'coach'].includes(c)) return 'coach';
    
    // Medical
    if (['physio', 'medizinisch', 'medical', 'arzt', 'ärztlich'].includes(c)) return 'medical';
    
    // Staff / Funktionsteam
    if (['betreuer', 'teammanager', 'funktionär', 'staff'].includes(c)) return 'staff';
    
    return c;
  };

  const getCategoryColor = (category?: string) => {
    const cat = normalizeCategory(category);
    switch (cat) {
      case 'coach': return 'bg-blue-600';
      case 'staff': return 'bg-amber-600';
      case 'medical': return 'bg-emerald-600';
      default: return 'bg-[#C00000]';
    }
  };

  const getCategoryBorderColor = (category?: string) => {
    const cat = normalizeCategory(category);
    switch (cat) {
      case 'coach': return 'border-blue-600';
      case 'staff': return 'border-amber-600';
      case 'medical': return 'border-emerald-600';
      default: return 'border-[#C00000]';
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = normalizeCategory(category);
    switch (cat) {
      case 'coach':
        return <Briefcase size={14} className="text-blue-500" />;
      case 'staff':
        return <Shield size={14} className="text-amber-500" />;
      case 'medical':
        return <Activity size={14} className="text-emerald-500" />;
      default: return <User size={14} className="text-red-600" />;
    }
  };

  const getCategoryLabel = (category?: string) => {
    const cat = normalizeCategory(category);
    switch (cat) {
      case 'coach':
        return 'TRAINERTEAM';
      case 'staff':
        return 'FUNKTIONSTEAM';
      case 'medical':
        return 'MEDIZINISCHE ABTEILUNG (PHYSIO / ARZT)';
      default: return 'SPIELERKADER';
    }
  };

  const safePlayerList = useMemo(() => Array.isArray(players) ? players.filter(Boolean) : [], [players]);
  const squadPlayers = useMemo(() => safePlayerList.filter(isPlayer), [safePlayerList]);
  const staffMembers = useMemo(() => safePlayerList.filter(p => !isPlayer(p)), [safePlayerList]);
  const sortedPlayers = useMemo(() => sortPlayers(squadPlayers), [squadPlayers]);
  const sortedStaff = useMemo(() => sortPlayers(staffMembers), [staffMembers]);

  useEffect(() => {
    if (sessions.length > 0) {
      const match = sessions.find(s => s && s.id === selectedSessionId);
      if (!selectedSessionId || !match) {
        onSelectSession(sessions[0].id);
      }
    }
  }, [sessions, selectedSessionId, onSelectSession]);

  const currentSelectedSession = useMemo(() => {
    if (sessions.length === 0) return null;
    return sessions.find(s => s && s.id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  const lastSyncedRef = useRef<{ id: string | null; isEditing: boolean }>({ id: null, isEditing: false });

  useEffect(() => {
    if (currentSelectedSession) {
      const targetId = currentSelectedSession.id;
      const isNewSession = !localSession || localSession.id !== targetId;
      const editingStateChanged = lastSyncedRef.current.isEditing !== isEditing;
      
      if (isNewSession || (!isEditing && editingStateChanged)) {
        lastSyncedRef.current = { id: targetId, isEditing };
        const sanitized = ensureSessionDefaults(currentSelectedSession);
        setLocalSession(sanitized);
        setInitialSessionSnapshot(JSON.parse(JSON.stringify(sanitized)));
        setUndoStack([]);
        setRedoStack([]);
      }
    } else {
      if (localSession !== null) {
        lastSyncedRef.current = { id: null, isEditing };
        setLocalSession(null);
        setInitialSessionSnapshot(null);
        setUndoStack([]);
        setRedoStack([]);
      }
    }
  }, [currentSelectedSession, isEditing, localSession]);

  // Keyboard shortcuts for Undo (Ctrl+Z) and Redo (Ctrl+Y / Shift+Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) return;
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else if (!isInput && undoStack.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (!isInput && redoStack.length > 0) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, undoStack, redoStack, localSession]);

  // Simple global paste listener
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (!isEditing || !localSession) return;
      
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const text = clipboardData.getData('text/plain');
      const items = clipboardData.items;
      
      const imageBlobs: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) imageBlobs.push(blob);
        }
      }

      const isSubstantialText = text && text.trim().length > 0;
      
      if (imageBlobs.length > 0 && !isSubstantialText) {
        try {
          // Process all images
          const processedImages = await Promise.all(imageBlobs.map(async (blob) => {
            const base64 = await fileToBase64(blob);
            return compressImage(base64);
          }));

          processImagesForSession(processedImages);
        } catch (err) {
          console.error("Global image paste failed", err);
        }
      } else if (isSubstantialText) {
        const content = localSession.content;
        let slot: keyof TrainingSession['content'] | null = null;
        if (!content.warmup) slot = 'warmup';
        else if (!content.main1) slot = 'main1';
        else if (!content.main2) slot = 'main2';
        else if (!content.closing) slot = 'closing';

        if (slot) {
          updateContent(slot, text);
          setNotification("Text eingefügt");
        }
      }
      
      setTimeout(() => setNotification(null), 2000);
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isEditing, localSession]);

  // Autosave local session changes
  useEffect(() => {
    if (localSession && isEditing) {
      const timer = setTimeout(() => {
        saveSession(localSession);
      }, 1000); // 1s debounce
      return () => clearTimeout(timer);
    }
  }, [localSession, isEditing, saveSession]);

  // Synchronisiere Kader-Anpassungen ins lastSavedSquad, wenn im Bearbeitungsmodus
  useEffect(() => {
    if (localSession && isEditing && localSession.players && (localSession.players || []).length > 0) {
      const squadString = JSON.stringify(localSession.players);
      const lastSavedString = JSON.stringify(lastSavedSquad);
      if (squadString !== lastSavedString) {
        setLastSavedSquad(localSession.players);
      }
    }
  }, [localSession?.players, isEditing, lastSavedSquad, setLastSavedSquad]);

  const getPlayersFromLastSession = () => {
    let basePlayers: any[] = [];
    if (lastSavedSquad && lastSavedSquad.length > 0) {
      basePlayers = [...lastSavedSquad];
    } else if (sessions.length > 0) {
      // Get the latest session (sessions is sorted by date asc)
      const lastSession = sessions[sessions.length - 1];
      basePlayers = lastSession && lastSession.players ? [...lastSession.players] : [];
    } else {
      const sortedSquad = sortPlayers(players.filter(isPlayer));
      const sortedStaff = sortPlayers(players.filter(p => !isPlayer(p)));
      basePlayers = [
        ...sortedSquad.map(p => ({
          name: p.lastName,
          position: p.position,
          status: '1' as any,
          category: p.category
        })),
        ...sortedStaff.map(p => ({
          name: p.lastName,
          position: p.position,
          status: '1' as any,
          category: p.category
        }))
      ];
    }

    // Ensure all current club players are present (just in case new players were added in administration)
    players.forEach(p => {
      const fullName = p.lastName;
      if (!basePlayers.some(bp => bp.name === fullName)) {
        basePlayers.push({
          name: fullName,
          position: p.position,
          status: '1' as any,
          category: p.category
        });
      }
    });
    
    return sortPlayers(basePlayers);
  };

  const handleAddSession = () => {
    const today = new Date();
    const inheritedPlayers = getPlayersFromLastSession();
    
    const newSession: TrainingSession = {
      id: Date.now().toString(),
      date: today.toISOString().split('T')[0],
      weekday: today.toLocaleDateString('de-DE', { weekday: 'long' }),
      group: 'FC Auggen',
      load: 'Stufe 5',
      duration: '10–30 Min.',
      weeklyFocus: '',
      sessionFocus: '',
      trainer: '',
      intensity: '60–75%',
      status: 'Geplant',
      opponent: '',
      location: 'Auggen',
      players: inheritedPlayers,
      content: {
        warmup: '',
        warmupDuration: '',
        warmupImages: [],
        main1: '',
        main1Duration: '',
        main1Images: [],
        main2: '',
        main2Duration: '',
        main2Images: [],
        closing: '',
        closingDuration: '',
        closingImages: []
      },
      importantInfo: '',
      importantInfoImages: [],
      remarks: '',
      remarksImages: []
    };
    saveSession(newSession);
    onSelectSession(newSession.id);
    setIsEditing(true);
  };

  const handleGenerateUnits = () => {
    setShowGenerateConfirm(true);
  };

  const confirmGenerateUnits = () => {
    setShowGenerateConfirm(false);
    
    // 1. Snapshot existing sessions for 100% reliable Undo
    const previousSessionsSnapshot = JSON.parse(JSON.stringify(sessions));
    setBulkUndoSnapshot(previousSessionsSnapshot);

    const startDate = new Date(genStartDate || '2026-07-06');
    const endDate = new Date(genEndDate || '2026-08-21');
    const current = new Date(startDate);
    
    // Get initial base players from the current latest session
    const inheritedPlayers = getPlayersFromLastSession();

    const newSessions: TrainingSession[] = [];
    const generatedIds: string[] = [];

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const weekday = current.toLocaleDateString('de-DE', { weekday: 'long' });
      const sessionId = `gen_${dateStr}`;
      
      const session: TrainingSession = {
        id: sessionId,
        date: dateStr,
        weekday,
        group: 'FC Auggen',
        load: 'Stufe 5',
        duration: '10–30 Min.',
        weeklyFocus: '',
        sessionFocus: '',
        trainer: genTrainer || 'Amin, marcel',
        intensity: '60–75%',
        status: 'Geplant',
        opponent: '',
        location: 'Auggen',
        players: inheritedPlayers,
        content: {
          warmup: 'Aktivierung',
          warmupDuration: '',
          warmupImages: [],
          main1: 'Hauptteil',
          main1Duration: '',
          main1Images: [],
          main2: 'SP Hauptteil 2',
          main2Duration: '',
          main2Images: [],
          closing: 'Schluss',
          closingDuration: '',
          closingImages: []
        },
        importantInfo: '',
        importantInfoImages: [],
        remarks: '',
        remarksImages: []
      };
      newSessions.push(session);
      generatedIds.push(sessionId);
      current.setDate(current.getDate() + 1);
    }

    setBulkGeneratedIds(generatedIds);

    // Save all sessions
    newSessions.forEach(s => saveSession(s));
    
    if (newSessions.length > 0) {
      onSelectSession(newSessions[0].id);
    }

    setNotification(`✓ ${newSessions.length} Trainingseinheiten erfolgreich generiert! Rückgängig machen jederzeit über "Generierung rückgängig" möglich.`);
    setTimeout(() => setNotification(null), 6000);
  };

  const handleBulkUndo = async () => {
    if (!bulkUndoSnapshot && bulkGeneratedIds.length === 0) return;
    
    // Remove all newly created bulk generated sessions
    if (bulkGeneratedIds.length > 0) {
      for (const id of bulkGeneratedIds) {
        deleteSession(id);
      }
    }
    
    // Restore previous sessions from snapshot
    if (bulkUndoSnapshot && bulkUndoSnapshot.length > 0) {
      for (const oldSess of bulkUndoSnapshot) {
        saveSession(oldSess);
      }
      onSelectSession(bulkUndoSnapshot[0].id);
    } else {
      onSelectSession('');
    }

    setBulkUndoSnapshot(null);
    setBulkGeneratedIds([]);
    setNotification("✓ Die generierten Trainingseinheiten wurden komplett rückgängig gemacht.");
    setTimeout(() => setNotification(null), 4000);
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = async () => {
    setShowResetConfirm(false);
    
    const inheritedPlayers = getPlayersFromLastSession();

    // Delete all existing sessions
    for (const session of sessions) {
      deleteSession(session.id);
    }

    // Create the single session for 06.07.2026
    const startDate = new Date('2026-07-06');
    const dateStr = startDate.toISOString().split('T')[0];
    const weekday = startDate.toLocaleDateString('de-DE', { weekday: 'long' });

    const newSession: TrainingSession = {
      id: `gen_${dateStr}`,
      date: dateStr,
      weekday,
      group: 'FC Auggen',
      load: 'Stufe 5',
      duration: '10–30 Min.',
      weeklyFocus: '',
      sessionFocus: '',
      trainer: 'Amin, marcel',
      intensity: '60–75%',
      status: 'Geplant',
      opponent: '',
      location: 'Auggen',
      players: inheritedPlayers,
      content: {
        warmup: 'Aktivierung',
        warmupDuration: '',
        warmupImages: [],
        main1: 'Hauptteil',
        main1Duration: '',
        main1Images: [],
        main2: 'SP Hauptteil 2',
        main2Duration: '',
        main2Images: [],
        closing: 'Schluss',
        closingDuration: '',
        closingImages: []
      },
      importantInfo: '',
      importantInfoImages: [],
      remarks: '',
      remarksImages: []
    };

    saveSession(newSession);
    onSelectSession(newSession.id);
    setNotification('Alle Einheiten gelöscht. Start-Einheit (06.07.2026) erstellt.');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = () => {
    if (localSession) {
      saveSession(localSession);
      setIsEditing(false);
    }
  };

  const handleDelete = () => {
    if (selectedSessionId) {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    if (selectedSessionId) {
      deleteSession(selectedSessionId);
      onSelectSession(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleShareImage = async () => {
    const card = document.getElementById('training-plan-card');
    if (!card) {
      setNotification("Fehler: Trainingsplan-Karte nicht gefunden");
      return;
    }

    try {
      setNotification("Bild wird generiert...");
      
      // Ensure all images are loaded for html2canvas
      const images = card.getElementsByTagName('img');
      const loadPromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(loadPromises);

      // Scroll to top of card area if needed to ensure capture works better
      const canvas = await html2canvas(card, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        scrollX: 0,
        scrollY: -window.scrollY, // Offset window scroll
        ignoreElements: (element) => {
          // Ignore external elements that might have problematic CSS
          return !card.contains(element) && element !== card && element !== document.body && element !== document.documentElement;
        },
        onclone: (clonedDoc) => {
          fixOklchForHtml2Canvas(clonedDoc);
          // Robust fix for oklch colors which html2canvas doesn't support
          const container = clonedDoc.getElementById('training-plan-card');
          if (container) {
            const elements = container.querySelectorAll('*');
            elements.forEach((el: any) => {
              if (el instanceof HTMLElement) {
                const style = window.getComputedStyle(el);
                
                // Manually override problematic properties if they contain oklch
                if (style.backgroundColor.includes('oklch')) {
                  // If it's the blue header, use a specific blue
                  if (el.classList.contains('bg-[#1E293B]')) el.style.backgroundColor = '#f3f4f6';
                  else if (el.classList.contains('bg-blue-50')) el.style.backgroundColor = '#eff6ff';
                  else if (el.classList.contains('bg-blue-600')) el.style.backgroundColor = '#2563eb';
                  else el.style.backgroundColor = '#ffffff';
                }
                
                if (style.color.includes('oklch')) {
                  if (el.classList.contains('text-[#C00000]')) el.style.color = '#C00000';
                  else if (el.classList.contains('text-blue-600')) el.style.color = '#2563eb';
                  else el.style.color = '#000000';
                }

                if (style.borderColor.includes('oklch')) {
                  el.style.borderColor = '#000000';
                }
              }
            });
          }
        }
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setNotification("Fehler beim Erstellen des Bildes");
          return;
        }

        const file = new File([blob], `trainingsplan_${localSession?.date || 'heute'}.png`, { type: 'image/png' });

        // Try Web Share API (Mobile)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'FC Auggen Trainingsplan',
              text: `Trainingsplan vom ${new Date(localSession?.date || Date.now()).toLocaleDateString('de-DE')}`
            });
            setNotification("Bild geteilt!");
            setTimeout(() => setNotification(null), 2000);
            return;
          } catch (e) {
            console.log('Share API failed, falling back to download', e);
          }
        }

        // Fallback 1: Clipboard (Desktop/Modern Browsers)
        if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setNotification("Bild in Zwischenablage kopiert! (Jetzt in WhatsApp einfügen)");
            setTimeout(() => setNotification(null), 4000);
            // We also trigger download as double insurance
          } catch (e) {
            console.log("Clipboard write failed", e);
          }
        }

        // Fallback 2: Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trainingsplan_${localSession?.date || 'heute'}.png`;
        a.click();
        URL.revokeObjectURL(url);
        if (!notification?.includes("Zwischenablage")) {
          setNotification("Bild heruntergeladen");
          setTimeout(() => setNotification(null), 2000);
        }
      }, 'image/png');

    } catch (err) {
      console.error("Image share failed", err);
      setNotification(`Fehler: ${err instanceof Error ? err.message : 'Bild-Export fehlgeschlagen'}`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handlePrint = () => {
    if (!localSession) return;
    const isIframe = window.self !== window.top;
    
    if (isIframe) {
      setNotification("Öffne Druckansicht im neuen Tab für zuverlässigen PDF-Druck...");
      try {
        const printUrl = `${window.location.origin}${window.location.pathname}?tab=training_planning&session_id=${localSession.id}&print=true`;
        window.open(printUrl, '_blank');
      } catch (e) {
        console.error("Popup window.open failed, trying iframe print", e);
        try {
          window.focus();
          window.print();
        } catch (printErr) {
          console.error("Iframe print also failed", printErr);
          setNotification("Drucken blockiert. Bitte klicken Sie ganz oben rechts auf das Tab-Symbol mit Pfeil, um die App im Vollbild zu öffnen.");
          setTimeout(() => setNotification(null), 8000);
          return;
        }
      }
      setTimeout(() => setNotification(null), 4000);
    } else {
      setNotification("Druckdialog wird vorbereitet...");
      setTimeout(() => {
        try {
          window.focus();
          window.print();
          console.log("Print triggered from Training Plan");
        } catch (e) {
          console.error("Print failed:", e);
          setNotification("Drucken fehlgeschlagen. Bitte nutzen Sie Google Chrome oder laden Sie die Seite neu.");
          setTimeout(() => setNotification(null), 6000);
          return;
        }
        setTimeout(() => setNotification(null), 3000);
      }, 500);
    }
  };

  const handleExportDocx = async () => {
    if (!localSession) {
      setNotification("Keine Trainingseinheit ausgewählt.");
      return;
    }

    try {
      setNotification("Word-Dokument wird erstellt...");

      // Prepare paragraphs
      const children: any[] = [];

      // 1. Header Title
      children.push(
        new DocxParagraph({
          alignment: DocxAlignmentType.CENTER,
          children: [
            new DocxTextRun({
              text: "FC AUGGEN",
              bold: true,
              size: 32, // 16pt
              color: "C00000",
            }),
            new DocxTextRun({
              text: " - TRAININGSPLAN",
              bold: true,
              size: 32, // 16pt
              color: "000000",
            }),
          ],
          spacing: { after: 240 },
        })
      );

      // Helper function to create bold prefix and value
      const createMetaCell = (label: string, val: string) => {
        return new DocxTableCell({
          width: { size: 50, type: DocxWidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          children: [
            new DocxParagraph({
              children: [
                new DocxTextRun({ text: label + ": ", bold: true, size: 20 }),
                new DocxTextRun({ text: val || "-", size: 20 }),
              ],
            }),
          ],
        });
      };

      // 2. Metadata Table
      const table = new DocxTable({
        width: { size: 100, type: DocxWidthType.PERCENTAGE },
        rows: [
          new DocxTableRow({
            children: [
              createMetaCell("Datum", new Date(localSession.date).toLocaleDateString("de-DE")),
              createMetaCell("Wochentag", localSession.weekday),
            ],
          }),
          new DocxTableRow({
            children: [
              createMetaCell("Gegner", localSession.opponent || "-"),
              createMetaCell("Ort", localSession.location || "-"),
            ],
          }),
          new DocxTableRow({
            children: [
              createMetaCell("T.-Gruppe", localSession.group),
              createMetaCell("Belastung", localSession.load),
            ],
          }),
          new DocxTableRow({
            children: [
              createMetaCell("Dauer", localSession.duration),
              createMetaCell("Intensität", localSession.intensity),
            ],
          }),
        ],
      });

      children.push(table);
      children.push(new DocxParagraph({ spacing: { after: 200 } }));

      // 3. Weekly Focus & Session Focus & Trainer
      const focusChildren = [
        new DocxTextRun({ text: "Wochenschwerpunkt: ", bold: true, size: 20 }),
        new DocxTextRun({ text: (localSession.weeklyFocus || "-") + "\n", size: 20 }),
        new DocxTextRun({ text: "Schwerpunkt: ", bold: true, size: 20 }),
        new DocxTextRun({ text: (localSession.sessionFocus || "-") + "\n", size: 20 }),
        new DocxTextRun({ text: "Trainer: ", bold: true, size: 20 }),
        new DocxTextRun({ text: (localSession.trainer || "-"), size: 20 }),
      ];

      children.push(
        new DocxParagraph({
          children: focusChildren,
          spacing: { after: 200 },
        })
      );

      // 4. Attendance Section (Teilnehmer)
      const sessionPlayers = localSession.players || [];
      const fieldPlayersCount = sessionPlayers.filter(p => p && normalizeCategory(p.category) === "player" && (p.position || "").toUpperCase() !== "TW" && p.status !== "B" && p.status !== "A").length;
      const keepersCount = sessionPlayers.filter(p => p && normalizeCategory(p.category) === "player" && (p.position || "").toUpperCase() === "TW" && p.status !== "B" && p.status !== "A").length;
      const staffCount = sessionPlayers.filter(p => p && normalizeCategory(p.category) !== "player" && p.status !== "B" && p.status !== "A").length;
      const totalCount = sessionPlayers.filter(p => p && normalizeCategory(p.category) === "player" && p.status !== "B" && p.status !== "A").length;

      children.push(
        new DocxParagraph({
          children: [
            new DocxTextRun({ text: "TEILNEHMER SUMMARY", bold: true, size: 24, color: "C00000" }),
          ],
          spacing: { after: 120 },
        })
      );

      children.push(
        new DocxParagraph({
          children: [
            new DocxTextRun({ text: `Spieler: ${fieldPlayersCount}  |  `, size: 20 }),
            new DocxTextRun({ text: `Torhüter: ${keepersCount}  |  `, size: 20 }),
            new DocxTextRun({ text: `Staff: ${staffCount}  |  `, size: 20 }),
            new DocxTextRun({ text: `Gesamt (Sp.): ${totalCount}`, bold: true, size: 20 }),
          ],
          spacing: { after: 120 },
        })
      );

      // Lists of players by status
      const trainingPlayers = sessionPlayers.filter(p => p && p.status === "1");
      const aufbauPlayers = sessionPlayers.filter(p => p && p.status === "A");
      const absentPlayers = sessionPlayers.filter(p => p && p.status === "B");

      if (trainingPlayers.length > 0) {
        children.push(
          new DocxParagraph({
            children: [
              new DocxTextRun({ text: "Anwesend (Training): ", bold: true, size: 20 }),
              new DocxTextRun({ text: trainingPlayers.map(p => `${p.name} (${p.position})`).join(", "), size: 20 }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      if (aufbauPlayers.length > 0) {
        children.push(
          new DocxParagraph({
            children: [
              new DocxTextRun({ text: "Aufbautraining: ", bold: true, size: 20 }),
              new DocxTextRun({ text: aufbauPlayers.map(p => `${p.name} (${p.position})`).join(", "), size: 20 }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      if (absentPlayers.length > 0) {
        children.push(
          new DocxParagraph({
            children: [
              new DocxTextRun({ text: "Abwesend / Verletzt: ", bold: true, size: 20 }),
              new DocxTextRun({ text: absentPlayers.map(p => `${p.name} (${p.position})`).join(", "), size: 20 }),
            ],
            spacing: { after: 200 },
          })
        );
      } else {
        children.push(new DocxParagraph({ spacing: { after: 200 } }));
      }

      // Helper function to append exercise blocks
      const appendBlock = (title: string, duration: string | undefined, text: string, images: string[] | undefined) => {
        children.push(
          new DocxParagraph({
            children: [
              new DocxTextRun({ text: title.toUpperCase(), bold: true, size: 24, color: "C00000" }),
              new DocxTextRun({ text: duration ? ` (${duration})` : "", bold: true, size: 24 }),
            ],
            spacing: { before: 200, after: 120 },
          })
        );

        if (text) {
          const lines = text.split("\n");
          lines.forEach(line => {
            children.push(
              new DocxParagraph({
                children: [new DocxTextRun({ text: line, size: 22 })],
                spacing: { after: 60 },
              })
            );
          });
        } else {
          children.push(
            new DocxParagraph({
              children: [new DocxTextRun({ text: "Keine Inhalte eingetragen.", italics: true, size: 20 })],
              spacing: { after: 100 },
            })
          );
        }

        if (images && images.length > 0) {
          images.forEach((imgBase64) => {
            try {
              const u8 = base64ToUint8Array(imgBase64);
              if (u8) {
                children.push(
                  new DocxParagraph({
                    alignment: DocxAlignmentType.CENTER,
                    children: [
                      new DocxImageRun({
                        data: u8,
                        transformation: {
                          width: 450,
                          height: 280,
                        },
                      } as any),
                    ],
                    spacing: { before: 120, after: 120 },
                  })
                );
              }
            } catch (e) {
              console.error("Failed to render block image in docx", e);
            }
          });
        }
      };

      // 5. Warmup
      appendBlock("Erwärmung", localSession.content.warmupDuration, localSession.content.warmup, localSession.content.warmupImages);

      // 6. Main 1
      appendBlock("Hauptteil 1", localSession.content.main1Duration, localSession.content.main1, localSession.content.main1Images);

      // 7. Main 2
      appendBlock("Hauptteil 2", localSession.content.main2Duration, localSession.content.main2, localSession.content.main2Images);

      // 8. Schluss
      appendBlock("Schluss", localSession.content.closingDuration, localSession.content.closing, localSession.content.closingImages);

      // 9. Wichtig
      if (localSession.importantInfo || (localSession.importantInfoImages && localSession.importantInfoImages.length > 0)) {
        appendBlock("Wichtig", undefined, localSession.importantInfo, localSession.importantInfoImages);
      }

      // 10. Bemerkungen
      if (localSession.remarks || (localSession.remarksImages && localSession.remarksImages.length > 0)) {
        appendBlock("Bemerkungen", undefined, localSession.remarks, localSession.remarksImages);
      }

      // Create doc
      const doc = new DocxDocument({
        sections: [
          {
            properties: {},
            children: children,
          },
        ],
      });

      // Packer
      const blob = await DocxPacker.toBlob(doc);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Trainingsplan_${localSession.date}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);

      setNotification("Word-Dokument heruntergeladen");
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error("Docx generation failed", err);
      setNotification(`Fehler: ${err instanceof Error ? err.message : "Word-Export fehlgeschlagen"}`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleLoadSquad = () => {
    if (localSession) {
      pushUndoState();
      const sortedSquad = sortPlayers(players.filter(isPlayer));
      const sortedStaff = sortPlayers(players.filter(p => !isPlayer(p)));
      
      const updatedPlayers = [
        ...sortedSquad.map(p => ({
          name: p.lastName,
          position: p.position,
          status: '1' as any,
          category: p.category
        })),
        ...sortedStaff.map(p => ({
          name: p.lastName,
          position: p.position,
          status: '1' as any,
          category: p.category
        }))
      ];
      setLocalSession({ ...localSession, players: updatedPlayers });
      // Ensure it gets saved
      saveSession({ ...localSession, players: updatedPlayers });
    }
  };

  const updateField = (field: keyof TrainingSession, value: any) => {
    if (localSession) {
      pushUndoState();
      const updates: any = { [field]: value };
      if (field === 'date' && value) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          updates.weekday = date.toLocaleDateString('de-DE', { weekday: 'long' });
        }
      }
      setLocalSession({ ...localSession, ...updates });
    }
  };

  const calculateTotalDuration = () => {
    if (!localSession) return 0;
    const durations = [
      localSession.content.warmupDuration,
      localSession.content.main1Duration,
      localSession.content.main2Duration,
      localSession.content.closingDuration,
    ];
    
    return durations.reduce((total, d) => {
      if (!d) return total;
      const matches = d.match(/\d+/);
      return total + (matches ? parseInt(matches[0], 10) : 0);
    }, 0);
  };

  const updateContent = (field: keyof TrainingSession['content'], value: string) => {
    pushUndoState();
    setLocalSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        content: { ...prev.content, [field]: value }
      };
    });
  };

  const updateMultipleContent = (updates: Partial<TrainingSession['content']>) => {
    pushUndoState();
    setLocalSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        content: { ...prev.content, ...updates }
      };
    });
  };

  const processImagesForSession = (images: string[] | string, targetSlot?: keyof TrainingSession['content']) => {
    if (!localSession) return;
    pushUndoState();
    const imageList = Array.isArray(images) ? images : [images];
    
    setLocalSession(prev => {
      if (!prev) return null;
      
      const newContent = { ...prev.content };
      
      if (targetSlot) {
        // Targeted append
        const currentImages = Array.isArray(newContent[targetSlot]) ? (newContent[targetSlot] as string[]) : [];
        (newContent[targetSlot] as string[]) = [...currentImages, ...imageList];
      } else {
        // Global drop - append to first available or warmup by default
        const currentImages = Array.isArray(newContent.warmupImages) ? (newContent.warmupImages as string[]) : [];
        newContent.warmupImages = [...currentImages, ...imageList];
      }
      
      return {
        ...prev,
        content: newContent
      };
    });
    
    setNotification(imageList.length === 1 ? "Bild hinzugefügt" : `${imageList.length} Bilder hinzugefügt`);
    setTimeout(() => setNotification(null), 2000);
  };

  const updatePlayerStatus = (index: number, status: any) => {
    if (localSession) {
      pushUndoState();
      const newPlayers = [...localSession.players];
      newPlayers[index] = { ...newPlayers[index], status };
      const updatedSession = { ...localSession, players: newPlayers };
      setLocalSession(updatedSession);
      if (isEditing) {
        saveSession(updatedSession);
      }
    }
  };

  const resolveImageField = (field: keyof TrainingSession['content']): keyof TrainingSession['content'] => {
    return `${field}Images` as keyof TrainingSession['content'];
  };

  const handleTextAreaDrop = async (e: React.DragEvent, targetSlot: keyof TrainingSession['content']) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imageFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          imageFiles.push(files[i]);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const processedImages = await Promise.all(imageFiles.map(async (file) => {
            const base64 = await fileToBase64(file);
            return compressImage(base64);
          }));

          processImagesForSession(processedImages, targetSlot);
        } catch (err) {
          console.error("Textarea drop failed", err);
        }
      }
    }
  };

  const handleTextAreaPaste = async (e: React.ClipboardEvent, field: keyof TrainingSession['content']) => {
    if (!isEditing) return;
    
    // Try from items
    const items = e.clipboardData.items;
    const imageBlobs: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) imageBlobs.push(blob);
      }
    }

    if (imageBlobs.length > 0) {
      const text = e.clipboardData.getData('text/plain');
      // If significant text, skip image processing to avoid dual-pasting
      if (text && text.trim().length > 5) {
        return; 
      }

      if (!text || text.trim().length === 0) {
        e.preventDefault();
      }

      try {
        const processedImages = await Promise.all(imageBlobs.map(async (blob) => {
          const base64 = await fileToBase64(blob);
          return compressImage(base64);
        }));

        processImagesForSession(processedImages, resolveImageField(field));
      } catch (err) {
        console.error("Paste to textarea failed", err);
      }
    }

    // Fallback: Try from files
    if (imageBlobs.length === 0 && e.clipboardData.files && e.clipboardData.files.length > 0) {
      const imageFiles: File[] = [];
      for (let i = 0; i < e.clipboardData.files.length; i++) {
        if (e.clipboardData.files[i].type.startsWith('image/')) {
          imageFiles.push(e.clipboardData.files[i]);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        try {
          const processedImages = await Promise.all(imageFiles.map(async (file) => {
            const base64 = await fileToBase64(file);
            return compressImage(base64);
          }));

          processImagesForSession(processedImages, resolveImageField(field));
        } catch (err) {
          console.error("Paste to textarea failed via files", err);
        }
      }
    }
  };

  const handleSlotSequenceUpload = (targetSlot: keyof TrainingSession['content'], base64OrList: string | string[]) => {
    const images = Array.isArray(base64OrList) ? base64OrList : [base64OrList];
    processImagesForSession(images, targetSlot);
  };

  const removePlayerFromSession = (index: number) => {
    if (localSession) {
      pushUndoState();
      const newPlayers = [...(localSession.players || [])];
      newPlayers.splice(index, 1);
      const updatedSession = { ...localSession, players: newPlayers };
      setLocalSession(updatedSession);
      if (isEditing) {
        saveSession(updatedSession);
      }
    }
  };

  const addPlayerToSession = (player: Player) => {
    if (localSession) {
      pushUndoState();
      // Check if player already in session
      const name = player.lastName;
      if ((localSession.players || []).some(p => p && (p.name === name || p.name === `${player.lastName} ${player.firstName}`))) return;

      const newPlayerEntry = {
        name,
        position: player.position,
        status: '1' as any,
        category: player.category
      };
      
      const updatedPlayers = sortPlayers([...(localSession.players || []), newPlayerEntry]);
      const updatedSession = { ...localSession, players: updatedPlayers };
      setLocalSession(updatedSession);
      if (isEditing) {
        saveSession(updatedSession);
      }
    }
  };

  if (!localSession && sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-gray-400">
        <Calendar size={64} className="mb-4 opacity-20" />
        <p className="text-xl font-bold uppercase tracking-widest mb-8">Keine Trainingseinheiten geplant</p>
        <div className="flex gap-4">
          <button 
            onClick={handleAddSession}
            className="bg-black text-white px-8 py-4 font-black uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <Plus size={24} /> Erste Einheit erstellen
          </button>
          <button 
            onClick={handleGenerateUnits}
            className="bg-blue-600 text-white px-8 py-4 font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <Calendar size={24} /> 47 Einheiten generieren (06.07 - 21.08)
          </button>
          {(bulkUndoSnapshot || bulkGeneratedIds.length > 0) && (
            <button 
              onClick={handleBulkUndo}
              className="bg-amber-600 text-white px-8 py-4 font-black uppercase tracking-widest hover:bg-amber-700 transition-all flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              title="Generierte Einheiten rückgängig machen"
            >
              <RotateCcw size={24} /> Generierung rückgängig
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      {/* 3-Wochenplan · Stufen 1-9 (Intensität Auto) Periodisierungs-Leiste */}
      <WeeklyPeriodizationPlanBar
        sessions={sessions}
        competitiveMatches={competitiveMatches}
        selectedSessionId={selectedSessionId}
        onSelectSession={onSelectSession}
        onSaveSession={saveSession}
        onDeleteSession={deleteSession}
        players={players}
      />

      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden print:h-auto print:overflow-visible">
        {/* Sidebar - Einheiten Liste */}
      <div className="w-full lg:w-64 bg-white border-b-2 lg:border-b-0 lg:border-r-2 border-black flex flex-col shrink-0 print:hidden">
        <div className="p-4 border-b-2 border-black bg-black text-white flex justify-between items-center">
          <h3 className="font-black uppercase text-xs tracking-widest">Einheiten</h3>
          <button onClick={handleAddSession} className="hover:text-red-500 transition-colors">
            <Plus size={18} />
          </button>
        </div>
        <div className="max-h-36 lg:max-h-none lg:flex-1 overflow-y-auto custom-scrollbar">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              className={`w-full p-4 text-left border-b border-black/10 transition-colors flex flex-col gap-1 ${selectedSessionId === s.id ? 'bg-amber-100 border-l-4 border-l-red-600' : 'bg-white hover:bg-slate-100'}`}
            >
              <span className="font-black text-xs text-slate-900">{new Date(s.date).toLocaleDateString('de-DE')}</span>
              <span className="text-[10px] uppercase font-bold text-slate-700 truncate">{s.sessionFocus || 'Kein Schwerpunkt'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:overflow-hidden overflow-visible print:overflow-visible print:h-auto">
        {/* Toolbar */}
        <div className="p-2 bg-white border-b-2 border-black flex justify-between items-center shrink-0 print:hidden text-slate-900">
          <div className="flex items-center gap-1">
            <button 
              onClick={handleAddSession}
              className="p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 text-slate-900"
              title="Hinzufügen"
            >
              <Plus size={18} className="text-slate-900" />
              <span className="text-[9px] font-black uppercase text-slate-900">Hinzufügen</span>
            </button>
            <button 
              onClick={handleDelete}
              className="p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 text-red-600"
              title="Entfernen"
            >
              <Trash2 size={18} />
              <span className="text-[9px] font-black uppercase">Entfernen</span>
            </button>
            <button 
              onClick={handleGenerateUnits}
              className="p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 text-blue-600"
              title="Generieren"
            >
              <Calendar size={18} />
              <span className="text-[9px] font-black uppercase">Generieren</span>
            </button>
            <button 
              onClick={handleReset}
              className="p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 text-orange-600"
              title="Reset"
            >
              <Activity size={18} />
              <span className="text-[9px] font-black uppercase">Reset</span>
            </button>
            <div className="w-px h-8 bg-black/10 mx-1" />
            <button 
              onClick={() => setShowDocumentModal(true)}
              className="p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 text-purple-600"
              title="Bibliothek & Dokumente"
            >
              <FileText size={18} />
              <span className="text-[9px] font-black uppercase underline decoration-2">Bibliothek</span>
            </button>
            <div className="w-px h-8 bg-black/10 mx-1" />
            <button 
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className={`p-2 rounded transition-colors flex flex-col items-center gap-1 ${undoStack.length > 0 ? 'hover:bg-slate-100 text-slate-900 cursor-pointer' : 'opacity-30 cursor-not-allowed text-gray-400'}`}
              title="Änderung rückgängig machen (Strg+Z)"
            >
              <Undo2 size={18} className="text-slate-900" />
              <span className="text-[9px] font-black uppercase text-slate-900">Rückgängig {undoStack.length > 0 ? `(${undoStack.length})` : ''}</span>
            </button>
            <button 
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className={`p-2 rounded transition-colors flex flex-col items-center gap-1 ${redoStack.length > 0 ? 'hover:bg-slate-100 text-slate-900 cursor-pointer' : 'opacity-30 cursor-not-allowed text-gray-400'}`}
              title="Wiederherstellen (Strg+Y)"
            >
              <Redo2 size={18} className="text-slate-900" />
              <span className="text-[9px] font-black uppercase text-slate-900">Wiederholen</span>
            </button>
            {(bulkUndoSnapshot || bulkGeneratedIds.length > 0) && (
              <button 
                onClick={handleBulkUndo}
                className="p-2 hover:bg-amber-100 bg-amber-50 border border-amber-300 rounded transition-colors flex flex-col items-center gap-1 text-amber-800"
                title="Generierte Einheiten komplett rückgängig machen"
              >
                <RotateCcw size={18} className="text-amber-700" />
                <span className="text-[9px] font-black uppercase text-amber-900">Gen. Rückgängig</span>
              </button>
            )}
            <button 
              onClick={handleRestoreInitial}
              disabled={!initialSessionSnapshot || undoStack.length === 0}
              className={`p-2 rounded transition-colors flex flex-col items-center gap-1 ${initialSessionSnapshot && undoStack.length > 0 ? 'hover:bg-amber-50 text-amber-700 cursor-pointer' : 'opacity-30 cursor-not-allowed text-gray-400'}`}
              title="Auf ursprünglichen Stand vor den Änderungen zurücksetzen"
            >
              <RotateCcw size={18} />
              <span className="text-[9px] font-black uppercase">Zurücksetzen</span>
            </button>
            <div className="w-px h-8 bg-black/10 mx-1" />
            <button 
              onClick={handleSave}
              className={`p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 ${isEditing ? 'text-green-600' : 'opacity-40 text-slate-400'}`}
              disabled={!isEditing}
              title="Speichern"
            >
              <Save size={18} />
              <span className="text-[9px] font-black uppercase">Speichern</span>
            </button>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 ${isEditing ? 'bg-black text-white hover:bg-gray-800' : 'text-slate-900'}`}
              title="Bearbeiten"
            >
              <Edit2 size={18} />
              <span className="text-[9px] font-black uppercase">Bearbeiten</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={handlePrint}
              className="p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 text-blue-600"
              title="Trainingsplan ausdrucken"
            >
              <Printer size={18} />
              <span className="text-[9px] font-black uppercase">Drucken</span>
            </button>
            <button 
              onClick={handleExportDocx}
              className="p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 text-purple-600"
              title="Als Word-Dokument (.docx) exportieren"
            >
              <FileText size={18} />
              <span className="text-[9px] font-black uppercase">Word (.docx)</span>
            </button>
            <button 
              onClick={handleShareImage}
              className="p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 text-slate-900"
              title="Per E-Mail teilen (Bild)"
            >
              <Mail size={18} />
              <span className="text-[9px] font-black uppercase">E-Mail</span>
            </button>
            <button 
              onClick={handleShareImage}
              className="p-2 hover:bg-slate-100 rounded transition-colors flex flex-col items-center gap-1 text-green-600"
              title="Per WhatsApp teilen (Bild)"
            >
              <MessageCircle size={18} />
              <span className="text-[9px] font-black uppercase">WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Form Area */}
        {localSession ? (
          <div 
            key={localSession.id}
            className={`flex-1 overflow-y-auto p-6 custom-scrollbar transition-colors print:overflow-visible print:h-auto print:p-0 ${dragActive ? 'bg-blue-50' : ''}`}
            onDragOver={(e) => {
              if (isEditing) {
                e.preventDefault();
                setDragActive(true);
              }
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={async (e) => {
              if (isEditing) {
                e.preventDefault();
                setDragActive(false);
                const files = Array.from(e.dataTransfer.files);
                const imageFiles = files.filter(f => f.type.startsWith('image/'));
                if (imageFiles.length > 0) {
                  const processed = await Promise.all(imageFiles.map(async (f) => {
                    const b64 = await fileToBase64(f);
                    return compressImage(b64);
                  }));
                  processImagesForSession(processed);
                }
              }
            }}
          >
            <div id="training-plan-card" className="max-w-6xl mx-auto bg-white text-slate-900 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 flex flex-col print:shadow-none print:max-w-none print:w-full print:border-none print:mx-0 print:overflow-visible print:h-auto">
              
              {/* Top Header Row - Responsive Columns */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 border-b-2 border-black bg-white text-[10px] font-black uppercase text-slate-900">
                <div className="p-2 border-r-2 border-black">
                  <span className="text-slate-600 font-bold block mb-0.5">Datum:</span>
                  {isEditing ? (
                    <input 
                      type="date" 
                      value={localSession.date}
                      onChange={(e) => updateField('date', e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none focus:border-black"
                    />
                  ) : (
                    <div className="font-bold text-xs text-slate-900">{new Date(localSession.date).toLocaleDateString('de-DE')}</div>
                  )}
                </div>
                <div className="p-2 border-r-2 border-black">
                  <span className="text-slate-600 font-bold block mb-0.5">Wochentag:</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={localSession.weekday}
                      onChange={(e) => updateField('weekday', e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none focus:border-black"
                    />
                  ) : (
                    <div className="font-bold text-xs text-slate-900">{localSession.weekday}</div>
                  )}
                </div>
                <div className="p-2 border-r-2 border-black">
                  <span className="text-slate-600 font-bold block mb-0.5">Gegner:</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={localSession.opponent || ''}
                      onChange={(e) => updateField('opponent', e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none focus:border-black"
                    />
                  ) : (
                    <div className="font-bold text-xs text-slate-900">{localSession.opponent || '-'}</div>
                  )}
                </div>
                <div className="p-2 border-r-2 border-black">
                  <span className="text-slate-600 font-bold block mb-0.5">Ort:</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={localSession.location || ''}
                      onChange={(e) => updateField('location', e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none focus:border-black"
                    />
                  ) : (
                    <div className="font-bold text-xs text-slate-900">{localSession.location || '-'}</div>
                  )}
                </div>
                <div className="p-2 border-r-2 border-black">
                  <span className="text-slate-600 font-bold block mb-0.5">T.-Gruppe:</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={localSession.group}
                      onChange={(e) => updateField('group', e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none focus:border-black"
                    />
                  ) : (
                    <div className="font-bold text-xs text-slate-900">{localSession.group}</div>
                  )}
                </div>
                <div 
                  className="p-2 border-r-2 border-black transition-colors"
                  style={{ backgroundColor: activeStage.bg, color: activeStage.text }}
                >
                  <span className="font-bold block mb-0.5 opacity-80" style={{ color: activeStage.text }}>Belastung:</span>
                  {isEditing ? (
                    <select 
                      value={localSession.load}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = TRAINING_INTENSITY_STAGES.find(s => s.label === val);
                        if (match) {
                          handleSelectIntensityStage(match);
                        } else {
                          updateField('load', val);
                        }
                      }}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none focus:border-black"
                    >
                      {TRAINING_INTENSITY_STAGES.map(s => (
                        <option key={s.level} value={s.label}>{s.label} ({s.percent})</option>
                      ))}
                    </select>
                  ) : (
                    <div className="font-black text-xs">{localSession.load || activeStage.label}</div>
                  )}
                </div>
                <div className="p-2 border-r-2 border-black">
                  <span className="text-slate-600 font-bold block mb-0.5">Dauer:</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={localSession.duration}
                      onChange={(e) => updateField('duration', e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none focus:border-black"
                    />
                  ) : (
                    <div className="font-bold text-xs text-slate-900">{localSession.duration || activeStage.duration}</div>
                  )}
                </div>
                <div className="p-2 border-r-2 border-black">
                  <span className="text-slate-600 font-bold block mb-0.5">Intensität:</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={localSession.intensity}
                      onChange={(e) => updateField('intensity', e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none focus:border-black"
                    />
                  ) : (
                    <div className="font-bold text-xs text-slate-900">{localSession.intensity || activeStage.percent}</div>
                  )}
                </div>
                {/* Quadratisches Kennzeichnungsfeld oben rechts mit Stufennummer */}
                <div className="p-2 flex justify-end items-center">
                  <div 
                    className="w-8 h-8 border-2 border-black flex flex-col items-center justify-center font-black shadow-sm rounded-xs transition-all"
                    style={{ backgroundColor: activeStage.bg, color: activeStage.text }}
                    title={`${activeStage.label}: ${activeStage.percent} • ${activeStage.duration} (${activeStage.colorName})`}
                  >
                    <span className="leading-none text-xs font-black">{activeStage.level}</span>
                  </div>
                </div>
              </div>

              {/* Focus Row */}
              <div className="grid grid-cols-2 border-b-2 border-black bg-white text-[10px] font-black uppercase text-slate-900">
                <div className="p-2 border-r-2 border-black">
                  <span className="text-slate-600 font-bold block mb-0.5">Wochenschwerpunkt:</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={localSession.weeklyFocus}
                      onChange={(e) => updateField('weeklyFocus', e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none focus:border-black"
                    />
                  ) : (
                    <div className="font-bold text-xs text-slate-900">{localSession.weeklyFocus || '-'}</div>
                  )}
                </div>
                <div className="p-2">
                  <span className="text-slate-600 font-bold block mb-0.5">Schwerpunkt Einheit:</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={localSession.sessionFocus}
                      onChange={(e) => updateField('sessionFocus', e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none focus:border-black"
                    />
                  ) : (
                    <div className="font-bold text-xs text-slate-900">{localSession.sessionFocus || '-'}</div>
                  )}
                </div>
              </div>

              {/* Trainer Row */}
              <div className="flex justify-between items-center border-b-2 border-black bg-slate-50 text-[10px] font-black uppercase p-2 text-slate-900">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Steuerung:</span>
                  <span 
                    className="px-2 py-0.5 rounded font-black text-[9px] border border-black/20 shadow-xs"
                    style={{ backgroundColor: activeStage.bg, color: activeStage.text }}
                  >
                    {activeStage.label} · {activeStage.percent} · {activeStage.duration}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-slate-600 font-bold mr-2">Trainer:</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={localSession.trainer}
                      onChange={(e) => updateField('trainer', e.target.value)}
                      className="bg-white text-slate-900 border border-slate-300 rounded px-1 font-bold text-xs outline-none text-right"
                      placeholder="Amin, marcel"
                    />
                  ) : (
                    <div className="font-bold text-xs text-slate-900">{localSession.trainer || 'Amin, marcel'}</div>
                  )}
                </div>
              </div>

              {/* Interaktive Unterleiste (Stufen 1 – 9) direkt unter Trainer-Zeile */}
              <div className="border-b-2 border-black bg-slate-100 p-2 print:hidden">
                <div className="text-[9px] font-black uppercase text-slate-700 mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-950 font-black">⚡ Belastungs- & Intensitätsstufen (1 – 9):</span>
                    <span className="text-slate-500 font-medium">Klick übernimmt Farbe, % & Richtzeit</span>
                  </div>
                  <span className="text-[8px] font-bold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 uppercase tracking-wider">
                    Trainer-Selbstbestimmung aktiv
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
                  {TRAINING_INTENSITY_STAGES.map((stage) => {
                    const isSelected = activeStage.level === stage.level;
                    return (
                      <button
                        key={stage.level}
                        type="button"
                        onClick={() => handleSelectIntensityStage(stage)}
                        style={{
                          backgroundColor: stage.bg,
                          color: stage.text,
                          borderColor: isSelected ? '#000000' : stage.border
                        }}
                        className={`p-1.5 rounded flex flex-col items-center justify-center text-center transition-all cursor-pointer border-2 select-none hover:shadow-md ${
                          isSelected ? 'ring-2 ring-black font-black scale-[1.03] shadow-md z-10' : 'opacity-90 hover:opacity-100 hover:scale-[1.01]'
                        }`}
                        title={`${stage.label}: ${stage.percent} • ${stage.duration} (${stage.colorName})`}
                      >
                        <div className="flex items-center gap-0.5 leading-tight">
                          <span className="text-[10px] font-black uppercase tracking-tight">{stage.label}</span>
                          {isSelected && <span className="text-[7px]">●</span>}
                        </div>
                        <div className="text-[8.5px] font-black leading-tight tracking-tighter">{stage.percent}</div>
                        <div className="text-[7.5px] font-semibold opacity-90 leading-tight truncate max-w-full">{stage.duration}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Content Area - Split Layout */}
              <div className="flex flex-col lg:flex-row flex-1 min-h-[600px] print:h-auto print:min-h-0 print:overflow-visible">
                {/* Left Column: Player List */}
                <div className="w-full lg:w-1/3 border-b-2 lg:border-b-0 lg:border-r-2 border-black flex flex-col bg-slate-50 print:bg-white print:overflow-visible print:h-auto">
                  <div className="bg-black text-white p-2 shrink-0 flex justify-between items-center">
                    <h3 className="font-black uppercase tracking-widest text-[10px]">Anwesenheit</h3>
                    <div className="flex items-center gap-2">
                      {isEditing && (
                        <button 
                          onClick={() => setShowAddPlayerModal(true)}
                          className="p-1 hover:text-green-500 transition-colors"
                          title="Spieler hinzufügen"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <Users size={14} />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar print:overflow-visible print:h-auto player-list-print-grid">
                    {(localSession.players || []).length === 0 ? (
                      <div className="p-8 text-center opacity-20 italic font-black uppercase text-[10px] text-slate-600">
                        Keine Spieler geladen
                      </div>
                    ) : (
                      (localSession.players || []).map((p, idx) => {
                        if (!p) return null;
                        const fullPlayer = players.find(fp => fp.lastName === p.name || `${fp.lastName} ${fp.firstName}` === p.name);
                        const cat = p.category || fullPlayer?.category || 'player';
                        const isStaff = !isPlayer({ category: cat });
                        
                        // Check if we need a separator line before this item
                        const prevPlayer = idx > 0 ? (localSession.players || [])[idx - 1] : null;
                        const prevCat = prevPlayer?.category || 'player';
                        const prevIsStaff = !isPlayer({ category: prevCat });
                        
                        const showSeparator = idx > 0 && isStaff && !prevIsStaff;

                        return (
                          <React.Fragment key={`${p.name}-${idx}`}>
                            {showSeparator && (
                              <div className="border-t-4 border-black bg-gray-200 p-1 flex items-center justify-center">
                                <span className="text-[8px] font-black uppercase tracking-widest text-black/60">Trainer- & Funktionsteam</span>
                              </div>
                            )}
                            <div
                              className={`w-full flex items-center justify-between p-2 border-b border-black last:border-b-0 transition-all bg-white relative overflow-hidden group hover:bg-slate-50`}
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${getCategoryColor(cat)}`} />
                              
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`w-7 h-7 flex items-center justify-center text-[10px] font-black border border-black shrink-0 transition-transform group-hover:scale-105 bg-slate-100 text-slate-900 ${getCategoryBorderColor(cat)} border-2`}>
                                    {(normalizeCategory(cat) === 'player') ? `#${fullPlayer?.number || '?'}` : getCategoryIcon(cat)}
                                  </span>
                                  <div className="text-left min-w-0 flex-1 flex items-center gap-2">
                                    <p className="font-black uppercase text-[11px] text-slate-900 leading-tight truncate flex-1">
                                      {p.name}
                                    </p>
                                    <div className="w-14 border-l border-black/20 pl-2 shrink-0">
                                      <p className="text-[9px] font-black uppercase text-slate-900 truncate text-center leading-none">
                                        {p.position}
                                      </p>
                                    </div>
                                  </div>
                              </div>
                              
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                              {isEditing && (
                                <button 
                                  onClick={() => removePlayerFromSession(idx)}
                                  className="w-6 h-6 flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors mr-1"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                              {isEditing ? (
                                <select 
                                  value={p.status}
                                  onChange={(e) => updatePlayerStatus(idx, e.target.value)}
                                  className={`
                                    min-w-[40px] px-1 py-0.5 border-2 border-black text-[10px] font-black uppercase focus:outline-none transition-colors
                                    ${p.status === '1' ? 'bg-green-100 text-green-800' : ''}
                                    ${p.status === 'A' ? 'bg-yellow-100 text-yellow-800' : ''}
                                    ${p.status === 'B' ? 'bg-red-100 text-red-800' : ''}
                                  `}
                                >
                                  <option value="1" className="bg-white text-slate-900">1</option>
                                  <option value="A" className="bg-white text-slate-900">A</option>
                                  <option value="B" className="bg-white text-slate-900">B</option>
                                </select>
                              ) : (
                                <div className={`
                                  w-6 h-6 flex items-center justify-center border-2 border-black text-[10px] font-black
                                  ${p.status === '1' ? 'bg-green-500 text-white' : ''}
                                  ${p.status === 'A' ? 'bg-yellow-400 text-black' : ''}
                                  ${p.status === 'B' ? 'bg-red-600 text-white' : ''}
                                `}>
                                  {p.status}
                                </div>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                        );
                      })
                    )}
                  </div>

                  {/* Player Counts Summary */}
                  {(localSession.players || []).length > 0 && (
                    <div className="p-2 border-t-2 border-black bg-slate-100 flex justify-between items-center text-[9px] font-black uppercase text-slate-900 shrink-0">
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-600 font-bold">Spieler:</span>
                          <span className="text-slate-900 font-black">{(localSession.players || []).filter(p => p && normalizeCategory(p.category) === 'player' && (p.position || '').toUpperCase() !== 'TW' && p.status !== 'B' && p.status !== 'A').length}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-600 font-bold">TW:</span>
                          <span className="text-blue-700 font-black">{(localSession.players || []).filter(p => p && normalizeCategory(p.category) === 'player' && (p.position || '').toUpperCase() === 'TW' && p.status !== 'B' && p.status !== 'A').length}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-600 font-bold">Staff:</span>
                          <span className="text-slate-900 font-black">{(localSession.players || []).filter(p => p && normalizeCategory(p.category) !== 'player' && p.status !== 'B' && p.status !== 'A').length}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-600 font-bold">Gesamt (Sp.):</span>
                        <span className="text-[#C00000] font-black underline">{(localSession.players || []).filter(p => p && normalizeCategory(p.category) === 'player' && p.status !== 'B' && p.status !== 'A').length}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Legend */}
                  <div className="p-2 border-t-2 border-black bg-slate-100 text-[9px] font-black uppercase text-slate-900 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 border border-black flex items-center justify-center text-white font-bold">1</div>
                      <span className="text-slate-900">Training</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-400 border border-black flex items-center justify-center text-slate-900 font-bold">A</div>
                      <span className="text-slate-900">Aufbau</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-600 border border-black flex items-center justify-center text-white font-bold">B</div>
                      <span className="text-slate-900">Verletzt/Krank/Entschuldigt</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Content Sections */}
                <div className="flex-1 flex flex-col print:overflow-visible print:h-auto">
                  {/* Intensitäts-Banner im Übungsteil */}
                  <div 
                    style={{ backgroundColor: activeStage.bg, color: activeStage.text }}
                    className="border-b-2 border-black p-2 flex justify-center items-center gap-3 text-[10px] font-black uppercase transition-colors"
                  >
                    <span className="font-black">Intensität:</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={localSession.intensity}
                        onChange={(e) => updateField('intensity', e.target.value)}
                        className="bg-white text-slate-900 border border-black font-black text-xs outline-none text-center px-2 py-0.5 rounded"
                        placeholder={activeStage.percent}
                      />
                    ) : (
                      <span className="font-black text-xs">{localSession.intensity || activeStage.percent}</span>
                    )}
                    <span className="text-[9px] px-2 py-0.5 rounded border border-black/20 font-black">
                      {activeStage.label} • {activeStage.duration} ({activeStage.colorName})
                    </span>
                  </div>

                  {/* Content Sections */}
                  <div className="flex-1 flex flex-col print:overflow-visible print:h-auto text-slate-900">
                    <div className="flex-1 border-b-2 border-black flex flex-col min-h-[150px] print:min-h-0 print:h-auto print:overflow-visible print:avoid-break">
                      <div className="bg-slate-100 text-slate-900 p-1 border-b border-black text-[9px] font-black uppercase flex justify-between items-center">
                        <span className="text-slate-900 font-black">Erwärmung:</span>
                        <div className="flex items-center gap-1">
                          <Clock size={10} className="text-slate-900" />
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={localSession.content.warmupDuration || ''}
                              onChange={(e) => updateContent('warmupDuration', e.target.value)}
                              className="w-12 bg-white text-slate-900 border border-black px-1 text-[9px] font-bold outline-none"
                              placeholder="min"
                            />
                          ) : (
                            <span className="bg-white text-slate-900 font-bold border border-black px-1 text-[9px]">{localSession.content.warmupDuration || '-'}</span>
                          )}
                        </div>
                      </div>
                      <div className="bg-slate-100 text-slate-900 p-1 border-b border-black text-[9px] font-black uppercase text-center">Aktivierung</div>
                      <div className="flex-1 flex flex-col sm:flex-row min-h-0 print:h-auto print:min-h-0 print:overflow-visible">
                        {isEditing ? (
                          <textarea 
                            value={localSession.content.warmup || ''}
                            onChange={(e) => updateContent('warmup', e.target.value)}
                            onPaste={(e) => handleTextAreaPaste(e, 'warmup')}
                            onDrop={(e) => handleTextAreaDrop(e, resolveImageField('warmup'))}
                            onDragOver={(e) => e.preventDefault()}
                            placeholder="Text hier einfügen... (Bilder können auch einfach mit Strg+V oder Drag & Drop eingefügt werden)"
                            className="flex-1 p-4 font-bold text-xs text-slate-900 bg-white border border-slate-300 rounded outline-none resize-none w-full placeholder:text-slate-400"
                          />
                        ) : (
                          <div className="flex-1 p-4 font-bold text-sm text-slate-900 bg-white whitespace-pre-wrap w-full">{localSession.content.warmup}</div>
                        )}
                        <div className="flex gap-1 p-1 overflow-x-auto border-t sm:border-t-0 sm:border-l border-black bg-slate-50 w-full sm:min-w-[120px] sm:max-w-[400px] print:flex-wrap print:overflow-visible print:max-w-none print:w-auto print:border-none print:bg-white shrink-0">
                          {(localSession.content.warmupImages || []).map((img, idx) => (
                            <ImageUpload 
                              key={idx}
                              onUpload={(data) => {
                                const imgs = [...(localSession.content.warmupImages || [])];
                                imgs[idx] = Array.isArray(data) ? data[0] : data;
                                updateContent('warmupImages' as any, imgs as any);
                              }}
                              onDelete={() => {
                                const imgs = [...(localSession.content.warmupImages || [])];
                                imgs.splice(idx, 1);
                                updateContent('warmupImages' as any, imgs as any);
                              }}
                              currentImage={img}
                              isEditing={isEditing}
                              className="w-32 h-full flex-shrink-0 print:w-40 print:h-40 print:m-1"
                            />
                          ))}
                          {isEditing && (
                            <ImageUpload 
                              onUpload={(data) => processImagesForSession(data, 'warmupImages' as any)}
                              isEditing={true}
                              label="+"
                              className="w-12 h-full flex-shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 border-b-2 border-black flex flex-col min-h-[150px] print:min-h-0 print:h-auto print:overflow-visible print:avoid-break">
                      <div className="bg-slate-100 p-1 border-b border-black text-[9px] font-black uppercase flex justify-between items-center text-slate-900">
                        <span className="text-slate-900 font-black">Hauptteil 1:</span>
                        <div className="flex items-center gap-1">
                          <Clock size={10} className="text-slate-900" />
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={localSession.content.main1Duration || ''}
                              onChange={(e) => updateContent('main1Duration', e.target.value)}
                              className="w-12 bg-white text-slate-900 border border-black px-1 text-[9px] font-bold outline-none"
                              placeholder="min"
                            />
                          ) : (
                            <span className="bg-white text-slate-900 font-bold border border-black px-1 text-[9px]">{localSession.content.main1Duration || '-'}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col sm:flex-row min-h-0 print:h-auto print:min-h-0 print:overflow-visible">
                        {isEditing ? (
                          <textarea 
                            value={localSession.content.main1 || ''}
                            onChange={(e) => updateContent('main1', e.target.value)}
                            onPaste={(e) => handleTextAreaPaste(e, 'main1')}
                            onDrop={(e) => handleTextAreaDrop(e, resolveImageField('main1'))}
                            onDragOver={(e) => e.preventDefault()}
                            placeholder="Text hier einfügen... (Bilder können auch einfach mit Strg+V oder Drag & Drop eingefügt werden)"
                            className="flex-1 p-4 font-bold text-xs text-slate-900 bg-white border border-slate-300 rounded outline-none resize-none w-full placeholder:text-slate-400"
                          />
                        ) : (
                          <div className="flex-1 p-4 font-bold text-sm text-slate-900 bg-white whitespace-pre-wrap w-full">{localSession.content.main1}</div>
                        )}
                        <div className="flex gap-1 p-1 overflow-x-auto border-t sm:border-t-0 sm:border-l border-black bg-slate-50 w-full sm:min-w-[120px] sm:max-w-[400px] print:flex-wrap print:overflow-visible print:max-w-none print:w-auto print:border-none print:bg-white shrink-0">
                          {(localSession.content.main1Images || []).map((img, idx) => (
                            <ImageUpload 
                              key={idx}
                              onUpload={(data) => {
                                const imgs = [...(localSession.content.main1Images || [])];
                                imgs[idx] = Array.isArray(data) ? data[0] : data;
                                updateContent('main1Images' as any, imgs as any);
                              }}
                              onDelete={() => {
                                const imgs = [...(localSession.content.main1Images || [])];
                                imgs.splice(idx, 1);
                                updateContent('main1Images' as any, imgs as any);
                              }}
                              currentImage={img}
                              isEditing={isEditing}
                              className="w-32 h-full flex-shrink-0 print:w-40 print:h-40 print:m-1"
                            />
                          ))}
                          {isEditing && (
                            <ImageUpload 
                              onUpload={(data) => processImagesForSession(data, 'main1Images' as any)}
                              isEditing={true}
                              label="+"
                              className="w-12 h-full flex-shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 border-b-2 border-black flex flex-col min-h-[150px] print:min-h-0 print:h-auto print:overflow-visible print:avoid-break">
                      <div className="bg-slate-100 p-1 border-b border-black text-[9px] font-black uppercase flex justify-between items-center text-slate-900">
                        <span className="text-slate-900 font-black">SP Hauptteil 2:</span>
                        <div className="flex items-center gap-1">
                          <Clock size={10} className="text-slate-900" />
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={localSession.content.main2Duration || ''}
                              onChange={(e) => updateContent('main2Duration', e.target.value)}
                              className="w-12 bg-white text-slate-900 border border-black px-1 text-[9px] font-bold outline-none"
                              placeholder="min"
                            />
                          ) : (
                            <span className="bg-white text-slate-900 font-bold border border-black px-1 text-[9px]">{localSession.content.main2Duration || '-'}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col sm:flex-row min-h-0 print:h-auto print:min-h-0 print:overflow-visible">
                        {isEditing ? (
                          <textarea 
                            value={localSession.content.main2 || ''}
                            onChange={(e) => updateContent('main2', e.target.value)}
                            onPaste={(e) => handleTextAreaPaste(e, 'main2')}
                            onDrop={(e) => handleTextAreaDrop(e, resolveImageField('main2'))}
                            onDragOver={(e) => e.preventDefault()}
                            placeholder="Text hier einfügen... (Bilder können auch einfach mit Strg+V oder Drag & Drop eingefügt werden)"
                            className="flex-1 p-4 font-bold text-xs text-slate-900 bg-white border border-slate-300 rounded outline-none resize-none w-full placeholder:text-slate-400"
                          />
                        ) : (
                          <div className="flex-1 p-4 font-bold text-sm text-slate-900 bg-white whitespace-pre-wrap w-full">{localSession.content.main2}</div>
                        )}
                        <div className="flex gap-1 p-1 overflow-x-auto border-t sm:border-t-0 sm:border-l border-black bg-slate-50 w-full sm:min-w-[120px] sm:max-w-[400px] print:flex-wrap print:overflow-visible print:max-w-none print:w-auto print:border-none print:bg-white shrink-0">
                          {(localSession.content.main2Images || []).map((img, idx) => (
                            <ImageUpload 
                              key={idx}
                              onUpload={(data) => {
                                const imgs = [...(localSession.content.main2Images || [])];
                                imgs[idx] = Array.isArray(data) ? data[0] : data;
                                updateContent('main2Images' as any, imgs as any);
                              }}
                              onDelete={() => {
                                const imgs = [...(localSession.content.main2Images || [])];
                                imgs.splice(idx, 1);
                                updateContent('main2Images' as any, imgs as any);
                              }}
                              currentImage={img}
                              isEditing={isEditing}
                              className="w-32 h-full flex-shrink-0 print:w-40 print:h-40 print:m-1"
                            />
                          ))}
                          {isEditing && (
                            <ImageUpload 
                              onUpload={(data) => processImagesForSession(data, 'main2Images' as any)}
                              isEditing={true}
                              label="+"
                              className="w-12 h-full flex-shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-[150px] print:min-h-0 print:h-auto print:overflow-visible print:avoid-break">
                      <div className="bg-slate-100 p-1 border-b border-black text-[9px] font-black uppercase flex justify-between items-center text-slate-900">
                        <span className="text-slate-900 font-black">Schluss:</span>
                        <div className="flex items-center gap-1">
                          <Clock size={10} className="text-slate-900" />
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={localSession.content.closingDuration || ''}
                              onChange={(e) => updateContent('closingDuration', e.target.value)}
                              className="w-12 bg-white text-slate-900 border border-black px-1 text-[9px] font-bold outline-none"
                              placeholder="min"
                            />
                          ) : (
                            <span className="bg-white text-slate-900 font-bold border border-black px-1 text-[9px]">{localSession.content.closingDuration || '-'}</span>
                          )}
                        </div>
                      </div>
                      <div className="bg-slate-100 text-slate-900 p-1 border-b border-black text-[9px] font-black uppercase text-center">Schluss</div>
                      <div className="flex-1 flex flex-col sm:flex-row min-h-0 print:h-auto print:min-h-0 print:overflow-visible">
                        {isEditing ? (
                          <textarea 
                            value={localSession.content.closing || ''}
                            onChange={(e) => updateContent('closing', e.target.value)}
                            onPaste={(e) => handleTextAreaPaste(e, 'closing')}
                            onDrop={(e) => handleTextAreaDrop(e, resolveImageField('closing'))}
                            onDragOver={(e) => e.preventDefault()}
                            placeholder="Text hier einfügen... (Bilder können auch einfach mit Strg+V oder Drag & Drop eingefügt werden)"
                            className="flex-1 p-4 font-bold text-xs text-slate-900 bg-white border border-slate-300 rounded outline-none resize-none w-full placeholder:text-slate-400"
                          />
                        ) : (
                          <div className="flex-1 p-4 font-bold text-sm text-slate-900 bg-white whitespace-pre-wrap w-full">{localSession.content.closing}</div>
                        )}
                        <div className="flex gap-1 p-1 overflow-x-auto border-t sm:border-t-0 sm:border-l border-black bg-slate-50 w-full sm:min-w-[120px] sm:max-w-[400px] print:flex-wrap print:overflow-visible print:max-w-none print:w-auto print:border-none print:bg-white shrink-0">
                          {(localSession.content.closingImages || []).map((img, idx) => (
                            <ImageUpload 
                              key={idx}
                              onUpload={(data) => {
                                const imgs = [...(localSession.content.closingImages || [])];
                                imgs[idx] = Array.isArray(data) ? data[0] : data;
                                updateContent('closingImages' as any, imgs as any);
                              }}
                              onDelete={() => {
                                const imgs = [...(localSession.content.closingImages || [])];
                                imgs.splice(idx, 1);
                                updateContent('closingImages' as any, imgs as any);
                              }}
                              currentImage={img}
                              isEditing={isEditing}
                              className="w-32 h-full flex-shrink-0 print:w-40 print:h-40 print:m-1"
                            />
                          ))}
                          {isEditing && (
                            <ImageUpload 
                              onUpload={(data) => processImagesForSession(data, 'closingImages' as any)}
                              isEditing={true}
                              label="+"
                              className="w-12 h-full flex-shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Total Duration Footer */}
                    <div className="bg-black text-white p-2 flex justify-between items-center text-[10px] font-black uppercase">
                      <span>Gesamtdauer (Summe der Teile):</span>
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>{calculateTotalDuration()} Min</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* Bottom Info */}
              <div className="border-t-2 border-black p-4 bg-slate-50 text-slate-900 grid grid-cols-2 gap-4 print:grid-cols-1 print:gap-2">
                <div className="space-y-2 print:avoid-break">
                  <label className="block text-[10px] font-black uppercase text-slate-900">Wichtige Informationen:</label>
                  {isEditing ? (
                    <textarea 
                      value={localSession.importantInfo || ''}
                      onChange={(e) => updateField('importantInfo', e.target.value)}
                      className="w-full p-4 border-2 border-black bg-white text-slate-900 font-bold text-xs outline-none h-32 resize-none"
                    />
                  ) : (
                    <div className="p-4 border-2 border-black bg-white text-slate-900 font-bold text-sm min-h-[8rem] print:min-h-0">
                      {localSession.importantInfo}
                    </div>
                  )}
                  <div className="flex gap-2 p-2 bg-slate-100 border-2 border-black overflow-x-auto min-h-[100px] print:flex-wrap print:overflow-visible print:border-none print:bg-white print:p-0">
                    {(localSession.importantInfoImages || []).map((img, idx) => (
                      <ImageUpload 
                        key={idx}
                        onUpload={(data) => {
                          const imgs = [...(localSession.importantInfoImages || [])];
                          imgs[idx] = Array.isArray(data) ? data[0] : data;
                          updateField('importantInfoImages', imgs);
                        }}
                        onDelete={() => {
                          const imgs = (localSession.importantInfoImages || []).filter((_, i) => i !== idx);
                          updateField('importantInfoImages', imgs);
                        }}
                        currentImage={img}
                        isEditing={isEditing}
                        className="w-24 h-24 flex-shrink-0 bg-white print:w-32 print:h-32 print:m-1"
                      />
                    ))}
                    {isEditing && (
                      <ImageUpload 
                        onUpload={(data) => {
                          const newImgs = [...(localSession.importantInfoImages || []), ...(Array.isArray(data) ? data : [data])];
                          updateField('importantInfoImages', newImgs);
                        }}
                        isEditing={true}
                        label="+"
                        className="w-10 h-24 flex-shrink-0"
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2 print:avoid-break">
                  <label className="block text-[10px] font-black uppercase text-slate-900">Bemerkungen:</label>
                  {isEditing ? (
                    <textarea 
                      value={localSession.remarks || ''}
                      onChange={(e) => updateField('remarks', e.target.value)}
                      className="w-full p-4 border-2 border-black bg-white text-slate-900 font-bold text-xs outline-none h-32 resize-none"
                    />
                  ) : (
                    <div className="p-4 border-2 border-black bg-white text-slate-900 font-bold text-sm min-h-[8rem] relative print:min-h-0">
                      {localSession.remarks}
                      <div className="absolute bottom-2 right-2 w-24 h-24 opacity-20 print:hidden">
                        <img src="https://picsum.photos/seed/auggen/100/100" alt="Logo" className="w-full h-full object-contain" />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 p-2 bg-slate-100 border-2 border-black overflow-x-auto min-h-[100px] print:flex-wrap print:overflow-visible print:border-none print:bg-white print:p-0">
                    {(localSession.remarksImages || []).map((img, idx) => (
                      <ImageUpload 
                        key={idx}
                        onUpload={(data) => {
                          const imgs = [...(localSession.remarksImages || [])];
                          imgs[idx] = Array.isArray(data) ? data[0] : data;
                          updateField('remarksImages', imgs);
                        }}
                        onDelete={() => {
                          const imgs = (localSession.remarksImages || []).filter((_, i) => i !== idx);
                          updateField('remarksImages', imgs);
                        }}
                        currentImage={img}
                        isEditing={isEditing}
                        className="w-24 h-24 flex-shrink-0 bg-white print:w-32 print:h-32 print:m-1"
                      />
                    ))}
                    {isEditing && (
                      <ImageUpload 
                        onUpload={(data) => {
                          const newImgs = [...(localSession.remarksImages || []), ...(Array.isArray(data) ? data : [data])];
                          updateField('remarksImages', newImgs);
                        }}
                        isEditing={true}
                        label="+"
                        className="w-10 h-24 flex-shrink-0"
                      />
                    )}
                  </div>
                </div>

                {/* Training Session Video Section */}
                <div className="space-y-2 mt-6 print:hidden">
                  <VideoSection 
                    title="TRAININGS- & ÜBUNGS-VIDEOS"
                    subtitle="Übungsausführungen, Taktik-Videos und Trainingsanalysen"
                    clips={localSession.videoClips || []}
                    onUpdateClips={(clips) => updateField('videoClips', clips)}
                    players={players}
                    defaultCategory="Training"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-2 border-t-2 border-black flex justify-between items-center text-[8px] font-black uppercase tracking-widest opacity-40">
                <span>FC AUGGEN 1921 e.V.</span>
                <span>Team Management System 2026/2027</span>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
            <Calendar size={48} className="mb-3 opacity-30 text-slate-600" />
            <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Bitte eine Trainingseinheit auswählen</p>
            <p className="text-xs text-slate-500 mt-1">Wählen Sie links eine Einheit oder erstellen Sie oben eine neue.</p>
          </div>
        )}
      </div>
      </div>
      {/* Modals and Notifications */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 max-w-sm w-full text-slate-900">
            <h3 className="font-black uppercase text-lg mb-4 text-slate-900">Einheit löschen?</h3>
            <p className="font-bold text-sm mb-6 text-slate-700">Möchten Sie diese Trainingseinheit wirklich unwiderruflich entfernen?</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-gray-200 border-2 border-black py-2 font-black uppercase text-xs hover:bg-gray-300 transition-all text-slate-900"
              >
                Abbrechen
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white border-2 border-black py-2 font-black uppercase text-xs hover:bg-red-700 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {showGenerateConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-xs">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 max-w-lg w-full text-slate-900">
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Calendar className="text-blue-600" size={22} />
                <h3 className="font-black uppercase text-lg text-slate-900 tracking-tight">Trainingseinheiten generieren</h3>
              </div>
              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-black uppercase rounded-md border border-blue-300">
                47 Einheiten
              </span>
            </div>

            <p className="font-bold text-xs mb-4 text-slate-700 leading-relaxed">
              Erstellt automatisch Trainingseinheiten für die Saisonvorbereitung mit voller Kaderübernahme und Trainingsphasen.
            </p>

            {/* Mode selection */}
            <div className="mb-4 space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-800 block">Auswahl Voreinstellung:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGenMode('days47');
                    setGenStartDate('2026-07-06');
                    setGenEndDate('2026-08-21');
                  }}
                  className={`p-2.5 text-left border-2 rounded text-xs font-black transition-all ${
                    genMode === 'days47'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                      : 'border-slate-300 hover:border-black text-slate-700 bg-white'
                  }`}
                >
                  <div className="font-black text-[11px] text-blue-700">★ 47 Einheiten (06.07 - 21.08)</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Komplette 47 Einheiten Vorbereitung</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGenMode('custom');
                  }}
                  className={`p-2.5 text-left border-2 rounded text-xs font-black transition-all ${
                    genMode === 'custom'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                      : 'border-slate-300 hover:border-black text-slate-700 bg-white'
                  }`}
                >
                  <div className="font-black text-[11px] text-slate-800">Benutzerdefinierter Zeitraum</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Eigenes Start- & Enddatum</div>
                </button>
              </div>
            </div>

            {/* Date Range Inputs */}
            <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">Startdatum</label>
                <input
                  type="date"
                  value={genStartDate}
                  onChange={(e) => setGenStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">Enddatum</label>
                <input
                  type="date"
                  value={genEndDate}
                  onChange={(e) => setGenEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">Trainer</label>
                <input
                  type="text"
                  value={genTrainer}
                  onChange={(e) => setGenTrainer(e.target.value)}
                  placeholder="z.B. Amin, marcel"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Undo safety callout */}
            <div className="mb-5 p-2.5 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-900 font-bold flex items-start gap-2">
              <RotateCcw size={16} className="shrink-0 text-amber-700 mt-0.5" />
              <span>
                <strong>Rückgängig-Garantie:</strong> Falls Ihnen das Ergebnis nicht gefällt, können Sie die Generierung jederzeit mit einem Klick auf &bdquo;Gen. Rückgängig&ldquo; wieder rückgängig machen.
              </span>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowGenerateConfirm(false)}
                className="flex-1 bg-gray-200 border-2 border-black py-2.5 font-black uppercase text-xs hover:bg-gray-300 transition-all text-slate-900"
              >
                Abbrechen
              </button>
              <button 
                onClick={confirmGenerateUnits}
                className="flex-1 bg-blue-600 text-white border-2 border-black py-2.5 font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-2"
              >
                <Calendar size={15} /> 47 Einheiten generieren
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 max-w-md w-full text-slate-900">
            <h3 className="font-black uppercase text-lg mb-4 text-orange-600">Alle Einheiten löschen?</h3>
            <p className="font-bold text-sm mb-6 text-slate-700">
              Möchten Sie wirklich <span className="text-red-600 underline">ALLE</span> Trainingseinheiten löschen und nur eine neue Einheit für den <span className="text-blue-600">06.07.2026</span> erstellen?
              <br/><br/>
              Dieser Vorgang kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-gray-200 border-2 border-black py-2 font-black uppercase text-xs hover:bg-gray-300 transition-all text-slate-900"
              >
                Abbrechen
              </button>
              <button 
                onClick={confirmReset}
                className="flex-1 bg-orange-600 text-white border-2 border-black py-2 font-black uppercase text-xs hover:bg-orange-700 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              >
                Alles löschen & Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
          <div className="bg-black text-white border-2 border-white px-6 py-3 font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]">
            {notification}
          </div>
        </div>
      )}

      {showAddPlayerModal && localSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-2xl flex flex-col max-h-[80vh] text-slate-900">
            <div className="p-4 border-b-4 border-black bg-black text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-sm italic">Spieler hinzufügen</h3>
              <button 
                onClick={() => setShowAddPlayerModal(false)}
                className="hover:text-red-500 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 border-b-2 border-black bg-slate-50 text-slate-900">
              <p className="text-[10px] font-black uppercase mb-2 text-slate-900">Externer Spieler / Gast hinzufügen</p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Name"
                    value={manualPlayerName}
                    onChange={(e) => setManualPlayerName(e.target.value)}
                    className="flex-1 border-2 border-black bg-white text-slate-900 p-2 text-xs font-bold uppercase focus:ring-2 focus:ring-red-600 outline-none"
                  />
                  <input 
                    type="text"
                    placeholder="Pos (z.B. ST)"
                    value={manualPlayerPos}
                    onChange={(e) => setManualPlayerPos(e.target.value)}
                    className="w-24 border-2 border-black bg-white text-slate-900 p-2 text-xs font-bold uppercase focus:ring-2 focus:ring-red-600 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={manualPlayerCategory}
                    onChange={(e) => setManualPlayerCategory(e.target.value as any)}
                    className="flex-1 border-2 border-black p-2 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-red-600 bg-white text-slate-900"
                  >
                    <option value="player">Spieler</option>
                    <option value="coach">Trainer</option>
                    <option value="staff">Funktionsteam</option>
                    <option value="medical">Medizin/Physio</option>
                  </select>
                  <button 
                    onClick={addManualPlayer}
                    disabled={!manualPlayerName}
                    className="bg-black text-white px-4 py-2 font-black uppercase text-[10px] hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                  >
                    <UserPlus size={14} /> Hinzufügen
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {sortPlayers(players).map((p) => {
                  const name = p.lastName;
                  const isAlreadyIn = (localSession.players || []).some(lp => lp && (lp.name === name || lp.name === `${p.lastName} ${p.firstName}`));
                  
                  return (
                    <button
                      key={p.id}
                      disabled={isAlreadyIn}
                      onClick={() => addPlayerToSession(p)}
                      className={`
                        p-2 border-2 text-left transition-all relative overflow-hidden group
                        ${isAlreadyIn 
                          ? 'border-slate-300 bg-slate-100 opacity-40 cursor-not-allowed text-slate-700' 
                          : 'border-black bg-white hover:bg-green-50 text-slate-900 active:translate-x-[2px] active:translate-y-[2px]'}
                      `}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${getCategoryColor(p.category)}`} />
                      <div className="flex items-center justify-between">
                        <span className="font-black uppercase text-[10px] truncate pr-4 text-slate-900">{name}</span>
                        {isAlreadyIn && <span className="text-[8px] font-black uppercase text-green-600 bg-green-100 px-1">Drin</span>}
                      </div>
                      <p className="text-[8px] font-black uppercase text-slate-500">{p.position}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="p-4 border-t-4 border-black bg-slate-100 text-right">
              <button 
                onClick={() => setShowAddPlayerModal(false)}
                className="bg-black text-white px-8 py-2 font-black uppercase text-xs hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      {showDocumentModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] w-full max-w-5xl h-[90vh] flex flex-col relative overflow-hidden text-slate-900">
            {/* Modal Header */}
            <div className="p-4 bg-black text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <FileText size={24} className="text-purple-400" />
                    <div>
                        <h2 className="font-black uppercase tracking-tighter text-lg leading-none">Trainingsdokument Verwaltung</h2>
                        <p className="text-[10px] font-bold opacity-60 uppercase mt-1">
                          {localSession ? `Einheit am ${new Date(localSession.date).toLocaleDateString('de-DE')}` : 'Globale Bibliothek'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowDocumentModal(false)}
                    className="p-2 hover:bg-neutral-800 transition-colors rounded-full text-white"
                >
                    <X size={28} />
                </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left: Selection & Upload */}
                <div className="w-full md:w-1/2 border-r-2 border-black flex flex-col bg-slate-50 overflow-hidden">
                    <div className="p-4 border-b-2 border-black bg-white">
                        <h3 className="font-black uppercase text-xs mb-3 tracking-widest text-[#C00000]">Dokument hochladen</h3>
                        <label 
                            className={`relative border-2 border-dashed p-8 flex flex-col items-center justify-center group transition-all cursor-pointer ${modalDragActive ? 'border-purple-600 bg-purple-50 scale-[1.02]' : 'border-black/40 bg-white hover:border-purple-600'}`}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setModalDragActive(true); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setModalDragActive(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setModalDragActive(false);
                                handleFileUpload(e.dataTransfer.files);
                            }}
                        >
                            <Upload size={32} className={`mb-4 transition-all ${modalDragActive ? 'text-purple-600 scale-110' : 'text-purple-600 opacity-40 group-hover:opacity-100 group-hover:scale-110'}`} />
                            <p className="font-black uppercase text-xs text-purple-900 text-center">Hier klicken oder Dateien ablegen</p>
                            <p className="text-[10px] font-bold opacity-60 uppercase mt-2 text-center bg-yellow-100 px-2 py-1 rounded text-slate-900">
                               Dokumente hier hochladen (Bibliothek).<br/>
                               Bilder für den Plan direkt auf den Plan ziehen.
                            </p>
                            <p className="text-[10px] font-bold opacity-40 uppercase mt-1 text-slate-600">PDF, Word, Excel, Bilder (Max 700KB)</p>
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg"
                                multiple
                                onChange={(e) => handleFileUpload(e.target.files)}
                                className="hidden"
                            />
                        </label>
                    </div>

                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-4 border-b-2 border-black bg-purple-50 flex flex-col gap-3 shrink-0">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <FileText size={14} className="text-purple-600" />
                                    <h3 className="font-black uppercase text-[10px] tracking-widest text-purple-900">Bibliothek</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-bold opacity-40 uppercase text-purple-900">Dokumente:</span>
                                    <span className="bg-purple-600 text-white px-2 py-0.5 text-[10px] font-black rounded-full">{globalDocs.length}</span>
                                </div>
                            </div>
                            
                            {/* Search Bar */}
                            <div className="relative">
                                <input 
                                    type="text"
                                    placeholder="Bibliothek durchsuchen..."
                                    value={librarySearch}
                                    onChange={(e) => setLibrarySearch(e.target.value)}
                                    className="w-full bg-white text-slate-900 border-2 border-black p-2 text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-purple-600/20"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-30 text-slate-900">
                                    <Users size={12} />
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-white">
                            {globalDocs.length === 0 ? (
                                <div className="p-12 text-center text-[10px] font-black uppercase opacity-20 italic text-slate-600">
                                    Keine Dokumente global vorhanden
                                </div>
                            ) : (
                                [...globalDocs]
                                .filter(d => d.name.toLowerCase().includes(librarySearch.toLowerCase()))
                                .sort((a, b) => {
                                    const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
                                    const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
                                    return dateB - dateA;
                                }).map(gDoc => (
                                    <div 
                                        key={gDoc.id}
                                        onClick={() => setSelectedLibraryDocId(gDoc.id)}
                                        className={`w-full p-4 border-b border-black/10 flex items-center justify-between transition-all cursor-pointer hover:bg-slate-50 group ${selectedLibraryDocId === gDoc.id ? 'bg-purple-50 border-l-4 border-l-purple-600' : 'bg-white'}`}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`p-2 border-2 border-black shrink-0 ${localSession?.trainingDocumentId === gDoc.id ? 'bg-purple-600 text-white' : (selectedLibraryDocId === gDoc.id ? 'bg-purple-100 text-purple-900' : 'bg-slate-100 text-slate-900')}`}>
                                                <FileText size={18} />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-black uppercase text-xs tracking-tighter truncate text-slate-900">{gDoc.name}</p>
                                                <p className="text-[9px] font-bold opacity-40 uppercase text-slate-600">{new Date(gDoc.uploadedAt).toLocaleDateString()} um {new Date(gDoc.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 transition-opacity">
                                            <button 
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    setNotification("Dokument wird geladen...");
                                                    let blobData: Uint8Array | null = null;
                                                    
                                                    // Try to get from metadata first (legacy)
                                                    if (gDoc.url) {
                                                        blobData = base64ToUint8Array(gDoc.url);
                                                    } else {
                                                        // Fallback: Fetch from content collection
                                                        const contentDoc = await getDoc(doc(db, 'training_documents_content', gDoc.id));
                                                        if (contentDoc.exists()) {
                                                            const contentData = contentDoc.data() as TrainingDocumentContent;
                                                            blobData = base64ToUint8Array(contentData.base64);
                                                        }
                                                    }

                                                    if (blobData) {
                                                        const fileUrl = URL.createObjectURL(new Blob([blobData], { type: gDoc.mimeType || 'application/octet-stream' }));
                                                        window.open(fileUrl, '_blank');
                                                        setTimeout(() => URL.revokeObjectURL(fileUrl), 5000);
                                                        setNotification(null);
                                                    } else {
                                                        setNotification("Fehler beim Laden des Inhalts!");
                                                        setTimeout(() => setNotification(null), 3000);
                                                    }
                                                }}
                                                className="p-2 bg-blue-600 text-white border-2 border-black hover:bg-black transition-colors"
                                                title="Vorschau / Öffnen"
                                            >
                                                <Maximize2 size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setReplacingDocId(gDoc.id);
                                                    replaceInputRef.current?.click();
                                                }}
                                                className="p-2 bg-purple-600 text-white border-2 border-black hover:bg-black transition-colors"
                                                title="Datei ersetzen"
                                            >
                                                <RotateCw size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteGlobalDoc(gDoc.id);
                                                    if (!isQuotaExceededActive() && navigator.onLine) {
                                                      deleteDoc(doc(db, 'training_documents_content', gDoc.id)).catch((err) => {
                                                        if (isQuotaError(err)) markQuotaExceeded();
                                                      });
                                                    }
                                                    if (localSession?.trainingDocumentId === gDoc.id) {
                                                        const updatedSession = { ...localSession, trainingDocumentId: null };
                                                        setLocalSession(updatedSession as any);
                                                        saveSession(updatedSession as any);
                                                    }
                                                    if (selectedLibraryDocId === gDoc.id) {
                                                        setSelectedLibraryDocId(null);
                                                    }
                                                    setNotification(`Dokument "${gDoc.name}" gelöscht.`);
                                                    setTimeout(() => setNotification(null), 2500);
                                                }}
                                                className="p-2 bg-red-600 text-white border-2 border-black hover:bg-black transition-colors"
                                                title="Global löschen"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Selected Document Focus */}
                <div className="w-full md:w-1/2 flex flex-col bg-slate-100 text-slate-900">
                    <div className="p-4 border-b-2 border-black bg-white flex justify-between items-center text-slate-900">
                        <h3 className="font-black uppercase text-xs tracking-widest text-purple-600">
                            {selectedLibraryDocId ? 'Dokument-Details' : 'Aktuelles Session-Dokument'}
                        </h3>
                        <div className="flex gap-4">
                            {selectedLibraryDocId && localSession && localSession.id && (
                                <button 
                                    onClick={() => {
                                        const updatedSession = { ...localSession, trainingDocumentId: selectedLibraryDocId };
                                        setLocalSession(updatedSession as any);
                                        saveSession(updatedSession as any);
                                        setNotification("Dokument zugewiesen!");
                                        setTimeout(() => setNotification(null), 3000);
                                    }}
                                    className={`text-[10px] font-black uppercase px-2 py-1 border-2 border-black transition-all ${localSession.trainingDocumentId === selectedLibraryDocId ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-purple-600'}`}
                                >
                                    {localSession.trainingDocumentId === selectedLibraryDocId ? 'ZUR EINHEIT ZUGEWIESEN' : 'ZUR EINHEIT ZUWEISEN'}
                                </button>
                            )}
                            {localSession?.trainingDocumentId && (
                                <button 
                                    onClick={() => {
                                        const updatedSession = { ...localSession, trainingDocumentId: null };
                                        setLocalSession(updatedSession as any);
                                        saveSession(updatedSession as any);
                                        setNotification("Verknüpfung gelöst");
                                        setTimeout(() => setNotification(null), 3000);
                                    }}
                                    className="text-[10px] font-black uppercase text-red-600 underline hover:no-underline"
                                >
                                    Verknüpfung lösen
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-purple-50/20 text-slate-900">
                        {(() => {
                            const activeDocId = selectedLibraryDocId || localSession?.trainingDocumentId;
                            if (!activeDocId) return (
                                <div className="text-center opacity-40 text-slate-800">
                                    <FileText size={48} className="mx-auto mb-4" />
                                    <p className="font-black uppercase text-sm tracking-widest italic">Kein Dokument ausgewählt</p>
                                    <p className="text-[10px] font-bold uppercase mt-2">Wähle links ein Dokument aus der Bibliothek aus</p>
                                </div>
                            );

                            const activeDoc = globalDocs.find(d => d.id === activeDocId);
                            if (!activeDoc) return <div className="text-red-500 font-black uppercase text-xs">Fehler: Dokument existiert nicht mehr</div>;
                            
                            return (
                                <div className="w-full flex flex-col items-center h-full">
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <div className="w-32 h-32 bg-purple-100 border-4 border-black flex items-center justify-center mb-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.15)] transform rotate-3">
                                            <FileText size={64} className="text-purple-600" />
                                        </div>
                                        <h4 className="font-black uppercase text-xl mb-2 tracking-tight text-slate-900">{activeDoc.name}</h4>
                                        <p className="text-[10px] font-bold opacity-40 uppercase mb-8 text-slate-600">Hochgeladen am {new Date(activeDoc.uploadedAt).toLocaleString()}</p>
                                        
                                        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                                            <button 
                                                onClick={async () => {
                                                    setNotification("Dokument wird geladen...");
                                                    let blobData: Uint8Array | null = null;
                                                    if (activeDoc.url) {
                                                        blobData = base64ToUint8Array(activeDoc.url);
                                                    } else {
                                                        const contentDoc = await getDoc(doc(db, 'training_documents_content', activeDoc.id));
                                                        if (contentDoc.exists()) {
                                                            const contentData = contentDoc.data() as TrainingDocumentContent;
                                                            blobData = base64ToUint8Array(contentData.base64);
                                                        }
                                                    }

                                                    if (blobData) {
                                                        const fileUrl = URL.createObjectURL(new Blob([blobData], { type: activeDoc.mimeType || 'application/octet-stream' }));
                                                        const a = document.createElement('a');
                                                        a.href = fileUrl;
                                                        a.download = activeDoc.name;
                                                        a.click();
                                                        URL.revokeObjectURL(fileUrl);
                                                        setNotification(null);
                                                    } else {
                                                        setNotification("Fehler beim Laden!");
                                                        setTimeout(() => setNotification(null), 3000);
                                                    }
                                                }}
                                                className="bg-black text-white p-4 font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                                            >
                                                <FileText size={18} /> Herunterladen
                                            </button>
                                            <button 
                                                onClick={async () => {
                                                    setNotification("Dokument wird geladen...");
                                                    let blobData: Uint8Array | null = null;
                                                    if (activeDoc.url) {
                                                        blobData = base64ToUint8Array(activeDoc.url);
                                                    } else {
                                                        const contentDoc = await getDoc(doc(db, 'training_documents_content', activeDoc.id));
                                                        if (contentDoc.exists()) {
                                                            const contentData = contentDoc.data() as TrainingDocumentContent;
                                                            blobData = base64ToUint8Array(contentData.base64);
                                                        }
                                                    }
                                                    
                                                    if (blobData) {
                                                        const fileUrl = URL.createObjectURL(new Blob([blobData], { type: activeDoc.mimeType || 'application/octet-stream' }));
                                                        window.open(fileUrl, '_blank');
                                                        setTimeout(() => URL.revokeObjectURL(fileUrl), 5000);
                                                        setNotification(null);
                                                    } else {
                                                        setNotification("Fehler beim Laden!");
                                                        setTimeout(() => setNotification(null), 3000);
                                                    }
                                                }}
                                                className="bg-blue-600 text-white p-4 font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                                            >
                                                <Maximize2 size={18} /> Öffnen (Tab)
                                            </button>
                                        </div>
                                    </div>

                                    <label 
                                            className="mt-12 p-4 border-2 border-black bg-white text-slate-900 flex flex-col items-center gap-3 w-full max-w-md cursor-pointer hover:bg-purple-50 transition-colors"
                                        >
                                            <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 underline">Dokument ersetzen / aktualisieren</p>
                                            <input 
                                                type="file" 
                                                ref={replaceInputRef}
                                                accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    const targetId = activeDocId || replacingDocId;
                                                    
                                                    if (file && targetId) {
                                                        if (file.size > 800 * 1024) {
                                                            setNotification("Datei zu groß! Max. 800KB erlaubt.");
                                                            setTimeout(() => setNotification(null), 5000);
                                                            e.target.value = '';
                                                            return;
                                                        }

                                                        try {
                                                            setNotification("Dokument wird ersetzt...");
                                                            const base64 = await fileToBase64(file);
                                                            
                                                            // 1. Update Content
                                                            if (!isQuotaExceededActive() && navigator.onLine) {
                                                              try {
                                                                await setDoc(doc(db, 'training_documents_content', targetId), cleanFirestoreData({
                                                                    id: targetId,
                                                                    base64: base64
                                                                }));
                                                              } catch (writeErr) {
                                                                if (isQuotaError(writeErr)) {
                                                                  markQuotaExceeded();
                                                                }
                                                              }
                                                            }

                                                            // 2. Update Metadata
                                                            const existingDoc = globalDocs.find(d => d.id === targetId);
                                                            const updatedDoc = { 
                                                                ...existingDoc, 
                                                                id: targetId,
                                                                name: file.name, 
                                                                url: '', 
                                                                uploadedAt: new Date().toISOString(),
                                                                mimeType: file.type || 'application/octet-stream'
                                                            };
                                                            await saveGlobalDoc(updatedDoc as any);
                                                            setNotification("Dokument global ersetzt!");
                                                        } catch (err) {
                                                            console.error("Replacement failed", err);
                                                            setNotification("Fehler beim Ersetzen!");
                                                        }
                                                        e.target.value = '';
                                                        setReplacingDocId(null);
                                                        setTimeout(() => setNotification(null), 3000);
                                                    }
                                                }}
                                            />
                                            <p className="text-[10px] font-bold opacity-60 mt-1 uppercase text-slate-600">Klicke hier, um eine neue Version dieser Datei hochzuladen.</p>
                                        </label>
                                    </div>
                                );
                            })()}
                        </div>

                    <div className="p-4 border-t-2 border-black bg-purple-600 text-white flex items-center justify-between">
                         <span className="text-[9px] font-black uppercase tracking-widest">FC Auggen Trainingsunterlagen</span>
                         <div className="w-12 h-6 border border-white/30 rounded-full flex items-center justify-center text-[8px] font-black">2026</div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
