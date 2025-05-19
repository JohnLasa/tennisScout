import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import MatchSelection from './components/MatchSelection';
import MatchTracker from './components/MatchTracker';
import SummaryScreen from './components/SummaryScreen';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MatchSelection />} />
        <Route path="/match" element={<MatchTracker />} />
        <Route path="/summary" element={<SummaryScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
