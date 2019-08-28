#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <SocketIOClient.h>
#include <CapacitiveSensor.h>

#define pillarNumber "XXX"
bool DEBUG = false;
int sensitivity = 1000;

ESP8266WiFiMulti WiFiMulti;
SocketIOClient webSocket;
CapacitiveSensor button = CapacitiveSensor(14,12);
char host[] = "XXXXXX";
int port = 8080;
bool touch = false;
long pingTimer = 0, pongTimer = 0;
extern String RID;
extern String Rname;
extern String Rcontent;

void setup() {
  if (DEBUG) {
    Serial.begin(115200);
    Serial.setDebugOutput(true);

    Serial.println();
    Serial.println();
    Serial.println();

    for(uint8_t t = 4; t > 0; t--) {
      Serial.printf("[SETUP] BOOT WAIT %d...\n", t);
      Serial.flush();
      delay(1000);
    }
  }

  WiFiMulti.addAP("XXX", "XXX");

  while(WiFiMulti.run() != WL_CONNECTED) {
    delay(100);
  }

  if (DEBUG) { Serial.println("WiFi connected"); }

  if (!webSocket.connect(host, port)) {
    if (DEBUG) { Serial.println("SocketIO connection failed"); }
    return;
  }
  if (webSocket.connected()) {
    if (DEBUG) { Serial.println("SocketIO connection established"); }
  }

  button.reset_CS_AutoCal();
}

void loop() {
  long start = millis();
  long sensed =  button.capacitiveSensor(30); // (samples taken)
  if (sensed > sensitivity) {
    if (!touch) {
      touch = true;
      webSocket.send("input", pillarNumber, "1");
    }
  } else if (touch) {
    touch = false;
    webSocket.send("input", pillarNumber, "0");
  }
  if (start - pingTimer > 10000) {
    pingTimer = millis();
    webSocket.send("ping", "message", "ping");
  }
  if (webSocket.monitor()) {
    if (RID == "ping" && Rname == "message" && Rcontent == "pong") {
      pongTimer = millis();
    } else if (RID == "reset" && Rname == "message" && Rcontent == pillarNumber) {
      button.reset_CS_AutoCal();
    } else if (RID == "reboot" && Rname == "message" && Rcontent == pillarNumber) {
      delay(1000);
      ESP.restart();
    }
  } else if (start - pongTimer > 20000) {
    webSocket.reconnect(host, port);
    delay(5000);
  }

  if (DEBUG) {
    char sensedStr[10];
    ltoa(sensed,sensedStr,10);
    Serial.print(millis() - start);        // check on performance in milliseconds
    Serial.print("\t");                    // tab character for debug windown spacing
    Serial.println(sensed);                // print sensor output 1
    webSocket.send("debug", "message", sensedStr);
    delay(10);
  }

  yield();
}
