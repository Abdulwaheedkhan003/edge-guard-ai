import cv2

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Error: Could not open the camera")
    exit()

print("Camera opened successfully. Press 'q' to close the window")

# Capturing frame by frame
while True:
    ret, frame = cap.read()

    if not ret:
        print("Cannot receive frame")
        break

    cv2.imshow("Webcam Feed", frame)

    # Break the loop if q is pressed
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()