<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/31ce81fd-f0a7-4b50-bdb8-d482999bd645" />




															EdgeGuard AI doesn't just detect objects—it protects people
=============================================================================================================================================================================================================================
🛡️ Edge-Guard AI
Because every second matters before an accident happens.
EdgeGuard AI is a real-time Edge AI construction safety platform designed to proactively reduce workplace accidents by continuously monitoring workers and heavy machinery directly on-site.
Instead of waiting for cloud processing or manual supervision, EdgeGuard AI performs intelligent risk analysis locally using computer vision, instantly identifying hazardous worker-machine proximity and issuing immediate warnings before a dangerous situation escalates.
Built for industrial environments, the system combines AI vision, real-time analytics, live monitoring, historical incident logging, and a professional command dashboard into a single integrated safety platform.
============================================================================================================================================================================================================================
🎯 The Problem

->Construction sites are among the world's most hazardous workplaces.
->Heavy machinery, limited visibility, human error, fatigue, and delayed communication create situations where a single second can determine whether a worker walks away safely or suffers a life-changing injury.
->Traditional CCTV systems merely record incidents.
->EdgeGuard AI actively analyzes them.
💡 Our Solution
EdgeGuard AI transforms ordinary surveillance cameras into intelligent safety supervisors.
The system continuously detects workers and heavy machinery, evaluates their spatial relationship in real time, calculates dynamic risk scores, and immediately alerts operators whenever dangerous proximity is detected.
Unlike conventional monitoring systems, EdgeGuard AI performs inference directly on edge devices, ensuring minimal latency, greater privacy, and reliable operation even in environments with limited internet connectivity.
============================================================================================================================================================================================================================
⚡ Key Features
🎥 Real-time YOLO11 object detection
👷 Worker & machinery identification
📏 Dynamic proximity-based risk calculation
🚨 Multi-level alert system (Safe / Warning / Critical)
🔊 Instant audible emergency alarms
📊 Live industrial monitoring dashboard
📈 Real-time analytics and safety trends
🗂 Incident history with SQLite database
📄 AI-generated incident reports
📥 Printable PDF safety reports
📹 Live camera streaming through Flask
⚡ Edge computing with low-latency inference
============================================================================================================================================================================================================================
🏗 System Architecture
Camera
      │
      ▼
OpenCV Video Capture
      │
      ▼
YOLO11 Object Detection
      │
      ▼
Risk Evaluation Engine
      │
      ▼
Flask REST API
      │
      ├────────► SQLite Database
      │
      ├────────► Live Dashboard
      │
      ├────────► Analytics Engine
      │
      └────────► AI Incident Reports
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
🧠 How It Works
->Every captured frame is processed using the YOLO11 object detection model.
->Detected workers and heavy machinery are tracked and compared.
->The system calculates the Euclidean distance between every worker-machine pair.
->If a worker enters a predefined danger zone, EdgeGuard AI computes a dynamic risk percentage.
->As the worker approaches the machine:

🟢 Safe → 🟡 Warning → 🔴 Critical

The dashboard updates instantly while visual alerts, audible alarms, and backend logging occur simultaneously.
============================================================================================================================================================================================================================

📊 Dashboard Capabilities

The enterprise dashboard provides:

Live camera feed
Worker count
Heavy machinery count
Current risk percentage
FPS monitoring
System health
Active alerts
Historical incident database
Safety score
Risk trend analysis
Status distribution
Hourly incident frequency
AI-generated incident reports

Everything updates in real time through the Flask backend.

============================================================================================================================================================================================================================

⚙ Technology Stack
Artificial Intelligence
Python
YOLO11
OpenCV
Supervision
Backend
Flask
SQLite
REST API
Frontend
HTML5
CSS3
JavaScript
Chart.js
Edge Computing
Local inference
Low-latency processing
Offline-capable architecture

============================================================================================================================================================================================================================

🌍 Why Edge AI?

Traditional cloud-based monitoring introduces network delays.

EdgeGuard AI performs detection directly on the device, allowing hazards to be identified immediately without depending on continuous internet connectivity.

This results in:

Lower latency
Higher reliability
Better privacy
Reduced bandwidth usage
Faster emergency response

===========================================================================================================================================================================================================================
🚀 Future Roadmap
IoT sensor fusion
Predictive accident forecasting
Digital twin integration
Cloud fleet management


===========================================================================================================================================================================================================================

❤️ Vision

We believe workplace safety should not depend solely on human observation.

EdgeGuard AI represents a future where intelligent systems continuously assist workers, supervisors, and industries by detecting hazards before they become accidents.

Because the best accident is the one that never happens.














