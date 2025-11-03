import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, off, push, set, update } from 'firebase/database';
import { Story, Highlight } from '../types';
import { useAuth } from '../App';
import Modal from './common/Modal';
import { PlusCircleIcon } from './common/Icons';
import ProgressiveImage from './common/ProgressiveImage';
import { Skeleton } from './common/Shimmer';

interface AddToHighlightModalProps {
    story: Story;
    onClose: () => void;
}

const AddToHighlightModal: React.FC<AddToHighlightModalProps> = ({ story, onClose }) => {
    const { currentUser } = useAuth();
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewHighlightInput, setShowNewHighlightInput] = useState(false);
    const [newHighlightTitle, setNewHighlightTitle] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);
        const highlightsRef = ref(db, `highlights/${currentUser.uid}`);
        const listener = onValue(highlightsRef, (snapshot) => {
            const data: Highlight[] = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    data.push({ id: child.key!, ...child.val() });
                });
            }
            setHighlights(data.reverse());
            setLoading(false);
        });
        return () => off(highlightsRef, 'value', listener);
    }, [currentUser]);

    const handleAddToExisting = async (highlightId: string) => {
        if (!currentUser) return;
        const updates: { [key: string]: any } = {};
        updates[`/highlights/${currentUser.uid}/${highlightId}/storyIds/${story.id}`] = true;
        await update(ref(db), updates);
        onClose();
    };

    const handleCreateNew = async () => {
        if (!currentUser || !newHighlightTitle.trim()) return;
        setIsCreating(true);
        
        const newHighlightRef = push(ref(db, `highlights/${currentUser.uid}`));
        const newHighlightData: Omit<Highlight, 'id'> = {
            title: newHighlightTitle.trim(),
            coverStoryImageUrl: story.imageUrl,
            storyIds: {
                [story.id]: true,
            },
        };
        
        await set(newHighlightRef, newHighlightData);
        setIsCreating(false);
        onClose();
    };

    return (
        <Modal title="Add to Highlight" onClose={onClose} position="bottom">
            <div className="max-h-[60vh] overflow-y-auto">
                {loading ? (
                    <div className="flex gap-4 p-2"><Skeleton className="w-16 h-16 rounded-full" /><Skeleton className="w-16 h-16 rounded-full" /></div>
                ) : (
                    <div className="flex items-center gap-4 py-2">
                        <button 
                            onClick={() => setShowNewHighlightInput(true)}
                            className="flex flex-col items-center justify-center gap-1.5 w-20 flex-shrink-0"
                        >
                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center">
                                <PlusCircleIcon className="w-8 h-8 text-gray-400" />
                            </div>
                            <span className="text-xs font-semibold">New</span>
                        </button>
                        {highlights.map(h => (
                            <button 
                                key={h.id}
                                onClick={() => handleAddToExisting(h.id)}
                                className="flex flex-col items-center justify-center gap-1.5 w-20 flex-shrink-0 text-center"
                            >
                                <ProgressiveImage
                                    src={h.coverStoryImageUrl.full}
                                    placeholderSrc={h.coverStoryImageUrl.thumb}
                                    alt={h.title}
                                    className="w-16 h-16 rounded-full"
                                    imageClassName="w-full h-full rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                                />
                                <span className="text-xs font-semibold truncate w-full">{h.title}</span>
                            </button>
                        ))}
                    </div>
                )}
                 {showNewHighlightInput && (
                    <div className="mt-4 p-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="font-semibold mb-2">Create new highlight</p>
                        <div className="flex items-center gap-2">
                            <input 
                                type="text"
                                value={newHighlightTitle}
                                onChange={(e) => setNewHighlightTitle(e.target.value)}
                                placeholder="Highlight name..."
                                maxLength={20}
                                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                autoFocus
                            />
                            <button 
                                onClick={handleCreateNew} 
                                disabled={isCreating || !newHighlightTitle.trim()}
                                className="px-4 py-2 bg-primary text-white font-semibold rounded-lg disabled:opacity-50"
                            >
                                {isCreating ? '...' : 'Create'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default AddToHighlightModal;