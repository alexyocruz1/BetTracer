'use client';

import { useState, useRef, useEffect } from 'react';
import { ReferenceItem } from '@/types';

interface SearchableSelectProps {
  options: ReferenceItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  allowCreate?: boolean;
  createKind?: 'team' | 'league' | 'bet_type' | 'category' | 'responsible' | 'sport';
  onCreateNew?: (name: string, kind: string) => Promise<ReferenceItem | null>;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search and select...',
  label,
  required = false,
  allowCreate = false,
  createKind,
  onCreateNew,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingCreateName, setPendingCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: ReferenceItem) => {
    onChange(option.id);
    setIsOpen(false);
    setSearchTerm('');
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  const handleCreateNew = () => {
    if (!allowCreate || !onCreateNew || !createKind || !searchTerm.trim()) return;
    setPendingCreateName(searchTerm.trim());
    setShowConfirmDialog(true);
  };

  const confirmCreate = async () => {
    if (!onCreateNew || !createKind || !pendingCreateName) return;
    
    setIsCreating(true);
    try {
      const newItem = await onCreateNew(pendingCreateName, createKind);
      if (newItem) {
        onChange(newItem.id);
        setSearchTerm('');
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to create new item:', error);
    } finally {
      setIsCreating(false);
      setShowConfirmDialog(false);
      setPendingCreateName('');
    }
  };

  const cancelCreate = () => {
    setShowConfirmDialog(false);
    setPendingCreateName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'Enter' || e.key === 'ArrowDown')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && isOpen && filteredOptions[highlightedIndex]) {
      e.preventDefault();
      handleSelect(filteredOptions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : selectedOption?.name || ''}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2.5 pr-8 text-base sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
          required={required && !value}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mr-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Clear selection"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {filteredOptions.length === 0 ? (
            <div>
              <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm.trim() ? 'No options found' : 'Start typing to search...'}
              </div>
              {allowCreate && searchTerm.trim() && onCreateNew && createKind && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 focus:bg-green-50 dark:focus:bg-green-900/20 focus:outline-none text-green-700 dark:text-green-400 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create "{searchTerm.trim()}"
                </button>
              )}
            </div>
          ) : (
            <>
              {filteredOptions.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none text-gray-900 dark:text-gray-100 ${
                    index === highlightedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } ${value === option.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : ''}`}
                >
                  {option.name}
                </button>
              ))}
              {allowCreate && searchTerm.trim() && onCreateNew && createKind && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 focus:bg-green-50 dark:focus:bg-green-900/20 focus:outline-none text-green-700 dark:text-green-400 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create "{searchTerm.trim()}"
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Create New {createKind ? createKind.replace('_', ' ').charAt(0).toUpperCase() + createKind.replace('_', ' ').slice(1) : 'Item'}?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  You're about to create a new item: <span className="font-semibold">"{pendingCreateName}"</span>
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                  ⚠️ Warning: Please make sure this is correct to avoid creating garbage data.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelCreate}
                disabled={isCreating}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCreate}
                disabled={isCreating}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 min-h-[44px] flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Confirm & Create'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

