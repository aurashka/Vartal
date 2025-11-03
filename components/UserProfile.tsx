import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppUser, PostImage } from '../types';
import { useAuth } from '../App';
import { db } from '../services/firebase';
import { ref, update, get } from 'firebase/database';
import { uploadImage } from '../services/imageUploadService';
import { ChevronLeftIcon, CameraIcon, XIcon } from './common/Icons';
import Avatar from './common/Avatar';
import debounce from 'lodash.debounce';
import { useTheme } from './ThemeContext';

const MaritalStatusSelector: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentStatus: string;
  onSelect: (status: string) => void;
}> = ({ isOpen, onClose, currentStatus, onSelect }) => {
  if (!isOpen) return null;

  const options = ['Single', 'In a Relationship', 'Married', 'Complicated', 'Prefer not to say'];

  const handleSelect = (option: string) => {
    onSelect(option);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-900 w-full rounded-t-2xl p-4 animate-slide-in-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full pb-3 flex justify-center">
          <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        <h2 className="text-xl font-bold text-center mb-4">Marital Status</h2>
        <ul className="space-y-2">
          {options.map(option => (
            <li 
              key={option}
              onClick={() => handleSelect(option)}
              className={`p-4 rounded-lg text-lg text-center font-semibold cursor-pointer transition-colors ${
                currentStatus === option
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {option}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};


const tagColorClasses = [
    'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
    'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
    'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300',
    'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-300',
];
const getTagColor = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return tagColorClasses[Math.abs(hash) % tagColorClasses.length];
};

// Moved outside UserProfile to prevent re-creation on render, which fixes the keyboard closing bug.
const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
        {children}
    </div>
);

const UserProfile: React.FC<{
  user: AppUser;
  onClose: () => void;
}> = ({ user, onClose }) => {
  const { currentUser } = useAuth();
  
  // Form state
  const [displayName, setDisplayName] = useState(user.displayName);
  const [handle, setHandle] = useState(user.handle || '');
  const [bio, setBio] = useState(user.bio || '');
  const [profession, setProfession] = useState(user.profession || '');
  const [maritalStatus, setMaritalStatus] = useState(user.maritalStatus || 'Prefer not to say');
  const [location, setLocation] = useState(user.location || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [tags, setTags] = useState<string[]>(user.tags || []);
  const [tagInput, setTagInput] = useState('');
  
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [newImage, setNewImage] = useState<File | null>(null);
  const initialPhoto = user.photoURL;
  const [preview, setPreview] = useState<string | null>(
      typeof initialPhoto === 'object' && initialPhoto ? initialPhoto.full : typeof initialPhoto === 'string' ? initialPhoto : null
  );
  const [loading, setLoading] = useState(false);
  const [isStatusModalOpen, setStatusModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    [user.handle]
  );
  
  useEffect(() => {
    if (handle) {
      checkHandleAvailability(handle);
    } else {
      setHandleStatus('idle');
    }
    return () => {
        checkHandleAvailability.cancel();
    }
  }, [handle, checkHandleAvailability]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewImage(file);
      setPreview(URL.createObjectURL(file as Blob));
    }
  };
  
  const handleSave = async () => {
    if (!currentUser || (handleStatus !== 'idle' && handleStatus !== 'available')) {
        alert("Please choose an available handle.");
        return;
    }
    setLoading(true);
    let photoURL: PostImage | string = user.photoURL;

    if (newImage) {
      const uploadedUrl = await uploadImage(newImage);
      if (uploadedUrl) {
        photoURL = uploadedUrl;
      } else {
        alert('Image upload failed. Please try again.');
        setLoading(false);
        return;
      }
    }

    const updates: { [key: string]: any } = {};
    const basePath = `/users/${currentUser.uid}`;
    updates[`${basePath}/displayName`] = displayName;
    updates[`${basePath}/photoURL`] = photoURL;
    updates[`${basePath}/bio`] = bio;
    updates[`${basePath}/profession`] = profession;
    updates[`${basePath}/maritalStatus`] = maritalStatus;
    updates[`${basePath}/location`] = location;
    updates[`${basePath}/phoneNumber`] = phoneNumber;
    updates[`${basePath}/tags`] = tags;

    if (handle !== user.handle) {
        updates[`${basePath}/handle`] = handle;
        if (user.handle) {
            updates[`/handles/${user.handle}`] = null;
        }
        updates[`/handles/${handle}`] = currentUser.uid;
    }
    
    await update(ref(db), updates);
    setLoading(false);
    onClose();
  };
  
  const handleMessage = useMemo(() => {
    let message: string | null = null;
    let className = "text-xs mt-1 h-5 flex items-center"; // Consistent height and alignment

    switch (handleStatus) {
      case 'checking':
        message = 'Checking...';
        className += ' text-yellow-500';
        break;
      case 'available':
        message = `@${handle} is available!`;
        className += ' text-green-500';
        break;
      case 'taken':
        message = `@${handle} is already taken.`;
        className += ' text-red-500';
        break;
      case 'invalid':
        message = 'Invalid handle format.';
        className += ' text-red-500';
        break;
      default:
        // Render empty to hold space, preventing layout shift
        break;
    }

    return <p className={className}>{message}</p>;
  }, [handle, handleStatus]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const newTag = tagInput.trim();
        if (newTag && !tags.includes(newTag) && tags.length < 5) {
            setTags([...tags, newTag]);
        }
        setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <>
    <div className="h-screen w-screen bg-white dark:bg-black flex flex-col">
        <header className="flex-shrink-0 flex items-center justify-between p-4 h-16 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
            <button onClick={onClose} className="p-2 -ml-2"><ChevronLeftIcon className="w-7 h-7"/></button>
            <h1 className="font-bold text-lg">Edit Profile</h1>
            <button 
                onClick={handleSave} 
                disabled={loading || (handleStatus !== 'idle' && handleStatus !== 'available')}
                className="font-bold text-primary disabled:text-gray-400 dark:disabled:text-gray-600 transition-colors"
            >
                {loading ? 'Saving...' : 'Save'}
            </button>
        </header>
        <main className="flex-1 p-4 overflow-y-auto">
            <div className="flex flex-col items-center gap-4 mb-8">
                <div className="relative">
                    <Avatar photoURL={preview || user.photoURL} displayName={displayName} className="w-32 h-32 rounded-full object-cover"/>
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-primary p-2.5 rounded-full text-white hover:bg-primary-hover border-4 border-white dark:border-black">
                        <CameraIcon className="h-5 w-5"/>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                </div>
            </div>
            
            <div className="space-y-4">
                <FormField label="Name">
                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full form-input"/>
                </FormField>
                <FormField label="Handle">
                    <input type="text" value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className="w-full form-input"/>
                    {handleMessage}
                </FormField>
                <FormField label="Bio">
                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={200} className="w-full form-input"/>
                    <p className="text-right text-xs text-gray-400 mt-1">{bio.length} / 200</p>
                </FormField>
                <FormField label="Profession">
                    <input type="text" value={profession} onChange={e => setProfession(e.target.value)} className="w-full form-input"/>
                </FormField>
                 <FormField label="Location">
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full form-input"/>
                </FormField>
                <FormField label="Phone Number">
                    <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full form-input"/>
                </FormField>
                <FormField label="Marital Status">
                    <button type="button" onClick={() => setStatusModalOpen(true)} className="w-full form-input text-left flex justify-between items-center">
                        <span>{maritalStatus}</span>
                        <ChevronLeftIcon className="w-5 h-5 transform rotate-[-90deg] text-gray-400" />
                    </button>
                </FormField>
                <FormField label="Tags">
                   <div className={`w-full form-input flex flex-wrap items-center gap-2 !border-solid !border-b !border-gray-600 ${tags.length < 5 ? 'focus-within:!border-primary focus-within:!border-b-2' : ''}`}>
                        {tags.map((tag, index) => (
                            <div key={index} className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium ${getTagColor(tag)}`}>
                                {tag}
                                <button onClick={() => removeTag(tag)} className="focus:outline-none">
                                    <XIcon className="w-3 h-3"/>
                                </button>
                            </div>
                        ))}
                         {tags.length < 5 && (
                            <input 
                                type="text"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                                placeholder={tags.length === 0 ? "tech, travel, foodie" : ""}
                                className="flex-1 bg-transparent focus:outline-none min-w-[100px] py-1"
                            />
                         )}
                   </div>
                    <p className="text-xs text-gray-400 mt-1">
                        {tags.length < 5 
                            ? `Press Enter or comma to add a tag. (${5 - tags.length} remaining)` 
                            : "You can add a maximum of 5 tags."}
                    </p>
                </FormField>
            </div>
        </main>
        <style>{`
            .form-input {
                background-color: transparent;
                border: none;
                border-bottom: 1px solid #4a4a4a;
                border-radius: 0;
                padding: 8px 0;
                font-size: 1rem;
                color: inherit;
                width: 100%;
            }
            .form-input:focus {
                outline: none;
                border-bottom: 2px solid hsl(var(--color-primary-hue) var(--color-primary-saturation) var(--color-primary-lightness));
                box-shadow: none;
                margin-bottom: -1px;
            }
        `}</style>
    </div>
    <MaritalStatusSelector 
        isOpen={isStatusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        currentStatus={maritalStatus}
        onSelect={setMaritalStatus}
    />
    </>
  );
};

export default UserProfile;