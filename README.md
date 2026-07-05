<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/31ce81fd-f0a7-4b50-bdb8-d482999bd645" />



# 🛡️ EdgeGuard AI

> ### Because every second matters before an accident happens.

EdgeGuard AI is a real-time Edge AI construction safety platform designed to proactively reduce workplace accidents by continuously monitoring workers and heavy machinery directly on-site.

Instead of waiting for cloud processing or manual supervision, EdgeGuard AI performs intelligent risk analysis locally using computer vision, instantly identifying hazardous worker-machine proximity and issuing immediate warnings before a dangerous situation escalates.

Built for industrial environments, the system combines AI vision, real-time analytics, live monitoring, historical incident logging, and a professional command dashboard into a single integrated safety platform.

---

# 🎯 The Problem

Construction sites are among the world's most hazardous workplaces.

Heavy machinery, limited visibility, human error, fatigue, and delayed communication create situations where a single second can determine whether a worker walks away safely or suffers a life-changing injury.

Traditional CCTV systems merely record incidents.

**EdgeGuard AI actively analyzes them.**

---

# 💡 Our Solution

EdgeGuard AI transforms ordinary surveillance cameras into intelligent safety supervisors.

The system continuously detects workers and heavy machinery, evaluates their spatial relationship in real time, calculates dynamic risk scores, and immediately alerts operators whenever dangerous proximity is detected.

Unlike conventional monitoring systems, EdgeGuard AI performs inference directly on edge devices, ensuring minimal latency, greater privacy, and reliable operation even in environments with limited internet connectivity.

---

# ✨ Key Features

- 🎥 Real-time YOLO11 Object Detection
- 👷 Worker & Heavy Machinery Detection
- 📏 Dynamic Proximity-based Risk Calculation
- 🚨 Multi-level Alert System (Safe / Warning / Critical)
- 🔊 Instant Audible Emergency Alarm
- 📊 Live Industrial Monitoring Dashboard
- 📈 Real-time Analytics & Safety Trends
- 🗂 SQLite Incident Logging
- 📄 AI-generated Incident Reports
- 📥 Exportable PDF Reports
- 📹 Live Camera Streaming via Flask
- ⚡ Edge Computing with Low Latency
- 🌐 REST API Integration
- 📡 Live Backend Communication
- 🎯 Enterprise-grade Dashboard UI

---

# 🏗️ System Architecture

```text
                    ┌────────────────────┐
                    │   Camera Feed      │
                    └─────────┬──────────┘
                              │
                              ▼
                  ┌──────────────────────┐
                  │ OpenCV Video Capture │
                  └─────────┬────────────┘
                            │
                            ▼
                  ┌──────────────────────┐
                  │ YOLO11 Object Model  │
                  └─────────┬────────────┘
                            │
                            ▼
               ┌────────────────────────────┐
               │ Risk Evaluation Engine     │
               │ Distance + Risk Scoring    │
               └─────────┬──────────────────┘
                         │
         ┌───────────────┼────────────────┐
         ▼               ▼                ▼
 ┌──────────────┐ ┌──────────────┐ ┌───────────────┐
 │ Flask API    │ │ SQLite DB    │ │ MJPEG Stream  │
 └──────┬───────┘ └──────┬───────┘ └──────┬────────┘
        │                │               │
        └────────────────┼───────────────┘
                         ▼
           ┌──────────────────────────────┐
           │ Enterprise Web Dashboard     │
           └──────────────────────────────┘
```

---

# 🧠 How It Works

1. OpenCV continuously captures frames from the webcam.
2. YOLO11 detects workers and heavy machinery.
3. The system computes the Euclidean distance between every worker-machine pair.
4. If the distance falls below the safety threshold, a dynamic risk percentage is calculated.
5. The dashboard updates instantly with:
   - Worker Count
   - Machine Count
   - Current Risk
   - FPS
   - System Status
6. Visual alerts and audible alarms are triggered when required.
7. Every event is logged into SQLite.
8. The frontend retrieves live information through the Flask REST API.

---

# 📊 Dashboard Features

### 🖥 Dashboard

- Live Camera Feed
- Worker Count
- Machinery Count
- Current Risk %
- Safety Score
- Active Alerts
- System Status
- Backend Status
- FPS Monitor

### 📹 Live Monitoring

- Real-time Camera Stream
- Live Detection Overlay
- AI Detection Log
- Detection Statistics

### 🗂 Incident History

- SQLite Database Records
- Search Functionality
- Pagination
- Real-time Updates
- Timestamp Logging

### 📈 Analytics

- Average Risk
- Peak Risk
- Total Incidents
- Critical Events
- Warning Events
- Safe Events
- Risk Trend Graph
- Worker Trend
- Machine Trend
- Hourly Incident Frequency
- Status Distribution

### 🤖 AI Incident Reports

- Incident Time
- Risk Percentage
- Worker Count
- Machine Count
- Safety Summary
- Recommended Actions
- Export to PDF
- Print Support

---

# ⚙️ Technology Stack

## Artificial Intelligence

- Python
- YOLO11 (Ultralytics)
- OpenCV
- Supervision

## Backend

- Flask
- SQLite
- REST API
- MJPEG Streaming

## Frontend

- HTML5
- CSS3
- JavaScript
- Chart.js

## Edge Computing

- Low-latency Processing
- Offline-capable Architecture
- Local AI Inference

---

# 🌍 Why Edge AI?

Unlike traditional cloud-based surveillance systems, EdgeGuard AI processes all detections locally on the edge device.

This provides:

- ⚡ Lower Latency
- 🔒 Better Privacy
- 🌐 Reduced Bandwidth Usage
- 📡 Offline Functionality
- 🚨 Faster Emergency Response

---

# 📂 Project Structure

```text
EdgeGuard-AI/
│
├── main.py                 # YOLO Detection & Risk Engine
├── backend.py              # Flask Backend Server
├── edgeguard.db            # SQLite Database
├── requirements.txt
│
├── templates/
│   └── dashboard.html
│
├── static/
│   ├── css/
│   │   └── styles.css
│   │
│   ├── js/
│   │   └── app.js
│   │
│   └── images/
│
└── README.md
```

---

# 🚀 Future Roadmap

- 🪖 Helmet Detection
- 🦺 Safety Vest Detection
- 🏗 Crane Detection
- 🚜 Excavator Detection
- 🚛 Forklift Recognition
- 🌡 IoT Sensor Integration
- 🌫 Gas Leak Detection
- 🔥 Fire & Smoke Detection
- 📡 Multi-camera Synchronization
- 🤖 Predictive Accident Intelligence
- ☁ Cloud Fleet Management
- 📍 Digital Twin Integration

---

# ❤️ Vision

We believe workplace safety should not depend solely on human observation.

EdgeGuard AI represents a future where intelligent systems continuously assist workers, supervisors, and industries by detecting hazards **before they become accidents**.

Instead of merely recording incidents, EdgeGuard AI actively monitors, analyzes, predicts, and alerts in real time—creating a safer, smarter, and more reliable industrial environment.

---

# 🏆 Built For

- Construction Sites
- Smart Factories
- Warehouses
- Mining Operations
- Industrial Plants
- Logistics Hubs
- Heavy Machinery Work Zones

---

## ⭐ Final Thought

> **EdgeGuard AI doesn't just detect objects. It protects people.**
