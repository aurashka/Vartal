import React from 'react';
import { UserBadge } from '../../types';

interface UserBadgesProps {
  badges?: UserBadge[];
  className?: string;
}

const UserBadges: React.FC<UserBadgesProps> = ({ badges, className = '' }) => {
  // Filter for badges that are explicitly visible or have visibility undefined (default to visible)
  const visibleBadges = badges?.filter(badge => badge.visible !== false);

  if (!visibleBadges || visibleBadges.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {visibleBadges.map((badge, index) => (
        <img
          key={index}
          src={badge.iconUrl}
          alt={badge.description}
          title={badge.description}
          className="w-4 h-4"
        />
      ))}
    </div>
  );
};

export default UserBadges;
