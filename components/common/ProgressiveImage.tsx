import React, { useState, useEffect } from 'react';

interface ProgressiveImageProps {
  src: string;
  placeholderSrc: string;
  alt: string;
  className?: string;
  imageClassName?: string;
}

const ProgressiveImage: React.FC<ProgressiveImageProps> = ({ src, placeholderSrc, alt, className, imageClassName }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Reset loaded state when src changes
        setIsLoaded(false);
        const img = new Image();
        img.src = src;
        img.onload = () => {
            setIsLoaded(true);
        };
    }, [src]);

    const defaultImageStyles = 'w-full h-full object-cover';

    return (
        <div className={`relative overflow-hidden ${className || ''}`}>
            <img
                src={placeholderSrc}
                alt={alt}
                className={`${imageClassName || defaultImageStyles} transition-opacity duration-300 ${isLoaded ? 'opacity-0' : 'opacity-100'}`}
            />
            <img
                src={src}
                alt={alt}
                loading="lazy"
                className={`${imageClassName || defaultImageStyles} absolute inset-0 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
        </div>
    );
};

export default ProgressiveImage;
