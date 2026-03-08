#include <WiFi.h>
#include <ArduinoECCX08.h>
#include <ArduinoBearSSL.h>

// WiFi
const char* ssid = "Alfa";               
const char* password = "12345677777";    

// AWS IP
const char* mqtt_server = "13.60.180.169";  

// ==========================================
// PASTE YOUR node_01_ecc.crt HERE
// (Make sure there are no blank lines before/after the dashes!)
const char deviceCert[] = 
"-----BEGIN CERTIFICATE-----\n"
"MIIBxjCCAWsCFDT1rcGlRU2yD7gt9qG/8yAZfPvlMAoGCCqGSM49BAMCMFgxCzAJ\n"
"BgNVBAYTAlVTMQ4wDAYDVQQIDAVTdGF0ZTENMAsGA1UEBwwEQ2l0eTEQMA4GA1UE\n"
"CgwHRW5lclFvVDEYMBYGA1UEAwwPRW5lclFvVCBSb290IENBMB4XDTI2MDMwNzEw\n"
"MzUzNloXDTM2MDMwNDEwMzUzNlowcjELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNh\n"
"bGlmb3JuaWExFDASBgNVBAcTC0xvcyBBbmdlbGVzMRAwDgYDVQQKEwdFbmVyUW9U\n"
"MQwwCgYDVQQLEwNJb1QxGDAWBgNVBAMTD0VuZXJRb1QtTm9kZS0wMTBZMBMGByqG\n"
"SM49AgEGCCqGSM49AwEHA0IABHg7y6Kk6+hHGSKYLMTLyv4adRNFvpkVbRJ46bzt\n"
"EBcgyLVFd8is+otZtT8BvGJ1bTl+unAYRFgXGJwhhEudvfIwCgYIKoZIzj0EAwID\n"
"SQAwRgIhAKMIBHYlBcD3RiBWsEEPioZyPi3aGKmV3rwWOC2LcwzvAiEArLQ9ulyE\n"
"QnWIimuBwlaHtPF3Q11Vgr8MP8334nwl/Kc=\n"
"-----END CERTIFICATE-----\n";
// ==========================================

WiFiClient wifiClient;
BearSSLClient sslClient(wifiClient);

unsigned long getTime() {
  return (unsigned long)time(nullptr);
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n--- BearSSL Hardware Identity Test ---");
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi Connected!");
  WiFi.setSleep(false); // Keep WiFi stable

  Serial.print("Syncing Time for TLS...");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  while (time(nullptr) < 100000) { delay(500); Serial.print("."); }
  Serial.println("\nTime Synced!");

  // Start I2C using your custom pins
  // Globally lock I2C to pins 8 and 9 so BearSSL can't break the bus
  Wire.setPins(8, 9);
  Wire.begin();
  
  if (!ECCX08.begin()) {
    Serial.println("ERROR: ATECC608A Not Found!");
    while(1);
  }
  Serial.println("ATECC608A Crypto Hardware Online!");

  // Configure BearSSL
  ArduinoBearSSL.onGetTime(getTime);
  sslClient.setEccSlot(0, deviceCert);
  
  // Skip Server verification to focus PURELY on Hardware Identity
  sslClient.setInsecure(BearSSLClient::SNI::Insecure);

  Serial.println("Starting Hardware TLS Handshake with AWS...");
  
  // Attempt the TLS Connection
  if (sslClient.connect(mqtt_server, 8883)) {
    Serial.println("=====================================");
    Serial.println("SUCCESS! HARDWARE IDENTITY ACCEPTED!");
    Serial.println("=====================================");
  } else {
    Serial.println("=====================================");
    Serial.println("FAILED! The Private Key in the ATECC608A");
    Serial.println("does NOT match the deviceCert string.");
    Serial.println("=====================================");
  }
}

void loop() {
  // Do nothing
}