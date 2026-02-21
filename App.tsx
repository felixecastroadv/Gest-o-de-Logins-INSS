import React, { useState, useEffect } from 'react';
import { User } from './types';
import { INITIAL_DATA, INITIAL_CONTRACTS } from './data';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import { getDbConfig, initSupabase } from './supabaseClient';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCloudConfigured, setIsCloudConfigured] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem('inss_theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) { document.documentElement.classList.add('dark'); }
  }, []);
  
  const checkCloudStatus = () => {
      const config = getDbConfig();
      setIsCloudConfigured(!!(config && config.url && config.key));
  };

  useEffect(() => { checkCloudStatus(); }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('inss_theme', newMode ? 'dark' : 'light');
    if (newMode) { document.documentElement.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); }
  };

  const handleLogin = (authenticatedUser: User) => { setUser(authenticatedUser); };
  const handleLogout = () => { setUser(null); };
  const handleSettingsSave = () => { checkCloudStatus(); };
  
  const handleRestoreBackup = () => {
        const supabase = initSupabase();
        if(supabase) {
             const restore = async () => {
                 await supabase.from('clients').upsert({ id: 1, data: INITIAL_DATA });
                 await supabase.from('clients').upsert({ id: 2, data: INITIAL_CONTRACTS });
                 alert("Dados restaurados com sucesso!");
                 window.location.reload();
             };
             restore();
        } else {
            localStorage.setItem('inss_records', JSON.stringify(INITIAL_DATA));
            localStorage.setItem('inss_contracts', JSON.stringify(INITIAL_CONTRACTS));
            alert("Dados locais restaurados!");
            window.location.reload();
        }
    };

  return (
    <>
      {user ? (
        <Dashboard 
            user={user} 
            onLogout={handleLogout} 
            darkMode={darkMode} 
            toggleDarkMode={toggleDarkMode} 
            onOpenSettings={() => setIsSettingsOpen(true)} 
            isCloudConfigured={isCloudConfigured} 
            isSettingsOpen={isSettingsOpen} 
            onCloseSettings={() => setIsSettingsOpen(false)} 
            onSettingsSaved={handleSettingsSave} 
            onRestoreBackup={handleRestoreBackup} 
        />
      ) : (
        <>
            <Login 
                onLogin={handleLogin} 
                onOpenSettings={() => setIsSettingsOpen(true)} 
                isCloudConfigured={isCloudConfigured} 
            />
            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                onSave={handleSettingsSave} 
                onRestoreBackup={handleRestoreBackup} 
            />
        </>
      )}
    </>
  );
}
