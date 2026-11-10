import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import "./index.css";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { AuthCallback } from "./pages/AuthCallback";
import { ColonyPage } from "./pages/Colony";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { TrackerGuide } from "./pages/TrackerGuide";
import { TrackerNew } from "./pages/TrackerNew";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="auth/callback" element={<AuthCallback />} />
            <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="colonies/:id" element={<RequireAuth><ColonyPage /></RequireAuth>} />
            <Route path="colonies/:id/trackers/new" element={<RequireAuth><TrackerNew /></RequireAuth>} />
            <Route path="colonies/:id/trackers/:ladderId" element={<RequireAuth><TrackerGuide /></RequireAuth>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
