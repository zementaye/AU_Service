import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Layout from "./Layout";

export default function AdminRoute({ children }) {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="center-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "Super Admin") return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}
