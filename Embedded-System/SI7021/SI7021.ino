#include <Wire.h>
#include "SHT21.h"

SHT21 sht;

void setup() {
  Wire.begin();
  Serial.begin(115200);
}

void loop() {
  float temperature = sht.getTemperature();
  float humidity = sht.getHumidity();
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" °C");
  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");
  delay(2000);
}

  

  

