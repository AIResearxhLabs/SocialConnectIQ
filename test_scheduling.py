import requests
import datetime

url = "http://localhost:8000/api/scheduling/schedule"
payload = {
    "content": "Test scheduled post via python script",
    "platforms": ["facebook"],
    "scheduled_time": (datetime.datetime.now() + datetime.timedelta(minutes=10)).isoformat(),
    "user_id": "test_verification_user"
}

try:
    print(f"Sending POST to {url}")
    print(f"Payload: {payload}")
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
