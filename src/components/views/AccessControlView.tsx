import React, { useState } from 'react';
import { useCollectionSync } from '../../hooks/useCollectionSync';
import { Shield, UserCheck, UserX, Clock, Mail, Trash2 } from 'lucide-react';
import { db, cleanFirestoreData } from '../../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { isQuotaExceededActive, isQuotaError, markQuotaExceeded } from '../../lib/offlineStorage';

interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'viewer';
  status: 'approved' | 'pending' | 'rejected';
  updatedAt: string;
}

interface AccessRequest {
  id: string;
  email: string;
  name: string;
  message?: string;
  timestamp: string;
  status: 'pending' | 'processed';
}

export const AccessControlView: React.FC<{ 
  ownerEmail: string;
  securityLockActive?: boolean;
  onToggleSecurityLock?: (active: boolean) => void;
}> = ({ ownerEmail, securityLockActive = false, onToggleSecurityLock }) => {
  const { data: users, loading: loadingUsers } = useCollectionSync<AppUser>('app_users', 'uid');
  const { data: requests, loading: loadingRequests } = useCollectionSync<AccessRequest>('access_requests', 'id');

  const handleApprove = async (request: AccessRequest) => {
    if (isQuotaExceededActive() || !navigator.onLine) {
      console.warn("Operation skipped due to quota limit or offline status.");
      return;
    }
    try {
      // Benutzer erstellen
      await setDoc(doc(db, 'app_users', request.id), cleanFirestoreData({
        uid: request.id,
        email: request.email,
        name: request.name,
        role: 'viewer',
        status: 'approved',
        updatedAt: new Date().toISOString()
      }));
      // Anfrage löschen
      await deleteDoc(doc(db, 'access_requests', request.id));
    } catch (err) {
      if (isQuotaError(err)) {
        markQuotaExceeded();
      }
      console.error("Freigabe fehlgeschlagen:", err);
    }
  };

  const handleReject = async (request: AccessRequest) => {
    if (isQuotaExceededActive() || !navigator.onLine) {
      console.warn("Operation skipped due to quota limit or offline status.");
      return;
    }
    try {
      // Als abgelehnt markieren
      await setDoc(doc(db, 'app_users', request.id), cleanFirestoreData({
        uid: request.id,
        email: request.email,
        name: request.name,
        role: 'viewer',
        status: 'rejected',
        updatedAt: new Date().toISOString()
      }));
      // Anfrage löschen
      await deleteDoc(doc(db, 'access_requests', request.id));
    } catch (err) {
      if (isQuotaError(err)) {
        markQuotaExceeded();
      }
      console.error("Ablehnung fehlgeschlagen:", err);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (isQuotaExceededActive() || !navigator.onLine) {
      console.warn("Operation skipped due to quota limit or offline status.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'app_users', uid));
    } catch (err) {
      if (isQuotaError(err)) {
        markQuotaExceeded();
      }
      console.error("Löschen fehlgeschlagen:", err);
    }
  };

  if (loadingUsers || loadingRequests) {
    return (
      <div className="p-8 font-black uppercase text-center">
        Lädt Zugriffskontrolle...
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#1E293B] min-h-screen">
      <div className="mb-8 border-b-4 border-black pb-4 flex items-center gap-4">
        <Shield size={32} />
        <div>
          <h1 className="text-3xl font-black uppercase leading-none">Zugriffsverwaltung</h1>
          <p className="text-[10px] text-[#94A3B8] font-bold mt-1 uppercase tracking-widest">Verwalten Sie, wer Zugriff auf die App hat</p>
        </div>
      </div>

      {/* Covert Security Lock Switch */}
      <div className="mb-8 p-6 bg-red-50 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-xl font-black uppercase text-red-600 flex items-center gap-2 leading-none">
            <Shield className="animate-pulse" size={24} /> UNSICHTBARER APP-SCHUTZ (SECURITY SHIELD)
          </h2>
          <p className="text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wide mt-2 max-w-3xl leading-relaxed">
            Wenn dieser Schutz aktiv ist, können NUR Sie (als Besitzer) und im Hintergrund manuell freigegebene Personen die App nutzen. 
            Alle anderen (oder nicht angemeldeten) Nutzer sehen beim Öffnen der App stattdessen eine unauffällige Fehlermeldung: 
            <span className="text-[#C00000] font-black"> „MOMENTAN AUS TECHNISCHEN GRÜNDEN KEIN ZUGRIFF MÖGLICH“</span>. 
            So bleibt der Schutz für Fremde völlig unsichtbar und täuscht eine Wartung vor.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-mono text-xs font-black uppercase">
            STATUS: <span className={securityLockActive ? "text-green-600 bg-green-100 px-2 py-1 border border-green-600" : "text-[#94A3B8] bg-[#1E293B] px-2 py-1 border border-[#334155]"}>
              {securityLockActive ? 'AKTIV (GESPERRT)' : 'INAKTIV (OFFEN)'}
            </span>
          </span>
          <button
            onClick={() => onToggleSecurityLock?.(!securityLockActive)}
            className={`px-6 py-3 border-2 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
              securityLockActive 
                ? 'bg-[#C00000] text-white hover:bg-red-700' 
                : 'bg-[#1E293B] text-black hover:bg-[#1E293B]'
            }`}
          >
            {securityLockActive ? 'AUSSCHALTEN (APP ÖFFNEN)' : 'EINSCHALTEN (APP SPERREN)'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ausstehende Anfragen */}
        <section>
          <div className="bg-black text-white p-3 font-black uppercase tracking-widest text-xs flex items-center gap-2 mb-4">
            <Clock size={16} /> OFFENE ANFRAGEN ({requests.length})
          </div>
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-[#334155] text-center text-gray-400 font-black uppercase text-xs">
                Keine ausstehenden Anfragen
              </div>
            ) : (
              requests.map(req => (
                <div key={req.id} className="border-2 border-black p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div>
                    <div className="font-black uppercase text-sm">{req.name}</div>
                    <div className="text-[10px] text-[#94A3B8] flex items-center gap-1">
                      <Mail size={10} /> {req.email}
                    </div>
                    <div className="text-[9px] text-gray-400 mt-1 italic">
                      Am {new Date(req.timestamp).toLocaleString('de-DE')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApprove(req)}
                      className="bg-green-600 text-white px-3 py-2 text-[10px] font-black uppercase flex items-center gap-1 hover:bg-green-700 transition"
                    >
                      <UserCheck size={14} /> Freigeben
                    </button>
                    <button 
                      onClick={() => handleReject(req)}
                      className="bg-red-600 text-white px-3 py-2 text-[10px] font-black uppercase flex items-center gap-1 hover:bg-red-700 transition"
                    >
                      <UserX size={14} /> Ablehnen
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Autorisierte Nutzer */}
        <section>
          <div className="bg-black text-white p-3 font-black uppercase tracking-widest text-xs flex items-center gap-2 mb-4">
            <UserCheck size={16} /> AUTORISIERTE NUTZER ({users.length})
          </div>
          <div className="space-y-4">
            {users.map(user => (
              <div key={user.uid} className={`border-2 border-black p-4 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${user.status === 'rejected' ? 'bg-red-50 opacity-60' : ''}`}>
                <div>
                  <div className="font-black uppercase text-sm flex items-center gap-2">
                    {user.name}
                    {user.email === ownerEmail && (
                      <span className="bg-amber-400 text-black text-[8px] px-1 py-0.5 border border-black italic">OWNER</span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#94A3B8]">{user.email}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`text-[8px] font-black uppercase px-1 py-0.5 border border-black ${
                      user.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {user.status === 'approved' ? 'FREIGEGEBEN' : 'ABGELEHNT'}
                    </span>
                  </div>
                </div>
                {user.email !== ownerEmail && (
                  <button 
                    onClick={() => handleDeleteUser(user.uid)}
                    className="p-2 text-gray-400 hover:text-red-600 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
