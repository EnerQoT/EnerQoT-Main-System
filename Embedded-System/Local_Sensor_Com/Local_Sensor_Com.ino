#include <Wire.h>
#include "Adafruit_INA3221.h"
#include <PZEM004Tv30.h>
#include "SHT21.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

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

// Variables
int currentView = 0;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

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

  Serial.println("Setup complete");
}

void loop() {
  // Debounced button read to toggle views
  int buttonState = digitalRead(buttonPin);
  if (buttonState == LOW && (millis() - lastDebounceTime > debounceDelay)) {
    currentView = (currentView + 1) % 3;
    lastDebounceTime = millis();
  }

  // Read sensor data
  // PZEM
  float pzem_voltage = pzem.voltage();
  float pzem_current = pzem.current();
  float pzem_power = pzem.power();
  float pzem_energy = pzem.energy();
  float pzem_frequency = pzem.frequency();
  float pzem_pf = pzem.pf();

  // INA3221
  float ina_voltage[3];
  float ina_current[3];
  for (uint8_t i = 0; i < 3; i++) {
    ina_voltage[i] = ina3221.getBusVoltage(i);
    ina_current[i] = ina3221.getCurrentAmps(i) * 1000;  // mA
  }

  // SI7021 (SHT21)
  float si_temp = sht.getTemperature();
  float si_hum = sht.getHumidity();

  // Display based on current view
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
    // View 2: INA3221
    display.println("INA3221 Data");
    for (uint8_t i = 0; i < 3; i++) {
      display.print("Ch"); display.print(i + 1); display.print(": V=");
      display.print(ina_voltage[i], 1); display.print("V I=");
      display.print(ina_current[i], 0); display.println("mA");
    }
  } else if (currentView == 2) {
    // View 3: SI7021
    display.println("SI7021 Data");
    display.print("Temp: "); display.print(isnan(si_temp) ? "N/A" : String(si_temp, 1)); display.println(" C");
    display.print("Hum: "); display.print(isnan(si_hum) ? "N/A" : String(si_hum, 0)); display.println(" %");
  }

  display.display();

  // Also print to Serial for debugging
  Serial.println("--- PZEM ---");
  Serial.print("Voltage: "); Serial.print(pzem_voltage); Serial.println("V");
  Serial.print("Current: "); Serial.print(pzem_current); Serial.println("A");
  Serial.print("Power: "); Serial.print(pzem_power); Serial.println("W");
  Serial.print("Energy: "); Serial.print(pzem_energy, 3); Serial.println("kWh");
  Serial.print("Frequency: "); Serial.print(pzem_frequency); Serial.println("Hz");
  Serial.print("PF: "); Serial.println(pzem_pf);

  Serial.println("--- INA3221 ---");
  for (uint8_t i = 0; i < 3; i++) {
    Serial.print("Ch"); Serial.print(i + 1); Serial.print(": V=");
    Serial.print(ina_voltage[i], 2); Serial.print(" I=");
    Serial.print(ina_current[i], 2); Serial.println("mA");
  }

  Serial.println("--- SI7021 ---");
  Serial.print("Temp: "); Serial.print(si_temp); Serial.println(" C");
  Serial.print("Hum: "); Serial.print(si_hum); Serial.println(" %");
  Serial.println("-------------------");

  delay(250);  // Update rate; adjust as needed
}