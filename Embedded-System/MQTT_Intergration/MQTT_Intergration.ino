#include <Wire.h>
#include "Adafruit_INA3221.h"
#include <PZEM004Tv30.h>
#include "SHT21.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// WiFi
const char* ssid = "Alfa";
const char* password = "12345677777";

// MQTT Broker details 
const char* mqtt_server = "13.60.180.169";  
const int mqtt_port = 1883;
const char* mqtt_user = "";
const char* mqtt_pass = "";
const char* mqtt_topic = "sensor/data";

// PZEM Serial pins 
#define PZEM_RX_PIN 21
#define PZEM_TX_PIN 20

// OLED definitions
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR 0x3C 

// Button pin
const int buttonPin = 1;

// Create objects
Adafruit_INA3221 ina3221;
PZEM004Tv30 pzem(Serial0, PZEM_RX_PIN, PZEM_TX_PIN);  
SHT21 sht;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WiFiClient espClient;
PubSubClient client(espClient);

// Variables
int currentView = 0;
// We now have 4 views: 0=PZEM, 1=INA, 2=SI7021, 3=System
const int totalViews = 4; 

unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;
unsigned long lastPublishTime = 0;
const unsigned long publishInterval = 5000;  // 5 seconds

// System Health Tracking
unsigned long reconnectCount = 0; 

// Custom Labels for INA3221
const char* channelNamesDisplay[] = {"ESP", "Battery", "Main"}; 
const char* channelNamesJSON[]    = {"esp", "battery", "main"}; 

void setup() {
  Serial.begin(115200);
  
  Wire.begin(); 

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
  display.display();

  // Button setup
  pinMode(buttonPin, INPUT_PULLUP);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // MQTT setup
  client.setServer(mqtt_server, mqtt_port);
  if (!client.setBufferSize(768)) {  // Increased buffer size for added system data
    Serial.println("Failed to set MQTT buffer size!");
    while (1) delay(10);
  }

  Serial.println("Setup complete");
}

void reconnect() {
  while (!client.connected()) {
    reconnectCount++; // Increment counter on every retry attempt
    Serial.print("Attempting MQTT connection... (Count: ");
    Serial.print(reconnectCount);
    Serial.println(")");
    
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Debounced button read to toggle views
  int buttonState = digitalRead(buttonPin);
  if (buttonState == LOW && (millis() - lastDebounceTime > debounceDelay)) {
    currentView = (currentView + 1) % totalViews; // Cycles 0 -> 1 -> 2 -> 3 -> 0
    lastDebounceTime = millis();
  }

  // --- Read sensor data ---
  
  // 1. PZEM
  float pzem_voltage = pzem.voltage();
  float pzem_current = pzem.current();
  float pzem_power = pzem.power();
  float pzem_energy = pzem.energy();
  float pzem_frequency = pzem.frequency();
  float pzem_pf = pzem.pf();

  // 2. INA3221
  float ina_voltage[3];
  float ina_current[3];
  for (uint8_t i = 0; i < 3; i++) {
    ina_voltage[i] = ina3221.getBusVoltage(i);
    ina_current[i] = ina3221.getCurrentAmps(i) * 1000;  // mA
  }

  // 3. SI7021 (SHT21)
  float si_temp = sht.getTemperature();
  float si_hum = sht.getHumidity();

  // 4. System Health Data (New Features)
  long rssi = WiFi.RSSI();
  uint32_t freeHeap = ESP.getFreeHeap();
  float cpuTemp = temperatureRead(); // Built-in ESP32 function

  // --- Display based on current view ---
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);

  if (currentView == 0) {
    // View 1: PZEM004T
    display.println("PZEM004T Data");
    display.print("V: "); display.print(isnan(pzem_voltage) ? "N/A" : String(pzem_voltage, 1)); display.println(" V");
    display.print("I: "); display.print(isnan(pzem_current) ? "N/A" : String(pzem_current, 2)); display.println(" A");
    display.print("P: "); display.print(isnan(pzem_power) ? "N/A" : String(pzem_power, 0)); display.println(" W");
    display.print("E: "); display.print(isnan(pzem_energy) ? "N/A" : String(pzem_energy, 3)); display.println(" kWh");
    display.print("F: "); display.print(isnan(pzem_frequency) ? "N/A" : String(pzem_frequency, 1)); display.println(" Hz");
    display.print("PF: "); display.print(isnan(pzem_pf) ? "N/A" : String(pzem_pf, 2));
    
  } else if (currentView == 1) {
    // View 2: INA3221 (Renamed)
    display.println("INA3221 Data");
    for (uint8_t i = 0; i < 3; i++) {
      display.print(channelNamesDisplay[i]); 
      display.print(":");
      display.print(ina_voltage[i], 1); display.print("V ");
      display.print(ina_current[i], 0); display.println("mA");
    }
    
  } else if (currentView == 2) {
    // View 3: SI7021
    display.println("SI7021 Data");
    display.print("Temp: "); display.print(isnan(si_temp) ? "N/A" : String(si_temp, 1)); display.println(" C");
    display.print("Hum: "); display.print(isnan(si_hum) ? "N/A" : String(si_hum, 0)); display.println(" %");
    
  } else if (currentView == 3) {
    // View 4: System Health (New)
    display.println("System Health");
    
    display.print("RSSI: "); 
    display.print(rssi); 
    display.println(" dBm");

    display.print("Heap: "); 
    display.print(freeHeap / 1024); // Display in KB for readability
    display.println(" KB");

    display.print("CPU T: "); 
    display.print(cpuTemp, 1); 
    display.println(" C");

    display.print("Retries: "); 
    display.println(reconnectCount);
  }

  display.display();

  // --- Publish to MQTT ---
  if (millis() - lastPublishTime >= publishInterval) {
    lastPublishTime = millis();
    
    // Create JSON document
    // Increased size to accommodate new data
    StaticJsonDocument<768> doc; 

    // 1. PZEM Object
    JsonObject pzemObj = doc.createNestedObject("pzem");
    pzemObj["voltage"] = isnan(pzem_voltage) ? 0 : pzem_voltage;
    pzemObj["current"] = isnan(pzem_current) ? 0 : pzem_current;
    pzemObj["power"] = isnan(pzem_power) ? 0 : pzem_power;
    pzemObj["energy"] = isnan(pzem_energy) ? 0 : pzem_energy;
    pzemObj["frequency"] = isnan(pzem_frequency) ? 0 : pzem_frequency;
    pzemObj["pf"] = isnan(pzem_pf) ? 0 : pzem_pf;

    // 2. INA3221 Object
    JsonObject inaObj = doc.createNestedObject("ina3221");
    for (uint8_t i = 0; i < 3; i++) {
      JsonObject ch = inaObj.createNestedObject(channelNamesJSON[i]);
      ch["voltage"] = isnan(ina_voltage[i]) ? 0 : ina_voltage[i];
      ch["current_ma"] = isnan(ina_current[i]) ? 0 : ina_current[i];
    }

    // 3. SI7021 Object
    JsonObject siObj = doc.createNestedObject("si7021");
    siObj["temperature"] = isnan(si_temp) ? 0 : si_temp;
    siObj["humidity"] = isnan(si_hum) ? 0 : si_hum;

    // 4. System Health Object (New)
    JsonObject sysObj = doc.createNestedObject("system");
    sysObj["rssi"] = rssi;
    sysObj["free_heap"] = freeHeap;
    sysObj["reconnects"] = reconnectCount;
    sysObj["cpu_temp"] = cpuTemp;

    // Serialize JSON
    char jsonBuffer[768];
    size_t jsonLength = serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));
    
    Serial.print("JSON Length: ");
    Serial.println(jsonLength);
    Serial.print("Publishing: ");
    Serial.println(jsonBuffer);
    
    // Publish
    if (client.publish(mqtt_topic, jsonBuffer)) {
      Serial.println("Data published");
    } else {
      Serial.println("Failed to publish");
    }
  }

  // --- Debug Prints (Optional) ---
  if (currentView == 3) {
     Serial.println("--- System ---");
     Serial.print("RSSI: "); Serial.println(rssi);
     Serial.print("Heap: "); Serial.println(freeHeap);
     Serial.print("CPU: "); Serial.println(cpuTemp);
     Serial.print("Rec.: "); Serial.println(reconnectCount);
  }

  delay(250);  // Update rate
}