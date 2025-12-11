
import React from 'react';
import Dashboard from './components/Dashboard';
import { LanguageProvider } from './contexts/LanguageContext';

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <Dashboard />
    </LanguageProvider>
  );
};

export default App;
