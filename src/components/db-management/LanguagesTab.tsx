'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Globe } from 'lucide-react';

interface Language {
  id: number;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function LanguagesTab() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLanguageName, setNewLanguageName] = useState('');
  const [newLanguageCode, setNewLanguageCode] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingCode, setEditingCode] = useState('');
  const [uploadResults, setUploadResults] = useState<any>(null);

  useEffect(() => {
    fetchLanguages();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  const handleAddLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLanguageName.trim()) return;

    try {
      const response = await fetch('/api/languages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newLanguageName,
          code: newLanguageCode || null
        }),
      });

      if (response.ok) {
        await fetchLanguages();
        setNewLanguageName('');
        setNewLanguageCode('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add language');
      }
    } catch (error) {
      console.error('Error adding language:', error);
      alert('Failed to add language');
    }
  };

  const handleEdit = (language: Language) => {
    setEditingId(language.id);
    setEditingName(language.name);
    setEditingCode(language.code || '');
  };

  const handleUpdate = async () => {
    if (!editingName.trim() || editingId === null) return;

    try {
      const response = await fetch(`/api/languages/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editingName,
          code: editingCode || null
        }),
      });

      if (response.ok) {
        await fetchLanguages();
        setEditingId(null);
        setEditingName('');
        setEditingCode('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update language');
      }
    } catch (error) {
      console.error('Error updating language:', error);
      alert('Failed to update language');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this language?')) return;

    try {
      const response = await fetch(`/api/languages/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchLanguages();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete language');
      }
    } catch (error) {
      console.error('Error deleting language:', error);
      alert('Failed to delete language');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/languages/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setUploadResults(result);
      
      if (response.ok) {
        await fetchLanguages();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading languages...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Add new language form */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold mb-4">Add New Language</h3>
        <form onSubmit={handleAddLanguage} className="space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={newLanguageName}
              onChange={(e) => setNewLanguageName(e.target.value)}
              placeholder="Language name"
              className="input flex-1"
            />
            <input
              type="text"
              value={newLanguageCode}
              onChange={(e) => setNewLanguageCode(e.target.value)}
              placeholder="Code (optional)"
              className="input w-32"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <Plus className="h-3 w-3 mr-1.5" />
            Add Language
          </button>
        </form>
      </div>

      {/* CSV Upload */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold mb-4">Bulk Upload</h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
          Upload a CSV file with format: language_name,language_code (code is optional)
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

      {/* Languages list */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold mb-4">Languages ({languages.length})</h3>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
          {languages.map((language, index) => (
            <div
              key={language.id}
              className={`flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${
                index !== languages.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-800' : ''
              }`}
            >
              {editingId === language.id ? (
                <div className="space-y-2 flex-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="Language name"
                      className="input flex-1"
                    />
                    <input
                      type="text"
                      value={editingCode}
                      onChange={(e) => setEditingCode(e.target.value)}
                      placeholder="Code"
                      className="input w-24"
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
                        setEditingName('');
                        setEditingCode('');
                      }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    <div>
                      <span className="font-medium text-sm">{language.name}</span>
                      {language.code && (
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">({language.code})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(language)}
                      className="btn btn-ghost"
                      title="Edit"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(language.id)}
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
          {languages.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-zinc-500 text-sm">No languages found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 