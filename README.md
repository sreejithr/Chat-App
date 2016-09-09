# Chat App
Chat App using raw JS, Flask and Redis.

## Features
- Implemented a navigation stack architecture in JS for ease of rendering.
- Chat room supported.
- Add/block friends.

## How to use

```
git clone https://github.com/sreejithr/Chat-App.git
cd Chat-App
pip install -r requirements.txt

gunicorn --worker-class eventlet -w 1 server:app
```

Then, browse to localhost:8000.
