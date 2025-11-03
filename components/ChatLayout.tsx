import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import { AppUser, Post, Story } from '../types';
import { HomeIcon, SearchIcon, HeartIcon, PlusSquareIcon, ChevronDownIcon, SendIcon, MenuIcon, MicrophoneIcon, MessageSquareIcon, PlusIcon, MoreHorizontalIcon, VerifiedIcon, BellIcon } from './common/Icons';
import { useAuth, useAppData } from '../App';
import Drawer from './Drawer';
import ProfilePage from './ProfilePage';
import AdminPanel from './AdminPanel';
import Avatar from './common/Avatar';
import { db } from '../services/firebase';
import { ref, onValue, off, query, orderByChild, get, equalTo, update, startAt, set, push, serverTimestamp } from 'firebase/database';
import debounce from 'lodash.debounce';
import PostCard from './PostCard';
import CreatePost from './CreatePost';
import { PostCardSkeleton, UserListItemSkeleton, Skeleton } from './common/Shimmer';
import UserBadges from './common/UserBadges';
import ProgressiveImage from './common/ProgressiveImage';
import PostDetailView from './PostDetailView';
import UserProfile from './UserProfile';
import Modal from './common/Modal';
import CreateStory from './CreateStory';
import StoryViewer from './StoryViewer';
import NotificationsPage from './NotificationsPage';
import PrivacySettings from './PrivacySettings';

// Helper functions for Avatar rendering
const getInitials = (name: string | null | undefined) => {
    return name ? name.charAt(0).toUpperCase() : '?';
};
const COLORS = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500'
];
const getColor = (name: string | null | undefined) => {
    if (!name) return 'bg-gray-500';
    const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COLORS[charCodeSum % COLORS.length];
};

const FollowedByInfo: React.FC<{
    suggestedUserId: string;
    myFollowing: { [uid: string]: true } | null;
}> = ({ suggestedUserId, myFollowing }) => {
    const [mutualFollower, setMutualFollower] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const findMutual = async () => {
            if (!myFollowing || Object.keys(myFollowing).length === 0) {
                setLoading(false);
                return;
            }

            try {
                const suggestedUserFollowersRef = ref(db, `followers/${suggestedUserId}`);
                const snapshot = await get(suggestedUserFollowersRef);
                
                if (snapshot.exists()) {
                    const suggestedUserFollowers = snapshot.val();
                    const myFollowingIds = Object.keys(myFollowing);
                    
                    const mutualFollowerId = myFollowingIds.find(id => suggestedUserFollowers[id]);

                    if (mutualFollowerId) {
                        const mutualFollowerRef = ref(db, `users/${mutualFollowerId}`);
                        const mutualSnapshot = await get(mutualFollowerRef);
                        if (mutualSnapshot.exists()) {
                            setMutualFollower(mutualSnapshot.val() as AppUser);
                        }
                    }
                }
            } catch (error) {
                console.error("Error finding mutual follower:", error);
            } finally {
                setLoading(false);
            }
        };

        findMutual();
    }, [suggestedUserId, myFollowing]);
    
    if (loading || !mutualFollower) {
        return null; // Return null to remove empty space when there's no mutual follower
    }

    return (
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2">
            <Avatar photoURL={mutualFollower.photoURL} displayName={mutualFollower.displayName} className="w-4 h-4" />
            <span className="truncate">Followed by {mutualFollower.displayName}</span>
        </div>
    );
};


// --- SEARCH PAGE COMPONENTS ---

const UserSearchResultCard: React.FC<{
    user: AppUser;
    isFollowing: boolean;
    onFollowToggle: (userId: string, isCurrentlyFollowing: boolean) => void;
    onViewProfile: (user: AppUser) => void;
    myFollowing: { [uid: string]: true } | null;
}> = ({ user, isFollowing, onFollowToggle, onViewProfile, myFollowing }) => {
    const photoURL = user.photoURL;
    const fullUrl = typeof photoURL === 'object' && photoURL !== null ? photoURL.full : typeof photoURL === 'string' ? photoURL : null;
    const thumbUrl = typeof photoURL === 'object' && photoURL !== null ? photoURL.thumb : fullUrl;
    
    return (
        <div 
            onClick={() => onViewProfile(user)} 
            className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/50 text-center cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary group flex flex-col"
        >
            <div className="w-full aspect-1 rounded-2xl overflow-hidden relative bg-gray-100 dark:bg-gray-900">
                {fullUrl ? (
                    <ProgressiveImage
                        src={fullUrl}
                        placeholderSrc={thumbUrl || ''}
                        alt={user.displayName}
                        className="w-full h-full"
                        imageClassName="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className={`w-full h-full flex items-center justify-center text-white font-bold text-6xl ${getColor(user.displayName)} group-hover:scale-105 transition-transform duration-300`}>
                        <span>{getInitials(user.displayName)}</span>
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/20 to-transparent backdrop-blur-[2px] pointer-events-none"></div>
            </div>
            
            <div className="flex flex-col flex-grow mt-3">
                <div className="flex items-center justify-center gap-1.5">
                    <h3 className="font-bold text-md truncate">{user.displayName}</h3>
                    {user.isVerified && <VerifiedIcon className="w-4 h-4 text-green-500 flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 h-[32px]">
                    {user.bio || '\u00A0'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1 mt-2 min-h-[22px]">
                    {user.tags?.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {tag}
                        </span>
                    ))}
                </div>
                <div className="mt-auto pt-3">
                    <FollowedByInfo suggestedUserId={user.uid} myFollowing={myFollowing} />
                    <button
                        onClick={(e) => { e.stopPropagation(); onFollowToggle(user.uid, isFollowing); }}
                        className={`w-full py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-1.5 ${isFollowing ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200' : 'bg-gray-800 dark:bg-gray-200 text-white dark:text-black'}`}
                    >
                        {isFollowing ? 'Following' : 'Follow'}
                        {!isFollowing && <PlusIcon className="w-3 h-3"/>}
                    </button>
                </div>
            </div>
        </div>
    );
};


const PostGridItem: React.FC<{ post: Post; onSelectPost: (post: Post) => void; }> = ({ post, onSelectPost }) => {
    const mediaUrl = post.imageUrls?.[0]?.thumb || post.gifUrl;
    
    return (
        <div onClick={() => onSelectPost(post)} className="relative mb-4 bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden group cursor-pointer break-inside-avoid">
            {mediaUrl && <img src={mediaUrl} alt={post.text} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"/>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
            <div className="absolute bottom-2 left-2 right-2 text-white flex items-center gap-2 pointer-events-none">
                <Avatar photoURL={post.author.photoURL} displayName={post.author.displayName} className="w-5 h-5"/>
                <p className="font-semibold text-xs truncate">{post.author.displayName}</p>
            </div>
        </div>
    )
};


const SearchPage: React.FC<{ 
    onViewProfile: (user: AppUser) => void; 
    onSelectPost: (post: Post) => void;
}> = ({ onViewProfile, onSelectPost }) => {
    const { currentUser, appUser, following } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('All');
    
    // States for holding all data for client-side search
    const [allUsers, setAllUsers] = useState<AppUser[]>([]);
    const [allPublicPosts, setAllPublicPosts] = useState<Post[]>([]);

    // Discovery content (derived from all data)
    const [suggestedUsers, setSuggestedUsers] = useState<AppUser[]>([]);
    const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
    const [loadingDiscovery, setLoadingDiscovery] = useState(true);

    // Search results
    const [userResults, setUserResults] = useState<AppUser[]>([]);
    const [postResults, setPostResults] = useState<Post[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    
    const [confirmUnfollowUser, setConfirmUnfollowUser] = useState<AppUser | null>(null);
    
    // Fetch all data for discovery and searching
    useEffect(() => {
        const fetchAllData = async () => {
            if (!currentUser) return;
            setLoadingDiscovery(true);
            try {
                // Fetch all users
                const usersSnap = await get(ref(db, 'users'));
                const users: AppUser[] = [];
                if (usersSnap.exists()) {
                    usersSnap.forEach(child => {
                        const userData = child.val();
                        if (child.key !== currentUser.uid && !userData.isPrivate) {
                            users.push({ uid: child.key!, ...userData });
                        }
                    });
                }
                setAllUsers(users);

                // Fetch all public posts
                const postsQuery = query(ref(db, 'posts'), orderByChild('privacy'), equalTo('public'));
                const postsSnap = await get(postsQuery);
                const posts: Post[] = [];
                if (postsSnap.exists()) {
                    postsSnap.forEach(child => {
                        posts.push({ id: child.key!, ...child.val() });
                    });
                }
                // Sort by newest first and store
                setAllPublicPosts(posts.sort((a, b) => b.timestamp - a.timestamp));
                
            } catch (error) {
                console.error("Error fetching all data for search:", error);
            } finally {
                setLoadingDiscovery(false);
            }
        };
        fetchAllData();
    }, [currentUser]);

    // Set discovery content once all data is loaded
    useEffect(() => {
        if (loadingDiscovery) return;

        // Shuffle all users and take 6 for suggestions
        const shuffledUsers = [...allUsers].sort(() => 0.5 - Math.random());
        setSuggestedUsers(shuffledUsers.slice(0, 6));

        // Take the latest 30 posts, shuffle them, and then take 10 for trending
        const shuffledPosts = [...allPublicPosts].slice(0, 30).sort(() => 0.5 - Math.random());
        setTrendingPosts(shuffledPosts.slice(0, 10));
    }, [allUsers, allPublicPosts, loadingDiscovery]);


    const handleFollowToggle = (targetUserId: string, isCurrentlyFollowing: boolean) => {
        if (!currentUser || !appUser) return;
        
        if (isCurrentlyFollowing) {
            const userToUnfollow = allUsers.find(u => u.uid === targetUserId);
            if(userToUnfollow) setConfirmUnfollowUser(userToUnfollow);
        } else {
            // Follow logic
            const currentUserId = currentUser.uid;
            const updates: { [key: string]: any } = {};
            updates[`/following/${currentUserId}/${targetUserId}`] = true;
            updates[`/followers/${targetUserId}/${currentUserId}`] = true;
            update(ref(db), updates);
             // Add notification
            const notificationRef = push(ref(db, `notifications/${targetUserId}`));
            set(notificationRef, {
                type: 'follow',
                fromUid: currentUserId,
                fromName: appUser.displayName,
                fromPhotoURL: appUser.photoURL,
                timestamp: serverTimestamp(),
                read: false,
            });
        }
    };

    const confirmUnfollow = async () => {
        if (!currentUser || !confirmUnfollowUser) return;
        const currentUserId = currentUser.uid;
        const targetUserId = confirmUnfollowUser.uid;

        const updates: { [key: string]: any } = {};
        updates[`/following/${currentUserId}/${targetUserId}`] = null;
        updates[`/followers/${targetUserId}/${currentUserId}`] = null;
        await update(ref(db), updates);
        setConfirmUnfollowUser(null);
    };

    const handleSearch = useCallback(
        debounce((term: string) => {
            const lowerCaseTerm = term.toLowerCase();
    
            // Fuzzy search for users with relevance sorting
            const filteredUsers = allUsers
                .filter(user => 
                    user.displayName.toLowerCase().includes(lowerCaseTerm) ||
                    (user.handle && user.handle.toLowerCase().includes(lowerCaseTerm))
                )
                .sort((a, b) => {
                    const aName = a.displayName.toLowerCase();
                    const bName = b.displayName.toLowerCase();
                    const aHandle = a.handle?.toLowerCase() || '';
                    const bHandle = b.handle?.toLowerCase() || '';
    
                    // Higher score is better
                    let scoreA = 0;
                    let scoreB = 0;
    
                    if (aHandle === lowerCaseTerm) scoreA = 5;
                    else if (aName === lowerCaseTerm) scoreA = 4;
                    else if (aHandle.startsWith(lowerCaseTerm)) scoreA = 3;
                    else if (aName.startsWith(lowerCaseTerm)) scoreA = 2;
                    else if (aHandle.includes(lowerCaseTerm) || aName.includes(lowerCaseTerm)) scoreA = 1;
    
                    if (bHandle === lowerCaseTerm) scoreB = 5;
                    else if (bName === lowerCaseTerm) scoreB = 4;
                    else if (bHandle.startsWith(lowerCaseTerm)) scoreB = 3;
                    else if (bName.startsWith(lowerCaseTerm)) scoreB = 2;
                    else if (bHandle.includes(lowerCaseTerm) || bName.includes(lowerCaseTerm)) scoreB = 1;

                    // FIX: Corrected typo from `aScore` to `scoreA` for proper sorting.
                    return scoreB - scoreA;
                });
            setUserResults(filteredUsers);
    
            // Fuzzy search for posts (already sorted by recency)
            const filteredPosts = allPublicPosts.filter(post => 
                post.text.toLowerCase().includes(lowerCaseTerm) ||
                post.author.displayName.toLowerCase().includes(lowerCaseTerm)
            );
            setPostResults(filteredPosts);
    
            setLoadingSearch(false);
        }, 300), 
    [allUsers, allPublicPosts]);

    useEffect(() => {
        if (searchTerm.trim().length > 0) {
            setLoadingSearch(true);
            handleSearch(searchTerm);
        } else {
            handleSearch.cancel();
            setUserResults([]);
            setPostResults([]);
            setLoadingSearch(false);
        }
        // Cleanup debounced function on unmount
        return () => handleSearch.cancel();
    }, [searchTerm, handleSearch]);

    const tabs = ['All', 'Account', 'Post'];
    
    const DiscoveryView = () => (
        <>
             <div>
                <h2 className="text-xl font-bold mb-3">Suggestion Accounts</h2>
                {loadingDiscovery ? (
                    <div className="grid grid-cols-2 gap-4"><UserListItemSkeleton /><UserListItemSkeleton/></div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {suggestedUsers.map(user => (
                            <UserSearchResultCard 
                                key={user.uid} 
                                user={user} 
                                isFollowing={!!following?.[user.uid]}
                                onFollowToggle={handleFollowToggle}
                                onViewProfile={onViewProfile}
                                myFollowing={following}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div className="mt-6">
                <h2 className="text-xl font-bold mb-3">Explore</h2>
                 {loadingDiscovery ? (
                    <div className="columns-2 gap-4">
                        <Skeleton className="h-48 rounded-2xl mb-4"/>
                        <Skeleton className="h-64 rounded-2xl mb-4"/>
                    </div>
                 ) : (
                    <div className="columns-2 gap-4">
                        {trendingPosts.map(post => <PostGridItem key={post.id} post={post} onSelectPost={onSelectPost} />)}
                    </div>
                 )}
            </div>
        </>
    );
    
    const searchResultsView = useMemo(() => {
        const showUsers = (activeTab === 'All' || activeTab === 'Account') && userResults.length > 0;
        const showPosts = (activeTab === 'All' || activeTab === 'Post') && postResults.length > 0;
        const noResults = userResults.length === 0 && postResults.length === 0;

        return (
            <div className="mt-4">
                {loadingSearch ? (
                    <div className="grid grid-cols-2 gap-4"><UserListItemSkeleton /><UserListItemSkeleton /><Skeleton className="aspect-square rounded-2xl"/><Skeleton className="aspect-square rounded-2xl"/></div>
                ) : (
                    <>
                        {showUsers && (
                             <div className="grid grid-cols-2 gap-4">
                                {userResults.map(user => (
                                    <UserSearchResultCard 
                                        key={user.uid} 
                                        user={user} 
                                        isFollowing={!!following?.[user.uid]}
                                        onFollowToggle={handleFollowToggle}
                                        onViewProfile={onViewProfile}
                                        myFollowing={following}
                                    />
                                ))}
                            </div>
                        )}
                        {showPosts && (
                            <div className="mt-4 columns-2 gap-4">
                                {postResults.map(post => <PostGridItem key={post.id} post={post} onSelectPost={onSelectPost} />)}
                            </div>
                        )}
                        {noResults && <p className="text-center text-gray-500 mt-8">No results found for "{searchTerm}"</p>}
                    </>
                )}
            </div>
        )
    }, [activeTab, userResults, postResults, loadingSearch, following, onViewProfile, onSelectPost, handleFollowToggle, searchTerm]);


    return (
        <>
            <div className="p-4 h-full bg-white dark:bg-black overflow-y-auto">
                <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder="Search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-gray-100 dark:bg-gray-900 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
                     <MicrophoneIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>

                <div className="flex items-center gap-2 mb-6">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {searchTerm.trim().length === 0 ? <DiscoveryView /> : searchResultsView}
            </div>
            {confirmUnfollowUser && (
                <Modal title={`Unfollow @${confirmUnfollowUser.handle}?`} onClose={() => setConfirmUnfollowUser(null)}>
                    <div className="p-4 text-center">
                        <Avatar photoURL={confirmUnfollowUser.photoURL} displayName={confirmUnfollowUser.displayName} className="w-20 h-20 mx-auto mb-4"/>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Their posts will no longer appear in your feed.</p>
                         <div className="flex justify-center gap-4 mt-6">
                             <button 
                                onClick={() => setConfirmUnfollowUser(null)}
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
    )
};

const Stories: React.FC<{
  onAddStory: () => void;
  onViewStories: (
    groupedStories: { [userId: string]: Story[] },
    authorInfos: { [userId: string]: Pick<AppUser, 'uid' | 'displayName' | 'photoURL'> },
    storyUserIds: string[],
    startIndex: number
  ) => void;
}> = ({ onAddStory, onViewStories }) => {
    const { appUser } = useAuth();
    const [stories, setStories] = useState<Story[]>([]);
    const [authorInfos, setAuthorInfos] = useState<{ [uid: string]: Pick<AppUser, 'uid' | 'displayName' | 'photoURL'> }>({});

    useEffect(() => {
        const storiesQuery = query(ref(db, 'stories'), orderByChild('expiresAt'), startAt(Date.now()));
        const listener = onValue(storiesQuery, (snapshot) => {
            const activeStories: Story[] = [];
            const authors: { [uid: string]: any } = {};
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const story = { id: child.key!, ...child.val() } as Story;
                    activeStories.push(story);
                    authors[story.author.uid] = story.author;
                });
            }
            setStories(activeStories.sort((a,b) => b.timestamp - a.timestamp));
            setAuthorInfos(authors);
        });

        return () => off(storiesQuery, 'value', listener);
    }, []);

    const { groupedStories, storyUserIds } = useMemo(() => {
        const grouped: { [userId: string]: Story[] } = {};
        stories.forEach(story => {
            if (!grouped[story.author.uid]) {
                grouped[story.author.uid] = [];
            }
            grouped[story.author.uid].push(story);
        });
        const uids = Object.keys(grouped);
        return { groupedStories: grouped, storyUserIds: uids };
    }, [stories]);

    if (!appUser) return null;

    return (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex space-x-4 overflow-x-auto pb-2 -mx-4 px-4">
                <div onClick={onAddStory} className="flex-shrink-0 text-center w-20 cursor-pointer">
                    <div className="relative rounded-full p-0.5 bg-gray-200">
                        <Avatar photoURL={appUser.photoURL} displayName={appUser.displayName} className="w-16 h-16 border-2 border-white dark:border-gray-900" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                            <span className="text-lg leading-none">+</span>
                        </div>
                    </div>
                    <p className="text-xs mt-1.5 truncate text-gray-800 dark:text-gray-200">Your Story</p>
                </div>

                {storyUserIds.map((userId, index) => {
                    const author = authorInfos[userId];
                    if (!author) return null;
                    const storiesForThisUser = groupedStories[userId] || [];
                    const hasViewedAll = storiesForThisUser.every(story => story.viewedBy?.[appUser.uid]);

                    return (
                        <div key={userId} onClick={() => onViewStories(groupedStories, authorInfos, storyUserIds, index)} className="flex-shrink-0 text-center w-20 cursor-pointer">
                            <div className={`relative rounded-full p-0.5 ${hasViewedAll ? 'bg-gray-300 dark:bg-gray-700' : 'bg-gradient-to-tr from-yellow-400 to-fuchsia-600'}`}>
                                <Avatar photoURL={author.photoURL} displayName={author.displayName} className="w-16 h-16 border-2 border-white dark:border-gray-900" />
                            </div>
                            <p className="text-xs mt-1.5 truncate text-gray-800 dark:text-gray-200">{author.displayName}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const FeedPage: React.FC<{ 
    onSelectPost: (post: Post) => void; 
    onViewProfile: (user: AppUser) => void;
    onAddStory: () => void;
    onViewStories: (grouped: any, authors: any, userIds: any, index: any) => void;
}> = ({ onSelectPost, onViewProfile, onAddStory, onViewStories }) => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const postsRef = query(ref(db, 'posts'), orderByChild('timestamp'));
        const listener = onValue(postsRef, (snapshot) => {
            const postsData: Post[] = [];
            if(snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    postsData.push({ id: childSnapshot.key as string, ...childSnapshot.val() });
                });
                setPosts(postsData.reverse()); // Show newest first
            } else {
                setPosts([]);
            }
            setLoading(false);
        });

        return () => off(postsRef, 'value', listener);
    }, []);

    if (loading) {
        return (
            <div className="bg-white dark:bg-black">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                   <div className="flex space-x-4"><Skeleton className="w-20 h-24 rounded-lg"/><Skeleton className="w-20 h-24 rounded-lg"/></div>
                </div>
                <div className="flex flex-col">
                    <PostCardSkeleton />
                    <PostCardSkeleton />
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-white dark:bg-black">
            <Stories onAddStory={onAddStory} onViewStories={onViewStories} />
            <div className="flex flex-col">
                {posts.length > 0 ? (
                     posts.map(post => <PostCard key={post.id} post={post} onNavigateToDetail={() => onSelectPost(post)} onViewProfile={onViewProfile} />)
                ) : (
                    <p className="text-center p-8 text-gray-500">No posts yet. Be the first to share something!</p>
                )}
            </div>
        </div>
    );
};

const MainHeader: React.FC<{ 
    page: 'home' | 'search' | 'messages' | 'profile';
    onOpenDrawer: () => void;
    onNavigateToMessages: () => void;
    onOpenNotifications: () => void;
    totalUnreadMessages: number;
    totalUnreadNotifs: number;
}> = ({ page, onOpenDrawer, onNavigateToMessages, onOpenNotifications, totalUnreadMessages, totalUnreadNotifs }) => {
    const { appUser } = useAuth();
    const { appData, loadingAppData } = useAppData();
    
    if (page === 'profile') {
        return null;
    }

    if (page === 'home') {
        return (
            <header className="flex-shrink-0 sticky top-0 z-20 flex items-center justify-between p-4 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-500/20">
                {loadingAppData ? (
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="h-6 w-32 rounded-md" />
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        {appData?.logoUrl && <img src={appData.logoUrl} alt="App Logo" className="w-8 h-8 object-contain"/>}
                        <h1 className="text-2xl font-bold tracking-tight">{appData?.name || 'Chat App'}</h1>
                    </div>
                )}
                <div className="flex items-center gap-4">
                    <button onClick={onOpenNotifications} className="relative">
                        <HeartIcon className="w-7 h-7" />
                        {totalUnreadNotifs > 0 && (
                            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white dark:border-black">
                                {totalUnreadNotifs > 9 ? '9+' : totalUnreadNotifs}
                            </span>
                        )}
                    </button>
                    <button onClick={onNavigateToMessages} className="relative">
                       <SendIcon className="w-7 h-7 transform -rotate-12"/>
                       {totalUnreadMessages > 0 && (
                            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white dark:border-black">
                                {totalUnreadMessages > 9 ? '9+' : totalUnreadMessages}
                            </span>
                        )}
                    </button>
                </div>
            </header>
        );
    }
    
    return null; // Search header is handled within SearchPage component
};


interface BottomNavProps {
    activeTab: 'home' | 'search' | 'messages' | 'profile';
    onTabChange: (tab: 'home' | 'search' | 'messages' | 'profile') => void;
    onAddPost: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, onAddPost }) => {
    const { appUser } = useAuth();
    
    const NavButton: React.FC<{
        tab: 'home' | 'search' | 'add' | 'messages' | 'profile';
        action?: () => void; 
        children: React.ReactNode 
    }> = ({ tab, action, children }) => (
         <button 
            onClick={() => {
                if(action) {
                    action();
                } else if (tab === 'home' || tab === 'search' || tab === 'messages' || tab === 'profile') {
                    onTabChange(tab);
                }
            }} 
            className={`p-2 transition-transform duration-200 ${activeTab === tab ? 'scale-110' : 'scale-100'}`}
        >
            {children}
        </button>
    );

    return (
         <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4">
            <nav className="flex items-center justify-around p-2 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-500/10 rounded-full shadow-2xl shadow-black/10">
                <NavButton tab="home"><HomeIcon className="w-7 h-7" isActive={activeTab === 'home'} /></NavButton>
                <NavButton tab="search"><SearchIcon className="w-7 h-7" isActive={activeTab === 'search'} /></NavButton>
                <NavButton tab="add" action={onAddPost}><PlusSquareIcon className="w-7 h-7" /></NavButton>
                <NavButton tab="messages"><MessageSquareIcon className="w-7 h-7" isActive={activeTab === 'messages'} /></NavButton>
                <NavButton tab="profile">
                    <Avatar photoURL={appUser?.photoURL} displayName={appUser?.displayName} className={`w-8 h-8 transition-all border-2 ${activeTab === 'profile' ? 'border-primary' : 'border-transparent'}`} />
                </NavButton>
            </nav>
        </div>
    );
};


const ChatLayout: React.FC = () => {
    const { appUser, currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'home' | 'search' | 'messages' | 'profile'>('home');
    const [selectedChatUser, setSelectedChatUser] = useState<AppUser | null>(null);
    const [viewingProfile, setViewingProfile] = useState<AppUser | null>(null);
    const [viewingPost, setViewingPost] = useState<{ post: Post; highlightCommentId?: string; } | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [isCreatePostOpen, setCreatePostOpen] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
    const [totalUnreadNotifs, setTotalUnreadNotifs] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [exitConfirm, setExitConfirm] = useState(false);
    const [showPrivacySettings, setShowPrivacySettings] = useState(false);
    const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Stories state
    const [isCreateStoryOpen, setCreateStoryOpen] = useState(false);
    const [editingStory, setEditingStory] = useState<Story | null>(null);
    const [storyViewerData, setStoryViewerData] = useState<any>(null);


    useEffect(() => {
        if (!currentUser) return;
        const userChatsRef = ref(db, `userChats/${currentUser.uid}`);
        const listener = onValue(userChatsRef, (snapshot) => {
            let total = 0;
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const chat = childSnapshot.val();
                    if (chat.unreadCount && chat.unreadCount > 0) {
                        total += chat.unreadCount;
                    }
                });
            }
            setTotalUnreadMessages(total);
        });
        return () => off(userChatsRef, 'value', listener);
    }, [currentUser]);

    // Unread notifications listener
    useEffect(() => {
        if (!currentUser) return;
        const notifsRef = query(ref(db, `notifications/${currentUser.uid}`), orderByChild('read'), equalTo(false));
        const listener = onValue(notifsRef, (snapshot) => {
            setTotalUnreadNotifs(snapshot.size);
        });
        return () => off(notifsRef, 'value', listener);
    }, [currentUser]);

    // History management for back button
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            // Clear any pending exit confirmation on any back navigation
            if (exitTimeoutRef.current) {
                clearTimeout(exitTimeoutRef.current);
                exitTimeoutRef.current = null;
            }
            setExitConfirm(false);

            // Priority 1: Close any open "modal" view.
            if (showPrivacySettings) { setShowPrivacySettings(false); return; }
            if (storyViewerData) { setStoryViewerData(null); return; }
            if (isCreateStoryOpen) { setCreateStoryOpen(false); return; }
            if (isEditingProfile) { setIsEditingProfile(false); return; }
            if (isCreatePostOpen) { setCreatePostOpen(false); return; }
            if (viewingPost) { setViewingPost(null); return; }
            if (viewingProfile) { setViewingProfile(null); return; }
            if (selectedChatUser) { setSelectedChatUser(null); return; }
            if (showNotifications) { setShowNotifications(false); return; }

            // Priority 2: If not on home tab, navigate to home tab.
            if (activeTab !== 'home') {
                setActiveTab('home');
                return;
            }
            
            // Priority 3: On home screen, handle "double press to exit".
            if (exitConfirm) {
                // This is the second press. Allow default behavior to exit.
                window.history.back();
                return;
            }
            
            // This is the first press on home.
            setExitConfirm(true);
            // "Trap" the back button by pushing a state. Next back press will pop this.
            window.history.pushState(null, '', window.location.href);

            exitTimeoutRef.current = setTimeout(() => {
                setExitConfirm(false);
                 // If the user didn't press back again, they are now on a "trap" state.
                 // We need to pop it to restore normal behavior.
                 // This check ensures we only go back if the user hasn't navigated elsewhere.
                if (window.history.state === null) {
                    window.history.back();
                }
            }, 2000);
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
             if (exitTimeoutRef.current) {
                clearTimeout(exitTimeoutRef.current);
            }
        };
    }, [isEditingProfile, isCreatePostOpen, viewingPost, viewingProfile, selectedChatUser, activeTab, exitConfirm, storyViewerData, isCreateStoryOpen, showNotifications, showPrivacySettings]);

    const pushHistoryState = (view: string) => {
        window.history.pushState({ view }, '');
    };

    const handleSelectChat = (user: AppUser) => {
        setSelectedChatUser(user);
        setViewingProfile(null);
        setViewingPost(null);
        pushHistoryState('chat');
    };
    
    const handleTabChange = (tab: 'home' | 'search' | 'messages' | 'profile') => {
        setActiveTab(tab);
        setSelectedChatUser(null);
        setViewingProfile(null);
        setViewingPost(null);
    };

    const handleViewProfile = (user: AppUser) => {
        setViewingProfile(user);
        setSelectedChatUser(null);
        setViewingPost(null);
        pushHistoryState('profile');
    }
    
    const handleStartChat = (user: AppUser) => {
        if (viewingProfile) setViewingProfile(null);
        setActiveTab('messages');
        handleSelectChat(user);
    };

    const handleSelectPost = (post: Post, highlightCommentId?: string) => {
        setViewingPost({ post, highlightCommentId });
        setViewingProfile(null);
        setSelectedChatUser(null);
        pushHistoryState('post');
    };

    const handleOpenCreatePost = () => {
        setCreatePostOpen(true);
        pushHistoryState('createPost');
    };
    
    const handleOpenNotifications = () => {
        setShowNotifications(true);
        pushHistoryState('notifications');
    };

    const handleEditProfile = () => {
        setIsEditingProfile(true);
        pushHistoryState('editProfile');
    };
    
    const handleOpenCreateStory = () => {
        setEditingStory(null);
        setCreateStoryOpen(true);
        pushHistoryState('createStory');
    };
    
    const handleEditStory = (story: Story) => {
        setStoryViewerData(null);
        setEditingStory(story);
        setCreateStoryOpen(true);
        // Don't push history state here, as we are already in a "modal" view
    };

    const handleViewStories = (groupedStories: any, authorInfos: any, storyUserIds: any, startIndex: number) => {
        setStoryViewerData({ groupedStories, authorInfos, storyUserIds, startIndex });
        pushHistoryState('viewStory');
    };
    
    const handleViewArchivedStories = (user: AppUser, stories: Story[], startIndex: number) => {
        const grouped = { [user.uid]: stories };
        const authorInfos = { [user.uid]: { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }};
        setStoryViewerData({
            groupedStories: grouped,
            authorInfos: authorInfos,
            storyUserIds: [user.uid],
            startIndex: 0,
            storyStartIndex: startIndex
        });
        pushHistoryState('viewStory');
    };

    const handleBack = () => {
        window.history.back();
    };
    
    const renderContent = () => {
        switch (activeTab) {
            case 'home': return <FeedPage onSelectPost={handleSelectPost} onViewProfile={handleViewProfile} onAddStory={handleOpenCreateStory} onViewStories={handleViewStories}/>;
            case 'search': return <SearchPage onViewProfile={handleViewProfile} onSelectPost={handleSelectPost} />;
            case 'messages': return <Sidebar onSelectChat={handleSelectChat} selectedUserId={selectedChatUser?.uid} />;
            case 'profile': return <ProfilePage onSelectPost={handleSelectPost} onOpenDrawer={() => setIsDrawerOpen(true)} onEditProfile={handleEditProfile} onStartChat={handleStartChat} onViewArchivedStories={handleViewArchivedStories} />;
            default: return <FeedPage onSelectPost={handleSelectPost} onViewProfile={handleViewProfile} onAddStory={handleOpenCreateStory} onViewStories={handleViewStories} />;
        }
    }

    // New render logic with correct view hierarchy
    if (showPrivacySettings) {
        return <PrivacySettings onClose={handleBack} />;
    }
    if (isEditingProfile && appUser) {
        return <UserProfile user={appUser} onClose={handleBack} />;
    }
    if (viewingPost) {
        return <PostDetailView post={viewingPost.post} highlightCommentId={viewingPost.highlightCommentId} onBack={handleBack} onViewProfile={handleViewProfile} />;
    }
    if (viewingProfile) {
        return <ProfilePage user={viewingProfile} onBack={handleBack} onSelectPost={handleSelectPost} onOpenDrawer={() => setIsDrawerOpen(true)} onStartChat={handleStartChat} onViewArchivedStories={handleViewArchivedStories} />;
    }
    if (selectedChatUser) {
        return <ChatWindow recipient={selectedChatUser} onBack={handleBack} onViewProfile={handleViewProfile} />;
    }
    if (showNotifications) {
        return <NotificationsPage onClose={handleBack} onSelectPost={handleSelectPost} onViewProfile={handleViewProfile} />;
    }

    return (
        <div className="h-screen w-screen overflow-hidden flex flex-col bg-white dark:bg-black text-gray-900 dark:text-gray-100 relative">
            <MainHeader 
                page={activeTab} 
                onOpenDrawer={() => setIsDrawerOpen(true)} 
                onNavigateToMessages={() => handleTabChange('messages')}
                onOpenNotifications={handleOpenNotifications}
                totalUnreadMessages={totalUnreadMessages}
                totalUnreadNotifs={totalUnreadNotifs}
            />
            <main className="flex-1 overflow-y-auto pb-24">
                {renderContent()}
            </main>
           <BottomNav 
                activeTab={activeTab} 
                onTabChange={handleTabChange} 
                onAddPost={handleOpenCreatePost}
            />
           <Drawer 
                isOpen={isDrawerOpen} 
                onClose={() => setIsDrawerOpen(false)} 
                onOpenAdminPanel={() => setShowAdminPanel(true)}
                onEditProfile={handleEditProfile}
                onOpenPrivacySettings={() => {
                    setShowPrivacySettings(true);
                    pushHistoryState('privacySettings');
                }}
            />
            {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
            {isCreatePostOpen && <CreatePost onClose={handleBack} />}
            {isCreateStoryOpen && <CreateStory onClose={handleBack} storyToEdit={editingStory} />}
            {storyViewerData && <StoryViewer {...storyViewerData} onClose={handleBack} onEdit={handleEditStory} onStartChat={handleStartChat} onViewProfile={handleViewProfile} />}
             {exitConfirm && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-full z-50 animate-fade-in">
                    Press back again to exit
                </div>
            )}
        </div>
    );
};

export default ChatLayout;