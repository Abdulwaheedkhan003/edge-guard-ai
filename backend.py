from flask import Flask, request, jsonify, render_template, Response
import sqlite3
import base64
import threading
import time
import os
import math
import numpy as np
import cv2
from ultralytics import YOLO
import supervision as sv

app = Flask(__name__)

# Set database path: support custom persistent path for Render, /tmp for Vercel
db_path = os.environ.get("DATABASE_PATH", "edgeguard.db")
if os.environ.get("VERCEL"):
    db_path = "/tmp/edgeguard.db"

# Open sqlite connection
conn = sqlite3.connect(db_path, check_same_thread=False)
cursor = conn.cursor()

# Create table if not exists
cursor.execute("""
CREATE TABLE IF NOT EXISTS incidents(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workers INTEGER,
    machines INTEGER,
    risk INTEGER,
    status TEXT,
    fps INTEGER,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")
conn.commit()

# Load YOLO model
model = YOLO("yolo11n.pt")
box_annotator = sv.BoxAnnotator()
label_annotator = sv.LabelAnnotator()

THRESHOLD = 200
PERSON = "person"
MACHINES = {
    "cell phone",
    "car",
    "truck",
    "bus",
    "motorcycle",
    "chair",
    "bottle"
}

def distance(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def draw_risk_meter(frame, risk):
    x, y = 20, 80
    w, h = 300, 25
    cv2.rectangle(frame, (x, y), (x + w, y + h), (50, 50, 50), -1)
    cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 255, 255), 2)
    fill = int((risk / 100) * w)
    if risk < 50:
        color = (0, 255, 0)
        status = "SAFE"
    elif risk < 80:
        color = (0, 255, 255)
        status = "WARNING"
    else:
        color = (0, 0, 255)
        status = "CRITICAL"

    cv2.rectangle(frame, (x, y), (x + fill, y + h), color, -1)

    cv2.putText(frame,
                f"Risk Level : {risk}%",
                (x, y - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2)

    cv2.putText(frame,
                f"Status : {status}",
                (x, y + 55),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color,
                2)

# Current state cache
latest = {
    "workers": 0,
    "machines": 0,
    "risk": 0,
    "status": "SAFE",
    "fps": 0
}

# Thread-safe buffer for raw JPEG frames
class FrameBuffer:
    def __init__(self):
        self.frame = None
        self.condition = threading.Condition()

    def set_frame(self, frame_bytes):
        with self.condition:
            self.frame = frame_bytes
            self.condition.notify_all()

    def get_frame(self):
        with self.condition:
            while self.frame is None:
                if not self.condition.wait(timeout=1.0):
                    return None
            return self.frame

frame_buffer = FrameBuffer()

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route("/")
def home():
    return render_template("dashboard.html")

@app.route("/update", methods=["POST"])
def update():
    global latest
    payload = request.json
    
    # Extract base64 frame if present
    frame_base64 = payload.get("frame")
    if frame_base64:
        try:
            frame_bytes = base64.b64decode(frame_base64)
            frame_buffer.set_frame(frame_bytes)
        except Exception as e:
            print("Error decoding frame:", e)
            
    # Remove frame from payload to avoid bloating latest cache
    latest = {k: v for k, v in payload.items() if k != "frame"}
    
    # Ensure status is string and handle safe state mapping
    status_str = latest.get("status", "SAFE")
    if not status_str or status_str.strip() == "":
        status_str = "SAFE"
        
    c = conn.cursor()
    c.execute("""
    INSERT INTO incidents(workers, machines, risk, status, fps)
    VALUES(?, ?, ?, ?, ?)
    """, (
        latest.get("workers", 0),
        latest.get("machines", 0),
        latest.get("risk", 0),
        status_str,
        latest.get("fps", 0)
    ))
    latest["id"] = c.lastrowid
    conn.commit()
    return jsonify({"message": "saved"})

@app.route("/detect", methods=["POST"])
def detect():
    global latest
    payload = request.json
    image_data = payload.get("image")
    if not image_data:
        return jsonify({"error": "No image data provided"}), 400

    try:
        if "," in image_data:
            image_data = image_data.split(",")[1]
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({"error": "Invalid image format"}), 400
    except Exception as e:
        print("Error decoding image:", e)
        return jsonify({"error": "Failed to decode image"}), 400

    t0 = time.time()

    # Run YOLO inference
    results = model(frame)[0]
    detections = sv.Detections.from_ultralytics(results)

    labels = []
    objects = []

    # Collect detected objects
    for i in range(len(detections)):
        x1, y1, x2, y2 = detections.xyxy[i]
        cx = int((x1 + x2) / 2)
        cy = int((y1 + y2) / 2)

        cls_id = int(detections.class_id[i])
        name = model.names[cls_id]

        objects.append({
            "name": name,
            "center": (cx, cy),
            "box": (x1, y1, x2, y2)
        })
        labels.append(name)

    workers = 0
    machines = 0
    for obj in objects:
        if obj["name"] == PERSON:
            workers += 1
        elif obj["name"] in MACHINES:
            machines += 1

    alert_level = 0
    alert_text = ""

    # Compute proximity risk
    for i in range(len(objects)):
        for j in range(i + 1, len(objects)):
            a = objects[i]
            b = objects[j]

            # Person <-> Machine proximity only
            if not (
                (a["name"] == PERSON and b["name"] in MACHINES) or
                (b["name"] == PERSON and a["name"] in MACHINES)
            ):
                continue

            p1 = a["center"]
            p2 = b["center"]
            dist = distance(p1, p2)

            if dist < THRESHOLD:
                risk = int(100 - (dist / THRESHOLD) * 100)
                if risk > alert_level:
                    alert_level = risk

                # Draw dynamic risk lines
                cv2.line(frame, p1, p2, (0, 0, 255), 3)
                mid = ((p1[0]+p2[0])//2, (p1[1]+p2[1])//2)
                cv2.putText(
                    frame,
                    f"RISK: {risk}%",
                    mid,
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 255),
                    2
                )

    if alert_level > 60:
        alert_text = "🔴 CRITICAL!!!! : Immediate evacuation recommended"
    elif alert_level > 30:
        alert_text = "WARNING! Please Step Away from the machine and move to safer distance"
    elif alert_level > 0:
        alert_text = "only workers with coat is allowed.."

    # Annotate frame
    annotated = box_annotator.annotate(
        scene=frame,
        detections=detections
    )
    annotated = label_annotator.annotate(
        scene=annotated,
        detections=detections,
        labels=labels
    )

    # Calculate inference FPS
    inference_time = time.time() - t0
    fps = int(1 / inference_time) if inference_time > 0 else 30

    # Draw alert overlays and telemetry on image
    if alert_text:
        cv2.putText(
            annotated,
            alert_text,
            (30, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 255),
            2
        )

    cv2.putText(
        annotated,
        f"Workers : {workers}",
        (20, 200),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )
    cv2.putText(
        annotated,
        f"Machines : {machines}",
        (20, 230),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )
    cv2.putText(
        annotated,
        f"FPS : {fps}",
        (20, 260),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )

    draw_risk_meter(annotated, alert_level)

    # Encode annotated frame to JPEG
    _, jpeg_buf = cv2.imencode('.jpg', annotated)
    frame_base64 = base64.b64encode(jpeg_buf).decode('utf-8')

    # Update latest state cache
    latest = {
        "workers": workers,
        "machines": machines,
        "risk": alert_level,
        "status": alert_text or "SAFE",
        "fps": fps
    }

    # Log to SQLite database
    c = conn.cursor()
    c.execute("""
    INSERT INTO incidents(workers, machines, risk, status, fps)
    VALUES(?, ?, ?, ?, ?)
    """, (
        workers,
        machines,
        alert_level,
        alert_text or "SAFE",
        fps
    ))
    latest["id"] = c.lastrowid
    conn.commit()

    # Update the shared frame buffer for video_feed consumers
    frame_buffer.set_frame(jpeg_buf.tobytes())

    return jsonify({
        "id": latest["id"],
        "workers": workers,
        "machines": machines,
        "risk": alert_level,
        "status": alert_text or "SAFE",
        "fps": fps,
        "frame": f"data:image/jpeg;base64,{frame_base64}"
    })

@app.route("/video_feed")
def video_feed():
    def generate():
        last_frame = None
        idle_count = 0
        while True:
            # Wait for a frame to arrive
            with frame_buffer.condition:
                frame_buffer.condition.wait(timeout=1.0)
                frame = frame_buffer.frame
            if frame and frame != last_frame:
                last_frame = frame
                idle_count = 0
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            else:
                idle_count += 1
                # If no frame for 5 seconds, close stream to free the Gunicorn worker thread
                if idle_count > 5:
                    break
                time.sleep(0.05)

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route("/status")
def status_route():
    return jsonify(latest)

@app.route("/latest")
def latest_route():
    return jsonify(latest)

@app.route("/history", methods=["GET", "DELETE"])
def history():
    c = conn.cursor()
    
    if request.method == "DELETE":
        c.execute("DELETE FROM incidents")
        conn.commit()
        return jsonify({"message": "logs database cleared"})
        
    # Support pagination and filtering
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 10, type=int)
    search = request.args.get("search", "", type=str)
    
    offset = (page - 1) * limit
    
    query = "SELECT id, workers, machines, risk, status, fps, time FROM incidents"
    count_query = "SELECT COUNT(*) FROM incidents"
    params = []
    
    if search:
        query += " WHERE status LIKE ? OR time LIKE ?"
        count_query += " WHERE status LIKE ? OR time LIKE ?"
        search_param = f"%{search}%"
        params = [search_param, search_param]
        
    query += " ORDER BY id DESC LIMIT ? OFFSET ?"
    
    if search:
        c.execute(count_query, params)
        total = c.fetchone()[0]
        c.execute(query, params + [limit, offset])
    else:
        c.execute(count_query)
        total = c.fetchone()[0]
        c.execute(query, [limit, offset])
        
    rows = c.fetchall()
    
    serialized_rows = []
    for r in rows:
        serialized_rows.append({
            "id": r[0],
            "workers": r[1],
            "machines": r[2],
            "risk": r[3],
            "status": r[4],
            "fps": r[5],
            "time": r[6]
        })
        
    return jsonify({
        "data": serialized_rows,
        "total": total,
        "page": page,
        "limit": limit
    })

@app.route("/analytics")
def analytics():
    c = conn.cursor()
    
    # Total count
    c.execute("SELECT COUNT(*) FROM incidents")
    total_records = c.fetchone()[0]
    
    if total_records == 0:
        return jsonify({
            "avg_risk": 0,
            "max_risk_today": 0,
            "total_incidents": 0,
            "critical_count": 0,
            "warning_count": 0,
            "safe_count": 0,
            "trends": {
                "labels": [],
                "risk": [],
                "workers": [],
                "machines": []
            },
            "status_distribution": {
                "safe": 0,
                "warning": 0,
                "critical": 0
            },
            "hourly_frequency": {
                "labels": [],
                "warnings": [],
                "criticals": []
            },
            "safety_score": 100
        })
        
    # Avg Risk
    c.execute("SELECT AVG(risk) FROM incidents")
    avg_risk = round(c.fetchone()[0] or 0, 1)
    
    # Max Risk Today
    c.execute("SELECT MAX(risk) FROM incidents WHERE date(time) = date('now')")
    max_risk_today = c.fetchone()[0]
    if max_risk_today is None:
        c.execute("SELECT MAX(risk) FROM incidents")
        max_risk_today = c.fetchone()[0] or 0
        
    # Classify counts using risk ranges
    # Safe: 0-49, Warning: 50-79, Critical: 80-100
    c.execute("SELECT COUNT(*) FROM incidents WHERE risk >= 80")
    critical_count = c.fetchone()[0] or 0
    
    c.execute("SELECT COUNT(*) FROM incidents WHERE risk >= 50 AND risk < 80")
    warning_count = c.fetchone()[0] or 0
    
    c.execute("SELECT COUNT(*) FROM incidents WHERE risk < 50")
    safe_count = c.fetchone()[0] or 0
    
    total_incidents = critical_count + warning_count
    
    # Trend details (last 30 entries)
    c.execute("""
    SELECT time, risk, workers, machines 
    FROM incidents 
    ORDER BY id DESC 
    LIMIT 30
    """)
    trend_rows = c.fetchall()
    trend_rows.reverse()
    
    time_labels = []
    risk_trend = []
    worker_trend = []
    machine_trend = []
    
    for row in trend_rows:
        t_str = row[0]
        # Convert UTC string to local IST hour for time trend tags
        time_part = t_str[11:19] if (t_str and len(t_str) >= 19) else (t_str or "")
        time_labels.append(time_part)
        risk_trend.append(row[1])
        worker_trend.append(row[2])
        machine_trend.append(row[3])
        
    # Calculate Safety Score (0-100)
    penalty = (critical_count * 15 + warning_count * 5)
    score = max(0, min(100, int(100 - (penalty / total_records) * 10))) if total_records > 0 else 100
    
    # Hourly Alert Frequency in IST
    c.execute("""
    SELECT strftime('%H', datetime(time, '+5 hours', '30 minutes')) as hr,
           SUM(CASE WHEN risk >= 80 THEN 1 ELSE 0 END) as crit_cnt,
           SUM(CASE WHEN risk >= 50 AND risk < 80 THEN 1 ELSE 0 END) as warn_cnt
    FROM incidents
    GROUP BY hr
    ORDER BY hr ASC
    """)
    hourly_rows = c.fetchall()
    
    hourly_data = {f"{h:02d}": {"critical": 0, "warning": 0} for h in range(24)}
    for row in hourly_rows:
        hr_str = row[0]
        if hr_str in hourly_data:
            hourly_data[hr_str]["critical"] = row[1] or 0
            hourly_data[hr_str]["warning"] = row[2] or 0
            
    hourly_labels = []
    hourly_warnings = []
    hourly_criticals = []
    for hr_str in sorted(hourly_data.keys()):
        hourly_labels.append(f"{hr_str}:00")
        hourly_warnings.append(hourly_data[hr_str]["warning"])
        hourly_criticals.append(hourly_data[hr_str]["critical"])
        
    return jsonify({
        "avg_risk": avg_risk,
        "max_risk_today": max_risk_today,
        "total_incidents": total_incidents,
        "critical_count": critical_count,
        "warning_count": warning_count,
        "safe_count": safe_count,
        "trends": {
            "labels": time_labels,
            "risk": risk_trend,
            "workers": worker_trend,
            "machines": machine_trend
        },
        "status_distribution": {
            "safe": safe_count,
            "warning": warning_count,
            "critical": critical_count
        },
        "hourly_frequency": {
            "labels": hourly_labels,
            "warnings": hourly_warnings,
            "criticals": hourly_criticals
        },
        "safety_score": score
    })

@app.route("/reports_list")
def reports_list():
    c = conn.cursor()
    c.execute("""
    SELECT id, workers, machines, risk, status, fps, time 
    FROM incidents 
    WHERE risk > 0 
    ORDER BY id DESC 
    LIMIT 50
    """)
    rows = c.fetchall()
    
    serialized_rows = []
    for r in rows:
        serialized_rows.append({
            "id": r[0],
            "workers": r[1],
            "machines": r[2],
            "risk": r[3],
            "status": r[4],
            "fps": r[5],
            "time": r[6]
        })
        
    return jsonify(serialized_rows)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)