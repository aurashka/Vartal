import React, { useState, useEffect, useCallback } from 'react';
import Modal from './common/Modal';
import { SearchIcon } from './common/Icons';
import debounce from 'lodash.debounce';
import { GifGridSkeleton } from './common/Shimmer';

const TENOR_API_KEY = 'LIVDSRZULELA'; // Public key for Tenor v1 API
const TENOR_API_URL = 'https://api.tenor.com/v1';

interface GifPickerProps {
    onSelect: (gifUrl: string) => void;
    onClose: () => void;
}

const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose }) => {
    const [gifs, setGifs] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchGifs = useCallback(async (term: string) => {
        setLoading(true);
        const endpoint = term
            ? `${TENOR_API_URL}/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(term)}&limit=24`
            : `${TENOR_API_URL}/trending?key=${TENOR_API_KEY}&limit=24`;
        
        try {
            const response = await fetch(endpoint);
            if (!response.ok) {
                throw new Error(`Failed to fetch GIFs: ${response.statusText}`);
            }
            const data = await response.json();
            setGifs(data.results || []);
        } catch (error) {
            console.error("Failed to fetch GIFs:", error);
            setGifs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const debouncedFetch = useCallback(debounce(fetchGifs, 300), [fetchGifs]);

    useEffect(() => {
        debouncedFetch(searchTerm);
    }, [searchTerm, debouncedFetch]);

    const handleSelect = (gif: any) => {
        onSelect(gif.media[0].gif.url);
    };

    return (
        <Modal title="Search GIFs" onClose={onClose}>
            <div className="relative mb-4">
                <input
                    type="text"
                    placeholder="Search for a GIF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-900 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            {loading ? (
                <GifGridSkeleton />
            ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
                    {gifs.length > 0 ? gifs.map(gif => (
                        <div key={gif.id} onClick={() => handleSelect(gif)} className="cursor-pointer aspect-square bg-gray-200 dark:bg-gray-800 rounded-md overflow-hidden group">
                            <img 
                                src={gif.media[0].tinygif.url} 
                                alt={gif.content_description} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                            />
                        </div>
                    )) : (
                        <p className="col-span-3 text-center text-gray-500 py-8">No GIFs found. Try another search.</p>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default GifPicker;