import React, { useState, useEffect } from 'react';
import { Post, Comment, AppUser } from '../types';
import PostCard from './PostCard';
import CommentsSection from './CommentsSection';
import { ChevronLeftIcon, SendIcon, XIcon } from './common/Icons';
import { useAuth } from '../App';
import { db } from '../services/firebase';
import { ref, push, serverTimestamp, runTransaction, set } from 'firebase/database';
import Avatar from './common/Avatar';

const COMMENT_CHARACTER_LIMIT = 500;

interface PostDetailViewProps {
  post: Post;
  onBack: () => void;
  onViewProfile: (user: AppUser) => void;
  highlightCommentId?: string;
}

const PostDetailView: React.FC<PostDetailViewProps> = ({ post, onBack, onViewProfile, highlightCommentId }) => {
  const { currentUser, appUser } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const commentsDisabled = post.commentSettings === 'disabled';

  useEffect(() => {
    if (highlightCommentId) {
        const element = document.getElementById(`comment-${highlightCommentId}`);
        if (element) {
            setTimeout(() => { // Timeout to allow rendering
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight');
                setTimeout(() => {
                    element.classList.remove('highlight');
                }, 2500); // Highlight duration
            }, 300);
        }
    }
  }, [highlightCommentId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser || !appUser) return;
    setIsLoading(true);
  
    const commentData: Omit<Comment, 'id'> = {
      author: {
        uid: currentUser.uid,
        displayName: appUser.displayName,
        photoURL: appUser.photoURL,
        badges: appUser.badges || [],
      },
      text: newComment,
      timestamp: serverTimestamp() as number,
    };
  
    if (replyTo) {
      commentData.replyTo = {
        commentId: replyTo.id,
        uid: replyTo.author.uid,
        displayName: replyTo.author.displayName,
      };
    }
  
    try {
      const newCommentRef = push(ref(db, `comments/${post.id}`), commentData);
      const newCommentId = newCommentRef.key;
      if (!newCommentId) throw new Error("Failed to get new comment key");
  
      // Push notification to post author (for both new comments and replies)
      if (post.author.uid !== currentUser.uid) {
        const notificationRef = push(ref(db, `notifications/${post.author.uid}`));
        set(notificationRef, {
          type: replyTo ? 'reply' : 'comment',
          fromUid: currentUser.uid,
          fromName: appUser.displayName,
          fromPhotoURL: appUser.photoURL,
          postId: post.id,
          postImageThumb: post.imageUrls?.[0]?.thumb || post.gifUrl,
          commentId: newCommentId,
          commentText: newComment,
          timestamp: serverTimestamp(),
          read: false,
        });
      }
  
      // Push notification to original commenter if it's a reply and they are not the post author
      if (replyTo && replyTo.author.uid !== currentUser.uid && replyTo.author.uid !== post.author.uid) {
        const replyNotificationRef = push(ref(db, `notifications/${replyTo.author.uid}`));
        set(replyNotificationRef, {
          type: 'reply',
          fromUid: currentUser.uid,
          fromName: appUser.displayName,
          fromPhotoURL: appUser.photoURL,
          postId: post.id,
          postImageThumb: post.imageUrls?.[0]?.thumb || post.gifUrl,
          commentId: newCommentId,
          commentText: newComment,
          timestamp: serverTimestamp(),
          read: false,
        });
      }
  
      const postCommentsCountRef = ref(db, `posts/${post.id}/commentsCount`);
      await runTransaction(postCommentsCountRef, (currentCount) => (currentCount || 0) + 1);
  
      setNewComment('');
      setReplyTo(null);
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col font-sans animate-fade-in">
      <header className="flex-shrink-0 flex items-center p-4 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-500/20">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronLeftIcon className="w-7 h-7" />
        </button>
        <h1 className="font-bold text-lg mx-auto">Post</h1>
        <div className="w-8"></div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <PostCard post={post} onViewProfile={onViewProfile} />
        {!commentsDisabled && (
          <CommentsSection postId={post.id} postAuthorUid={post.author.uid} onReply={setReplyTo} onViewProfile={onViewProfile} />
        )}
      </main>
      {!commentsDisabled && (
        <footer className="flex-shrink-0 p-2 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-gray-500/20">
          {replyTo && (
              <div className="px-2 pb-2 text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center">
                  <span>Replying to @{replyTo.author.displayName}</span>
                  <button onClick={() => setReplyTo(null)}><XIcon className="w-4 h-4"/></button>
              </div>
          )}
          <form onSubmit={handlePostComment} className="flex items-center gap-2">
              <Avatar photoURL={appUser?.photoURL} displayName={appUser?.displayName} className="w-9 h-9" />
              <div className="relative flex-1">
                  <input 
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      maxLength={COMMENT_CHARACTER_LIMIT}
                      className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-900 border-none rounded-full focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      {COMMENT_CHARACTER_LIMIT - newComment.length}
                  </span>
              </div>
              <button type="submit" disabled={isLoading || !newComment.trim()} className="p-2 bg-primary rounded-full text-white hover:bg-primary-hover disabled:opacity-50">
                  <SendIcon className="w-5 h-5"/>
              </button>
          </form>
        </footer>
      )}
    </div>
  );
};

export default PostDetailView;