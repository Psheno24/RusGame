import { Navigate, Route, Routes } from "react-router-dom";
import { CityNavProvider } from "./cityNav";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { Layout } from "./components/Layout";
import { useApp } from "./context";
import { NoticeProvider } from "./noticeContext";
import { AuthPage } from "./pages/AuthPage";
import { CityPage } from "./pages/CityPage";
import { MapPage } from "./pages/MapPage";
import { ProfilePage } from "./pages/ProfilePage";

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
    <CityNavProvider>
      <NoticeProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/map" element={<MapPage />} />
            <Route path="/city" element={<CityPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/city" replace />} />
          </Route>
        </Routes>
      </NoticeProvider>
    </CityNavProvider>
  );
}
