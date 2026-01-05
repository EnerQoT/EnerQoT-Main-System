#include <PZEM004Tv30.h>

// PZEM Serial pins
#define PZEM_RX_PIN 21
#define PZEM_TX_PIN 20

// Initialize PZEM sensor
PZEM004Tv30 pzem(Serial0, PZEM_RX_PIN, PZEM_TX_PIN);

void setup() {
  Serial.begin(115200);
}

void loop() {
  // Read all values
  float voltage = pzem.voltage();
  float current = pzem.current();
  float power = pzem.power();
  float energy = pzem.energy();
  float frequency = pzem.frequency();
  float pf = pzem.pf();

  // Serial output
  Serial.print("Voltage: "); Serial.print(voltage); Serial.println("V");
  Serial.print("Current: "); Serial.print(current); Serial.println("A");
  Serial.print("Power: "); Serial.print(power); Serial.println("W");
  Serial.print("Energy: "); Serial.print(energy, 3); Serial.println("kWh");
  Serial.print("Frequency: "); Serial.print(frequency); Serial.println("Hz");
  Serial.print("PF: "); Serial.println(pf);
  Serial.println("-------------------");

  delay(2000);
}