import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { BookmarkIcon, GridIcon, PlusIcon, PlusCircleIcon, MessageCircleIcon, ChevronLeftIcon, ChevronDownIcon, MenuIcon, MapPinIcon, ClockIcon, CheckCircleIcon, HeartIcon } from './common/Icons';
import Avatar from './common/Avatar';
import { Post, AppUser, Story, Highlight } from '../types';
import { db, auth } from '../services/firebase';
import { ref, get, query, orderByChild, equalTo, onValue, off, update, set, push, serverTimestamp } from 'firebase/database';
import ProgressiveImage from './common/ProgressiveImage';
import UserBadges from './common/UserBadges';
import { BentoGridSkeleton, Skeleton } from './common/Shimmer';
import Modal from './common/Modal';
import { timeAgo } from '../utils/time';

const HighlightReel: React.FC<{
    highlights: Highlight[];
    onView: (highlight: Highlight) => void;
}> = ({ highlights, onView }) => {
    if (highlights.length === 0) return null;
    return (
        <div className="space-y-3">
            <h2 className="font-bold text-lg">Story Highlights</h2>
            <div className="flex space-x-4 overflow-x-auto pb-2 -mx-4 px-4">
                {highlights.map((highlight) => (
                    <div key={highlight.id} onClick={() => onView(highlight)} className="flex-shrink-0 text-center w-20 cursor-pointer group">
                        <div className="relative w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-gray-400 to-gray-600">
                             <ProgressiveImage 
                                src={highlight.coverStoryImageUrl.full}
                                placeholderSrc={highlight.coverStoryImageUrl.thumb}
                                alt={highlight.title}
                                className="w-full h-full rounded-full"
                                imageClassName="w-full h-full object-cover rounded-full border-2 border-white dark:border-black group-hover:scale-105 transition-transform"
                             />
                        </div>
                        <p className="text-xs mt-1.5 truncate text-gray-800 dark:text-gray-200 font-semibold">
                           {highlight.title}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};


interface ProfilePageProps {
    user?: AppUser;
    onBack?: () => void;
    onSelectPost?: (post: Post) => void;
    onOpenDrawer?: () => void;
    onEditProfile?: () => void;
    onStartChat?: (user: AppUser) => void;
    onViewArchivedStories?: (user: AppUser, stories: Story[], startIndex: number) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onBack, onSelectPost, onOpenDrawer, onEditProfile, onStartChat, onViewArchivedStories }) => {
    const { appUser: loggedInUser, following: loggedInUserFollowing } = useAuth();
    const [activeTab, setActiveTab] = useState<'posts' | 'stories' | 'saved'>('posts');
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [bookmarkedPosts, setBookmarkedPosts] = useState<Post[]>([]);
    const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);
    const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
    const [userAllStories, setUserAllStories] = useState<Story[]>([]);
    const [isLoadingStories, setIsLoadingStories] = useState(true);
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [isLoadingHighlights, setIsLoadingHighlights] = useState(true);
    const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
    const [rememberedAccounts, setRememberedAccounts] = useState<any[]>([]);
    const switcherRef = useRef<HTMLDivElement>(null);


    // Live state
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowedByProfileUser, setIsFollowedByProfileUser] = useState(false);

    const profileUser = user || loggedInUser;
    const isOwnProfile = !user || (loggedInUser && user.uid === loggedInUser.uid);
    const isFollowingProfileUser = !!(loggedInUserFollowing && profileUser && loggedInUserFollowing[profileUser.uid]);

    useEffect(() => {
        if (isOwnProfile) {
            const rememberedAccountsStr = localStorage.getItem('remembered_accounts');
            if (rememberedAccountsStr) {
                setRememberedAccounts(JSON.parse(rememberedAccountsStr));
            }
        }
    }, [isOwnProfile]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
                setShowAccountSwitcher(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Listener for live follower/following counts and relationships
    useEffect(() => {
        if (!profileUser) return;

        const followersRef = ref(db, `followers/${profileUser.uid}`);
        const followersListener = onValue(followersRef, (snapshot) => {
            setFollowersCount(snapshot.exists() ? snapshot.size : 0);
        });

        const followingRef = ref(db, `following/${profileUser.uid}`);
        const followingListener = onValue(followingRef, (snapshot) => {
            setFollowingCount(snapshot.exists() ? snapshot.size : 0);
        });
        
        let followedByListener: any;
        let followedByRef: any;
        if (loggedInUser && !isOwnProfile) {
            followedByRef = ref(db, `following/${profileUser.uid}/${loggedInUser.uid}`);
            followedByListener = onValue(followedByRef, (snapshot) => {
                setIsFollowedByProfileUser(snapshot.exists());
            });
        }

        return () => {
            off(followersRef, 'value', followersListener);
            off(followingRef, 'value', followingListener);
            if (followedByListener && followedByRef) {
                off(followedByRef, 'value', followedByListener);
            }
        };
    }, [profileUser, loggedInUser, isOwnProfile]);


    useEffect(() => {
        if (!profileUser) return;

        // Fetch Posts
        setIsLoadingPosts(true);
        const postsRef = ref(db, 'posts');
        const userPostsQuery = query(postsRef, orderByChild('author/uid'), equalTo(profileUser.uid));
        const postListener = onValue(userPostsQuery, (snapshot) => {
            const postsData: Post[] = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    postsData.push({ id: childSnapshot.key as string, ...childSnapshot.val() });
                });
                setUserPosts(postsData.sort((a, b) => b.timestamp - a.timestamp));
            } else {
                setUserPosts([]);
            }
            setIsLoadingPosts(false);
        });

        // Fetch Stories
        setIsLoadingStories(true);
        const storiesQuery = query(ref(db, 'stories'), orderByChild('author/uid'), equalTo(profileUser.uid));
        const storyListener = onValue(storiesQuery, (snapshot) => {
            const storiesData: Story[] = [];
            if(snapshot.exists()){
                snapshot.forEach(child => {
                    storiesData.push({ id: child.key!, ...child.val() });
                });
            }
            setUserAllStories(storiesData.sort((a,b) => b.timestamp - a.timestamp));
            setIsLoadingStories(false);
        });

        // Fetch Highlights
        setIsLoadingHighlights(true);
        const highlightsRef = ref(db, `highlights/${profileUser.uid}`);
        const highlightListener = onValue(highlightsRef, (snapshot) => {
            const highlightsData: Highlight[] = [];
            if(snapshot.exists()){
                snapshot.forEach(child => {
                    highlightsData.push({ id: child.key!, ...child.val() });
                });
            }
            setHighlights(highlightsData);
            setIsLoadingHighlights(false);
        });


        return () => {
             off(userPostsQuery, 'value', postListener);
             off(storiesQuery, 'value', storyListener);
             off(highlightsRef, 'value', highlightListener);
        }
    }, [profileUser]);

    useEffect(() => {
        if (isOwnProfile && activeTab === 'saved' && profileUser?.bookmarkedPosts) {
            setIsLoadingBookmarks(true);
            const postIds = Object.keys(profileUser.bookmarkedPosts);
            if (postIds.length === 0) {
                setBookmarkedPosts([]);
                setIsLoadingBookmarks(false);
                return;
            }
            const postPromises = postIds.map(id => get(ref(db, `posts/${id}`)));
            Promise.all(postPromises)
                .then(snapshots => {
                    const posts = snapshots
                        .map((snap, index) => snap.exists() ? { id: postIds[index], ...snap.val() } : null)
                        .filter((p): p is Post => p !== null && p.author);
                    setBookmarkedPosts(posts.reverse());
                })
                .finally(() => setIsLoadingBookmarks(false));
        }
    }, [activeTab, profileUser, isOwnProfile]);
    
    if (!profileUser) return null;

    const handleAddAccount = () => {
        if (!loggedInUser) return;

        const rememberedAccountsStr = localStorage.getItem('remembered_accounts');
        let rememberedAccounts: any[] = rememberedAccountsStr ? JSON.parse(rememberedAccountsStr) : [];
        
        rememberedAccounts = rememberedAccounts.filter(acc => acc.uid !== loggedInUser.uid);
        
        rememberedAccounts.unshift({
            uid: loggedInUser.uid,
            displayName: loggedInUser.displayName,
            photoURL: loggedInUser.photoURL,
            email: loggedInUser.email,
        });
        
        rememberedAccounts = rememberedAccounts.slice(0, 5);

        localStorage.setItem('remembered_accounts', JSON.stringify(rememberedAccounts));
        
        sessionStorage.setItem('skipRememberedAccounts', 'true');
        auth.signOut();
    };

    const handleSwitchAccount = (email: string) => {
        sessionStorage.setItem('switch_to_account', email);
        handleAddAccount();
    };

    const handleFollowToggle = async () => {
        if (!loggedInUser || !profileUser || isOwnProfile) return;
        
        if (isFollowingProfileUser) {
            setShowUnfollowConfirm(true);
            return;
        }
    
        // Follow logic
        const updates: { [key: string]: any } = {};
        updates[`/following/${loggedInUser.uid}/${profileUser.uid}`] = true;
        updates[`/followers/${profileUser.uid}/${loggedInUser.uid}`] = true;
        await update(ref(db), updates);

        // Add notification
        const notificationRef = push(ref(db, `notifications/${profileUser.uid}`));
        set(notificationRef, {
            type: 'follow',
            fromUid: loggedInUser.uid,
            fromName: loggedInUser.displayName,
            fromPhotoURL: loggedInUser.photoURL,
            timestamp: serverTimestamp(),
            read: false,
        });
    };

    const confirmUnfollow = async () => {
        if (!loggedInUser || !profileUser) return;
        const updates: { [key: string]: any } = {};
        updates[`/following/${loggedInUser.uid}/${profileUser.uid}`] = null;
        updates[`/followers/${profileUser.uid}/${loggedInUser.uid}`] = null;
        await update(ref(db), updates);
        setShowUnfollowConfirm(false);
    };
    
    const handleViewHighlight = async (highlight: Highlight) => {
        const storyIds = Object.keys(highlight.storyIds);
        const storyPromises = storyIds.map(id => get(ref(db, `stories/${id}`)));
        const storySnapshots = await Promise.all(storyPromises);
        const stories = storySnapshots
            .map(snap => snap.exists() ? { id: snap.key!, ...snap.val() } : null)
            .filter((s): s is Story => s !== null)
            .sort((a, b) => a.timestamp - b.timestamp); // show in chronological order
        
        if (stories.length > 0 && onViewArchivedStories) {
            onViewArchivedStories(profileUser, stories, 0);
        }
    };

    const postCount = userPosts.length;
    
    const StatItem: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
        <div className="text-center">
            <p className="font-bold text-xl">{value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
    );
    
    const renderUserPosts = () => {
        if (isLoadingPosts) {
            return <BentoGridSkeleton />;
        }
        if (userPosts.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                    <GridIcon className="w-16 h-16 mb-4"/>
                    <h2 className="text-xl font-bold">No Posts Yet</h2>
                    <p className="text-sm mt-2 text-center">Your posts will appear here.</p>
                </div>
            );
        }
        
        // This pattern repeats every 5 posts: 1 large, 4 small
        const bentoPatternClasses = (index: number) => {
             const patternIndex = index % 5;
             if (patternIndex === 0) return 'col-span-2 row-span-2';
             return 'col-span-1 row-span-1';
        };

        return (
            <div className="grid grid-cols-3 auto-rows-[30vw] md:auto-rows-[15vw] gap-1">
                {userPosts.map((post, index) => (
                     <div 
                        key={post.id} 
                        className={`overflow-hidden rounded-lg cursor-pointer bg-gray-200 dark:bg-gray-800 transition-transform hover:scale-105 ${bentoPatternClasses(index)}`} 
                        onClick={() => onSelectPost?.(post)}
                     >
                        {post.imageUrls && post.imageUrls[0] ? (
                             <ProgressiveImage 
                                src={post.imageUrls[0].full}
                                placeholderSrc={post.imageUrls[0].thumb}
                                alt="user post"
                                imageClassName="w-full h-full object-cover"
                             />
                        ) : post.gifUrl ? (
                            <img src={post.gifUrl} alt="user post gif" className="w-full h-full object-cover"/>
                        ) : <div className="p-2 text-sm truncate">{post.text}</div>}
                    </div>
                ))}
            </div>
        );
    }
    
    const renderUserStories = () => {
        if (isLoadingStories) {
            return <BentoGridSkeleton />;
        }
        if (userAllStories.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                    <ClockIcon className="w-16 h-16 mb-4"/>
                    <h2 className="text-xl font-bold">No Stories Yet</h2>
                    <p className="text-sm mt-2 text-center">Your archived stories will appear here.</p>
                </div>
            );
        }
        return (
            <div className="grid grid-cols-3 gap-1">
                {userAllStories.map((story, index) => (
                    <div 
                        key={story.id} 
                        className="aspect-square bg-gray-200 dark:bg-gray-800 cursor-pointer" 
                        onClick={() => onViewArchivedStories?.(profileUser, userAllStories, index)}>
                        <ProgressiveImage 
                            src={story.imageUrl.full}
                            placeholderSrc={story.imageUrl.thumb}
                            alt="archived story"
                            imageClassName="w-full h-full object-cover"
                        />
                    </div>
                ))}
            </div>
        );
    }
    
    const renderSavedPosts = () => {
        if (isLoadingBookmarks) {
            return <BentoGridSkeleton />;
        }
        if (bookmarkedPosts.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                    <BookmarkIcon className="w-16 h-16 mb-4"/>
                    <h2 className="text-xl font-bold">Saved</h2>
                    <p className="text-sm mt-2 text-center">Your saved posts will appear here.</p>
                </div>
            )
        }
        return (
             <div className="grid grid-cols-3 gap-1">
                {bookmarkedPosts.map((post) => (
                    <div key={post.id} className="aspect-square bg-gray-200 dark:bg-gray-800 cursor-pointer" onClick={() => onSelectPost?.(post)}>
                        {post.imageUrls && post.imageUrls[0] ? (
                             <ProgressiveImage 
                                src={post.imageUrls[0].full}
                                placeholderSrc={post.imageUrls[0].thumb}
                                alt="bookmarked post"
                                imageClassName="w-full h-full object-cover"
                             />
                        ) : post.gifUrl ? (
                            <img src={post.gifUrl} alt="bookmarked gif" className="w-full h-full object-cover"/>
                        ) : <div className="p-2 text-sm truncate">{post.text}</div>}
                    </div>
                ))}
            </div>
        )
    }

    const renderActionButtons = () => {
        if (isOwnProfile) {
            return (
                <button 
                    onClick={onEditProfile} 
                    className="flex-1 py-2.5 text-sm font-semibold bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                    Edit profile
                </button>
            );
        }

        let followButtonText = 'Follow';
        let followButtonClass = 'bg-primary text-white';
        if (isFollowingProfileUser) {
            followButtonText = 'Following';
            followButtonClass = 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
        } else if (isFollowedByProfileUser) {
            followButtonText = 'Follow Back';
        }

        const canSendMessage = () => {
            if (!loggedInUser || !profileUser) return false;
            const messageSetting = profileUser.messageSettings || 'everyone';
            if (messageSetting === 'following') {
                return !!(loggedInUserFollowing && loggedInUserFollowing[profileUser.uid]);
            }
            return true;
        };

        return (
             <>
                <button onClick={handleFollowToggle} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${followButtonClass}`}>
                    {followButtonText}
                </button>
                <button 
                    onClick={() => onStartChat && onStartChat(profileUser)} 
                    disabled={!canSendMessage()}
                    className="flex-1 py-2.5 text-sm font-semibold bg-gray-200 dark:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Message
                </button>
            </>
        );
    };

    return (
        <>
            <div className="bg-white dark:bg-black h-full flex flex-col">
                <header className="flex-shrink-0 sticky top-0 z-20 flex items-center justify-between p-4 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-500/20">
                    <div className="flex-1">
                        {onBack && (
                            <button onClick={onBack} className="p-2 -ml-2">
                                <ChevronLeftIcon className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                     <div className="relative" ref={switcherRef}>
                        {isOwnProfile ? (
                            <button onClick={() => setShowAccountSwitcher(prev => !prev)} className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                    <h1 className="text-xl font-bold">{profileUser.displayName}</h1>
                                    <UserBadges badges={profileUser.badges} />
                                </div>
                                <ChevronDownIcon className={`w-5 h-5 transition-transform ${showAccountSwitcher ? 'rotate-180' : ''}`} />
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-xl font-bold">{profileUser.displayName}</h1>
                                <UserBadges badges={profileUser.badges} />
                            </div>
                        )}
                        {isOwnProfile && showAccountSwitcher && (
                            <div className="absolute top-full mt-2 w-64 -translate-x-1/2 left-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl z-30 p-2 border border-black/5 dark:border-white/5 animate-fade-in">
                                <ul className="max-h-60 overflow-y-auto">
                                    {rememberedAccounts.map(acc => (
                                        <li key={acc.uid}>
                                            <button 
                                                onClick={() => {
                                                    if (acc.uid === loggedInUser?.uid) return;
                                                    handleSwitchAccount(acc.email);
                                                }}
                                                className="w-full flex items-center justify-between p-2 text-left hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar photoURL={acc.photoURL} displayName={acc.displayName} className="w-10 h-10" />
                                                    <span className="font-semibold">{acc.displayName}</span>
                                                </div>
                                                {acc.uid === loggedInUser?.uid && <CheckCircleIcon className="w-6 h-6 text-primary"/>}
                                            </button>
                                        </li>
                                    ))}
                                    <div className="my-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                    <li onClick={handleAddAccount} className="flex items-center gap-3 p-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer">
                                        <PlusCircleIcon className="w-6 h-6 text-primary"/>
                                        <span className="font-semibold">Add Account</span>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 flex justify-end items-center gap-2">
                        {isOwnProfile && (
                            <button onClick={onOpenDrawer} className="p-2"><MenuIcon className="w-6 h-6"/></button>
                        )}
                    </div>
                </header>
                <div className="overflow-y-auto">
                    <div className="p-4 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="relative flex-shrink-0">
                                <Avatar photoURL={profileUser.photoURL} displayName={profileUser.displayName} className="w-24 h-24" />
                                {isOwnProfile && (
                                    <button onClick={onEditProfile} className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center border-4 border-white dark:border-black">
                                        <PlusIcon className="w-5 h-5"/>
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 grid grid-cols-3">
                                <StatItem value={postCount} label="Posts" />
                                <StatItem value={followersCount} label="Followers" />
                                <StatItem value={followingCount} label="Following" />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="font-bold text-2xl">{profileUser.displayName}</h1>
                                <UserBadges badges={profileUser.badges} />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">@{profileUser.handle}</p>
                            
                            {profileUser.bio && <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 whitespace-pre-wrap">{profileUser.bio}</p>}
                            
                            <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400 mt-3">
                                {profileUser.maritalStatus && profileUser.maritalStatus !== 'Prefer not to say' && <p>{profileUser.maritalStatus}</p>}
                                {profileUser.location && <p className="flex items-center gap-1.5"><MapPinIcon className="w-4 h-4" />{profileUser.location}</p>}
                            </div>
                            
                            {profileUser.tags && profileUser.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {profileUser.tags.map(tag => (
                                        <span key={tag} className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                           {renderActionButtons()}
                        </div>
                        
                        {isLoadingHighlights ? (
                            <Skeleton className="h-32 w-full rounded-lg" />
                        ) : (
                             <HighlightReel highlights={highlights} onView={handleViewHighlight} />
                        )}

                    </div>

                    <div className="border-y border-gray-200 dark:border-gray-800">
                        <div className={`grid ${isOwnProfile ? 'grid-cols-3' : 'grid-cols-2'} text-center text-gray-500 dark:text-gray-400`}>
                            <button onClick={() => setActiveTab('posts')} className={`py-3 relative ${activeTab === 'posts' ? 'text-primary' : ''}`}>
                                <GridIcon className="w-6 h-6 mx-auto"/>
                                {activeTab === 'posts' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>}
                            </button>
                             <button onClick={() => setActiveTab('stories')} className={`py-3 relative ${activeTab === 'stories' ? 'text-primary' : ''}`}>
                                <ClockIcon className="w-6 h-6 mx-auto"/>
                                {activeTab === 'stories' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>}
                            </button>
                            {isOwnProfile && (
                                <button onClick={() => setActiveTab('saved')} className={`py-3 relative ${activeTab === 'saved' ? 'text-primary' : ''}`}>
                                    <BookmarkIcon className="w-6 h-6 mx-auto" isFilled={activeTab === 'saved'} />
                                    {activeTab === 'saved' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-1">
                        {activeTab === 'posts' && renderUserPosts()}
                        {activeTab === 'stories' && renderUserStories()}
                        {isOwnProfile && activeTab === 'saved' && renderSavedPosts()}
                    </div>
                </div>
            </div>
            {showUnfollowConfirm && profileUser && (
                <Modal title={`Unfollow @${profileUser.handle}?`} onClose={() => setShowUnfollowConfirm(false)}>
                    <div className="p-4 text-center">
                        <Avatar photoURL={profileUser.photoURL} displayName={profileUser.displayName} className="w-20 h-20 mx-auto mb-4"/>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Their posts will no longer appear in your feed.</p>
                         <div className="flex justify-center gap-4 mt-6">
                             <button 
                                onClick={() => setShowUnfollowConfirm(false)}
                                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmUnfollow}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                            >
                                Unfollow
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default ProfilePage;