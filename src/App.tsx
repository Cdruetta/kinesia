import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { PinLockScreen } from '@/components/pwa/PinLockScreen';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt';

const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const Agenda = lazy(() => import('@/pages/Agenda').then((m) => ({ default: m.Agenda })));
const Owners = lazy(() => import('@/pages/Owners').then((m) => ({ default: m.Owners })));
const OwnerDetailPage = lazy(() => import('@/pages/OwnerDetail').then((m) => ({ default: m.OwnerDetailPage })));
const Patients = lazy(() => import('@/pages/Patients').then((m) => ({ default: m.Patients })));
const PatientDetailPage = lazy(() => import('@/pages/PatientDetail').then((m) => ({ default: m.PatientDetailPage })));
const Communications = lazy(() => import('@/pages/Communications').then((m) => ({ default: m.Communications })));
const Backups = lazy(() => import('@/pages/Backups').then((m) => ({ default: m.Backups })));
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })));

export default function App() {
  return (
    <>
      <PinLockScreen />
      <OfflineIndicator />
      <InstallPrompt />
      <UpdatePrompt />
      <Layout>
        <Suspense fallback={<div className="flex items-center justify-center min-h-[300px] text-ink-secondary">Cargando…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/propietarios" element={<Owners />} />
            <Route path="/propietarios/:id" element={<OwnerDetailPage />} />
            <Route path="/pacientes" element={<Patients />} />
            <Route path="/pacientes/:id" element={<PatientDetailPage />} />
            <Route path="/comunicaciones" element={<Communications />} />
            <Route path="/respaldos" element={<Backups />} />
            <Route path="/configuracion" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </>
  );
}
