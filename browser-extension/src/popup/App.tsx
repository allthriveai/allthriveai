import React, { useState, useEffect } from 'react';
import browser from 'webextension-polyfill';
import type { ClippedContent, AuthState, CreateProjectRequest } from '../types';

type ViewState = 'loading' | 'login' | 'clip' | 'preview' | 'success' | 'error';
type ClipMode = 'full' | 'selection' | 'article';

interface Category {
  slug: string;
  name: string;
}

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
  });
  const [clippedContent, setClippedContent] = useState<ClippedContent | null>(null);
  const [clipMode, setClipMode] = useState<ClipMode>('article');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState<string>('');

  useEffect(() => {
    checkAuth();
    fetchCategories();
  }, []);

  const getApiBaseUrl = (): string => {
    // TODO: Change to 'https://allthrive.ai' for production
    return 'http://localhost:8000';
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/extension/categories/`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const checkAuth = async () => {
    try {
      console.log('Checking auth...');
      const result = await browser.storage.local.get(['authToken', 'user']);
      console.log('Storage result - token exists:', !!result.authToken, 'user exists:', !!result.user);

      if (result.authToken && result.user) {
        setAuthState({
          isAuthenticated: true,
          user: result.user,
          token: result.authToken,
        });
        setViewState('clip');
      } else {
        console.log('No auth token found, showing login');
        setViewState('login');
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setViewState('login');
    }
  };

  const handleLogin = () => {
    // Open the frontend extension auth page
    // This page checks if user is logged in and redirects to get the extension token
    // In development, frontend is at port 3000
    const frontendUrl = getApiBaseUrl().replace(':8000', ':3000');
    browser.tabs.create({
      url: `${frontendUrl}/extension/auth`,
    });
  };

  const handleClip = async () => {
    try {
      setError(null);
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

      if (!tab.id || !tab.url) {
        setError('No active tab found');
        return;
      }

      // Skip special pages that can't be clipped
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
        setError('Cannot clip browser system pages. Please navigate to a regular website.');
        return;
      }

      let response;
      try {
        // First, try to send message to existing content script
        response = await browser.tabs.sendMessage(tab.id, {
          type: 'GET_PAGE_CONTENT',
          payload: { mode: clipMode },
        });
      } catch {
        // Content script not loaded, inject it programmatically
        console.log('Content script not found, injecting...');
        try {
          await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js'],
          });
          // Wait a moment for the script to initialize
          await new Promise((resolve) => setTimeout(resolve, 100));
          // Retry sending message
          response = await browser.tabs.sendMessage(tab.id, {
            type: 'GET_PAGE_CONTENT',
            payload: { mode: clipMode },
          });
        } catch (injectErr) {
          console.error('Failed to inject content script:', injectErr);
          setError('Cannot access this page. Please try refreshing the page.');
          return;
        }
      }

      if (response && response.type === 'PAGE_CONTENT_RESULT') {
        const content = response.payload as ClippedContent;
        setClippedContent(content);
        setTitle(content.title);
        setDescription(content.excerpt || '');
        setViewState('preview');
      } else {
        setError('No content received. Please refresh the page and try again.');
      }
    } catch (err) {
      console.error('Clip failed:', err);
      setError('Failed to clip page. Please refresh the page and try again.');
    }
  };

  const handleSubmit = async () => {
    if (!clippedContent) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Always fetch fresh token from storage to ensure we have the latest
      console.log('Fetching token from storage...');
      const result = await browser.storage.local.get(['authToken']);
      const token = result.authToken;
      console.log('Token from storage:', token ? `${token.substring(0, 10)}...` : 'null');

      if (!token) {
        console.log('No token found, redirecting to login');
        setError('Not authenticated. Please log in again.');
        setViewState('login');
        return;
      }

      const request: CreateProjectRequest = {
        title,
        description,
        content: clippedContent.content,
        sourceUrl: clippedContent.url,
        images: clippedContent.images.map((img) => img.src),
        tags,
        categories: selectedCategory ? [selectedCategory] : [],
      };

      const response = await fetch(`${getApiBaseUrl()}/api/v1/extension/clip/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (data.success && data.project) {
        setSuccessUrl(`${getApiBaseUrl()}${data.project.url}`);
        setSuccessTitle(data.project.title);
        setViewState('success');
      } else {
        // If auth failed, prompt re-login
        if (response.status === 401) {
          await browser.storage.local.remove(['authToken', 'user']);
          setAuthState({ isAuthenticated: false, user: null, token: null });
          setError('Session expired. Please log in again.');
          setViewState('login');
        } else {
          setError(data.error || 'Failed to create project');
          setViewState('error');
        }
      }
    } catch (err) {
      console.error('Submit failed:', err);
      setError('Failed to save to All Thrive. Please try again.');
      setViewState('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleLogout = async () => {
    await browser.storage.local.remove(['authToken', 'user']);
    setAuthState({ isAuthenticated: false, user: null, token: null });
    setViewState('login');
  };

  const renderHeader = () => (
    <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
          <span className="text-white font-bold text-sm">AT</span>
        </div>
        <span className="font-semibold text-white">All Thrive Clipper</span>
      </div>
      {authState.isAuthenticated && (
        <button
          onClick={handleLogout}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          Logout
        </button>
      )}
    </div>
  );

  const renderLoading = () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  const renderLogin = () => (
    <div className="p-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
        <span className="text-white font-bold text-2xl">AT</span>
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Welcome to All Thrive</h2>
      <p className="text-slate-400 mb-6">
        Sign in to start clipping AI projects to your profile.
      </p>
      <button
        onClick={handleLogin}
        className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
      >
        Sign in to All Thrive
      </button>
    </div>
  );

  const renderClipOptions = () => (
    <div className="p-4">
      <h3 className="text-white font-medium mb-3">What do you want to clip?</h3>

      <div className="space-y-2 mb-4">
        <button
          onClick={() => setClipMode('article')}
          className={`w-full p-3 rounded-lg border text-left transition-all ${
            clipMode === 'article'
              ? 'border-primary-500 bg-primary-500/10 text-white'
              : 'border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          <div className="font-medium">Main Content</div>
          <div className="text-sm text-slate-400">Extracts the main article/conversation</div>
        </button>

        <button
          onClick={() => setClipMode('full')}
          className={`w-full p-3 rounded-lg border text-left transition-all ${
            clipMode === 'full'
              ? 'border-primary-500 bg-primary-500/10 text-white'
              : 'border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          <div className="font-medium">Full Page</div>
          <div className="text-sm text-slate-400">Captures entire page content</div>
        </button>

        <button
          onClick={() => setClipMode('selection')}
          className={`w-full p-3 rounded-lg border text-left transition-all ${
            clipMode === 'selection'
              ? 'border-primary-500 bg-primary-500/10 text-white'
              : 'border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          <div className="font-medium">Selection Only</div>
          <div className="text-sm text-slate-400">Clips only selected text</div>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleClip}
        className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
        Clip This Page
      </button>
    </div>
  );

  const renderPreview = () => (
    <div className="p-4 overflow-y-auto max-h-[400px]">
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500 resize-none"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
        >
          <option value="">Select a category...</option>
          {categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-1">Topics</label>
        <div className="flex gap-2 mb-2 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm flex items-center gap-1"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="Add a topic..."
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
          />
          <button
            onClick={handleAddTag}
            className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {clippedContent && clippedContent.images.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Images ({clippedContent.images.length})
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {clippedContent.images.slice(0, 5).map((img, i) => (
              <img
                key={i}
                src={img.src}
                alt={img.alt || `Image ${i + 1}`}
                className="w-16 h-16 object-cover rounded-lg border border-slate-700"
              />
            ))}
            {clippedContent.images.length > 5 && (
              <div className="w-16 h-16 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 text-sm">
                +{clippedContent.images.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setViewState('clip')}
          className="flex-1 py-2 px-4 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !title}
          className="flex-1 py-2 px-4 bg-gradient-to-r from-primary-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Save to All Thrive'}
        </button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="p-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Clipped Successfully!</h2>
      <p className="text-slate-400 mb-2">"{successTitle || title}" has been added to All Thrive.</p>
      <p className="text-slate-500 text-sm mb-6">You can find it in your playground.</p>
      {successUrl && (
        <button
          onClick={() => browser.tabs.create({ url: successUrl })}
          className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity mb-3"
        >
          View Project
        </button>
      )}
      <button
        onClick={() => {
          setViewState('clip');
          setClippedContent(null);
          setTitle('');
          setDescription('');
          setTags([]);
          setSelectedCategory('');
          setSuccessUrl(null);
          setSuccessTitle('');
        }}
        className="w-full py-2 px-4 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
      >
        Clip Another Page
      </button>
    </div>
  );

  const renderError = () => (
    <div className="p-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
      <p className="text-slate-400 mb-6">{error || 'Failed to save your clip. Please try again.'}</p>
      <button
        onClick={() => setViewState('preview')}
        className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div className="glass-panel min-h-[500px] flex flex-col">
      {renderHeader()}
      <div className="flex-1">
        {viewState === 'loading' && renderLoading()}
        {viewState === 'login' && renderLogin()}
        {viewState === 'clip' && renderClipOptions()}
        {viewState === 'preview' && renderPreview()}
        {viewState === 'success' && renderSuccess()}
        {viewState === 'error' && renderError()}
      </div>
    </div>
  );
};

export default App;
