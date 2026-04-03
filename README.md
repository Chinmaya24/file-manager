# Cloud File Manager

A modern file management application with Google Drive integration, featuring a responsive web interface and REST API.

## Features

- 📁 File upload to Google Drive
- 📋 List files with pagination
- ✏️ Rename files
- 🗑️ Delete files
- 📥 Download files
- 🎨 Modern responsive UI with glassmorphism design
- 🔔 Toast notifications
- 🔄 Loading spinners

## Prerequisites

- Node.js 18+
- Google Cloud Service Account with Drive API enabled
- Docker (optional)

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   cd server
   npm install
   ```
3. Set up your `.env` file with Google credentials
4. Start the server:
   ```bash
   npm start
   ```
5. Open `client/index.html` in your browser

## Docker Deployment

### Using Docker Compose (Recommended)

1. Ensure you have your `.env` file configured
2. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

The application will be available at `http://localhost:3000`

### Using Docker directly

1. Build the image:
   ```bash
   docker build -t file-manager .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 -v $(pwd)/.env:/app/.env:ro -v $(pwd)/uploads:/app/uploads file-manager
   ```

## Render Deployment

### 1. Create a Render Account

Sign up at [render.com](https://render.com) and connect your GitHub account.

### 2. Create a Web Service

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `file-manager` (or your preferred name)
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Branch**: `main` (or your deployment branch)

### 3. Connect Repository (Optional)

If using GitHub integration, Render will automatically detect the `render.yaml` file and configure the service accordingly.

### 4. Environment Variables

Set the environment variables as listed above. The `render.yaml` file defines which variables are required.

### 5. Deploy

Click "Create Web Service" to deploy. Render will build your Docker image and start the service.

## Configuration Files

### render.yaml

Defines the Render service configuration including:
- Docker runtime
- Environment variables
- Service type (web)

### .github/workflows/deploy.yml

GitHub Actions workflow that:
- Runs tests on pull requests
- Builds and tests Docker image
- Deploys to Render on main branch pushes
- Provides deployment status feedback

## GitHub Actions CI/CD

This repository includes a GitHub Actions workflow for automated testing and deployment to Render.

### Setup GitHub Secrets

In your GitHub repository settings → Secrets and variables → Actions, add these secrets:

1. `RENDER_API_KEY`: Your Render API key
   - Get from: Render Dashboard → Account → API Keys
2. `RENDER_SERVICE_ID`: Your Render service ID
   - Found in: Render service URL (the long string after `/services/`)

### Workflow Features

- **Automated testing** on pull requests
- **Docker build verification** before deployment
- **Health checks** to ensure container starts correctly
- **Automatic deployment** on push to main/master branch
- **Manual deployment** trigger available
- **Deployment status** notifications

### Workflow Triggers

- **Pull Requests**: Runs tests only
- **Push to main/master**: Full CI/CD pipeline
- **Manual**: Workflow dispatch from GitHub Actions tab

### Viewing Deployment Status

1. Go to your GitHub repository → Actions tab
2. Click on the latest workflow run
3. View deployment logs and status
4. Check Render dashboard for service status

## Environment Variables

Create a `.env` file in the root directory with:

```env
PORT=3000
GOOGLE_TYPE=service_account
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=your-key-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_AUTH_PROVIDER_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
GOOGLE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/service-account
GOOGLE_UNIVERSE_DOMAIN=googleapis.com
GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id
```

## API Endpoints

- `POST /upload` - Upload a file
- `GET /files` - List files (with pagination)
- `PUT /rename` - Rename a file
- `DELETE /delete/:id` - Delete a file
- `GET /download/:id` - Download a file

## Google Drive Setup

1. Create a Google Cloud Project
2. Enable Google Drive API
3. Create a Service Account
4. Generate a JSON key
5. Share your target Drive folder with the service account email
6. Copy the credentials to your `.env` file

## Development

- Server: `server/server.js`
- Client: `client/index.html`
- Styles: Inline CSS in `client/index.html`

## License

ISC