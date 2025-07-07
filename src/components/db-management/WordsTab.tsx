'use client';

import React, { useState, useEffect } from 'react';
import { Play, Loader2, Plus, Upload, Search, Filter, Edit2, Trash2, ChevronDown } from 'lucide-react';

interface Language {
  id: number;
  name: string;
  code: string | null;
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
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [newWordLanguageId, setNewWordLanguageId] = useState<string>('');
  const [newWordTranslation, setNewWordTranslation] = useState('');
  const [newWordCategory, setNewWordCategory] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingWord, setEditingWord] = useState('');
  const [editingLanguageId, setEditingLanguageId] = useState<string>('');
  const [editingTranslation, setEditingTranslation] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [uploadResults, setUploadResults] = useState<any>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  
  // Filter states
  const [filterLanguageId, setFilterLanguageId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLanguages();
    fetchWords();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWords();
    }, 300);
    return () => clearTimeout(timer);
  }, [filterLanguageId, searchQuery]);

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

  const fetchWords = async () => {
    try {
      const params = new URLSearchParams();
      if (filterLanguageId) params.append('languageId', filterLanguageId);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/words?${params}`);
      const data = await response.json();
      
      if (response.ok && Array.isArray(data)) {
        setWords(data);
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
        // Update the word in the list
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
    return !word.languageId || !word.englishTranslation || !word.category;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading words...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search words..."
              className="input pl-9"
            />
          </div>
          <div className="relative">
            <select
              value={filterLanguageId}
              onChange={(e) => setFilterLanguageId(e.target.value)}
              className="select w-auto pr-8"
            >
              <option value="">All Languages</option>
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name} {lang.code ? `(${lang.code})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Add new word form */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold mb-4">Add New Word</h3>
        <form onSubmit={handleAddWord} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="Word"
              className="input"
            />
            <div className="relative">
              <select
                value={newWordLanguageId}
                onChange={(e) => setNewWordLanguageId(e.target.value)}
                className="select pr-8"
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
              className="input"
            />
            <input
              type="text"
              value={newWordCategory}
              onChange={(e) => setNewWordCategory(e.target.value)}
              placeholder="Category (optional)"
              className="input"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <Plus className="h-3 w-3 mr-1.5" />
            Add Word
          </button>
        </form>
      </div>

      {/* CSV Upload */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold mb-4">Bulk Upload</h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
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
          <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-md text-sm">
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
      </div>

      {/* Words list */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold mb-4">Words ({words.length})</h3>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
          {words.map((word, index) => (
            <div
              key={word.id}
              className={`px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-opacity ${
                processingIds.has(word.id) ? 'opacity-60' : ''
              } ${
                index !== words.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-800' : ''
              }`}
            >
              {editingId === word.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editingWord}
                      onChange={(e) => setEditingWord(e.target.value)}
                      placeholder="Word"
                      className="input"
                    />
                    <div className="relative">
                      <select
                        value={editingLanguageId}
                        onChange={(e) => setEditingLanguageId(e.target.value)}
                        className="select pr-8"
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
                      value={editingTranslation}
                      onChange={(e) => setEditingTranslation(e.target.value)}
                      placeholder="English Translation"
                      className="input"
                    />
                    <input
                      type="text"
                      value={editingCategory}
                      onChange={(e) => setEditingCategory(e.target.value)}
                      placeholder="Category"
                      className="input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      className="btn btn-primary"
                    >
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
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium">{word.word}</span>
                        <span className="text-zinc-500 dark:text-zinc-400">•</span>
                        <span className={`text-xs ${!word.languageId ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                          {word.language ? `${word.language.name}${word.language.code ? ` (${word.language.code})` : ''}` : 'No language'}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400">•</span>
                        <span className={`text-xs ${!word.englishTranslation ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                          {word.englishTranslation || 'No translation'}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400">•</span>
                        <span className={`text-xs ${!word.category ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                          {word.category || 'No category'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {needsProcessing(word) && (
                        <button
                          onClick={() => handleProcessWord(word.id)}
                          disabled={processingIds.has(word.id)}
                          className="btn btn-ghost text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          title="Process with AI"
                        >
                          {processingIds.has(word.id) ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              <span className="text-xs">Processing</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1" />
                              <span className="text-xs">Process</span>
                            </>
                          )}
                        </button>
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
                  </div>
                </>
              )}
            </div>
          ))}
          {words.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-zinc-500 text-sm">No words found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 