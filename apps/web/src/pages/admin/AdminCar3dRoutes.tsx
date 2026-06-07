import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useApp } from "../../context";
import { AdminCar3dEditPage } from "./AdminCar3dEditPage";
import { AdminCar3dListPage } from "./AdminCar3dListPage";

function AdminCar3dGate({ children }: { children: ReactNode }) {
  const { user } = useApp();
  if (!user?.isTest && !user?.isAdmin) {
    return <Navigate to="/profile" replace />;
  }
  return children;
}

export function AdminCar3dListRoute() {
  return (
    <AdminCar3dGate>
      <AdminCar3dListPage />
    </AdminCar3dGate>
  );
}

export function AdminCar3dEditRoute() {
  const { modelId } = useParams<{ modelId: string }>();
  if (!modelId) return <Navigate to="/admin/car-3d" replace />;

  return (
    <AdminCar3dGate>
      <AdminCar3dEditPage modelId={modelId} />
    </AdminCar3dGate>
  );
}
