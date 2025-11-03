export const formatLastSeen = (timestamp?: number): string => {
    if (!timestamp) return 'a while ago';
    const now = new Date();
    const lastSeenDate = new Date(timestamp);
    const diffSeconds = Math.floor((now.getTime() - lastSeenDate.getTime()) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 5) return 'just now';
    if (diffMinutes < 1) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return lastSeenDate.toLocaleDateString();
};

export const formatMessageTime = (timestamp?: number): string => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export const formatDateSeparator = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, today)) {
        return 'Today';
    }
    if (isSameDay(date, yesterday)) {
        return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

export const formatStoryTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

    if (isSameDay(date, today)) {
        return `Today, ${timeString}`;
    }
    if (isSameDay(date, yesterday)) {
        return `Yesterday, ${timeString}`;
    }
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
};

export const timeAgo = (timestamp: number): string => {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);

    if (seconds < 5) return "now";

    let interval = seconds / 31536000;
    if (interval > 1) {
        return Math.floor(interval) + "y";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
        return Math.floor(interval) + "mo";
    }
    interval = seconds / 604800;
    if (interval > 1) {
        return Math.floor(interval) + "w";
    }
    interval = seconds / 86400;
    if (interval > 1) {
        return Math.floor(interval) + "d";
    }
    interval = seconds / 3600;
    if (interval > 1) {
        return Math.floor(interval) + "h";
    }
    interval = seconds / 60;
    if (interval > 1) {
        return Math.floor(interval) + "m";
    }
    return Math.floor(seconds) + "s";
};