/**
 * Sync Orchestrator Service
 * Handles sync coordination logic including conversation merging
 */

import { generatePartUUID } from '../conversationService';

/**
 * Merge local and remote conversation versions
 * Uses timestamps and lastUpdate to determine the latest version of each message and part
 * 
 * @param {Array} localConversation - Local conversation array
 * @param {Array} remoteConversation - Remote conversation array
 * @returns {Array} Merged conversation array
 */
export function mergeConversations(localConversation = [], remoteConversation = []) {
  // Create maps for quick lookup by message timestamp
  const localMessages = new Map();
  const remoteMessages = new Map();
  
  // Index local messages by timestamp
  (localConversation || []).forEach(msg => {
    if (msg.timestamp) {
      localMessages.set(msg.timestamp, msg);
    }
  });
  
  // Index remote messages by timestamp
  (remoteConversation || []).forEach(msg => {
    if (msg.timestamp) {
      remoteMessages.set(msg.timestamp, msg);
    }
  });
  
  // Get all unique timestamps
  const allTimestamps = new Set([
    ...localMessages.keys(),
    ...remoteMessages.keys()
  ]);
  
  const merged = [];
  
  // Debug: Log the timestamps array
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
  console.log('[mergeConversations] Debug info:', {
    localMessagesCount: localMessages.size,
    remoteMessagesCount: remoteMessages.size,
    allTimestampsSize: allTimestamps.size,
    sortedTimestampsLength: sortedTimestamps.length,
    sortedTimestamps: sortedTimestamps.slice(0, 5) // First 5 for debugging
  });
  
  // Process each message timestamp
  let iterationCount = 0;
  for (const timestamp of sortedTimestamps) {
    iterationCount++;
    console.log(`[mergeConversations] Iteration ${iterationCount}/${sortedTimestamps.length}, timestamp: ${timestamp}`);
    
    const localMsg = localMessages.get(timestamp);
    const remoteMsg = remoteMessages.get(timestamp);
    
    // If only one exists, use it (unless deleted)
    if (!localMsg && remoteMsg) {
      // Use remote if not deleted, or if deleted but local doesn't have it
      merged.push(remoteMsg);
    } else if (localMsg && !remoteMsg) {
      // Use local if not deleted
      if (!localMsg.deleted) {
        merged.push(localMsg);
      }
    } else if (localMsg && remoteMsg) {
      // Both exist - merge them
      const localLastUpdate = localMsg.lastUpdate || localMsg.timestamp || 0;
      const remoteLastUpdate = remoteMsg.lastUpdate || remoteMsg.timestamp || 0;
      
      // If local is deleted, mark remote as deleted too (local deletion takes precedence)
      if (localMsg.deleted && !remoteMsg.deleted) {
        // Local deletion should propagate to remote - mark remote as deleted
        const deletedRemoteMsg = {
          ...remoteMsg,
          deleted: true,
          lastUpdate: localLastUpdate // Use local deletion timestamp
        };
        merged.push(deletedRemoteMsg);
      } else if (!localMsg.deleted && remoteMsg.deleted) {
        // Remote is deleted but local is not - use local (non-deleted takes precedence)
        merged.push(localMsg);
      } else if (localMsg.deleted && remoteMsg.deleted) {
        // Both deleted - use the one with later lastUpdate
        if (localLastUpdate >= remoteLastUpdate) {
          merged.push(localMsg);
        } else {
          merged.push(remoteMsg);
        }
      } else {
        // Neither deleted - merge parts
        try {
          const mergedMsg = mergeMessageParts(localMsg, remoteMsg);
          merged.push(mergedMsg);
        } catch (error) {
          console.error(`[mergeConversations] Error merging message parts at timestamp ${timestamp}:`, error);
          // Fallback: use the one with later lastUpdate
          const localLastUpdate = localMsg.lastUpdate || localMsg.timestamp || 0;
          const remoteLastUpdate = remoteMsg.lastUpdate || remoteMsg.timestamp || 0;
          if (localLastUpdate >= remoteLastUpdate) {
            merged.push(localMsg);
          } else {
            merged.push(remoteMsg);
          }
        }
      }
    }
  }
  
  console.log(`[mergeConversations] Loop completed. Total iterations: ${iterationCount}, merged count: ${merged.length}`);
  
  return merged;
}

/**
 * Merge parts of a message
 * Uses part timestamps and lastUpdate to determine the latest version
 * 
 * @param {Object} localMsg - Local message
 * @param {Object} remoteMsg - Remote message
 * @returns {Object} Merged message
 */
function mergeMessageParts(localMsg, remoteMsg) {
  // Calculate message-level lastUpdate values
  const localMsgLastUpdate = localMsg.lastUpdate || localMsg.timestamp || 0;
  const remoteMsgLastUpdate = remoteMsg.lastUpdate || remoteMsg.timestamp || 0;
  
  // Determine which message to use as base (the one with later lastUpdate)
  const baseMsg = localMsgLastUpdate >= remoteMsgLastUpdate ? localMsg : remoteMsg;
  
  // Helper function to create a content-based key for matching parts without UUIDs
  const getContentKey = (part) => {
    const timestamp = part.timestamp || 0;
    const partType = part.thought ? 'thought' : 
                     part.executableCode ? 'code' :
                     part.codeExecutionResult ? 'execution' :
                     part.inlineData ? 'image' :
                     part.functionResponse ? 'function' :
                     'text';
    // Create a hash based on content to match identical parts
    let contentHash = '';
    if (part.text) {
      contentHash = part.text.substring(0, 100).replace(/\s+/g, ' ').trim();
    } else if (part.executableCode) {
      contentHash = part.executableCode.code?.substring(0, 100) || '';
    } else if (part.functionResponse) {
      contentHash = JSON.stringify(part.functionResponse).substring(0, 100);
    }
    return `${timestamp}-${partType}-${contentHash}`;
  };
  
  // Step 1: Create maps for parts with UUIDs (primary matching)
  const localPartsByUUID = new Map();
  const remotePartsByUUID = new Map();
  const localPartsWithoutUUID = [];
  const remotePartsWithoutUUID = [];
  
  (localMsg.parts || []).forEach(part => {
    if (part.uuid) {
      localPartsByUUID.set(part.uuid, part);
    } else {
      localPartsWithoutUUID.push(part);
    }
  });
  
  (remoteMsg.parts || []).forEach(part => {
    if (part.uuid) {
      remotePartsByUUID.set(part.uuid, part);
    } else {
      remotePartsWithoutUUID.push(part);
    }
  });
  
  // Step 2: Match all parts by content first (to prevent duplicates), then by UUID
  // This handles cases where same content has different UUIDs
  const mergedParts = [];
  const matchedRemoteUUIDs = new Set();
  const matchedLocalUUIDs = new Set();
  const matchedRemoteIndices = new Set();
  const matchedLocalIndices = new Set();
  const contentKeysSeen = new Set(); // Track content keys to prevent duplicates
  
  // Helper to check if two parts have the same content
  const partsHaveSameContent = (part1, part2) => {
    return getContentKey(part1) === getContentKey(part2);
  };
  
  // Step 2a: Match parts with UUIDs by UUID first
  for (const [uuid, localPart] of localPartsByUUID.entries()) {
    const remotePart = remotePartsByUUID.get(uuid);
    
    if (remotePart) {
      // Both exist with same UUID - use the one with later lastUpdate
      matchedRemoteUUIDs.add(uuid);
      matchedLocalUUIDs.add(uuid);
      const localPartLastUpdate = localPart.lastUpdate || localPart.timestamp || 0;
      const remotePartLastUpdate = remotePart.lastUpdate || remotePart.timestamp || 0;
      
      const contentKey = getContentKey(localPart);
      if (!contentKeysSeen.has(contentKey)) {
        contentKeysSeen.add(contentKey);
        if (localPartLastUpdate >= remotePartLastUpdate) {
          if (!localPart.deleted) {
            mergedParts.push(localPart);
          }
        } else {
          if (!remotePart.deleted) {
            mergedParts.push(remotePart);
          }
        }
      }
    }
  }
  
  // Step 2b: Match parts with UUIDs that weren't matched by UUID, but might match by content
  // Check local parts with UUIDs against remote parts (both with and without UUIDs)
  for (const [uuid, localPart] of localPartsByUUID.entries()) {
    if (matchedLocalUUIDs.has(uuid)) continue; // Already matched
    
    const localContentKey = getContentKey(localPart);
    if (contentKeysSeen.has(localContentKey)) continue; // Content already added
    
    let matched = false;
    
    // Check against remote parts with UUIDs that weren't matched
    for (const [remoteUUID, remotePart] of remotePartsByUUID.entries()) {
      if (matchedRemoteUUIDs.has(remoteUUID)) continue; // Already matched
      if (partsHaveSameContent(localPart, remotePart)) {
        matchedRemoteUUIDs.add(remoteUUID);
        matchedLocalUUIDs.add(uuid);
        matched = true;
        contentKeysSeen.add(localContentKey);
        
        const localPartLastUpdate = localPart.lastUpdate || localPart.timestamp || 0;
        const remotePartLastUpdate = remotePart.lastUpdate || remotePart.timestamp || 0;
        
        // Use the one with later lastUpdate, but preserve both UUIDs by using the newer one's UUID
        if (localPartLastUpdate >= remotePartLastUpdate) {
          if (!localPart.deleted) {
            mergedParts.push(localPart);
          }
        } else {
          if (!remotePart.deleted) {
            // Use remote part but keep its UUID
            mergedParts.push(remotePart);
          }
        }
        break;
      }
    }
    
    // Check against remote parts without UUIDs
    if (!matched) {
      for (let j = 0; j < remotePartsWithoutUUID.length; j++) {
        if (matchedRemoteIndices.has(j)) continue;
        const remotePart = remotePartsWithoutUUID[j];
        if (partsHaveSameContent(localPart, remotePart)) {
          matchedRemoteIndices.add(j);
          matchedLocalUUIDs.add(uuid);
          matched = true;
          contentKeysSeen.add(localContentKey);
          
          const localPartLastUpdate = localPart.lastUpdate || localPart.timestamp || 0;
          const remotePartLastUpdate = remotePart.lastUpdate || remotePart.timestamp || 0;
          
          // Use local part (it has UUID), but update remote part's UUID to match
          if (localPartLastUpdate >= remotePartLastUpdate) {
            if (!localPart.deleted) {
              mergedParts.push(localPart);
            }
          } else {
            if (!remotePart.deleted) {
              // Use remote part but assign local UUID for consistency
              mergedParts.push({ ...remotePart, uuid: localPart.uuid });
            }
          }
          break;
        }
      }
    }
    
    // If still not matched, add local part
    if (!matched && !localPart.deleted) {
      contentKeysSeen.add(localContentKey);
      mergedParts.push(localPart);
    }
  }
  
  // Step 2c: Add remote parts with UUIDs that weren't matched
  for (const [uuid, remotePart] of remotePartsByUUID.entries()) {
    if (matchedRemoteUUIDs.has(uuid)) continue;
    
    const contentKey = getContentKey(remotePart);
    if (contentKeysSeen.has(contentKey)) continue; // Content already added
    
    contentKeysSeen.add(contentKey);
    if (!remotePart.deleted) {
      mergedParts.push(remotePart);
    }
  }
  
  // Step 2d: Match parts without UUIDs by content
  for (let i = 0; i < localPartsWithoutUUID.length; i++) {
    if (matchedLocalIndices.has(i)) continue;
    
    const localPart = localPartsWithoutUUID[i];
    const localContentKey = getContentKey(localPart);
    if (contentKeysSeen.has(localContentKey)) continue; // Content already added
    
    let matched = false;
    
    // Try to find a matching remote part without UUID
    for (let j = 0; j < remotePartsWithoutUUID.length; j++) {
      if (matchedRemoteIndices.has(j)) continue;
      
      const remotePart = remotePartsWithoutUUID[j];
      if (partsHaveSameContent(localPart, remotePart)) {
        matchedRemoteIndices.add(j);
        matchedLocalIndices.add(i);
        matched = true;
        contentKeysSeen.add(localContentKey);
        
        const localPartLastUpdate = localPart.lastUpdate || localPart.timestamp || 0;
        const remotePartLastUpdate = remotePart.lastUpdate || remotePart.timestamp || 0;
        
        // Generate UUID and assign to both for consistency
        const uuid = generatePartUUID();
        if (localPartLastUpdate >= remotePartLastUpdate) {
          if (!localPart.deleted) {
            mergedParts.push({ ...localPart, uuid });
          }
        } else {
          if (!remotePart.deleted) {
            mergedParts.push({ ...remotePart, uuid });
          }
        }
        break;
      }
    }
    
    // If no match found, add local part with generated UUID
    if (!matched && !localPart.deleted) {
      contentKeysSeen.add(localContentKey);
      mergedParts.push({ ...localPart, uuid: generatePartUUID() });
    }
  }
  
  // Step 2e: Add remote parts without UUIDs that weren't matched
  for (let j = 0; j < remotePartsWithoutUUID.length; j++) {
    if (matchedRemoteIndices.has(j)) continue;
    
    const remotePart = remotePartsWithoutUUID[j];
    const contentKey = getContentKey(remotePart);
    if (contentKeysSeen.has(contentKey)) continue; // Content already added
    
    contentKeysSeen.add(contentKey);
    if (!remotePart.deleted) {
      mergedParts.push({ ...remotePart, uuid: generatePartUUID() });
    }
  }
  
  // Sort merged parts by timestamp to maintain chronological order
  mergedParts.sort((a, b) => {
    const timestampA = a.timestamp || 0;
    const timestampB = b.timestamp || 0;
    return timestampA - timestampB;
  });
  
  // Return merged message with merged parts
  return {
    ...baseMsg,
    parts: mergedParts,
    // Update lastUpdate to the latest of both messages
    lastUpdate: Math.max(localMsgLastUpdate, remoteMsgLastUpdate)
  };
}
