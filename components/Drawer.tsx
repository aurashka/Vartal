import React, { useState } from 'react';
import { useAuth } from '../App';
import { auth } from '../services/firebase';
import ThemeSwitcher from './ThemeSwitcher';
import { LogoutIcon, ShieldIcon } from './common/Icons';
import Avatar from './common/Avatar';
import UserBadges from './common/UserBadges';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminPanel: () => void;
  onEditProfile: () => void;
}

const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, onOpenAdminPanel, onEditProfile }) => {
  const { appUser } = useAuth();

  if (!appUser) return null;

  const handleEditProfileClick = () => {
    onEditProfile();
    onClose();
  };
  
  const handleSignOut = () => {
    sessionStorage.setItem('skipRememberedAccounts', 'true');
    auth.signOut();
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      <div 
        className={`fixed top-0 left-0 h-full w-80 max-w-[80vw] bg-white/80 dark:bg-black/80 backdrop-blur-2xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex flex-col items-center text-center mb-6">
            <Avatar photoURL={appUser.photoURL} displayName={appUser.displayName} className="w-24 h-24 mb-4" />
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-bold">{appUser.displayName}</h2>
              <UserBadges badges={appUser.badges} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{appUser.email}</p>
            <button 
              onClick={handleEditProfileClick} 
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary-hover"
            >
              Edit Profile
            </button>
          </div>
          
          <div className="space-y-4">
            {appUser.role === 'admin' && (
                <button
                    onClick={() => {
                        onOpenAdminPanel();
                        onClose();
                    }}
                    className="w-full flex items-center justify-start gap-3 p-3 text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-left"
                >
                    <ShieldIcon className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="font-medium">Admin Panel</span>
                </button>
            )}
            <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
              <p className="font-medium mb-2 text-sm text-gray-600 dark:text-gray-300">Theme</p>
              <ThemeSwitcher />
            </div>
          </div>

          <div className="mt-auto">
            <button 
              onClick={handleSignOut} 
              className="w-full flex items-center justify-center gap-2 p-3 text-red-500 dark:text-red-400 hover:bg-red-500/10 rounded-lg"
            >
              <LogoutIcon className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Drawer;