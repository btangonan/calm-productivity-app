// utils.gs

/**
 * Parses a multipart/form-data request body.
 *
 * @param {object} e The event object from a doPost(e) call.
 * @returns {object} An object where keys are the form field names and values are either
 *                   a string (for regular fields) or a Blob object (for file uploads).
 */
function parseMultipartFormData(e) {
  const contentType = e.postData.type;
  const boundary = contentType.split('; ')[1].replace('boundary=', '');
  const data = e.postData.contents;
  const parts = data.split(boundary);
  const result = {};

  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    const lines = part.split('\r\n');

    // The first line is empty, the second contains Content-Disposition
    if (lines.length > 1 && lines[1].includes('Content-Disposition')) {
      const dispositionHeader = lines[1];
      const nameMatch = /name="([^"]+)"/.exec(dispositionHeader);

      if (nameMatch) {
        const name = nameMatch[1];
        const filenameMatch = /filename="([^"]+)"/.exec(dispositionHeader);

        let contentStartIndex = part.indexOf('\r\n\r\n') + 4;
        let contentEndIndex = part.lastIndexOf('\r\n');
        let content = part.substring(contentStartIndex, contentEndIndex);

        if (filenameMatch) {
          // It's a file
          const contentTypeHeader = lines.find(line => line.toLowerCase().startsWith('content-type:'));
          const mimeType = contentTypeHeader ? contentTypeHeader.split(': ')[1] : 'application/octet-stream';
          const blob = Utilities.newBlob(Utilities.base64Decode(content), mimeType, filenameMatch[1]);
          result[name] = blob;
        } else {
          // It's a form field
          result[name] = content;
        }
      }
    }
  }
  return result;
}