import React from 'react';
import { XIcon } from './Icons';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  position?: 'center' | 'bottom';
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children, position = 'center' }) => {
  const wrapperClasses = position === 'center'
    ? 'flex items-center justify-center p-4'
    : 'flex items-end justify-center';

  const contentClasses = position === 'center'
    ? 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col'
    : 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-t-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-in-bottom';

  return (
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 ${wrapperClasses}`}
      onClick={onClose}
    >
      <div 
        className={contentClasses}
        onClick={(e) => e.stopPropagation()}
      >
        {position === 'bottom' && (
          <div className="w-full pt-3 pb-1 flex justify-center flex-shrink-0">
            <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
        )}
        <header className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full">
            <XIcon className="w-5 h-5" />
          </button>
        </header>
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
