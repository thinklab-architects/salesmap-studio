import requests
import json

api_key = "AIzaSyCT_OgUb2fpMnSDBMebsAMhYebSirT7sic"
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={api_key}"

payload = {
    "contents": [{
        "parts": [{
            "text": "Hello, please respond with 'API is working'"
        }]
    }]
}

try:
    response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
except Exception as e:
    print(f"Error: {e}")
