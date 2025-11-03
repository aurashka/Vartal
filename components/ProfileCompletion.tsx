import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../App';
import { db } from '../services/firebase';
import { ref, set, get, update } from 'firebase/database';
import { uploadImage } from '../services/imageUploadService';
import Avatar from './common/Avatar';
import { CameraIcon } from './common/Icons';
import debounce from 'lodash.debounce';
import { PostImage } from '../types';

const ProfileCompletion: React.FC = () => {
  const { appUser, currentUser } = useAuth();
  const [fullName, setFullName] = useState(appUser?.displayName || '');
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const initialPhoto = appUser?.photoURL;
  const [imagePreview, setImagePreview] = useState<string | null>(
      typeof initialPhoto === 'object' && initialPhoto ? initialPhoto.full : typeof initialPhoto === 'string' ? initialPhoto : null
  );
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
      if (snapshot.exists()) {
        setHandleStatus('taken');
      } else {
        setHandleStatus('available');
      }
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
      // FIX: Explicitly cast `file` to `Blob` to resolve a potential type inference issue with URL.createObjectURL.
      setImagePreview(URL.createObjectURL(file as Blob));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (handleStatus !== 'available' || !currentUser) return;
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
    
    const finalHandle = handle;

    const updates: { [key: string]: any } = {};
    updates[`/users/${currentUser.uid}/displayName`] = fullName;
    updates[`/users/${currentUser.uid}/photoURL`] = finalPhotoURL;
    updates[`/users/${currentUser.uid}/handle`] = finalHandle;
    updates[`/handles/${finalHandle}`] = currentUser.uid;

    await update(ref(db), updates);
    // The onValue listener in App.tsx will automatically transition to the chat layout.
    setLoading(false);
  };
  
  const getHandleMessage = () => {
    switch (handleStatus) {
      case 'checking': return <p className="text-sm text-yellow-500 mt-1">Checking...</p>;
      case 'available': return <p className="text-sm text-green-500 mt-1">@{handle} is available!</p>;
      case 'taken': return <p className="text-sm text-red-500 mt-1">@{handle} is already taken.</p>;
      case 'invalid': return <p className="text-sm text-red-500 mt-1">Must be 3+ characters, lowercase, and contain only letters, numbers, or underscores.</p>;
      default: return <p className="text-sm text-gray-500 mt-1">Your unique handle for mentions.</p>;
    }
  }

  return (
    <div className="flex items-center justify-center h-full p-4">
      <form onSubmit={handleSave} className="w-full max-w-sm p-8 space-y-6 bg-white/10 dark:bg-black/10 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 dark:border-black/20">
        <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Complete Your Profile</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Just a few more details to get started.</p>
        </div>
        
        <div className="flex flex-col items-center">
            <div className="relative">
                <Avatar photoURL={imagePreview || appUser?.photoURL} displayName={fullName} className="w-28 h-28 text-4xl" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-primary text-white p-2.5 rounded-full border-4 border-white/20 dark:border-black/20 hover:bg-primary-hover">
                    <CameraIcon className="w-5 h-5"/>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden"/>
            </div>
        </div>
        
        <div>
          <label htmlFor="fullName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
          <input
            id="fullName"
            type="text"
            required
            className="mt-1 relative block w-full px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white/20 dark:bg-black/20 border border-transparent rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm"
            placeholder="Your Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="handle" className="text-sm font-medium text-gray-700 dark:text-gray-300">Unique Handle</label>
          <div className="relative mt-1">
             <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">@</span>
             <input
                id="handle"
                type="text"
                required
                className="pl-8 relative block w-full px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white/20 dark:bg-black/20 border border-transparent rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm"
                placeholder="your_handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            />
          </div>
          {getHandleMessage()}
        </div>

        <button
          type="submit"
          disabled={loading || handleStatus !== 'available'}
          className="w-full px-4 py-3 text-md font-semibold text-white bg-primary border border-transparent rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Saving...' : 'Save & Continue'}
        </button>
      </form>
    </div>
  );
};

export default ProfileCompletion;