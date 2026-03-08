#include <Wire.h>
#include "Adafruit_INA3221.h"
#include <PZEM004Tv30.h>
#include "SHT21.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <WiFiProv.h>      
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <nvs_flash.h>
#include <WiFiClientSecure.h>   // ← TLS support

// === TLS ROOT CA (your Mosquitto CA) ===
const char* root_ca = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgIUT/bRRiO36jB876DylycCSSEInacwDQYJKoZIhvcNAQEL
BQAwGDEWMBQGA1UEAwwNTXlJb1QtUm9vdC1DQTAeFw0yNjAzMDcxODU5MDBaFw0z
NjAzMDQxODU5MDBaMBgxFjAUBgNVBAMMDU15SW9ULVJvb3QtQ0EwggIiMA0GCSqG
SIb3DQEBAQUAA4ICDwAwggIKAoICAQDOS4eJE4rCqfRUEaATXvelVyudhHdHPPZd
4stYmmlQg7CuxsWq2e1ot6H82oMiXMmSO1Y1+KkwSndkDNEjeW/cv3pyfAfQ/Wnb
pm948WUfQaiKYH853OFUjV8geYNfRbDgwLkanEn/C3t2N4KWYCh1MMVVOvU216Op
KpnSqp0fIDU8i0jEOkESjwjuvKIwhnZNutD2HS9I3M9OcAB9MPrK3KcMiVbhd4o/
+5wOpXT0LDmH8oAyPXL0sJ7DMhWO6jfMYwZa9MVHoPXOKEYdJjXv9YDRTEe2hx8/
ufKLy4K7IeSe1tn2ffh8zWPEMTJnFA33y50a0jYEIYW/uQtwgbEm3Lkge7eG6w80
uDmj3D2c1IzslpVl/uEdx2vo1Pc/kPaEOvwPaGxhUrPbwaYmRx6rlMUtpD9leKbg
iz+ixudI5wlJg3yOGHadALscoO5NPPDCzukAHZBUU7UEDg56WoKF+f68Te7JD9KQ
VlzIMxJ074byga/V22nJjO9NEpyCTdaa8At39rj+jjNaSWJHWkCLH2G8pxMIZtM/
zv92Uy0QE9ayWDxOqS0+UYOT7YZIyis3WLhjh73cyF+bwdlko3zKUZzc8zY9RHPf
bDXQZeJgI79oLFa8yLOYWB38pBGomikAEU/k7gqoKpSXZU0SYuE40OkDD1gQ1nrW
OMHf8sGu3QIDAQABo4GYMIGVMB0GA1UdDgQWBBQPTQBNvg+2hiPgnq0oo+NRoFLR
zzBTBgNVHSMETDBKgBQPTQBNvg+2hiPgnq0oo+NRoFLRz6EcpBowGDEWMBQGA1UE
AwwNTXlJb1QtUm9vdC1DQYIUT/bRRiO36jB876DylycCSSEInacwDwYDVR0TAQH/
BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZIhvcNAQELBQADggIBABrqUgpn
s0qMRH/kxwnfQaalYgkKkmOq70U0JZykpQV4QG5vEJk/0X3VmyiwpdwKZHUkTVql
nQ+TFt0nYnptVLDNLpjcst9t8eTbZDkf6HM8sMBQjH78Vld9qSx1QEkTDhD/3gmw
MAPScoOfboYHevR71OKps4RHLNlFYDiVlmApWgF+i8zEet1IiCkeQsd2CzUHcEN8
XZElE0L9pOixs3hPSxjjIC7qMMXa7aM0HPXY1rcGH8EQ2JuEUQ3kP53nxGqX7yWo
kQnAPqDBbxCgEJuUnmSqK/GqBTELLGESRV2aLrrpFRl9a5+wyLZZEO8YQCtknnRC
Q5xWVqz25aa8iSo/2ef7w8uTxCZ+zXt38mytXtjhIsVd4KVfYcAYWIRqEoTWbkFA
d/DxxJqo4veTciq7ieAIfXpC9HKjlcsqgi8KqIIqFd4b2OnyRe8IXAJY78RIPluJ
YjOcHmfRub/W6DGvzlW99SfweIHadxN6dOKQ2/PlEMU8Box6eseiXM5dtF4qcKpY
57DtHYLX9MPWdpjzahqNWXkh+s/FSsMyziVVFa3RHmxj/VMu1bITi8O75VU8uAyx
VRO5aKC+lBtUIoKo3zEohPx/X0J1YEXgFs9mVwaeVVXz+AzVSgu8CsO9/8u4sVvO
Yrdq3kEIJ7Wpd/yvjVFcE6sKv5XzRnuZMDGZ
-----END CERTIFICATE-----
)EOF";

// === MQTT SETTINGS ===
const char* mqtt_server = "13.60.180.169";
const int mqtt_port = 8883;
const char* mqtt_user = "sensor-588C81A527DC";   
const char* mqtt_pass = "DdzU4YyUx4RIzqN0E5uYMbKinEJDVj";    
const char* mqtt_topic = "sensor/data";

// === BLE Provisioning (fixed for modern ESP32 core) ===
const char * pop = "1234567";
const char * service_name = "PROV_NODE";

// === Hardware (exactly your original) ===
#define PZEM_RX_PIN 21
#define PZEM_TX_PIN 20
const int buttonPin = 1;
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR 0x3C 

Adafruit_INA3221 ina3221;
PZEM004Tv30 pzem(Serial0, PZEM_RX_PIN, PZEM_TX_PIN);  
SHT21 sht;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WiFiClientSecure espClient;          // ← TLS secure client
PubSubClient client(espClient);

// === Your original variables ===
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

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pinMode(buttonPin, INPUT_PULLUP);

  // Initialize sensors & OLED (unchanged)
  ina3221.begin(0x41, &Wire);
  ina3221.setAveragingMode(INA3221_AVG_16_SAMPLES);
  for (uint8_t i = 0; i < 3; i++) ina3221.setShuntResistance(i, 0.1);
  display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);

  // === TLS Setup ===
  espClient.setCACert(root_ca);   // validates your Mosquitto server

  // === WiFi Provisioning (fixed constants) ===
  bool forceProvisioning = (digitalRead(buttonPin) == LOW);
  if (forceProvisioning) {
    nvs_flash_erase(); nvs_flash_init();
    WiFiProv.beginProvision(WIFI_PROV_SCHEME_BLE, WIFI_PROV_SCHEME_HANDLER_FREE_BTDM, WIFI_PROV_SECURITY_1, pop, service_name);
  } else {
    WiFi.begin();
  }
  while (WiFi.status() != WL_CONNECTED) delay(500);

  client.setServer(mqtt_server, mqtt_port);
  client.setBufferSize(768);
}

void reconnect() {
  String clientId = "ESP32Client-" + String(random(0xffff), HEX);
  if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
    Serial.println("MQTT connected securely with TLS + auth");
  }
}

// === Your original loop() goes here unchanged ===
void loop() {
  if (!client.connected()) {
    if (millis() - lastMQTTReconnectAttempt > 5000) {
      lastMQTTReconnectAttempt = millis();
      reconnect();
    }
  } else {
    client.loop();
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

  delay(250);
}