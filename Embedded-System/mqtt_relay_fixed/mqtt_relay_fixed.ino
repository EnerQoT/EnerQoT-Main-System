/*
 * ============================================================
 *  mqtt_relay_fixed.ino  — ESP32-C3 Super Mini
 *  Fixes applied:
 *   1. Watchdog resets from blocking sensor reads in loop()
 *   2. Stack overflow from large StaticJsonDocument on stack
 *   3. Heap fragmentation from String() in MQTT callback
 *   4. Race condition: relay toggled inside ISR-like callback
 *      while loop() also reads sensors (no yield/feed)
 *   5. PZEM blocking reads (~1 s each) starving MQTT loop
 *   6. Missing reconnect counter increment
 *   7. Syntax error: stray "80" in setup()
 *   8. TLS handshake timeout too short for AWS re-connects
 *   9. Random clientId re-generated on every reconnect
 *      causing AWS IoT policy mismatches
 *  10. delay(250) at bottom preventing timely client.loop()
 * ============================================================
 */

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
#include <WiFiClientSecure.h>
#include <esp_task_wdt.h>         // FIX 1 – explicit WDT control

// ============================================================
//  TLS ROOT CA
// ============================================================
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

// ============================================================
//  MQTT SETTINGS
// ============================================================
const char* mqtt_server = "13.60.180.169";
const int   mqtt_port   = 8883;
const char* mqtt_user   = "sensor-588C81A527DC";
const char* mqtt_pass   = "DdzU4YyUx4RIzqN0E5uYMbKinEJDVj";
const char* mqtt_data_topic  = "sensor/data";
const char* mqtt_relay_topic = "relay";

// FIX 9 – stable client ID derived from MAC, not random()
// AWS IoT policies are often bound to clientId; a changing ID
// forces a new TLS+policy lookup on every reconnect → slow → WDT
String mqttClientId;

// ============================================================
//  RELAY  (Active LOW)
// ============================================================
#define RELAY_PIN 5
volatile bool relayState     = false;   // written in callback
volatile bool relayChanged   = false;   // FIX 4 – flag, not action

// ============================================================
//  BLE Provisioning
// ============================================================
const char* pop          = "1234567";
const char* service_name = "PROV_NODE";

// ============================================================
//  Hardware
// ============================================================
#define PZEM_RX_PIN   20
#define PZEM_TX_PIN   21
const int buttonPin = 1;
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT  64
#define OLED_ADDR    0x3C

Adafruit_INA3221  ina3221;
PZEM004Tv30       pzem(Serial0, PZEM_RX_PIN, PZEM_TX_PIN);
SHT21             sht;
Adafruit_SSD1306  display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WiFiClientSecure  espClient;
PubSubClient      client(espClient);

// ============================================================
//  Timing & state
// ============================================================
int  currentView = 0;
const int totalViews = 4;

unsigned long lastDebounceTime         = 0;
const unsigned long debounceDelay      = 50;

unsigned long lastPublishTime          = 0;
const unsigned long publishInterval    = 5000;

unsigned long lastMQTTReconnectAttempt = 0;
const unsigned long mqttReconnectDelay = 5000;

unsigned long lastSensorReadTime       = 0;
// FIX 5 – PZEM takes ~1 s per read; only read every 2 s,
//          never inside the tight MQTT-loop window
const unsigned long sensorReadInterval = 2000;

unsigned long lastDisplayTime          = 0;
const unsigned long displayInterval    = 300; // refresh OLED 3x/s

unsigned long reconnectCount = 0;

const char* channelNamesDisplay[] = {"ESP", "Battery", "Main"};
const char* channelNamesJSON[]    = {"esp", "battery", "main"};

// ============================================================
//  Cached sensor values (updated on sensorReadInterval)
// ============================================================
float pzem_voltage   = 0, pzem_current = 0, pzem_power  = 0;
float pzem_energy    = 0, pzem_frequency = 0, pzem_pf   = 0;
float ina_voltage[3] = {}, ina_current[3] = {};
float si_temp        = 0, si_hum = 0;

// ============================================================
//  FIX 2 – JSON document as a global to avoid stack blowout
//  StaticJsonDocument<768> on the stack inside loop() eats
//  ~768 bytes of a ~4 KB task stack → stack overflow under load
// ============================================================
StaticJsonDocument<768> doc;
char jsonBuffer[768];

// ============================================================
//  MQTT CALLBACK
// ============================================================
void callback(char* topic, byte* payload, unsigned int length) {
  // FIX 3 – avoid Arduino String() heap allocation in callback.
  // Use a fixed stack buffer instead.
  if (length > 8) return;               // sanity-guard
  char msg[9];
  for (unsigned int i = 0; i < length; i++) {
    msg[i] = toupper((char)payload[i]);
  }
  msg[length] = '\0';

  if (strcmp(topic, mqtt_relay_topic) == 0) {
    if (strcmp(msg, "ON") == 0 || strcmp(msg, "1") == 0) {
      relayState   = true;
      relayChanged = true;   // FIX 4 – defer GPIO write to loop()
    } else if (strcmp(msg, "OFF") == 0 || strcmp(msg, "0") == 0) {
      relayState   = false;
      relayChanged = true;
    }
  }
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  Wire.begin();
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);   // Active LOW → OFF at boot

  // FIX 1 – configure WDT to 10 s (default 5 s is too short
  //          when TLS handshake + PZEM reads stack up)
  esp_task_wdt_init(10, true);
  esp_task_wdt_add(NULL);

  // Sensors
  ina3221.begin(0x41, &Wire);
  ina3221.setAveragingMode(INA3221_AVG_16_SAMPLES);
  for (uint8_t i = 0; i < 3; i++) ina3221.setShuntResistance(i, 0.1);

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED failed");
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.println("Starting...");
  display.display();

  // FIX 8 – give TLS stack more time for AWS re-handshake
  espClient.setTimeout(15000);
  espClient.setCACert(root_ca);

  // FIX 9 – build stable client ID from MAC
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char macStr[13];
  snprintf(macStr, sizeof(macStr), "%02X%02X%02X%02X%02X%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  mqttClientId = String("ESP32-") + macStr;

  // WiFi Provisioning
  bool forceProvisioning = (digitalRead(buttonPin) == LOW);
  if (forceProvisioning) {
    nvs_flash_erase();
    nvs_flash_init();
    WiFiProv.beginProvision(
      NETWORK_PROV_SCHEME_BLE,
      NETWORK_PROV_SCHEME_HANDLER_FREE_BTDM,
      NETWORK_PROV_SECURITY_1,
      pop, service_name);
  } else {
    WiFi.begin();   // FIX 7 – removed stray "80" that was here
  }

  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED) {
    esp_task_wdt_reset();   // feed WDT while waiting
    delay(500);
    if (millis() - wifiStart > 30000) {
      Serial.println("WiFi timeout – restarting");
      ESP.restart();
    }
  }
  Serial.print("WiFi OK, IP: ");
  Serial.println(WiFi.localIP());

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setBufferSize(768);
  // FIX 10 – increase keep-alive so broker doesn't drop us
  //          between the slow sensor reads
  client.setKeepAlive(30);
}

// ============================================================
//  RECONNECT  (non-blocking – called only when disconnected)
// ============================================================
void reconnectMQTT() {
  Serial.print("MQTT connect... ");
  esp_task_wdt_reset();   // TLS handshake can take 3-6 s
  if (client.connect(mqttClientId.c_str(), mqtt_user, mqtt_pass)) {
    Serial.println("OK");
    client.subscribe(mqtt_relay_topic);
    reconnectCount++;        // FIX 6 – was never incremented
  } else {
    Serial.print("fail rc=");
    Serial.println(client.state());
  }
}

// ============================================================
//  READ SENSORS  (called on interval, not every loop tick)
// ============================================================
void readSensors() {
  pzem_voltage   = pzem.voltage();
  esp_task_wdt_reset();
  pzem_current   = pzem.current();
  esp_task_wdt_reset();
  pzem_power     = pzem.power();
  pzem_energy    = pzem.energy();
  pzem_frequency = pzem.frequency();
  pzem_pf        = pzem.pf();

  for (uint8_t i = 0; i < 3; i++) {
    ina_voltage[i] = ina3221.getBusVoltage(i);
    ina_current[i] = ina3221.getCurrentAmps(i) * 1000.0f;
  }

  si_temp = sht.getTemperature();
  si_hum  = sht.getHumidity();
}

// ============================================================
//  UPDATE OLED
// ============================================================
void updateDisplay() {
  long    rssi     = WiFi.RSSI();
  uint32_t freeHeap = ESP.getFreeHeap();
  float   cpuTemp  = temperatureRead();

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);

  if (currentView == 0) {
    display.println("PZEM004T Data");
    display.print("V: ");  display.print(isnan(pzem_voltage)    ? "N/A" : String(pzem_voltage,    1)); display.println(" V");
    display.print("I: ");  display.print(isnan(pzem_current)    ? "N/A" : String(pzem_current,    2)); display.println(" A");
    display.print("P: ");  display.print(isnan(pzem_power)      ? "N/A" : String(pzem_power,      0)); display.println(" W");
    display.print("E: ");  display.print(isnan(pzem_energy)     ? "N/A" : String(pzem_energy,     3)); display.println(" kWh");
    display.print("F: ");  display.print(isnan(pzem_frequency)  ? "N/A" : String(pzem_frequency,  1)); display.println(" Hz");
    display.print("PF: "); display.print(isnan(pzem_pf)         ? "N/A" : String(pzem_pf,         2));
  } else if (currentView == 1) {
    display.println("INA3221 Data");
    for (uint8_t i = 0; i < 3; i++) {
      display.print(channelNamesDisplay[i]);
      display.print(": ");
      display.print(ina_voltage[i], 1); display.print("V ");
      display.print(ina_current[i], 0); display.println("mA");
    }
  } else if (currentView == 2) {
    display.println("SHT21 Data");
    display.print("Temp: "); display.print(isnan(si_temp) ? "N/A" : String(si_temp, 1)); display.println(" C");
    display.print("Hum: ");  display.print(isnan(si_hum)  ? "N/A" : String(si_hum,  0)); display.println(" %");
  } else if (currentView == 3) {
    display.println("System Health");
    display.print("RSSI: ");  display.print(rssi);            display.println(" dBm");
    display.print("Heap: ");  display.print(freeHeap / 1024); display.println(" KB");
    display.print("CPU T: "); display.print(cpuTemp, 1);      display.println(" C");
    display.print("Relay: "); display.println(relayState ? "ON" : "OFF");
    display.print("MQTT: ");  display.println(client.connected() ? "OK" : "FAIL");
  }
  display.display();
}

// ============================================================
//  PUBLISH JSON
// ============================================================
void publishData() {
  long    rssi     = WiFi.RSSI();
  uint32_t freeHeap = ESP.getFreeHeap();
  float   cpuTemp  = temperatureRead();

  // FIX 2 – reuse global doc/buffer, clear before use
  doc.clear();

  JsonObject pzemObj = doc.createNestedObject("pzem");
  pzemObj["voltage"]   = isnan(pzem_voltage)   ? 0 : pzem_voltage;
  pzemObj["current"]   = isnan(pzem_current)   ? 0 : pzem_current;
  pzemObj["power"]     = isnan(pzem_power)     ? 0 : pzem_power;
  pzemObj["energy"]    = isnan(pzem_energy)    ? 0 : pzem_energy;
  pzemObj["frequency"] = isnan(pzem_frequency) ? 0 : pzem_frequency;
  pzemObj["pf"]        = isnan(pzem_pf)        ? 0 : pzem_pf;

  JsonObject inaObj = doc.createNestedObject("ina3221");
  for (uint8_t i = 0; i < 3; i++) {
    JsonObject ch = inaObj.createNestedObject(channelNamesJSON[i]);
    ch["voltage"]    = isnan(ina_voltage[i]) ? 0 : ina_voltage[i];
    ch["current_ma"] = isnan(ina_current[i]) ? 0 : ina_current[i];
  }

  JsonObject siObj = doc.createNestedObject("si7021");
  siObj["temperature"] = isnan(si_temp) ? 0 : si_temp;
  siObj["humidity"]    = isnan(si_hum)  ? 0 : si_hum;

  JsonObject sysObj = doc.createNestedObject("system");
  sysObj["rssi"]       = rssi;
  sysObj["free_heap"]  = freeHeap;
  sysObj["reconnects"] = reconnectCount;
  sysObj["cpu_temp"]   = cpuTemp;

  doc["relay"] = relayState ? "ON" : "OFF";

  serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));
  client.publish(mqtt_data_topic, jsonBuffer);
  Serial.println("Published");
}

// ============================================================
//  LOOP
// ============================================================
void loop() {
  esp_task_wdt_reset();   // FIX 1 – feed WDT at top of every loop

  // ── MQTT keep-alive ──────────────────────────────────────
  if (!client.connected()) {
    if (millis() - lastMQTTReconnectAttempt > mqttReconnectDelay) {
      lastMQTTReconnectAttempt = millis();
      reconnectMQTT();
    }
  } else {
    client.loop();         // processes incoming relay commands
  }

  // ── FIX 4 – apply relay GPIO change here, safely ─────────
  if (relayChanged) {
    relayChanged = false;
    if (relayState) {
      digitalWrite(RELAY_PIN, LOW);
      Serial.println("Relay → ON");
    } else {
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("Relay → OFF");
    }
  }

  // ── Button debounce ──────────────────────────────────────
  if (digitalRead(buttonPin) == LOW &&
      (millis() - lastDebounceTime > debounceDelay)) {
    currentView = (currentView + 1) % totalViews;
    lastDebounceTime = millis();
  }

  // ── FIX 5 – sensor reads on their own slow interval ──────
  if (millis() - lastSensorReadTime >= sensorReadInterval) {
    lastSensorReadTime = millis();
    readSensors();
  }

  // ── OLED refresh ─────────────────────────────────────────
  if (millis() - lastDisplayTime >= displayInterval) {
    lastDisplayTime = millis();
    updateDisplay();
  }

  // ── MQTT publish ─────────────────────────────────────────
  if (client.connected() &&
      millis() - lastPublishTime >= publishInterval) {
    lastPublishTime = millis();
    publishData();
  }

  // FIX 10 – removed blocking delay(250)
  // A tiny yield keeps the WiFi/BT stack happy without starving MQTT
  yield();
}
