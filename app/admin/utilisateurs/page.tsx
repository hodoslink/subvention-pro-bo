"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Utilisateur = {
  id: string;
  nom_complet: string;
  role: "admin" | "consultant";
  created_at: string;
};

export default function UtilisateursPage() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // Formulaire invitation
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNom, setInviteNom] = useState("");
  const [inviteRole, setInviteRole] = useState<"consultant" | "admin">("consultant");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Édition inline du rôle
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "consultant">("consultant");
  const [editNom, setEditNom] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch("/api/admin/utilisateurs");
    if (r.status === 403) { setForbidden(true); setLoading(false); return; }
    const { utilisateurs: u } = await r.json();
    setUtilisateurs(u ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/admin/utilisateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, nom_complet: inviteNom }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteMsg({ ok: true, text: `Invitation envoyée à ${inviteEmail}.` });
        setInviteEmail("");
        setInviteNom("");
        setInviteRole("consultant");
        await load();
      } else {
        setInviteMsg({ ok: false, text: data.error ?? `Erreur ${res.status}` });
      }
    } catch {
      setInviteMsg({ ok: false, text: "Erreur réseau." });
    } finally {
      setInviting(false);
    }
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/utilisateurs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role: editRole, nom_complet: editNom }),
      });
      if (res.ok) {
        setEditingId(null);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>;
  if (forbidden) return <AppShell><div className="p-8 text-red-500">Accès réservé aux administrateurs.</div></AppShell>;

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-1">Invitez des consultants ou modifiez leurs droits.</p>
        </div>

        {/* Liste */}
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Utilisateurs ({utilisateurs.length})</h2>
          {utilisateurs.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun utilisateur.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {utilisateurs.map((u) => (
                <li key={u.id} className="py-3">
                  {editingId === u.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="field-input flex-1 min-w-[140px]"
                        value={editNom}
                        onChange={e => setEditNom(e.target.value)}
                        placeholder="Nom complet"
                      />
                      <select
                        className="field-input w-36"
                        value={editRole}
                        onChange={e => setEditRole(e.target.value as typeof editRole)}
                      >
                        <option value="consultant">Consultant</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        className="btn btn-primary text-xs"
                        disabled={saving}
                        onClick={() => handleSaveEdit(u.id)}
                      >
                        {saving ? "…" : "Enregistrer"}
                      </button>
                      <button
                        className="btn btn-ghost text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center shrink-0">
                          {(u.nom_complet || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{u.nom_complet || <span className="text-gray-400 italic">Sans nom</span>}</p>
                          <p className="text-xs text-gray-400">
                            Créé le {new Date(u.created_at).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={[
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600",
                        ].join(" ")}>
                          {u.role === "admin" ? "Admin" : "Consultant"}
                        </span>
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800"
                          onClick={() => {
                            setEditingId(u.id);
                            setEditRole(u.role);
                            setEditNom(u.nom_complet);
                          }}
                        >
                          Modifier
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Formulaire invitation */}
        <section className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Inviter un nouvel utilisateur</h2>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="field-input"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="consultant@exemple.fr"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Nom complet</label>
                <input
                  className="field-input"
                  value={inviteNom}
                  onChange={e => setInviteNom(e.target.value)}
                  placeholder="Prénom Nom"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Rôle</label>
              <select
                className="field-input w-48"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as typeof inviteRole)}
              >
                <option value="consultant">Consultant</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {inviteMsg && (
              <p className={["text-sm", inviteMsg.ok ? "text-green-700" : "text-red-600"].join(" ")}>
                {inviteMsg.text}
              </p>
            )}
            <button type="submit" disabled={inviting} className="btn btn-primary text-sm">
              {inviting ? "Envoi…" : "Envoyer l'invitation"}
            </button>
          </form>
          <p className="text-xs text-gray-400">
            L&apos;utilisateur recevra un email avec un lien pour définir son mot de passe et accéder au backoffice.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
