'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoriesTab from '@/components/db-management/CategoriesTab';
import LanguagesTab from '@/components/db-management/LanguagesTab';
import WordsTab from '@/components/db-management/WordsTab';
import Link from 'next/link';
import { ArrowLeft, Database, Globe, Tag, FileText } from 'lucide-react';

export default function DatabaseManagement() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="max-w-5xl mx-auto mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 group"
          >
            <ArrowLeft className="h-3 w-3 mr-1.5 transition-transform group-hover:-translate-x-0.5" />
            Back to home
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-md bg-zinc-900 dark:bg-white flex items-center justify-center">
              <Database className="h-5 w-5 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Database Management</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Manage your categories, languages, and words
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto">
          <Tabs defaultValue="categories" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="categories" className="flex items-center gap-2">
                <Tag className="h-3 w-3" />
                Categories
              </TabsTrigger>
              <TabsTrigger value="languages" className="flex items-center gap-2">
                <Globe className="h-3 w-3" />
                Languages
              </TabsTrigger>
              <TabsTrigger value="words" className="flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Words
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="categories">
              <CategoriesTab />
            </TabsContent>
            
            <TabsContent value="languages">
              <LanguagesTab />
            </TabsContent>
            
            <TabsContent value="words">
              <WordsTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
} 