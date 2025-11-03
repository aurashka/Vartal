import { PostImage } from '../types';

const IMGBB_API_KEY = '5fd2a4346ac2e5485a916a5d734d508b';

/**
 * Uploads a single file to ImgBB.
 * @param file The file to upload.
 * @returns An object with full and thumb URLs, or null if upload fails.
 */
export const uploadImage = async (file: File): Promise<PostImage | null> => {
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();
        if (data.success && data.data.url && data.data.thumb.url) {
            return {
                full: data.data.url,
                thumb: data.data.thumb.url,
            };
        } else {
            const errorMessage = data.error?.message || 'Unknown ImgBB API error';
            console.error('ImgBB upload failed:', errorMessage, data);
            return null;
        }
    } catch (error) {
        console.error('Error uploading to ImgBB:', error);
        return null;
    }
};

/**
 * Uploads multiple files to ImgBB sequentially and reports progress.
 * @param files An array of files to upload.
 * @param onProgress A callback function that fires after each successful upload.
 * @returns An array of URL objects for the successfully uploaded images.
 */
export const uploadMultipleImages = async (files: File[], onProgress: (index: number) => void): Promise<PostImage[]> => {
    const uploadedUrls: PostImage[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const urls = await uploadImage(file);
        if (urls) {
            uploadedUrls.push(urls);
            onProgress(i);
        } else {
             console.warn(`Skipping failed upload for file: ${file.name}`);
        }
    }
    return uploadedUrls;
};