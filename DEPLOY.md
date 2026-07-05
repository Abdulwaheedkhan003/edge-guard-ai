# Deploying EdgeGuard AI to Render

This guide outlines how to deploy the **EdgeGuard AI Safety Command Center** to the cloud (Render) so that external users (like hackathon judges) can visit the site from any device, grant camera permission, and run real-time AI hazard detection directly via their own webcams.

---

## 🏗️ Architecture Summary

```
                       ┌──────────────────────────────┐
                       │    Browser (Judge's Device)  │
                       │                              │
                       │   Local Webcam Stream        │
                       │   Local Synthesizer Alarm    │
                       └──────────────┬───────────────┘
                                      │
                                      │  HTTP POST /detect (Adaptive loop)
                                      ▼
                       ┌──────────────────────────────┐
                       │    Flask Backend (Render)    │
                       │                              │
                       │   YOLO11n Server Inference   │
                       │   Proximity Vector Logic     │
                       │   SQLite Logging             │
                       └──────────────────────────────┘
```

1. **Client-Side Capture:** The browser requests webcam permission, draws frames onto an offscreen canvas at an adaptive frame rate, and uploads them as JPEG base64 payloads to the `/detect` endpoint.
2. **Server-Side AI Inference:** Flask loads `yolo11n.pt` on startup. The `/detect` endpoint decodes the image, runs YOLO inference to locate people and machinery (such as cell phones or chairs), calculates proximity risks, draws bounding boxes and alert lines, and logs telemetry to the database.
3. **Interactive HUD Feed:** The server returns the annotated frame and telemetry in the HTTP response. The browser updates the dashboard elements and renders the annotated feed immediately.

---

## 🚀 Step-by-Step Render Deployment (Recommended)

Render is the **recommended production target** because it runs a persistent Python environment. It supports long-lived connections and shares memory thread-safely, enabling the MJPEG streams and in-memory caches to operate perfectly.

### Step 1: Push Project to GitHub/GitLab
Make sure your local project repository is pushed to a remote git repository (GitHub, GitLab, or Bitbucket).

### Step 2: Create a Render Web Service
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub/GitLab account and select your **EdgeGuard AI** repository.

### Step 3: Configure Settings
Set the following properties during the creation screen:
* **Name:** `edgeguard-ai` (or any preferred identifier)
* **Region:** Select the region closest to you (e.g., Oregon or Frankfurt).
* **Branch:** `main` (or your active development branch)
* **Runtime:** `Python 3`
* **Build Command:** `pip install -r requirements.txt`
* **Start Command:** `gunicorn -w 1 --threads 100 --connection-limit 1000 --timeout 120 backend:app`
  *(Note: We specify a single worker process `-w 1` with multiple threads so that all user requests share the same in-memory camera state and frame buffers.)*
* **Plan:** **Free** (or Starter/Standard for faster CPU inference)

### Step 4: Add a Persistent Disk (Highly Recommended)
On Render's Free tier, the filesystem is ephemeral and resets on restarts. To persist the SQLite database (`edgeguard.db`):
1. In your Web Service settings, scroll down to the **Disks** section and click **Add Disk**.
2. **Name:** `sqlite-db`
3. **Mount Path:** `/data`
4. **Size:** `1 GB` (more than enough for millions of incident logs)
5. Scroll to the **Environment Variables** section and add:
   * **Key:** `DATABASE_PATH`
   * **Value:** `/data/edgeguard.db`
6. Click **Save Changes**. This redirects SQLite writes to the persistent disk so your safety logs survive service updates!

---

## ⚡ Vercel Deployment (Limited Functionality)

Vercel is built for serverless functions, which are stateless, execute on separate ephemeral containers, and have a strict 50MB function package size limit.

While we provide `vercel.json` and `.vercelignore` to support Vercel configurations, please note the following **serverless limitations**:
1. **Function Size Limits:** Python serverless functions cannot bundle heavy libraries like PyTorch (`torch` + `torchvision`) and YOLO weights. Standard deployments will fail the 50MB size constraint unless an external API is used.
2. **Stateless Databases:** Writes to local SQLite are wiped out when the serverless container scales down.
3. **No MJPEG Streams:** The legacy `/video_feed` stream will time out due to serverless execution limits (max 10s on hobby tier).

**Recommendation:** Deploy the backend Flask server to **Render**, and use Vercel *only* if you want to deploy a static front-end pointing to the Render backend URL.

---

## 🖥️ Local Client (Edge Capture) Mode

If you still want to run the local YOLO client script (`main.py`) and capture from a dedicated camera rig while using the cloud dashboard:
1. In your terminal, run `main.py` and pass the deployed Render URL as a command-line argument:
   ```bash
   python main.py https://edgeguard-ai.onrender.com
   ```
   Or set the environment variable:
   ```powershell
   $env:EDGEGUARD_BACKEND_URL="https://edgeguard-ai.onrender.com"
   python main.py
   ```
2. The local detector will perform inference on your webcam and push updates to the cloud, allowing remote clients to view your live stream on the deployed URL!
