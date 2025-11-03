import React, { useState, useRef } from 'react';
import { AppUser, Message, UserChat } from '../types';
import { db } from '../services/firebase';
import { ref, update, push, get, set } from 'firebase/database';
import { useAuth } from '../App';
import { ReplyIcon, ForwardIcon, CopyIcon, TrashIcon, PencilIcon, CheckCircleIcon, CheckCheckIcon } from './common/Icons';
import Modal from './common/Modal';
import Avatar from './common/Avatar';
import UserBadges from './common/UserBadges';
import { formatMessageTime } from '../utils/time';

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MessageStatus: React.FC<{ message: Message, recipient: AppUser }> = ({ message, recipient }) => {
    if (message.senderId === 'deleted_user') return null;
    const isRead = !!message.readBy?.[recipient.uid];
    
    if (isRead) {
        return <CheckCheckIcon className="w-4 h-4 text-blue-400" />;
    }
    // Simple "sent" check. A "delivered" status would require a more complex presence system.
    return <CheckCircleIcon className="w-4 h-4 text-gray-400" />;
};

const renderTextWithEntities = (text: string) => {
    const regex = /(https?:\/\/[^\s]+)|(@[a-zA-Z0-9_]+)/g;
    const parts = text.split(regex).filter(part => part);

    return parts.map((part, index) => {
        if (part.match(/^https?:\/\//)) {
            return <a key={index} href={part} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-400 hover:underline">{part}</a>;
        }
        if (part.match(/^@[a-zA-Z0-9_]+/)) {
            return <strong key={index} className="text-blue-400 cursor-pointer" onClick={e => e.stopPropagation()}>{part}</strong>;
        }
        return <span key={index}>{part}</span>;
    });
};

interface MessageProps {
  message: Message;
  isOwnMessage: boolean;
  onReply: (message: Message) => void;
  onSelectReaction: (emoji: string, message: Message) => void;
  onToggleHeart: (message: Message) => void;
  onScrollToMessage: (messageId: string) => void;
  highlighted: boolean;
  chatId: string;
  recipient: AppUser;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForEveryone: (message: Message) => void;
  onOpenImageViewer: (imageUrl: string) => void;
}

const MenuItem: React.FC<{ icon: React.ReactNode; children: React.ReactNode; onClick: () => void; className?: string; }> = ({ icon, children, onClick, className = '' }) => (
    <li onClick={onClick} className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-lg ${className}`}>
        <div className="text-gray-600 dark:text-gray-300">{icon}</div>
        <span className="font-medium text-lg">{children}</span>
    </li>
);

const MessageComponent: React.FC<MessageProps> = (props) => {
  const { message, isOwnMessage, onReply, onSelectReaction, onToggleHeart, onScrollToMessage, highlighted, chatId, recipient, onDeleteForMe, onDeleteForEveryone, onOpenImageViewer } = props;
  const { currentUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.text);
  const [userChats, setUserChats] = useState<UserChat[]>([]);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setIsMenuOpen(false);
  };
  
  const handleOpenForward = async () => {
    setIsMenuOpen(false);
    if (!currentUser) return;
    const userChatsRef = ref(db, `userChats/${currentUser.uid}`);
    get(userChatsRef).then(snapshot => {
        if(snapshot.exists()){
            setUserChats(Object.values(snapshot.val()));
        }
    });
    setShowForwardModal(true);
  };

  const handleForward = async (selectedChatId: string) => {
    const { id, readBy, ...messageContent } = message;
    
    const cleanMessageContent = JSON.parse(JSON.stringify(messageContent));
    
    const forwardedMessage = {
        ...cleanMessageContent,
        isForwarded: true,
        timestamp: Date.now(),
        reactions: null 
    };

    const newMsgRef = push(ref(db, `messages/${selectedChatId}`));
    await set(newMsgRef, forwardedMessage);
    setShowForwardModal(false);
  };
  
  const handleEdit = () => {
    setIsEditing(true);
    setIsMenuOpen(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedText(message.text);
  };

  const handleSaveEdit = async () => {
    if (!editedText.trim() || editedText === message.text) {
        setIsEditing(false);
        return;
    }
    const messageRef = ref(db, `messages/${chatId}/${message.id}`);
    await update(messageRef, {
        text: editedText,
        isEdited: true,
    });
    setIsEditing(false);
  };

  const handleReactionClick = (emoji: string) => {
    onSelectReaction(emoji, message);
    setIsMenuOpen(false);
  }

  const isDeleted = message.senderId === 'deleted_user';
  const hasOnlyImages = !message.text && message.imageUrls && message.imageUrls.length > 0;

  const messageClasses = isOwnMessage
    ? 'bg-primary text-white rounded-t-2xl rounded-bl-2xl'
    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-t-2xl rounded-br-2xl';
  const bubbleStyle = hasOnlyImages 
    ? 'p-0 bg-transparent shadow-none' 
    : `p-3 shadow-md ${messageClasses}`;
    
  const time = formatMessageTime(message.timestamp);

  const renderImageStack = (urls: string[]) => {
    const count = urls.length;
    if (count === 0) return null;

    const ImageItem: React.FC<{url: string, className?: string, children?: React.ReactNode}> = ({url, className, children}) => (
        <div onClick={(e) => { e.stopPropagation(); onOpenImageViewer(url); }} className={`relative cursor-pointer bg-gray-200 dark:bg-gray-800 ${className || ''}`}>
            <img src={url} alt="sent content" className="w-full h-full object-cover"/>
            {children}
        </div>
    );
    
    if (count === 1) return <ImageItem url={urls[0]} className="rounded-lg mb-2 max-h-80 object-cover"/>
    
    let gridClass = 'grid-cols-2 grid-rows-2';
    if (count === 2) gridClass = 'grid-cols-2 grid-rows-1';
    if (count === 3) gridClass = 'grid-cols-2 grid-rows-2';
    
    return (
        <div className={`grid ${gridClass} gap-0.5 aspect-square rounded-lg overflow-hidden ${message.text ? 'mb-2' : ''}`}>
            {count === 3 ? (
                <>
                    <ImageItem url={urls[0]} className="row-span-2"/>
                    <ImageItem url={urls[1]} />
                    <ImageItem url={urls[2]} />
                </>
            ) : (
                urls.slice(0,4).map((url, index) => (
                    <ImageItem key={index} url={url}>
                        {index === 3 && count > 4 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-2xl font-bold">
                                +{count - 4}
                            </div>
                        )}
                    </ImageItem>
                ))
            )}
        </div>
    )
  };
  
  const messageContent = () => (
     <>
        {message.isForwarded && <p className="text-xs text-gray-200 dark:text-gray-300 italic mb-1">Forwarded</p>}
        {message.replyTo && (
            <div onClick={(e) => { e.stopPropagation(); onScrollToMessage(message.replyTo!.messageId); }} className={`p-2 rounded-md mb-2 border-l-4 cursor-pointer ${isOwnMessage ? 'bg-white/20 border-white/50' : 'bg-black/10 dark:bg-white/10 border-primary'}`}>
                <p className="font-bold text-sm text-primary flex items-center gap-1.5">
                    {message.replyTo.senderName}
                    <UserBadges badges={message.replyTo.senderBadges} />
                </p>
                <p className={`text-sm truncate ${isOwnMessage ? 'text-gray-100' : 'text-gray-800 dark:text-gray-200'}`}>{message.replyTo.text}</p>
            </div>
        )}
        {message.imageUrls && renderImageStack(message.imageUrls)}
        {message.text && !isDeleted ? (
          <p className="whitespace-pre-wrap">{renderTextWithEntities(message.text)}</p>
        ) : (
          isDeleted && <p className="italic text-gray-200 dark:text-gray-400">This message was deleted</p>
        )}
        {!isDeleted && !hasOnlyImages && (
            <div className={`flex items-center justify-end gap-1.5 float-right mt-1 ml-2 ${isOwnMessage ? 'text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                {message.isEdited && <span className="text-xs italic">(edited)</span>}
                <span className="text-xs">{time}</span>
                {isOwnMessage && <MessageStatus message={message} recipient={recipient} />}
            </div>
        )}

        {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="absolute -bottom-3 right-2 flex gap-1 z-10">
                {Object.entries(message.reactions).map(([emoji, uids]: [string, string[]]) => uids.length > 0 && (
                    <button key={emoji} onClick={(e) => { e.stopPropagation(); onSelectReaction(emoji, message); }} className="bg-white dark:bg-gray-600 px-2 py-0.5 rounded-full text-sm shadow-lg hover:scale-110 transition-transform">
                        {emoji} {uids.length}
                    </button>
                ))}
            </div>
        )}
     </>
  );
  
  const editingContent = () => (
     <div>
        <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full bg-white/20 dark:bg-black/20 text-inherit rounded-md p-2 resize-none border border-white/50 focus:outline-none focus:ring-2 focus:ring-white"
            rows={3}
            autoFocus
        />
        <div className="flex justify-end gap-2 mt-2">
            <button onClick={handleCancelEdit} className="px-3 py-1 text-xs font-semibold rounded-md hover:bg-white/10">Cancel</button>
            <button onClick={handleSaveEdit} className="px-3 py-1 text-xs font-semibold rounded-md bg-white text-primary">Save</button>
        </div>
     </div>
  );

  return (
    <>
      <div 
        id={message.id} 
        className={`flex items-end gap-2 my-1 ${isOwnMessage ? 'flex-row-reverse' : ''} ${highlighted ? 'bg-primary/10 rounded-lg' : ''} group`}
        onClick={() => !isEditing && !isDeleted && setIsMenuOpen(true)}
      >
        <div 
            onDoubleClick={() => !isEditing && !isDeleted && onToggleHeart(message)}
            className={`relative max-w-xs lg:max-w-md transition-colors duration-1000 ${isDeleted ? 'bg-gray-100 dark:bg-gray-800 p-3' : bubbleStyle} ${!isDeleted ? 'cursor-pointer' : ''}`}
        >
            {isEditing ? editingContent() : messageContent()}
        </div>
      </div>
      
      {isMenuOpen && (
          <Modal title="Actions" onClose={() => setIsMenuOpen(false)} position="bottom">
              <div className="flex justify-around p-4 border-b border-black/10 dark:border-white/10">
                {EMOJI_REACTIONS.map(emoji => (
                  <button key={emoji} onClick={() => handleReactionClick(emoji)} className="text-4xl hover:scale-125 transition-transform">{emoji}</button>
                ))}
              </div>
              <ul className="space-y-1">
                  <MenuItem icon={<ReplyIcon className="w-6 h-6"/>} onClick={() => { onReply(message); setIsMenuOpen(false); }}>Reply</MenuItem>
                  <MenuItem icon={<ForwardIcon className="w-6 h-6"/>} onClick={handleOpenForward}>Forward</MenuItem>
                  {message.text && <MenuItem icon={<CopyIcon className="w-6 h-6"/>} onClick={handleCopy}>Copy Text</MenuItem>}
                  {isOwnMessage && <MenuItem icon={<PencilIcon className="w-6 h-6"/>} onClick={handleEdit}>Edit</MenuItem>}
                  <MenuItem icon={<TrashIcon className="w-6 h-6"/>} onClick={() => { setIsMenuOpen(false); setShowDeleteConfirm(true); }} className="text-red-500">Delete</MenuItem>
              </ul>
          </Modal>
      )}

      {showForwardModal && (
        <Modal title="Forward to..." onClose={() => setShowForwardModal(false)}>
            <ul>
                {userChats.map(chat => (
                    <li key={chat.chatId} onClick={() => handleForward(chat.chatId)} className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
                        <Avatar photoURL={chat.userInfo.photoURL} displayName={chat.userInfo.displayName} className="w-10 h-10 mr-3"/>
                        <span>{chat.userInfo.displayName}</span>
                    </li>
                ))}
            </ul>
        </Modal>
      )}
      
      {showDeleteConfirm && (
        <Modal title="Delete Message?" onClose={() => setShowDeleteConfirm(false)}>
            <div className="p-4 space-y-3 flex flex-col items-center">
                <p className="text-center text-gray-700 dark:text-gray-300">This action cannot be undone.</p>
                {isOwnMessage && (
                    <button 
                        onClick={() => { onDeleteForEveryone(message); setShowDeleteConfirm(false); }}
                        className="w-full max-w-xs py-3 text-lg font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Delete for Everyone
                    </button>
                )}
                <button 
                    onClick={() => { onDeleteForMe(message.id); setShowDeleteConfirm(false); }}
                    className="w-full max-w-xs py-3 text-lg font-semibold text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                    Delete for Me
                </button>
                <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="w-full max-w-xs py-2 mt-2 text-sm font-semibold text-gray-600 dark:text-gray-400"
                >
                    Cancel
                </button>
            </div>
        </Modal>
      )}
    </>
  );
};

export default MessageComponent;
