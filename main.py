import cv2
import math
from ultralytics import YOLO
import supervision as sv
import numpy
import winsound
import time
import requests
import os
import sys

# Dynamic backend URL resolution
BACKEND_URL = os.environ.get("EDGEGUARD_BACKEND_URL", "http://127.0.0.1:5000")
if len(sys.argv) > 1:
    BACKEND_URL = sys.argv[1]

BACKEND_URL = BACKEND_URL.rstrip('/')
UPDATE_URL = f"{BACKEND_URL}/update"
model = YOLO("yolo11n.pt")

cap = cv2.VideoCapture(0)
prev_time=time.time()
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
def draw_risk_meter(frame,risk):
        x,y=20,80
        w,h=300,25
        cv2.rectangle(frame, (x, y), (x + w, y + h), (50, 50, 50), -1)
        cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 255, 255), 2)
        fill=int((risk/100)*w)
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
while True:
        ret, frame = cap.read()
        if not ret:
            break

        results = model(frame)[0]
        detections = sv.Detections.from_ultralytics(results)

        labels = []
        objects = []

        #collecting objects
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

        alert_level=0
        alert_text = ""
        workers = 0
        machines = 0
            #workers and machine counting loop
        for obj in objects:
                    if obj["name"] == PERSON:
                        workers += 1
                    elif obj["name"] in MACHINES:
                        machines += 1
        #risk generating loop 
        for i in range(len(objects)):
            workers = 0
            machines = 0
            #workers and machine counting loop
            for obj in objects:
                    if obj["name"] == PERSON:
                        workers += 1
                    elif obj["name"] in MACHINES:
                        machines += 1
            for j in range(i + 1, len(objects)):

                a = objects[i]
                b = objects[j]

                # Person ↔ Machine only
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

                    if risk>alert_level:
                        alert_level=risk

                    cv2.line(frame, p1, p2, (0, 0, 255), 3)

                    mid = ((p1[0]+p2[0])//2, (p1[1]+p2[1])//2)

                    cv2.putText(
                        frame,
                        f"RISK: {risk}",
                        mid,
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 255, 255),
                        2
                    )
                if alert_level>60:
                    alert_text="🔴 CRITICAL!!!! : Immediate evacuation recommended"
                    winsound.Beep(1200, 300)
                elif alert_level>30:
                    alert_text="WARNING! Please Step Away from the machine and move to safer distance"
                elif alert_level>0:
                    alert_text="only workers with coat is allowed.."
        # -------------------------
        # DRAW BOXES + LABELS
        # -------------------------
        annotated = box_annotator.annotate(
            scene=frame,
            detections=detections
        )

        annotated = label_annotator.annotate(
            scene=annotated,
            detections=detections,
            labels=labels
        )
        current_time = time.time()
        fps = 1 / (current_time - prev_time)
        prev_time = current_time
        # -------------------------
        # ALERT DISPLAY
        # -------------------------
        if alert_text:
            cv2.putText(
                annotated,
                alert_text,
                (30, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 0, 255),
                3
            )
            cv2.putText(
        annotated,
        f"Workers : {workers}",
        (20,200),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255,255,255),
        2
    )

        cv2.putText(
        annotated,
        f"Machines : {machines}",
        (20,230),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255,255,255),
        2
        )
        cv2.putText(
        annotated,
        f"Workers : {workers}",
        (20,200),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255,255,255),
        2
    )

        cv2.putText(
            annotated,
            f"Machines : {machines}",
            (20,230),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255,255,255),
            2
        )
        cv2.putText(
        annotated,
        f"FPS : {int(fps)}",
        (20,260),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255,255,255),
        2
        )
        draw_risk_meter(annotated, alert_level)
        try:
            _, jpeg_buf = cv2.imencode('.jpg', annotated)
            import base64
            frame_base64 = base64.b64encode(jpeg_buf).decode('utf-8')
        except:
            frame_base64 = None

        try:
            payload = {
                "workers": workers,
                "machines": machines,
                "risk": alert_level,
                "status": alert_text,
                "fps": int(fps)
            }
            if frame_base64:
                payload["frame"] = frame_base64
            requests.post(
                UPDATE_URL,
                json=payload,
                timeout=0.2
            )
        except:
            pass
        try:
            cv2.imshow("Edge-Guard AI", annotated)
        except:
            pass

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
cap.release()
cv2.destroyAllWindows()
