// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useWorld } from "./worlds/WorldContext";

// Layout
import Header from "./layout/Header.jsx";
import BottomBar from "./layout/BottomBar.jsx";

// Pantallas
import HomeFeed from "./screens/HomeFeed.jsx";
import Explore from "./screens/Explore.jsx";
import Create from "./screens/Create.jsx";
import Notifications from "./screens/Notifications.jsx";
import Profile from "./screens/Profile.jsx";
import AuthScreen from "./screens/AuthScreen.jsx";
import WatchVideo from "./screens/WatchVideo.jsx";
import Marketplace from "./screens/Marketplace.jsx";
import MyLibrary from "./screens/MyLibrary.jsx";
import MarketItemDetail from "./screens/MarketItemDetail.jsx";
import PublishMarketItem from "./screens/PublishMarketItem.jsx";
import Wallet from "./screens/Wallet.jsx";
import Messages from "./screens/Messages.jsx";
import Album from "./screens/Album.jsx";

// ✅ Sesiones por dispositivo
import {
  upsertUserSession,
  touchSession,
  isCurrentSessionRevoked,
} from "./core/sessionTracker";

// ✅ Username obligatorio
import { useRequireUsername } from "./hooks/useRequireUsername";
import ChooseUsernameModal from "./components/ChooseUsernameModal";

const withTimeout = (promise, ms = 8000, label = "timeout") =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);

function App() {
  const [currentScreen, setCurrentScreen] = useState("home");
  const [screenParams, setScreenParams] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const { activeWorld } = useWorld();

  // ✅ Username gate (NO bloquea el arranque)
  const {
    loading: usernameLoading,
    needsUsername,
    refresh: refreshUsernameState,
  } = useRequireUsername(user?.id);

  // ==================================================
  // AUTH / USUARIO (BLINDADO: nunca se queda infinito)
  // ==================================================
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getUser(),
          8000,
          "getUser timeout"
        );

        if (!mounted) return;
        setUser(data?.user ?? null);
      } catch (e) {
        console.warn("[BOOT] getUser falló o timeout:", e);
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    init();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  // ==================================================
  // ✅ SESIÓN / DISPOSITIVO (no bloquea UI)
  // ==================================================
  useEffect(() => {
    if (!user?.id) return;

    let intervalId = null;

    const safeUpsert = async () => {
      try {
        await withTimeout(
          upsertUserSession({ appVersion: "3.0.0" }),
          8000,
          "upsertUserSession timeout"
        );
      } catch (e) {
        console.warn("upsertUserSession falló:", e);
      }
    };

    const heartbeat = async () => {
      try {
        await withTimeout(touchSession(), 8000, "touchSession timeout");

        const revoked = await withTimeout(
          isCurrentSessionRevoked(),
          8000,
          "isCurrentSessionRevoked timeout"
        );

        if (revoked) {
          console.warn("Sesión revocada → cerrando sesión");
          await supabase.auth.signOut();
          setUser(null);
        }
      } catch (e) {
        console.warn("heartbeat falló:", e);
      }
    };

    safeUpsert().then(() => heartbeat());

    intervalId = window.setInterval(() => heartbeat(), 25_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") heartbeat();
    };
    const onFocus = () => heartbeat();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id]);

  // ==================================================
  // ✅ NAVEGACIÓN (cambio mínimo: limpiar params cuando no vienen)
  // ==================================================
  const navigate = (screen, params = null) => {
    setCurrentScreen(screen);
    setScreenParams(params ?? null); // 👈 evita params “pegados”
  };

  // ==================================================
  // RENDER DE PANTALLAS
  // ==================================================
  const renderScreen = () => {
    switch (currentScreen) {
      case "home":
        return <HomeFeed navigate={navigate} params={screenParams} />;
      case "explore":
        return <Explore navigate={navigate} />;
      case "album":
        return <Album navigate={navigate} />;
      case "create":
        return <Create activeWorld={activeWorld} navigate={navigate} />;
      case "market":
        return <Marketplace activeWorld={activeWorld} navigate={navigate} />;
      case "marketPublish":
        return (
          <PublishMarketItem activeWorld={activeWorld} navigate={navigate} />
        );
      case "marketDetail":
        return (
          <MarketItemDetail
            item={screenParams?.item}
            activeWorld={activeWorld}
            navigate={navigate}
          />
        );
      case "library":
        return <MyLibrary activeWorld={activeWorld} navigate={navigate} />;
      case "wallet":
        return <Wallet activeWorld={activeWorld} navigate={navigate} />;
      case "notifications":
        return <Notifications navigate={navigate} />;
      case "profile":
        return <Profile navigate={navigate} />;
      case "watch":
        return (
          <WatchVideo videoId={screenParams?.videoId} navigate={navigate} />
        );
      case "messages":
        return <Messages navigate={navigate} params={screenParams} />;
      default:
        return <HomeFeed navigate={navigate} params={screenParams} />;
    }
  };

  // ==================================================
  // ESTADOS ESPECIALES (solo authLoading aquí)
  // ==================================================
  if (authLoading) {
    return (
      <div className="aurevi-app">
        <main className="aurevi-main">
          <p style={{ color: "#9ca3af" }}>Cargando AUREVI...</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="aurevi-app">
        <main className="aurevi-main">
          <AuthScreen />
        </main>
      </div>
    );
  }

  const mustPickUsername = !usernameLoading && !!needsUsername;

  // ==================================================
  // ✅ FLAGS PARA NAV (YouTube-like)
  // ==================================================
  const compact = currentScreen === "watch";

  return (
    <div className="aurevi-app">
      <ChooseUsernameModal
        open={mustPickUsername}
        onDone={async () => {
          await refreshUsernameState();
        }}
      />

      <Header activeWorld={activeWorld} />

      {/* ✅ NAV ARRIBA (debajo del header) */}
      <BottomBar
        currentScreen={currentScreen}
        navigate={navigate}
        compact={compact}   // ✅ compacto cuando estás viendo video
        autoHide={true}     // ✅ (si BottomBar lo implementa) se oculta al bajar
      />

      <main className="aurevi-main">{renderScreen()}</main>
    </div>
  );
}

export default App;