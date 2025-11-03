import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse ${className}`}></div>
);

export const PostCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-16" />
        </div>
      </div>
      <Skeleton className="h-6 w-6 rounded-md" />
    </div>
    <Skeleton className="w-full aspect-square" />
    <div className="p-3 space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Skeleton className="w-7 h-7 rounded-full" />
          <Skeleton className="w-7 h-7 rounded-full" />
          <Skeleton className="w-7 h-7 rounded-full" />
        </div>
        <Skeleton className="w-7 h-7 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  </div>
);

export const UserListItemSkeleton: React.FC = () => (
    <div className="flex items-center gap-4 p-2">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
        </div>
    </div>
);


export const ChatLayoutSkeleton: React.FC = () => (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-white dark:bg-black text-gray-900 dark:text-gray-100 relative">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-500/20">
            <Skeleton className="h-7 w-40 rounded-md" />
            <div className="flex items-center gap-4">
                <Skeleton className="w-7 h-7 rounded-full" />
                <Skeleton className="w-7 h-7 rounded-full" />
            </div>
        </div>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-24">
            <PostCardSkeleton />
            <PostCardSkeleton />
        </main>
        {/* Bottom Nav */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4">
            <div className="flex items-center justify-around p-2 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-500/10 rounded-full shadow-2xl shadow-black/10">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-8 h-8 rounded-full" />
            </div>
        </div>
    </div>
);


export const GifGridSkeleton: React.FC = () => (
    <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
    </div>
);

export const MessageSkeleton: React.FC = () => (
    <div className="p-4 space-y-4">
        <div className="flex items-end gap-2 my-1">
            <div className="max-w-xs lg:max-w-md p-3 rounded-2xl shadow-md mr-auto space-y-2 bg-gray-100 dark:bg-gray-800/50">
                <Skeleton className="h-4 w-48 bg-gray-300 dark:bg-gray-700" />
                <Skeleton className="h-4 w-32 bg-gray-300 dark:bg-gray-700" />
            </div>
        </div>
        <div className="flex items-end gap-2 my-1 flex-row-reverse">
            <div className="max-w-xs lg:max-w-md p-3 rounded-2xl shadow-md ml-auto space-y-2 bg-primary/80">
                <Skeleton className="h-4 w-40 bg-white/40" />
            </div>
        </div>
        <div className="flex items-end gap-2 my-1">
            <div className="max-w-xs lg:max-w-md p-3 rounded-2xl shadow-md mr-auto space-y-2 bg-gray-100 dark:bg-gray-800/50">
                <Skeleton className="h-4 w-24 bg-gray-300 dark:bg-gray-700" />
            </div>
        </div>
         <div className="flex items-end gap-2 my-1 flex-row-reverse">
            <div className="max-w-xs lg:max-w-md p-3 rounded-2xl shadow-md ml-auto space-y-2 bg-primary/80">
                <Skeleton className="h-4 w-48 bg-white/40" />
                <Skeleton className="h-4 w-20 bg-white/40" />
            </div>
        </div>
    </div>
);

export const BentoGridSkeleton: React.FC = () => (
    <div className="grid grid-cols-3 auto-rows-[30vw] md:auto-rows-[15vw] gap-1 p-1">
        <Skeleton className="col-span-2 row-span-2 rounded-lg" />
        <Skeleton className="col-span-1 row-span-1 rounded-lg" />
        <Skeleton className="col-span-1 row-span-1 rounded-lg" />
        <Skeleton className="col-span-1 row-span-1 rounded-lg" />
        <Skeleton className="col-span-1 row-span-1 rounded-lg" />
        <Skeleton className="col-span-2 row-span-2 rounded-lg" />
        <Skeleton className="col-span-1 row-span-1 rounded-lg" />
    </div>
);