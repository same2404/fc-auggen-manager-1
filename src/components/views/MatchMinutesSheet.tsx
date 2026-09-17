import React, { useState } from 'react';
import { Spieler, Match, MatchMinuteRecord } from '../../types';
import { sortPlayers } from '../../utils/playerSorting';
import { 
  Timer, 
  Plus, 
  Trash2, 
  Pencil,
  ChevronRight, 
  MapPin, 
  Clock, 
  Shield,
  Activity,
  History,
  Maximize2,
  Flag
} from 'lucide-react';
import { MatchDetailMask } from './MatchDetailMask';
import { AnimatePresence } from 'motion/react';

interface MatchMinutesSheetProps {
  players: Spieler[];
  matches: Match[];
  data: MatchMinuteRecord[];
  type: 'competitive' | 'test';
  onUpdateMatch: (id: string | number, field: keyof Match, value: any) => void;
  onUpdateMinutes: (type: 'competitive' | 'test', playerId: string, matchId: string | number, mins: number) => void;
  onUpdatePlayer: (id: string, field: keyof Spieler, value: any) => void;
  onEditPlayer: (player: Spieler) => void;
  onDeletePlayer: (id: string) => void;
  onDeleteMatch: (id: string | number) => void;
  onAddMatch: () => void;
  isEditing?: boolean;
  opponents?: { id: string | number; name: string }[];
}

export const MatchMinutesSheet: React.FC<MatchMinutesSheetProps> = ({
  players,
  matches,
  data,
  type,
  onUpdateMatch,
  onUpdateMinutes,
  onUpdatePlayer,
  onEditPlayer,
  onDeletePlayer,
  onDeleteMatch,
  onAddMatch,
  isEditing = false,
  opponents = []
}) => {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const sortedPlayers = sortPlayers(players);
  const columnCount = type === 'competitive' ? 32 : 20;
  
  const displayMatches = Array.from({ length: columnCount }, (_, i) => {
    const match = matches.find(m => m.index === i);
    return match || { id: -(i + 1), index: i, opponent: '', location: '', isHome: true, kickOff: '', meetingTime: '' } as Match;
  });

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] border border-[#DADADA] rounded-xl shadow-xs overflow-hidden">
      <div className="p-3 border-b border-[#DADADA] bg-[#E8E8E8] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Timer size={14} className="text-[#00C2FF]" />
            <h3 className="font-black uppercase text-xs tracking-widest text-[#F8FAFC]">
              {type === 'competitive' ? 'Einsatzminuten Pflichtspiele' : 'Einsatzminuten Testspiele'}
            </h3>
          </div>
          {isEditing && (
            <button 
              onClick={onAddMatch}
              className="bg-[#00C2FF] text-[#0A0A0A] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border border-[#00C2FF] shadow-[0_0_8px_rgba(0,194,255,0.4)] hover:bg-[#00B0E6] transition-all flex items-center gap-1"
            >
              <Plus size={12} /> Spiel hinzufügen
            </button>
          )}
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#4A4A4A]">
            <Activity size={12} />
            <span>Saison 26/27</span>
          </div>
        </div>
        {!isEditing && (
          <p className="text-[10px] font-bold uppercase text-[#4A4A4A] italic">
            Aktiviere den Bearbeitungsmodus, um Gegnernamen einzutragen.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full border-collapse text-[10px] font-bold text-[#F8FAFC]">
          <thead className="sticky top-0 bg-[#E8E8E8] text-[#F8FAFC] z-20 border-b border-[#DADADA]">
            <tr>
              <th className="p-3 border border-[#DADADA] text-left w-10 uppercase tracking-wider">Nr</th>
              <th className="p-3 border border-[#DADADA] text-center w-12 uppercase tracking-wider">#</th>
              <th className="p-3 border border-[#DADADA] text-left w-96 uppercase tracking-wider">Spieler</th>
              <th className="p-3 border border-[#DADADA] text-center w-12 uppercase tracking-wider">Pos</th>
              <th className="p-3 border border-[#DADADA] text-center w-20 uppercase tracking-wider">Gesamt</th>
              {isEditing && <th className="p-3 border border-[#DADADA] text-center w-20 uppercase tracking-wider">Aktion</th>}
              {displayMatches.map((match, idx) => (
                <th key={`mins-th-match-${match.id ?? idx}-${idx}`} className="p-0 border border-white/20 min-w-[120px]">
                  <div className="flex flex-col bg-gray-900">
                    <div className="p-1.5 border-b border-white/10 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[6px] opacity-40 w-6">GEG</span>
                        <input 
                          type="text"
                          list="opponent-list-sheet"
                          className={`bg-transparent text-[8px] font-black uppercase flex-1 focus:outline-none placeholder:text-white/20 ${!isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                          value={match.opponent || ''}
                          onChange={(e) => onUpdateMatch(match.id, 'opponent', e.target.value)}
                          placeholder={isEditing ? "..." : ""}
                          disabled={!isEditing}
                        />
                        <datalist id="opponent-list-sheet">
                          {opponents.map((opp, oIdx) => (
                            <option key={`opp-opt-${opp.id ?? oIdx}-${oIdx}`} value={opp.name} />
                          ))}
                        </datalist>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[6px] opacity-40 w-6">ORT</span>
                        <input 
                          type="text"
                          className={`bg-transparent text-[7px] font-bold uppercase flex-1 focus:outline-none placeholder:text-white/20 ${!isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                          value={match.location || ''}
                          onChange={(e) => onUpdateMatch(match.id, 'location', e.target.value)}
                          placeholder={isEditing ? "..." : ""}
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[6px] opacity-40 w-6">ZEIT</span>
                        <input 
                          type="text"
                          className={`bg-transparent text-[7px] font-bold uppercase flex-1 focus:outline-none placeholder:text-white/20 ${!isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                          value={match.kickOff || ''}
                          onChange={(e) => onUpdateMatch(match.id, 'kickOff', e.target.value)}
                          placeholder={isEditing ? "..." : ""}
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[6px] opacity-40 w-6">TRP</span>
                        <input 
                          type="text"
                          className={`bg-transparent text-[7px] font-bold uppercase flex-1 focus:outline-none placeholder:text-white/20 ${!isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                          value={match.meetingPoint || ''}
                          onChange={(e) => onUpdateMatch(match.id, 'meetingPoint', e.target.value)}
                          placeholder={isEditing ? "..." : ""}
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[6px] opacity-40 w-6">RES</span>
                        <input 
                          type="text"
                          className={`bg-transparent text-[8px] font-black uppercase flex-1 focus:outline-none placeholder:text-white/20 text-[#C00000] ${!isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                          value={(match as any).result || ''}
                          onChange={(e) => onUpdateMatch(match.id, 'result' as any, e.target.value)}
                          placeholder={isEditing ? "..." : ""}
                          disabled={!isEditing}
                        />
                      </div>
                      {match.id !== undefined && (typeof match.id === 'string' || (typeof match.id === 'number' && match.id > 0)) && (
                        <div className="flex gap-1 mt-1 border-t border-white/10 pt-1">
                          <button 
                            onClick={() => setSelectedMatch(match)}
                            className="flex-1 bg-[#1E293B]/10 hover:bg-[#1E293B]/20 text-white py-1 rounded flex justify-center transition-colors"
                            title="Match Maske öffnen"
                          >
                            <Maximize2 size={10} />
                          </button>
                          {isEditing && (
                            <button 
                              onClick={() => {
                                onDeleteMatch(match.id);
                              }}
                              className="flex-1 bg-red-900/40 hover:bg-red-900/60 text-red-200 py-1 rounded flex justify-center transition-colors"
                              title="Spiel löschen"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['player', 'coach', 'staff', 'medical'].map(category => {
              const filteredPlayers = sortedPlayers.filter(p => (p.category || 'player') === category);
              if (filteredPlayers.length === 0) return null;

              return (
                <React.Fragment key={category}>
                  <tr className="bg-gray-200">
                    <td colSpan={columnCount + (isEditing ? 6 : 5)} className="p-2 font-black uppercase text-[10px] tracking-widest border border-black">
                      {category === 'player' ? 'Spielerkader' : category === 'coach' ? 'Trainerteam' : category === 'staff' ? 'Funktionsteam' : 'Ärztliche Abteilung'}
                    </td>
                  </tr>
                  {filteredPlayers.map((player, pIdx) => {
                    const record = data.find(r => r.playerId === player.id);
                    const totalMins = Object.values(record?.matchMinutes || {}).reduce((a, b) => a + b, 0);

                    return (
                      <tr key={`mins-row-${player.id}`} className="hover:bg-[#121824] transition-colors border-b border-black/10">
                        <td className="p-3 border-r border-black/10 text-center opacity-40">{pIdx + 1}</td>
                        <td className="p-3 border-r border-black/10 text-center font-black">
                          {player.category === 'player' ? player.number : (player.category === 'coach' ? 'T' : (player.category === 'staff' ? 'F' : 'M'))}
                        </td>
                        <td className="p-3 border-r border-black/10">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <input 
                                type="text"
                                className="bg-transparent focus:outline-none w-full text-[11px] font-bold uppercase"
                                value={player.lastName || ''}
                                onChange={(e) => onUpdatePlayer(player.id, 'lastName', e.target.value)}
                              />
                            </div>
                          ) : (
                            <span className="text-[11px] font-black uppercase tracking-widest">
                              {player.lastName}
                            </span>
                          )}
                        </td>
                        <td className="p-3 border-r border-black/10 text-center text-[#C00000] text-[9px]">{player.position}</td>
                        <td className="p-3 border-r border-black/10 text-center font-black bg-[#121824]">{totalMins}</td>
                        {isEditing && (
                          <td className="p-3 border-r border-black/10 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => onEditPlayer(player)}
                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                title="Bearbeiten"
                              >
                                <Pencil size={14} />
                              </button>
                              <button 
                                onClick={() => {
                                  onDeletePlayer(player.id);
                                }}
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Löschen"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                        {displayMatches.map((match, mIdx) => (
                          <td key={`mins-cell-${player.id}-${match.id ?? mIdx}-${mIdx}`} className="p-0 border-r border-black/10">
                            <input 
                              type="number"
                              className={`w-full h-full p-3 text-center bg-transparent font-black focus:bg-yellow-50 focus:outline-none ${!isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                              value={record?.matchMinutes?.[match.id] || record?.[`matchMinutes.${match.id}`] || ''}
                              onChange={(e) => onUpdateMinutes(type, player.id, match.id, parseInt(e.target.value) || 0)}
                              placeholder={isEditing ? "0" : ""}
                              disabled={!isEditing || (typeof match.id === 'number' && match.id < 0)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-[#E8E8E8] text-[#F8FAFC] border-t border-[#DADADA] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <History size={14} className="text-[#00C2FF]" />
            <span className="text-[10px] font-black uppercase tracking-wider">Gesamtminuten Kader: {data.reduce((sum, r) => sum + Object.values(r.matchMinutes || {}).reduce((a, b) => a + b, 0), 0)}</span>
          </div>
        </div>
        <p className="text-[9px] font-bold uppercase text-[#4A4A4A] italic">
          Gegnernamen werden in den Spaltenköpfen eingetragen.
        </p>
      </div>

      <AnimatePresence>
        {selectedMatch && (
          <MatchDetailMask 
            match={selectedMatch}
            players={players}
            data={data}
            onClose={() => setSelectedMatch(null)}
            onUpdateMatch={onUpdateMatch}
            isEditing={isEditing}
            opponents={opponents}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
