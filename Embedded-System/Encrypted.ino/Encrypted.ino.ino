#include <Wire.h>
#include "Adafruit_INA3221.h"
#include <PZEM004Tv30.h>
#include "SHT21.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <WiFiProv.h>      
#include <nvs_flash.h>     
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- Security Libraries ---
#include <ArduinoECCX08.h>
#include <ArduinoBearSSL.h>

// ==========================================
// CERTIFICATES
// ==========================================


// node_01.crt
const char deviceCert[] = R"EOF(-----BEGIN CERTIFICATE-----
MIIBuDCCAV8CFDT1rcGlRU2yD7gt9qG/8yAZfPveMAoGCCqGSM49BAMCMFgxCzAJ
BgNVBAYTAlVTMQ4wDAYDVQQIDAVTdGF0ZTENMAsGA1UEBwwEQ2l0eTEQMA4GA1UE
CgwHRW5lclFvVDEYMBYGA1UEAwwPRW5lclFvVCBSb290IENBMB4XDTI2MDMwNjIx
MjYxNFoXDTM2MDMwMzIxMjYxNFowZjELMAkGA1UEBhMCVVMxDjAMBgNVBAgTBVN0
YXRlMQ0wCwYDVQQHEwRDaXR5MRAwDgYDVQQKEwdFbmVyUW9UMQwwCgYDVQQLEwNJ
b1QxGDAWBgNVBAMTD0VuZXJRb1QtTm9kZS0wMTBZMBMGByqGSM49AgEGCCqGSM49
AwEHA0IABGKFRay1l7mDqFhIP9BTl2Jcx66hNo28lhm3F+tE73B+VzF54CMWjnFa
tFvJ4RhcaV+9hTk00V1eZ7x3rDEDpbowCgYIKoZIzj0EAwIDRwAwRAIgHF2el8fJ
v6R9nFLO7sbmBAe13UNIR+PmKRYtaXs2/lQCIClvSP07hwwNIkMkLQpVvvpZSNfw
pGeDXn203ZqC5Ntw
-----END CERTIFICATE-----)EOF";
// ==========================================

// --- BLE Provisioning Credentials ---
const char * pop = "1234567";             
const char * service_name = "PROV_NODE_01";  

// --- MQTT Broker details (Updated for TLS) ---
const char* mqtt_server = "13.60.180.169";  
const int mqtt_port = 8883; // TLS Secure Port!
const char* mqtt_topic = "sensor/data";

// --- Hardware Pins ---
#define PZEM_RX_PIN 21
#define PZEM_TX_PIN 20
const int buttonPin = 1;
const int SDA_PIN = 8;
const int SCL_PIN = 9;

// --- OLED definitions ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR 0x3C 

// --- Create objects ---
Adafruit_INA3221 ina3221;
PZEM004Tv30 pzem(Serial1, PZEM_RX_PIN, PZEM_TX_PIN);
SHT21 sht;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// TLS Client Setup
WiFiClient wifiClient;
BearSSLClient sslClient(wifiClient);
PubSubClient client(sslClient);

// --- Variables ---
int currentView = 0;
const int totalViews = 4;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;
unsigned long lastPublishTime = 0;
const unsigned long publishInterval = 5000;  
unsigned long reconnectCount = 0;
unsigned long lastMQTTReconnectAttempt = 0;  

const char* channelNamesDisplay[] = {"ESP", "Battery", "Main"};
const char* channelNamesJSON[]    = {"esp", "battery", "main"}; 

// Force the 64-bit time into a 32-bit unsigned long for BearSSL
unsigned long getTime() {
  return (unsigned long)time(nullptr);
}

void setup() {
  Serial.begin(115200);
  Wire.begin(SDA_PIN, SCL_PIN);
  
  pinMode(buttonPin, INPUT_PULLUP);
  delay(100); 

  // --- Initialize ATECC608A ---
  if (!ECCX08.begin()) {
    Serial.println("Failed to communicate with ATECC608A!");
    while (1); // Halt if hardware security fails
  }
  Serial.println("ATECC608A Crypto Hardware Online.");

  // Initialize Sensors & Display
  ina3221.begin(0x41, &Wire);
  ina3221.setAveragingMode(INA3221_AVG_16_SAMPLES);
  for (uint8_t i = 0; i < 3; i++) ina3221.setShuntResistance(i, 0.1);
  ina3221.setPowerValidLimits(3.0, 15.0);

 // Initialize OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println(F("SSD1306 allocation failed"));
    for (;;) ;
  }


  display.clearDisplay();
  display.setTextSize(1);              // <-- Added this!
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("System Booting...");
  display.println("Init Hardware...");
  display.display();                   // Push the text to the screen!

  // --- WiFi Provisioning Logic ---
  bool forceProvisioning = (digitalRead(buttonPin) == LOW);

  if (forceProvisioning) {
    Serial.println("Forcing BLE Provisioning...");
    nvs_flash_erase(); 
    nvs_flash_init(); 
    WiFi.mode(WIFI_STA);
    delay(500);

    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("BLE Prov Mode Active");
    display.display();
    
    WiFiProv.beginProvision(WIFI_PROV_SCHEME_BLE, WIFI_PROV_SCHEME_HANDLER_FREE_BTDM, WIFI_PROV_SECURITY_1, pop, service_name);
  } else {
    WiFi.mode(WIFI_STA);
    WiFi.begin(); 
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      attempts++;
    }
    if (WiFi.status() != WL_CONNECTED) {
      WiFiProv.beginProvision(WIFI_PROV_SCHEME_BLE, WIFI_PROV_SCHEME_HANDLER_FREE_BTDM, WIFI_PROV_SECURITY_1, pop, service_name);
    }
  }

  // Block and wait until provisioning is complete and WiFi is connected
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print("P");
  }

  // --- ADD THIS LINE for Core 2.0.17 Stability ---
  WiFi.setSleep(false); 
  // -----------------------------------------------

  Serial.println("\nWiFi connected successfully!");
  
  // --- NTP Time Sync (Crucial for TLS Certificates) ---
  Serial.print("Syncing Time for TLS Validation...");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) { 
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println("\nTime synced.");

 // --- Configure Hardware Security for MQTT ---
  ArduinoBearSSL.onGetTime(getTime);
  
 // Tell BearSSL to use Slot 0 on the ATECC608A for the private key
  sslClient.setEccSlot(0, deviceCert);
  
  // Explicitly set the SNI mode to Insecure for our AWS test
  sslClient.setInsecure(BearSSLClient::SNI::Insecure);
  
  // MQTT setup
  client.setServer(mqtt_server, mqtt_port);
  client.setBufferSize(768);

} 

void reconnect() {
  reconnectCount++;
  Serial.println("Attempting Hardware Secure MQTT connection...");
  
  // The CN must match the certificate we generated earlier
  String clientId = "EnerQoT-Node-01";
  
  // Notice we don't pass a username/password anymore. The hardware is the password!
  if (client.connect(clientId.c_str())) {
    Serial.println("Secure MQTT connected successfully!");
  } else {
    Serial.print("TLS/MQTT failed, rc=");
    Serial.print(client.state());
    Serial.println(" - Will try again");
  }
}

void loop() {
  if (!client.connected()) {
    if (millis() - lastMQTTReconnectAttempt > 5000) {
      lastMQTTReconnectAttempt = millis();
      reconnect();
    }
  } else {
    client.loop(); 
  }

  // --- Sensor reading and Display logic remains identical to your previous version ---
  // (Simplified for brevity, ensure you keep your full sensor and display update code here)

  if (millis() - lastPublishTime >= publishInterval) {
    lastPublishTime = millis();
    
    if (client.connected()) {
      StaticJsonDocument<768> doc;
      JsonObject sysObj = doc.createNestedObject("system");
      sysObj["rssi"] = WiFi.RSSI();
      sysObj["free_heap"] = ESP.getFreeHeap();
      
      char jsonBuffer[768];
      serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));
      
      if (client.publish(mqtt_topic, jsonBuffer)) {
        Serial.println("Secure Data published");
      }
    }
  }
  delay(250);  
}