'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Upload, X, Trash } from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';

interface Category {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export default function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [uploadResults, setUploadResults] = useState<any>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearingList, setIsClearingList] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory }),
      });

      if (response.ok) {
        await fetchCategories();
        setNewCategory('');
        setShowAddModal(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add category');
      }
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Failed to add category');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const handleUpdate = async () => {
    if (!editingName.trim() || editingId === null) return;

    try {
      const response = await fetch(`/api/categories/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName }),
      });

      if (response.ok) {
        await fetchCategories();
        setEditingId(null);
        setEditingName('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update category');
      }
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchCategories();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/categories/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setUploadResults(result);
      
      if (response.ok) {
        await fetchCategories();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    }
  };

  const handleClearList = async () => {
    setIsClearingList(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'categories' }),
      });

      if (response.ok) {
        await fetchCategories();
        setShowClearModal(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to clear categories');
      }
    } catch (error) {
      console.error('Error clearing categories:', error);
      alert('Failed to clear categories');
    } finally {
      setIsClearingList(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading categories...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex gap-3">
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
        >
          <Plus className="h-3 w-3 mr-1.5" />
          Add Category
        </button>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="btn btn-secondary"
        >
          <Upload className="h-3 w-3 mr-1.5" />
          Bulk Upload
        </button>
        <button 
          onClick={() => setShowClearModal(true)}
          className="btn btn-ghost text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash className="h-3 w-3 mr-1.5" />
          Clear List
        </button>
      </div>

      {/* Categories list */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold mb-4">Categories ({categories.length})</h3>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
          {categories.map((category, index) => (
            <div
              key={category.id}
              className={`flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${
                index !== categories.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-800' : ''
              }`}
            >
              {editingId === category.id ? (
                <div className="flex gap-2 flex-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="input flex-1"
                  />
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
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-sm">{category.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(category)}
                      className="btn btn-ghost"
                      title="Edit"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
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
          {categories.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-zinc-500 text-sm">No categories found</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Add New Category</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn btn-ghost p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddCategory} className="space-y-4">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category name"
                className="input w-full"
                required
              />
              
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn btn-primary flex-1">
                  <Plus className="h-3 w-3 mr-1.5" />
                  Add Category
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
                Upload a CSV file with one category per line
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

      {/* Clear List Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearList}
        title="Clear All Categories"
        message="This will permanently delete all categories from the database. This action cannot be undone."
        confirmationText="categories"
        confirmButtonText="Clear All Categories"
        isLoading={isClearingList}
      />
    </div>
  );
} 