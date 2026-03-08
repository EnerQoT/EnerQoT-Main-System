#include <Wire.h>
#include <ArduinoECCX08.h>
#include <utility/ECCX08DefaultTLSConfig.h>
#include <utility/ECCX08CSR.h>
#include <WiFi.h>

// ESP32-C3 Super Mini I2C Pins
const int SDA_PIN = 8;
const int SCL_PIN = 9;

bool provisionTriggered = false;

void setup() {
  Serial.begin(115200);
  delay(2000);

  Wire.begin(SDA_PIN, SCL_PIN);

  // Get MAC for unique Common Name
  WiFi.mode(WIFI_STA);
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  String deviceCN = "sensor-" + mac;

  Serial.println("\n=========================================");
  Serial.println("     ATECC608A SECURE PROVISIONING TOOL");
  Serial.println("=========================================");
  Serial.println("This tool will create a private key INSIDE the ATECC608A");
  Serial.println("and generate a CSR for mTLS authentication.");
  Serial.println();
  Serial.print("Device MAC     : "); Serial.println(mac);
  Serial.print("Common Name    : "); Serial.println(deviceCN);
  Serial.println();
  Serial.println("!!! SAFETY MODE ACTIVE !!!");
  Serial.println("Type the letter 'G' and press Enter to START provisioning.");
  Serial.println("This should be done ONLY ONCE per device.");
  Serial.println("=========================================\n");
}

void loop() {
  if (provisionTriggered) return;  // Prevent running twice in same session

  if (Serial.available() > 0) {
    char c = Serial.read();
    if (c == 'G' || c == 'g') {
      provisionTriggered = true;
      Serial.println("\n[G] RECEIVED → Starting secure provisioning now...\n");
      runProvisioning();
    }
  }
}

void runProvisioning() {
  if (!ECCX08.begin()) {
    Serial.println("ERROR: Cannot communicate with ATECC608A!");
    while (1);
  }

  // === Lock configuration (only once in lifetime) ===
  if (!ECCX08.locked()) {
    Serial.println("Writing AWS-compatible TLS configuration...");
    ECCX08.writeConfiguration(ECCX08_DEFAULT_TLS_CONFIG);
    
    Serial.println("Locking configuration zone (THIS IS PERMANENT)...");
    ECCX08.lock();
    Serial.println("✅ Configuration zone locked successfully.");
  } else {
    Serial.println("✅ Chip is already locked (good!).");
  }

  // === Generate private key + CSR ===
  Serial.println("\nGenerating new ECC private key in Slot 0 (inside chip)...");
  
  if (!ECCX08CSR.begin(0, true)) {  // true = generate new key inside ATECC608A
    Serial.println("ERROR: Failed to start CSR generation!");
    while (1);
  }

  String mac = WiFi.macAddress();
  mac.replace(":", "");
  String deviceCN = "sensor-" + mac;

  ECCX08CSR.setCountryName("LK");
  ECCX08CSR.setOrganizationName("SmartHome");
  ECCX08CSR.setOrganizationalUnitName("Sensors");
  ECCX08CSR.setCommonName(deviceCN.c_str());

  String csr = ECCX08CSR.end();

  Serial.println("\n✅ SUCCESS! COPY EVERYTHING BELOW THIS LINE");
  Serial.println(csr);
  Serial.println("COPY EVERYTHING ABOVE THIS LINE ===\n");
  
  Serial.println("Now reply here with:");
  Serial.println("CSR READY");
  Serial.println("and paste the entire CSR block.");
}