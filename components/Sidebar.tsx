import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, off, query, orderByChild, get } from 'firebase/database';
import { AppUser, UserChat } from '../types';
import { useAuth } from '../App';
import Avatar from './common/Avatar';
import UserBadges from './common/UserBadges';
import { SearchIcon } from './common/Icons';

interface SidebarProps {
  onSelectChat: (user: AppUser) => void;
  selectedUserId?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onSelectChat, selectedUserId }) => {
  const { currentUser, following } = useAuth();
  const [userChats, setUserChats] = useState<UserChat[]>([]);
  const [liveUsers, setLiveUsers] = useState<{[uid: string]: AppUser}>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(true);
  const [followers, setFollowers] = useState<{ [uid: string]: true } | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch followers
    const followersRef = ref(db, `followers/${currentUser.uid}`);
    const followersListener = onValue(followersRef, (snapshot) => {
        setFollowers(snapshot.val());
    });

    const userChatsRef = query(ref(db, `userChats/${currentUser.uid}`), orderByChild('lastMessage/timestamp'));
    const chatsListener = onValue(userChatsRef, (snapshot) => {
        const chats: UserChat[] = [];
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                chats.push(childSnapshot.val());
            });
            chats.reverse();
            setUserChats(chats);
        } else {
            setUserChats([]);
        }
    });

    const fetchAllUsers = async () => {
      setLoadingAllUsers(true);
      try {
        const usersSnap = await get(ref(db, 'users'));
        const users: AppUser[] = [];
        if (usersSnap.exists()) {
          usersSnap.forEach(child => {
            if (child.key !== currentUser.uid) {
              users.push({ uid: child.key!, ...child.val() });
            }
          });
        }
        setAllUsers(users);
      } catch (error) {
        console.error("Error fetching all users:", error);
      } finally {
        setLoadingAllUsers(false);
      }
    };

    fetchAllUsers();
    return () => {
        off(followersRef, 'value', followersListener);
        off(userChatsRef, 'value', chatsListener);
    };
  }, [currentUser]);

  useEffect(() => {
    const userIds = userChats.map(chat => chat.userInfo.uid);
    const listeners: { userRef: any, listenerCallback: any }[] = [];

    userIds.forEach(uid => {
      const userRef = ref(db, `users/${uid}`);
      const listenerCallback = onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
          setLiveUsers(prev => ({ ...prev, [uid]: snapshot.val() }));
        }
      });
      listeners.push({ userRef, listenerCallback });
    });

    return () => {
      listeners.forEach(({ userRef, listenerCallback }) => {
        off(userRef, 'value', listenerCallback);
      });
    };
  }, [userChats]);
  
  const { friendsWithChat, friendsWithoutChat } = useMemo(() => {
    const chatUserUids = new Set(userChats.map(chat => chat.userInfo.uid));
    
    const followingIds = following ? Object.keys(following) : [];
    const followerIds = followers ? Object.keys(followers) : [];
    const friendUids = new Set([...followingIds, ...followerIds]);
    
    const friendsData = allUsers.filter(u => friendUids.has(u.uid));
    const withoutChat = friendsData.filter(u => !chatUserUids.has(u.uid));
    
    return { friendsWithChat: userChats, friendsWithoutChat: withoutChat };
  }, [userChats, allUsers, following, followers]);

  const { filteredChats, filteredFriendsWithoutChat } = useMemo(() => {
    const lowerCaseTerm = searchTerm.toLowerCase();

    if (!searchTerm.trim()) {
        return { filteredChats: [], filteredFriendsWithoutChat: [] };
    }

    const chats = friendsWithChat.filter(chat => 
        chat.userInfo.displayName.toLowerCase().includes(lowerCaseTerm)
    );
    
    const friends = friendsWithoutChat.filter(user =>
      user.displayName.toLowerCase().includes(lowerCaseTerm) ||
       (user.handle && user.handle.toLowerCase().includes(lowerCaseTerm))
    );

    return { filteredChats: chats, filteredFriendsWithoutChat: friends };
  }, [friendsWithChat, friendsWithoutChat, searchTerm]);
  
  const ChatListItem: React.FC<{chat: UserChat}> = ({ chat }) => {
    const liveUserInfo = liveUsers[chat.userInfo.uid] || chat.userInfo;
    return (
       <li onClick={() => onSelectChat(liveUserInfo)} className={`flex items-start p-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-900`}>
          <div className="relative mr-4">
              <Avatar photoURL={liveUserInfo.photoURL} displayName={liveUserInfo.displayName} className="w-12 h-12" />
              <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-black ${liveUserInfo.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
          </div>
          <div className="flex-1 overflow-hidden border-b border-gray-200 dark:border-gray-800 pb-4">
              <div className="flex justify-between">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <p className="font-semibold truncate">{liveUserInfo.displayName}</p>
                    <UserBadges badges={liveUserInfo.badges} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                      {chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate pr-2">
                    {chat.lastMessage?.text || 'No messages yet'}
                </p>
                {chat.unreadCount && chat.unreadCount > 0 && (
                    <span className="bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                    </span>
                )}
              </div>
          </div>
      </li>
    );
  };

  const GlobalUserListItem: React.FC<{user: AppUser}> = ({ user }) => (
    <li onClick={() => onSelectChat(user)} className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-900`}>
      <Avatar photoURL={user.photoURL} displayName={user.displayName} className="w-12 h-12 mr-4" />
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <p className="font-semibold truncate">{user.displayName}</p>
          <UserBadges badges={user.badges} />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">@{user.handle}</p>
      </div>
    </li>
  );

  return (
    <div className="h-full bg-white dark:bg-black flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
            <h2 className="text-2xl font-bold">Messages</h2>
        </div>
        
        <div className="p-4 flex-shrink-0">
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search people or chats..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-900 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
        </div>

        <div className="overflow-y-auto px-4 flex-1">
            {searchTerm.trim().length > 0 ? (
                <>
                    {filteredChats.length > 0 && (
                        <>
                            <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 px-2">Chats</h3>
                            <ul>{filteredChats.map(chat => <ChatListItem key={chat.chatId} chat={chat} />)}</ul>
                        </>
                    )}
                    {filteredFriendsWithoutChat.length > 0 && (
                        <>
                             <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 my-2 px-2">Friends</h3>
                            <ul>{filteredFriendsWithoutChat.map(user => <GlobalUserListItem key={user.uid} user={user} />)}</ul>
                        </>
                    )}
                    {!loadingAllUsers && filteredChats.length === 0 && filteredFriendsWithoutChat.length === 0 && (
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">No results for "{searchTerm}"</p>
                    )}
                </>
            ) : (
                 <>
                    {friendsWithChat.length > 0 && (
                        <>
                             <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 px-2">Messages</h3>
                             <ul>{friendsWithChat.map(chat => <ChatListItem key={chat.chatId} chat={chat} />)}</ul>
                        </>
                    )}
                    {friendsWithoutChat.length > 0 && (
                        <>
                             <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 my-2 px-2">Friends</h3>
                            <ul>{friendsWithoutChat.map(user => <GlobalUserListItem key={user.uid} user={user} />)}</ul>
                        </>
                    )}
                    {!loadingAllUsers && friendsWithChat.length === 0 && friendsWithoutChat.length === 0 && (
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">
                            Find friends using the Search tab to start chatting.
                        </p>
                    )}
                </>
            )}
        </div>
    </div>
  );
};

export default Sidebar;