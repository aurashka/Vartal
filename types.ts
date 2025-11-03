export interface PostImage {
  full: string;
  thumb: string;
}

export interface UserBadge {
  iconUrl: string;
  description: string;
  visible?: boolean;
}

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: PostImage | string;
  handle?: string;
  phoneNumber?: string;
  role: 'user' | 'admin';
  bookmarkedPosts?: { [postId: string]: true };
  isPremium?: boolean;
  isBanned?: boolean;
  isVerified?: boolean;
  badges?: UserBadge[];
  bio?: string;
  profession?: string;
  maritalStatus?: 'Single' | 'In a Relationship' | 'Married' | 'Complicated' | 'Prefer not to say';
  location?: string;
  tags?: string[];
  status?: 'online' | 'offline';
  lastSeen?: number;
  followers?: { [uid: string]: true };
  following?: { [uid: string]: true };
  blockedUsers?: { [uid: string]: true };
}

export interface Reaction {
  [emoji: string]: string[]; // emoji: [uid1, uid2, ...]
}

export interface ReplyInfo {
  messageId: string;
  senderName: string;
  text: string;
  imageUrls?: string[];
  senderBadges?: UserBadge[];
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  imageUrls?: string[];
  reactions?: Reaction;
  replyTo?: ReplyInfo;
  isForwarded?: boolean;
  isEdited?: boolean;
  readBy?: { [uid: string]: true };
}

export interface Chat {
  id: string;
  members: string[];
  lastMessage?: {
    text: string;
    timestamp: number;
  };
}

export interface UserChat {
    chatId: string;
    userInfo: AppUser;
    lastMessage?: {
        text: string;
        timestamp: number;
    };
    activity?: string; // e.g., "liked your story", "following you"
    unreadCount?: number;
}

export interface Post {
  id: string;
  author: {
    uid: string;
    displayName: string;
    photoURL: string | PostImage;
    badges?: UserBadge[];
  };
  text: string;
  imageUrls?: PostImage[];
  gifUrl?: string;
  timestamp: number;
  likedBy?: { [uid: string]: true };
  commentsCount?: number;
  privacy: 'public' | 'friends' | 'private';
  commentSettings: 'public' | 'friends' | 'private' | 'disabled';
  mentions?: string[];
}

export interface Story {
  id: string;
  author: {
    uid: string;
    displayName: string;
    photoURL: string | PostImage;
  };
  imageUrl: PostImage;
  text?: string;
  timestamp: number;
  expiresAt: number;
  privacy: 'public' | 'friends' | 'private';
  likedBy?: { [uid: string]: true };
  viewedBy?: { [uid: string]: true };
}

export interface Highlight {
  id: string;
  title: string;
  coverStoryImageUrl: PostImage;
  storyIds: { [storyId: string]: true };
}

export interface Comment {
  id:string;
  author: {
    uid: string;
    displayName: string;
    photoURL: string | PostImage;
    badges?: UserBadge[];
  };
  text: string;
  timestamp: number;
  likedBy?: { [uid: string]: true };
  replyTo?: {
    commentId: string;
    uid: string;
    displayName: string;
  };
  isEdited?: boolean;
  isHidden?: boolean;
}

export interface AppData {
  name: string;
  logoUrl: string;
  features?: {
    googleLogin?: {
      enabled: boolean;
    };
  };
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'reply' | 'follow' | 'mention';
  fromUid: string;
  fromName: string;
  fromPhotoURL?: PostImage | string;
  postId?: string;
  postImageThumb?: string;
  commentId?: string;
  commentText?: string;
  timestamp: number;
  read: boolean;
}