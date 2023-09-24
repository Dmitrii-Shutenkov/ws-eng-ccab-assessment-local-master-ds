import threading
import requests
import json

url = "http://localhost:3000/charge"
headers = {"accept": "application/json"}
body = {"account": "account",
    "charges": 1}
n = 10
threads = [None]*n
res = [None]*n

def charge(i):
    response = requests.post(url, headers=headers, json=body)
    data = json.loads(response.text)
    res[i] = f"{i}: {data['isAuthorized']} {data['remainingBalance']} {data['charges']}"

for i in range(0, n):
    threads[i] = threading.Thread(target=charge, args=(i,))
    
for i in range(0, n):
    threads[i].start()
    
for i in range(0, n):
    threads[i].join()

for i in range(0, n):
    print(res[i])

