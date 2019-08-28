NodeJS server to connect ESP8266 capacitive sensors to midi, it sends notes as defined in app.js. Written for 5 sensors, should've been rewritten for an unlimited amount but that was never necessary. There's an admin-page available on which the capacitive sensors can be fake-triggered, restarted and recalibrated.


Requires midi and SocketIO modules:

npm install midi && npm install express
