import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/firebase';
import { ref, query, orderByChild, get, startAt, endAt } from 'firebase/database';
import { AppUser } from '../types';
import { useAuth } from '../App';
import Modal from './common/Modal';
import Avatar from './common/Avatar';
import { SearchIcon } from './common/Icons';
import { UserListItemSkeleton } from './common/Shimmer';
import debounce from 'lodash.debounce';

interface NewChatModalProps {
    onClose: () => void;
    onSelectUser: (user: AppUser) => void;
}

const NewChatModal: React.FC<NewChatModalProps> = ({ onClose, onSelectUser }) => {
    const { currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchUsers = useCallback(
        debounce(async (term: string) => {
            if (term.trim().length < 2) {
                setUsers([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                // Firebase RTDB queries are case-sensitive. This searches for names starting with the exact case.
                const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1);
                const usersRef = query(
                    ref(db, 'users'),
                    orderByChild('displayName'),
                    startAt(capitalizedTerm),
                    endAt(capitalizedTerm + '\uf8ff')
                );
                const snapshot = await get(usersRef);
                const fetchedUsers: AppUser[] = [];
                if (snapshot.exists()) {
                    snapshot.forEach(child => {
                        if (child.key !== currentUser?.uid) {
                            fetchedUsers.push({ uid: child.key!, ...child.val() });
                        }
                    });
                }
                setUsers(fetchedUsers);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setLoading(false);
            }
        }, 300),
    [currentUser]);

    useEffect(() => {
        if (searchTerm.trim().length >= 2) {
             setLoading(true);
        }
        fetchUsers(searchTerm);
        return () => fetchUsers.cancel();
    }, [searchTerm, fetchUsers]);


    return (
        <Modal title="New Message" onClose={onClose}>
            <div className="relative mb-4">
                <input
                    type="text"
                    placeholder="Search people..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-900 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="max-h-80 overflow-y-auto">
                {loading && <UserListItemSkeleton />}
                {!loading && users.length === 0 && searchTerm.length > 1 && (
                    <p className="text-center text-gray-500 py-4">No users found.</p>
                )}
                 {!loading && users.length === 0 && searchTerm.length <= 1 && (
                    <p className="text-center text-gray-500 py-4">Enter at least 2 characters to search.</p>
                )}
                <ul>
                    {users.map(user => (
                        <li key={user.uid} onClick={() => onSelectUser(user)} className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
                            <Avatar photoURL={user.photoURL} displayName={user.displayName} className="w-10 h-10 mr-3" />
                            <div>
                                <p className="font-semibold">{user.displayName}</p>
                                {user.handle && <p className="text-sm text-gray-500">@{user.handle}</p>}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    );
};

export default NewChatModal;
