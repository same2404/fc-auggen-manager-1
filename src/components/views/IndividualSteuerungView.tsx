import React from 'react';
import { Player } from '../../types';
import { sortPlayers } from '../../utils/playerSorting';
import { 
  Activity, 
  Plus, 
  Trash2, 
  Target, 
  TrendingUp, 
  History,
  AlertCircle,
  Calendar,
  Clock,
  User,
  Shield,
  Search
} from 'lucide-react';

interface IndividualSteuerungViewProps {
  players: Player[];
  individualTrainingData: any[];
  selectedIndividualDate: string;
  setSelectedIndividualDate: (date: string) => void;
  handleUpdateIndividualTraining: (playerId: string, field: string, value: any) => void;
  onUpdatePlayer: (id: string, field: keyof Player, value: any) => void;
  onDeletePlayer: (id: string) => void;
  onAddPlayer?: () => void;
  onAddPlayerDirect?: (player: any) => void;
  isEditing?: boolean;
}

export const IndividualSteuerungView: React.FC<IndividualSteuerungViewProps> = ({
  players,
  individualTrainingData,
  selectedIndividualDate,
  setSelectedIndividualDate,
  handleUpdateIndividualTraining,
  onUpdatePlayer,
  onDeletePlayer,
  onAddPlayer,
  onAddPlayerDirect,
  isEditing = false
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [ampelFilter, setAmpelFilter] = React.useState<'ALLE' | 'Grün' | 'Gelb' | 'Rot'>('ALLE');
  const [newPlayer, setNewPlayer] = React.useState({
    lastName: '',
    firstName: '',
    number: '',
    position: '',
    category: 'player' as any
  });

  const sortedPlayers = sortPlayers(players);

  // Helper to determine active Ampel status for a player
  const getPlayerAmpelStatus = (player: Player): 'Grün' | 'Gelb' | 'Rot' => {
    const record = individualTrainingData.find(r => r.playerId === player.id && r.date === selectedIndividualDate);
    if (record?.loadAmpel) return record.loadAmpel;
    if (player.loadAmpel) return player.loadAmpel;
    if (player.isInjured || player.status === 'Verletzt') return 'Rot';
    if (player.status === 'Reha' || player.status === 'Vorsicht' || record?.load === 'Pause') return 'Gelb';
    return 'Grün';
  };

  const ampelCounts = React.useMemo(() => {
    let green = 0;
    let yellow = 0;
    let red = 0;
    sortedPlayers.forEach(p => {
      const status = getPlayerAmpelStatus(p);
      if (status === 'Grün') green++;
      else if (status === 'Gelb') yellow++;
      else if (status === 'Rot') red++;
    });
    return { green, yellow, red, total: sortedPlayers.length };
  }, [sortedPlayers, individualTrainingData, selectedIndividualDate]);

  const filteredPlayers = sortedPlayers.filter(p => {
    const matchesSearch = p.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.number?.toString().includes(searchTerm);
    if (!matchesSearch) return false;

    if (ampelFilter !== 'ALLE') {
      const status = getPlayerAmpelStatus(p);
      return status === ampelFilter;
    }
    return true;
  });

  const handleQuickAddPlayer = () => {
    if (!newPlayer.lastName || !newPlayer.position) {
      alert('Bitte Nachname und Position eingeben.');
      return;
    }
    const playerToSave: any = {
      ...newPlayer,
      id: `p${Date.now()}`,
      name: `${newPlayer.firstName} ${newPlayer.lastName}`.trim(),
      number: parseInt(newPlayer.number) || 0,
      status: 'Aktiv'
    };
    if (onAddPlayerDirect) {
      onAddPlayerDirect(playerToSave);
      setNewPlayer({
        lastName: '',
        firstName: '',
        number: '',
        position: '',
        category: 'player' as any
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0E17] text-[#F8FAFC] p-2 sm:p-4 rounded-2xl border border-[#334155] shadow-2xl overflow-hidden min-h-screen">
      <div className="p-3 border-b border-[#334155] bg-[#121824] text-[#F8FAFC] flex flex-wrap justify-between items-center gap-2 shrink-0 rounded-2xl shadow-xs mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-[#10B981]" />
            <h3 className="font-extrabold uppercase text-xs tracking-wider text-[#F8FAFC]">Performancetraining &amp; Individuelle Steuerung</h3>
          </div>
          <div className="flex items-center gap-2 border-l border-[#334155] pl-3">
            <Search size={12} className="text-[#94A3B8]" />
            <input 
              type="text" 
              placeholder="SPIELER SUCHEN..." 
              className="bg-[#1E293B] text-[#F8FAFC] text-[10px] font-bold uppercase focus:outline-none px-2.5 py-1 rounded-lg border border-[#334155] focus:border-[#10B981] w-40 placeholder:text-[#94A3B8]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Belastungs-Ampel Schnell-Filter & Statistik */}
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
          <span className="text-[#94A3B8] mr-1">Belastbarkeit:</span>
          <button
            onClick={() => setAmpelFilter('ALLE')}
            className={`px-2.5 py-1 rounded-md border transition-all ${ampelFilter === 'ALLE' ? 'bg-[#FFD54F] text-[#0F0F0F] font-black border-[#FFD54F] shadow-xs' : 'bg-[#202020] text-[#F5F5F5] border-[#2A2A2A] hover:bg-[#2A2A2A]'}`}
          >
            ALLE ({ampelCounts.total})
          </button>
          <button
            onClick={() => setAmpelFilter('Grün')}
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-all ${ampelFilter === 'Grün' ? 'bg-[#202020] text-[#F5F5F5] border-2 border-[#00D47A] font-black shadow-[0_0_8px_rgba(0,212,122,0.6)]' : 'bg-[#202020] text-[#C7C7C7] border-[#2A2A2A] hover:bg-[#2A2A2A]'}`}
          >
            <span className="w-2 h-2 rounded-full bg-[#00D47A]"></span>
            🟢 VOLL ({ampelCounts.green})
          </button>
          <button
            onClick={() => setAmpelFilter('Gelb')}
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-all ${ampelFilter === 'Gelb' ? 'bg-[#202020] text-[#F5F5F5] border-2 border-[#FACC15] font-black' : 'bg-[#202020] text-[#C7C7C7] border-[#2A2A2A] hover:bg-[#2A2A2A]'}`}
          >
            <span className="w-2 h-2 rounded-full bg-[#FACC15]"></span>
            🟡 TEIL ({ampelCounts.yellow})
          </button>
          <button
            onClick={() => setAmpelFilter('Rot')}
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-all ${ampelFilter === 'Rot' ? 'bg-[#202020] text-[#F5F5F5] border-2 border-[#FF4C4C] font-black' : 'bg-[#202020] text-[#C7C7C7] border-[#2A2A2A] hover:bg-[#2A2A2A]'}`}
          >
            <span className="w-2 h-2 rounded-full bg-[#FF4C4C]"></span>
            🔴 AUSFALL ({ampelCounts.red})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && onAddPlayer && (
            <button 
              onClick={onAddPlayer}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#FFD54F] hover:bg-[#ffe082] text-[#0F0F0F] rounded-md text-[10px] font-black uppercase tracking-wider transition-all shadow-xs border border-[#FFD54F]"
            >
              <Plus size={12} />
              Spieler hinzufügen
            </button>
          )}
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-[#FFD54F]" />
            <input 
              type="date"
              className="bg-[#202020] text-[#F5F5F5] text-[10px] font-bold uppercase focus:outline-none px-2 py-1 rounded-md border border-[#2A2A2A] focus:border-[#FFD54F]"
              value={selectedIndividualDate}
              onChange={(e) => setSelectedIndividualDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-xl">
        <table className="w-full border-collapse text-[10px] font-bold">
          <thead className="sticky top-0 bg-[#202020] text-[#FFD54F] z-20 border-b border-[#2A2A2A]">
            <tr>
              <th className="p-2.5 border-r border-[#2A2A2A] text-center w-10 text-[#C7C7C7]">Nr</th>
              <th className="p-2.5 border-r border-[#2A2A2A] text-left w-56 text-[#F5F5F5]">Spieler</th>
              <th className="p-2.5 border-r border-[#2A2A2A] text-center w-14 text-[#FFD54F]">Pos</th>
              <th className="p-2.5 border-r border-[#2A2A2A] text-center w-36 text-[#FFD54F]">Belastungs-Ampel</th>
              <th className="p-2.5 border-r border-[#2A2A2A] text-left w-28 text-[#C7C7C7]">Datum</th>
              <th className="p-2.5 border-r border-[#2A2A2A] text-left text-[#F5F5F5]">Individueller Schwerpunkt</th>
              <th className="p-2.5 border-r border-[#2A2A2A] text-left text-[#C7C7C7]">Saisonziele</th>
              <th className="p-2.5 border-r border-[#2A2A2A] text-left text-[#C7C7C7]">Status / Fortschritt</th>
              <th className="p-2.5 border-r border-[#2A2A2A] text-center w-24 text-[#FFD54F]">Intensität</th>
              <th className="p-2 border-r border-[#2A2A2A] text-center w-8 text-[#C7C7C7]">EK</th>
              <th className="p-2 border-r border-[#2A2A2A] text-center w-8 text-[#C7C7C7]">O</th>
              <th className="p-2 border-r border-[#2A2A2A] text-center w-8 text-[#C7C7C7]">T</th>
              <th className="p-2 border-r border-[#2A2A2A] text-center w-8 text-[#C7C7C7]">P</th>
              <th className="p-2 border-r border-[#2A2A2A] text-center w-8 text-[#C7C7C7]">S</th>
              <th className="p-2 border-r border-[#2A2A2A] text-center w-8 text-[#C7C7C7]">A</th>
              <th className="p-2 border-r border-[#2A2A2A] text-center w-8 text-[#C7C7C7]">W</th>
              {isEditing && <th className="p-2.5 border-r border-[#2A2A2A] text-center w-10 text-rose-500">Aktion</th>}
            </tr>
          </thead>
          <tbody>
            {/* Quick Add Player Row */}
            {isEditing && (
              <tr className="bg-[#202020]/80 border-b border-[#2A2A2A]">
                <td className="p-2 border-r border-[#2A2A2A]">
                  <input 
                    type="number"
                    className="w-full bg-[#1A1A1A] text-[#F5F5F5] border border-[#2A2A2A] rounded p-1 font-bold text-center focus:outline-none focus:border-[#FFD54F]"
                    placeholder="NR"
                    value={newPlayer.number}
                    onChange={(e) => setNewPlayer({ ...newPlayer, number: e.target.value })}
                  />
                </td>
                <td className="p-2 border-r border-[#2A2A2A]">
                  <div className="flex gap-1">
                    <input 
                      type="text"
                      className="bg-[#1A1A1A] text-[#F5F5F5] border border-[#2A2A2A] rounded p-1 font-bold uppercase focus:outline-none w-1/2 px-1 focus:border-[#FFD54F]"
                      placeholder="VORNAME"
                      value={newPlayer.firstName}
                      onChange={(e) => setNewPlayer({ ...newPlayer, firstName: e.target.value })}
                    />
                    <input 
                      type="text"
                      className="bg-[#1A1A1A] text-[#F5F5F5] border border-[#2A2A2A] rounded p-1 font-bold uppercase focus:outline-none w-1/2 px-1 focus:border-[#FFD54F]"
                      placeholder="NACHNAME"
                      value={newPlayer.lastName}
                      onChange={(e) => setNewPlayer({ ...newPlayer, lastName: e.target.value })}
                    />
                  </div>
                </td>
                <td className="p-2 border-r border-[#2A2A2A] text-center">
                  <input 
                    type="text"
                    className="w-full bg-[#1A1A1A] text-[#FFD54F] border border-[#2A2A2A] rounded p-1 font-bold text-center focus:outline-none focus:border-[#FFD54F] uppercase"
                    placeholder="POS"
                    value={newPlayer.position}
                    onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                  />
                </td>
                <td colSpan={12} className="p-2 border-r border-[#2A2A2A]">
                  <div className="flex items-center justify-between">
                    <select 
                      className="bg-[#1A1A1A] text-[#F5F5F5] border border-[#2A2A2A] rounded font-bold uppercase focus:outline-none text-[9px] px-2 py-1"
                      value={newPlayer.category}
                      onChange={(e) => setNewPlayer({ ...newPlayer, category: e.target.value as any })}
                    >
                      <option value="player">Spieler</option>
                      <option value="staff">Trainerteam</option>
                      <option value="official">Funktionär</option>
                    </select>
                    <button 
                      onClick={handleQuickAddPlayer}
                      className="bg-[#FFD54F] text-[#0F0F0F] px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest hover:bg-[#ffe082] transition-all border border-[#FFD54F]"
                    >
                      Direkt Hinzufügen
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {['player', 'staff', 'official'].map(category => {
              const categoryPlayers = filteredPlayers.filter(p => (p.category || 'player') === category);
              if (categoryPlayers.length === 0) return null;

              return (
                <React.Fragment key={category}>
                  <tr className="bg-[#202020] text-[#FFD54F]">
                    <td colSpan={isEditing ? 17 : 16} className="p-2.5 font-black uppercase text-[10px] tracking-widest border-y border-[#2A2A2A] bg-[#202020] text-[#FFD54F] border-l-4 border-l-[#FFD54F]">
                      {category === 'player' ? '⚽ Spielerkader' : category === 'staff' ? '📋 Trainerteam' : '🛡️ Funktionäre'}
                    </td>
                  </tr>
                  {categoryPlayers.map((player, pIdx) => {
                    const record = individualTrainingData.find(r => r.playerId === player.id && r.date === selectedIndividualDate) || {
                      focus: '',
                      goals: '',
                      status: '',
                      load: 'Normal',
                      loadAmpel: undefined,
                      targetDate: '',
                      ek: '',
                      o: '',
                      t: '',
                      p: '',
                      s: '',
                      a: '',
                      w: ''
                    };

                    const currentAmpel = getPlayerAmpelStatus(player);

                    const handleAmpelChange = (newAmpel: 'Grün' | 'Gelb' | 'Rot') => {
                      handleUpdateIndividualTraining(player.id, 'loadAmpel', newAmpel);
                      onUpdatePlayer(player.id, 'loadAmpel', newAmpel);
                    };

                    return (
                      <tr key={player.id} className="hover:bg-[#202020] transition-colors border-b border-[#2A2A2A] bg-[#1A1A1A] text-[#F5F5F5]">
                        <td className="p-2.5 border-r border-[#2A2A2A] text-center text-[#888888] font-mono font-bold">{pIdx + 1}</td>
                        <td className="p-2.5 border-r border-[#2A2A2A]">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 flex items-center justify-center bg-[#202020] text-[#F5F5F5] border border-[#2A2A2A] text-[9px] font-bold shrink-0 rounded shadow-xs">
                              {player.category === 'player' ? `#${player.number}` : (player.category === 'staff' ? 'T' : 'F')}
                            </span>
                            <div className="flex gap-1 flex-1">
                              <input 
                                type="text"
                                className={`bg-transparent focus:outline-none w-full text-[#F5F5F5] font-bold uppercase text-[11px] ${!isEditing ? 'cursor-not-allowed' : 'focus:bg-[#202020] focus:px-1 rounded border border-[#2A2A2A]'}`}
                                value={player.lastName || ''}
                                onChange={(e) => onUpdatePlayer(player.id, 'lastName', e.target.value)}
                                disabled={!isEditing}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-2.5 border-r border-[#2A2A2A] text-center text-[#FFD54F] font-black text-[10px]">{player.position}</td>
                        
                        {/* Belastungs-Ampel (Grün / Gelb / Rot) */}
                        <td className="p-2 border-r border-[#2A2A2A] text-center bg-[#181818]">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleAmpelChange('Grün')}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ${currentAmpel === 'Grün' ? 'bg-[#202020] text-[#F5F5F5] border-2 border-[#00D47A] shadow-[0_0_8px_rgba(0,212,122,0.8)] scale-110' : 'bg-[#202020] text-[#888888] border-[#2A2A2A] opacity-50 hover:opacity-100'}`}
                              title="🟢 GRÜN: 100% Voll belastbar & einsatzbereit"
                            >
                              🟢
                            </button>
                            <button
                              onClick={() => handleAmpelChange('Gelb')}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ${currentAmpel === 'Gelb' ? 'bg-[#202020] text-[#F5F5F5] border-2 border-[#FACC15] scale-110' : 'bg-[#202020] text-[#888888] border-[#2A2A2A] opacity-50 hover:opacity-100'}`}
                              title="🟡 GELB: Teilbelastung (z.B. max. 45 Min / Reduzierte Intensität)"
                            >
                              🟡
                            </button>
                            <button
                              onClick={() => handleAmpelChange('Rot')}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ${currentAmpel === 'Rot' ? 'bg-[#202020] text-[#F5F5F5] border-2 border-[#FF4C4C] scale-110' : 'bg-[#202020] text-[#888888] border-[#2A2A2A] opacity-50 hover:opacity-100'}`}
                              title="🔴 ROT: Keine Belastung (Verletzt / Schonung / Reha)"
                            >
                              🔴
                            </button>
                          </div>
                          <div className="text-[8px] font-black uppercase mt-1">
                            {currentAmpel === 'Grün' && <span className="text-[#00D47A]">Voll (100%)</span>}
                            {currentAmpel === 'Gelb' && <span className="text-[#FACC15]">Teil (Max 45m)</span>}
                            {currentAmpel === 'Rot' && <span className="text-[#FF4C4C]">Ausfall / Pause</span>}
                          </div>
                        </td>

                        <td className="p-2 border-r border-[#2A2A2A]">
                          <input 
                            type="date"
                            className={`w-full bg-[#202020] text-[#F5F5F5] border border-[#2A2A2A] px-1.5 py-0.5 rounded text-[10px] font-bold focus:outline-none focus:border-[#FFD54F] ${!isEditing ? 'opacity-80 cursor-not-allowed' : ''}`}
                            value={record.targetDate || ''}
                            onChange={(e) => handleUpdateIndividualTraining(player.id, 'targetDate', e.target.value)}
                            disabled={!isEditing}
                          />
                        </td>
                        <td className="p-2 border-r border-[#2A2A2A]">
                          <input 
                            type="text"
                            className={`w-full bg-[#202020] text-[#F5F5F5] border border-[#2A2A2A] px-2 py-0.5 rounded text-[10px] font-bold uppercase focus:outline-none focus:border-[#FFD54F] placeholder:text-[#888888] ${!isEditing ? 'opacity-80 cursor-not-allowed' : ''}`}
                            placeholder={isEditing ? "Z.B. ABSCHLUSS..." : ""}
                            value={record.focus || ''}
                            onChange={(e) => handleUpdateIndividualTraining(player.id, 'focus', e.target.value)}
                            disabled={!isEditing}
                          />
                        </td>
                        <td className="p-2 border-r border-[#2A2A2A]">
                          <input 
                            type="text"
                            className={`w-full bg-[#202020] text-[#C7C7C7] border border-[#2A2A2A] px-2 py-0.5 rounded text-[10px] italic font-semibold focus:outline-none focus:border-[#FFD54F] placeholder:text-[#888888] ${!isEditing ? 'opacity-80 cursor-not-allowed' : ''}`}
                            placeholder={isEditing ? "Ziele definieren..." : ""}
                            value={record.goals || ''}
                            onChange={(e) => handleUpdateIndividualTraining(player.id, 'goals', e.target.value)}
                            disabled={!isEditing}
                          />
                        </td>
                        <td className="p-2 border-r border-[#2A2A2A]">
                          <input 
                            type="text"
                            className={`w-full bg-[#202020] text-[#F5F5F5] border border-[#2A2A2A] px-2 py-0.5 rounded text-[10px] font-bold focus:outline-none focus:border-[#FFD54F] placeholder:text-[#888888] ${!isEditing ? 'opacity-80 cursor-not-allowed' : ''}`}
                            placeholder={isEditing ? "Fortschritt..." : ""}
                            value={record.status || ''}
                            onChange={(e) => handleUpdateIndividualTraining(player.id, 'status', e.target.value)}
                            disabled={!isEditing}
                          />
                        </td>
                        <td className="p-2 text-center border-r border-[#2A2A2A]">
                          <select 
                            className={`text-[8px] font-black uppercase p-1 border rounded focus:outline-none bg-[#202020] text-[#F5F5F5] border-[#2A2A2A]
                              ${record.load === 'Hoch' ? 'text-[#FF4C4C] border-[#FF4C4C]/40' : 
                                record.load === 'Niedrig' ? 'text-[#00D47A] border-[#00D47A]/40' : 
                                record.load === 'Pause' ? 'text-[#FACC15] border-[#FACC15]/40' :
                                'text-[#FFD54F] border-[#2A2A2A]'}`}
                            value={record.load || 'Normal'}
                            onChange={(e) => handleUpdateIndividualTraining(player.id, 'load', e.target.value)}
                            disabled={!isEditing}
                          >
                            <option value="Niedrig" className="bg-[#202020] text-[#F5F5F5]">Niedrig</option>
                            <option value="Normal" className="bg-[#202020] text-[#F5F5F5]">Normal</option>
                            <option value="Hoch" className="bg-[#202020] text-[#F5F5F5]">Hoch</option>
                            <option value="Pause" className="bg-[#202020] text-[#F5F5F5]">Pause</option>
                          </select>
                        </td>
                        {['ek', 'o', 't', 'p', 's', 'a', 'w'].map(field => (
                          <td key={field} className="p-1 border-r border-[#2A2A2A]">
                            <input 
                              type="text"
                              className={`w-full h-full p-1 text-center bg-[#202020] text-[#F5F5F5] border border-[#2A2A2A] rounded text-[10px] font-bold focus:border-[#FFD54F] focus:outline-none ${!isEditing ? 'opacity-80 cursor-not-allowed' : ''}`}
                              value={record[field] || ''}
                              onChange={(e) => handleUpdateIndividualTraining(player.id, field, e.target.value)}
                              placeholder={isEditing ? "-" : ""}
                              disabled={!isEditing}
                            />
                          </td>
                        ))}
                        {isEditing && (
                          <td className="p-2 border-r border-[#2A2A2A] text-center">
                            <button 
                              onClick={() => {
                                onDeletePlayer(player.id);
                              }}
                              className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-950/50 rounded transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-[#1A1A1A] text-[#F5F5F5] border-t border-[#2A2A2A] flex justify-between items-center shrink-0 rounded-b-xl mt-3 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-[#FFD54F]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C7C7C7]">Individuelle Förderung ist der Schlüssel zum Erfolg.</span>
          </div>
        </div>
        <p className="text-[9px] font-bold uppercase text-[#FFD54F] italic">
          Steuerung der individuellen Belastung und Entwicklungsschwerpunkte.
        </p>
      </div>
    </div>
  );
};
