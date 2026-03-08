import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SidebarLayout from './layouts/SidebarLayout';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Anomalies from './pages/Anomalies';
import Settings from './pages/Settings';
import Tips from './pages/Tips';

function App() {
  return (
    <BrowserRouter>
      <SidebarLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tips" element={<Tips />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SidebarLayout>
    </BrowserRouter>
  );
}

export default App;
