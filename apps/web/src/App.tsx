import { Navigate, Route, Routes } from "react-router-dom";
import { TabNavProvider } from "./tabNavReset";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { Layout } from "./components/Layout";
import { useApp } from "./context";
import { NoticeProvider } from "./noticeContext";
import { ActivityPage } from "./pages/ActivityPage";
import { AuthPage } from "./pages/AuthPage";
import { CityPage } from "./pages/CityPage";
import { HomePage } from "./pages/HomePage";
import { MapPage } from "./pages/MapPage";
import { ProfilePage } from "./pages/ProfilePage";
import { WorkPage } from "./pages/WorkPage";

export function App() {
  const { user, loading } = useApp();

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  return (
    <TabNavProvider>
      <NoticeProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/work" element={<WorkPage />} />
            <Route path="/city" element={<CityPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/city" replace />} />
          </Route>
        </Routes>
      </NoticeProvider>
    </TabNavProvider>
  );
}
