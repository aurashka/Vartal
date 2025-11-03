import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../App';
import { db } from '../services/firebase';
import { ref, onValue, off, runTransaction, query, orderByChild, get } from 'firebase/database';
import { Comment, AppUser } from '../types';
import Avatar from './common/Avatar';
import { HeartIcon, MoreHorizontalIcon, TrashIcon, PencilIcon, CopyIcon, ShieldIcon } from './common/Icons';
import UserBadges from './common/UserBadges';
import { Skeleton } from './common/Shimmer';
import { timeAgo } from '../utils/time';

const COMMENT_CHARACTER_LIMIT = 500;

interface CommentItemProps {
    comment: Comment;
    postId: string;
    onReply: (comment: Comment) => void;
    repliesMap: Record<string, Comment[]>;
    isPostOwner: boolean;
    isAdmin: boolean;
    onViewProfile: (user: AppUser) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, postId, onReply, repliesMap, isPostOwner, isAdmin, onViewProfile }) => {
    const { currentUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(comment.text);
    const [showMenu, setShowMenu] = useState(false);
    const [showReplies, setShowReplies] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const isOwnComment = currentUser?.uid === comment.author.uid;
    const canModify = isOwnComment || isPostOwner || isAdmin;
    const canHide = isPostOwner || isAdmin;
    const isReply = !!comment.replyTo;

    const directReplies = useMemo(() => repliesMap[comment.id] || [], [repliesMap, comment.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLike = () => {
        if (!currentUser) return;
        const likeRef = ref(db, `comments/${postId}/${comment.id}/likedBy/${currentUser.uid}`);
        runTransaction(likeRef, currentData => (currentData === null ? true : null));
    };

    const handleSaveEdit = async () => {
        if (!editedText.trim()) return;
        const commentRef = ref(db, `comments/${postId}/${comment.id}`);
        await runTransaction(commentRef, (currentData) => {
            if (currentData) {
                currentData.text = editedText;
                currentData.isEdited = true;
            }
            return currentData;
        });
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to delete this comment?")) {
            const commentRef = ref(db, `comments/${postId}/${comment.id}`);
            await runTransaction(commentRef, (currentData) => {
                 if(currentData) {
                    currentData.text = '[deleted]';
                    currentData.author = {
                        uid: '',
                        displayName: 'Deleted',
                        photoURL: '',
                    };
                 }
                 return currentData;
            });
            const postCommentsCountRef = ref(db, `posts/${postId}/commentsCount`);
            runTransaction(postCommentsCountRef, currentCount => (currentCount || 0) - 1);
            setShowMenu(false);
        }
    };
    
    const handleHideToggle = async () => {
        const commentRef = ref(db, `comments/${postId}/${comment.id}`);
        await runTransaction(commentRef, (currentData) => {
            if (currentData) {
                currentData.isHidden = !currentData.isHidden;
            }
            return currentData;
        });
        setShowMenu(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(comment.text);
        setShowMenu(false);
    };

    const handleAuthorClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!comment.author.uid) return; // for deleted comments

        try {
            const userRef = ref(db, `users/${comment.author.uid}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                onViewProfile({ uid: comment.author.uid, ...snapshot.val() } as AppUser);
            } else {
                console.warn(`User with uid ${comment.author.uid} not found.`);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    };

    const likeCount = comment.likedBy ? Object.keys(comment.likedBy).length : 0;
    const isLiked = currentUser && comment.likedBy ? !!comment.likedBy[currentUser.uid] : false;

    return (
        <div id={`comment-${comment.id}`} className={`w-full transition-colors ${comment.isHidden ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg' : ''}`}>
             {comment.isHidden && <p className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold mb-1 flex items-center gap-1.5"><ShieldIcon className="w-3 h-3"/> Hidden by moderator</p>}
            <div className="flex items-start gap-3 text-sm group">
                <div onClick={handleAuthorClick} className="cursor-pointer">
                    <Avatar photoURL={comment.author.photoURL} displayName={comment.author.displayName} className="w-8 h-8 flex-shrink-0 mt-1" />
                </div>
                <div className="flex-1">
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <textarea
                                value={editedText}
                                onChange={e => setEditedText(e.target.value)}
                                className="w-full bg-gray-100 dark:bg-gray-900 rounded-md p-2 resize-none border border-primary"
                                rows={2}
                                maxLength={COMMENT_CHARACTER_LIMIT}
                            />
                            <button onClick={handleSaveEdit} className="px-3 py-1 bg-primary text-white text-xs font-semibold rounded-md">Save</button>
                            <button onClick={() => setIsEditing(false)} className="text-xs">Cancel</button>
                        </div>
                    ) : (
                        <>
                            <p className="whitespace-pre-wrap">
                                <span onClick={handleAuthorClick} className="font-semibold flex items-center gap-1.5 cursor-pointer">
                                    {comment.author.displayName}
                                    <UserBadges badges={comment.author.badges} />
                                </span>
                                <span className="text-gray-600 dark:text-gray-300 ml-2">{comment.text}</span>
                            </p>
                            {comment.replyTo && (
                                <p className="text-xs text-primary font-medium mt-1">
                                    Replying to @{comment.replyTo.displayName}
                                </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                <span>{timeAgo(comment.timestamp)}</span>
                                {!isReply && <button onClick={() => onReply(comment)} className="font-semibold">Reply</button>}
                                {!isReply && directReplies.length > 0 && (
                                    <button onClick={() => setShowReplies(!showReplies)} className="font-semibold">
                                        <span className="mx-1">·</span>
                                        {showReplies ? 'Hide replies' : `View ${directReplies.length} replies`}
                                    </button>
                                )}
                                {comment.isEdited && <span>(edited)</span>}
                            </div>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        {canModify && <button onClick={() => setShowMenu(v => !v)} className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontalIcon className="w-4 h-4 text-gray-500"/></button>}
                        {showMenu && (
                            <div ref={menuRef} className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-2xl z-20 p-1 border border-black/5 dark:border-white/5">
                                <ul>
                                    <li onClick={handleCopy} className="flex items-center gap-2 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer"><CopyIcon className="w-4 h-4"/> Copy Text</li>
                                    {isOwnComment && <li onClick={() => { setIsEditing(true); setShowMenu(false); }} className="flex items-center gap-2 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer"><PencilIcon className="w-4 h-4"/> Edit</li>}
                                    {canHide && <li onClick={handleHideToggle} className="flex items-center gap-2 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer"><ShieldIcon className="w-4 h-4"/> {comment.isHidden ? 'Unhide' : 'Hide'}</li>}
                                    {canModify && <li onClick={handleDelete} className="text-red-500 flex items-center gap-2 p-2 hover:bg-red-500/10 rounded cursor-pointer"><TrashIcon className="w-4 h-4"/> Delete</li>}
                                </ul>
                            </div>
                        )}
                    </div>
                    <button onClick={handleLike} className="flex items-center gap-1 text-gray-500">
                        <HeartIcon className={`w-4 h-4 ${isLiked ? 'text-red-500' : ''}`} isFilled={isLiked}/>
                        {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
                    </button>
                </div>
            </div>
            {showReplies && directReplies.length > 0 && (
                <div className="pt-3 ml-5 pl-5 border-l-2 border-gray-200 dark:border-gray-700 space-y-3">
                    {directReplies.map(reply => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            postId={postId}
                            onReply={onReply}
                            repliesMap={repliesMap}
                            isPostOwner={isPostOwner}
                            isAdmin={isAdmin}
                            onViewProfile={onViewProfile}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};


interface CommentsSectionProps {
    postId: string;
    postAuthorUid: string;
    onReply: (comment: Comment) => void;
    onViewProfile: (user: AppUser) => void;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ postId, postAuthorUid, onReply, onViewProfile }) => {
    const { appUser } = useAuth();
    const [allComments, setAllComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'latest' | 'trending'>('latest');

    useEffect(() => {
        setLoading(true);
        const commentsQuery = query(ref(db, `comments/${postId}`), orderByChild('timestamp'));
        
        const unsubscribe = onValue(commentsQuery, (snapshot) => {
            if (snapshot.exists()) {
                const commentsData: Comment[] = [];
                snapshot.forEach(child => {
                    commentsData.push({ id: child.key as string, ...child.val() });
                });
                setAllComments(commentsData);
            } else {
                setAllComments([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [postId]);

    const { topLevelComments, repliesMap } = useMemo(() => {
        const isAdmin = appUser?.role === 'admin';
        const isPostOwner = appUser?.uid === postAuthorUid;
        const canViewHidden = isAdmin || isPostOwner;
        
        const visibleComments = allComments.filter(comment => !comment.isHidden || canViewHidden);

        const topLevel: Comment[] = [];
        const replies: Record<string, Comment[]> = {};
        const commentsById: Record<string, Comment> = {};

        visibleComments.forEach(comment => {
            commentsById[comment.id] = comment;
        });

        visibleComments.forEach(comment => {
            if (comment.replyTo && commentsById[comment.replyTo.commentId]) {
                if (!replies[comment.replyTo.commentId]) {
                    replies[comment.replyTo.commentId] = [];
                }
                replies[comment.replyTo.commentId].push(comment);
            } else {
                topLevel.push(comment);
            }
        });
        
        topLevel.sort((a,b) => b.timestamp - a.timestamp);
        
        return { topLevelComments: topLevel, repliesMap: replies };
    }, [allComments, appUser, postAuthorUid]);

    const sortedTopLevelComments = useMemo(() => {
        if (filter === 'trending') {
            return [...topLevelComments].sort((a, b) => {
                const likesA = a.likedBy ? Object.keys(a.likedBy).length : 0;
                const repliesA = repliesMap[a.id]?.length || 0;
                const scoreA = likesA + repliesA;
    
                const likesB = b.likedBy ? Object.keys(b.likedBy).length : 0;
                const repliesB = repliesMap[b.id]?.length || 0;
                const scoreB = likesB + repliesB;
    
                if (scoreB === scoreA) {
                    return b.timestamp - a.timestamp; // Newest of equally trending posts first
                }
    
                return scoreB - scoreA;
            });
        }
        return topLevelComments; // 'latest' is already sorted by newest first
    }, [topLevelComments, repliesMap, filter]);

    const isPostOwner = appUser?.uid === postAuthorUid;
    const isAdmin = appUser?.role === 'admin';

    return (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Comments ({allComments.length})</h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => setFilter('latest')} className={`px-3 py-1 text-xs font-semibold rounded-full ${filter === 'latest' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>Latest</button>
                    <button onClick={() => setFilter('trending')} className={`px-3 py-1 text-xs font-semibold rounded-full ${filter === 'trending' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>Trending</button>
                </div>
            </div>
            
            <div className="space-y-4">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full"/>)
                ) : sortedTopLevelComments.length === 0 ? (
                     <p className="text-sm text-gray-500 py-4 text-center">No comments yet. Be the first!</p>
                ) : (
                    sortedTopLevelComments.map(comment => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            postId={postId}
                            onReply={onReply}
                            repliesMap={repliesMap}
                            isPostOwner={isPostOwner}
                            isAdmin={isAdmin}
                            onViewProfile={onViewProfile}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default CommentsSection;