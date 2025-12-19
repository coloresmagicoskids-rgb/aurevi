// src/screens/Profile.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ProfileSettingsDrawer from "../components/ProfileSettingsDrawer.jsx";

function Profile() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarStatus, setAvatarStatus] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);

  // Siguiendo / Seguidores
  const [followStats, setFollowStats] = useState({
    following: 0,
    followers: 0,
  });

  // Perfil creativo–emocional
  const [dailyMood, setDailyMood] = useState("");
  const [creativeTrend, setCreativeTrend] = useState("");
  const [wellbeingScore, setWellbeingScore] = useState("");
  const [savingEmo, setSavingEmo] = useState(false);

  // Drawer Ajustes
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ─────────────────────────────────────
  // Cargar usuario + perfil + stats
  // ─────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingUser(true);
      setStatus("");
      setErrorMsg("");

      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error("Error obteniendo usuario:", error);
        setUser(null);
        setLoadingUser(false);
        return;
      }

      if (!data?.user) {
        setUser(null);
        setLoadingUser(false);
        return;
      }

      const currentUser = data.user;
      setUser(currentUser);

      await Promise.all([
        fetchProfileMeta(currentUser.id),
        fetchFollowStats(currentUser.id),
      ]);

      setLoadingUser(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar avatar + campos emocionales
  const fetchProfileMeta = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url, daily_mood, creative_trend, wellbeing_score")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error cargando perfil:", error);
        return;
      }

      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      if (data?.daily_mood) setDailyMood(data.daily_mood);
      if (data?.creative_trend) setCreativeTrend(data.creative_trend);
      if (data?.wellbeing_score != null)
        setWellbeingScore(String(data.wellbeing_score));
    } catch (err) {
      console.error("Error inesperado cargando perfil:", err);
    }
  };

  // Cargar stats Siguiendo / Seguidores
  const fetchFollowStats = async (userId) => {
    try {
      // A cuántos sigo
      const {
        count: followingCount,
        error: followingError,
      } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId);

      if (followingError) {
        console.error("Error contando following:", followingError);
      }

      // Cuántos me siguen
      const {
        count: followersCount,
        error: followersError,
      } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId);

      if (followersError) {
        console.error("Error contando followers:", followersError);
      }

      setFollowStats({
        following: followingCount || 0,
        followers: followersCount || 0,
      });
    } catch (err) {
      console.error("Error inesperado en followStats:", err);
    }
  };

  // Cambiar avatar
  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setAvatarStatus("");
    setErrorMsg("");
    setAvatarLoading(true);

    try {
      const filePath = `${user.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("aurevi-avatars")
        .upload(filePath, file);

      if (uploadError) {
        console.error(uploadError);
        setErrorMsg("No se pudo subir el avatar.");
        setAvatarLoading(false);
        return;
      }

      const { data } = supabase.storage
        .from("aurevi-avatars")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      const { error: dbError } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: publicUrl });

      if (dbError) {
        console.error("Error guardando avatar en profiles:", dbError);
        setErrorMsg("No se pudo guardar el avatar en la base de datos.");
        setAvatarLoading(false);
        return;
      }

      setAvatarUrl(publicUrl);
      setAvatarStatus("Avatar actualizado con éxito.");
    } catch (err) {
      console.error("Error inesperado al subir avatar:", err);
      setErrorMsg("Ocurrió un error inesperado al subir el avatar.");
    }

    setAvatarLoading(false);
  };

  // Guardar perfil creativo–emocional
  const handleSaveEmotionalProfile = async () => {
    if (!user) return;
    setSavingEmo(true);
    setStatus("");
    setErrorMsg("");

    try {
      const safeScore =
        wellbeingScore === "" ? null : Number.parseInt(wellbeingScore, 10);

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        daily_mood: dailyMood || null,
        creative_trend: creativeTrend || null,
        wellbeing_score: safeScore,
      });

      if (error) {
        console.error("Error guardando perfil emocional:", error);
        setErrorMsg("No se pudo guardar tu perfil creativo–emocional.");
      } else {
        setStatus("Perfil creativo–emocional actualizado.");
      }
    } catch (err) {
      console.error("Error inesperado guardando perfil emocional:", err);
      setErrorMsg("Ocurrió un error al guardar tu perfil emocional.");
    }

    setSavingEmo(false);
  };

  // LOGOUT
  const handleLogout = async () => {
    setStatus("");
    setErrorMsg("");

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error cerrando sesión:", error);
        setErrorMsg("No se pudo cerrar sesión. Inténtalo de nuevo.");
      } else {
        setUser(null);
        setAvatarUrl(null);
        setFollowStats({ following: 0, followers: 0 });
        setDailyMood("");
        setCreativeTrend("");
        setWellbeingScore("");
        setStatus("Sesión cerrada correctamente.");
      }
    } catch (err) {
      console.error("Error inesperado al cerrar sesión:", err);
      setErrorMsg("Ocurrió un error inesperado al cerrar sesión.");
    }
  };

  // ─────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────
  if (loadingUser) {
    return (
      <section className="aurevi-screen profile-screen">
        <div className="profile-shell">
          <div className="profile-side-copy">
            <p className="profile-kicker">PERFIL AUREVI</p>
            <h2 className="profile-hero-title">Cargando tu universo…</h2>
            <p className="profile-hero-subtitle">
              Estamos preparando tus datos de perfil, stats y estados creativos.
            </p>
          </div>
          <div className="profile-card skeleton">
            <div className="skeleton-pill" />
            <div className="profile-title-row">
              <div className="skeleton-line wide" />
              <div className="skeleton-line" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="aurevi-screen profile-screen">
        <div className="profile-shell">
          <div className="profile-side-copy">
            <p className="profile-kicker">PERFIL AUREVI</p>
            <h2 className="profile-hero-title">Conéctate a tu galaxia.</h2>
            <p className="profile-hero-subtitle">
              Inicia sesión en AUREVI para ver tu perfil, tus estadísticas y tu
              mapa creativo–emocional.
            </p>
          </div>
          <div className="profile-card">
            <div className="profile-card-header">
              <h3 className="profile-card-title">Sin sesión activa</h3>
              <p className="profile-card-subtitle">
                Entra con tu cuenta desde la pantalla de acceso para empezar a
                construir tu universo creativo.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="aurevi-screen profile-screen">
        <div className="profile-shell">
          {/* Lado de texto/branding */}
          <div className="profile-side-copy">
            <p className="profile-kicker">PERFIL AUREVI</p>
            <h2 className="profile-hero-title">Tu espacio creativo, seguro.</h2>
            <p className="profile-hero-subtitle">
              Aquí ves quién eres dentro de AUREVI: tu avatar, tus conexiones y
              el ritmo emocional de tu día creativo.
            </p>
          </div>

          {/* Tarjeta principal */}
          <div className="profile-card">
            <div className="profile-card-header">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <h3 className="profile-card-title">Tu perfil en AUREVI</h3>
                  <p className="profile-card-subtitle">
                    Personaliza tu presencia, revisa tus stats sociales y ajusta
                    tu perfil creativo–emocional.
                  </p>
                </div>

                {/* ✅ Botón Ajustes (abre drawer) */}
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(15,23,42,0.6)",
                    color: "#e5e7eb",
                    borderRadius: 999,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    height: "fit-content",
                  }}
                >
                  ⚙️ Ajustes
                </button>
              </div>
            </div>

            {/* Usuario + avatar + stats */}
            <div className="profile-user-info">
              <div className="profile-avatar-circle">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="profile-avatar-img"
                  />
                ) : (
                  <span>{user.email?.[0]?.toUpperCase() || "A"}</span>
                )}
              </div>
              <div>
                <div className="profile-user-label">Sesión iniciada como</div>
                <div className="profile-user-email">{user.email}</div>

                <div className="profile-stats-row">
                  <span className="profile-stat-pill">
                    <strong>{followStats.following}</strong> Siguiendo
                  </span>
                  <span className="profile-stat-pill">
                    <strong>{followStats.followers}</strong> Seguidores
                  </span>
                </div>
              </div>
            </div>

            {/* Cambiar avatar */}
            <div className="profile-label" style={{ marginTop: 16 }}>
              <span className="profile-label-title">Cambiar avatar</span>
              <input
                className="profile-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={avatarLoading}
              />
              {avatarStatus && (
                <p className="profile-status profile-status-ok">{avatarStatus}</p>
              )}
            </div>

            {/* Bloque: Perfil creativo–emocional */}
            <div
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px solid rgba(148,163,184,0.5)",
              }}
            >
              <h4
                style={{
                  margin: "0 0 8px",
                  fontSize: "0.95rem",
                  color: "#111827",
                }}
              >
                Perfil creativo–emocional
              </h4>

              <label className="profile-label">
                Ritmo emocional de hoy
                <select
                  className="profile-input"
                  value={dailyMood}
                  onChange={(e) => setDailyMood(e.target.value)}
                >
                  <option value="">Selecciona un estado...</option>
                  <option value="energetico">Energético</option>
                  <option value="suave">Suave</option>
                  <option value="introspectivo">Introspectivo</option>
                  <option value="infantil">Infantil / juguetón</option>
                  <option value="terapeutico">Terapéutico / calmante</option>
                </select>
              </label>

              <label className="profile-label">
                Tendencia creativa del momento
                <select
                  className="profile-input"
                  value={creativeTrend}
                  onChange={(e) => setCreativeTrend(e.target.value)}
                >
                  <option value="">¿Qué tipo de creador te sientes?</option>
                  <option value="explorador">Explorador de ideas</option>
                  <option value="constructor">Constructor/a de conocimientos</option>
                  <option value="narrador">Narrador/a de historias</option>
                  <option value="musico">Músico / sonoro</option>
                  <option value="mentor">Mentor / guía</option>
                  <option value="multicreativo">Multicreativo cambiante</option>
                </select>
              </label>

              <label className="profile-label">
                Tu nivel de bienestar hoy (1–5)
                <select
                  className="profile-input"
                  value={wellbeingScore}
                  onChange={(e) => setWellbeingScore(e.target.value)}
                >
                  <option value="">Selecciona un número...</option>
                  <option value="1">1 – Día pesado</option>
                  <option value="2">2 – Cansado/a</option>
                  <option value="3">3 – Neutral</option>
                  <option value="4">4 – Bien</option>
                  <option value="5">5 – Muy bien</option>
                </select>
              </label>

              <button
                type="button"
                className="aurevi-primary-btn profile-main-button"
                onClick={handleSaveEmotionalProfile}
                disabled={savingEmo}
              >
                {savingEmo ? "Guardando..." : "Guardar perfil creativo–emocional"}
              </button>
            </div>

            {status && <p className="profile-status profile-status-ok">{status}</p>}
            {errorMsg && (
              <p className="profile-status profile-status-error">{errorMsg}</p>
            )}

            <button
              type="button"
              className="aurevi-primary-btn profile-logout-btn profile-main-button"
              onClick={handleLogout}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </section>

      {/* ✅ Drawer global (fuera del layout visual) */}
      <ProfileSettingsDrawer
  open={settingsOpen}
  onClose={() => setSettingsOpen(false)}
  user={user}   // ✅ NUEVO
  onNavigate={(key) => {
    console.log("Ir a:", key);
  }}
/>
    </>
  );
}

export default Profile;