I set up a new API for file upload. The intention is to avoid embedding data in the request for images and pdf files. Instead, upload the file first and retrieve the file URI. Instead of repeating the `"inline_data"` in the request, use `"file_data"` by specifying the URI of the file just uploaded.  (Something like `file_data":{"mime_type": "image/jpeg", "file_uri": '$file_uri'}`).

The upload API is at https://jp-gw2.azure-api.net/gemini/files.

Upload takes 2 steps:

**Prepare**

POST `https://jp-gw2.azure-api.net/gemini/files` with the following HTTP header fields:

- X-Goog-Upload-Protocol: resumable
- X-Goog-Upload-Command: start
- X-Goog-Upload-Header-Content-Length: ${FILE_SIZE_IN_BYTES}"
- X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}"
- Content-Type: application/json

Search response header for field name `x-goog-upload-url` and extract all query parameters in the header value.

**Upload**

POST `https://jp-gw2.azure-api.net/gemini/files` with the actual binary file content in the POST data, all query parameters returned in response header `x-goog-upload-url` , and the following HTTP header fields:

- X-Goog-Upload-Offset: 0
- X-Goog-Upload-Command: upload, finalize

Example response:
```
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

The `.file.uri` is what we need.