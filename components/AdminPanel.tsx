import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, off, update, get, push, serverTimestamp, set } from 'firebase/database';
import { AppUser, Post, UserBadge, AppData } from '../types';
import { 
    ChevronLeftIcon, BarChart2Icon, UsersIcon, FileTextIcon, SearchIcon, XIcon, BanIcon, 
    CheckCircleIcon, AwardIcon, TrashIcon,
    ShieldIcon,
    ImageIcon,
    SendIcon,
    SettingsIcon
} from './common/Icons';
import Avatar from './common/Avatar';
import { uploadImage } from '../services/imageUploadService';
import debounce from 'lodash.debounce';
import UserBadges from './common/UserBadges';

// --- Helper Components ---

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center gap-4">
        <div className="p-3 bg-primary/20 text-primary rounded-full">{icon}</div>
        <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        </div>
    </div>
);

const AdminUserDetailSheet: React.FC<{ user: AppUser; onClose: () => void; }> = ({ user, onClose }) => {
    const [displayName, setDisplayName] = useState(user.displayName);
    const [handle, setHandle] = useState(user.handle || '');
    const [bio, setBio] = useState(user.bio || '');
    const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
    const [isBanned, setIsBanned] = useState(user.isBanned || false);
    const [isPremium, setIsPremium] = useState(user.isPremium || false);
    const [badges, setBadges] = useState<UserBadge[]>(user.badges?.map(b => ({ ...b, visible: b.visible !== false })) || []);
    const [newBadgeDesc, setNewBadgeDesc] = useState('');
    const [newBadgeFile, setNewBadgeFile] = useState<File | null>(null);
    const [newBadgePreview, setNewBadgePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [notice, setNotice] = useState('');

    const checkHandleAvailability = useCallback(
        debounce(async (newHandle: string) => {
            if (newHandle === user.handle) {
                setHandleStatus('idle');
                return;
            }
            if (!/^[a-z0-9_]{3,}$/.test(newHandle)) {
                setHandleStatus('invalid');
                return;
            }
            setHandleStatus('checking');
            const handleRef = ref(db, `handles/${newHandle}`);
            const snapshot = await get(handleRef);
            setHandleStatus(snapshot.exists() ? 'taken' : 'available');
        }, 500),
    [user.handle]);

    useEffect(() => {
        if (handle) {
            checkHandleAvailability(handle);
        } else {
            setHandleStatus('idle');
        }
    }, [handle, checkHandleAvailability]);
    
    const getHandleMessage = () => {
        switch (handleStatus) {
          case 'checking': return <p className="text-xs text-yellow-500 mt-1">Checking...</p>;
          case 'available': return <p className="text-xs text-green-500 mt-1">@{handle} is available!</p>;
          case 'taken': return <p className="text-xs text-red-500 mt-1">@{handle} is already taken.</p>;
          case 'invalid': return <p className="text-xs text-red-500 mt-1">Invalid handle format.</p>;
          default: return null;
        }
    }

    const handleSave = async () => {
        if (handleStatus === 'taken' || handleStatus === 'invalid' || handleStatus === 'checking') {
            alert("Please fix the errors before saving.");
            return;
        }

        const updates: { [key: string]: any } = {};
        updates[`/users/${user.uid}/displayName`] = displayName;
        updates[`/users/${user.uid}/bio`] = bio;
        updates[`/users/${user.uid}/isBanned`] = isBanned;
        updates[`/users/${user.uid}/isPremium`] = isPremium;
        updates[`/users/${user.uid}/badges`] = badges;
        
        if (handle !== user.handle) {
            updates[`/users/${user.uid}/handle`] = handle;
            if (user.handle) {
                updates[`/handles/${user.handle}`] = null; // remove old handle
            }
            updates[`/handles/${handle}`] = user.uid; // set new handle
        }
        
        try {
            await update(ref(db), updates);
            alert("User updated successfully!");
            onClose();
        } catch (error) {
            console.error("Failed to update user:", error);
            alert("Failed to update user.");
        }
    };
    
    const handleSendNotice = async () => {
        if (!notice.trim()) return;
        const noticeRef = push(ref(db, `users/${user.uid}/notices`));
        try {
            await set(noticeRef, {
                id: noticeRef.key,
                message: notice,
                timestamp: serverTimestamp(),
                read: false
            });
            setNotice('');
            alert('Notice sent!');
        } catch (error) {
            console.error("Failed to send notice:", error);
            alert("Failed to send notice.");
        }
    };
    
    const handleDeleteUser = async () => {
        if (window.confirm(`Are you sure you want to permanently delete ${user.displayName} and all their data? This action cannot be undone.`)) {
            try {
                const updates: { [key: string]: any } = {};
                updates[`/users/${user.uid}`] = null;
                updates[`/handles/${user.handle}`] = null;
                // In a production app, use a Cloud Function for comprehensive data deletion (posts, comments, chats, etc.)
                await update(ref(db), updates);
                alert('User deleted.');
                onClose();
            } catch (error) {
                console.error("Failed to delete user:", error);
                alert("Failed to delete user.");
            }
        }
    };

    const handleBadgeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewBadgeFile(file);
            // FIX: Explicitly cast `file` to `Blob` to resolve a potential type inference issue with URL.createObjectURL.
            setNewBadgePreview(URL.createObjectURL(file as Blob));
        }
    };
    
    const addBadge = async () => {
        if (newBadgeFile && badges.length < 2) {
            setIsUploading(true);
            const uploadedImage = await uploadImage(newBadgeFile);
            if (uploadedImage) {
                setBadges([...badges, { 
                    iconUrl: uploadedImage.thumb, 
                    description: newBadgeDesc.trim() || 'Custom Badge',
                    visible: true,
                }]);
                setNewBadgeFile(null);
                setNewBadgePreview(null);
                setNewBadgeDesc('');
                if (fileInputRef.current) fileInputRef.current.value = "";
            } else {
                alert('Badge image upload failed.');
            }
            setIsUploading(false);
        }
    };
    
    const toggleBadgeVisibility = (indexToToggle: number) => {
        setBadges(currentBadges => 
            currentBadges.map((badge, index) => 
                index === indexToToggle ? { ...badge, visible: !badge.visible } : badge
            )
        );
    };

    const removeBadge = (index: number) => {
        setBadges(badges.filter((_, i) => i !== index));
    };
    
    const DetailSection: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold mb-3 text-gray-600 dark:text-gray-300">{title}</h3>
            {children}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-50 flex flex-col animate-slide-in-bottom">
            <header className="flex-shrink-0 flex items-center justify-between p-4 h-16 bg-white/70 dark:bg-black/70 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
                <button onClick={onClose} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 rounded-full">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-semibold">Manage User</h2>
                <button onClick={handleSave} className="font-bold text-primary px-4 py-2 rounded-lg hover:bg-primary/10">Save</button>
            </header>
            
            <main className="flex-1 p-4 overflow-y-auto space-y-4">
                <DetailSection title="Profile Info">
                    <div className="flex items-start gap-4">
                        <Avatar photoURL={user.photoURL} displayName={displayName} className="w-20 h-20" />
                        <div className="flex-1 space-y-2">
                             <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display Name" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-md"/>
                             <div>
                                <input type="text" value={handle} onChange={e => setHandle(e.target.value)} placeholder="handle" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-md"/>
                                {getHandleMessage()}
                             </div>
                        </div>
                    </div>
                     <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio..." rows={3} className="mt-4 w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-md text-sm"/>
                </DetailSection>

                <DetailSection title="User Status">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label htmlFor="isBanned" className="font-medium">Block User</label>
                            <input type="checkbox" id="isBanned" checked={isBanned} onChange={e => setIsBanned(e.target.checked)} className="h-5 w-5 rounded text-primary focus:ring-primary" />
                        </div>
                        <div className="flex items-center justify-between">
                            <label htmlFor="isPremium" className="font-medium">Premium Status</label>
                            <input type="checkbox" id="isPremium" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} className="h-5 w-5 rounded text-primary focus:ring-primary" />
                        </div>
                    </div>
                </DetailSection>

                <DetailSection title="Badges (Max 2)">
                    <div className="space-y-2">
                        {badges.map((badge, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-black/5 dark:bg-white/5 rounded-md">
                                <img src={badge.iconUrl} alt={badge.description} className={`w-6 h-6 ${badge.visible === false ? 'opacity-30' : ''}`}/>
                                <span className={`flex-1 text-sm truncate ${badge.visible === false ? 'opacity-50' : ''}`}>{badge.description}</span>
                                <input type="checkbox" title="Toggle visibility" checked={badge.visible} onChange={() => toggleBadgeVisibility(i)} className="h-4 w-4 rounded text-primary focus:ring-primary" />
                                <button onClick={() => removeBadge(i)}><TrashIcon className="w-4 h-4 text-red-500"/></button>
                            </div>
                        ))}
                    </div>
                     {badges.length < 2 && (
                        <div className="mt-2 flex items-center gap-2">
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleBadgeFileChange} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                                {newBadgePreview ? <img src={newBadgePreview} alt="preview" className="w-6 h-6 object-cover rounded"/> : <ImageIcon className="w-6 h-6"/>}
                            </button>
                            <input type="text" value={newBadgeDesc} onChange={e => setNewBadgeDesc(e.target.value)} placeholder="Description" className="flex-1 px-2 py-1 bg-gray-100 dark:bg-gray-900 rounded-md text-sm" />
                            <button onClick={addBadge} disabled={isUploading || !newBadgeFile} className="p-1.5 bg-primary text-white rounded-md text-sm disabled:opacity-50">
                                {isUploading ? '...' : '+'}
                            </button>
                        </div>
                     )}
                </DetailSection>

                <DetailSection title="Actions">
                    <div className="flex items-center gap-2">
                        <input type="text" value={notice} onChange={e => setNotice(e.target.value)} placeholder="Send a notice..." className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-md text-sm"/>
                        <button onClick={handleSendNotice} disabled={!notice.trim()} className="p-2 bg-primary text-white rounded-full disabled:opacity-50"><SendIcon className="w-5 h-5"/></button>
                    </div>
                </DetailSection>

                <DetailSection title="Danger Zone">
                    <button onClick={handleDeleteUser} className="w-full text-left flex items-center gap-3 p-3 bg-red-500/10 text-red-500 font-semibold rounded-lg hover:bg-red-500/20">
                        <TrashIcon className="w-5 h-5"/>
                        Delete All User Data
                    </button>
                </DetailSection>
            </main>
        </div>
    );
};

const AppDataSettings: React.FC = () => {
    const [appName, setAppName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string>('');
    const [features, setFeatures] = useState<AppData['features']>({ googleLogin: { enabled: true } });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
  
    useEffect(() => {
      const appDataRef = ref(db, 'appData');
      get(appDataRef).then(snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.val() as AppData;
          setAppName(data.name);
          setLogoUrl(data.logoUrl);
          setLogoPreview(data.logoUrl);
          setFeatures(data.features || { googleLogin: { enabled: true } });
        }
        setIsLoading(false);
      });
    }, []);
  
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setNewLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
      }
    };
  
    const handleSave = async () => {
      setIsSaving(true);
      let finalLogoUrl = logoUrl;
      if (newLogoFile) {
        const uploadedImage = await uploadImage(newLogoFile);
        if (uploadedImage) {
          finalLogoUrl = uploadedImage.full;
        } else {
          alert('Logo upload failed.');
          setIsSaving(false);
          return;
        }
      }
      
      const appData: AppData = {
        name: appName,
        logoUrl: finalLogoUrl,
        features,
      };
  
      try {
        await set(ref(db, 'appData'), appData);
        alert('App data saved successfully!');
      } catch (error) {
        console.error(error);
        alert('Failed to save app data.');
      } finally {
        setIsSaving(false);
      }
    };
  
    if (isLoading) {
      return <p>Loading app data...</p>;
    }
  
    return (
      <div className="space-y-6">
         <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">App Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">App Name</label>
              <input
                type="text"
                value={appName}
                onChange={e => setAppName(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">App Logo</label>
              <div className="mt-1 flex items-center gap-4">
                {logoPreview && <img src={logoPreview} alt="logo preview" className="w-16 h-16 rounded-lg object-contain bg-gray-200 dark:bg-gray-700 p-1"/>}
                <div className="flex-1 space-y-2">
                   <input
                      type="text"
                      value={logoUrl}
                      onChange={e => {
                          setLogoUrl(e.target.value);
                          setLogoPreview(e.target.value);
                          setNewLogoFile(null);
                      }}
                      placeholder="Enter image URL or upload"
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-md"
                   />
                   <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                   <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold text-primary">Or Upload File...</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Login Options</h3>
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">Enable Google Login</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Show Google login button on the auth screen.</p>
                </div>
                <input 
                    type="checkbox" 
                    id="googleLoginEnabled" 
                    checked={features?.googleLogin?.enabled !== false}
                    onChange={e => setFeatures(prev => ({ ...prev, googleLogin: { enabled: e.target.checked } }))}
                    className="h-6 w-6 rounded text-primary focus:ring-primary"
                />
            </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  };

// --- Main Panel ---
interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'analysis' | 'users' | 'posts' | 'appData'>('analysis');
    const [users, setUsers] = useState<AppUser[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [userFilter, setUserFilter] = useState('all');
    const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

    useEffect(() => {
        const usersRef = ref(db, 'users');
        const postsRef = ref(db, 'posts');
        
        const usersListener = onValue(usersRef, snap => {
            const data: AppUser[] = [];
            if(snap.exists()) snap.forEach(child => data.push({ ...child.val() }));
            setUsers(data);
            setLoading(false);
        });

        const postsListener = onValue(postsRef, snap => {
            const data: Post[] = [];
            if(snap.exists()) snap.forEach(child => data.push({ id: child.key!, ...child.val() }));
            setPosts(data);
        });

        return () => {
            off(usersRef, 'value', usersListener);
            off(postsRef, 'value', postsListener);
        }
    }, []);
    
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const matchesSearch = user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (user.handle && user.handle.toLowerCase().includes(searchTerm.toLowerCase()));
            if (!matchesSearch) return false;

            switch(userFilter) {
                case 'online': return user.status === 'online';
                case 'offline': return user.status !== 'online';
                case 'premium': return user.isPremium;
                case 'banned': return user.isBanned;
                case 'admins': return user.role === 'admin';
                default: return true;
            }
        });
    }, [users, searchTerm, userFilter]);

    const renderContent = () => {
        if (loading) return <p className="text-center p-8">Loading data...</p>

        switch(activeTab) {
            case 'analysis':
                const onlineUsers = users.filter(u => u.status === 'online').length;
                return (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <StatCard title="Total Users" value={users.length} icon={<UsersIcon className="w-6 h-6"/>} />
                        <StatCard title="Total Posts" value={posts.length} icon={<FileTextIcon className="w-6 h-6"/>} />
                        <StatCard title="Online Now" value={onlineUsers} icon={<CheckCircleIcon className="w-6 h-6"/>} />
                        <StatCard title="Admins" value={users.filter(u => u.role === 'admin').length} icon={<ShieldIcon className="w-6 h-6"/>} />
                        <StatCard title="Premium Users" value={users.filter(u => u.isPremium).length} icon={<AwardIcon className="w-6 h-6"/>} />
                        <StatCard title="Banned Users" value={users.filter(u => u.isBanned).length} icon={<BanIcon className="w-6 h-6"/>} />
                    </div>
                );
            case 'users':
                return (
                    <div>
                        <div className="flex flex-wrap gap-4 mb-4">
                             <div className="relative flex-1 min-w-[200px]">
                                <input type="text" placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"/>
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
                            </div>
                            <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                                <option value="all">All Users</option>
                                <option value="online">Online</option>
                                <option value="offline">Offline</option>
                                <option value="premium">Premium</option>
                                <option value="banned">Banned</option>
                                <option value="admins">Admins</option>
                            </select>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredUsers.map(user => (
                                    <li key={user.uid} onClick={() => setSelectedUser(user)} className="flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="relative flex-shrink-0">
                                                <Avatar photoURL={user.photoURL} displayName={user.displayName} className="w-10 h-10" />
                                                <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-semibold truncate flex items-center gap-1.5">
                                                    {user.displayName}
                                                    <UserBadges badges={user.badges} />
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-500 truncate font-mono">{user.uid}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                            {user.isPremium && <AwardIcon className="w-5 h-5 text-yellow-500" title="Premium"/>}
                                            {user.isBanned && <BanIcon className="w-5 h-5 text-red-500" title="Banned"/>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
            case 'posts':
                return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg">Post management is under construction.</div>;
            case 'appData':
                return <AppDataSettings />;
            default: return null;
        }
    }
    
    const TabButton: React.FC<{tabId: 'analysis' | 'users' | 'posts' | 'appData', children: React.ReactNode, icon: React.ReactNode}> = ({ tabId, children, icon }) => (
        <button onClick={() => setActiveTab(tabId)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tabId ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {icon} {children}
        </button>
    );

  return (
    <>
    <div className="absolute inset-0 bg-gray-100 dark:bg-gray-900 z-50 flex flex-col">
      <header className="flex-shrink-0 flex items-center p-4 h-16 bg-white/70 dark:bg-black/70 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <button onClick={onClose} className="mr-4 p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 rounded-full">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-semibold">Admin Panel</h2>
      </header>
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <aside className="w-full md:w-56 p-4 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 flex-shrink-0">
            <nav className="flex md:flex-col gap-2">
                <TabButton tabId="analysis" icon={<BarChart2Icon className="w-5 h-5"/>}>Analysis</TabButton>
                <TabButton tabId="users" icon={<UsersIcon className="w-5 h-5"/>}>Users</TabButton>
                <TabButton tabId="posts" icon={<FileTextIcon className="w-5 h-5"/>}>Posts</TabButton>
                <TabButton tabId="appData" icon={<SettingsIcon className="w-5 h-5"/>}>App Data</TabButton>
            </nav>
        </aside>
        <div className="flex-1 p-6 overflow-y-auto">
            {renderContent()}
        </div>
      </main>
    </div>
    {selectedUser && <AdminUserDetailSheet user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </>
  );
};

export default AdminPanel;