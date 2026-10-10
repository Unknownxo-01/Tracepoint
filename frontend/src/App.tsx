import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { NewInvestigationPage } from './pages/NewInvestigationPage';
import { TraceExplorerPage } from './pages/TraceExplorerPage';
import { ComparePage } from './pages/ComparePage';
import { ReplayLabPage } from './pages/ReplayLabPage';
import { FindingsPage } from './pages/FindingsPage';
import { SettingsPage } from './pages/SettingsPage';
import { InvestigationRecord } from './types';
import { api } from './services/api';

export function App() {
  const [currentPage, setCurrentPage] = useState<string>('overview');
  const [investigations, setInvestigations] = useState<InvestigationRecord[]>([]);
  const [activeInvestigationId, setActiveInvestigationId] = useState<string | null>(null);

  useEffect(() => {
    loadInvestigations();
  }, []);

  const loadInvestigations = async () => {
    try {
      const list = await api.listInvestigations();
      setInvestigations(list);
      if (list.length > 0 && !activeInvestigationId) {
        setActiveInvestigationId(list[0].id);
      }
    } catch (e) {
      console.error('Failed to load investigations:', e);
    }
  };

  const handleSelectInvestigation = (id: string) => {
    setActiveInvestigationId(id);
  };

  const handleLoadDemo = async () => {
    try {
      const res = await api.seedSamples();
      await loadInvestigations();
      if (res.demo_investigation_id) {
        setActiveInvestigationId(res.demo_investigation_id);
      }
      setCurrentPage('compare');
    } catch (e) {
      console.error('Failed to load demo:', e);
    }
  };

  const handleInvestigationCreated = async (invId: string) => {
    await loadInvestigations();
    setActiveInvestigationId(invId);
    setCurrentPage('compare');
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      investigations={investigations}
      activeInvestigationId={activeInvestigationId}
      onSelectInvestigation={handleSelectInvestigation}
      onLoadDemo={handleLoadDemo}
    >
      {currentPage === 'overview' && (
        <OverviewPage
          onNavigate={setCurrentPage}
          onSelectInvestigation={handleSelectInvestigation}
          onLoadDemo={handleLoadDemo}
        />
      )}

      {currentPage === 'new' && (
        <NewInvestigationPage
          onInvestigationCreated={handleInvestigationCreated}
          onNavigate={setCurrentPage}
        />
      )}

      {currentPage === 'explorer' && (
        <TraceExplorerPage />
      )}

      {currentPage === 'compare' && (
        <ComparePage
          investigationId={activeInvestigationId}
          onNavigate={setCurrentPage}
        />
      )}

      {currentPage === 'replay' && (
        <ReplayLabPage />
      )}

      {currentPage === 'findings' && (
        <FindingsPage
          investigationId={activeInvestigationId}
        />
      )}

      {currentPage === 'settings' && (
        <SettingsPage />
      )}
    </Layout>
  );
}

export default App;
