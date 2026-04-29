# Building and Deploying mei-friend (Monorepo)

This directory contains a unified Dockerization strategy for the `web-app` and `web-app-server` packages. It uses a single container approach where Nginx serves the static frontend and proxies API/WebSocket requests to the Node.js backend.

## Prerequisites

- [Docker](https://www.docker.com/) installed locally.
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk) installed and authenticated.
- A Google Cloud Project with Artifact Registry and Cloud Run APIs enabled.

## Local Development and Testing

To verify the Docker image locally:

1. **Build the image**:
  ```bash
  docker build -t mei-friend-local .
  ```

2. **Run the container**:
  ```bash
  docker run -p 8080:8080 mei-friend-local
  ```

3. **Access the app**:
  Open [http://localhost:8080](http://localhost:8080) in your browser.

## Google Cloud Deployment

### 1. Build and Push with Cloud Build

Submit the build to Google Cloud Build. Replace `[PROJECT_ID]` with your actual Google Cloud Project ID.

```bash
gcloud builds submit --tag gcr.io/[PROJECT_ID]/mei-friend-unified .
```

### 2. Deploy to Cloud Run

Deploy the image to Google Cloud Run. We use port `8080` as it is the standard for Cloud Run services.

```bash
gcloud run deploy mei-friend \
  --image gcr.io/[PROJECT_ID]/mei-friend-unified \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --timeout=3600 \
  --session-affinity \
  --port 8080
```

## Architecture Details

- **Unified Container**: Both the frontend and backend run inside the same container.
- **Nginx (Port 8080)**: Serves the React application (Vite build) and acts as a reverse proxy.
- **Node.js Backend (Port 3000)**: Runs the Hocuspocus collaborative server.
- **Proxy Routing**: Any requests to `/api` are forwarded by Nginx to the backend at `localhost:3000`. This ensures that WebSocket connections (Live Share) work seamlessly under a single domain/port.
