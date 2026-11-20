import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { PinLockScreen } from '@/components/pwa/PinLockScreen';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt';
import { Home } from '@/pages/Home';
import { Agenda } from '@/pages/Agenda';
import { Owners } from '@/pages/Owners';
import { OwnerDetailPage } from '@/pages/OwnerDetail';
import { Patients } from '@/pages/Patients';
import { PatientDetailPage } from '@/pages/PatientDetail';
import { Communications } from '@/pages/Communications';
import { Backups } from '@/pages/Backups';
import { Settings } from '@/pages/Settings';
import { NotFound } from '@/pages/NotFound';

export default function App() {
  return (
    <>
      <PinLockScreen />
      <OfflineIndicator />
      <InstallPrompt />
      <UpdatePrompt />
      <Layout>
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
      </Layout>
    </>
  );
}
