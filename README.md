# Calm Productivity - Personal Project Management App

A beautiful, minimalist personal project management web application that combines the clean efficiency of Things 3 with the calm, focused philosophy of Sunsama. Built with React, Tailwind CSS, Google Apps Script, and AI-powered suggestions via Ollama.

![Calm Productivity App](docs/app-screenshot.png)

## ✨ Features

### Core Functionality
- **Things 3-style Interface**: Clean, minimalist two-pane layout with intuitive navigation
- **Areas > Projects > Tasks Hierarchy**: Organize work with a structured, logical hierarchy
- **Smart Views**: Inbox, Today, Upcoming, Anytime, and Logbook views for focused productivity
- **Context Tagging**: Tag tasks with contexts like @computer, @office, @errands for better organization
- **Due Date Management**: Visual indicators for overdue, today, and upcoming tasks
- **Manual Task Reordering**: Drag-and-drop functionality to customize task order
- **Project Status Tracking**: Active, Paused, Completed, and Archive project states

### Advanced Features
- **Google Drive Integration**: Automatic folder creation for each project with one-click access
- **AI-Powered Suggestions**: Get intelligent next steps and identify blockers using local Ollama LLM
- **Responsive Design**: Beautiful interface that works on desktop and mobile devices
- **Real-time Updates**: Seamless data synchronization with Google Sheets backend

### Design Philosophy
- **Calm & Focused**: Minimalist design that promotes clarity and reduces cognitive load
- **High Contrast**: Clean typography with excellent readability
- **Native Feel**: Uses system fonts and follows OS design conventions
- **Generous Spacing**: Comfortable padding and margins for a peaceful user experience

## 🛠 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **Drag & Drop**: @dnd-kit for smooth task reordering
- **Backend**: Google Apps Script (serverless, free)
- **Database**: Google Sheets (free, collaborative)
- **File Storage**: Google Drive API
- **AI Engine**: Ollama (local LLM for privacy)
- **Deployment**: Vercel (frontend) + Google Cloud (backend)

## 🚀 Quick Start

### Prerequisites

1. **Google Account** - For Google Sheets and Drive API access
2. **Node.js 18+** - For running the React development server
3. **Ollama** (optional) - For AI suggestions feature

### 1. Backend Setup (Google Apps Script)

#### Enable Required APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API
   - Google Apps Script API

#### Set up Google Apps Script

1. Install Google's clasp CLI tool:
   ```bash
   npm install -g @google/clasp
   ```

2. Login to Google Apps Script:
   ```bash
   clasp login
   ```

3. Navigate to the backend directory:
   ```bash
   cd backend
   ```

4. Create a new Google Apps Script project:
   ```bash
   clasp create --title "Calm Productivity Backend" --type standalone
   ```

5. Update the `.clasp.json` file with your script ID (automatically generated)

6. Create a new Google Sheets spreadsheet:
   - Go to [Google Sheets](https://sheets.google.com)
   - Create a new blank spreadsheet
   - Copy the spreadsheet ID from the URL
   - Update `SPREADSHEET_ID` in `Code.gs`

7. Create a Google Drive folder for projects:
   - Go to [Google Drive](https://drive.google.com)
   - Create a new folder called "Calm Productivity Projects"
   - Copy the folder ID from the URL
   - Update `DRIVE_FOLDER_ID` in `Code.gs`

8. Deploy the Apps Script:
   ```bash
   clasp push
   clasp deploy
   ```

9. Set up web app deployment:
   - Open the Apps Script editor: `clasp open`
   - Go to Deploy > New Deployment
   - Choose "Web app" as type
   - Set execute as "Me" and access to "Anyone"
   - Copy the web app URL for frontend configuration

10. Initialize the database:
    - In the Apps Script editor, run the `initializeDatabase()` function
    - Check your Google Sheets to confirm the tabs were created

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd backend/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Update the API configuration:
   - Open `src/services/api.ts`
   - Replace the Google Apps Script web app URL (when deployed)
   - For development, the app uses mock data

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

### 3. AI Setup (Optional)

To enable AI-powered suggestions:

1. Install Ollama:
   - macOS: `brew install ollama`
   - Linux: `curl -fsSL https://ollama.ai/install.sh | sh`
   - Windows: Download from [ollama.ai](https://ollama.ai)

2. Pull a language model:
   ```bash
   ollama pull llama2
   ```

3. Start Ollama server:
   ```bash
   ollama serve
   ```

The AI suggestions feature will automatically detect if Ollama is running on `localhost:11434`.

## 📁 Project Structure

```
calm-productivity/
├── backend/
│   ├── Code.gs                 # Google Apps Script backend
│   ├── appsscript.json        # Apps Script configuration
│   └── .clasp.json            # Clasp deployment config
├── backend/frontend/          # React frontend (note: will be moved to root)
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── context/          # React context for state management
│   │   ├── services/         # API service layer
│   │   ├── types/            # TypeScript type definitions
│   │   └── ...
│   ├── public/
│   ├── package.json
│   └── ...
└── README.md
```

## 🎨 Design System

### Colors
- **Primary**: Blue (#3B82F6) for active states and CTAs
- **Background**: Light gray (#F5F5F7) for calm, easy-on-eyes backdrop
- **Content**: Pure white (#FFFFFF) for content areas
- **Text**: Dark gray (#111827) for excellent readability
- **Borders**: Light gray (#E5E7EB) for subtle separation

### Typography
- **Font Stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Approach**: Native system fonts for performance and OS integration

### Components
- **Task Items**: Generous padding, hover states, circular checkboxes
- **Sidebar Navigation**: Clean icons, badge counts, active states
- **Forms**: Focus states, validation, accessibility-first design

## 🚀 Deployment

### Frontend (Vercel)

1. Build the project:
   ```bash
   cd backend/frontend
   npm run build
   ```

2. Deploy to Vercel:
   - Connect your GitHub repository to Vercel
   - Set the build command to `npm run build`
   - Set the output directory to `dist`
   - Deploy automatically on push

### Backend (Google Apps Script)

The backend is already deployed when you run `clasp deploy`. To update:

```bash
cd backend
clasp push
clasp deploy
```

## 🔧 Configuration

### Environment Variables

For production deployment, you may want to set:

- `VITE_GOOGLE_SCRIPT_URL` - Your deployed Google Apps Script web app URL
- `VITE_OLLAMA_URL` - Ollama server URL (default: http://localhost:11434)

### Google Apps Script Variables

Update these constants in `Code.gs`:

- `SPREADSHEET_ID` - Your Google Sheets spreadsheet ID
- `DRIVE_FOLDER_ID` - Your Google Drive parent folder ID

## 📝 Usage Guide

### Creating Your First Project

1. Click the "+" button next to "Projects" in the sidebar
2. Enter a project name and description
3. A Google Drive folder will be automatically created
4. The project appears in your sidebar

### Adding Tasks

1. Click "Add Task" in the header
2. Fill in the task details:
   - **Title**: What needs to be done
   - **Description**: Additional context
   - **Project**: Assign to a project or leave in Inbox
   - **Context**: Tag with @computer, @office, etc.
   - **Due Date**: Set a deadline

### Organizing with Views

- **Inbox**: Tasks without a project assignment
- **Today**: Tasks due today or overdue
- **Upcoming**: Tasks with future due dates
- **Anytime**: Active tasks without due dates
- **Logbook**: Completed tasks

### Using AI Suggestions

1. Select a project from the sidebar
2. Click "Get Suggestions" in the AI panel
3. Review intelligent recommendations for next steps
4. Use suggestions to identify blockers and plan ahead

### Task Management

- **Complete Tasks**: Click the circular checkbox
- **Reorder Tasks**: Drag the handle icon to reorder
- **Edit Tasks**: Click on task titles (feature can be added)
- **Contexts**: Filter and organize by context tags

## 🔗 Google Services Integration

The app includes deep integration with Google services to enhance productivity and automate workflows.

### Available Integrations

#### 📧 Gmail Integration
- **Email-to-Task Conversion**: Automatically convert emails with the "to-task" label into tasks
- **Automated Processing**: Set up triggers to process emails every 5 minutes
- **Context Preservation**: Maintains sender, date, and thread information

**Setup:**
1. Create a Gmail label called "to-task"
2. Apply this label to emails you want converted to tasks
3. Run the automated trigger or manually process via the integrations panel

#### 📅 Google Calendar Integration
- **Automatic Event Creation**: Create calendar events for tasks with due dates
- **Two-way Sync**: Updates calendar when tasks change
- **Smart Scheduling**: 1-hour default duration, customizable
- **Task Linking**: Calendar events link back to original tasks

**Features:**
- Sync all tasks with due dates to calendar
- Update calendar events when tasks are modified
- Delete calendar events when tasks are completed
- Handle recurring tasks and reminders

#### 📄 Google Docs Integration
- **Project Documentation**: Auto-generate project documents in project folders
- **Template System**: Pre-built templates for different document types
- **Automatic Organization**: Documents stored in project-specific Drive folders

**Available Templates:**
- **Project Notes**: Overview, objectives, progress tracking
- **Meeting Notes**: Agenda, discussion points, action items
- **Project Plan**: Scope, milestones, resources, risk assessment

#### 👥 Google Contacts Integration
- **Contact Lookup**: Access your Google contacts for task assignments
- **Email Integration**: Link tasks to contact information
- **Team Collaboration**: Assign tasks to team members

#### ⚡ Automation & Triggers
- **Gmail Processing**: Every 5 minutes, check for new "to-task" emails
- **Calendar Sync**: Hourly sync of tasks with due dates
- **Error Handling**: Robust error handling and retry logic
- **Status Monitoring**: Track integration health and performance

### Setting Up Google Integrations

#### 1. Enable Required APIs

In your Google Cloud Console, enable these additional APIs:
- Gmail API
- Google Calendar API
- Google Docs API
- Google People API (Contacts)

#### 2. Update OAuth Scopes

The following scopes are automatically configured in `appsscript.json`:
```json
[
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/contacts.readonly"
]
```

#### 3. Configure Integration Settings

In your Google Apps Script backend (`Code.gs`), update:
```javascript
const CALENDAR_ID = 'primary'; // Or specify a custom calendar
```

#### 4. Test Your Setup

Use the built-in integration testing in the app:
1. Go to the Google Integrations panel
2. Click "Test Integrations"
3. Verify all services show green checkmarks
4. Fix any permission issues

#### 5. Set Up Automation

Click "Setup Automation" in the app to configure:
- Gmail processing triggers (every 5 minutes)
- Calendar sync triggers (every hour)
- Error notification webhooks

### Integration Workflows

#### Email-to-Task Workflow
1. Receive email in Gmail
2. Apply "to-task" label to important emails
3. Automated trigger processes labeled emails
4. Creates tasks with email content and metadata
5. Removes "to-task" label to avoid duplicates
6. Tasks appear in your Inbox view

#### Calendar Sync Workflow
1. Create task with due date
2. Optionally enable "Create Calendar Event" when creating task
3. System creates calendar event with task details
4. Calendar event links back to task
5. Completing task can optionally remove calendar event
6. Updating task due date updates calendar event

#### Document Creation Workflow
1. Select a project in the sidebar
2. Use Google Integrations panel to create document
3. Choose template type (Notes, Meeting, Plan)
4. Document created in project's Drive folder
5. Document opens automatically in new tab
6. Document pre-populated with project information

### Advanced Configuration

#### Custom Gmail Queries
Modify the Gmail query in the backend to customize email processing:
```javascript
// Process only unread emails from specific senders
processGmailToTasks('is:unread from:important@company.com')

// Process emails with specific subjects
processGmailToTasks('is:unread subject:"action required"')
```

#### Calendar Customization
Configure calendar settings:
```javascript
// Use a specific calendar
const CALENDAR_ID = 'your-calendar-id@group.calendar.google.com';

// Customize event duration
const eventDuration = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
```

#### Document Templates
Customize document templates by modifying the template functions in the backend:
- `createProjectNotesTemplate()`
- `createMeetingNotesTemplate()`
- `createProjectPlanTemplate()`

### Troubleshooting Google Integrations

#### Common Issues

**Permission Errors**
- Ensure all required APIs are enabled in Google Cloud Console
- Check OAuth scopes in `appsscript.json`
- Re-authorize the application in Google Apps Script

**Gmail Integration Not Working**
- Verify Gmail API is enabled
- Check that "to-task" label exists in Gmail
- Ensure trigger is set up correctly
- Test manually with `processGmailToTasks()` function

**Calendar Sync Issues**
- Verify Calendar API is enabled
- Check calendar permissions
- Ensure CALENDAR_ID is correct
- Test with `syncTasksWithCalendar()` function

**Document Creation Failures**
- Verify Docs API is enabled
- Check Drive folder permissions
- Ensure project has valid Drive folder URL
- Test with `createProjectDocument()` function

#### Debug Commands

Run these functions in Google Apps Script editor to debug:
```javascript
// Test all integrations
testIntegrations()

// Process Gmail manually
processGmailToTasks()

// Sync calendar manually
syncTasksWithCalendar()

// List all triggers
ScriptApp.getProjectTriggers()
```

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Troubleshooting

### Common Issues

**Google Apps Script not working**
- Ensure APIs are enabled in Google Cloud Console
- Check that the web app is deployed with correct permissions
- Verify SPREADSHEET_ID and DRIVE_FOLDER_ID are correct

**AI Suggestions not working**
- Ensure Ollama is installed and running
- Check that the model is downloaded (`ollama pull llama2`)
- Verify Ollama is accessible at `http://localhost:11434`

**Frontend build issues**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version (requires 18+)
- Ensure all dependencies are compatible

**Drag and drop not working**
- Check browser compatibility (modern browsers only)
- Ensure @dnd-kit packages are properly installed
- Try refreshing the page

### Getting Help

1. Check the browser console for error messages
2. Verify Google Apps Script logs in the Apps Script editor
3. Test API endpoints directly in the Apps Script editor
4. Ensure all prerequisites are properly installed

## 🎯 Future Enhancements

- **User Authentication**: Multi-user support with Clerk or Supabase
- **Team Collaboration**: Shared projects and tasks
- **Mobile Apps**: Native iOS and Android applications  
- **Advanced Filtering**: Complex queries and saved searches
- **Time Tracking**: Built-in pomodoro timer and time logs
- **Integrations**: Calendar sync, email notifications, Slack integration
- **Themes**: Dark mode and custom color schemes
- **Offline Support**: Service worker for offline functionality

---

**Built with ❤️ for productivity enthusiasts who value simplicity and calm focus.**