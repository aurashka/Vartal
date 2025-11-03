import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { db } from '../services/firebase';
// FIX: Imported the 'set' function from firebase/database to resolve errors on lines 191 and 200.
import { ref, push, serverTimestamp, update, get, set } from 'firebase/database';
import { Post, PostImage, AppUser } from '../types';
import { uploadMultipleImages } from '../services/imageUploadService';
import { AtSignIcon, ChevronLeftIcon, GlobeIcon, ImageIcon, LockIcon, MessageCircleIcon, UsersIcon, XIcon, GifIcon } from './common/Icons';
import Avatar from './common/Avatar';
import GifPicker from './GifPicker';
import Modal from './common/Modal';

interface CreatePostProps {
  onClose: () => void;
  postToEdit?: Post | null;
}

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

const VerticalLoader = () => (
    <div className="absolute inset-0 bg-black/60 flex items-end justify-center overflow-hidden rounded-lg">
        <div className="w-full bg-white/50" style={{ animation: 'fill-up 1.5s infinite alternate ease-in-out' }}></div>
        <style>{`
            @keyframes fill-up { from { height: 0%; } to { height: 100%; } }
        `}</style>
    </div>
);

const CreatePost: React.FC<CreatePostProps> = ({ onClose, postToEdit }) => {
    const { appUser, currentUser } = useAuth();
    const isEditMode = !!postToEdit;

    const [text, setText] = useState(postToEdit?.text || '');
    const [newImages, setNewImages] = useState<File[]>([]);
    const [existingImages, setExistingImages] = useState<PostImage[]>(postToEdit?.imageUrls || []);
    const [gifUrl, setGifUrl] = useState<string | null>(postToEdit?.gifUrl || null);
    const [privacy, setPrivacy] = useState<Post['privacy']>(postToEdit?.privacy || 'public');
    const [commentSettings, setCommentSettings] = useState<Post['commentSettings']>(postToEdit?.commentSettings || 'public');
    const [isPosting, setIsPosting] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<number, boolean>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Mention state
    const [showMentionModal, setShowMentionModal] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const [mentionedUids, setMentionedUids] = useState<string[]>(postToEdit?.mentions || []);
    const [mentionedUsersData, setMentionedUsersData] = useState<AppUser[]>([]);
    const [allUsers, setAllUsers] = useState<AppUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

     useEffect(() => {
        get(ref(db, 'users')).then(snapshot => {
            if (snapshot.exists()) {
                const usersData: AppUser[] = [];
                snapshot.forEach(child => {
                    if (child.key !== currentUser?.uid) { // Exclude self
                        usersData.push({ uid: child.key!, ...child.val() });
                    }
                });
                setAllUsers(usersData);
            }
            setLoadingUsers(false);
        });
    }, [currentUser]);

    useEffect(() => {
        const fetchMentionedUsersData = () => {
            if (mentionedUids.length > 0) {
                const users = allUsers.filter(u => mentionedUids.includes(u.uid));
                setMentionedUsersData(users);
            } else {
                setMentionedUsersData([]);
            }
        };

        if (!loadingUsers) {
            fetchMentionedUsersData();
        }
    }, [mentionedUids, allUsers, loadingUsers]);


    const updateMentionsFromText = (currentText: string) => {
        const handlesInText = currentText.match(/@([a-zA-Z0-9_]+)/g) || [];
        const uids = handlesInText.map(handleWithAt => {
            const handle = handleWithAt.substring(1);
            const user = allUsers.find(u => u.handle === handle);
            return user ? user.uid : null;
        }).filter((uid): uid is string => uid !== null);
        setMentionedUids([...new Set(uids)]);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);
        updateMentionsFromText(newText);
    };
    
    const handleSelectMention = (user: AppUser) => {
        if (!user.handle) return;
        const newText = `${text} @${user.handle} `.replace('  ', ' ');
        setText(newText);
        updateMentionsFromText(newText);
        setShowMentionModal(false);
        textareaRef.current?.focus();
    };

    const handleRemoveMention = (userToRemove: AppUser) => {
        if (!userToRemove.handle) return;
        const handleToRemove = `@${userToRemove.handle}`;
        const newText = text.replace(new RegExp(handleToRemove + '\\s?', 'g'), '');
        setText(newText);
        updateMentionsFromText(newText);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setNewImages(prev => [...prev, ...filesArray]);
            e.target.value = ''; 
        }
    };
    
    const removeNewImage = (index: number) => {
        setNewImages(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingImage = (index: number) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSelectGif = (url: string) => {
        setGifUrl(url);
        setShowGifPicker(false);
    };

    const handlePost = async () => {
        if (!currentUser || !appUser) return;
        if (!text.trim() && newImages.length === 0 && existingImages.length === 0 && !gifUrl) return;

        setIsPosting(true);
        setUploadProgress({});

        try {
            const onUploadProgress = (index: number) => {
                setUploadProgress(prev => ({ ...prev, [index]: true }));
            };
            const newImageUrls = await uploadMultipleImages(newImages, onUploadProgress);
    
            const finalImageUrls = [...existingImages, ...newImageUrls];

            const postData: any = {
                author: postToEdit?.author || {
                    uid: currentUser.uid,
                    displayName: appUser.displayName,
                    photoURL: appUser.photoURL,
                    badges: appUser.badges || [],
                },
                text: text.trim(),
                timestamp: postToEdit?.timestamp || serverTimestamp(),
                privacy,
                commentSettings,
                mentions: mentionedUids.length > 0 ? mentionedUids : null,
                imageUrls: finalImageUrls.length > 0 ? finalImageUrls : null,
                gifUrl: gifUrl,
            };
            
            if (isEditMode) {
                postData.editedTimestamp = serverTimestamp();
            }

            let postId = postToEdit?.id;
            if (isEditMode) {
                await update(ref(db, `posts/${postToEdit.id}`), postData);
            } else {
                const newPostRef = push(ref(db, 'posts'));
                await set(newPostRef, postData);
                postId = newPostRef.key;
            }

            if (postId) {
                // Handle taggedPosts denormalization
                const oldMentions = isEditMode ? postToEdit.mentions || [] : [];
                const newMentions = mentionedUids;

                // Mentions to remove
                oldMentions.filter(uid => !newMentions.includes(uid)).forEach(uid => {
                    set(ref(db, `taggedPosts/${uid}/${postId}`), null);
                });

                // Mentions to add
                newMentions.filter(uid => !oldMentions.includes(uid)).forEach(uid => {
                    set(ref(db, `taggedPosts/${uid}/${postId}`), true);
                });

                // Send notifications for mentions (only for newly added mentions in edit mode)
                const mentionsToNotify = isEditMode ? newMentions.filter(uid => !oldMentions.includes(uid)) : newMentions;

                mentionsToNotify.forEach(uid => {
                    if (uid !== currentUser.uid) { // Don't notify self
                        const notificationRef = push(ref(db, `notifications/${uid}`));
                        set(notificationRef, {
                            type: 'mention',
                            fromUid: currentUser.uid,
                            fromName: appUser.displayName,
                            fromPhotoURL: appUser.photoURL,
                            postId: postId,
                            postImageThumb: finalImageUrls[0]?.thumb || gifUrl,
                            commentText: text.trim().substring(0, 50), // Snippet of post
                            timestamp: serverTimestamp(),
                            read: false,
                        });
                    }
                });
            }

            onClose();

        } catch (error) {
            console.error("Error creating/editing post:", error);
        } finally {
            setIsPosting(false);
        }
    };

    const filteredMentionUsers = useMemo(() => {
        if (!mentionSearch) return allUsers;
        const lowerCaseSearch = mentionSearch.toLowerCase();
        return allUsers.filter(u => 
            u.displayName.toLowerCase().includes(lowerCaseSearch) ||
            (u.handle && u.handle.toLowerCase().includes(lowerCaseSearch))
        );
    }, [mentionSearch, allUsers]);
    
    const isPostButtonDisabled = isPosting || (!text.trim() && newImages.length === 0 && existingImages.length === 0 && !gifUrl);

    const getCommentSettingText = () => {
        switch (commentSettings) {
            case 'public': return 'Everyone';
            case 'friends': return 'Friends';
            case 'private': return 'Only You';
            case 'disabled': return 'Off';
        }
    };

    const allImagePreviews = [
        ...existingImages.map(img => img.full),
        ...newImages.map(file => URL.createObjectURL(file as Blob))
    ];

    return (
        <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col font-sans animate-fade-in">
             <header className="flex-shrink-0 flex items-center justify-between p-4 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-500/20">
                <button onClick={onClose} className="p-2 -ml-2"><ChevronLeftIcon className="w-7 h-7"/></button>
                <h1 className="font-bold text-lg">{isEditMode ? 'Edit post' : 'New post'}</h1>
                <button 
                    onClick={handlePost} 
                    disabled={isPostButtonDisabled}
                    className="font-bold text-primary disabled:text-gray-400 dark:disabled:text-gray-600 transition-colors"
                >
                    {isPosting ? 'Saving...' : (isEditMode ? 'Save' : 'Post')}
                </button>
            </header>
            <main className="flex-1 p-4 overflow-y-auto">
                <div className="flex items-start gap-4">
                    <Avatar photoURL={appUser?.photoURL} displayName={appUser?.displayName} className="w-12 h-12" />
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={handleTextChange}
                        placeholder="What's happening?"
                        className="w-full h-32 bg-transparent text-lg focus:outline-none resize-none"
                    />
                </div>
                {mentionedUsersData.length > 0 && (
                     <div className="pl-16 mt-2 flex flex-wrap gap-2">
                        {mentionedUsersData.map(user => (
                            <div key={user.uid} className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2 py-1">
                                <Avatar photoURL={user.photoURL} displayName={user.displayName} className="w-5 h-5"/>
                                <span className="text-sm font-semibold">{user.displayName}</span>
                                <button onClick={() => handleRemoveMention(user)}><XIcon className="w-3 h-3"/></button>
                            </div>
                        ))}
                     </div>
                )}
                {(allImagePreviews.length > 0 || gifUrl) && (
                    <div className="mt-4 pl-16">
                        {gifUrl ? (
                             <div className="relative w-full max-w-sm">
                                <img src={gifUrl} className="w-full rounded-lg" alt="selected gif"/>
                                {!isEditMode && <button onClick={() => setGifUrl(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"><XIcon className="w-4 h-4"/></button>}
                            </div>
                        ) : (
                             <div className="flex overflow-x-auto gap-2 pb-2">
                                {existingImages.map((img, index) => (
                                    <div key={img.thumb} className="relative flex-shrink-0 w-32 h-32">
                                        <img src={img.full} className="w-full h-full object-cover rounded-lg" alt={`existing preview ${index}`}/>
                                        <button onClick={() => removeExistingImage(index)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><XIcon className="w-4 h-4"/></button>
                                    </div>
                                ))}
                                {newImages.map((file, index) => (
                                    <div key={file.name + index} className="relative flex-shrink-0 w-32 h-32">
                                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover rounded-lg" alt={`preview ${index}`}/>
                                        {isPosting ? (
                                            uploadProgress[index] ? (
                                                <div className="absolute inset-0 bg-green-900/50 flex items-center justify-center rounded-lg">
                                                    <CheckIcon className="w-8 h-8 text-white" />
                                                </div>
                                            ) : (
                                                <VerticalLoader />
                                            )
                                        ) : (
                                            <button onClick={() => removeNewImage(index)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><XIcon className="w-4 h-4"/></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
            <footer className="p-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-gray-500/20 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-primary">
                        <input type="file" multiple ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden"/>
                        <button onClick={() => fileInputRef.current?.click()} disabled={!!gifUrl || isEditMode} className="disabled:opacity-50"><ImageIcon className="w-7 h-7"/></button>
                        <button onClick={() => setShowGifPicker(true)} disabled={allImagePreviews.length > 0 || isEditMode} className="disabled:opacity-50"><GifIcon className="w-7 h-7"/></button>
                        <button onClick={() => setShowMentionModal(true)}><AtSignIcon className="w-7 h-7"/></button>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <button className="flex items-center gap-1 text-sm font-semibold text-gray-600 dark:text-gray-300">
                                {privacy === 'public' && <GlobeIcon className="w-4 h-4" />}
                                {privacy === 'friends' && <UsersIcon className="w-4 h-4" />}
                                {privacy === 'private' && <LockIcon className="w-4 h-4" />}
                                <span className="capitalize">{privacy}</span>
                            </button>
                            <div className="absolute bottom-full mb-2 right-0 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-1 hidden group-hover:block">
                                <button onClick={() => setPrivacy('public')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded">Public</button>
                                <button onClick={() => setPrivacy('friends')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded">Friends</button>
                                <button onClick={() => setPrivacy('private')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded">Private</button>
                            </div>
                        </div>
                         <div className="relative group">
                            <button className="flex items-center gap-1 text-sm font-semibold text-gray-600 dark:text-gray-300">
                                <MessageCircleIcon className={`w-4 h-4 ${commentSettings === 'disabled' ? 'text-red-500' : ''}`} />
                                <span className="capitalize">{getCommentSettingText()}</span>
                            </button>
                            <div className="absolute bottom-full mb-2 -right-4 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-1 hidden group-hover:block">
                                <button onClick={() => setCommentSettings('public')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded"><GlobeIcon className="w-4 h-4"/> Everyone</button>
                                <button onClick={() => setCommentSettings('friends')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded"><UsersIcon className="w-4 h-4"/> Friends</button>
                                <button onClick={() => setCommentSettings('private')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded"><LockIcon className="w-4 h-4"/> Only You</button>
                                <div className="my-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                <button onClick={() => setCommentSettings('disabled')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded text-red-500">Turn Off</button>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
            {showGifPicker && <GifPicker onClose={() => setShowGifPicker(false)} onSelect={handleSelectGif} />}
            {showMentionModal && (
                <Modal title="Mention a user" onClose={() => setShowMentionModal(false)}>
                    <input
                        type="text"
                        value={mentionSearch}
                        onChange={(e) => setMentionSearch(e.target.value)}
                        placeholder="Search for a user..."
                        className="w-full px-3 py-2 mb-2 bg-gray-100 dark:bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <ul className="max-h-60 overflow-y-auto">
                        {filteredMentionUsers.map(user => (
                            <li key={user.uid} onClick={() => handleSelectMention(user)} className="flex items-center gap-3 p-2 hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer rounded-lg">
                                <Avatar photoURL={user.photoURL} displayName={user.displayName} className="w-8 h-8" />
                                <div>
                                    <p className="font-semibold text-sm">{user.displayName}</p>
                                    <p className="text-xs text-gray-500">@{user.handle}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Modal>
            )}
        </div>
    );
};

export default CreatePost;