import React, { useState, useEffect, useRef } from 'react';
import { Post, AppUser, UserChat } from '../types';
import { useAuth } from '../App';
import { db } from '../services/firebase';
import { ref, runTransaction, get, update, push, serverTimestamp, set } from 'firebase/database';
import Avatar from './common/Avatar';
import { HeartIcon, MessageSquareIcon, SendIcon, BookmarkIcon, MoreHorizontalIcon, ChevronLeftIcon, GlobeIcon, XIcon, UsersIcon, LockIcon, TrashIcon, PencilIcon, ShareIcon, ForwardIcon } from './common/Icons';
import ProgressiveImage from './common/ProgressiveImage';
import UserBadges from './common/UserBadges';
import Modal from './common/Modal';
import CreatePost from './CreatePost';

const ExpandIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
);

const FullImageModal: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => (
    <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
    >
        <button className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-white/20 transition-colors">
            <XIcon className="w-8 h-8"/>
        </button>
        <img 
            src={src} 
            alt="Full view" 
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking image
        />
    </div>
);

const ForwardPostModal: React.FC<{ 
    userChats: UserChat[];
    onForward: (chatId: string, recipient: AppUser) => void;
    onClose: () => void;
}> = ({ userChats, onForward, onClose }) => (
    <Modal title="Forward post to..." onClose={onClose}>
        <ul className="max-h-64 overflow-y-auto">
            {userChats.length > 0 ? userChats.map(chat => (
                <li key={chat.chatId} onClick={() => onForward(chat.chatId, chat.userInfo)} className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
                    <Avatar photoURL={chat.userInfo.photoURL} displayName={chat.userInfo.displayName} className="w-10 h-10 mr-3"/>
                    <span>{chat.userInfo.displayName}</span>
                </li>
            )) : <p className="text-center text-gray-500">You have no active chats to forward to.</p>}
        </ul>
    </Modal>
);


const PostCard: React.FC<{ 
    post: Post; 
    onNavigateToDetail?: () => void;
    onViewProfile: (user: AppUser) => void;
}> = ({ post, onNavigateToDetail, onViewProfile }) => {
    const { currentUser, appUser } = useAuth();
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [likersData, setLikersData] = useState<AppUser[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [imageDimensions, setImageDimensions] = useState<Record<number, { width: number; height: number }>>({});
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [userChats, setUserChats] = useState<UserChat[]>([]);
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    const [mentionedUsers, setMentionedUsers] = useState<AppUser[]>([]);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentUser && post.likedBy) {
            setIsLiked(!!post.likedBy[currentUser.uid]);
        } else {
            setIsLiked(false);
        }
        setLikeCount(post.likedBy ? Object.keys(post.likedBy).length : 0);
    }, [post.likedBy, currentUser]);
    
    useEffect(() => {
        if (appUser?.bookmarkedPosts && post.id) {
            setIsBookmarked(!!appUser.bookmarkedPosts[post.id]);
        }
    }, [appUser?.bookmarkedPosts, post.id]);

    useEffect(() => {
        const fetchLikers = async () => {
            if (post.likedBy) {
                const likerUids = Object.keys(post.likedBy).slice(0, 3);
                if (likerUids.length > 0) {
                    const userPromises = likerUids.map(uid => get(ref(db, `users/${uid}`)));
                    const userSnapshots = await Promise.all(userPromises);
                    const users = userSnapshots.map(snap => snap.val()).filter(Boolean);
                    setLikersData(users);
                } else {
                    setLikersData([]);
                }
            } else {
                setLikersData([]);
            }
        };
        fetchLikers();
    }, [post.likedBy]);
    
     useEffect(() => {
        const fetchMentionedUsers = async () => {
            if (post.mentions && post.mentions.length > 0) {
                const userPromises = post.mentions.map(uid => get(ref(db, `users/${uid}`)));
                const userSnapshots = await Promise.all(userPromises);
                const users = userSnapshots
                    .map(snap => snap.exists() ? { uid: snap.key, ...snap.val() } as AppUser : null)
                    .filter((u): u is AppUser => u !== null);
                setMentionedUsers(users);
            } else {
                setMentionedUsers([]);
            }
        };
        fetchMentionedUsers();
    }, [post.mentions]);

    useEffect(() => {
        if (post.imageUrls) {
            const newDimensions: Record<number, { width: number; height: number }> = {};
            let loadedCount = 0;
            post.imageUrls.forEach((url, index) => {
                const img = new Image();
                img.src = url.full;
                img.onload = () => {
                    newDimensions[index] = { width: img.naturalWidth, height: img.naturalHeight };
                    loadedCount++;
                    if (loadedCount === post.imageUrls!.length) {
                        setImageDimensions(newDimensions);
                    }
                };
            });
        }
    }, [post.imageUrls]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setShowMenu(false);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAuthorClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onViewProfile) return;
        
        try {
            const userRef = ref(db, `users/${post.author.uid}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                onViewProfile({ uid: post.author.uid, ...snapshot.val() } as AppUser);
            } else {
                console.warn(`User with uid ${post.author.uid} not found.`);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    };

    const handleLike = () => {
        if (!currentUser || !appUser) return;
        
        const currentlyLiked = isLiked;

        // Optimistic UI update
        setIsLiked(!currentlyLiked);
        setLikeCount(prev => currentlyLiked ? prev - 1 : prev + 1);

        // Trigger animation only when liking
        if (!currentlyLiked) {
            setShowHeartAnimation(true);
            // Reset after animation duration
            setTimeout(() => setShowHeartAnimation(false), 1200);
        }
        
        const postLikesRef = ref(db, `posts/${post.id}/likedBy/${currentUser.uid}`);
        runTransaction(postLikesRef, (currentData) => {
            if (currentData === null) {
                // User is liking the post, create notification
                if (post.author.uid !== currentUser.uid) {
                    const notificationRef = push(ref(db, `notifications/${post.author.uid}`));
                    set(notificationRef, {
                        type: 'like',
                        fromUid: currentUser.uid,
                        fromName: appUser.displayName,
                        fromPhotoURL: appUser.photoURL,
                        postId: post.id,
                        postImageThumb: post.imageUrls?.[0]?.thumb || post.gifUrl,
                        timestamp: serverTimestamp(),
                        read: false,
                    });
                }
                return true;
            } else {
                // User is unliking, no notification needed, just remove the like
                return null;
            }
        }).catch((error) => {
            console.error("Like transaction failed:", error);
            // Revert optimistic update on failure
            setIsLiked(currentlyLiked);
            setLikeCount(prev => currentlyLiked ? prev + 1 : prev - 1);
        });
    };
    
    const handleBookmark = () => {
        if (!currentUser) return;
        setShowMenu(false);
        const bookmarkRef = ref(db, `users/${currentUser.uid}/bookmarkedPosts/${post.id}`);
        runTransaction(bookmarkRef, (currentData) => {
            if (currentData === null) {
                setIsBookmarked(true);
                return true;
            } else {
                setIsBookmarked(false);
                return null;
            }
        });
    };

    const hasMultipleImages = post.imageUrls && post.imageUrls.length > 1;

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!post.imageUrls) return;
        setCurrentImageIndex(prev => (prev + 1) % post.imageUrls!.length);
    }
    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!post.imageUrls) return;
        setCurrentImageIndex(prev => (prev - 1 + post.imageUrls!.length) % post.imageUrls!.length);
    }
    
    const renderTextWithMentions = (text: string) => {
        if (!text) return null;
        if (mentionedUsers.length === 0) return <span>{text}</span>;

        const mentionRegex = /@([a-zA-Z0-9_]+)/g;
        // The regex split will have `text`, `handle`, `text`, `handle`...
        const parts = text.split(mentionRegex);

        return parts.map((part, index) => {
            if (index % 2 === 1) { // This part is a handle
                const handle = part;
                const user = mentionedUsers.find(u => u.handle === handle);
                if (user) {
                    return (
                        <strong 
                            key={index} 
                            className="text-primary font-semibold cursor-pointer hover:underline"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewProfile(user);
                            }}
                        >
                            @{handle}
                        </strong>
                    );
                }
                return `@${part}`; // Handle found in text but not in mentions list
            }
            return part; // This is regular text
        });
    };


    const mediaContent = () => {
        const animationHeart = showHeartAnimation && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <HeartIcon
                    className="w-24 h-24 text-white animate-float-heart drop-shadow-lg"
                    isFilled={true}
                />
            </div>
        );

        if (post.gifUrl) {
            return (
                <div className="relative" onDoubleClick={handleLike}>
                    <img src={post.gifUrl} alt="post gif" className="w-full object-cover" />
                    {animationHeart}
                </div>
            );
        }
        if (post.imageUrls && post.imageUrls.length > 0) {
            const isCurrentImagePortrait = imageDimensions[currentImageIndex] && imageDimensions[currentImageIndex].height > imageDimensions[currentImageIndex].width;
            return (
                <div 
                    className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-900"
                    onDoubleClick={handleLike}
                >
                    <div 
                        className="flex h-full transition-transform duration-500 ease-in-out" 
                        style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                    >
                        {post.imageUrls.map((url, index) => (
                            <div key={index} className="w-full h-full flex-shrink-0">
                                <ProgressiveImage
                                    src={url.full}
                                    placeholderSrc={url.thumb}
                                    alt={`post content ${index + 1}`}
                                    imageClassName="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>

                    {hasMultipleImages && (
                        <>
                            <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1 hover:bg-black/60 transition-colors">
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                             <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1 hover:bg-black/60 transition-colors">
                                <ChevronLeftIcon className="w-5 h-5 transform rotate-180" />
                            </button>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                {post.imageUrls.map((_, index) => (
                                    <div key={index} className={`w-2 h-2 rounded-full transition-colors ${index === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}></div>
                                ))}
                            </div>
                        </>
                    )}
                     {isCurrentImagePortrait && (
                        <button 
                            onClick={() => setViewingImage(post.imageUrls![currentImageIndex].full)}
                            className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors flex items-center gap-1.5"
                        >
                            <ExpandIcon className="w-3 h-3" />
                            View full
                        </button>
                    )}
                    {animationHeart}
                </div>
            )
        }
        return null;
    }

    // --- Options Menu Logic ---
    const isOwnPost = currentUser?.uid === post.author.uid;
    
    const openDeleteConfirm = () => {
        setShowMenu(false);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        try {
            const updates: { [key: string]: null } = {};
            updates[`/posts/${post.id}`] = null;
            updates[`/comments/${post.id}`] = null;
            // In a production app, a Cloud Function should handle cleaning up likes, bookmarks from user objects, etc.
            await update(ref(db), updates);
        } catch (error) {
            console.error("Failed to delete post:", error);
            alert("Could not delete post.");
        }
        setShowDeleteConfirm(false);
    };

    const handleEdit = () => {
        setShowMenu(false);
        setShowEditModal(true);
    };

    const handleUpdatePrivacy = async (newPrivacy: Post['privacy']) => {
        await update(ref(db, `posts/${post.id}`), { privacy: newPrivacy });
        setShowMenu(false);
    };

    const handleOpenForwardModal = async () => {
        setShowMenu(false);
        if (!currentUser) return;
        const userChatsRef = ref(db, `userChats/${currentUser.uid}`);
        const snapshot = await get(userChatsRef);
        if (snapshot.exists()) {
            setUserChats(Object.values(snapshot.val()));
        } else {
            setUserChats([]);
        }
        setShowForwardModal(true);
    };

    const handleForwardPost = async (selectedChatId: string, recipientInfo: AppUser) => {
        if (!currentUser || !appUser) return;
        const messageText = `Forwarded Post: ${post.text || 'Image/GIF'}`;
        const lastMessage = {
            text: messageText,
            timestamp: Date.now()
        };
    
        const imageUrls = post.imageUrls?.map(img => img.full) || (post.gifUrl ? [post.gifUrl] : undefined);
    
        const messageData: any = {
            senderId: currentUser.uid,
            text: post.text,
            timestamp: serverTimestamp(),
            isForwarded: true,
        };
        
        if (imageUrls) {
            messageData.imageUrls = imageUrls;
        }
    
        const newMessageRef = push(ref(db, `messages/${selectedChatId}`));
        await set(newMessageRef, messageData);
    
        const updates: { [key:string]: any } = {};
        updates[`/userChats/${currentUser.uid}/${selectedChatId}/lastMessage`] = lastMessage;
        updates[`/userChats/${recipientInfo.uid}/${selectedChatId}/lastMessage`] = lastMessage;
        await update(ref(db), updates);
    
        setShowForwardModal(false);
        alert(`Post forwarded to ${recipientInfo.displayName}`);
    };

    const handleShare = async () => {
        setShowMenu(false);
        if (!navigator.share) {
            alert("Sharing is not supported on your browser.");
            return;
        }

        const appName = "Firebase React Chat App";
        
        const shareData: ShareData = {
            title: `Post by ${post.author.displayName} on ${appName}`,
            text: post.text,
        };

        const mediaUrl = post.imageUrls?.[0]?.full || post.gifUrl;
        if (mediaUrl) {
            shareData.url = mediaUrl;
            shareData.text = `${post.author.displayName} posted on ${appName}: ${post.text}`;
        } else {
            shareData.url = window.location.href;
            shareData.text = `${post.author.displayName} posted on ${appName}: ${post.text}`;
        }
        
        try {
            await navigator.share(shareData);
        } catch (err) {
            console.error('Error sharing post:', err);
        }
    };

    const MenuItem: React.FC<{
        icon: React.ReactNode;
        children: React.ReactNode;
        onClick: () => void;
        className?: string;
    }> = ({ icon, children, onClick, className }) => (
        <li
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer ${className || ''}`}
        >
            {icon}
            <span>{children}</span>
        </li>
    );


    return (
        <>
            <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between p-3">
                    <div onClick={handleAuthorClick} className="flex items-center gap-3 cursor-pointer">
                        <Avatar 
                            photoURL={post.author.photoURL} 
                            displayName={post.author.displayName} 
                            className="w-9 h-9" 
                        />
                        <div>
                            <div className="flex items-center gap-1.5">
                               <span className="font-semibold text-sm">{post.author.displayName}</span>
                               <UserBadges badges={post.author.badges} />
                            </div>
                             <p className="text-xs text-gray-500 flex items-center gap-1">
                                <GlobeIcon className="w-3 h-3"/> {post.privacy}
                             </p>
                        </div>
                    </div>
                     <div className="relative">
                        <button onClick={() => setShowMenu(v => !v)}><MoreHorizontalIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" /></button>
                        {showMenu && (
                            <div ref={menuRef} className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-2xl z-20 p-2 border border-black/5 dark:border-white/5">
                                <ul>
                                    {isOwnPost && (
                                        <>
                                            <MenuItem icon={<PencilIcon className="w-5 h-5"/>} onClick={handleEdit}>Edit Post</MenuItem>
                                            <div className="relative group">
                                                <MenuItem icon={<GlobeIcon className="w-5 h-5"/>} onClick={() => {}}>Change Privacy</MenuItem>
                                                <div className="absolute bottom-0 right-full mr-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-1 hidden group-hover:block border border-black/5 dark:border-white/5">
                                                    <MenuItem icon={<GlobeIcon className="w-4 h-4"/>} onClick={() => handleUpdatePrivacy('public')}>Public</MenuItem>
                                                    <MenuItem icon={<UsersIcon className="w-4 h-4"/>} onClick={() => handleUpdatePrivacy('friends')}>Friends</MenuItem>
                                                    <MenuItem icon={<LockIcon className="w-4 h-4"/>} onClick={() => handleUpdatePrivacy('private')}>Private</MenuItem>
                                                </div>
                                            </div>
                                            <div className="my-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                        </>
                                    )}
                                    <MenuItem icon={<ForwardIcon className="w-5 h-5"/>} onClick={handleOpenForwardModal}>Forward to Chat</MenuItem>
                                    {navigator.share && (
                                        <MenuItem icon={<ShareIcon className="w-5 h-5"/>} onClick={handleShare}>Share Externally</MenuItem>
                                    )}
                                    <MenuItem icon={<BookmarkIcon className="w-5 h-5" isFilled={isBookmarked}/>} onClick={handleBookmark}>
                                        {isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
                                    </MenuItem>
                                    {isOwnPost && (
                                        <>
                                            <div className="my-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                            <MenuItem icon={<TrashIcon className="w-5 h-5"/>} onClick={openDeleteConfirm} className="text-red-500 hover:!bg-red-500/10">Delete Post</MenuItem>
                                        </>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
                
                {mediaContent()}
                
                <div className="p-3">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-4">
                            <button onClick={handleLike}>
                                <HeartIcon className={`w-7 h-7 cursor-pointer transition-all duration-300 transform active:scale-125 ${isLiked ? 'text-red-500' : 'text-gray-800 dark:text-gray-200 hover:text-gray-500'}`} isFilled={isLiked} />
                            </button>
                            <button onClick={onNavigateToDetail} disabled={post.commentSettings === 'disabled'}>
                                <MessageSquareIcon className={`w-7 h-7 cursor-pointer text-gray-800 dark:text-gray-200 -scale-x-100 ${post.commentSettings === 'disabled' ? 'opacity-50' : ''}`} />
                            </button>
                            <button onClick={handleOpenForwardModal}><SendIcon className="w-7 h-7 cursor-pointer text-gray-800 dark:text-gray-200" /></button>
                        </div>
                        <button onClick={handleBookmark}>
                            <BookmarkIcon className="w-7 h-7 cursor-pointer text-gray-800 dark:text-gray-200" isFilled={isBookmarked} />
                        </button>
                    </div>
                    {likeCount > 0 && (
                        <div className="flex items-center mb-2">
                            <div className="flex -space-x-2">
                                {likersData.map(user => (
                                    <Avatar key={user.uid} photoURL={user.photoURL} displayName={user.displayName} className="w-5 h-5 rounded-full border-2 border-white dark:border-black" />
                                ))}
                                {likeCount > likersData.length && (
                                    <div className="w-5 h-5 rounded-full border-2 border-white dark:border-black bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                        <span className="text-xs font-semibold">+{likeCount - likersData.length}</span>
                                    </div>
                                )}
                            </div>
                            <p className="font-semibold text-sm ml-2">{likeCount} {likeCount === 1 ? 'Like' : 'Likes'}</p>
                        </div>
                    )}
                    
                    <p className="text-sm mt-1 text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        <span onClick={handleAuthorClick} className="font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                            {post.author.displayName}
                            <UserBadges badges={post.author.badges} />
                        </span>
                        <span className="ml-1">{renderTextWithMentions(post.text)}</span>
                    </p>
                    {mentionedUsers.length > 0 && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-500">With:</span>
                            {mentionedUsers.map(user => (
                                <div key={user.uid} onClick={(e) => { e.stopPropagation(); onViewProfile(user); }} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700">
                                    <Avatar photoURL={user.photoURL} displayName={user.displayName} className="w-5 h-5" />
                                    <span className="text-sm font-semibold">{user.displayName}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(post.timestamp).toLocaleDateString()}
                    </p>
                </div>
            </div>
            {viewingImage && <FullImageModal src={viewingImage} onClose={() => setViewingImage(null)} />}
            {showEditModal && <CreatePost postToEdit={post} onClose={() => setShowEditModal(false)} />}
            {showForwardModal && <ForwardPostModal userChats={userChats} onForward={handleForwardPost} onClose={() => setShowForwardModal(false)} />}
            {showDeleteConfirm && (
                <Modal title="Confirm Deletion" onClose={() => setShowDeleteConfirm(false)}>
                    <div className="p-4 text-center">
                        <p className="text-lg text-gray-800 dark:text-gray-200">Are you sure you want to delete this post?</p>
                        <p className="text-sm text-gray-500 mt-2">This action is permanent and cannot be undone.</p>
                        <div className="flex justify-center gap-4 mt-6">
                            <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default PostCard;