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
import { ProfileSettingsPage } from "./pages/ProfileSettingsPage";
import { ProfileNotificationsPage } from "./pages/ProfileNotificationsPage";
import { WorkPage } from "./pages/WorkPage";
import { CarViewerPage } from "./pages/dev/CarViewerPage";
import { AdminCar3dEditRoute, AdminCar3dListRoute } from "./pages/admin/AdminCar3dRoutes";

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
            <Route path="/profile/settings" element={<ProfileSettingsPage />} />
            <Route path="/profile/settings/notifications" element={<ProfileNotificationsPage />} />
            <Route path="/dev/car-viewer" element={<CarViewerPage />} />
            <Route path="/admin/car-3d" element={<AdminCar3dListRoute />} />
            <Route path="/admin/car-3d/:modelId" element={<AdminCar3dEditRoute />} />
            <Route path="*" element={<Navigate to="/city" replace />} />
          </Route>
        </Routes>
      </NoticeProvider>
    </TabNavProvider>
  );
}
