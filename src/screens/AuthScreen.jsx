// src/screens/AuthScreen.jsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { upsertUserSession } from "../core/sessionTracker";

function AuthScreen() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    day: "",
    month: "",
    year: "",
    gender: "Mujer",
    email: "",
    password: "",
  });

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Helpers fecha
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    { value: "01", label: "Ene" },
    { value: "02", label: "Feb" },
    { value: "03", label: "Mar" },
    { value: "04", label: "Abr" },
    { value: "05", label: "May" },
    { value: "06", label: "Jun" },
    { value: "07", label: "Jul" },
    { value: "08", label: "Ago" },
    { value: "09", label: "Sep" },
    { value: "10", label: "Oct" },
    { value: "11", label: "Nov" },
    { value: "12", label: "Dic" },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  // =========================
  // REGISTRO
  // =========================
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    setErrorMsg("");

    try {
      const {
        firstName,
        lastName,
        day,
        month,
        year,
        gender,
        email,
        password,
      } = form;

      if (!email || !password) {
        setErrorMsg("Correo y contraseña son obligatorios.");
        setLoading(false);
        return;
      }

      const birthDate = day && month && year ? `${year}-${month}-${day}` : null;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            birthdate: birthDate,
            gender,
          },
        },
      });

      if (error) {
        console.error("Error registrando usuario:", error);
        setErrorMsg(error.message || "No se pudo crear la cuenta.");
        setLoading(false);
        return;
      }

      // 🔑 SOLO si hay userId (cuando confirm email está OFF)
      const userId = data?.user?.id;

      if (userId) {
        const { error: upErr } = await supabase
          .from("profiles")
          .update({
            full_name: `${firstName} ${lastName}`.trim(),
            display_name: (firstName || "").trim() || null,
            gender,
            birth_date: birthDate, // si la columna existe
            role: "viewer",        // si la columna existe
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (upErr) console.warn("No se pudo completar perfil:", upErr.message);
      }

      setStatus(
        "Cuenta creada. Revisa tu correo si es necesario confirmar el email."
      );
      setMode("login");
    } catch (err) {
      console.error("Error inesperado en registro:", err);
      setErrorMsg("Ocurrió un error inesperado al crear la cuenta.");
    }

    setLoading(false);
  };

  // =========================
  // LOGIN
  // =========================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    setErrorMsg("");

    try {
      const { email, password } = form;

      if (!email || !password) {
        setErrorMsg("Correo y contraseña son obligatorios.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Error iniciando sesión:", error);
        setErrorMsg(error.message || "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }

      setStatus("Sesión iniciada correctamente.");

      // Registrar sesión del dispositivo sin romper login
      try {
        if (data?.user) {
          await upsertUserSession({ appVersion: "1.0.0" });
        }
      } catch (sessionErr) {
        console.warn(
          "No se pudo registrar user_session (se continúa igual):",
          sessionErr
        );
      }
    } catch (err) {
      console.error("Error inesperado en login:", err);
      setErrorMsg("Ocurrió un error inesperado al iniciar sesión.");
    }

    setLoading(false);
  };

  return (
    <section className="aurevi-screen profile-screen">
      <div className="profile-shell">
        {/* Lado de texto/branding */}
        <div className="profile-side-copy">
          <p className="profile-kicker">PERFIL AUREVI</p>
          <h2 className="profile-hero-title">Tu espacio creativo, seguro.</h2>
          <p className="profile-hero-subtitle">
            Crea tu cuenta para guardar tus videos, progresos y estadísticas.
            Inicia sesión desde cualquier dispositivo y continúa donde te
            quedaste.
          </p>
        </div>

        {/* Tarjeta principal */}
        <div className="profile-card">
          <div className="profile-card-header">
            <h3 className="profile-card-title">
              {mode === "login" ? "Inicia sesión" : "Crea una cuenta"}
            </h3>
            <p className="profile-card-subtitle">
              {mode === "login"
                ? "Accede a tu mundo de videos cortos, sin complicaciones."
                : "Es rápido y fácil. Solo necesitas un correo y contraseña."}
            </p>
          </div>

          {/* Toggle login / registro */}
          <div className="profile-mode-toggle">
            <button
              type="button"
              className={"profile-mode-btn" + (mode === "login" ? " active" : "")}
              onClick={() => {
                setMode("login");
                setStatus("");
                setErrorMsg("");
              }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={"profile-mode-btn" + (mode === "register" ? " active" : "")}
              onClick={() => {
                setMode("register");
                setStatus("");
                setErrorMsg("");
              }}
            >
              Crear cuenta
            </button>
          </div>

          {/* FORMULARIOS */}
          {mode === "register" ? (
            <form className="profile-form" onSubmit={handleRegister}>
              <div className="profile-name-row">
                <label className="profile-label">
                  Nombre
                  <input
                    className="profile-input"
                    type="text"
                    value={form.firstName}
                    onChange={handleChange("firstName")}
                  />
                </label>

                <label className="profile-label">
                  Apellidos
                  <input
                    className="profile-input"
                    type="text"
                    value={form.lastName}
                    onChange={handleChange("lastName")}
                  />
                </label>
              </div>

              <div className="profile-label-group">
                <div className="profile-label-title-row">
                  <span className="profile-label-title">Fecha de nacimiento</span>
                </div>

                <div className="profile-date-row">
                  <select
                    className="profile-input"
                    value={form.day}
                    onChange={handleChange("day")}
                  >
                    <option value="">Día</option>
                    {days.map((d) => (
                      <option key={d} value={String(d).padStart(2, "0")}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <select
                    className="profile-input"
                    value={form.month}
                    onChange={handleChange("month")}
                  >
                    <option value="">Mes</option>
                    {months.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="profile-input"
                    value={form.year}
                    onChange={handleChange("year")}
                  >
                    <option value="">Año</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="profile-label-group">
                <div className="profile-label-title-row">
                  <span className="profile-label-title">Género</span>
                </div>

                <div className="profile-gender-row">
                  {["Mujer", "Hombre", "Personalizado"].map((g) => (
                    <label key={g} className="profile-gender-option">
                      <span>{g}</span>
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={form.gender === g}
                        onChange={handleChange("gender")}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <label className="profile-label">
                Correo electrónico
                <input
                  className="profile-input"
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                />
              </label>

              <label className="profile-label">
                Contraseña
                <input
                  className="profile-input"
                  type="password"
                  value={form.password}
                  onChange={handleChange("password")}
                />
              </label>

              {status && <p className="profile-status profile-status-ok">{status}</p>}
              {errorMsg && <p className="profile-status profile-status-error">{errorMsg}</p>}

              <button
                className="aurevi-primary-btn profile-register-btn profile-main-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Creando cuenta..." : "Registrarte"}
              </button>
            </form>
          ) : (
            <form className="profile-form" onSubmit={handleLogin}>
              <label className="profile-label">
                Correo electrónico
                <input
                  className="profile-input"
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                />
              </label>

              <label className="profile-label">
                Contraseña
                <input
                  className="profile-input"
                  type="password"
                  value={form.password}
                  onChange={handleChange("password")}
                />
              </label>

              {status && <p className="profile-status profile-status-ok">{status}</p>}
              {errorMsg && <p className="profile-status profile-status-error">{errorMsg}</p>}

              <button
                className="aurevi-primary-btn profile-main-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Iniciando sesión..." : "Iniciar sesión"}
              </button>

              <p className="profile-small-print">
                ¿Aún no tienes cuenta?{" "}
                <button
                  type="button"
                  className="profile-link-like"
                  onClick={() => {
                    setMode("register");
                    setStatus("");
                    setErrorMsg("");
                  }}
                >
                  Crea una cuenta nueva.
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default AuthScreen;