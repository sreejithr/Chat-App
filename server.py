import json
import redis
import threading

from uuid import uuid1
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit

redis_in = redis.Redis(db=0)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

USERS_KEY = "users"
FRIENDS_KEY_FORMAT = "friends:{id}"


class ChatApp(threading.Thread):
    def __init__(self, redis_in, socketio):
        threading.Thread.__init__(self)
        self.redis = redis_in
        self.socketio = socketio
        self.pubsub = self.redis.pubsub()

    def subscribe(self, user_id):
        self.user_id = user_id
        self.pubsub.subscribe(user_id)

    def run(self):
        for item in self.pubsub.listen():
            key = "private_recv:{}".format(self.user_id)
            self.socketio.emit(key, item['data'])

chat_app = ChatApp(redis_in, socketio)

def is_friend(user_id, target):
    key = FRIENDS_KEY_FORMAT.format(id=user_id)
    result = redis_in.smembers(key)

    if not result:
        return False

    friends = filter(lambda x: not x['blocked'], [json.loads(e) for e in result])
    return str(target) in [e['id'] for e in friends]


def add_friend(user_id, target):
    key = FRIENDS_KEY_FORMAT.format(id=user_id)
    data = json.dumps({
        "id": target,
        "blocked": False
    })
    redis_in.sadd(key, data)


def block_user(user_id, target):
    key = FRIENDS_KEY_FORMAT.format(id=target)
    results = redis_in.smembers(key)
    
    if not results:
        redis_in.sadd(json.dumps({
            "id": target,
            "blocked": True
        }))
        return

    friends = [json.loads(e) for e in results]
    remove_index, entry = None, None

    for i, friend in enumerate(friends):
        if friend["id"] == user_id:
            remove_index, entry = i, friend
            break

    if remove_index is not None:
        redis_in.srem(key, list(results)[remove_index])
        redis_in.sadd(key, json.dumps({
            "id": entry['id'],
            "blocked": True
        }))


def checkout_user(id):
    users = redis_in.smembers(USERS_KEY)
    to_remove = None
    for each in users:
        user = json.loads(each)
        if user["id"] == id:
            to_remove = each
            break

    if to_remove:
        redis_in.srem(USERS_KEY, to_remove)


@socketio.on('checkin')
def on_checkin(data):
    data["id"] = str(uuid1())
    redis_in.sadd(USERS_KEY, json.dumps(data))
    res = redis_in.smembers(USERS_KEY)
    if res:
        users = [json.loads(e) for e in res]
    emit("users", users, broadcast=True)
    emit("checkedin", data)
    chat_app.subscribe(data["id"])
    chat_app.run()


@socketio.on('disconnect')
def disconnect():
    checkout_user(chat_app.user_id)
    res = redis_in.smembers(USERS_KEY)
    if res:
        users = [json.loads(e) for e in res]
    emit("users", users, broadcast=True)


@socketio.on('room_chat')
def on_room_chat(message):
    emit("room_message", message, broadcast=True)


@socketio.on('private_send')
def on_private_chat(data):
    if is_friend(data['msg']['from']['id'], data['to']):
        redis_in.publish(data['to'], json.dumps(data['msg']))


@app.route('/<id>/block/<target>/')
def block(id, target):
    block_user(id, target)
    return "Success"


@app.route('/<id>/add/<target>/')
def friend_request(id, target):
    add_friend(id, target)
    return "Success"


@app.route('/<id>/isfriend/<target>/')
def check_if_friend(id, target):
    return jsonify({"is_friend": is_friend(id, target)})


@app.route('/')
def start():
    return render_template("index.html")


if __name__ == "__main__":
    socketio.run(app)
