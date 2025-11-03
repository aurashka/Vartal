import React, { useState, useRef } from 'react';
import { useAuth } from '../App';
import { db } from '../services/firebase';
import { ref, push, serverTimestamp, update, set } from 'firebase/database';
import { Story, PostImage } from '../types';
import { uploadImage } from '../services/imageUploadService';
import { GlobeIcon, UsersIcon, LockIcon, XIcon, ImageIcon } from './common/Icons';
import Avatar from './common/Avatar';

interface CreateStoryProps {
  onClose: () => void;
  storyToEdit?: Story | null;
}

const CreateStory: React.FC<CreateStoryProps> = ({ onClose, storyToEdit }) => {
    const { appUser, currentUser } = useAuth();
    const isEditMode = !!storyToEdit;

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(storyToEdit?.imageUrl.full || null);
    const [text, setText] = useState(storyToEdit?.text || '');
    const [privacy, setPrivacy] = useState<Story['privacy']>(storyToEdit?.privacy || 'public');
    const [isPosting, setIsPosting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handlePost = async () => {
        if (!currentUser || !appUser || (!imageFile && !storyToEdit)) return;
        setIsPosting(true);

        try {
            let imageUrl: PostImage;
            if (imageFile) {
                const uploaded = await uploadImage(imageFile);
                if (!uploaded) throw new Error("Image upload failed");
                imageUrl = uploaded;
            } else {
                imageUrl = storyToEdit!.imageUrl;
            }

            const storyData = {
                author: storyToEdit?.author || {
                    uid: currentUser.uid,
                    displayName: appUser.displayName,
                    photoURL: appUser.photoURL,
                },
                imageUrl,
                text: text.trim(),
                privacy,
                timestamp: storyToEdit?.timestamp || serverTimestamp(),
                expiresAt: storyToEdit?.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
            };

            if (isEditMode) {
                await set(ref(db, `stories/${storyToEdit.id}`), storyData);
            } else {
                const newStoryRef = push(ref(db, 'stories'));
                await set(newStoryRef, storyData);
            }
            onClose();

        } catch (error) {
            console.error("Error creating/editing story:", error);
            alert("Failed to post story. Please try again.");
        } finally {
            setIsPosting(false);
        }
    };
    
    const isPostButtonDisabled = isPosting || !imagePreview;

    return (
        <div className="fixed inset-0 bg-gray-900 text-white z-50 flex flex-col font-sans animate-fade-in">
             <header className="flex-shrink-0 flex items-center justify-between p-4 h-16">
                <button onClick={onClose} className="p-2 -ml-2"><XIcon className="w-7 h-7"/></button>
                <h1 className="font-bold text-lg">{isEditMode ? 'Edit Story' : 'Create Story'}</h1>
                <button 
                    onClick={handlePost} 
                    disabled={isPostButtonDisabled}
                    className="font-bold text-primary disabled:text-gray-600 transition-colors"
                >
                    {isPosting ? 'Posting...' : 'Post'}
                </button>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden relative">
                {imagePreview ? (
                    <div className="w-full max-w-sm aspect-[9/16] rounded-2xl overflow-hidden relative shadow-2xl shadow-black/50">
                        <img src={imagePreview} alt="Story preview" className="w-full h-full object-cover"/>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                         <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Add a caption..."
                            maxLength={200}
                            className="absolute bottom-4 left-4 right-4 w-auto bg-black/30 text-white p-2 rounded-lg text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur-sm resize-none"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-gray-400">
                        <ImageIcon className="w-24 h-24"/>
                        <h2 className="text-xl font-semibold">Select an image to start</h2>
                        <p>Stories are visual, after all!</p>
                    </div>
                )}
                 <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden"/>
            </main>
            <footer className="p-4 flex-shrink-0 flex items-center justify-between">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 p-2 bg-white/10 rounded-lg text-sm font-semibold">
                    <ImageIcon className="w-5 h-5" /> Change Photo
                </button>
                <div className="relative group">
                    <button className="flex items-center gap-2 p-2 bg-white/10 rounded-lg text-sm font-semibold capitalize">
                        {privacy === 'public' && <GlobeIcon className="w-5 h-5" />}
                        {privacy === 'friends' && <UsersIcon className="w-5 h-5" />}
                        {privacy === 'private' && <LockIcon className="w-5 h-5" />}
                        {privacy}
                    </button>
                    <div className="absolute bottom-full mb-2 right-0 w-36 bg-gray-800 rounded-lg shadow-lg p-1 hidden group-hover:block border border-white/10">
                        <button onClick={() => setPrivacy('public')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 rounded">Public</button>
                        <button onClick={() => setPrivacy('friends')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 rounded">Friends</button>
                        <button onClick={() => setPrivacy('private')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 rounded">Private</button>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default CreateStory;
