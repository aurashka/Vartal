import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ref, onValue, off, push, serverTimestamp, set, update, onDisconnect, runTransaction } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../App';
import { AppUser, Message, PostImage } from '../types';
import MessageComponent from './Message';
import { SendIcon, PaperclipIcon, XIcon, ChevronLeftIcon, DownloadIcon, ReplyIcon, MapPinIcon, BanIcon, UserIcon, TrashIcon, GridIcon, CheckCircleIcon } from './common/Icons';
import { uploadMultipleImages } from '../services/imageUploadService';
import Avatar from './common/Avatar';
import { MessageSkeleton, Skeleton } from './common/Shimmer';
import UserBadges from './common/UserBadges';
import { formatLastSeen, formatDateSeparator, isSameDay } from '../utils/time';
import Modal from './common/Modal';

// Sound files from a reliable Google CDN
const SENT_SOUND = 'https://storage.googleapis.com/web-dev-assets/meet-the-web/sounds/sent.mp3';
const RECEIVED_SOUND = 'https://storage.googleapis.com/web-dev-assets/meet-the-web/sounds/received.mp3';

const ChatProfileSheet: React.FC<{
    recipient: AppUser;
    messages: Message[];
    onBack: () => void;
    onViewFullProfile: (user: AppUser) => void;
}> = ({ recipient, messages, onBack, onViewFullProfile }) => {
    const { currentUser, appUser, following } = useAuth();
    const [activeTab, setActiveTab] = useState<'media' | 'links'>('media');
    const [confirmAction, setConfirmAction] = useState<'block' | 'unblock' | 'unfollow' | 'clear' | null>(null);

    const isFollowing = useMemo(() => !!(following && recipient && following[recipient.uid]), [following, recipient]);
    const isBlockedByMe = useMemo(() => !!appUser?.blockedUsers?.[recipient.uid], [appUser, recipient.uid]);

    const handleFollowToggle = () => {
        if (!currentUser || !recipient) return;
        
        if (isFollowing) {
           setConfirmAction('unfollow');
        } else {
            const updates: { [key: string]: any } = {};
            updates[`/following/${currentUser.uid}/${recipient.uid}`] = true;
            updates[`/followers/${recipient.uid}/${currentUser.uid}`] = true;
            update(ref(db), updates);
        }
    };
    
    const executeConfirmAction = () => {
        if (!currentUser || !recipient) return;
        const updates: { [key: string]: any } = {};

        switch(confirmAction) {
            case 'block':
                updates[`/users/${currentUser.uid}/blockedUsers/${recipient.uid}`] = true;
                update(ref(db), updates);
                break;
            case 'unblock':
                updates[`/users/${currentUser.uid}/blockedUsers/${recipient.uid}`] = null;
                update(ref(db), updates);
                break;
            case 'unfollow':
                updates[`/following/${currentUser.uid}/${recipient.uid}`] = null;
                updates[`/followers/${recipient.uid}/${currentUser.uid}`] = null;
                update(ref(db), updates);
                break;
            case 'clear':
                const chatId = [currentUser.uid, recipient.uid].sort().join('_');
                const userDeletedMessagesRef = ref(db, `users/${currentUser.uid}/deletedMessages/${chatId}`);
                const messageIdsToDelete = messages.reduce((acc, msg) => ({...acc, [msg.id]: true}), {});
                set(userDeletedMessagesRef, messageIdsToDelete);
                break;
        }
        setConfirmAction(null);
    };

    const getConfirmModalContent = () => {
        switch (confirmAction) {
            case 'block':
                return {
                    title: `Block ${recipient.displayName}?`,
                    description: "They won't be able to send you messages or call you. They won't be notified.",
                    confirmText: 'Block',
                    confirmClass: 'bg-red-600 text-white hover:bg-red-700'
                };
            case 'unblock':
                 return {
                    title: `Unblock ${recipient.displayName}?`,
                    description: "They will be able to message you again.",
                    confirmText: 'Unblock',
                    confirmClass: 'bg-primary text-white hover:bg-primary-hover'
                };
            case 'unfollow':
                return {
                    title: `Unfollow ${recipient.displayName}?`,
                    description: "Their posts will no longer appear in your feed.",
                    confirmText: 'Unfollow',
                    confirmClass: 'bg-red-600 text-white hover:bg-red-700'
                };
            case 'clear':
                return {
                    title: `Clear chat history?`,
                    description: `This will permanently remove all messages with ${recipient.displayName} from your device. This cannot be undone.`,
                    confirmText: 'Clear Chat',
                    confirmClass: 'bg-red-600 text-white hover:bg-red-700'
                };
            default:
                return null;
        }
    }
    const modalContent = getConfirmModalContent();

    const mediaMessages = useMemo(() => {
        return messages.flatMap(msg => msg.imageUrls?.map(url => ({ url, id: msg.id })) || []);
    }, [messages]);
    
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const links = useMemo(() => {
        return messages.reduce((acc: {url: string, id: string}[], msg) => {
            const foundLinks = msg.text.match(linkRegex);
            if (foundLinks) {
                return [...acc, ...foundLinks.map(url => ({ url, id: msg.id }))];
            }
            return acc;
        }, []);
    }, [messages]);

    const ActionButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; className?: string }> = ({ icon, label, onClick, className = '' }) => (
        <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1.5 text-center ${className}`}>
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">{icon}</div>
            <span className="text-xs font-semibold">{label}</span>
        </button>
    );

    return (
        <>
        <div className="flex flex-col h-full bg-white dark:bg-black">
            <header className="flex-shrink-0 sticky top-0 z-10 flex items-center p-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-500/20">
                <button onClick={onBack} className="mr-4 p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 rounded-full">
                    <ChevronLeftIcon className="w-6 h-6"/>
                </button>
                <h2 className="text-xl font-semibold">Profile</h2>
            </header>
            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex flex-col items-center text-center">
                    <Avatar photoURL={recipient.photoURL} displayName={recipient.displayName} className="w-24 h-24 mb-4" />
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold">{recipient.displayName}</h1>
                        <UserBadges badges={recipient.badges} />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">@{recipient.handle}</p>
                    {recipient.bio && <p className="mt-2 text-sm max-w-md">{recipient.bio}</p>}
                    {recipient.location && <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-2"><MapPinIcon className="w-3 h-3"/>{recipient.location}</p>}
                </div>
                
                <div className="grid grid-cols-4 gap-2 text-gray-700 dark:text-gray-300">
                    {isBlockedByMe ? (
                        <ActionButton icon={<CheckCircleIcon className="w-6 h-6"/>} label="Unblock" onClick={() => setConfirmAction('unblock')} className="text-green-500" />
                    ) : (
                        <ActionButton icon={<BanIcon className="w-6 h-6"/>} label="Block" onClick={() => setConfirmAction('block')} className="text-red-500" />
                    )}
                    <ActionButton icon={<TrashIcon className="w-6 h-6"/>} label="Clear Chat" onClick={() => setConfirmAction('clear')} />
                    <ActionButton icon={<UserIcon className="w-6 h-6"/>} label={isFollowing ? "Following" : "Follow"} onClick={handleFollowToggle} />
                    <ActionButton icon={<UserIcon className="w-6 h-6"/>} label="View Profile" onClick={() => onViewFullProfile(recipient)} />
                </div>
                
                <div>
                    <div className="flex border-b border-gray-200 dark:border-gray-800">
                        <button onClick={() => setActiveTab('media')} className={`flex-1 py-3 text-sm font-semibold relative ${activeTab === 'media' ? 'text-primary' : 'text-gray-500'}`}>
                            Shared Media
                            {activeTab === 'media' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>}
                        </button>
                         <button onClick={() => setActiveTab('links')} className={`flex-1 py-3 text-sm font-semibold relative ${activeTab === 'links' ? 'text-primary' : 'text-gray-500'}`}>
                            Shared Links
                            {activeTab === 'links' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>}
                        </button>
                    </div>
                    <div className="py-4">
                        {activeTab === 'media' && (
                            mediaMessages.length > 0 ? (
                                <div className="grid grid-cols-3 gap-1">
                                    {mediaMessages.map((media, index) => (
                                        <img key={`${media.id}-${index}`} src={media.url} alt="shared media" className="w-full aspect-square object-cover rounded bg-gray-200 dark:bg-gray-800" />
                                    ))}
                                </div>
                            ) : <p className="text-center text-sm text-gray-500">No media shared yet.</p>
                        )}
                        {activeTab === 'links' && (
                           links.length > 0 ? (
                                <ul className="space-y-2">
                                    {links.map((link, index) => (
                                        <li key={`${link.id}-${index}`} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm truncate block">{link.url}</a>
                                        </li>
                                    ))}
                                </ul>
                           ) : <p className="text-center text-sm text-gray-500">No links shared yet.</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
        {modalContent && (
            <Modal title={modalContent.title} onClose={() => setConfirmAction(null)}>
                <div className="p-4 text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{modalContent.description}</p>
                    <div className="flex justify-center gap-4 mt-6">
                        <button 
                            onClick={() => setConfirmAction(null)}
                            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={executeConfirmAction}
                            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${modalContent.confirmClass}`}
                        >
                            {modalContent.confirmText}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
        </>
    );
};


const ImageViewer: React.FC<{
    images: { url: string; message: Message }[];
    startIndex: number;
    onClose: () => void;
    onReply: (message: Message) => void;
}> = ({ images, startIndex, onClose, onReply }) => {
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const thumbnailContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') goPrev();
            if (e.key === 'ArrowRight') goNext();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [images]);
    
    useEffect(() => {
        // Scroll thumbnail into view
        thumbnailContainerRef.current?.children[currentIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });
    }, [currentIndex]);

    const goPrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex(i => (i - 1 + images.length) % images.length);
    };

    const goNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex(i => (i + 1) % images.length);
    };

    const currentItem = images[currentIndex];
    if (!currentItem) return null;

    const handleSave = async () => {
        try {
            const response = await fetch(currentItem.url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const fileName = currentItem.url.split('/').pop()?.split('#')[0].split('?')[0] || 'image.jpg';
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            console.error('Failed to save image:', err);
            alert('Could not save image.');
        }
    };

    const handleReply = () => {
        onReply(currentItem.message);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col animate-fade-in" onClick={onClose}>
            <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
                <div className="absolute top-4 left-4 text-white text-sm font-semibold bg-black/40 px-3 py-1 rounded-full">
                    {currentIndex + 1} / {images.length}
                </div>
                <img
                    src={currentItem.url}
                    alt="Full view"
                    className="max-w-full max-h-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                />
                <button onClick={goPrev} className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 transition-colors"><ChevronLeftIcon className="w-8 h-8"/></button>
                <button onClick={goNext} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 transition-colors"><ChevronLeftIcon className="w-8 h-8 transform rotate-180"/></button>
            </div>

            <div className="flex-shrink-0 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-center gap-8 p-4 bg-black/30">
                    <button onClick={handleSave} className="flex flex-col items-center gap-1 text-white font-semibold text-sm">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"><DownloadIcon className="w-6 h-6"/></div>
                        <span>Save</span>
                    </button>
                    <button onClick={handleReply} className="flex flex-col items-center gap-1 text-white font-semibold text-sm">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"><ReplyIcon className="w-6 h-6"/></div>
                        <span>Reply</span>
                    </button>
                </div>
                <div className="p-2 bg-black/50">
                    <div ref={thumbnailContainerRef} className="flex justify-start gap-2 overflow-x-auto pb-1">
                        {images.map((img, index) => (
                            <img
                                key={index}
                                src={img.url}
                                onClick={() => setCurrentIndex(index)}
                                className={`w-16 h-16 object-cover rounded-md cursor-pointer border-2 flex-shrink-0 ${currentIndex === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


interface ChatWindowProps {
  recipient: AppUser;
  onBack: () => void;
  onViewProfile: (user: AppUser) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ recipient, onBack, onViewProfile }) => {
  const { currentUser, appUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialMessagesLoading, setInitialMessagesLoading] = useState(true);
  const [liveRecipient, setLiveRecipient] = useState<AppUser>(recipient);
  const [recipientIsTyping, setRecipientIsTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [deletedForMeIds, setDeletedForMeIds] = useState<Set<string>>(new Set());
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isProfileVisible, setProfileVisible] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentSoundRef = useRef<HTMLAudioElement | null>(null);
  const receivedSoundRef = useRef<HTMLAudioElement | null>(null);
  const prevMessagesLengthRef = useRef(0);

  const isBlockedByMe = useMemo(() => !!appUser?.blockedUsers?.[recipient.uid], [appUser, recipient.uid]);
  const amIBlocked = useMemo(() => !!liveRecipient?.blockedUsers?.[currentUser?.uid], [liveRecipient, currentUser]);

  const confirmUnblockUser = () => {
      if (!currentUser || !recipient) return;
      const updates: { [key: string]: any } = {};
      updates[`/users/${currentUser.uid}/blockedUsers/${recipient.uid}`] = null;
      update(ref(db), updates).then(() => {
          setShowUnblockConfirm(false);
      });
  };

  const chatId = currentUser && recipient 
    ? [currentUser.uid, recipient.uid].sort().join('_') 
    : null;

  const myTypingRef = chatId && currentUser ? ref(db, `typing/${chatId}/${currentUser.uid}`) : null;

  // --- Data & Presence Effects ---
  useEffect(() => {
    const userRef = ref(db, `users/${recipient.uid}`);
    const listener = onValue(userRef, (snapshot) => {
        if(snapshot.exists()){
            setLiveRecipient(snapshot.val());
        }
    });
    return () => off(userRef, 'value', listener);
  }, [recipient.uid]);

  useEffect(() => {
    if (!chatId) return;
    const recipientTypingRef = ref(db, `typing/${chatId}/${recipient.uid}`);
    const listener = onValue(recipientTypingRef, (snapshot) => {
        setRecipientIsTyping(snapshot.exists() && snapshot.val() === true);
    });
    return () => off(recipientTypingRef, 'value', listener);
  }, [chatId, recipient.uid]);

  useEffect(() => {
    if (myTypingRef) {
        onDisconnect(myTypingRef).remove();
    }
    return () => {
        if (myTypingRef) {
            set(myTypingRef, null);
        }
    };
  }, [myTypingRef]);

  useEffect(() => {
    if (!chatId) return;
    setInitialMessagesLoading(true);
    const messagesRef = ref(db, `messages/${chatId}`);
    const listener = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      const loadedMessages: Message[] = data ? Object.entries(data).map(([key, value]) => ({ id: key, ...(value as Omit<Message, 'id'>) })) : [];
      loadedMessages.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(loadedMessages);
      setInitialMessagesLoading(false);
    });

    return () => off(messagesRef, 'value', listener);
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !currentUser) return;

    const deletedMessagesRef = ref(db, `users/${currentUser.uid}/deletedMessages/${chatId}`);
    const listener = onValue(deletedMessagesRef, (snapshot) => {
        if (snapshot.exists()) {
            setDeletedForMeIds(new Set(Object.keys(snapshot.val())));
        } else {
            setDeletedForMeIds(new Set());
        }
    });

    return () => off(deletedMessagesRef, 'value', listener);
  }, [chatId, currentUser]);

  // --- UI & UX Effects ---
  useEffect(() => {
    if (!initialMessagesLoading) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, initialMessagesLoading]);
  
  // Read receipts and received sound effect
  useEffect(() => {
    if (!chatId || !currentUser) return;

    // Reset my unread count since I'm viewing the chat
    const myUnreadCountRef = ref(db, `userChats/${currentUser.uid}/${chatId}/unreadCount`);
    set(myUnreadCountRef, null);

    const updates: { [key: string]: any } = {};
    let hasUnread = false;

    messages.forEach(msg => {
        if (msg.senderId === recipient.uid && !msg.readBy?.[currentUser.uid]) {
            updates[`/messages/${chatId}/${msg.id}/readBy/${currentUser.uid}`] = true;
            hasUnread = true;
        }
    });
    if (hasUnread) {
        update(ref(db), updates);
        if (messages.length > prevMessagesLengthRef.current) {
             receivedSoundRef.current?.play().catch((e: any) => console.error("Error playing sound:", e));
        }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, chatId, currentUser, recipient.uid]);
  
  const itemsToRender = useMemo(() => {
    const visibleMessages = messages.filter(msg => !deletedForMeIds.has(msg.id));
    const items: (Message | { type: 'separator'; text: string; id: string })[] = [];
    if (!visibleMessages.length) return items;

    const firstUnreadId = visibleMessages.find(m => m.senderId === recipient.uid && !m.readBy?.[currentUser?.uid])?.id;
    let unreadSeparatorAdded = false;
    let lastMessageDate: Date | null = null;

    visibleMessages.forEach((message) => {
        const messageDate = new Date(message.timestamp);
        
        // Add date separator if the day has changed
        if (!lastMessageDate || !isSameDay(lastMessageDate, messageDate)) {
             items.push({ type: 'separator', text: formatDateSeparator(message.timestamp), id: `date-${message.timestamp}` });
        }
        
        // Add unread separator before the first unread message
        if (firstUnreadId === message.id && !unreadSeparatorAdded) {
            items.push({ type: 'separator', text: 'Unread Messages', id: 'unread-separator' });
            unreadSeparatorAdded = true;
        }
        
        items.push(message);
        lastMessageDate = messageDate;
    });

    return items;
  }, [messages, currentUser?.uid, recipient.uid, deletedForMeIds]);

  const allImageMessages = useMemo(() => {
    return messages
        .filter(msg => msg.imageUrls && msg.imageUrls.length > 0)
        .flatMap(msg => msg.imageUrls!.map(url => ({ url, message: msg })));
  }, [messages]);


  // --- Handlers ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && imageFiles.length === 0) || !chatId || !currentUser || !appUser) return;

    setLoading(true);
    if(myTypingRef) {
        set(myTypingRef, null);
        setIsTyping(false);
        if(typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
    let uploadedImageUrls: PostImage[] = [];

    if(imageFiles.length > 0) {
        uploadedImageUrls = await uploadMultipleImages(imageFiles, () => {});
        if(uploadedImageUrls.length !== imageFiles.length) {
            alert("Some images failed to upload.");
        }
    }

    const messagesRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messagesRef);

    const messageData: any = {
      senderId: currentUser.uid,
      text: newMessage,
      timestamp: serverTimestamp() as any,
    };
    
    if (uploadedImageUrls.length > 0) {
      messageData.imageUrls = uploadedImageUrls.map(img => img.full);
    }
    
    if (replyTo) {
      const originalSenderIsMe = replyTo.senderId === currentUser.uid;
      const senderUser = originalSenderIsMe ? appUser : recipient;

      const replyToText = replyTo.text || (replyTo.imageUrls && replyTo.imageUrls.length > 0 ? `Image${replyTo.imageUrls.length > 1 ? 's' : ''}` : 'A message');

      const replyToData: any = {
        messageId: replyTo.id,
        senderName: originalSenderIsMe ? "You" : recipient.displayName,
        text: replyToText,
      };

      if (senderUser && senderUser.badges) {
        replyToData.senderBadges = senderUser.badges;
      }

      if (replyTo.imageUrls) {
        replyToData.imageUrls = replyTo.imageUrls;
      }
      messageData.replyTo = replyToData;
    }

    await set(newMessageRef, messageData);
    sentSoundRef.current?.play().catch(e => console.error("Error playing sound:", e));

    const lastMessage = {
        text: newMessage || `${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''}`,
        timestamp: Date.now()
    }

    // Atomically update recipient's chat list and unread count
    const recipientUserChatRef = ref(db, `userChats/${recipient.uid}/${chatId}`);
    runTransaction(recipientUserChatRef, (chat) => {
        if (chat) {
            chat.lastMessage = lastMessage;
            chat.unreadCount = (chat.unreadCount || 0) + 1;
        } else {
            chat = { chatId, userInfo: appUser, lastMessage, unreadCount: 1 };
        }
        return chat;
    });

    // Update my own chat list entry (non-transactional is fine here)
    await set(ref(db, `userChats/${currentUser.uid}/${chatId}`), { chatId, userInfo: recipient, lastMessage });

    setNewMessage('');
    setImageFiles([]);
    setImagePreviews([]);
    setReplyTo(null);
    setLoading(false);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setImageFiles(prev => [...prev, ...files]);
      // FIX: Explicitly cast `file` to `Blob` to resolve a potential type inference issue with URL.createObjectURL.
      const newPreviews = files.map(file => URL.createObjectURL(file as Blob));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
     if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSetReply = (message: Message) => {
    setReplyTo(message);
  }

  const handleTyping = (text: string) => {
    setNewMessage(text);
    if (myTypingRef) {
        if(text.length > 0 && !isTyping) {
            set(myTypingRef, true);
            setIsTyping(true);
        }
        if(typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            set(myTypingRef, null);
            setIsTyping(false);
        }, 3000);
    }
  }

  const handleReaction = (emoji: string, message: Message) => {
    if (!currentUser || !chatId) return;

    const reactionsRef = ref(db, `messages/${chatId}/${message.id}/reactions`);

    runTransaction(reactionsRef, (currentReactions) => {
        const reactions = currentReactions || {};
        let userAlreadyReactedWithEmoji = false;

        // Check if the user is just toggling off their existing reaction of the same emoji
        if (reactions[emoji] && reactions[emoji].includes(currentUser.uid)) {
            userAlreadyReactedWithEmoji = true;
        }

        // Remove user's previous reaction(s), if any
        Object.keys(reactions).forEach(key => {
            if (reactions[key]) {
                const userIndex = reactions[key].indexOf(currentUser.uid);
                if (userIndex > -1) {
                    reactions[key].splice(userIndex, 1);
                    if (reactions[key].length === 0) {
                        delete reactions[key];
                    }
                }
            }
        });

        // If the user was not toggling off, add the new reaction
        if (!userAlreadyReactedWithEmoji) {
            if (!reactions[emoji]) {
                reactions[emoji] = [];
            }
            reactions[emoji].push(currentUser.uid);
        }
        
        return reactions;
    });
  };

  const handleDeleteForMe = async (messageId: string) => {
    if (!currentUser || !chatId) return;
    const deleteRef = ref(db, `users/${currentUser.uid}/deletedMessages/${chatId}/${messageId}`);
    await set(deleteRef, true);
  };

  const handleDeleteForEveryone = async (message: Message) => {
    if (!chatId || !currentUser) return;

    if (message.senderId !== currentUser.uid) {
        console.warn("Attempted to delete another user's message for everyone.");
        return;
    }

    // Completely remove the message node from the database.
    await set(ref(db, `messages/${chatId}/${message.id}`), null);
  };

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(messageId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 1500);
    }
  };

  const handleOpenImageViewer = (imageUrl: string) => {
    const index = allImageMessages.findIndex(item => item.url === imageUrl);
    if (index !== -1) {
        setSelectedImageIndex(index);
        setIsImageViewerOpen(true);
    }
  };

  if (!recipient) return null;
  
  if (isProfileVisible) {
      return (
          <ChatProfileSheet 
              recipient={liveRecipient}
              messages={messages}
              onBack={() => setProfileVisible(false)}
              onViewFullProfile={onViewProfile}
          />
      );
  }

  const isReplyingToSelf = replyTo?.senderId === currentUser?.uid;
  const replyToSenderName = isReplyingToSelf ? "Yourself" : recipient.displayName;
  const replyToSenderBadges = isReplyingToSelf ? appUser?.badges : recipient.badges;

  const renderStatus = () => {
    if (recipientIsTyping) return <p className="text-sm text-primary animate-pulse">typing...</p>;
    if (liveRecipient.status === 'online') return <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"></div><p className="text-sm text-green-500">Online</p></div>;
    return <p className="text-sm text-gray-500 dark:text-gray-400">Last seen {formatLastSeen(liveRecipient.lastSeen)}</p>;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      <audio ref={sentSoundRef} src={SENT_SOUND} preload="auto" />
      <audio ref={receivedSoundRef} src={RECEIVED_SOUND} preload="auto" />
      <header className="flex-shrink-0 sticky top-0 z-10 flex items-center p-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-500/20">
        <button onClick={onBack} className="mr-4 p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 rounded-full">
            <ChevronLeftIcon className="w-6 h-6"/>
        </button>
        <button onClick={() => setProfileVisible(true)} className="flex-1 flex items-center text-left">
            <Avatar photoURL={recipient.photoURL} displayName={recipient.displayName} className="w-10 h-10 mr-4" />
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{recipient.displayName}</h2>
                    <UserBadges badges={recipient.badges} />
                </div>
                {renderStatus()}
            </div>
        </button>
      </header>
      
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
        {initialMessagesLoading ? (
            <MessageSkeleton />
        ) : (
            <div className="p-4 flex flex-col gap-1">
                {itemsToRender.map((item) => {
                    if ('type' in item && item.type === 'separator') {
                        return (
                            <div key={item.id} className="text-center my-3">
                                <span className="bg-gray-200 dark:bg-gray-700 text-xs px-3 py-1 rounded-full text-gray-600 dark:text-gray-300 font-semibold">
                                    {item.text}
                                </span>
                            </div>
                        );
                    }
                    const msg = item as Message;
                    return (
                        <MessageComponent 
                            key={msg.id} 
                            message={msg} 
                            isOwnMessage={msg.senderId === currentUser?.uid}
                            onReply={handleSetReply}
                            onSelectReaction={handleReaction}
                            onToggleHeart={(message) => handleReaction('❤️', message)}
                            onScrollToMessage={scrollToMessage}
                            highlighted={msg.id === highlightedMessageId}
                            chatId={chatId!}
                            recipient={recipient}
                            onDeleteForEveryone={handleDeleteForEveryone}
                            onDeleteForMe={handleDeleteForMe}
                            onOpenImageViewer={handleOpenImageViewer}
                        />
                    );
                })}
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <footer className="p-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-gray-500/20 flex-shrink-0">
         {isBlockedByMe ? (
            <div className="text-center flex flex-col items-center justify-center py-2">
                <p className="text-sm mb-2 text-gray-600 dark:text-gray-300">You have blocked {liveRecipient.displayName}.</p>
                <button 
                    onClick={() => setShowUnblockConfirm(true)} 
                    className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover transition-colors"
                >
                    Unblock
                </button>
            </div>
        ) : amIBlocked ? (
            <div className="text-center py-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">You can't reply to this conversation.</p>
            </div>
        ) : (
            <>
                {(replyTo || imagePreviews.length > 0) && (
                    <div className="p-2 mb-2 border-b border-black/10 dark:border-white/10">
                        {replyTo && (
                            <div onClick={() => scrollToMessage(replyTo.id)} className="bg-black/10 dark:bg-white/10 p-2 rounded-lg relative cursor-pointer">
                                <button onClick={(e) => { e.stopPropagation(); setReplyTo(null); }} className="absolute top-1 right-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"><XIcon className="w-4 h-4" /></button>
                                <p className="font-bold text-sm text-primary flex items-center gap-1.5">
                                    Replying to {replyToSenderName}
                                    <UserBadges badges={replyToSenderBadges} />
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{replyTo.text || (replyTo.imageUrls && '[Image]')}</p>
                            </div>
                        )}
                        {imagePreviews.length > 0 && (
                            <div className="mt-2 flex overflow-x-auto gap-2">
                                {imagePreviews.map((preview, index) => (
                                <div key={index} className="relative w-20 h-20 flex-shrink-0">
                                        <img src={preview} alt="preview" className="w-full h-full object-cover rounded-lg"/>
                                        <button onClick={() => cancelImage(index)} className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full p-1 leading-none"><XIcon className="w-4 h-4"/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
                <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden"/>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary">
                    <PaperclipIcon className="w-6 h-6"/>
                </button>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => handleTyping(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-900 border-none rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button type="submit" disabled={loading || (!newMessage.trim() && imageFiles.length === 0)} className="p-3 bg-primary rounded-full text-white hover:bg-primary-hover disabled:opacity-50">
                    <SendIcon className="w-6 h-6"/>
                </button>
                </form>
            </>
        )}
      </footer>
      {isImageViewerOpen && (
        <ImageViewer
            images={allImageMessages}
            startIndex={selectedImageIndex}
            onClose={() => setIsImageViewerOpen(false)}
            onReply={handleSetReply}
        />
      )}
      {showUnblockConfirm && (
          <Modal title={`Unblock ${liveRecipient.displayName}?`} onClose={() => setShowUnblockConfirm(false)}>
              <div className="p-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">They will be able to message you again.</p>
                  <div className="flex justify-center gap-4 mt-6">
                      <button 
                          onClick={() => setShowUnblockConfirm(false)}
                          className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={confirmUnblockUser}
                          className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition-colors"
                      >
                          Unblock
                      </button>
                  </div>
              </div>
          </Modal>
      )}
    </div>
  );
};

export default ChatWindow;