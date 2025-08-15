# Class Attendance Manager

A responsive React web application for teachers to manage student attendance with support for both demo mode and real backend integration via n8n.

## 🚀 Features

- **Authentication**: Secure login with email/password
- **Class Management**: Select existing classes or create new ones
- **Attendance Tracking**: Interactive grid for marking student attendance
- **Student Management**: Add/remove students inline
- **Mobile Responsive**: Optimized for desktop and mobile devices
- **Demo Mode**: Works without backend for testing and demonstrations
- **Real-time Updates**: Loading states and success/error notifications

## 🏗️ Project Structure

### Core Components

```
src/
├── components/
│   ├── AttendanceGrid.tsx      # Main attendance management interface
│   ├── ClassSelector.tsx       # Class and month selection
│   ├── Header.tsx              # Navigation header with logout
│   ├── LoginForm.tsx           # User authentication form
│   └── ui/                     # Reusable UI components (shadcn/ui)
├── pages/
│   ├── Index.tsx               # Main application entry point
│   ├── AttendanceManager.tsx   # Main attendance management flow
│   └── NotFound.tsx            # 404 page
├── lib/
│   ├── api.ts                  # API integration and demo data
│   ├── dateUtils.ts            # Date formatting utilities
│   └── utils.ts                # General utility functions
├── types/
│   └── index.ts                # TypeScript type definitions
└── hooks/
    └── use-toast.ts            # Toast notification hook
```

### Component Breakdown

#### `AttendanceGrid.tsx`
- **Purpose**: Main attendance tracking interface
- **Features**:
  - Interactive grid with students as rows, dates as columns
  - Toggle attendance with visual feedback
  - Add/remove students inline
  - Sticky headers for mobile scrolling
  - Save attendance data to backend
- **Props**: `selectedClass`, `selectedMonth`, `students`, `onStudentsChange`

#### `ClassSelector.tsx`
- **Purpose**: Class and month selection interface
- **Features**:
  - Dropdown for existing classes
  - Option to create new class
  - Month selection in "Mon YYYY" format
  - Form validation
- **Props**: `onSelectionComplete`

#### `LoginForm.tsx`
- **Purpose**: User authentication
- **Features**:
  - Email/password validation
  - Loading states
  - Error handling
  - Token storage in localStorage
- **Props**: `onLoginSuccess`

#### `Header.tsx`
- **Purpose**: Navigation and user actions
- **Features**:
  - App title/branding
  - Logout functionality
  - Responsive design
- **Props**: `onLogout`

#### `AttendanceManager.tsx`
- **Purpose**: Main application flow controller
- **Features**:
  - Step management (class selection → attendance)
  - Student data loading
  - Navigation between steps
- **Props**: `onLogout`

### API Integration (`lib/api.ts`)

The API module handles both demo mode and real backend integration:

#### Demo Mode
- Mock data for users, classes, and students
- Simulated network delays
- Local storage for authentication state

#### Production Mode
- REST API calls to n8n backend
- JWT token authentication
- Error handling and response validation

#### Available Methods
- `auth.login(credentials)` - User authentication
- `auth.logout()` - Clear authentication
- `auth.isAuthenticated()` - Check auth status
- `classes.getAll()` - Fetch available classes
- `students.getAll()` - Fetch students for selected class
- `attendance.save(data)` - Save attendance data

### Date Utilities (`lib/dateUtils.ts`)

Helper functions for date manipulation:
- `getDaysInMonth(month, year)` - Get all days in a month
- `formatDateKey(date)` - Format dates for API (e.g., "Jul 03")
- `getMonthOptions()` - Generate month selection options

### Type Definitions (`types/index.ts`)

TypeScript interfaces for:
- `LoginCredentials` - Email/password
- `LoginResponse` - Auth token and user ID
- `Class` - Class information
- `Student` - Student data
- `AttendanceData` - Attendance payload structure
- `AttendanceResponse` - API response format

## 🔧 Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Visual Studio Code (recommended)
- Git

### 1. Clone and Install

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install
```

### 2. Visual Studio Code Setup

#### Recommended Extensions

Install these VS Code extensions for the best development experience:

1. **ES7+ React/Redux/React-Native snippets** - React code snippets
2. **Tailwind CSS IntelliSense** - Tailwind class autocompletion
3. **TypeScript Importer** - Auto import TypeScript modules
4. **Prettier - Code formatter** - Code formatting
5. **ESLint** - Code linting
6. **Auto Rename Tag** - Rename paired HTML/JSX tags
7. **Bracket Pair Colorizer** - Color matching brackets
8. **GitLens** - Enhanced Git capabilities

#### VS Code Settings

Create `.vscode/settings.json` in your project root:

```json
{
  "emmet.includeLanguages": {
    "javascript": "javascriptreact",
    "typescript": "typescriptreact"
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "css.lint.unknownAtRules": "ignore"
}
```

#### Launch Configuration

Create `.vscode/launch.json` for debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Chrome",
      "request": "launch",
      "type": "chrome",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src",
      "sourceMaps": true
    }
  ]
}
```

### 3. Environment Configuration

Create a `.env.local` file in the project root:

```bash
# Demo Mode (true = use mock data, false = use real API)
VITE_DEMO_MODE=true

# API Base URL (required when DEMO_MODE=false)
VITE_API_BASE_URL=https://your-n8n-instance.com
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 🎮 Demo Mode

Demo mode allows you to test the application without a backend server.

### Getting Started with Demo Data

1. Set `VITE_DEMO_MODE=true` in your `.env.local` file
2. Start the development server: `npm run dev`
3. Use any email/password combination to log in
4. Explore the pre-loaded demo data:
   - **Classes**: Form 2.22 English, Form 1.15 Mathematics, Form 3.08 Science
   - **Students**: Aiden Noel, Lebron Joseph, Sofia Martinez, Emma Thompson, Marcus Johnson, Isabella Chen

### Demo Data Structure

The demo data includes:
- Mock authentication (any credentials work)
- Sample classes with realistic names
- Student roster with diverse names
- Simulated API delays for realistic testing

## 🔌 n8n Backend Integration

To connect the app to your n8n backend, follow these steps:

### 1. Environment Setup

Update your `.env.local` file:

```bash
VITE_DEMO_MODE=false
VITE_API_BASE_URL=https://your-n8n-instance.com
```

### 2. Required n8n Endpoints

Your n8n workflow should provide these endpoints:

#### Authentication Endpoint: `POST /auth/login`

**Request:**
```json
{
  "email": "teacher@school.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt-token-here",
  "user_id": "96eb4c4a-4a3b-4d21-9c1a-2e8bb1f0b1ad"
}
```

#### Classes Endpoint: `GET /classes`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "class_id": 101,
    "class_name": "Form 2.22 English"
  },
  {
    "class_id": 102,
    "class_name": "Form 1.15 Mathematics"
  }
]
```

#### Students Endpoint: `GET /students`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "student_id": 1,
    "student_name": "Aiden Noel"
  },
  {
    "student_id": 2,
    "student_name": "Lebron Joseph"
  }
]
```

#### Attendance Save Endpoint: `POST /webhook/add_attendance`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "class_id": 101,
  "class_name": "Form 2.22 English",
  "user_id": "96eb4c4a-4a3b-4d21-9c1a-2e8bb1f0b1ad",
  "month": "Jul 2025",
  "data": [
    {
      "student_id": 1,
      "student_name": "Aiden Noel",
      "Jul 03": true,
      "Jul 10": false
    },
    {
      "student_id": 2,
      "student_name": "Lebron Joseph",
      "Jul 03": true
    }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "updated": 5,
  "month": "Jul 2025"
}
```

### 3. n8n Workflow Example

Here's a basic n8n workflow structure:

1. **HTTP Request Node**: Listen for incoming requests
2. **Switch Node**: Route based on endpoint (`/auth/login`, `/classes`, etc.)
3. **Authentication Logic**: Validate credentials and generate JWT
4. **Database Nodes**: Store/retrieve data from your database
5. **Response Nodes**: Return properly formatted JSON responses

### 4. CORS Configuration

Ensure your n8n instance allows CORS requests from your frontend domain:

```javascript
// In your n8n HTTP Response node
headers: {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
}
```

## 🎨 Styling and Theming

The app uses Tailwind CSS with a custom design system:

### Design Tokens

Colors and themes are defined in:
- `src/index.css` - CSS custom properties
- `tailwind.config.ts` - Tailwind configuration

### Key Design Features

- **Responsive Design**: Mobile-first approach
- **Dark/Light Mode**: Automatic theme switching
- **Accessibility**: ARIA labels and keyboard navigation
- **Consistent Spacing**: Standardized padding and margins
- **Typography**: Clear hierarchy and readable fonts

## 🧪 Testing

### Manual Testing Checklist

#### Demo Mode Testing
- [ ] Login with any credentials
- [ ] Select different classes
- [ ] Mark attendance for various dates
- [ ] Add new students
- [ ] Remove existing students
- [ ] Save attendance data
- [ ] Test mobile responsiveness

#### Production Mode Testing
- [ ] Valid login credentials work
- [ ] Invalid credentials show error
- [ ] Classes load from API
- [ ] Students load from API
- [ ] Attendance saves successfully
- [ ] Network errors are handled
- [ ] Authentication token is included in requests

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Lovable

Click the "Publish" button in the Lovable interface to deploy your app.

### Environment Variables for Production

Set these in your production environment:

```bash
VITE_DEMO_MODE=false
VITE_API_BASE_URL=https://your-production-n8n-instance.com
```

## 🔧 Troubleshooting

### Common Issues

#### 1. API Calls Failing
- Check `VITE_API_BASE_URL` is correct
- Verify n8n endpoints are accessible
- Check CORS configuration
- Ensure authentication token is valid

#### 2. Demo Mode Not Working
- Verify `VITE_DEMO_MODE=true` in `.env.local`
- Clear localStorage and try again
- Check browser console for errors

#### 3. Styling Issues
- Verify Tailwind CSS is properly configured
- Check for conflicting CSS classes
- Ensure dark mode variables are defined

#### 4. Build Errors
- Check TypeScript errors: `npm run type-check`
- Verify all imports are correct
- Ensure environment variables are set

### Debug Mode

Enable debug logging by adding to `.env.local`:

```bash
VITE_DEBUG=true
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and test thoroughly
4. Commit with descriptive messages: `git commit -m "Add new feature"`
5. Push to your branch: `git push origin feature/new-feature`
6. Create a pull request

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 🆘 Support

For questions or issues:
1. Check this README for common solutions
2. Review the [Lovable Documentation](https://docs.lovable.dev/)
3. Join the [Lovable Discord Community](https://discord.com/channels/1119885301872070706/1280461670979993613)
4. Create an issue in the repository