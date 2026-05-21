import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProtectedRoute } from './routes/ProtectedRoute.jsx';
import { Layout } from './components/layout/Layout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { ComparatorPage } from './pages/ComparatorPage.jsx';
import { AlertsPage } from './pages/AlertsPage.jsx';
import { TrendsPage } from './pages/TrendsPage.jsx';
import { CatalogPage } from './pages/CatalogPage.jsx';
import { PresentationPage } from './pages/PresentationPage.jsx';
import { AssistantPage } from './pages/AssistantPage.jsx';
import { MetodologiaPage } from './pages/MetodologiaPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="comparador" element={<ComparatorPage />} />
            <Route path="termometro" element={<AlertsPage />} />
            <Route path="semaforo" element={<Navigate to="/termometro" replace />} />
            <Route path="tendencias" element={<TrendsPage />} />
            <Route path="catalogo" element={<CatalogPage />} />
            <Route path="presentacion" element={<PresentationPage />} />
            <Route path="asistente" element={<AssistantPage />} />
            <Route path="metodologia" element={<MetodologiaPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
