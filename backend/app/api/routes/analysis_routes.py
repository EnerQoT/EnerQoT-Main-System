from flask import Blueprint, request, jsonify
import os
from groq import Groq

analysis_bp = Blueprint('analysis', __name__)

@analysis_bp.route('/api/analysis/generate', methods=['POST'])
def generate_analysis():
    data = request.json
    
    if not data or 'telemetry' not in data:
        return jsonify({"error": "No telemetry data provided"}), 400
        
    telemetry = data['telemetry']
    
    try:
        # Initialize Groq client
        # It will automatically look for the GROQ_API_KEY environment variable
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return jsonify({"error": "GROQ_API_KEY not found in environment"}), 500
            
        client = Groq(api_key=api_key)
        
        prompt = f"""You are an advanced diagnostic AI analyzing a remote sensor node.
        
Based on the following telemetry data, generate a concise, professional health analysis report that sounds like this example: "Based on the current sensor telemetry, the system is operating within optimal parameters. Power consumption efficiency is rated at 94%, and battery voltage holding steady at nominal levels. A slight variance in CPU temperature was noted but remains well below the thermal throttling threshold. Recommendation: No immediate maintenance actions are required at this time."

Your analysis MUST include a bolded "Recommendation:" at the end. Keep the entire response under 4 sentences. Make it sound highly technical but easy to read.

Current Telemetry Data:
- CPU Temperature: {telemetry.get('cpu_temp', 'N/A')} °C (Ideal < 80 °C)
- Battery Voltage: {telemetry.get('battery_voltage', 'N/A')} V (Nominal is usually above 3.5V)
- Signal Strength (RSSI): {telemetry.get('rssi', 'N/A')} dBm (Closer to 0 is better, <-90 is weak)
- Overall System Health Status: {telemetry.get('health_status', 'Unknown')}"""

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=1,
            max_completion_tokens=8192,
            top_p=1,
            stream=False
        )
        
        analysis_text = completion.choices[0].message.content
        return jsonify({"analysis": analysis_text})
        
    except Exception as e:
        print(f"Error generating analysis with Groq: {e}")
        # Try fallback model if client is available
        try:
            if 'client' in locals():
                fallback_completion = client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=1,
                    stream=False
                )
                analysis_text = fallback_completion.choices[0].message.content
                return jsonify({"analysis": analysis_text})
            else:
                return jsonify({"error": "Failed to initialize AI client"}), 500
        except Exception as fallback_e:
            print(f"Fallback model also failed: {fallback_e}")
            return jsonify({"error": "Failed to generate analysis"}), 500
