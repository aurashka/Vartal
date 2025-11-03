import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../App';
import { db } from '../services/firebase';
import { ref, get, update } from 'firebase/database';
import { uploadImage } from '../services/imageUploadService';
import Avatar from './common/Avatar';
import { CameraIcon, ChevronLeftIcon, XIcon } from './common/Icons';
import debounce from 'lodash.debounce';
import { PostImage } from '../types';

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


const FormField: React.FC<{ label: string; children: React.ReactNode, description?: string }> = ({ label, children, description }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        {children}
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
);


const ProgressBar: React.FC<{ currentStep: number, totalSteps: number }> = ({ currentStep, totalSteps }) => (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-8">
        <div 
            className="bg-primary h-1.5 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        ></div>
    </div>
);


const ProfileCompletion: React.FC = () => {
  const { appUser, currentUser } = useAuth();
  
  // Form state
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(appUser?.displayName || '');
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const initialPhoto = appUser?.photoURL;
  const [imagePreview, setImagePreview] = useState<string | null>(
      typeof initialPhoto === 'object' && initialPhoto ? initialPhoto.full : typeof initialPhoto === 'string' ? initialPhoto : null
  );
  
  const [bio, setBio] = useState('');
  const [profession, setProfession] = useState('');
  const [location, setLocation] = useState('');
  
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('Prefer not to say');
  const [isStatusModalOpen, setStatusModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkHandleAvailability = useCallback(
    debounce(async (newHandle: string) => {
      if (!/^[a-z0-9_]{3,}$/.test(newHandle)) {
        setHandleStatus('invalid');
        return;
      }
      setHandleStatus('checking');
      const handleRef = ref(db, `handles/${newHandle}`);
      const snapshot = await get(handleRef);
      setHandleStatus(snapshot.exists() ? 'taken' : 'available');
    }, 500),
    []
  );

  useEffect(() => {
    if (handle) {
      checkHandleAvailability(handle);
    } else {
      setHandleStatus('idle');
    }
  }, [handle, checkHandleAvailability]);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file as Blob));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);

    let finalPhotoURL: PostImage | string = appUser?.photoURL || '';
    if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) {
            finalPhotoURL = uploadedUrl;
        } else {
            alert('Image upload failed. Please try again.');
            setLoading(false);
            return;
        }
    }
    
    const updates: { [key: string]: any } = {};
    updates[`/users/${currentUser.uid}/displayName`] = fullName;
    updates[`/users/${currentUser.uid}/photoURL`] = finalPhotoURL;
    updates[`/users/${currentUser.uid}/handle`] = handle;
    updates[`/handles/${handle}`] = currentUser.uid;
    updates[`/users/${currentUser.uid}/bio`] = bio;
    updates[`/users/${currentUser.uid}/profession`] = profession;
    updates[`/users/${currentUser.uid}/location`] = location;
    updates[`/users/${currentUser.uid}/tags`] = tags;
    updates[`/users/${currentUser.uid}/phoneNumber`] = phoneNumber;
    updates[`/users/${currentUser.uid}/maritalStatus`] = maritalStatus;

    await update(ref(db), updates);
    // The onValue listener in App.tsx will automatically transition to the chat layout.
    setLoading(false);
  };
  
  const getHandleMessage = () => {
    switch (handleStatus) {
      case 'checking': return <p className="text-sm text-yellow-500 mt-1">Checking...</p>;
      case 'available': return <p className="text-sm text-green-500 mt-1">@{handle} is available!</p>;
      case 'taken': return <p className="text-sm text-red-500 mt-1">@{handle} is already taken.</p>;
      case 'invalid': return <p className="text-sm text-red-500 mt-1">Must be 3+ characters, letters, numbers, or _.</p>;
      default: return <p className="text-sm text-gray-500 mt-1">Your unique username.</p>;
    }
  };
  
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
  
  const isStep1Valid = handleStatus === 'available' && fullName.trim() !== '';

  return (
    <>
    <div className="flex items-center justify-center h-full p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-black rounded-3xl shadow-2xl">
        <ProgressBar currentStep={step} totalSteps={3} />
        
        {step === 1 && (
            <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Welcome! Let's get started.</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">First, the basics.</p>
                </div>
                
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <Avatar photoURL={imagePreview || appUser?.photoURL} displayName={fullName} className="w-28 h-28 text-4xl" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-primary text-white p-2.5 rounded-full border-4 border-white dark:border-black hover:bg-primary-hover">
                            <CameraIcon className="w-5 h-5"/>
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden"/>
                    </div>
                </div>
                
                <FormField label="Full Name">
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="form-input"/>
                </FormField>

                <FormField label="Unique Handle">
                  <div className="relative">
                     <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">@</span>
                     <input type="text" required value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className="pl-8 form-input"/>
                  </div>
                  {getHandleMessage()}
                </FormField>
            </div>
        )}
        
        {step === 2 && (
             <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Tell us about yourself</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">This helps others get to know you.</p>
                </div>
                <FormField label="Bio">
                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={200} className="form-input"/>
                    <p className="text-right text-xs text-gray-400 mt-1">{bio.length} / 200</p>
                </FormField>
                <FormField label="Profession">
                    <input type="text" value={profession} onChange={e => setProfession(e.target.value)} className="form-input"/>
                </FormField>
                 <FormField label="Location">
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="form-input"/>
                </FormField>
            </div>
        )}

        {step === 3 && (
            <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Last few details...</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Tags, contact info, and status.</p>
                </div>
                <FormField label="Tags (up to 5)">
                   <div className="form-input flex flex-wrap items-center gap-2">
                        {tags.map((tag) => (
                            <div key={tag} className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium ${getTagColor(tag)}`}>
                                {tag}
                                <button type="button" onClick={() => removeTag(tag)}><XIcon className="w-3 h-3"/></button>
                            </div>
                        ))}
                         {tags.length < 5 && (
                            <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder={tags.length === 0 ? "e.g., tech, travel" : ""} className="flex-1 bg-transparent focus:outline-none min-w-[80px] py-1"/>
                         )}
                   </div>
                </FormField>
                <FormField label="Phone Number (Optional)">
                    <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="form-input"/>
                </FormField>
                <FormField label="Marital Status">
                    <button type="button" onClick={() => setStatusModalOpen(true)} className="w-full form-input text-left flex justify-between items-center">
                        <span>{maritalStatus}</span>
                        <ChevronLeftIcon className="w-5 h-5 transform rotate-[-90deg] text-gray-400" />
                    </button>
                </FormField>
            </div>
        )}

        <div className={`pt-4 flex gap-4 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
            {step > 1 && (
                <button type="button" onClick={() => setStep(s => s - 1)} className="px-6 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:opacity-80 transition-opacity">Back</button>
            )}
            {step < 3 ? (
                <button type="button" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !isStep1Valid} className="px-6 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-all">Next</button>
            ) : (
                <button type="submit" onClick={handleSave} disabled={loading} className="px-6 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-all">
                    {loading ? 'Saving...' : 'Save & Continue'}
                </button>
            )}
        </div>
        <style>{`
            .form-input {
                background-color: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 0.5rem;
                padding: 0.75rem;
                font-size: 1rem;
                color: inherit;
                width: 100%;
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .dark .form-input {
                background-color: #1f2937;
                border-color: #4b5563;
            }
            .form-input:focus {
                outline: none;
                border-color: hsl(var(--color-primary-hue) var(--color-primary-saturation) var(--color-primary-lightness));
                box-shadow: 0 0 0 2px hsl(var(--color-primary-hue) var(--color-primary-saturation) var(--color-primary-lightness) / 0.3);
            }
        `}</style>
      </div>
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

export default ProfileCompletion;
