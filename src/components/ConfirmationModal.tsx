'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmationText: string;
  confirmButtonText?: string;
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmationText,
  confirmButtonText = 'Delete',
  isLoading = false,
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleClose = () => {
    setInputValue('');
    onClose();
  };

  const handleConfirm = () => {
    if (inputValue === confirmationText) {
      onConfirm();
    }
  };

  const isConfirmEnabled = inputValue === confirmationText && !isLoading;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
              {title}
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="btn btn-ghost p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {message}
          </p>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Type "{confirmationText}" to confirm:
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmationText}
              className="input w-full"
              disabled={isLoading}
              autoFocus
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleConfirm}
              disabled={!isConfirmEnabled}
              className={`btn flex-1 ${
                isConfirmEnabled
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Deleting...' : confirmButtonText}
            </button>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal; 