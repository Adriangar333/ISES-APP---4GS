import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import FileImport from './pages/FileImport/FileImport';
import ZoneManagement from './pages/ZoneManagement/ZoneManagement';
import InspectorManagement from './pages/InspectorManagement/InspectorManagement';
import RouteManagement from './pages/RouteManagement/RouteManagement';
import InspectorDashboard from './pages/InspectorDashboard/InspectorDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard/SupervisorDashboard';

function App() {
  return (
    <Router>
      <div className="App">
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/import" element={<FileImport />} />
            <Route path="/zones" element={<ZoneManagement />} />
            <Route path="/inspectors" element={<InspectorManagement />} />
            <Route path="/routes" element={<RouteManagement />} />
            <Route path="/inspector/:id" element={<InspectorDashboard />} />
            <Route path="/inspector-dashboard" element={<InspectorDashboard />} />
            <Route path="/supervisor-dashboard" element={<SupervisorDashboard />} />
          </Routes>
        </Layout>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </Router>
  );
}

export default App;