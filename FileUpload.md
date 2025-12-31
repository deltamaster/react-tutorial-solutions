# File Upload Implementation

## Overview

The file upload mechanism is designed to avoid embedding large file data directly in API requests. Instead, files are uploaded first to retrieve a file URI, which is then used in API requests via `file_data`. This reduces request payload size and improves performance.

**Key Features:**
- Images are compressed for display (reduces localStorage size) but uploaded at full quality
- User messages display immediately with compressed preview images
- File upload happens asynchronously while showing typing indicator
- PDFs don't store preview data (no inline_data) since there's no preview on the webpage
- File expiration tracking (12 hours) with automatic cleanup
- Automatic handling of expired files (403 errors) with retry mechanism

## Upload API

The upload API endpoint is: `https://jp-gw2.azure-api.net/gemini/files`

## Upload Process (2 Steps)

### Step 1: Prepare

POST `https://jp-gw2.azure-api.net/gemini/files` with the following HTTP header fields:

- `X-Goog-Upload-Protocol: resumable`
- `X-Goog-Upload-Command: start`
- `X-Goog-Upload-Header-Content-Length: ${FILE_SIZE_IN_BYTES}`
- `X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}`
- `Content-Type: application/json`
- `Ocp-Apim-Subscription-Key: ${SUBSCRIPTION_KEY}`

**Response:**
- Extract the `x-goog-upload-url` header value
- Extract **only the query parameters** from this header value (not the entire URL)
- If the header contains a full URL, parse it and extract only the query string
- If the header contains just query parameters, use them as-is (add `?` prefix if missing)

### Step 2: Upload

POST `https://jp-gw2.azure-api.net/gemini/files${queryParams}` with:

- **Body:** The actual binary file content (as ArrayBuffer)
- **Headers:**
  - `X-Goog-Upload-Offset: 0`
  - `X-Goog-Upload-Command: upload, finalize`
  - `Ocp-Apim-Subscription-Key: ${SUBSCRIPTION_KEY}`

**Example Response:**
```json
{
    "file": {
        "name": "files/prsxstwp6anr",
        "displayName": "test",
        "mimeType": "text/plain",
        "sizeBytes": "100",
        "createTime": "2025-12-28T05:10:58.357491Z",
        "updateTime": "2025-12-28T05:10:58.357491Z",
        "expirationTime": "2025-12-30T05:10:57.099754402Z",
        "sha256Hash": "MWQxYzRmYWE3ZDczYmE4NzgzODU4NDMyZjU5MjkxMTc3MjAwMjQ0YTViYjIyYmNlZjA5YzFkYWFhNTkxYjlhZg==",
        "uri": "https://generativelanguage.googleapis.com/v1beta/files/prsxstwp6anr",
        "state": "ACTIVE",
        "source": "UPLOADED"
    }
}
```

The `.file.uri` value is what we need for the API request.

## User Experience Flow

1. **User submits file** → User message bubble appears immediately
2. **For images:** Compressed preview (720x720 max, 0.7 quality) is shown immediately using `inline_data` with base64
3. **For PDFs:** Message appears without preview (no `inline_data`)
4. **Typing indicator** shows immediately ("... is typing ...")
5. **File upload** happens asynchronously in the background
6. **After upload completes:** User message is updated with `file_data` containing the file URI
7. **API request** is sent with `file_data` (not `inline_data`)

## Data Storage

### In Conversation History (localStorage)

**For Images:**
- `inline_data`: Compressed base64 data (max 720x720, 0.7 quality) - for display only
- `file_data`: File URI from upload - for API requests

**For PDFs:**
- `file_data`: File URI from upload - for API requests
- No `inline_data` (no preview needed)

### In API Requests

**When `file_data` exists:**
- Send **only** `file_data` with `mime_type` and `file_uri`
- **Exclude** `inline_data` from the request (even if present in localStorage)

**Format:**
```json
{
    "file_data": {
        "mime_type": "image/jpeg",
        "file_uri": "https://generativelanguage.googleapis.com/v1beta/files/prsxstwp6anr"
    }
}
```

## Image Compression

Images are compressed for display purposes to reduce localStorage size:

- **Max dimensions:** 720x720 pixels (maintains aspect ratio)
- **Quality:** 0.7 (70%)
- **Method:** HTML5 Canvas API
- **Original file:** Full quality file is uploaded to the API (not compressed)

This ensures:
- Smaller localStorage footprint
- Faster page loads
- Full quality images sent to the API for analysis

## File Expiration and Tracking

### Overview

Uploaded files expire after 12 hours. The system tracks all uploaded files to manage expiration and handle errors gracefully.

### File Tracking

**Storage:**
- Tracked files are stored in localStorage under the key `uploaded_files`
- Each file is tracked with:
  - `file_id`: Extracted from the file URI (e.g., "prsxstwp6anr" from `https://generativelanguage.googleapis.com/v1beta/files/prsxstwp6anr`)
  - `uploadTime`: Timestamp when the file was uploaded
  - `fileUri`: The complete file URI

**File ID Extraction:**
- File ID is extracted from the URI using regex: `/\/files\/([^\/\?]+)/`
- Example: `https://generativelanguage.googleapis.com/v1beta/files/prsxstwp6anr` → `prsxstwp6anr`

### Expiration Handling

**Expiration Time:** 12 hours from upload time

**Before API Requests:**
- All conversation contents are scanned for `file_data` parts
- Files older than 12 hours are automatically replaced with `{ text: "expired content" }`
- This prevents API errors from expired file references

**On 403 Errors:**
- When a 403 error occurs with message format: "You do not have permission to access the File {file_id}..."
- The file ID is extracted from the error message
- The file is immediately marked as expired in tracking
- The conversation history is updated to replace the expired file with "expired content"
- The API request is automatically retried with cleaned contents

**Error Message Format:**
```
You do not have permission to access the File 3pkmvw1slxx8 or it may not exist. - Please check your API key (Status: 403)
```

### Conversation Export/Import

**Export Format (Version 1.2+):**
```json
{
    "version": "1.2",
    "conversation": [...],
    "conversation_summaries": [...],
    "uploaded_files": {
        "prsxstwp6anr": {
            "uploadTime": 1703752258000,
            "fileUri": "https://generativelanguage.googleapis.com/v1beta/files/prsxstwp6anr"
        },
        "3pkmvw1slxx8": {
            "uploadTime": 1703753000000,
            "fileUri": "https://generativelanguage.googleapis.com/v1beta/files/3pkmvw1slxx8"
        }
    }
}
```

**Import Behavior:**
- If `uploaded_files` exists in the imported data, it restores the file tracking
- If not present (old format), file tracking is cleared
- This ensures file expiration times are preserved across sessions

### Benefits

- **Prevents API Errors:** Expired files are removed before requests
- **Automatic Recovery:** 403 errors trigger automatic cleanup and retry
- **User Experience:** Users see "expired content" instead of broken references
- **Data Integrity:** File tracking persists across conversation exports/imports