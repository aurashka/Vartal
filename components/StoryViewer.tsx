
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Story, AppUser, Highlight } from '../types';
import { MoreVerticalIcon, PencilIcon, TrashIcon, GlobeIcon, UsersIcon, LockIcon, ChevronLeftIcon, HeartIcon, PlaylistPlusIcon } from './common/Icons';
import Avatar from './common/Avatar';
import Modal from './common/Modal';
import { db } from '../services/firebase';
import { ref, remove, update, runTransaction, get, set, onValue, off } from 'firebase/database';
import { useAuth } from '../App';
import { formatStoryTimestamp } from '../utils/time';
import AddToHighlightModal from './AddToHighlightModal';

interface StoryViewerProps {
    groupedStories: { [userId: string]: Story[] };
    authorInfos: { [userId: string]: Pick<AppUser, 'uid' | 'displayName' | 'photoURL'> };
    storyUserIds: string[];
    startIndex: number;
    storyStartIndex?: number;
    onClose: () => void;
    onEdit: (story: Story) => void;
    onStartChat: (user: AppUser) => void;
    onViewProfile: (user: AppUser) => void;
}

const ProgressBar: React.FC<{ isActive: boolean; isViewed: boolean }> = ({ isActive, isViewed }) => {
    const [startAnimation, setStartAnimation] = useState(false);

    useEffect(() => {
        // Reset animation trigger when switching stories
        setStartAnimation(false);

        if (isActive) {
            // Use a short timeout to ensure the CSS transition applies after the component renders
            const timeoutId = setTimeout(() => {
                setStartAnimation(true);
            }, 10);
            return () => clearTimeout(timeoutId);
        }
    }, [isActive]);

    const width = isViewed ? '100%' : (isActive && startAnimation ? '100%' : '0%');
    const transition = isActive && startAnimation ? 'width 5s linear' : 'none';

    return (
        <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div
                className="h-full bg-white"
                style={{ width, transition }}
            ></div>
        </div>
    );
};

const HeartsOverlay: React.FC = () => (
    <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-float-heart" style={{ animationDelay: `${i * 0.15}s`, right: `${10 + Math.random() * 80}%` }}>
                <HeartIcon className="w-8 h-8 text-white" isFilled={true} />
            </div>
        ))}
    </div>
);


const StoryViewer: React.FC<StoryViewerProps> = ({ groupedStories, authorInfos, storyUserIds, startIndex, storyStartIndex = 0, onClose, onEdit, onStartChat, onViewProfile }) => {
    const { currentUser, following } = useAuth();
    const [currentUserIndex, setCurrentUserIndex] = useState(startIndex);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(storyStartIndex);
    const [isPaused, setIsPaused] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [likers, setLikers] = useState<AppUser[]>([]);
    const [showHearts, setShowHearts] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [showLikersModal, setShowLikersModal] = useState(false);
    const [showAddToHighlight, setShowAddToHighlight] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [userHighlights, setUserHighlights] = useState<Highlight[]>([]);
    const [loadingHighlights, setLoadingHighlights] = useState(true);

    const activeUserId = storyUserIds[currentUserIndex];
    const activeStories = groupedStories[activeUserId];
    const activeStory = activeStories?.[currentStoryIndex];
    const authorInfo = authorInfos[activeUserId];

    const isOwnStory = activeStory?.author.uid === currentUser?.uid;

    useEffect(() => {
        if (isOwnStory && currentUser) {
            setLoadingHighlights(true);
            const highlightsRef = ref(db, `highlights/${currentUser.uid}`);
            const listener = onValue(highlightsRef, (snapshot) => {
                const data: Highlight[] = [];
                if (snapshot.exists()) {
                    snapshot.forEach(child => {
                        data.push({ id: child.key!, ...child.val() });
                    });
                }
                setUserHighlights(data);
                setLoadingHighlights(false);
            });
            return () => off(highlightsRef, 'value', listener);
        } else {
            setUserHighlights([]);
            setLoadingHighlights(false);
        }
    }, [isOwnStory, currentUser]);

    const highlightContainingStory = useMemo(() => {
        if (!activeStory || loadingHighlights) return null;
        return userHighlights.find(h => h.storyIds && h.storyIds[activeStory.id]) || null;
    }, [activeStory, userHighlights, loadingHighlights]);

    useEffect(() => {
        if (activeStory) {
            setImageLoading(true);
            const img = new Image();
            img.src = activeStory.imageUrl.full;
            img.onload = () => {
                setImageLoading(false);
            };
        }
    }, [activeStory]);
    
    useEffect(() => {
        if (currentUser && activeStory?.likedBy) {
            setIsLiked(!!activeStory.likedBy[currentUser.uid]);
        } else {
            setIsLiked(false);
        }
    }, [activeStory, currentUser]);
    
    // Track story views
    useEffect(() => {
        if (currentUser && activeStory && !isOwnStory && !activeStory.viewedBy?.[currentUser.uid]) {
            const storyViewRef = ref(db, `stories/${activeStory.id}/viewedBy/${currentUser.uid}`);
            runTransaction(storyViewRef, () => true);
        }
    }, [activeStory, currentUser, isOwnStory]);

    // Fetch likers for own story
    useEffect(() => {
        const fetchLikers = async () => {
            if (isOwnStory && activeStory?.likedBy) {
                const likerUids = Object.keys(activeStory.likedBy);
                if (likerUids.length > 0) {
                    const userPromises = likerUids.map(uid => get(ref(db, `users/${uid}`)));
                    const userSnapshots = await Promise.all(userPromises);
                    const users = userSnapshots.map(snap => snap.exists() ? { uid: snap.key, ...snap.val() } : null).filter((u): u is AppUser => u !== null);
                    setLikers(users);
                } else {
                    setLikers([]);
                }
            } else {
                setLikers([]);
            }
        };
        fetchLikers();
    }, [isOwnStory, activeStory]);

    const nextUser = () => {
        if (currentUserIndex < storyUserIds.length - 1) {
            setCurrentUserIndex(prev => prev + 1);
            setCurrentStoryIndex(0);
        } else {
            onClose();
        }
    };

    const nextStory = () => {
        if (currentStoryIndex < activeStories.length - 1) {
            setCurrentStoryIndex(prev => prev + 1);
        } else {
            nextUser();
        }
    };
    
    const prevUser = () => {
         if (currentUserIndex > 0) {
            const newIndex = currentUserIndex - 1;
            const prevUserStories = groupedStories[storyUserIds[newIndex]];
            setCurrentUserIndex(newIndex);
            setCurrentStoryIndex(prevUserStories.length - 1);
        }
    };

    const prevStory = () => {
        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(prev => prev - 1);
        } else {
            prevUser();
        }
    };

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (isPaused || !activeStory || imageLoading) return;
        timerRef.current = setTimeout(nextStory, 5000);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [currentStoryIndex, currentUserIndex, isPaused, activeStory, imageLoading]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setShowMenu(false);
            setIsPaused(false);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!activeStory || !authorInfo) {
        return null;
    }
    
    const handlePointerDown = () => {
        if (showMenu) return;
        pressTimerRef.current = setTimeout(() => {
            setIsPaused(true);
            pressTimerRef.current = null;
        }, 200);
    };

    const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a')) {
            if (pressTimerRef.current) {
                clearTimeout(pressTimerRef.current);
                pressTimerRef.current = null;
            } else {
                setIsPaused(false);
            }
            return;
        }

        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
            const screenWidth = window.innerWidth;
            const clickX = 'clientX' in e ? e.clientX : e.changedTouches[0].clientX;
            if (clickX < screenWidth / 2) {
                prevStory();
            } else {
                nextStory();
            }
        } else {
            setIsPaused(false);
        }
    };
    
    const handleMenuToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(v => !v);
        setIsPaused(p => !p);
    };

    const handleDelete = async () => {
        if (!isOwnStory) return;
        if (window.confirm("Are you sure you want to delete this story?")) {
            await remove(ref(db, `stories/${activeStory.id}`));
            onClose();
        }
    };

    const handleUpdatePrivacy = async (privacy: Story['privacy']) => {
        if (!isOwnStory) return;
        await update(ref(db, `stories/${activeStory.id}`), { privacy });
        setShowMenu(false);
        setIsPaused(false);
    };

    const handleLike = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser || !activeStory) return;

        setIsLiked(currentIsLiked => {
            const newLikedState = !currentIsLiked;
            if (newLikedState) {
                setShowHearts(true);
                setTimeout(() => setShowHearts(false), 2500);
            }
            return newLikedState;
        });
        
        const storyLikesRef = ref(db, `stories/${activeStory.id}/likedBy/${currentUser.uid}`);
        runTransaction(storyLikesRef, (currentData) => {
            return currentData === null ? true : null;
        });
    };

    const handleReplyClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onStartChat(authorInfo as AppUser);
        onClose();
    };

    const handleViewAuthorProfile = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!authorInfo) return;
        
        const userRef = ref(db, `users/${authorInfo.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            const fullUser = { uid: snapshot.key, ...snapshot.val() } as AppUser;
            onViewProfile(fullUser);
            onClose();
        } else {
            console.error("Could not fetch user profile for story author.");
        }
    };

    const handleFollowToggle = async (targetUser: AppUser) => {
        if (!currentUser) return;
        const isCurrentlyFollowing = !!following?.[targetUser.uid];
        const updates: { [key: string]: any } = {};
        
        if (isCurrentlyFollowing) {
            updates[`/following/${currentUser.uid}/${targetUser.uid}`] = null;
            updates[`/followers/${targetUser.uid}/${targetUser.uid}`] = null;
        } else {
            updates[`/following/${currentUser.uid}/${targetUser.uid}`] = true;
            updates[`/followers/${targetUser.uid}/${currentUser.uid}`] = true;
        }
        await update(ref(db), updates);
    };
    
    const handleRemoveFromHighlight = async () => {
        if (!currentUser || !highlightContainingStory || !activeStory) return;
    
        const storyIdToRemove = activeStory.id;
        const highlightId = highlightContainingStory.id;
        const highlightRef = ref(db, `highlights/${currentUser.uid}/${highlightId}`);
    
        // 1. Remove story ID from highlight
        const storyInHighlightRef = ref(db, `highlights/${currentUser.uid}/${highlightId}/storyIds/${storyIdToRemove}`);
        await set(storyInHighlightRef, null);
    
        // 2. Get updated highlight data
        const snapshot = await get(highlightRef);
    
        if (snapshot.exists()) {
            const updatedHighlight: Highlight = { id: snapshot.key, ...snapshot.val() };
            const remainingStoryIds = updatedHighlight.storyIds ? Object.keys(updatedHighlight.storyIds) : [];
    
            if (remainingStoryIds.length === 0) {
                // 3a. If no stories left, delete the highlight
                await set(highlightRef, null);
            } else {
                // 3b. If stories remain, check if the cover image was the one removed
                if (updatedHighlight.coverStoryImageUrl.full === activeStory.imageUrl.full) {
                    const storyPromises = remainingStoryIds.map(id => get(ref(db, `stories/${id}`)));
                    const storySnapshots = await Promise.all(storyPromises);
                    const remainingStories = storySnapshots
                        .map(snap => snap.exists() ? { id: snap.key!, ...snap.val() } as Story : null)
                        .filter((s): s is Story => s !== null)
                        .sort((a, b) => b.timestamp - a.timestamp);
    
                    if (remainingStories.length > 0) {
                        await update(highlightRef, { coverStoryImageUrl: remainingStories[0].imageUrl });
                    } else {
                        // Fallback: if somehow no stories are found, delete highlight
                        await set(highlightRef, null);
                    }
                }
            }
        }
    
        setShowMenu(false);
        setIsPaused(false);
    };

    return (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center font-sans select-none" onMouseDown={handlePointerDown} onMouseUp={handlePointerUp} onTouchStart={handlePointerDown} onTouchEnd={handlePointerUp}>
            <div key={activeStory.id} className="absolute inset-0 w-full h-full animate-fade-in">
                <img src={activeStory.imageUrl.thumb} alt="Story background" className="w-full h-full object-cover filter blur-md scale-105" />
                <img src={activeStory.imageUrl.full} alt="Story" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`} />
                {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-8 h-8 border-4 border-white/50 border-t-white rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {showHearts && <HeartsOverlay />}

            {/* Arrow Buttons */}
            <button
                onClick={(e) => { e.stopPropagation(); prevStory(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 text-white p-2 rounded-full hover:bg-black/50 transition-colors z-10"
                aria-label="Previous story"
            >
                <ChevronLeftIcon className="w-6 h-6" />
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); nextStory(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white p-2 rounded-full hover:bg-black/50 transition-colors z-10"
                aria-label="Next story"
            >
                <ChevronLeftIcon className="w-6 h-6 transform rotate-180" />
            </button>


            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
            
            <div className="relative w-full h-full max-w-sm max-h-[95vh] aspect-[9/16] flex flex-col justify-between text-white">
                {/* Top Section: Progress bars and Header */}
                <div className="p-3">
                    {/* Progress Bars */}
                    <div className="flex items-center gap-1">
                        {activeStories.map((_, index) => (
                           <ProgressBar 
                                key={`${activeUserId}-${index}`}
                                isActive={index === currentStoryIndex && !isPaused && !imageLoading}
                                isViewed={index < currentStoryIndex}
                            />
                        ))}
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between mt-3">
                        <button onClick={handleViewAuthorProfile} className="flex items-center gap-3 text-left">
                            <Avatar photoURL={authorInfo.photoURL} displayName={authorInfo.displayName} className="w-10 h-10"/>
                            <div>
                                <span className="font-semibold truncate block max-w-[150px]">{authorInfo.displayName}</span>
                                <span className="text-xs text-gray-300">{formatStoryTimestamp(activeStory.timestamp)}</span>
                            </div>
                        </button>
                        <div className="flex items-center">
                            {isOwnStory && (
                                <div className="relative">
                                    <button onClick={handleMenuToggle} className="p-2"><MoreVerticalIcon className="w-6 h-6"/></button>
                                    {showMenu && (
                                        <div ref={menuRef} onClick={e => e.stopPropagation()} className="absolute top-full right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-2xl z-20 p-2 border border-white/10 text-white">
                                            <ul>
                                                {highlightContainingStory ? (
                                                    <li onClick={handleRemoveFromHighlight} className="flex items-center gap-3 p-2 text-sm hover:bg-white/10 rounded cursor-pointer text-red-400"><TrashIcon className="w-4 h-4"/> Remove from Highlight</li>
                                                ) : (
                                                    <li onClick={() => {setShowAddToHighlight(true); setShowMenu(false);}} className="flex items-center gap-3 p-2 text-sm hover:bg-white/10 rounded cursor-pointer"><PlaylistPlusIcon className="w-4 h-4"/> Add to Highlight</li>
                                                )}
                                                <li onClick={() => onEdit(activeStory)} className="flex items-center gap-3 p-2 text-sm hover:bg-white/10 rounded cursor-pointer"><PencilIcon className="w-4 h-4"/> Edit Story</li>
                                                <li className="relative group/privacy">
                                                    <div className="flex items-center gap-3 p-2 text-sm hover:bg-white/10 rounded cursor-pointer"><GlobeIcon className="w-4 h-4"/> Change Privacy</div>
                                                    <div className="absolute bottom-0 right-full mr-2 w-40 bg-gray-800 rounded-lg shadow-lg p-1 hidden group-hover/privacy:block border border-white/10">
                                                        <li onClick={() => handleUpdatePrivacy('public')} className="flex items-center gap-2 p-2 text-sm hover:bg-white/10 rounded"><GlobeIcon className="w-4 h-4"/> Public</li>
                                                        <li onClick={() => handleUpdatePrivacy('friends')} className="flex items-center gap-2 p-2 text-sm hover:bg-white/10 rounded"><UsersIcon className="w-4 h-4"/> Friends</li>
                                                        <li onClick={() => handleUpdatePrivacy('private')} className="flex items-center gap-2 p-2 text-sm hover:bg-white/10 rounded"><LockIcon className="w-4 h-4"/> Private</li>
                                                    </div>
                                                </li>
                                                <div className="my-1 h-px bg-white/20"></div>
                                                <li onClick={handleDelete} className="text-red-400 flex items-center gap-3 p-2 text-sm hover:bg-red-500/20 rounded cursor-pointer"><TrashIcon className="w-4 h-4"/> Delete Story</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Caption and Footer */}
                <div className="p-3">
                    {activeStory.text && (
                        <div className="text-center mb-4">
                            <p className="bg-black/40 backdrop-blur-sm p-2 rounded-lg inline-block">{activeStory.text}</p>
                        </div>
                    )}
                    
                    {isOwnStory ? (
                        <div className="flex items-center justify-between bg-black/40 backdrop-blur-sm p-2 rounded-lg">
                            <div>
                                <p className="text-xs font-semibold text-gray-300">Views</p>
                                <p className="text-xl font-bold">{Object.keys(activeStory.viewedBy || {}).length}</p>
                            </div>
                             <div className="text-right">
                                <button onClick={() => setShowLikersModal(true)} className="text-left">
                                    <p className="text-xs font-semibold text-gray-300">Likes ({likers.length})</p>
                                    {likers.length > 0 ? (
                                        <div className="flex -space-x-2 mt-1 justify-end">
                                            {likers.slice(0, 5).map(user => (
                                                <Avatar key={user.uid} photoURL={user.photoURL} displayName={user.displayName} className="w-7 h-7 rounded-full border border-black"/>
                                            ))}
                                            {likers.length > 5 && (
                                                <div className="w-7 h-7 rounded-full border border-black bg-gray-600 flex items-center justify-center text-xs font-bold">
                                                    +{likers.length - 5}
                                                </div>
                                            )}
                                        </div>
                                    ) : <div className="h-7"></div>}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleReplyClick}
                                className="flex-1 bg-black/40 backdrop-blur-sm rounded-full px-4 py-3 text-gray-200 text-left cursor-pointer hover:bg-black/60 transition-colors"
                            >
                                Reply
                            </button>
                            <button onClick={handleLike} className="p-2">
                                <HeartIcon className={`w-8 h-8 transition-colors ${isLiked ? 'text-red-500' : 'text-white'}`} isFilled={isLiked} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {showLikersModal && (
            <Modal title="Liked by" onClose={() => setShowLikersModal(false)} position="bottom">
                <ul className="max-h-[60vh] overflow-y-auto space-y-2">
                    {likers.map(liker => {
                        const isFollowingLiker = !!following?.[liker.uid];
                        const isSelf = liker.uid === currentUser?.uid;
                        return (
                            <li key={liker.uid} className="flex items-center justify-between p-2">
                                <div className="flex items-center gap-3">
                                    <Avatar photoURL={liker.photoURL} displayName={liker.displayName} className="w-10 h-10" />
                                    <div>
                                        <p className="font-semibold">{liker.displayName}</p>
                                        {liker.handle && <p className="text-xs text-gray-400">@{liker.handle}</p>}
                                    </div>
                                </div>
                                {!isSelf && (
                                    <button
                                        onClick={() => handleFollowToggle(liker)}
                                        className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                                            isFollowingLiker
                                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                                : 'bg-primary text-white'
                                        }`}
                                    >
                                        {isFollowingLiker ? 'Following' : 'Follow'}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                     {likers.length === 0 && <p className="text-center text-gray-500 py-4">No likes yet.</p>}
                </ul>
            </Modal>
        )}
        {isOwnStory && showAddToHighlight && activeStory && (
            <AddToHighlightModal story={activeStory} onClose={() => setShowAddToHighlight(false)} />
        )}
        </div>
    );
};

export default StoryViewer;
