from ultralytics import YOLO
import cv2

model = YOLO("yolo11s-helmet.pt")

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()

    results = model(frame)[0]

    annotated = results.plot()

    cv2.imshow("Helmet Test", annotated)

    if cv2.waitKey(1) == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()