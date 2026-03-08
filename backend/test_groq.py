import os
from dotenv import load_dotenv
load_dotenv()

from groq import Groq

print("Initializing Groq client...")
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

print("Sending chat completion request...")
try:
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": "Explain the importance of fast language models",
            }
        ],
        model="llama-3.3-70b-versatile",
    )

    print("Response received:")
    print(chat_completion.choices[0].message.content)
except Exception as e:
    print(f"Error: {e}")
