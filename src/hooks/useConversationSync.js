import { useState, useEffect, useRef, useCallback } from 'react';
import conversationSyncService from '../utils/conversationSyncService';
import { parseConversationData } from '../services/conversationService';
import { setTrackedFiles } from '../utils/fileTrackingService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook for OneDrive conversation sync
 * Syncs conversation from localStorage to OneDrive when available
 * localStorage is the primary storage, OneDrive is backup/sync layer
 * 
 * @param {Array} conversation - Current conversation from localStorage (source of truth)
 * @param {Function} setConversation - Function to update localStorage conversation
 */
export const useConversationSync = (conversation = [], setConversation = null) => {
  // Get auth context to listen for login events
  let isAuthenticated = false;
  try {
    const authContext = useAuth();
    isAuthenticated = authContext?.isAuthenticated || false;
  } catch (error) {
    // AuthContext not available, continue without it
    console.log('[useConversationSync] AuthContext not available');
  }
  
  const [conversations, setConversations] = useState([]);
  // Load latestConversationId from localStorage (per-device)
  const [currentConversationId, setCurrentConversationId] = useState(() => {
    return localStorage.getItem('onedrive_latest_conversation_id') || null;
  });
  // Load conversation title from localStorage (per-device)
  const [currentConversationTitle, setCurrentConversationTitle] = useState(() => {
    return localStorage.getItem('onedrive_latest_conversation_title') || 'New Conversation';
  });
  
  // Save currentConversationId to localStorage whenever it changes
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('onedrive_latest_conversation_id', currentConversationId);
    } else {
      localStorage.removeItem('onedrive_latest_conversation_id');
    }
  }, [currentConversationId]);
  
  // Save currentConversationTitle to localStorage whenever it changes
  useEffect(() => {
    if (currentConversationTitle && currentConversationTitle.trim()) {
      localStorage.setItem('onedrive_latest_conversation_title', currentConversationTitle);
    } else {
      localStorage.removeItem('onedrive_latest_conversation_title');
    }
  }, [currentConversationTitle]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [isOneDriveAvailable, setIsOneDriveAvailable] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  
  const syncTimeoutRef = useRef(null);
  const lastSyncedConversationRef = useRef(null);
  const conversationRef = useRef([]);
  const retryCountRef = useRef(0);
  const isSyncingRef = useRef(false); // Prevent concurrent syncs
  const syncInProgressRef = useRef(false); // Prevent re-triggering during sync
  const isLoadingFromOneDriveRef = useRef(false); // Prevent auto-save when loading from OneDrive
  const hasInitializedRef = useRef(false); // Prevent multiple initializations
  const lastSyncTimeRef = useRef(0); // Throttle sync calls
  const wasResetRef = useRef(false); // Track if reset happened - prevents reusing old ID
  const hasLoadedConversationsRef = useRef(false); // Prevent repeated conversation loading
  
  // Switch to a different conversation (defined early for use in useEffect)
  const switchConversation = useCallback(async (conversationId) => {
    if (!isOneDriveAvailable) {
      console.log('[switchConversation] OneDrive not available, cannot switch conversation');
      return;
    }
    
    // Don't switch if already on this conversation
    if (conversationId === currentConversationId) {
      console.log('[switchConversation] Already on this conversation, skipping');
      return;
    }
    
    try {
      setIsSyncing(true);
      setSyncError(null);
      
      console.log('[switchConversation] Starting conversation switch...', {
        from: currentConversationId,
        to: conversationId
      });
      
      // CRITICAL: Save current conversation BEFORE switching (final save)
      const currentConv = conversationRef.current;
      if (currentConversationId && currentConv && currentConv.length > 0) {
        console.log('[switchConversation] Saving current conversation before switch...', {
          conversationId: currentConversationId,
          conversationLength: currentConv.length
        });
        
        try {
          const accessToken = await conversationSyncService.getOneDriveAccessToken();
          if (accessToken) {
            // Upload conversation content
            await conversationSyncService.uploadConversation(
              accessToken,
              currentConversationId,
              { conversation: currentConv, updatedAt: new Date().toISOString() }
            );
            
            // Update index with final message count
            const index = await conversationSyncService.fetchConversationsIndex(accessToken);
            const conversationEntry = index.conversations.find(c => c.id === currentConversationId);
            if (conversationEntry) {
              conversationEntry.updatedAt = new Date().toISOString();
              conversationEntry.messageCount = currentConv.length;
              await conversationSyncService.uploadConversationsIndex(accessToken, index);
            }
            
            console.log('[switchConversation] Current conversation saved successfully');
          } else {
            console.warn('[switchConversation] No access token available, skipping save of current conversation');
          }
        } catch (saveError) {
          console.error('[switchConversation] Error saving current conversation:', saveError);
          // Continue with switch even if save fails - user might want to switch anyway
        }
      } else {
        console.log('[switchConversation] No current conversation to save', {
          hasId: !!currentConversationId,
          hasContent: currentConv && currentConv.length > 0
        });
      }
      
      // Load new conversation
      const accessToken = await conversationSyncService.getOneDriveAccessToken();
      if (!accessToken) {
        throw new Error('OneDrive access token not available');
      }
      
      const conversationData = await conversationSyncService.fetchConversation(
        accessToken,
        conversationId
      );
      
      if (!conversationData) {
        throw new Error('Conversation not found');
      }
      
      // Parse conversation data
      const { conversation: convData, conversation_summaries, uploaded_files } = 
        parseConversationData(JSON.stringify(conversationData));
      
      // Set flag to prevent auto-save when updating localStorage
      isLoadingFromOneDriveRef.current = true;
      
      // Restore conversation to localStorage (localStorage is source of truth)
      setConversation(convData || []);
      
      // Restore summaries
      if (conversation_summaries && conversation_summaries.length > 0) {
        localStorage.setItem('conversation_summaries', JSON.stringify(conversation_summaries));
      }
      
      // Restore tracked files
      if (uploaded_files && Object.keys(uploaded_files).length > 0) {
        setTrackedFiles(uploaded_files);
      }
      
      // Update current conversation ID (saved to localStorage automatically via useEffect)
      setCurrentConversationId(conversationId);
      
      // Update conversation ID in localStorage immediately
      localStorage.setItem('onedrive_latest_conversation_id', conversationId);
      
      const index = await conversationSyncService.fetchConversationsIndex(accessToken);
      const conversationEntry = index.conversations.find(c => c.id === conversationId);
      if (conversationEntry) {
        // Update title from OneDrive (saved to localStorage automatically via useEffect)
        const title = conversationEntry.name || 'New Conversation';
        setCurrentConversationTitle(title);
        // Also save title to localStorage immediately
        localStorage.setItem('onedrive_latest_conversation_title', title);
        console.log('[switchConversation] Loaded conversation title:', title);
      } else {
        // Conversation not found in index, use default title
        setCurrentConversationTitle('New Conversation');
        localStorage.setItem('onedrive_latest_conversation_title', 'New Conversation');
      }
      
      // Update lastSyncedConversationRef to prevent immediate re-sync
      lastSyncedConversationRef.current = JSON.stringify(convData || []);
      
      console.log('[switchConversation] Conversation switched successfully', {
        conversationId,
        conversationLength: convData?.length || 0,
        title: conversationEntry?.name || 'New Conversation'
      });
      
      setIsSyncing(false);
    } catch (error) {
      console.error('Error switching conversation:', error);
      setSyncError(error.message);
      setIsSyncing(false);
    }
  }, [isOneDriveAvailable, currentConversationId, setConversation]); // Removed conversation to prevent loops
  
  // Load conversations from OneDrive (only called once on initial check)
  const loadConversationsFromOneDrive = useCallback(async () => {
    // Prevent repeated loads
    if (hasLoadedConversationsRef.current) {
      console.log('[useConversationSync] Conversations already loaded, skipping...');
      return;
    }
    
    console.log('[useConversationSync] Loading conversations from OneDrive...');
    try {
      const accessToken = await conversationSyncService.getOneDriveAccessToken();
      if (accessToken) {
        const index = await conversationSyncService.fetchConversationsIndex(accessToken);
        setConversations(index.conversations || []);
        
        // Load latest conversation from localStorage if it exists
        const latestConversationId = localStorage.getItem('onedrive_latest_conversation_id');
        if (latestConversationId) {
          console.log('[useConversationSync] Loading latest conversation from localStorage:', latestConversationId);
          // Check if conversation exists in index
          const entry = index.conversations.find(c => c.id === latestConversationId);
          if (entry) {
            setCurrentConversationId(latestConversationId);
            setCurrentConversationTitle(entry.name || 'New Conversation');
            // Load the conversation content from OneDrive
            try {
              const conversationData = await conversationSyncService.fetchConversation(
                accessToken,
                latestConversationId
              );
              if (conversationData) {
                const { conversation: convData, conversation_summaries, uploaded_files } = 
                  parseConversationData(JSON.stringify(conversationData));
                
                // Set flag to prevent auto-save when updating localStorage
                isLoadingFromOneDriveRef.current = true;
                setConversation(convData || []);
                
                // Restore summaries
                if (conversation_summaries && conversation_summaries.length > 0) {
                  localStorage.setItem('conversation_summaries', JSON.stringify(conversation_summaries));
                }
                
                // Restore tracked files
                if (uploaded_files && Object.keys(uploaded_files).length > 0) {
                  setTrackedFiles(uploaded_files);
                }
                
                lastSyncedConversationRef.current = JSON.stringify(convData || []);
                console.log('[useConversationSync] Loaded conversation from OneDrive:', latestConversationId);
              }
            } catch (loadError) {
              console.error('[useConversationSync] Error loading conversation:', loadError);
              // Conversation might not exist, clear the ID and title
              localStorage.removeItem('onedrive_latest_conversation_id');
              localStorage.removeItem('onedrive_latest_conversation_title');
              setCurrentConversationId(null);
              setCurrentConversationTitle('New Conversation');
            }
          } else {
            console.log('[useConversationSync] Conversation not found in index, clearing localStorage ID and title');
            localStorage.removeItem('onedrive_latest_conversation_id');
            localStorage.removeItem('onedrive_latest_conversation_title');
            setCurrentConversationId(null);
            setCurrentConversationTitle('New Conversation');
          }
        } else {
          // No conversation ID in localStorage - check if current conversation is empty
          const currentConv = conversation || conversationRef.current || [];
          if (!currentConv || currentConv.length === 0) {
            // Current conversation is empty and no ID in localStorage
            // Load the most recent conversation from OneDrive
            if (index.conversations && index.conversations.length > 0) {
              // Sort by updatedAt descending to get most recent
              const sortedConversations = [...index.conversations].sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.createdAt || 0);
                const dateB = new Date(b.updatedAt || b.createdAt || 0);
                return dateB - dateA;
              });
              
              const mostRecentConversation = sortedConversations[0];
              console.log('[useConversationSync] Current conversation is empty, loading most recent conversation:', mostRecentConversation.id);
              
              try {
                const conversationData = await conversationSyncService.fetchConversation(
                  accessToken,
                  mostRecentConversation.id
                );
                if (conversationData) {
                  const { conversation: convData, conversation_summaries, uploaded_files } = 
                    parseConversationData(JSON.stringify(conversationData));
                  
                  // Set flag to prevent auto-save when updating localStorage
                  isLoadingFromOneDriveRef.current = true;
                  
                  // Save conversation ID to localStorage (via setCurrentConversationId)
                  setCurrentConversationId(mostRecentConversation.id);
                  setCurrentConversationTitle(mostRecentConversation.name || 'New Conversation');
                  setConversation(convData || []);
                  
                  // Restore summaries
                  if (conversation_summaries && conversation_summaries.length > 0) {
                    localStorage.setItem('conversation_summaries', JSON.stringify(conversation_summaries));
                  }
                  
                  // Restore tracked files
                  if (uploaded_files && Object.keys(uploaded_files).length > 0) {
                    setTrackedFiles(uploaded_files);
                  }
                  
                  lastSyncedConversationRef.current = JSON.stringify(convData || []);
                  console.log('[useConversationSync] Loaded most recent conversation from OneDrive:', mostRecentConversation.id);
                }
              } catch (loadError) {
                console.error('[useConversationSync] Error loading most recent conversation:', loadError);
              }
            } else {
              console.log('[useConversationSync] No conversations found in OneDrive');
            }
          } else {
            // Conversation has content but no ID in localStorage
            // This means we need to create a conversation ID on first sync
            // But don't create it here - let syncCurrentConversation handle it when user sends message
            console.log('[useConversationSync] Conversation has content but no ID - will be created on first sync');
          }
        }
        
        // Mark as loaded to prevent repeated loads
        hasLoadedConversationsRef.current = true;
      }
    } catch (error) {
      console.error('[useConversationSync] Error loading conversations:', error);
      setSyncError(error.message);
    }
  }, [conversation, setConversation]);
  
  // Check OneDrive availability function (reusable) - ONLY checks availability, doesn't load conversations
  const checkOneDriveAvailability = useCallback(async () => {
    console.log('[useConversationSync] Checking OneDrive availability...');
    let available = false;
    try {
      available = await conversationSyncService.isConversationSyncConfigured();
      console.log('[useConversationSync] OneDrive availability check result:', available);
      setIsOneDriveAvailable(available);
      
      // Log detailed status for debugging
      if (!available) {
        console.warn('[useConversationSync] OneDrive not available. Check console logs from isConversationSyncConfigured for details.');
      } else {
        // Only load conversations on first check (when availability becomes true)
        if (!hasLoadedConversationsRef.current) {
          console.log('[useConversationSync] OneDrive available for first time, loading conversations...');
          await loadConversationsFromOneDrive();
        }
      }
    } catch (error) {
      console.error('[useConversationSync] Error checking OneDrive availability:', error);
      setIsOneDriveAvailable(false);
      available = false;
    }
    
    if (!available) {
        // Load conversations index
        try {
          const accessToken = await conversationSyncService.getOneDriveAccessToken();
          if (accessToken) {
            const index = await conversationSyncService.fetchConversationsIndex(accessToken);
            setConversations(index.conversations || []);
            
            // Load latest conversation from localStorage if it exists
            const latestConversationId = localStorage.getItem('onedrive_latest_conversation_id');
            if (latestConversationId) {
              console.log('[useConversationSync] Loading latest conversation from localStorage:', latestConversationId);
              // Check if conversation exists in index
              const entry = index.conversations.find(c => c.id === latestConversationId);
              if (entry) {
                setCurrentConversationId(latestConversationId);
                setCurrentConversationTitle(entry.name || 'New Conversation');
                // Load the conversation content from OneDrive
                try {
                  const conversationData = await conversationSyncService.fetchConversation(
                    accessToken,
                    latestConversationId
                  );
                  if (conversationData) {
                    const { conversation: convData, conversation_summaries, uploaded_files } = 
                      parseConversationData(JSON.stringify(conversationData));
                    
                    // Set flag to prevent auto-save when updating localStorage
                    isLoadingFromOneDriveRef.current = true;
                    setConversation(convData || []);
                    
                    // Restore summaries
                    if (conversation_summaries && conversation_summaries.length > 0) {
                      localStorage.setItem('conversation_summaries', JSON.stringify(conversation_summaries));
                    }
                    
                    // Restore tracked files
                    if (uploaded_files && Object.keys(uploaded_files).length > 0) {
                      setTrackedFiles(uploaded_files);
                    }
                    
                    lastSyncedConversationRef.current = JSON.stringify(convData || []);
                    console.log('[useConversationSync] Loaded conversation from OneDrive:', latestConversationId);
                  }
                } catch (loadError) {
                  console.error('[useConversationSync] Error loading conversation:', loadError);
                  // Conversation might not exist, clear the ID and title
                  localStorage.removeItem('onedrive_latest_conversation_id');
                  localStorage.removeItem('onedrive_latest_conversation_title');
                  setCurrentConversationId(null);
                  setCurrentConversationTitle('New Conversation');
                }
              } else {
                console.log('[useConversationSync] Conversation not found in index, clearing localStorage ID and title');
                localStorage.removeItem('onedrive_latest_conversation_id');
                localStorage.removeItem('onedrive_latest_conversation_title');
                setCurrentConversationId(null);
                setCurrentConversationTitle('New Conversation');
              }
            } else {
              // No conversation ID in localStorage - check if current conversation is empty
              const currentConv = conversation || conversationRef.current || [];
              if (!currentConv || currentConv.length === 0) {
                // Current conversation is empty and no ID in localStorage
                // Load the most recent conversation from OneDrive
                if (index.conversations && index.conversations.length > 0) {
                  // Sort by updatedAt descending to get most recent
                  const sortedConversations = [...index.conversations].sort((a, b) => {
                    const dateA = new Date(a.updatedAt || a.createdAt || 0);
                    const dateB = new Date(b.updatedAt || b.createdAt || 0);
                    return dateB - dateA;
                  });
                  
                  const mostRecentConversation = sortedConversations[0];
                  console.log('[useConversationSync] Current conversation is empty, loading most recent conversation:', mostRecentConversation.id);
                  
                  try {
                    const conversationData = await conversationSyncService.fetchConversation(
                      accessToken,
                      mostRecentConversation.id
                    );
                    if (conversationData) {
                      const { conversation: convData, conversation_summaries, uploaded_files } = 
                        parseConversationData(JSON.stringify(conversationData));
                      
                      // Set flag to prevent auto-save when updating localStorage
                      isLoadingFromOneDriveRef.current = true;
                      
                      // Save conversation ID to localStorage (via setCurrentConversationId)
                      setCurrentConversationId(mostRecentConversation.id);
                      setCurrentConversationTitle(mostRecentConversation.name || 'New Conversation');
                      setConversation(convData || []);
                      
                      // Restore summaries
                      if (conversation_summaries && conversation_summaries.length > 0) {
                        localStorage.setItem('conversation_summaries', JSON.stringify(conversation_summaries));
                      }
                      
                      // Restore tracked files
                      if (uploaded_files && Object.keys(uploaded_files).length > 0) {
                        setTrackedFiles(uploaded_files);
                      }
                      
                      lastSyncedConversationRef.current = JSON.stringify(convData || []);
                      console.log('[useConversationSync] Loaded most recent conversation from OneDrive:', mostRecentConversation.id);
                    }
                  } catch (loadError) {
                    console.error('[useConversationSync] Error loading most recent conversation:', loadError);
                  }
                } else {
                  console.log('[useConversationSync] No conversations found in OneDrive');
                }
              } else {
                // Conversation has content but no ID in localStorage
                // This means we need to create a conversation ID on first sync
                // But don't create it here - let syncCurrentConversation handle it when user sends message
                console.log('[useConversationSync] Conversation has content but no ID - will be created on first sync');
              }
            }
          }
        } catch (error) {
          console.error('[useConversationSync] Error loading conversations:', error);
          setSyncError(error.message);
        }
      console.log('[useConversationSync] OneDrive not available - user may need to log in');
    }
    
    return available;
  }, [loadConversationsFromOneDrive]);
  
  // Check OneDrive availability on mount and when user logs in
  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;
    
    let mounted = true;
    
    const checkAvailability = async () => {
      if (!mounted) return;
      await checkOneDriveAvailability();
    };
    
    // Initial check
    checkAvailability();
    
    // Re-check periodically (every 5 seconds) to catch when user logs in
    // Always check (don't rely on isOneDriveAvailable state which might be stale in closure)
    const intervalId = setInterval(() => {
      if (mounted) {
        console.log('[useConversationSync] Periodic OneDrive availability check...');
        checkAvailability();
      }
    }, 5000);
    
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []); // EMPTY DEPENDENCY ARRAY - ONLY RUN ONCE ON MOUNT
  
  // Re-check OneDrive availability when user logs in
  useEffect(() => {
    if (isAuthenticated && !hasLoadedConversationsRef.current) {
      console.log('[useConversationSync] User authenticated, checking OneDrive availability...');
      // Only check if we haven't loaded conversations yet
      checkOneDriveAvailability();
    }
  }, [isAuthenticated, checkOneDriveAvailability]);
  
  // Update conversationRef when conversation prop changes (from localStorage)
  // This ensures conversationRef is always in sync with the conversation prop
  // NOTE: conversationRef should also be updated immediately in setConversation wrapper
  useEffect(() => {
    const convArray = Array.isArray(conversation) ? conversation : [];
    // Only update if different to avoid unnecessary updates and ensure we have latest
    const currentRefStr = JSON.stringify(conversationRef.current || []);
    const newConvStr = JSON.stringify(convArray);
    if (currentRefStr !== newConvStr) {
      conversationRef.current = convArray;
      console.log('[useConversationSync] Conversation prop updated, ref synced', {
        conversationLength: convArray.length,
        currentConversationId,
        fromProp: true
      });
    }
  }, [conversation, currentConversationId]);
  
  // DISABLED: Auto-save conversation when it changes
  // This was causing infinite loops with 100+ requests per second
  // Auto-save must be triggered explicitly, not via useEffect watching conversation changes
  // The conversation prop changes too frequently and causes cascading API calls
  
  
  // Create a new conversation
  const createConversation = useCallback(async (name = 'New Conversation') => {
    if (!isOneDriveAvailable) {
      return null;
    }
    
    try {
      setIsSyncing(true);
      setSyncError(null);
      
      const accessToken = await conversationSyncService.getOneDriveAccessToken();
      if (!accessToken) {
        throw new Error('OneDrive access token not available');
      }
      
      const conversationId = await conversationSyncService.createNewConversation(
        accessToken,
        name,
        { conversation: [] }
      );
      
      // Save conversation ID to localStorage (per-device)
      setCurrentConversationId(conversationId);
      
      // Refresh conversations list
      const index = await conversationSyncService.fetchConversationsIndex(accessToken);
      setConversations(index.conversations);
      
      // Switch to new conversation
      await switchConversation(conversationId);
      
      setIsSyncing(false);
      return conversationId;
    } catch (error) {
      console.error('Error creating conversation:', error);
      setSyncError(error.message);
      setIsSyncing(false);
      return null;
    }
  }, [isOneDriveAvailable, switchConversation]);
  
  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId) => {
    if (!isOneDriveAvailable) {
      return;
    }
    
    try {
      setIsSyncing(true);
      setSyncError(null);
      
      const accessToken = await conversationSyncService.getOneDriveAccessToken();
      if (!accessToken) {
        throw new Error('OneDrive access token not available');
      }
      
      await conversationSyncService.deleteConversation(accessToken, conversationId);
      
      // Update index
      const index = await conversationSyncService.fetchConversationsIndex(accessToken);
      index.conversations = index.conversations.filter(c => c.id !== conversationId);
      
      await conversationSyncService.uploadConversationsIndex(accessToken, index);
      setConversations(index.conversations);
      
      // Switch to another conversation if current was deleted
      if (currentConversationId === conversationId) {
        if (index.conversations.length > 0) {
          await switchConversation(index.conversations[0].id);
        } else {
          setCurrentConversationId(null); // This will also clear localStorage
          setConversation([]); // Update localStorage
          setCurrentConversationTitle('New Conversation');
        }
      }
      
      setIsSyncing(false);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setSyncError(error.message);
      setIsSyncing(false);
    }
  }, [isOneDriveAvailable, currentConversationId, switchConversation, setConversation]);
  
  // Rename a conversation (stops auto-title)
  const renameConversation = useCallback(async (conversationId, newName) => {
    if (!isOneDriveAvailable) {
      return;
    }
    
    try {
      setIsSyncing(true);
      setSyncError(null);
      
      const accessToken = await conversationSyncService.getOneDriveAccessToken();
      if (!accessToken) {
        throw new Error('OneDrive access token not available');
      }
      
      const index = await conversationSyncService.fetchConversationsIndex(accessToken);
      const conversationEntry = index.conversations.find(c => c.id === conversationId);
      
      if (conversationEntry) {
        conversationEntry.name = newName;
        conversationEntry.autoTitle = false; // Stop auto-title updates
        conversationEntry.updatedAt = new Date().toISOString();
        
        await conversationSyncService.uploadConversationsIndex(accessToken, index);
        setConversations(index.conversations);
        
        if (conversationId === currentConversationId) {
          setCurrentConversationTitle(newName);
        }
      }
      
      setIsSyncing(false);
    } catch (error) {
      console.error('Error renaming conversation:', error);
      setSyncError(error.message);
      setIsSyncing(false);
    }
  }, [isOneDriveAvailable, currentConversationId]);
  
  // Update conversation title (manual edit)
  const updateConversationTitle = useCallback(async (newTitle) => {
    if (!currentConversationId) {
      return;
    }
    await renameConversation(currentConversationId, newTitle);
  }, [currentConversationId, renameConversation]);
  
  // Manual sync trigger (for explicit calls only - NO auto-save)
  const syncCurrentConversation = useCallback(async () => {
    // Prevent concurrent syncs FIRST (before any other checks)
    if (syncInProgressRef.current || isSyncingRef.current) {
      console.log('[useConversationSync] Sync already in progress, skipping', {
        syncInProgress: syncInProgressRef.current,
        isSyncing: isSyncingRef.current
      });
      return;
    }
    
    // CRITICAL: Get current conversation from ref RIGHT BEFORE checking if changed
    // This ensures we have the absolute latest conversation state, even if it was just updated
    // Don't cache it early - read it fresh each time we need it
    let currentConv = conversationRef.current;
    if (!currentConv || currentConv.length === 0) {
      console.log('[useConversationSync] No conversation to sync');
      return;
    }
    
    // Check if already synced (prevent duplicate syncs)
    // CRITICAL: Re-read conversationRef.current right before comparison to ensure we have latest
    currentConv = conversationRef.current; // Re-read to ensure we have latest
    const conversationStr = JSON.stringify(currentConv);
    const lastSyncedStr = lastSyncedConversationRef.current;
    
    if (conversationStr === lastSyncedStr) {
      const lastSyncedLength = lastSyncedStr ? JSON.parse(lastSyncedStr).length : 0;
      console.log('[useConversationSync] Conversation unchanged, skipping sync', {
        conversationLength: currentConv.length,
        lastSyncedLength: lastSyncedLength,
        conversationStr: conversationStr.substring(0, 100),
        lastSyncedStr: lastSyncedStr ? lastSyncedStr.substring(0, 100) : 'null'
      });
      return;
    }
    
    // Throttle sync calls - prevent more than one sync per second
    // BUT: If conversation has changed, we should sync even if throttled
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 1000) {
      console.log('[useConversationSync] Sync throttled (too soon after last sync), but conversation changed - will sync anyway', {
        timeSinceLastSync: now - lastSyncTimeRef.current,
        conversationLength: currentConv.length
      });
      // Don't return - allow sync to proceed even if throttled, since conversation changed
    }
    
    lastSyncTimeRef.current = now;
    syncInProgressRef.current = true;
    isSyncingRef.current = true;
    
    try {
      // Check if OneDrive is available
      // Always check current state (don't rely on cached state which might be stale)
      let available = await conversationSyncService.isConversationSyncConfigured();
      
      // Update state if it changed
      if (available !== isOneDriveAvailable) {
        console.log('[syncCurrentConversation] OneDrive availability changed:', {
          was: isOneDriveAvailable,
          now: available
        });
        setIsOneDriveAvailable(available);
      }
      
      if (!available) {
        console.log('[useConversationSync] OneDrive not available - user may need to log in');
        syncInProgressRef.current = false;
        isSyncingRef.current = false;
        return;
      }
      
      setIsSyncing(true);
      setSyncError(null);
      
      // CRITICAL: Re-read conversationRef.current RIGHT BEFORE sync to ensure we have absolute latest
      // This handles race conditions where conversation was updated between checks
      currentConv = conversationRef.current;
      const finalConversationStr = JSON.stringify(currentConv);
      
      console.log('[Sync] Starting OneDrive sync...', { 
        conversationLength: currentConv.length,
        currentConversationId,
        conversationChanged: finalConversationStr !== lastSyncedStr
      });
      
      const accessToken = await conversationSyncService.getOneDriveAccessToken();
      if (!accessToken) {
        console.log('[syncCurrentConversation] No access token available, will retry later');
        // Don't set isOneDriveAvailable to false - token might be refreshing
        syncInProgressRef.current = false;
        isSyncingRef.current = false;
        return;
      }
      
      // Get conversation ID - ALWAYS check localStorage directly first (source of truth after reset)
      // If reset happened, we must NOT reuse the old ID from state
      const localStorageId = localStorage.getItem('onedrive_latest_conversation_id');
      
      // CRITICAL: If reset happened, we must create a new ID even if localStorage has one
      // (This handles edge cases where localStorage wasn't cleared properly)
      let conversationIdToUse;
      if (wasResetRef.current) {
        console.log('[Sync] Reset detected - forcing new conversation ID creation');
        wasResetRef.current = false; // Clear the flag
        // Create new conversation ID regardless of what's in localStorage
        conversationIdToUse = await conversationSyncService.createNewConversation(
          accessToken,
          'New Conversation',
          { conversation: currentConv }
        );
        // Clear any old ID from localStorage and set the new one
        localStorage.removeItem('onedrive_latest_conversation_id');
        setCurrentConversationId(conversationIdToUse);
        localStorage.setItem('onedrive_latest_conversation_id', conversationIdToUse);
        
        // Refresh conversations list
        const index = await conversationSyncService.fetchConversationsIndex(accessToken);
        setConversations(index.conversations);
        console.log('[Sync] Created new conversation after reset:', conversationIdToUse);
      } else {
        // Normal flow: check localStorage first (most up-to-date), then state
        conversationIdToUse = localStorageId || currentConversationId;
        
        // If no conversation ID exists, create a new one
        // This handles cases where:
        // 1. User sent first message but OneDrive wasn't available
        // 2. Any other scenario where ID is missing
        if (!conversationIdToUse) {
          console.log('[Sync] No conversation ID found, creating new conversation...');
          conversationIdToUse = await conversationSyncService.createNewConversation(
            accessToken,
            'New Conversation',
            { conversation: currentConv }
          );
          // Set the new conversation ID (this will also save to localStorage via useEffect)
          setCurrentConversationId(conversationIdToUse);
          
          // Refresh conversations list only when creating new conversation
          const index = await conversationSyncService.fetchConversationsIndex(accessToken);
          // Update conversations state only when necessary (new conversation created)
          setConversations(index.conversations);
          console.log('[Sync] Created new conversation:', conversationIdToUse);
        } else {
          // Ensure state is in sync with localStorage
          if (conversationIdToUse !== currentConversationId) {
            setCurrentConversationId(conversationIdToUse);
          }
          console.log('[Sync] Updating existing conversation:', conversationIdToUse);
        }
      }
      
      const conversationData = {
        conversation: currentConv,
        updatedAt: new Date().toISOString()
      };
      
      // CRITICAL: Upload conversation content FIRST
      console.log('[Sync] Uploading conversation content to OneDrive...', {
        conversationId: conversationIdToUse,
        conversationLength: currentConv.length,
        messageCount: currentConv.length
      });
      
      await conversationSyncService.uploadConversation(
        accessToken,
        conversationIdToUse,
        conversationData
      );
      
      console.log('[Sync] Conversation content uploaded successfully');
      
      // Update index with new message count and updatedAt AFTER uploading conversation
      console.log('[Sync] Updating index with new message count...');
      const index = await conversationSyncService.fetchConversationsIndex(accessToken);
      const conversationEntry = index.conversations.find(c => c.id === conversationIdToUse);
      if (conversationEntry) {
        conversationEntry.updatedAt = new Date().toISOString();
        conversationEntry.messageCount = currentConv.length;
        // Don't update currentConversationId in index - it's per-device in localStorage
        await conversationSyncService.uploadConversationsIndex(accessToken, index);
        console.log('[Sync] Index updated successfully', {
          messageCount: conversationEntry.messageCount,
          updatedAt: conversationEntry.updatedAt
        });
        // Only update conversations state if we created a new conversation (already done above)
        // Don't update here for existing conversations to avoid re-renders and loops
      } else {
        console.warn('[Sync] Conversation entry not found in index, cannot update message count');
      }
      
      // Mark as synced using the FINAL conversation string (after re-reading ref)
      lastSyncedConversationRef.current = finalConversationStr;
      console.log('[Sync] Successfully saved conversation to OneDrive', {
        conversationId: conversationIdToUse,
        conversationLength: currentConv.length,
        messageCount: conversationEntry?.messageCount,
        finalConversationStr: finalConversationStr.substring(0, 100)
      });
    } catch (error) {
      console.error('[Sync] Error saving conversation to OneDrive:', error);
      setSyncError(error.message);
    } finally {
      setIsSyncing(false);
      syncInProgressRef.current = false;
      isSyncingRef.current = false;
    }
  }, [currentConversationId, isOneDriveAvailable]); // Depend on currentConversationId and isOneDriveAvailable
  
  // Generate and update title (called after model response)
  const generateAndUpdateTitle = useCallback(async () => {
    // CRITICAL: Use conversationRef.current instead of conversation prop
    // The ref is always up-to-date, while the prop might be stale due to React batching
    const currentConv = conversationRef.current;
    
    // Check OneDrive availability first (don't rely on cached state)
    const isAvailable = await conversationSyncService.isConversationSyncConfigured();
    if (!isAvailable) {
      console.log('[generateAndUpdateTitle] Skipping - OneDrive not available', {
        isOneDriveAvailable,
        checkedAvailable: isAvailable,
        conversationLength: currentConv?.length || 0
      });
      // Update state if it changed
      if (isAvailable !== isOneDriveAvailable) {
        setIsOneDriveAvailable(isAvailable);
      }
      return;
    }
    
    // Update state if it changed
    if (isAvailable !== isOneDriveAvailable) {
      setIsOneDriveAvailable(isAvailable);
    }
    
    if (!currentConv || currentConv.length === 0) {
      console.log('[generateAndUpdateTitle] Skipping - conversation empty', {
        conversationLength: currentConv?.length || 0
      });
      return;
    }
    
    try {
      setIsGeneratingTitle(true);
      
      const accessToken = await conversationSyncService.getOneDriveAccessToken();
      if (!accessToken) {
        setIsGeneratingTitle(false);
        return;
      }
      
      // Ensure we have a conversation ID
      // IMPORTANT: Do NOT create new conversation here - only use existing ID
      // New conversations should only be created in syncCurrentConversation when conversation is empty (after reset)
      let conversationIdToUse = currentConversationId;
      const localStorageId = localStorage.getItem('onedrive_latest_conversation_id');
      
      // Check consistency: if currentConversationId doesn't match localStorage, reset happened
      if (conversationIdToUse && conversationIdToUse !== localStorageId) {
        console.log('[generateAndUpdateTitle] Conversation ID mismatch (reset detected)');
        conversationIdToUse = null;
        setCurrentConversationId(null);
      }
      
      if (!conversationIdToUse) {
        // Check localStorage first
        conversationIdToUse = localStorageId;
        
        if (!conversationIdToUse) {
          // No conversation ID available - cannot generate title without a conversation
          // This should not happen if sync is working correctly
          console.log('[generateAndUpdateTitle] No conversation ID available, skipping title generation');
          setIsGeneratingTitle(false);
          return;
        } else {
          // Use the ID from localStorage
          setCurrentConversationId(conversationIdToUse);
        }
      }
      
      // Check if autoTitle is enabled (use cached index from above if available)
      let index = null;
      let conversationEntry = null;
      
      // Only fetch index if we didn't already fetch it above
      if (!conversationIdToUse || conversationIdToUse !== currentConversationId) {
        index = await conversationSyncService.fetchConversationsIndex(accessToken);
        conversationEntry = index.conversations.find(c => c.id === conversationIdToUse);
      } else {
        // Use existing conversations state to avoid another API call
        conversationEntry = conversations.find(c => c.id === conversationIdToUse);
        if (!conversationEntry) {
          index = await conversationSyncService.fetchConversationsIndex(accessToken);
          conversationEntry = index.conversations.find(c => c.id === conversationIdToUse);
        } else {
          // Clone conversations array to avoid mutating state
          index = { conversations: [...conversations] };
        }
      }
      
      // Default to autoTitle: true for new conversations
      const shouldAutoTitle = !conversationEntry || conversationEntry.autoTitle !== false;
      
      if (!shouldAutoTitle) {
        setIsGeneratingTitle(false);
        return;
      }
      
      // Generate title using conversationRef.current (always up-to-date)
      console.log('[Auto-title] Generating conversation title...', { 
        conversationLength: currentConv.length,
        conversationId: conversationIdToUse,
        usingRef: true
      });
      const generatedTitle = await conversationSyncService.generateConversationTitle(currentConv);
      console.log('[Auto-title] Generated title:', generatedTitle);
      
      // Update title in index
      if (conversationEntry) {
        conversationEntry.name = generatedTitle;
        conversationEntry.updatedAt = new Date().toISOString();
        conversationEntry.autoTitle = true; // Ensure autoTitle is set
      } else {
        // Create entry if it doesn't exist
        index.conversations.push({
          id: conversationIdToUse,
          name: generatedTitle,
          autoTitle: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: conversation.length,
          fileId: null,
          size: 0,
          tags: []
        });
      }
      
      // Don't update currentConversationId in index - it's per-device in localStorage
      await conversationSyncService.uploadConversationsIndex(accessToken, index);
      // Only update conversations state if it actually changed
      setConversations(index.conversations);
      setCurrentConversationTitle(generatedTitle);
      
      setIsGeneratingTitle(false);
    } catch (error) {
      console.error('Error generating title:', error);
      setIsGeneratingTitle(false);
    }
  }, [isOneDriveAvailable, currentConversationId, conversations]); // Removed conversation prop - using ref instead
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);
  
  // Reset current conversation (clear ID and title, start fresh)
  const resetCurrentConversation = useCallback(async () => {
    console.log('[useConversationSync] Resetting current conversation');
    
    // IMMEDIATELY clear conversation ID and title (UI updates instantly)
    const currentId = currentConversationId;
    const currentConv = conversationRef.current;
    
    // Set reset flag FIRST - this ensures syncCurrentConversation will create a new ID
    wasResetRef.current = true;
    
    // Clear localStorage FIRST to ensure immediate reset
    localStorage.removeItem('onedrive_latest_conversation_id');
    localStorage.removeItem('onedrive_latest_conversation_title');
    
    // Clear conversation ID (this will also sync to localStorage via useEffect, but we already cleared it)
    setCurrentConversationId(null);
    // Reset title to empty/null - component will show 'New Conversation' as fallback
    setCurrentConversationTitle('');
    // Clear last synced conversation ref so next sync will create a new conversation
    lastSyncedConversationRef.current = JSON.stringify([]);
    
    console.log('[useConversationSync] Reset complete - UI and localStorage cleared immediately, title reset, reset flag set');
    
    // Save old conversation to OneDrive in background (non-blocking)
    // This preserves the old conversation but doesn't block the UI reset
    if (currentId && currentConv && currentConv.length > 0) {
      console.log('[useConversationSync] Saving old conversation to OneDrive in background:', currentId);
      // Do this asynchronously without blocking
      (async () => {
        try {
          const accessToken = await conversationSyncService.getOneDriveAccessToken();
          if (accessToken) {
            // Final save of the old conversation to preserve it
            await conversationSyncService.uploadConversation(
              accessToken,
              currentId,
              { 
                conversation: currentConv, 
                updatedAt: new Date().toISOString() 
              }
            );
            
            // Update index with final message count
            const index = await conversationSyncService.fetchConversationsIndex(accessToken);
            const conversationEntry = index.conversations.find(c => c.id === currentId);
            if (conversationEntry) {
              conversationEntry.updatedAt = new Date().toISOString();
              conversationEntry.messageCount = currentConv.length;
              await conversationSyncService.uploadConversationsIndex(accessToken, index);
            }
            
            console.log('[useConversationSync] Saved old conversation to OneDrive');
          }
        } catch (error) {
          console.error('[useConversationSync] Error saving old conversation to OneDrive:', error);
          // Don't throw - reset already completed, this is just background cleanup
        }
      })();
    }
  }, [currentConversationId]);
  
  return {
    conversations,
    currentConversationId,
    currentConversationTitle,
    isSyncing,
    syncError,
    switchConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    updateConversationTitle,
    syncCurrentConversation,
    generateAndUpdateTitle,
    resetCurrentConversation,
    isOneDriveAvailable,
    isGeneratingTitle,
  };
};
