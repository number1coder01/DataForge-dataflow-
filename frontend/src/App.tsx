import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Navbar } from './components/layout/Navbar';
import { DatasetsPage } from './pages/DatasetsPage';
import { DatasetDetailPage } from './pages/DatasetDetailPage';
import { PipelineRunsPage } from './pages/PipelineRunsPage';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-white">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DatasetsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/datasets"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DatasetsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/datasets/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DatasetDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/runs"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PipelineRunsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/datasets" replace />} />
    </Routes>
  );
};

export default App;
