import React from 'react';
import { Spieler, Match, MatchMinuteRecord } from '../../types';
import { 
  X, 
  MapPin, 
  Clock, 
  Shield, 
  Users, 
  Timer,
  Trophy,
  Map,
  Flag,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MatchDetailMaskProps {
  match: Match;
  players: Spieler[];
  data: MatchMinuteRecord[];
  onClose: () => void;
  onUpdateMatch?: (id: string | number, field: keyof Match, value: any) => void;
  isEditing?: boolean;
  opponents?: { id: string | number; name: string }[];
}

// Local state component to prevent hanging
const EditableTextarea = ({ value, onSave, placeholder, className }: { 
  value: string, 
  onSave: (val: string) => void, 
  placeholder?: string, 
  className?: string
}) => {
  const [localValue, setLocalValue] = React.useState(value);
  
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <textarea 
      className={className}
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        if (localValue !== value) onSave(localValue);
      }}
    />
  );
};

const EditableInput = ({ value, onSave, placeholder, className, type = "text", listId }: { 
  value: string, 
  onSave: (val: string) => void, 
  placeholder?: string, 
  className?: string,
  type?: string,
  listId?: string
}) => {
  const [localValue, setLocalValue] = React.useState(value);
  
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <input 
      type={type}
      list={listId}
      className={className}
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        if (localValue !== value) onSave(localValue);
      }}
    />
  );
};

export const MatchDetailMask: React.FC<MatchDetailMaskProps> = ({
  match,
  players,
  data,
  onClose,
  onUpdateMatch,
  isEditing = false,
  opponents = []
}) => {
  const parseMatchDate = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return new Date();
    let normalizedDate = dateStr;
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        normalizedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    const time = timeStr || "00:00";
    return new Date(`${normalizedDate}T${time}`);
  };

  const handleExportICS = () => {
    const matchDate = parseMatchDate(match.date, match.kickOff);
    const endDate = new Date(matchDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration

    const formatDateToICS = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FC Auggen Match Manager//NONSGML v1.0//EN',
      'BEGIN:VEVENT',
      `UID:${match.id}-${Date.now()}@fc-auggen`,
      `DTSTAMP:${formatDateToICS(new Date())}`,
      `DTSTART:${formatDateToICS(matchDate)}`,
      `DTEND:${formatDateToICS(endDate)}`,
      `SUMMARY:Spiel FC Auggen vs. ${match.opponent}`,
      `DESCRIPTION:Spielort: ${match.location || 'Nicht festgelegt'}\\nTreffpunkt: ${match.meetingPoint || 'Nicht festgelegt'} (${match.meetingTime || '--:--'})\\nNotizen: ${match.notes || ''}\\nTorschützen: ${match.scorers || 'Keine'}\\nKarten: ${match.cards || 'Keine'}`,
      `LOCATION:${match.location || 'Nicht festgelegt'}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spiel_${match.opponent || 'match'}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter players who have minutes in this match
  const matchPlayers = players.map(player => {
    const record = data.find(r => r.playerId === player.id);
    const minutes = record?.matchMinutes?.[match.id] || record?.[`matchMinutes.${match.id}`] || 0;
    return { ...player, minutes };
  }).filter(p => p.minutes > 0 || isEditing);

  // Sort by position then number
  const sortedMatchPlayers = [...matchPlayers].sort((a, b) => {
    if (a.minutes > 0 && b.minutes === 0) return -1;
    if (a.minutes === 0 && b.minutes > 0) return 1;
    return 0;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#1E293B] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-black text-white p-6 flex justify-between items-start shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="text-[#C00000]" size={20} />
              <span className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Spielbericht / Match Mask</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
              <div className="flex-1">
                <label className="text-[10px] font-black uppercase opacity-40 block mb-1">Gegner</label>
                {isEditing ? (
                  <div className="relative">
                    <EditableInput 
                      type="text"
                      listId="opponent-list-mask"
                      className="bg-[#1E293B]/10 border-b-2 border-white/20 focus:border-[#C00000] outline-none w-full text-2xl md:text-4xl font-black uppercase py-1"
                      value={match.opponent || ''}
                      onSave={(val) => onUpdateMatch?.(match.id, 'opponent', val)}
                      placeholder="GEGNER EINTRAGEN..."
                    />
                    <datalist id="opponent-list-mask">
                      {opponents.map((opp) => (
                        <option key={opp.id} value={opp.name} />
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight">
                    {match.opponent || 'KEIN GEGNER'}
                  </h2>
                )}
              </div>
              
              <div className="shrink-0 flex flex-col items-center justify-center bg-[#1E293B]/10 px-6 py-2 border-2 border-white/20 rounded-lg">
                <label className="text-[10px] font-black uppercase opacity-40 block mb-1">Ergebnis</label>
                {isEditing ? (
                  <EditableInput 
                    className="bg-transparent text-center text-2xl font-black w-20 outline-none focus:text-[#C00000]"
                    value={match.result || ''}
                    onSave={(val) => onUpdateMatch?.(match.id, 'result', val)}
                    placeholder="-:-"
                  />
                ) : (
                  <span className="text-3xl font-black text-[#C00000]">{match.result || '-:-'}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            <button
              onClick={handleExportICS}
              className="bg-[#C00000] hover:bg-red-700 text-white font-black text-[9px] uppercase tracking-wider px-3 py-1.5 border-2 border-white flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              title="In Kalender eintragen (ICS)"
            >
              <Calendar size={14} /> Kalender (.ics)
            </button>
            <button 
              onClick={onClose}
              className="bg-[#1E293B] text-black p-2 hover:bg-[#C00000] hover:text-white transition-colors border-2 border-black"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 border-b-4 border-black bg-[#1E293B]">
          <div className="p-4 border-r-2 border-black flex items-center gap-3">
            <div className="bg-black p-2 rounded text-white shrink-0">
              <MapPin size={18} />
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase opacity-40 block">Spielort</label>
              {isEditing ? (
                <EditableInput 
                  className="bg-transparent font-bold text-sm outline-none w-full"
                  value={match.location || ''}
                  onSave={(val) => onUpdateMatch?.(match.id, 'location', val)}
                />
              ) : (
                <span className="font-bold text-sm uppercase">{match.location || 'Nicht festgelegt'}</span>
              )}
            </div>
          </div>

          <div className="p-4 border-r-2 border-black flex items-center gap-3">
            <div className="bg-black p-2 rounded text-white shrink-0">
              <Flag size={18} />
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase opacity-40 block">Treffpunkt</label>
              {isEditing ? (
                <EditableInput 
                  className="bg-transparent font-bold text-sm outline-none w-full"
                  value={match.meetingPoint || ''}
                  onSave={(val) => onUpdateMatch?.(match.id, 'meetingPoint', val)}
                />
              ) : (
                <span className="font-bold text-sm uppercase">{match.meetingPoint || 'Nicht festgelegt'}</span>
              )}
            </div>
          </div>

          <div className="p-4 border-r-2 border-black flex items-center gap-3">
            <div className="bg-black p-2 rounded text-white shrink-0">
              <Clock size={18} />
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase opacity-40 block">Spielbeginn</label>
              {isEditing ? (
                <EditableInput 
                  className="bg-transparent font-bold text-sm outline-none w-full"
                  value={match.kickOff || ''}
                  onSave={(val) => onUpdateMatch?.(match.id, 'kickOff', val)}
                />
              ) : (
                <span className="font-bold text-sm uppercase">{match.kickOff || '--:--'}</span>
              )}
            </div>
          </div>

          <div className="p-4 flex items-center gap-3">
            <div className="bg-black p-2 rounded text-white shrink-0">
              <Timer size={18} />
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase opacity-40 block">Treffzeit</label>
              {isEditing ? (
                <EditableInput 
                  className="bg-transparent font-bold text-sm outline-none w-full"
                  value={match.meetingTime || ''}
                  onSave={(val) => onUpdateMatch?.(match.id, 'meetingTime', val)}
                />
              ) : (
                <span className="font-bold text-sm uppercase">{match.meetingTime || '--:--'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Player List */}
        <div className="flex-1 overflow-auto p-6 bg-[#121824]">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-[#C00000]" />
            <h3 className="font-black uppercase text-sm tracking-widest">Eingesetzte Spieler</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedMatchPlayers.map((player) => (
              <div 
                key={player.id}
                className={`flex items-center gap-3 p-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-[#1E293B] transition-all ${player.minutes === 0 ? 'opacity-40' : ''}`}
              >
                <div className="w-10 h-10 bg-black text-white flex items-center justify-center font-black text-lg shrink-0">
                  {player.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black uppercase text-xs truncate">{player.lastName}</div>
                  <div className="text-[10px] font-bold text-[#C00000] uppercase">{player.position}</div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black uppercase opacity-40">Min</span>
                  <span className="text-lg font-black">{player.minutes}</span>
                </div>
              </div>
            ))}
            {sortedMatchPlayers.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-black/20 rounded-lg">
                <p className="font-bold text-gray-400 uppercase tracking-widest">Keine Spielerdaten für dieses Spiel vorhanden</p>
              </div>
            )}
          </div>

          {/* Scorers, Cards & Notes */}
          <div className="mt-8 border-t-4 border-black pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#1E293B] border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h4 className="font-black uppercase text-xs mb-3 flex items-center gap-1.5 text-red-600">
                <span>⚽</span> Torschützen
              </h4>
              {isEditing ? (
                <EditableInput 
                  className="w-full border-2 border-black p-2 font-black text-xs uppercase outline-none focus:border-[#C00000] bg-[#1E293B] text-black"
                  placeholder="Z.B. Müller (2), Meier (45')..."
                  value={match.scorers || ''}
                  onSave={(val) => onUpdateMatch?.(match.id, 'scorers', val)}
                />
              ) : (
                <p className="font-bold text-xs uppercase opacity-80 min-h-[36px] bg-[#1E293B] p-2 border border-dashed border-black/10 text-black">
                  {match.scorers || 'Keine Torschützen eingetragen'}
                </p>
              )}
            </div>

            <div className="bg-[#1E293B] border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h4 className="font-black uppercase text-xs mb-3 flex items-center gap-1.5 text-yellow-600">
                <span>🟨</span> Karten (Gelb/Rot)
              </h4>
              {isEditing ? (
                <EditableInput 
                  className="w-full border-2 border-black p-2 font-black text-xs uppercase outline-none focus:border-[#C00000] bg-[#1E293B] text-black"
                  placeholder="Z.B. Müller (Gelb), Schmidt (Rot)..."
                  value={match.cards || ''}
                  onSave={(val) => onUpdateMatch?.(match.id, 'cards', val)}
                />
              ) : (
                <p className="font-bold text-xs uppercase opacity-80 min-h-[36px] bg-[#1E293B] p-2 border border-dashed border-black/10 text-black">
                  {match.cards || 'Keine Karten eingetragen'}
                </p>
              )}
            </div>

            <div className="col-span-full bg-[#1E293B] border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h4 className="font-black uppercase text-xs mb-3 flex items-center gap-1.5 text-black">
                <span>📝</span> Allgemeine Spielnotizen & Taktikberichte
              </h4>
              {isEditing ? (
                <EditableTextarea 
                  className="w-full border-2 border-black p-2 font-bold text-xs outline-none focus:border-[#C00000] min-h-[100px] bg-[#1E293B] text-black"
                  placeholder="Allgemeine Spielnotizen, Aufstellungsdetails, Notizen..."
                  value={match.notes || ''}
                  onSave={(val) => onUpdateMatch?.(match.id, 'notes', val)}
                />
              ) : (
                <p className="font-bold text-xs opacity-80 min-h-[60px] whitespace-pre-wrap bg-[#1E293B] p-2 border border-dashed border-black/10 text-black">
                  {match.notes || 'Keine Spielnotizen vorhanden'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#1E293B] border-t-2 border-black flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-[#C00000]" />
              <span className="text-[10px] font-black uppercase tracking-widest">FC Auggen 26/27</span>
            </div>
          </div>
          <div className="text-[10px] font-black uppercase opacity-40 italic">
            {match.isHome ? 'Heimspiel' : 'Auswärtsspiel'}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
