import React from 'react';
import { Player, Spieler } from '../../types';
import { Download, Phone, Mail, MapPin, Calendar, Activity, Edit2, Plus } from 'lucide-react';

interface TeamListViewProps {
  players: Spieler[];
  onEditPlayer?: (player: Spieler) => void;
  onAddPlayer?: () => void;
  isEditing: boolean;
}

export const TeamListView: React.FC<TeamListViewProps> = ({ players, onEditPlayer, onAddPlayer, isEditing }) => {
  const getCategoryBadge = (p: Spieler) => {
    const category = p.category || 'player';
    const ampel = p.loadAmpel || (p.isInjured || p.status === 'Verletzt' ? 'Rot' : p.status === 'Reha' ? 'Gelb' : 'Grün');

    const ampelBadge = ampel === 'Rot' ? (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30 flex items-center gap-1" title="🔴 Keine Belastung / Ausfall">
        <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse"></span> 🔴 Ausfall
      </span>
    ) : ampel === 'Gelb' ? (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 flex items-center gap-1" title="🟡 Teilbelastung (Vorsicht)">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse"></span> 🟡 Teil
      </span>
    ) : (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 flex items-center gap-1" title="🟢 Voll Belastbar (100%)">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span> 🟢 Voll
      </span>
    );

    switch (category) {
      case 'coach': 
        return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30">Trainer</span>;
      case 'staff': 
        return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/30">Funktionär</span>;
      case 'medical': 
        return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#FB7185]/10 text-[#FB7185] border border-[#FB7185]/30">Physio / Arzt</span>;
      default: 
        return (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#1E293B] text-[#F8FAFC] border border-[#334155]">Spieler</span>
            {ampelBadge}
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0A0E17] text-[#F8FAFC] rounded-2xl border border-[#334155] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#334155] flex justify-between items-center bg-[#121824]">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[#F8FAFC] flex items-center gap-2">
            Team-Datenbank
          </h2>
          <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
            <Activity size={13} className="text-[#10B981]" />
            Zentrales Register • {players.length} Mitglieder
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && onAddPlayer && (
            <button
              onClick={onAddPlayer}
              className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-[#0A0E17] rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#059669] transition-all shadow-xs border border-[#10B981]"
            >
              <Plus size={15} />
              Hinzufügen
            </button>
          )}
        </div>
      </div>
      
      {/* Data Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full border-collapse text-left text-[#F8FAFC]">
          <thead className="sticky top-0 z-10 bg-[#121824] border-b border-[#334155]">
            <tr>
              <th className="px-5 py-3.5 text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Name / Geburtsdatum</th>
              <th className="px-5 py-3.5 text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Kontakt & Adresse</th>
              <th className="px-5 py-3.5 text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Ausrüstung</th>
              <th className="px-5 py-3.5 text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Position / Rolle</th>
              <th className="px-5 py-3.5 text-[10px] font-black text-[#94A3B8] uppercase tracking-wider text-right">Einsatzzeit</th>
              <th className="px-5 py-3.5 text-[10px] font-black text-[#94A3B8] uppercase tracking-wider text-right">Leistung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155] bg-[#0A0E17]">
            {players.map((p) => (
              <tr key={p.id} className="hover:bg-[#1E293B] transition-colors group">
                <td className="px-5 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    {isEditing && onEditPlayer && (
                      <button 
                        onClick={() => onEditPlayer(p)}
                        className="p-1.5 text-[#94A3B8] hover:text-[#10B981] hover:bg-[#121824] rounded-lg transition-all border border-transparent hover:border-[#334155]"
                        title="Bearbeiten"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {getCategoryBadge(p)}
                  </div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <div className="text-sm font-bold text-[#F8FAFC] group-hover:text-[#10B981] transition-colors">
                    {p.name || (p.firstName ? `${p.lastName}, ${p.firstName}` : p.lastName)}
                  </div>
                  <div className="text-[11px] text-[#94A3B8] font-medium flex items-center gap-1 mt-0.5 font-mono">
                    <Calendar size={11} className="text-[#10B981]" /> {p.geburtsdatum || '-'}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#F8FAFC] font-mono">
                      <Phone size={12} className="text-[#94A3B8]" /> {p.telefon || '-'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                      <Mail size={12} className="text-[#94A3B8]" /> {p.email || '-'}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] italic truncate max-w-[180px]">
                      <MapPin size={11} className="text-[#94A3B8]" /> {p.adresse || '-'}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {p.category === 'player' ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-bold text-[#F8FAFC] font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#94A3B8] w-3">O:</span>
                        <span className="text-[#F8FAFC]">{p.oberteil || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#94A3B8] w-3">K:</span>
                        <span className="text-[#F8FAFC]">{p.kurze_hose || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#94A3B8] w-3">L:</span>
                        <span className="text-[#F8FAFC]">{p.lange_hose || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#94A3B8] w-3">S:</span>
                        <span className="text-[#F8FAFC]">{p.schuhe || '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-[#94A3B8] italic">N/A</span>
                  )}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <div className="text-xs font-bold text-[#F8FAFC]">
                    {p.position || (p.category === 'coach' ? 'Trainer' : (p.category === 'staff' || p.category === 'medical') ? 'Funktionär' : '-')}
                  </div>
                  {p.number && (
                    <div className="text-[11px] font-black text-[#10B981] mt-0.5 font-mono">
                      Trikot #{p.number}
                    </div>
                  )}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-right">
                  {p.category === 'player' ? (
                    <div className="inline-flex flex-col items-end gap-1 bg-[#121824] p-2 rounded-xl border border-[#334155] font-mono">
                      <div className="text-[11px] font-bold text-[#F8FAFC]">
                        Pflicht: <span className="text-[#10B981] font-black">{p.einsatzzeitenGesamt || 0} MIN</span>
                      </div>
                      <div className="text-[11px] font-bold text-[#F8FAFC]">
                        Test: <span className="text-[#F59E0B] font-black">{p.testEinsatzzeitenGesamt || 0} MIN</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-[#94A3B8] italic">N/A</span>
                  )}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-right">
                  {p.category === 'player' ? (
                    <div className="inline-flex flex-col items-end gap-1 bg-[#121824] p-2 rounded-xl border border-[#334155] font-mono">
                      <div className="text-[11px] font-bold text-[#F8FAFC]">
                        Sprint: <span className="text-[#10B981] font-black">{p.diagnostics?.sprintwert || '-'}</span>
                      </div>
                      <div className="text-[11px] font-bold text-[#F8FAFC]">
                        Yoyo: <span className="text-[#F59E0B] font-black">{p.diagnostics?.yoyotest || '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-[#94A3B8] italic">N/A</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
