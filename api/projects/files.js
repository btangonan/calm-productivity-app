import { validateGoogleToken, getServiceAccountToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`🔐 Fetching files for project: ${projectId} for user: ${user.email}`);

    // Get service account access token
    const serviceAccountToken = await getServiceAccountToken();

    // First, get the project to find its Drive folder ID
    const projectsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}/values/Projects!A:H`,
      {
        headers: {
          'Authorization': `Bearer ${serviceAccountToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!projectsResponse.ok) {
      throw new Error(`Failed to fetch projects: ${projectsResponse.status}`);
    }

    const projectsData = await projectsResponse.json();
    const projects = (projectsData.values || []).slice(1);
    const project = projects.find(row => row[0] === projectId);

    if (!project || !project[5]) {
      console.log(`No Drive folder found for project: ${projectId}`);
      return res.status(200).json({
        success: true,
        data: [],
        count: 0,
        performance: {
          duration: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString()
        }
      });
    }

    const driveFolderId = project[5];
    console.log(`📁 Found Drive folder: ${driveFolderId}`);

    // Get files from Google Drive API (much faster than Apps Script)
    const filesResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${driveFolderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink,parents)&orderBy=modifiedTime desc`,
      {
        headers: {
          'Authorization': `Bearer ${serviceAccountToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!filesResponse.ok) {
      const errorText = await filesResponse.text();
      console.error('Drive API error:', filesResponse.status, errorText);
      throw new Error(`Drive API error: ${filesResponse.status}`);
    }

    const filesData = await filesResponse.json();
    const files = (filesData.files || []).map(file => ({
      id: file.id,
      name: file.name,
      type: getFileType(file.mimeType),
      mimeType: file.mimeType,
      size: parseInt(file.size) || 0,
      createdAt: file.createdTime,
      modifiedAt: file.modifiedTime,
      thumbnailLink: file.thumbnailLink,
      webViewLink: file.webViewLink,
      downloadUrl: `https://drive.google.com/uc?id=${file.id}&export=download`,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder'
    }));

    const duration = Date.now() - startTime;
    console.log(`⚡ Fetched ${files.length} files in ${duration}ms for project: ${projectId}`);

    return res.status(200).json({
      success: true,
      data: files,
      count: files.length,
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        projectId,
        driveFolderId
      }
    });

  } catch (error) {
    console.error('Get project files error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch project files',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

function getFileType(mimeType) {
  if (!mimeType) return 'unknown';
  
  if (mimeType.includes('spreadsheet')) return 'spreadsheet';
  if (mimeType.includes('document')) return 'document';  
  if (mimeType.includes('presentation')) return 'presentation';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'video';
  if (mimeType.includes('audio')) return 'audio';
  if (mimeType.includes('folder')) return 'folder';
  
  return 'file';
}