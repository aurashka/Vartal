import React, { useState } from 'react';
import { useAuth } from '../App';
import { db } from '../services/firebase';
import { ref, update } from 'firebase/database';
import { ChevronLeftIcon, GlobeIcon, LockIcon, UsersIcon, AtSignIcon, MessageCircleIcon } from './common/Icons';
import BottomSheetSelector from './common/BottomSheetSelector';

interface PrivacySettingsProps {
  onClose: () => void;
}

type SheetType = null | 'account' | 'mentions' | 'messages';

const PrivacySettings: React.FC<PrivacySettingsProps> = ({ onClose }) => {
    const { appUser, currentUser } = useAuth();
    const [activeSheet, setActiveSheet] = useState<SheetType>(null);

    if (!appUser || !currentUser) return null;

    const handleSettingChange = async (key: string, value: any) => {
        const userRef = ref(db, `users/${currentUser.uid}`);
        await update(userRef, { [key]: value });
    };

    const accountOptions = [
        { value: 'public', label: 'Public', description: 'Anyone can see your profile and posts.' },
        { value: 'private', label: 'Private', description: 'Only followers can see your profile and posts.' }
    ];

    const mentionOptions = [
        { value: 'everyone', label: 'Everyone', description: 'Anyone can mention you.' },
        { value: 'following', label: 'People You Follow', description: 'Only people you follow can mention you.' },
        { value: 'none', label: 'No One', description: 'No one can mention you.' }
    ];
    
    const messageOptions = [
        { value: 'everyone', label: 'Everyone', description: 'Anyone can send you a message request.' },
        { value: 'following', label: 'People You Follow', description: 'Only people you follow can send you messages.' }
    ];

    const currentAccountPrivacy = appUser.isPrivate ? 'private' : 'public';
    const currentMentionSetting = appUser.mentionSettings || 'everyone';
    const currentMessageSetting = appUser.messageSettings || 'everyone';
    
    const getSettingValues = (key: string) => {
        switch (key) {
            case 'account': return {
                title: 'Account Privacy',
                options: accountOptions,
                currentValue: currentAccountPrivacy,
                handler: (val: string) => handleSettingChange('isPrivate', val === 'private')
            };
            case 'mentions': return {
                title: 'Who can mention you',
                options: mentionOptions,
                currentValue: currentMentionSetting,
                handler: (val: string) => handleSettingChange('mentionSettings', val)
            };
            case 'messages': return {
                title: 'Who can message you',
                options: messageOptions,
                currentValue: currentMessageSetting,
                handler: (val: string) => handleSettingChange('messageSettings', val)
            };
            default: return null;
        }
    };
    
    const activeSetting = getSettingValues(activeSheet || '');

    const SettingItem: React.FC<{
        icon: React.ReactNode,
        title: string,
        value: string,
        onClick: () => void
    }> = ({ icon, title, value, onClick }) => (
        <button onClick={onClick} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-4">
                <div className="text-gray-500 dark:text-gray-400">{icon}</div>
                <span className="font-semibold">{title}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">{value}</span>
                <ChevronLeftIcon className="w-5 h-5 text-gray-400 transform rotate-180" />
            </div>
        </button>
    );

    return (
        <>
            <div className="h-screen w-screen bg-white dark:bg-black flex flex-col">
                <header className="flex-shrink-0 flex items-center justify-between p-4 h-16 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
                    <button onClick={onClose} className="p-2 -ml-2"><ChevronLeftIcon className="w-7 h-7"/></button>
                    <h1 className="font-bold text-lg">Privacy and Security</h1>
                    <div className="w-8"></div>
                </header>
                <main className="flex-1 p-4 overflow-y-auto space-y-4">
                    <SettingItem 
                        icon={<LockIcon className="w-6 h-6"/>}
                        title="Account Privacy"
                        value={currentAccountPrivacy}
                        onClick={() => setActiveSheet('account')}
                    />
                    <SettingItem 
                        icon={<AtSignIcon className="w-6 h-6"/>}
                        title="Mentions"
                        value={currentMentionSetting}
                        onClick={() => setActiveSheet('mentions')}
                    />
                    <SettingItem 
                        icon={<MessageCircleIcon className="w-6 h-6"/>}
                        title="Messages"
                        value={currentMessageSetting}
                        onClick={() => setActiveSheet('messages')}
                    />
                </main>
            </div>

            {activeSheet && activeSetting && (
                <BottomSheetSelector
                    isOpen={!!activeSheet}
                    onClose={() => setActiveSheet(null)}
                    title={activeSetting.title}
                    options={activeSetting.options}
                    currentValue={activeSetting.currentValue}
                    onSelect={activeSetting.handler}
                />
            )}
        </>
    );
};

export default PrivacySettings;
