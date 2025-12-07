/**
 * All Thrive Web Clipper - Background Service Worker
 * Handles authentication, API calls, and keyboard shortcuts
 */

import browser from 'webextension-polyfill';
import type { AuthState, CreateProjectRequest, CreateProjectResponse, ExtensionMessage } from '../types';

// TODO: Change to 'https://allthrive.ai' for production
const API_BASE_URL = 'http://localhost:8000';

// Handle extension installation
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('All Thrive Web Clipper installed');
    // Initialize default settings
    await browser.storage.local.set({
      settings: {
        apiBaseUrl: API_BASE_URL,
        autoDetect: true,
        defaultVisibility: 'public',
        includeImages: true,
        includeMetadata: true,
      },
    });
  }
});

// Handle keyboard shortcuts
browser.commands.onCommand.addListener(async (command) => {
  if (command === 'quick_clip') {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await quickClip(tab.id);
    }
  }
});

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener(async (message: ExtensionMessage, sender) => {
  switch (message.type) {
    case 'CHECK_AUTH':
      return checkAuth();

    case 'CREATE_PROJECT':
      return createProject(message.payload as CreateProjectRequest);

    case 'HIGHLIGHT_CONTENT':
      // Handle highlighted content from content script
      const highlightData = message.payload as { markdown: string; html: string };
      await browser.storage.local.set({ pendingClip: highlightData });
      // Open popup to let user save
      await browser.action.openPopup();
      return { success: true };

    default:
      return false;
  }
});

// Handle auth callback from All Thrive website
browser.webNavigation.onCompleted.addListener(async (details) => {
  console.log('Navigation completed:', details.url);

  if (details.url.includes('/extension/auth/callback')) {
    console.log('Auth callback detected!');
    try {
      // Extract token from URL
      const url = new URL(details.url);
      const token = url.searchParams.get('token');
      const userDataStr = url.searchParams.get('user');

      console.log('Token found:', !!token);
      console.log('User data found:', !!userDataStr);

      if (token && userDataStr) {
        // searchParams.get already decodes the value, so just parse the JSON
        let user;
        try {
          user = JSON.parse(userDataStr);
        } catch (parseError) {
          // If parsing fails, try decoding first (in case of double encoding)
          console.log('Direct parse failed, trying decode first');
          user = JSON.parse(decodeURIComponent(userDataStr));
        }

        console.log('User parsed:', user);

        await browser.storage.local.set({
          authToken: token,
          user: user,
        });

        console.log('Token and user saved to storage');

        // Verify storage
        const saved = await browser.storage.local.get(['authToken', 'user']);
        console.log('Verified storage - token exists:', !!saved.authToken);

        // Close the auth tab
        await browser.tabs.remove(details.tabId);
        console.log('Auth tab closed');

        // Notify popup (may fail if popup is closed, that's ok)
        try {
          browser.runtime.sendMessage({
            type: 'AUTH_STATUS',
            payload: { isAuthenticated: true, user },
          });
        } catch (e) {
          // Popup might be closed, that's fine
        }
      }
    } catch (error) {
      console.error('Auth callback error:', error);
    }
  }
}, {
  url: [
    { hostContains: 'allthrive.ai' },
    { hostContains: 'localhost' },
  ],
});

async function checkAuth(): Promise<AuthState> {
  try {
    const result = await browser.storage.local.get(['authToken', 'user']);
    if (result.authToken && result.user) {
      // Verify token is still valid
      const response = await fetch(`${API_BASE_URL}/api/v1/extension/verify/`, {
        headers: {
          'Authorization': `Bearer ${result.authToken}`,
        },
      });

      if (response.ok) {
        return {
          isAuthenticated: true,
          user: result.user,
          token: result.authToken,
        };
      } else {
        // Token expired, clear storage
        await browser.storage.local.remove(['authToken', 'user']);
      }
    }
  } catch (error) {
    console.error('Auth check error:', error);
  }

  return {
    isAuthenticated: false,
    user: null,
    token: null,
  };
}

async function createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
  try {
    const result = await browser.storage.local.get(['authToken']);
    if (!result.authToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/extension/clip/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.authToken}`,
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json();

    if (response.ok && responseData.id) {
      return {
        success: true,
        project: {
          id: responseData.id,
          slug: responseData.slug,
          url: `${API_BASE_URL}/project/${responseData.slug}`,
          title: responseData.title,
        },
      };
    } else {
      return {
        success: false,
        error: responseData.error || responseData.detail || 'Failed to create project',
      };
    }
  } catch (error) {
    console.error('Create project error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.',
    };
  }
}

async function quickClip(tabId: number): Promise<void> {
  try {
    const auth = await checkAuth();
    if (!auth.isAuthenticated) {
      // Open popup to prompt login
      await browser.action.openPopup();
      return;
    }

    // Get page content
    const response = await browser.tabs.sendMessage(tabId, {
      type: 'GET_PAGE_CONTENT',
      payload: { mode: 'article' },
    });

    if (response?.type === 'PAGE_CONTENT_RESULT') {
      const content = response.payload;

      // Auto-create project with minimal interaction
      const result = await createProject({
        title: content.title,
        description: content.excerpt,
        content: content.content,
        sourceUrl: content.url,
        images: content.images?.map((img: { src: string }) => img.src),
      });

      if (result.success) {
        // Show notification
        await browser.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Clipped to All Thrive',
          message: `"${content.title}" saved successfully!`,
        });
      } else {
        await browser.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Clip Failed',
          message: result.error || 'Failed to save clip',
        });
      }
    }
  } catch (error) {
    console.error('Quick clip error:', error);
    await browser.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Clip Failed',
      message: 'Could not clip this page. Try opening the extension popup.',
    });
  }
}

// Context menu for right-click clipping
browser.contextMenus?.create({
  id: 'clip-selection',
  title: 'Clip to All Thrive',
  contexts: ['selection', 'page', 'image'],
});

browser.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'clip-selection' && tab?.id) {
    if (info.selectionText) {
      // Clip selected text
      await browser.tabs.sendMessage(tab.id, {
        type: 'GET_PAGE_CONTENT',
        payload: { mode: 'selection' },
      });
    } else if (info.srcUrl) {
      // Clip image
      await browser.storage.local.set({
        pendingClip: {
          type: 'image',
          src: info.srcUrl,
          pageUrl: tab.url,
          pageTitle: tab.title,
        },
      });
    }
    await browser.action.openPopup();
  }
});

console.log('All Thrive Web Clipper background service started');
