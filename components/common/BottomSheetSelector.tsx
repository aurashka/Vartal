import React from 'react';

interface Option {
  value: string;
  label: string;
  description: string;
}

interface BottomSheetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: Option[];
  currentValue: string;
  onSelect: (value: string) => void;
}

const BottomSheetSelector: React.FC<BottomSheetSelectorProps> = ({ isOpen, onClose, title, options, currentValue, onSelect }) => {
  if (!isOpen) return null;

  const handleSelect = (value: string) => {
    onSelect(value);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 w-full rounded-t-2xl p-4 animate-slide-in-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full pb-3 flex justify-center">
          <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        <h2 className="text-xl font-bold text-center mb-4">{title}</h2>
        <ul className="space-y-2">
          {options.map(option => (
            <li
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${
                currentValue === option.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <p className="font-semibold">{option.label}</p>
              <p className={`text-sm ${currentValue === option.value ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>{option.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BottomSheetSelector;
