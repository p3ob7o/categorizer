'use client';

import React, { useState, useEffect } from 'react';
import { Play, Loader2, Plus, Upload, Search, Edit2, Trash2, ChevronDown, X, Check } from 'lucide-react';

interface Language {
  id: number;
  name: string;
  code: string | null;
}

interface Category {
  id: number;
  name: string;
}

interface Word {
  id: number;
  word: string;
  languageId: number | null;
  language: Language | null;
  englishTranslation: string | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function WordsTab() {
  const [words, setWords] = useState<Word[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  
  // Filter states - now arrays for multi-select
  const [filterLanguageIds, setFilterLanguageIds] = useState<number[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown states
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Add word form states
  const [newWord, setNewWord] = useState('');
  const [newWordLanguageId, setNewWordLanguageId] = useState<string>('');
  const [newWordTranslation, setNewWordTranslation] = useState('');
  const [newWordCategory, setNewWordCategory] = useState('');

  // Upload states
  const [uploadResults, setUploadResults] = useState<any>(null);

  // Editing states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingWord, setEditingWord] = useState('');
  const [editingLanguageId, setEditingLanguageId] = useState<string>('');
  const [editingTranslation, setEditingTranslation] = useState('');
  const [editingCategory, setEditingCategory] = useState('');

  useEffect(() => {
    fetchLanguages();
    fetchCategories();
    fetchWords();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWords();
    }, 300);
    return () => clearTimeout(timer);
  }, [filterLanguageIds, filterCategories, searchQuery]);

  const fetchLanguages = async () => {
    try {
      const response = await fetch('/api/languages');
      const data = await response.json();
      
      if (response.ok && Array.isArray(data)) {
        setLanguages(data);
      } else {
        console.error('Failed to fetch languages:', data);
        setLanguages([]);
      }
    } catch (error) {
      console.error('Error fetching languages:', error);
      setLanguages([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      
      if (response.ok && Array.isArray(data)) {
        setCategories(data);
      } else {
        console.error('Failed to fetch categories:', data);
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const fetchWords = async () => {
    try {
      const params = new URLSearchParams();
      if (filterLanguageIds.length > 0) {
        filterLanguageIds.forEach(id => params.append('languageId', id.toString()));
      }
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/words?${params}`);
      const data = await response.json();
      
      if (response.ok && Array.isArray(data)) {
        // Filter by categories on the client side since API doesn't support multiple categories yet
        let filteredWords = data;
        if (filterCategories.length > 0) {
          filteredWords = data.filter(word => 
            word.category && filterCategories.some(cat => 
              word.category.toLowerCase() === cat.toLowerCase()
            )
          );
        }
        setWords(filteredWords);
      } else {
        console.error('Failed to fetch words:', data);
        setWords([]);
      }
    } catch (error) {
      console.error('Error fetching words:', error);
      setWords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessWord = async (wordId: number) => {
    setProcessingIds(prev => new Set(prev).add(wordId));
    
    try {
      const response = await fetch(`/api/words/${wordId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const data = await response.json();
        setWords(prevWords => 
          prevWords.map(w => w.id === wordId ? data.word : w)
        );
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to process word');
      }
    } catch (error) {
      console.error('Error processing word:', error);
      alert('Failed to process word');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(wordId);
        return newSet;
      });
    }
  };

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    try {
      const response = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          word: newWord,
          languageId: newWordLanguageId || null,
          englishTranslation: newWordTranslation || null,
          category: newWordCategory || null,
        }),
      });

      if (response.ok) {
        await fetchWords();
        setNewWord('');
        setNewWordLanguageId('');
        setNewWordTranslation('');
        setNewWordCategory('');
        setShowAddModal(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add word');
      }
    } catch (error) {
      console.error('Error adding word:', error);
      alert('Failed to add word');
    }
  };

  const handleEdit = (word: Word) => {
    setEditingId(word.id);
    setEditingWord(word.word);
    setEditingLanguageId(word.languageId?.toString() || '');
    setEditingTranslation(word.englishTranslation || '');
    setEditingCategory(word.category || '');
  };

  const handleUpdate = async () => {
    if (!editingWord.trim() || editingId === null) return;

    try {
      const response = await fetch(`/api/words/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          word: editingWord,
          languageId: editingLanguageId || null,
          englishTranslation: editingTranslation || null,
          category: editingCategory || null,
        }),
      });

      if (response.ok) {
        await fetchWords();
        setEditingId(null);
        setEditingWord('');
        setEditingLanguageId('');
        setEditingTranslation('');
        setEditingCategory('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update word');
      }
    } catch (error) {
      console.error('Error updating word:', error);
      alert('Failed to update word');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this word?')) return;

    try {
      const response = await fetch(`/api/words/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchWords();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete word');
      }
    } catch (error) {
      console.error('Error deleting word:', error);
      alert('Failed to delete word');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/words/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setUploadResults(result);
      
      if (response.ok) {
        await fetchWords();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    }
  };

  const needsProcessing = (word: Word) => {
    // A word needs processing if ANY of the required fields are missing
    return !word.languageId || !word.englishTranslation || !word.category;
  };

  const getLanguageDisplay = (word: Word) => {
    if (!word.language) return 'No language';
    // Show "English" for English words regardless of the stored name
    if (word.language.name.toLowerCase() === 'english' || word.language.code?.toLowerCase() === 'en') {
      return 'English';
    }
    return `${word.language.name}${word.language.code ? ` (${word.language.code})` : ''}`;
  };

  // Multi-select handlers
  const handleLanguageToggle = (languageId: number) => {
    setFilterLanguageIds(prev => 
      prev.includes(languageId) 
        ? prev.filter(id => id !== languageId)
        : [...prev, languageId]
    );
  };

  const handleCategoryToggle = (categoryName: string) => {
    setFilterCategories(prev => 
      prev.includes(categoryName) 
        ? prev.filter(cat => cat !== categoryName)
        : [...prev, categoryName]
    );
  };

  const clearLanguageFilters = () => {
    setFilterLanguageIds([]);
  };

  const clearCategoryFilters = () => {
    setFilterCategories([]);
  };

  const getLanguageFilterDisplay = () => {
    if (filterLanguageIds.length === 0) return 'All Languages';
    if (filterLanguageIds.length === 1) {
      const lang = languages.find(l => l.id === filterLanguageIds[0]);
      return lang ? `${lang.name}${lang.code ? ` (${lang.code})` : ''}` : 'Language';
    }
    return `${filterLanguageIds.length} Languages`;
  };

  const getCategoryFilterDisplay = () => {
    if (filterCategories.length === 0) return 'All Categories';
    if (filterCategories.length === 1) return filterCategories[0];
    return `${filterCategories.length} Categories`;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading words...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Action buttons and filters */}
      <div className="space-y-4">
        {/* Action buttons */}
        <div className="flex gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add Word
          </button>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="btn btn-secondary"
          >
            <Upload className="h-3 w-3 mr-1.5" />
            Bulk Upload
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search words..."
                className="input pr-9"
              />
            </div>
            
            {/* Language filter */}
            <div className="relative">
              <div
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="select pr-8 flex items-center justify-between w-full cursor-pointer"
              >
                <span className="truncate">{getLanguageFilterDisplay()}</span>
                <div className="flex items-center gap-1">
                  {filterLanguageIds.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearLanguageFilters();
                      }}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                </div>
              </div>
              
              {showLanguageDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  {languages.map((lang) => (
                    <label
                      key={lang.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filterLanguageIds.includes(lang.id)}
                        onChange={() => handleLanguageToggle(lang.id)}
                        className="transparent-checkbox rounded"
                      />
                      <span className="text-sm truncate">
                        {lang.name} {lang.code ? `(${lang.code})` : ''}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Category filter */}
            <div className="relative">
              <div
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="select pr-8 flex items-center justify-between w-full cursor-pointer"
              >
                <span className="truncate">{getCategoryFilterDisplay()}</span>
                <div className="flex items-center gap-1">
                  {filterCategories.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearCategoryFilters();
                      }}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                </div>
              </div>
              
              {showCategoryDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  {categories.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filterCategories.includes(cat.name)}
                        onChange={() => handleCategoryToggle(cat.name)}
                        className="transparent-checkbox rounded"
                      />
                      <span className="text-sm truncate">{cat.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showLanguageDropdown || showCategoryDropdown) && (
        <div 
          className="fixed inset-0 z-[5]" 
          onClick={() => {
            setShowLanguageDropdown(false);
            setShowCategoryDropdown(false);
          }}
        />
      )}

      {/* Words table */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold mb-4">Words ({words.length})</h3>
        
        {words.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-500 text-sm">No words found</p>
          </div>
        ) : (
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <div className="col-span-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                Word
              </div>
              <div className="col-span-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                Language
              </div>
              <div className="col-span-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                Translation
              </div>
              <div className="col-span-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                Category
              </div>
              <div className="col-span-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                Actions
              </div>
            </div>

            {/* Table rows */}
            {words.map((word, index) => (
              <div
                key={word.id}
                className={`grid grid-cols-12 gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-opacity ${
                  processingIds.has(word.id) ? 'opacity-60' : ''
                } ${
                  index !== words.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-800' : ''
                }`}
              >
                {editingId === word.id ? (
                  <>
                    {/* Editing mode */}
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={editingWord}
                        onChange={(e) => setEditingWord(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <select
                          value={editingLanguageId}
                          onChange={(e) => setEditingLanguageId(e.target.value)}
                          className="select w-full pr-8"
                        >
                          <option value="">No Language</option>
                          {languages.map((lang) => (
                            <option key={lang.id} value={lang.id}>
                              {lang.name} {lang.code ? `(${lang.code})` : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={editingTranslation}
                        onChange={(e) => setEditingTranslation(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={editingCategory}
                        onChange={(e) => setEditingCategory(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                    <div className="col-span-2 flex gap-1">
                      <button onClick={handleUpdate} className="btn btn-primary">
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingWord('');
                          setEditingLanguageId('');
                          setEditingTranslation('');
                          setEditingCategory('');
                        }}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Display mode */}
                    <div className="col-span-3">
                      <span className="font-medium text-sm">{word.word}</span>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-sm ${!word.languageId ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                        {getLanguageDisplay(word)}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <span className={`text-sm ${!word.englishTranslation ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                        {word.englishTranslation || 'No translation'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-sm ${!word.category ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                        {word.category || 'No category'}
                      </span>
                    </div>
                    <div className="col-span-2 flex gap-1">
                      {needsProcessing(word) ? (
                        <button
                          onClick={() => handleProcessWord(word.id)}
                          disabled={processingIds.has(word.id)}
                          className="btn btn-ghost text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          title="Process with AI"
                        >
                          {processingIds.has(word.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </button>
                      ) : (
                        <div className="btn btn-ghost text-green-600 dark:text-green-400 cursor-default" title="Fully processed">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <button
                        onClick={() => handleEdit(word)}
                        className="btn btn-ghost"
                        title="Edit"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(word.id)}
                        className="btn btn-ghost text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Word Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Add New Word</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn btn-ghost p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddWord} className="space-y-4">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Word"
                className="input w-full"
                required
              />
              
              <div className="relative">
                <select
                  value={newWordLanguageId}
                  onChange={(e) => setNewWordLanguageId(e.target.value)}
                  className="select w-full pr-8"
                >
                  <option value="">No Language</option>
                  {languages.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name} {lang.code ? `(${lang.code})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
              </div>
              
              <input
                type="text"
                value={newWordTranslation}
                onChange={(e) => setNewWordTranslation(e.target.value)}
                placeholder="English Translation (optional)"
                className="input w-full"
              />
              
              <input
                type="text"
                value={newWordCategory}
                onChange={(e) => setNewWordCategory(e.target.value)}
                placeholder="Category (optional)"
                className="input w-full"
              />
              
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn btn-primary flex-1">
                  <Plus className="h-3 w-3 mr-1.5" />
                  Add Word
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Bulk Upload</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadResults(null);
                }}
                className="btn btn-ghost p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Upload a CSV file with one word per line
              </p>
              
              <label className="block">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-zinc-600 dark:text-zinc-400
                    file:mr-3 file:py-1.5 file:px-3
                    file:rounded-md file:border-0
                    file:text-xs file:font-medium
                    file:bg-zinc-100 file:text-zinc-700
                    hover:file:bg-zinc-200
                    dark:file:bg-zinc-800 dark:file:text-zinc-200
                    dark:hover:file:bg-zinc-700"
                />
              </label>
              
              {uploadResults && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-md text-sm">
                  <p>Created: {uploadResults.results?.created || 0}</p>
                  <p>Skipped: {uploadResults.results?.skipped || 0}</p>
                  {uploadResults.results?.errors?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-red-600 dark:text-red-400 font-medium">Errors:</p>
                      <ul className="text-xs mt-1 space-y-0.5">
                        {uploadResults.results.errors.map((error: string, idx: number) => (
                          <li key={idx} className="text-red-600 dark:text-red-400">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadResults(null);
                }}
                className="btn btn-secondary w-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 