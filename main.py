import requests
import json

url = "https://api.akashml.com/v1/chat/completions"

payload = {
    "model": "zai-org/GLM-5.2",
    "messages": [
        {
            "role": "user",
            "content": "Hello, how are you?"
        }
    ],
    "max_tokens": 150,
    "temperature": 0.7
}

headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer akml-KxBqqBwAycNXHtTlzndmNNqJfVRroBBs"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())