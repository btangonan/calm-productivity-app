// backend/utils.gs

function parseMultipartFormData(e) {
  const contentType = e.postData.type;
  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) {
    throw new Error('Could not find boundary in Content-Type header.');
  }
  const boundary = boundaryMatch[1].trim();
  const body = e.postData.contents;

  const parts = body.split(`--${boundary}`);
  const result = {};

  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    const headerEndIndex = part.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) continue;

    const headers = part.substring(0, headerEndIndex);
    let content = part.substring(headerEndIndex + 4);

    // Remove trailing newline characters
    if (content.endsWith('\r\n')) {
      content = content.slice(0, -2);
    }

    const nameMatch = headers.match(/name="([^"]+)"/);
    if (nameMatch) {
      const name = nameMatch[1];
      const filenameMatch = headers.match(/filename="([^"]+)"/);

      if (filenameMatch) {
        // It's a file
        const mimeTypeMatch = headers.match(/Content-Type: ([\w\/]+)/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'application/octet-stream';
        const decodedContent = Utilities.base64Decode(content, Utilities.Charset.UTF_8);
        const blob = Utilities.newBlob(decodedContent, mimeType, filenameMatch[1]);
        result[name] = blob;
      } else {
        // It's a form field
        result[name] = content;
      }
    }
  }
  return result;
}