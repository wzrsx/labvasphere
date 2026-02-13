// src/App.js
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Header from "./components/Header";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import MainPage from "./pages/MainPage";
import PartnerPage from "./pages/PartnerPage";
import GuidePage from "./pages/GuidePage";
import SettingsPage from "./pages/SettingsPage";
import ProjectView from "./pages/ProjectView";
import EditorPage from "./pages/EditorPage";
// Компонент-обёртка, чтобы получить доступ к location внутри Router
const AppContent = () => {
  const location = useLocation();

  // Список путей, где НУЖЕН хедер
  const routesWithHeader = ["/main", "/partner", "/guide", "/settings"];

  const showHeader = routesWithHeader.includes(location.pathname);

  return (
    <>
      {showHeader && <Header />}
      <div className={showHeader ? "main-content" : ""}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/main" element={<MainPage />} />
          <Route path="/partner" element={<PartnerPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/project/:id" element={<ProjectView />} />
          <Route path="/editor/:id" element={<EditorPage />} />
        </Routes>
      </div>
    </>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
