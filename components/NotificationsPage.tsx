import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, off, query, orderByChild, update, get } from 'firebase/database';
import { useAuth } from '../App';
import { Notification, AppUser, Post } from '../types';
import { AtSignIcon, ChevronLeftIcon, HeartIcon, MessageSquareIcon, UserIcon } from './common/Icons';
import { Skeleton } from './common/Shimmer';
import Avatar from './common/Avatar';

// A more robust time ago function
const timeAgo = (timestamp: number): string => {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
};


interface NotificationItemProps {
    notification: Notification;
    onSelectPost: (post: Post, highlightCommentId?: string) => void;
    onViewProfile: (user: AppUser) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onSelectPost, onViewProfile }) => {
    const { currentUser } = useAuth();

    const handleMainClick = async () => {
        if (!currentUser) return;

        // Mark as read
        if (!notification.read) {
            update(ref(db, `/notifications/${currentUser.uid}/${notification.id}`), { read: true });
        }

        if (notification.type === 'follow') {
            // A click on any part of a follow notification should open the profile
            const userRef = ref(db, `users/${notification.fromUid}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                onViewProfile({ uid: snapshot.key, ...snapshot.val() });
            }
        } else if (notification.postId) {
            // A click on other notifications navigates to the post
            const postRef = ref(db, `posts/${notification.postId}`);
            const snapshot = await get(postRef);
            if (snapshot.exists()) {
                const post = { id: snapshot.key, ...snapshot.val() } as Post;
                const highlightCommentId = (notification.type === 'comment' || notification.type === 'reply') ? notification.commentId : undefined;
                onSelectPost(post, highlightCommentId);
            } else {
                alert("The post associated with this notification may have been deleted.");
            }
        }
    };

    const handleProfileClick = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevents handleMainClick from firing
        if (!currentUser) return;
        
        // Mark as read
        if (!notification.read) {
            update(ref(db, `/notifications/${currentUser.uid}/${notification.id}`), { read: true });
        }

        const userRef = ref(db, `users/${notification.fromUid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            onViewProfile({ uid: snapshot.key, ...snapshot.val() });
        }
    };


    const renderIcon = () => {
        const iconClass = "w-5 h-5 text-white";
        switch(notification.type) {
            case 'like': return <div className="p-1.5 bg-red-500 rounded-full"><HeartIcon className={iconClass} isFilled /></div>;
            case 'comment': return <div className="p-1.5 bg-blue-500 rounded-full"><MessageSquareIcon className={iconClass} /></div>;
            case 'reply': return <div className="p-1.5 bg-green-500 rounded-full"><MessageSquareIcon className={iconClass} /></div>;
            case 'follow': return <div className="p-1.5 bg-purple-500 rounded-full"><UserIcon className={iconClass} /></div>;
            case 'mention': return <div className="p-1.5 bg-cyan-500 rounded-full"><AtSignIcon className={iconClass} /></div>;
        }
    };
    
    const renderText = () => {
        const fromName = <strong className="font-semibold cursor-pointer hover:underline" onClick={handleProfileClick}>{notification.fromName}</strong>;
        switch(notification.type) {
            case 'like': return <>{fromName} liked your post.</>;
            case 'comment': return <>{fromName} commented: <span className="text-gray-600 dark:text-gray-400 italic">"{notification.commentText}"</span></>;
            case 'reply': return <>{fromName} replied to you: <span className="text-gray-600 dark:text-gray-400 italic">"{notification.commentText}"</span></>;
            case 'follow': return <>{fromName} started following you.</>;
            case 'mention': return <>{fromName} mentioned you in a post: <span className="text-gray-600 dark:text-gray-400 italic">"{notification.commentText}"</span></>;
        }
    };

    return (
        <div onClick={handleMainClick} className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg ${!notification.read ? 'bg-primary/10' : ''}`}>
            <div className="relative flex-shrink-0">
                <div onClick={handleProfileClick} className="cursor-pointer">
                    <Avatar photoURL={notification.fromPhotoURL} displayName={notification.fromName} className="w-11 h-11"/>
                </div>
                <div className="absolute -bottom-1 -right-1">{renderIcon()}</div>
            </div>
            <div className="flex-1">
                <p className="text-sm text-gray-800 dark:text-gray-200">{renderText()}</p>
                <p className="text-xs text-gray-500">{timeAgo(notification.timestamp)}</p>
            </div>
            {notification.postImageThumb && (
                <img src={notification.postImageThumb} alt="post thumbnail" className="w-12 h-12 object-cover rounded-md flex-shrink-0"/>
            )}
        </div>
    );
};


interface NotificationsPageProps {
  onClose: () => void;
  onSelectPost: (post: Post, commentId?: string) => void;
  onViewProfile: (user: AppUser) => void;
}

const NotificationsPage: React.FC<NotificationsPageProps> = ({ onClose, onSelectPost, onViewProfile }) => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | Notification['type']>('all');

    useEffect(() => {
        if (!currentUser) return;

        const notifsRef = query(ref(db, `notifications/${currentUser.uid}`), orderByChild('timestamp'));
        const listener = onValue(notifsRef, (snapshot) => {
            const data: Notification[] = [];
            const unreadUpdates: { [key: string]: boolean } = {};
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const notif = { id: child.key, ...child.val() } as Notification;
                    data.push(notif);
                    if (!notif.read) {
                        unreadUpdates[`/notifications/${currentUser.uid}/${child.key}/read`] = true;
                    }
                });
                
                // Mark all fetched notifications as read
                if (Object.keys(unreadUpdates).length > 0) {
                    update(ref(db), unreadUpdates);
                }
            }
            setNotifications(data.reverse());
            setLoading(false);
        });

        return () => off(notifsRef, 'value', listener);
    }, [currentUser]);

    const filteredNotifications = useMemo(() => {
        if (filter === 'all') return notifications;
        return notifications.filter(n => n.type === filter);
    }, [notifications, filter]);

    const filters: ('all' | Notification['type'])[] = ['all', 'follow', 'like', 'comment', 'mention', 'reply'];

    return (
        <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col font-sans animate-fade-in">
            <header className="flex-shrink-0 flex items-center p-4 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-500/20">
                <button onClick={onClose} className="p-2 -ml-2">
                    <ChevronLeftIcon className="w-7 h-7" />
                </button>
                <h1 className="font-bold text-lg mx-auto">Notifications</h1>
                <div className="w-8"></div>
            </header>

            <div className="flex-shrink-0 p-2 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 overflow-x-auto">
                     {filters.map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${filter === f ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                        >
                           <span className="capitalize">{f}</span>
                        </button>
                    ))}
                </div>
            </div>

            <main className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 space-y-2">
                        {Array.from({length: 8}).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                    </div>
                ) : filteredNotifications.length > 0 ? (
                    <div className="p-2">
                        {filteredNotifications.map(notif => (
                            <NotificationItem 
                                key={notif.id} 
                                notification={notif}
                                onSelectPost={onSelectPost}
                                onViewProfile={onViewProfile}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-8 text-gray-500">
                        <p className="font-semibold">No notifications yet</p>
                        <p className="text-sm">When you get likes, comments, or follows, they'll show up here.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default NotificationsPage;