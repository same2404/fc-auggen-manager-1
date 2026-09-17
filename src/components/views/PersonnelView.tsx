import React, { useState, useEffect, useRef } from 'react';
import { Player, Spieler } from '../../types';
import { 
  User, 
  Shield, 
  Briefcase, 
  ChevronRight, 
  Edit2, 
  Trash2, 
  Pencil, 
  Plus, 
  Activity,
  Maximize2,
  X,
  RotateCw,
  Upload,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { sortPlayers } from '../../utils/playerSorting';
import { VideoSection } from '../VideoSection';
import { TrackerReportModal } from '../TrackerReportModal';
import { getPlayerPhoto } from '../../utils/playerAvatarGenerator';

interface PersonnelViewProps {
  players: Spieler[];
  onEditPlayer: (player: Spieler) => void;
  onDeletePlayer: (id: string) => void;
  onUpdatePlayer: (id: string, field: string, value: any) => void;
  onAddPlayer: () => void;
  isEditing: boolean;
  sessionLogs?: any[];
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
        const maxDim = 250;
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
  onUpload: (base64: string) => void; 
  className?: string;
  label?: string;
}> = ({ onUpload, className, label }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        onUpload(base64);
      } catch (err) {
        console.error("Upload failed", err);
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          try {
            const base64 = await fileToBase64(blob);
            onUpload(base64);
          } catch (err) {
            console.error("Paste failed", err);
          }
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const base64 = await fileToBase64(file);
        onUpload(base64);
      } catch (err) {
        console.error("Drop failed", err);
      }
    }
  };

  return (
    <div 
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed transition-colors flex flex-col items-center justify-center p-4 cursor-pointer group ${isDragging ? 'border-blue-500 bg-blue-50/10' : 'border-white/20 hover:border-white/40'} ${className}`}
    >
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
      <Plus size={24} className="mb-2 opacity-40 group-hover:opacity-100 transition-opacity text-white" />
      <span className="text-[9px] font-black uppercase opacity-40 group-hover:opacity-100 transition-opacity text-center text-white">
        {label || "Foto hochladen / Einfügen / Drag & Drop"}
      </span>
    </div>
  );
};

const PlayerImageWithLightbox: React.FC<{
  image: string;
  isEditing: boolean;
  lastName: string;
  onUpdate: (base64: string) => void;
  onDelete: () => void;
  className?: string; // Added className here
}> = ({ image, isEditing, lastName, onUpdate, onDelete, className }) => {
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      <div className={`relative group ${className || 'w-full h-full'}`}>
        <img 
          src={image} 
          alt={lastName} 
          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
          referrerPolicy="no-referrer"
          onClick={() => setShowLightbox(true)}
        />
        <div 
          onClick={() => setShowLightbox(true)}
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none cursor-pointer"
        >
          <Maximize2 size={24} className="text-white" />
        </div>
        {isEditing && (
          <div className="absolute top-1 right-1 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <label className="bg-[#10B981] hover:bg-[#059669] text-[#0A0E17] p-1 rounded cursor-pointer transition-colors" title="Foto austauschen">
              <Upload size={13} />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const base64 = await fileToBase64(file);
                    onUpdate(base64);
                  }
                }}
              />
            </label>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="bg-red-600/90 hover:bg-red-700 text-white p-1 rounded transition-colors"
              title="Foto zurücksetzen"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      {showLightbox && (
        <ImageLightbox 
          image={image} 
          onClose={() => setShowLightbox(false)} 
          onUpdate={onUpdate}
          isEditing={isEditing}
        />
      )}
    </>
  );
};

const PersonnelView: React.FC<PersonnelViewProps> = ({ players, onEditPlayer, onDeletePlayer, onUpdatePlayer, onAddPlayer, isEditing, sessionLogs = [] }) => {
  const sortedPersonnel = sortPlayers(players);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTrackerModal, setShowTrackerModal] = useState<boolean>(false);

  // Update selectedId if it's null and we have players
  useEffect(() => {
    if (!selectedId && sortedPersonnel.length > 0) {
      setSelectedId(sortedPersonnel[0].id);
    }
  }, [sortedPersonnel, selectedId]);

  const selectedPerson = sortedPersonnel.find(p => p.id === selectedId) || sortedPersonnel[0];

  const activePersonLogs = selectedPerson ? sessionLogs.filter(log => log.playerId === selectedPerson.id) : [];
  const workloadStats = activePersonLogs.length > 0 ? activePersonLogs.reduce((acc, log) => {
    acc.rpeSum += log.rpe;
    acc.loadSum += log.calculatedLoad;
    acc.durationSum += log.duration;
    acc.count += 1;
    return acc;
  }, { rpeSum: 0, loadSum: 0, durationSum: 0, count: 0 }) : null;

  const normalizeCategory = (cat?: string) => {
    if (!cat) return 'player';
    const c = cat.toLowerCase();
    if (c === 'spieler') return 'player';
    if (c === 'trainer') return 'coach';
    if (c === 'funktionär') return 'staff';
    if (c === 'medizinisch' || c === 'arzt' || c === 'ärztlich' || c === 'physio') return 'medical';
    return c;
  };

  const getCategoryColor = (category?: string) => {
    const cat = normalizeCategory(category);
    switch (cat) {
      case 'coach': return 'bg-[#06B6D4]';
      case 'staff': return 'bg-[#A855F7]';
      case 'medical': return 'bg-[#FB7185]';
      default: return 'bg-[#10B981]';
    }
  };

  const getCategoryBorderColor = (category?: string) => {
    const cat = normalizeCategory(category);
    switch (cat) {
      case 'coach': return 'border-[#06B6D4]';
      case 'staff': return 'border-[#A855F7]';
      case 'medical': return 'border-[#FB7185]';
      default: return 'border-[#10B981]';
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = normalizeCategory(category);
    switch (cat) {
      case 'coach':
        return <Briefcase size={14} className="text-[#06B6D4]" />;
      case 'staff':
        return <Shield size={14} className="text-[#A855F7]" />;
      case 'medical':
        return <Activity size={14} className="text-[#FB7185]" />;
      default: return <User size={14} className="text-[#10B981]" />;
    }
  };

  const getCategoryLabel = (category?: string) => {
    const cat = normalizeCategory(category);
    switch (cat) {
      case 'coach':
        return 'TRAINERTEAM';
      case 'staff':
        return 'TEAMMANAGEMENT / FUNKTIONÄR';
      case 'medical':
        return 'MEDIZINISCHE ABTEILUNG (PHYSIO / ARZT)';
      default: return 'SPIELERKADER';
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full gap-4 overflow-hidden bg-[#0A0E17] text-[#F8FAFC] p-2 sm:p-4 rounded-2xl border border-[#334155] shadow-2xl">
      {/* Left Column: List */}
      <div className="w-full md:w-1/3 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="bg-[#121824] border-b border-[#334155] text-[#F8FAFC] p-3 shrink-0 flex justify-between items-center gap-2">
          <h3 className="font-black uppercase tracking-widest text-xs text-[#F59E0B]">Kader & Personal</h3>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const json = JSON.stringify(players, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `FC_Auggen_Kader_mit_Fotos_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] border border-[#334155] px-2 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all"
              title="Kader mit allen Fotos als Datei sichern"
            >
              <Download size={12} className="text-[#10B981]" />
              <span className="hidden sm:inline">Backup</span>
            </button>
            <button
              onClick={() => setShowTrackerModal(true)}
              className="bg-[#F59E0B] hover:bg-[#FBBF24] text-[#0A0E17] px-2.5 py-1 rounded-lg font-black text-[10px] uppercase flex items-center gap-1 transition-all shadow-sm border border-[#F59E0B]"
              title="Tracker-Daten (ZIP, CSV, GPX, FIT, TCX) analysieren"
            >
              <Activity size={12} /> Tracker-Bericht
            </button>
            <button 
              onClick={onAddPlayer}
              className="bg-[#10B981] text-[#0A0E17] p-1.5 rounded-lg hover:bg-[#059669] transition-colors border border-[#10B981]"
              title="Person hinzufügen"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0A0E17]">
          {sortedPersonnel.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center h-full">
              <User size={48} className="text-[#94A3B8] mb-4" />
              <p className="font-black uppercase text-[#94A3B8] italic mb-2">Kein Personal gefunden</p>
              <p className="text-[10px] font-bold uppercase text-[#94A3B8]">Nutze "Person hinzufügen" oder "Cloud Sync" zum Laden.</p>
            </div>
          ) : (
            sortedPersonnel.map((person, index) => {
            const currentCat = normalizeCategory(person.category);
            const prevCat = index > 0 ? normalizeCategory(sortedPersonnel[index - 1].category) : null;
            const isFirstOfCategory = index === 0 || currentCat !== prevCat;
            
            return (
              <React.Fragment key={person.id}>
                {isFirstOfCategory && (
                  <div className={`text-[#F8FAFC] px-3 py-1.5 flex items-center justify-between border-y border-[#334155] ${getCategoryColor(person.category)}`}>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em]">
                      {getCategoryLabel(person.category)}
                    </span>
                    <div className="w-1.5 h-1.5 bg-[#1E293B] rotate-45" />
                  </div>
                )}
                <div
                  onClick={() => setSelectedId(person.id)}
                  className={`w-full flex items-center justify-between p-3 border-b border-[#334155]/80 last:border-b-0 transition-all group cursor-pointer relative overflow-hidden
                    ${selectedId === person.id ? 'bg-[#121824] border-l-4 border-l-[#10B981] text-[#F8FAFC]' : 'hover:bg-[#121824]/60 text-[#94A3B8]'}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(person.id);
                    }
                  }}
                >
                  {/* Category Indicator Line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${getCategoryColor(person.category)}`} />
                  
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg border overflow-hidden shrink-0 transition-transform group-hover:scale-105 bg-[#0A0E17] relative ${selectedId === person.id ? 'border-[#10B981]' : 'border-[#334155]'}`}>
                      <img 
                        src={getPlayerPhoto(person)} 
                        alt={person.lastName} 
                        className="w-full h-full object-cover" 
                      />
                      {normalizeCategory(person.category) === 'player' && (person.number !== undefined && person.number !== null) && (
                        <span className="absolute bottom-0 right-0 bg-[#0A0E17]/90 text-[8px] font-black px-1 rounded-tl text-[#10B981] font-mono leading-tight">
                          #{person.number}
                        </span>
                      )}
                    </div>
                    <div className="text-left">
                        <p className={`font-black uppercase text-[11px] leading-tight flex items-center gap-1.5 ${selectedId === person.id ? 'text-[#F8FAFC]' : 'text-[#F8FAFC]'}`}>
                          {person.lastName}
                          {(person.beruf || person.professionalStatus) && (
                            <span className={`text-[7px] px-1 py-0.5 rounded leading-none shrink-0 font-bold ${selectedId === person.id ? 'bg-[#10B981] text-[#0A0E17]' : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'}`}>
                              {person.beruf || person.professionalStatus}
                            </span>
                          )}
                        </p>
                        <p className={`text-[9px] font-bold uppercase mt-0.5 flex items-center gap-1.5 ${selectedId === person.id ? 'text-[#10B981]' : 'text-[#94A3B8]'}`}>
                          {person.position}
                          {(person.education || (person.notizen && person.notizen.length < 30)) && (
                            <span className={`text-[7px] italic font-medium leading-none truncate max-w-[120px] ${selectedId === person.id ? 'text-[#10B981]/80' : 'text-[#94A3B8]'}`}>
                              ({person.education || person.notizen})
                            </span>
                          )}
                        </p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPlayer(person);
                          }}
                          className={`p-1 transition-colors ${selectedId === person.id ? 'text-[#10B981] hover:text-white' : 'text-[#94A3B8] hover:text-[#F59E0B]'}`}
                          title="Bearbeiten"
                        >
                          <Pencil size={12} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePlayer(person.id);
                          }}
                          className={`p-1 transition-colors ${selectedId === person.id ? 'text-[#10B981] hover:text-white' : 'text-[#94A3B8] hover:text-red-400'}`}
                          title="Löschen"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                    <ChevronRight size={16} className={`${selectedId === person.id ? 'text-[#10B981] opacity-100' : 'opacity-0 group-hover:opacity-40 text-[#94A3B8]'}`} />
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        </div>
      </div>
      
      {/* Right Column: Card */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {selectedPerson ? (
            <motion.div
              key={selectedPerson.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[#1E293B] border border-[#334155] rounded-xl shadow-2xl overflow-hidden"
            >
              {/* Card Header */}
              <div className="bg-[#121824] text-[#F8FAFC] p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start border-b border-[#334155] gap-4">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#0A0E17] border-2 border-[#334155] rounded-xl flex items-center justify-center relative overflow-hidden group shrink-0">
                    {selectedPerson.image ? (
                      <PlayerImageWithLightbox 
                        image={selectedPerson.image} 
                        isEditing={isEditing}
                        lastName={selectedPerson.lastName}
                        onUpdate={(base64) => onUpdatePlayer(selectedPerson.id, 'image', base64)}
                        onDelete={() => onUpdatePlayer(selectedPerson.id, 'image', '')}
                      />
                    ) : (
                      <>
                        <User size={40} className="text-[#94A3B8]" />
                        {isEditing && (
                          <ImageUpload 
                            onUpload={(base64) => onUpdatePlayer(selectedPerson.id, 'image', base64)}
                            className="absolute inset-0 border-none"
                            label="FOTO"
                          />
                        )}
                      </>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`${getCategoryColor(selectedPerson.category)} text-[#0A0E17] px-2.5 py-0.5 rounded text-[10px] font-black border border-white/20 tracking-wider flex items-center gap-2`}>
                        <span className="opacity-90">{getCategoryLabel(selectedPerson.category)}</span>
                         {normalizeCategory(selectedPerson.category) === 'player' && (
                           <span className="pl-2 border-l border-black/30 tracking-normal font-mono">#{selectedPerson.number}</span>
                         )}
                      </span>
                      <span className="text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider">{selectedPerson.status}</span>
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black uppercase leading-none mb-1 text-[#F8FAFC]">{selectedPerson.lastName}</h2>
                    <p className={`font-black uppercase tracking-wider text-xs sm:text-sm mt-1.5 ${selectedPerson.category === 'player' ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>{selectedPerson.position}</p>
                  </div>
                </div>
                {isEditing && (
                  <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={() => onEditPlayer(selectedPerson)}
                      className="p-2 bg-[#1E293B] text-[#F8FAFC] hover:bg-[#F59E0B] hover:text-[#0A0E17] transition-all border border-[#334155] rounded-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        onDeletePlayer(selectedPerson.id);
                      }}
                      className="p-2 bg-[#1E293B] text-red-400 hover:bg-red-600 hover:text-white transition-all border border-[#334155] rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 bg-[#1E293B]">
                {/* Left Column: Details */}
                <div className={`space-y-6 ${selectedPerson.category !== 'player' ? 'md:col-span-2' : ''}`}>
                  <section>
                    <h4 className="font-black uppercase text-xs border-b border-[#334155] pb-2 mb-3 flex items-center gap-2 text-[#10B981]">
                      <div className="w-2 h-2 rounded-full bg-[#10B981]" /> Basisdaten
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] font-black uppercase text-[#94A3B8]">Geburtsdatum</p>
                        <p className="font-black uppercase text-sm text-[#F8FAFC] font-mono">{selectedPerson.geburtsdatum || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-[#94A3B8]">Wochentag</p>
                        <p className="font-black uppercase text-sm text-[#F8FAFC]">{selectedPerson.wochentag || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[9px] font-black uppercase text-[#94A3B8]">Adresse</p>
                        <p className="font-black uppercase text-sm text-[#F8FAFC]">{selectedPerson.adresse || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-[#94A3B8]">Telefon</p>
                        <p className="font-black uppercase text-sm text-[#F8FAFC] font-mono">{selectedPerson.telefon || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-[#94A3B8]">Email</p>
                        <p className="font-black uppercase text-sm lowercase text-[#F8FAFC]">{selectedPerson.email || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[9px] font-black uppercase text-[#94A3B8]">Beruflicher Status / Ausbildung / Arbeitgeber</p>
                        <p className="font-black uppercase text-sm text-[#F8FAFC]">
                          {selectedPerson.beruf || selectedPerson.professionalStatus || '-'} 
                          {selectedPerson.education && selectedPerson.education !== selectedPerson.beruf ? ` / ${selectedPerson.education}` : ''}
                          {selectedPerson.employer ? ` / ${selectedPerson.employer}` : ''}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[9px] font-black uppercase text-[#94A3B8]">Verletzungshistorie</p>
                        <p className="font-black uppercase text-sm text-[#F59E0B]">{selectedPerson.injuryHistory || '-'}</p>
                      </div>
                      {selectedPerson.category === 'player' && (
                        <div>
                          <p className="text-[9px] font-black uppercase text-[#94A3B8]">Gesamteinsatzzeit (Pflichtspiele)</p>
                          <p className="font-black uppercase text-sm text-[#10B981] font-mono">{selectedPerson.einsatzzeitenGesamt || 0} MIN</p>
                        </div>
                      )}
                    </div>
                  </section>

                  {selectedPerson.category === 'player' && (
                    <>
                      <section>
                        <h4 className="font-black uppercase text-xs border-b border-[#334155] pb-2 mb-3 flex items-center gap-2 text-[#10B981]">
                          <div className="w-2 h-2 rounded-full bg-[#10B981]" /> Ausrüstung
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-black uppercase text-[#94A3B8]">Oberteil / Schuhe</p>
                            <p className="font-black uppercase text-sm text-[#F8FAFC] font-mono">{selectedPerson.oberteil || '-'} / {selectedPerson.schuhe || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-[#94A3B8]">Hosen (K/L)</p>
                            <p className="font-black uppercase text-sm text-[#F8FAFC] font-mono">{selectedPerson.kurze_hose || '-'} / {selectedPerson.lange_hose || '-'}</p>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h4 className="font-black uppercase text-xs border-b border-[#334155] pb-2 mb-3 flex items-center gap-2 text-[#10B981]">
                          <div className="w-2 h-2 rounded-full bg-[#10B981]" /> Physis & Diagnostik
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-black uppercase text-[#94A3B8]">Größe / Gewicht</p>
                            <p className="font-black uppercase text-sm text-[#F8FAFC] font-mono">{selectedPerson.physical?.height}cm / {selectedPerson.physical?.weight}kg</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-[#94A3B8]">Starker Fuß</p>
                            <p className="font-black uppercase text-sm text-[#F8FAFC]">{selectedPerson.physical?.strongFoot || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-[#94A3B8]">Sprintwert</p>
                            <p className="font-black uppercase text-sm text-[#F8FAFC] font-mono">{selectedPerson.diagnostics?.sprintwert || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-[#94A3B8]">Yoyo-Test</p>
                            <p className="font-black uppercase text-sm text-[#F8FAFC] font-mono">{selectedPerson.diagnostics?.yoyotest || '-'}</p>
                          </div>
                        </div>
                      </section>
                    </>
                  )}

                  {selectedPerson.category === 'player' && (
                    <section>
                      <h4 className="font-black uppercase text-xs border-b border-[#334155] pb-2 mb-3 flex items-center gap-2 text-[#10B981]">
                        <div className="w-2 h-2 rounded-full bg-[#10B981]" /> Notizen
                      </h4>
                      <p className="text-xs font-bold leading-relaxed text-[#94A3B8] italic bg-[#121824] p-3 rounded-lg border border-[#334155]">
                        {selectedPerson.notizen || 'Keine Notizen hinterlegt.'}
                      </p>
                    </section>
                  )}

                  {selectedPerson.category === 'player' && (
                    <section className="bg-[#121824] p-4 border border-[#334155] rounded-xl col-span-1 md:col-span-2 shadow-inner">
                      <h4 className="font-black uppercase text-xs border-b border-[#334155] pb-2 mb-3 flex items-center gap-2 text-[#F59E0B]">
                        <div className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Leistungs- & Belastungsmonitoring (Post-Session)
                      </h4>
                      {workloadStats ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                            <div className="bg-[#1E293B] p-2.5 border border-[#334155] rounded-lg">
                              <p className="text-[8px] font-black uppercase text-[#94A3B8]">Einheiten</p>
                              <p className="text-lg font-black text-[#F8FAFC] font-mono">{workloadStats.count}</p>
                            </div>
                            <div className="bg-[#1E293B] p-2.5 border border-[#334155] rounded-lg">
                              <p className="text-[8px] font-black uppercase text-[#94A3B8]">Ø RPE (Gefühl)</p>
                              <p className="text-lg font-black text-[#F59E0B] font-mono">{(workloadStats.rpeSum / workloadStats.count).toFixed(1)}/10</p>
                            </div>
                            <div className="bg-[#1E293B] p-2.5 border border-[#334155] rounded-lg">
                              <p className="text-[8px] font-black uppercase text-[#94A3B8]">Ø Load Units</p>
                              <p className="text-lg font-black text-[#10B981] font-mono">{Math.round(workloadStats.loadSum / workloadStats.count)}</p>
                            </div>
                            <div className="bg-[#1E293B] p-2.5 border border-[#334155] rounded-lg">
                              <p className="text-[8px] font-black uppercase text-[#94A3B8]">Gesamt-Minuten</p>
                              <p className="text-lg font-black text-[#F8FAFC] font-mono">{workloadStats.durationSum}m</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-wider text-[#94A3B8]">Letzte eingetragene Einheiten:</p>
                            <div className="space-y-2">
                              {activePersonLogs.slice(0, 3).map((log: any) => (
                                <div key={log.id} className="bg-[#1E293B] p-2 border border-[#334155] rounded-lg flex justify-between items-center text-[10px]">
                                  <div>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded mr-1.5 uppercase ${log.type === 'Match' ? 'bg-red-900/80 text-red-200 border border-red-700' : 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'}`}>
                                      {log.type}
                                    </span>
                                    <span className="font-bold text-[#F8FAFC] uppercase">{log.focus}</span>
                                  </div>
                                  <div className="font-mono font-bold text-[#94A3B8]">
                                    {log.date} • {log.duration} Min • RPE {log.rpe} (Load: {log.calculatedLoad})
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs font-bold leading-relaxed text-[#94A3B8] italic">
                          Noch keine Post-Session Logs für diesen Spieler eingetragen. Spieler können diese Daten im Reiter "Spieler-Bereich 📝" einpflegen.
                        </p>
                      )}
                    </section>
                  )}

                  {/* Additional Images Section */}
                  <section className="col-span-1 md:col-span-2">
                    <h4 className="font-black uppercase text-xs border-b border-[#334155] pb-2 mb-3 flex items-center gap-2 text-[#10B981]">
                      <div className="w-2 h-2 rounded-full bg-[#10B981]" /> Weitere Impressionen
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(selectedPerson.additionalImages || []).map((img, idx) => (
                        <div key={idx} className="aspect-square border border-[#334155] rounded-lg overflow-hidden shadow-lg bg-[#121824] transition-transform hover:scale-[1.02]">
                          <PlayerImageWithLightbox 
                            image={img}
                            isEditing={isEditing}
                            lastName={selectedPerson.lastName}
                            onUpdate={(base64) => {
                              const newImgs = [...(selectedPerson.additionalImages || [])];
                              newImgs[idx] = base64;
                              onUpdatePlayer(selectedPerson.id, 'additionalImages', newImgs);
                            }}
                            onDelete={() => {
                              const newImgs = (selectedPerson.additionalImages || []).filter((_, i) => i !== idx);
                              onUpdatePlayer(selectedPerson.id, 'additionalImages', newImgs);
                            }}
                            className="w-full h-full"
                          />
                        </div>
                      ))}
                      {isEditing && (
                        <ImageUpload 
                          onUpload={(base64) => {
                            const newImgs = [...(selectedPerson.additionalImages || []), base64];
                            onUpdatePlayer(selectedPerson.id, 'additionalImages', newImgs);
                          }}
                          className="aspect-square border border-dashed border-[#334155] bg-[#121824] rounded-lg"
                          label="BILD HINZUFÜGEN"
                        />
                      )}
                    </div>
                  </section>
                </div>

                {/* Right Column: Analysis/Finance */}
                <div className={`space-y-6 ${selectedPerson.category !== 'player' ? 'md:col-span-2' : ''}`}>
                  {selectedPerson.category === 'player' && (
                    <section>
                      <h4 className="font-black uppercase text-xs border-b border-[#334155] pb-2 mb-3 flex items-center gap-2 text-[#10B981]">
                        <div className="w-2 h-2 rounded-full bg-[#10B981]" /> Analyse & Stärken
                      </h4>
                      <div className="space-y-3">
                        <div className="bg-[#121824] p-2.5 rounded-lg border border-[#334155]">
                          <p className="text-[9px] font-black uppercase text-[#10B981]">Stärken</p>
                          <p className="text-xs font-bold text-[#F8FAFC] mt-0.5">{selectedPerson.analysis?.strengths || '-'}</p>
                        </div>
                        <div className="bg-[#121824] p-2.5 rounded-lg border border-[#334155]">
                          <p className="text-[9px] font-black uppercase text-[#F59E0B]">Schwächen</p>
                          <p className="text-xs font-bold text-[#F8FAFC] mt-0.5">{selectedPerson.analysis?.weaknesses || '-'}</p>
                        </div>
                        <div className="bg-[#121824] p-2.5 rounded-lg border border-[#334155]">
                          <p className="text-[9px] font-black uppercase text-[#06B6D4]">Entwicklungspotenzial</p>
                          <p className="text-xs font-bold text-[#F8FAFC] mt-0.5">{selectedPerson.analysis?.development || '-'}</p>
                        </div>
                      </div>
                    </section>
                  )}

                  <section>
                    <h4 className="font-black uppercase text-xs border-b border-[#334155] pb-2 mb-3 flex items-center gap-2 text-[#10B981]">
                      <div className="w-2 h-2 rounded-full bg-[#10B981]" /> Finanzen & Vertrag
                    </h4>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-[#121824] p-2.5 rounded-lg border border-[#334155]">
                        <p className="text-[9px] font-black uppercase text-[#94A3B8]">Grundgehalt</p>
                        <p className="font-black uppercase text-sm text-[#F8FAFC] font-mono">{selectedPerson.finance?.baseSalary} €</p>
                      </div>
                      <div className="bg-[#121824] p-2.5 rounded-lg border border-[#334155]">
                        <p className="text-[9px] font-black uppercase text-[#94A3B8]">Prämie/Spiel</p>
                        <p className="font-black uppercase text-sm text-[#F8FAFC] font-mono">{selectedPerson.finance?.bonusPerMatch} €</p>
                      </div>
                      <div className="bg-[#121824] p-2.5 rounded-lg border border-[#334155]">
                        <p className="text-[9px] font-black uppercase text-[#06B6D4]">Monate Aktiv</p>
                        <p className="font-black uppercase text-sm text-[#06B6D4] font-mono">{selectedPerson.finance?.months || 12}</p>
                      </div>
                    </div>
                    <div className="bg-[#121824] p-2.5 rounded-lg border border-[#334155]">
                      <p className="text-[9px] font-black uppercase text-[#94A3B8]">Nebenvereinbarungen</p>
                      <p className="text-xs font-bold text-[#F8FAFC] mt-0.5">{selectedPerson.finance?.sideAgreements || 'Keine'}</p>
                    </div>
                  </section>

                  {/* Video Section for Person */}
                  <section className="pt-4 border-t border-[#334155]">
                    <VideoSection 
                      title={`Video-Highlights (${selectedPerson.lastName})`}
                      subtitle="Szenen, Torchancen, Zweikämpfe und Taktik-Analysen"
                      clips={selectedPerson.videoHighlights || []}
                      onUpdateClips={(clips) => {
                        onUpdatePlayer(selectedPerson.id, 'videoHighlights', clips);
                      }}
                      players={players}
                      defaultCategory="Spieler-Momente"
                    />
                  </section>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-[#94A3B8] gap-4 border-2 border-dashed border-[#334155] rounded-xl bg-[#121824]/50 p-8">
              <User size={48} className="text-[#94A3B8]" />
              <p className="font-black uppercase tracking-widest text-sm text-[#94A3B8]">Bitte wählen Sie eine Person aus</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* TRACKER REPORT MODAL */}
      {showTrackerModal && (
        <TrackerReportModal
          players={players}
          onClose={() => setShowTrackerModal(false)}
          onUpdatePlayer={onUpdatePlayer}
        />
      )}
    </div>
  );
};

export default PersonnelView;
