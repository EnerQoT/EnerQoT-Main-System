#include <Wire.h>
#include "Adafruit_INA3221.h"
#include <PZEM004Tv30.h>
#include "SHT21.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <WiFiProv.h>      // BLE Provisioning
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <nvs_flash.h>     // Added to completely wipe Wi-Fi memory

// --- BLE Provisioning Credentials ---
const char * pop = "1234567";             // Proof of Possession (PIN)
const char * service_name = "PROV_NODE";  // BLE Network Name

// --- MQTT Broker details ---
const char* mqtt_server = "13.60.180.169";  
const int mqtt_port = 1883;
const char* mqtt_user = "";
const char* mqtt_pass = "";
const char* mqtt_topic = "sensor/data";

// --- Hardware Pins ---
#define PZEM_RX_PIN 21
#define PZEM_TX_PIN 20
const int buttonPin = 1;

// --- OLED definitions ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR 0x3C 

// --- Create objects ---
Adafruit_INA3221 ina3221;
PZEM004Tv30 pzem(Serial0, PZEM_RX_PIN, PZEM_TX_PIN);  
SHT21 sht;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WiFiClient espClient;
PubSubClient client(espClient);

// --- Variables ---
int currentView = 0;
const int totalViews = 4; // 0=PZEM, 1=INA, 2=SI7021, 3=System

unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

unsigned long lastPublishTime = 0;
const unsigned long publishInterval = 5000;  // 5 seconds

// System & MQTT Health Tracking
unsigned long reconnectCount = 0;
unsigned long lastMQTTReconnectAttempt = 0;  // Non-blocking timer

// Custom Labels for INA3221
const char* channelNamesDisplay[] = {"ESP", "Battery", "Main"};
const char* channelNamesJSON[]    = {"esp", "battery", "main"}; 

void setup() {
  Serial.begin(115200);
  Wire.begin();
  
  // Button setup (Initialized early to check for force-provisioning on boot)
  pinMode(buttonPin, INPUT_PULLUP);
  delay(100); // Small debounce for power-on state reading

  // Initialize INA3221
  if (!ina3221.begin(0x41, &Wire)) {
    Serial.println("Failed to find INA3221 chip");
    while (1) delay(10);
  }
  Serial.println("INA3221 Found!");
  ina3221.setAveragingMode(INA3221_AVG_16_SAMPLES);
  for (uint8_t i = 0; i < 3; i++) {
    ina3221.setShuntResistance(i, 0.1);
  }
  ina3221.setPowerValidLimits(3.0, 15.0);

  // Initialize OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println(F("SSD1306 allocation failed"));
    for (;;) ;
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.display();

  // ==========================================
  // --- WiFi Provisioning Logic ---
  // ==========================================
  bool forceProvisioning = (digitalRead(buttonPin) == LOW);

  if (forceProvisioning) {
    Serial.println("Button held! Forcing BLE Provisioning...");
    
    // --- THE FIX: The NVS Wipe ---
    // This completely erases the hidden Wi-Fi credentials and Provisioning flags
    nvs_flash_erase(); 
    nvs_flash_init(); 
    WiFi.mode(WIFI_STA);
    delay(500);
    // -----------------------------

    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("BLE Prov Mode Active");
    display.println("Use ESP BLE Prov App");
    display.print("Name: "); display.println(service_name);
    display.print("PIN: "); display.println(pop);
    display.display();
    
    // Start BLE provisioning broadcast 
    WiFiProv.beginProvision(NETWORK_PROV_SCHEME_BLE, NETWORK_PROV_SCHEME_HANDLER_FREE_BTDM, NETWORK_PROV_SECURITY_1, pop, service_name);
    
  } else {
    Serial.println("Attempting to connect to saved WiFi...");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Connecting WiFi...");
    display.display();
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(); // Connects using credentials stored in NVS memory
    
    int attempts = 0;
    // Wait for up to 10 seconds to connect to known network
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    // If it failed to connect or had no saved credentials, fallback to Provisioning
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("\nNo saved WiFi or connection failed. Starting BLE Provisioning...");
      
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("Network Not Found");
      display.println("BLE Prov Mode Active");
      display.print("Name: "); display.println(service_name);
      display.print("PIN: "); display.println(pop);
      display.display();
      
      // Start BLE provisioning broadcast (ESP32 v3.x syntax)
      WiFiProv.beginProvision(NETWORK_PROV_SCHEME_BLE, NETWORK_PROV_SCHEME_HANDLER_FREE_BTDM, NETWORK_PROV_SECURITY_1, pop, service_name);
    }
  }

  // Block and wait until provisioning is complete and WiFi is connected
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print("P");
  }

  Serial.println("\nWiFi connected successfully!");
  
  // Update OLED to confirm WiFi success
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("WiFi Connected!");
  display.print("IP: "); display.println(WiFi.localIP());
  display.display();
  delay(2000); // Pause so user can read the IP address

  // --- End WiFi Provisioning Logic ---
  // ==========================================

  // MQTT setup
  client.setServer(mqtt_server, mqtt_port);
  if (!client.setBufferSize(768)) {  
    Serial.println("Failed to set MQTT buffer size!");
    while (1) delay(10);
  }

  Serial.println("Setup complete");
}

// --- Non-Blocking Reconnect Function ---
void reconnect() {
  reconnectCount++;
  Serial.print("Attempting MQTT connection... (Count: ");
  Serial.print(reconnectCount);
  Serial.println(")");
  
  String clientId = "ESP32Client-" + String(random(0xffff), HEX);
  
  if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
    Serial.println("MQTT connected successfully");
  } else {
    Serial.print("MQTT failed, rc=");
    Serial.print(client.state());
    Serial.println(" - Will try again in background");
  }
}

void loop() {
  // Non-blocking MQTT reconnect (tries once every 5 seconds)
  if (!client.connected()) {
    if (millis() - lastMQTTReconnectAttempt > 5000) {
      lastMQTTReconnectAttempt = millis();
      reconnect();
    }
  } else {
    client.loop(); // Process incoming MQTT messages and keep-alives
  }

  // Debounced button read to toggle views
  int buttonState = digitalRead(buttonPin);
  if (buttonState == LOW && (millis() - lastDebounceTime > debounceDelay)) {
    currentView = (currentView + 1) % totalViews;
    lastDebounceTime = millis();
  }

  // --- Read sensor data ---
  float pzem_voltage = pzem.voltage();
  float pzem_current = pzem.current();
  float pzem_power = pzem.power();
  float pzem_energy = pzem.energy();
  float pzem_frequency = pzem.frequency();
  float pzem_pf = pzem.pf();

  float ina_voltage[3];
  float ina_current[3];
  for (uint8_t i = 0; i < 3; i++) {
    ina_voltage[i] = ina3221.getBusVoltage(i);
    ina_current[i] = ina3221.getCurrentAmps(i) * 1000;  // mA
  }

  float si_temp = sht.getTemperature();
  float si_hum = sht.getHumidity();

  long rssi = WiFi.RSSI();
  uint32_t freeHeap = ESP.getFreeHeap();
  float cpuTemp = temperatureRead(); 

  // --- Display based on current view ---
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);

  if (currentView == 0) {
    display.println("PZEM004T Data");
    display.print("V: "); display.print(isnan(pzem_voltage) ? "N/A" : String(pzem_voltage, 1)); display.println(" V");
    display.print("I: "); display.print(isnan(pzem_current) ? "N/A" : String(pzem_current, 2)); display.println(" A");
    display.print("P: "); display.print(isnan(pzem_power) ? "N/A" : String(pzem_power, 0)); display.println(" W");
    display.print("E: "); display.print(isnan(pzem_energy) ? "N/A" : String(pzem_energy, 3)); display.println(" kWh");
    display.print("F: "); display.print(isnan(pzem_frequency) ? "N/A" : String(pzem_frequency, 1)); display.println(" Hz");
    display.print("PF: "); display.print(isnan(pzem_pf) ? "N/A" : String(pzem_pf, 2));
  } else if (currentView == 1) {
    display.println("INA3221 Data");
    for (uint8_t i = 0; i < 3; i++) {
      display.print(channelNamesDisplay[i]); 
      display.print(":");
      display.print(ina_voltage[i], 1);
      display.print("V ");
      display.print(ina_current[i], 0); display.println("mA");
    }
  } else if (currentView == 2) {
    display.println("SI7021 Data");
    display.print("Temp: "); display.print(isnan(si_temp) ? "N/A" : String(si_temp, 1)); display.println(" C");
    display.print("Hum: "); display.print(isnan(si_hum) ? "N/A" : String(si_hum, 0)); display.println(" %");
  } else if (currentView == 3) {
    display.println("System Health");
    display.print("RSSI: "); display.print(rssi); display.println(" dBm");
    display.print("Heap: "); display.print(freeHeap / 1024); display.println(" KB");
    display.print("CPU T: "); display.print(cpuTemp, 1); display.println(" C");
    display.print("MQTT Retries: "); display.println(reconnectCount);
    
    // Show connection status
    display.print("MQTT: ");
    if (client.connected()) display.println("OK");
    else display.println("FAIL");
  }

  display.display();

  // --- Publish to MQTT ---
  if (millis() - lastPublishTime >= publishInterval) {
    lastPublishTime = millis();
    
    // Only attempt to publish if we are actually connected to MQTT
    if (client.connected()) {
      StaticJsonDocument<768> doc;
      
      JsonObject pzemObj = doc.createNestedObject("pzem");
      pzemObj["voltage"] = isnan(pzem_voltage) ? 0 : pzem_voltage;
      pzemObj["current"] = isnan(pzem_current) ? 0 : pzem_current;
      pzemObj["power"] = isnan(pzem_power) ? 0 : pzem_power;
      pzemObj["energy"] = isnan(pzem_energy) ? 0 : pzem_energy;
      pzemObj["frequency"] = isnan(pzem_frequency) ? 0 : pzem_frequency;
      pzemObj["pf"] = isnan(pzem_pf) ? 0 : pzem_pf;
  
      JsonObject inaObj = doc.createNestedObject("ina3221");
      for (uint8_t i = 0; i < 3; i++) {
        JsonObject ch = inaObj.createNestedObject(channelNamesJSON[i]);
        ch["voltage"] = isnan(ina_voltage[i]) ? 0 : ina_voltage[i];
        ch["current_ma"] = isnan(ina_current[i]) ? 0 : ina_current[i];
      }
  
      JsonObject siObj = doc.createNestedObject("si7021");
      siObj["temperature"] = isnan(si_temp) ? 0 : si_temp;
      siObj["humidity"] = isnan(si_hum) ? 0 : si_hum;
  
      JsonObject sysObj = doc.createNestedObject("system");
      sysObj["rssi"] = rssi;
      sysObj["free_heap"] = freeHeap;
      sysObj["reconnects"] = reconnectCount;
      sysObj["cpu_temp"] = cpuTemp;
  
      char jsonBuffer[768];
      size_t jsonLength = serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));
      
      if (client.publish(mqtt_topic, jsonBuffer)) {
        Serial.println("Data published");
      } else {
        Serial.println("Failed to publish");
      }
    }
  }

  delay(250);  // Update rate for display rendering and loop pacing
}