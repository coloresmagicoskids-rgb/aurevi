// src/App.jsx
import React, { useEffect, useState } from "react";
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

// ✅ Sesiones por dispositivo
import {
  upsertUserSession,
  touchSession,
  isCurrentSessionRevoked,
} from "./core/sessionTracker";

// ✅ Username obligatorio
import { useRequireUsername } from "./hooks/useRequireUsername";
import ChooseUsernameModal from "./components/ChooseUsernameModal";

function App() {
  const [currentScreen, setCurrentScreen] = useState("home");
  const [screenParams, setScreenParams] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const { activeWorld } = useWorld();

  // ✅ Username gate
  const {
    loading: usernameLoading,
    needsUsername,
    refresh: refreshUsernameState,
  } = useRequireUsername(user?.id);

  // ==================================================
  // AUTH / USUARIO
  // ==================================================
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) setUser(data?.user ?? null);
      } catch (e) {
        console.warn("getUser falló:", e);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    init();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) setUser(session?.user ?? null);
      }
    );

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  // ==================================================
  // ✅ SESIÓN / DISPOSITIVO
  // ==================================================
  useEffect(() => {
    if (!user?.id) return;

    let intervalId = null;

    const safeUpsert = async () => {
      try {
        await upsertUserSession({ appVersion: "3.0.0" });
      } catch (e) {
        console.warn("upsertUserSession falló:", e);
      }
    };

    const heartbeat = async () => {
      try {
        await touchSession();

        const revoked = await isCurrentSessionRevoked();
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

    intervalId = window.setInterval(() => {
      heartbeat();
    }, 25_000);

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
  // NAVEGACIÓN
  // ==================================================
  const navigate = (screen, params = null) => {
    setCurrentScreen(screen);
    setScreenParams(params);
  };

  // ==================================================
  // RENDER DE PANTALLAS
  // ==================================================
  const renderScreen = () => {
    switch (currentScreen) {
      case "home":
        return <HomeFeed navigate={navigate} />;
      case "explore":
        return <Explore navigate={navigate} />;
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
        return <HomeFeed navigate={navigate} />;
    }
  };

  // ==================================================
  // ESTADOS ESPECIALES
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

  // Mientras se evalúa el username en background
  if (usernameLoading) {
    return (
      <div className="aurevi-app">
        <main className="aurevi-main">
          <p style={{ color: "#9ca3af" }}>Preparando tu cuenta...</p>
        </main>
      </div>
    );
  }

  const mustPickUsername = !!needsUsername;

  // ==================================================
  // APP NORMAL (+ MODAL OBLIGATORIO)
  // ==================================================
  return (
    <div className="aurevi-app">
      <ChooseUsernameModal
        open={mustPickUsername}
        onDone={async () => {
          await refreshUsernameState();
        }}
      />

      <Header activeWorld={activeWorld} />
      <main className="aurevi-main">{renderScreen()}</main>
      <BottomBar currentScreen={currentScreen} navigate={navigate} />
    </div>
  );
}

export default App;