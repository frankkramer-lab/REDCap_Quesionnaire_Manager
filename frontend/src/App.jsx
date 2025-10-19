// src/App.jsx
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import FragebogenErstellenPage from "./pages/FragebogenErstellenPage";
import FragenPage from "./pages/FragenPage";
import ProfilPage from "./pages/ProfilPage";
import ImportedFormsPage from "./pages/ImportedFormsPage";


import MainLayout from "./layout/MainLayout";

function AppWrapper() {
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    const handleStorage = () => {
      setToken(localStorage.getItem("token"));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <Router>
      <AppRoutes token={token} setToken={setToken} />
    </Router>
  );
}

function AppRoutes({ token, setToken }) {
  const location = useLocation();

  const ProtectedRoute = ({ children }) =>
    token ? children : <Navigate to="/login" state={{ from: location }} />;

  const withLayout = (page) => <MainLayout>{page}</MainLayout>;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage setToken={setToken} />} />

      <Route
        path="/importierte-formulare"
        element={
          token ? (
            <MainLayout>
            <ImportedFormsPage />
            </MainLayout>
            ) : (
            <Navigate to="/login" state={{ from: location }} />
            )
        }
       />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>{withLayout(<DashboardPage />)}</ProtectedRoute>
        }
      />
      <Route
  path="/fragebogen-erstellen"
  element={
    <ProtectedRoute>
      <MainLayout>
        <FragebogenErstellenPage />
      </MainLayout>
    </ProtectedRoute>
  }
/>

      <Route
        path="/fragen"
        element={<ProtectedRoute>{withLayout(<FragenPage />)}</ProtectedRoute>}
      />
      <Route
        path="/profil"
        element={<ProtectedRoute>{withLayout(<ProfilPage />)}</ProtectedRoute>}
      />
    </Routes>
  );
}

export default AppWrapper;