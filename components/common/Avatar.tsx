import React from 'react';
import { PostImage } from '../../types';
import ProgressiveImage from './ProgressiveImage';

interface AvatarProps {
  photoURL?: PostImage | string | null;
  displayName?: string | null;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ photoURL, displayName, className = 'w-10 h-10' }) => {
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
  }

  const fullUrl = typeof photoURL === 'object' && photoURL !== null ? photoURL.full : typeof photoURL === 'string' ? photoURL : null;
  const thumbUrl = typeof photoURL === 'object' && photoURL !== null ? photoURL.thumb : null;

  if (fullUrl && thumbUrl) {
    return (
      <ProgressiveImage
        src={fullUrl}
        placeholderSrc={thumbUrl}
        alt={displayName || 'User Avatar'}
        className={`${className} rounded-full`}
        imageClassName="w-full h-full object-cover rounded-full"
      />
    );
  }

  if (fullUrl) {
    return (
      <img
        src={fullUrl}
        alt={displayName || 'User Avatar'}
        className={`${className} rounded-full object-cover`}
      />
    );
  }

  return (
    <div className={`${className} rounded-full flex items-center justify-center text-white font-bold ${getColor(displayName)}`}>
      <span>{getInitials(displayName)}</span>
    </div>
  );
};

export default Avatar;
