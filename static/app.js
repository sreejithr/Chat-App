function getMessageDiv(message, own) {
  var classes = own === true ? "message" : "message align-right";
  var $div = $("<div>", {"class": classes});
  $div.html("<p>" + message + "</p>");
  return $div;
}

function getUserDiv(id, name) {
  var $div = $("<div>", {"class": "user", "data-id": id, "data-name": name});
  $div.html("<p>" + name + "</p>");
  return $div;
}

var App = {
  $content: $("#content"),
  $launch: $("#launch"),
  $chat: $("#chat"),
  $privateChat: $("#private-chat"),

  // Other elements
  $messages: $("#messages"),
  $privateMessages: $("#private-messages"),
  $users: $("#users"),
  $checkInButton: $("#checkin-button"),
  $messageField: $("#message-field"),
  $privateMessageField: $("#private-message-field"),
  $messageSend: $("#message-send"),
  $privateSend: $("#private-send"),
  $addFriendButton: $("#add-friend"),
  $blockUserButton: $("#block-user"),
  $backToRoomButton: $("#back-room"),

  stack: [],
  getStackTop: function() {
    return this.stack[this.stack.length-1];
  },

  connect: function() {
    var self = this;
    this.socket = io.connect('http://' + document.domain + ':' + location.port);
    this.socket.on('connect', function() {
      self.stack.push(self.$launch);
    });
  },

  setup: function() {
    this.$checkInButton.click(this.clickCheckIn.bind(this));
    this.$messageSend.click(this.clickMessageSend.bind(this));
    this.$privateSend.click(this.clickPrivateSend.bind(this));
    this.$addFriendButton.click(this.clickAddFriend.bind(this));
    this.$blockUserButton.click(this.clickBlockUser.bind(this));
    this.$backToRoomButton.click(this.clickBackToRoom.bind(this));

    this.stack.push(this.$launch);
    this.socket.on("checkedin", this.onCheckIn.bind(this));
    this.socket.on("users", this.onNewUsers.bind(this));
    this.socket.on("room_message", this.onRoomMessage.bind(this));
  },

  start: function() {
    this.connect();
    this.setup();
    this.display();
  },

  display: function() {
    this.$content.children().hide();
    var content = this.getStackTop();
    this.$content.html(content);
    this.$content.children().show();
  },

  onPrivateMessage: function(data) {
    if(data === 1) {
      return;
    }
    var item = JSON.parse(data);
    this.stack.push(this.$privateChat);
    this.display();

    $("#user-header").text(item.from.name);
    this.$privateMessages.append(getMessageDiv(item.text));
  },

  onCheckIn: function(data) {
    this.id = data.id;
    this.name = data.name;
    this.stack.push(this.$chat);
    this.display();
    var key = "private_recv:" + this.id;
    this.socket.on(key, this.onPrivateMessage.bind(this));
  },

  onNewUsers: function(users) {
    this.$users.html("");
    for (var i in users) {
      var user = users[i];
      this.$users.append(getUserDiv(user.id, user.name));
    }

    var self = this;
    $(".user").click(function() {
      var user = this;
      self.clickUser.call(self, user);
    });
  },

  clickUser: function(user) {
    this.$privateChat.attr("data-id", $(user).data("id"));
    this.stack.push(this.$privateChat);
    this.display();
    this.onPrivateChatScreen(user);
  },

  onPrivateChatScreen(user) {
    var self = this;
    var name = $(user).data("name");
    $("#user-header").text(name);

    var targetId = this.$privateChat.attr("data-id");
    var url = "/" + this.id + "/isfriend/" + targetId + "/";
    $.get(url, function(data) {
      if (!data.is_friend) {
        self.$privateMessages.append(
          getMessageDiv("Please add user as friend to chat.", true)
        );
        self.$privateSend.prop("disabled", true);
      } else {
        self.$privateSend.prop("disabled", false);
      }
    });
  },

  onRoomMessage: function(data) {
    var msg = data.from === this.id ? getMessageDiv(data.msg, true) : getMessageDiv(data.msg);
    this.$messages.append(msg);
  },

  /* Button behaviors */
  clickCheckIn: function() {
    var name = $("#name").val();
    var email = $("#email").val();
    this.socket.emit("checkin", {name: name, email: email});
  },

  clickMessageSend: function() {
    var message = this.$messageField.val();
    this.socket.emit("room_chat", {from: this.id, msg: message});
  },

  clickPrivateSend: function() {
    var text = this.$privateMessageField.val();
    var data = {
      to: this.$privateChat.data("id"),
      msg: {
        from: {"id": this.id, "name": this.name},
        text: text
      }
    };
    this.socket.emit("private_send", data);
    this.$privateMessages.append(getMessageDiv(text, true));
  },

  clickAddFriend: function() {
    var self = this;
    var target = this.$privateChat.data("id");
    var url = "/" + this.id + "/add/" + target + "/";
    $.get(url, function(data) {
      if (data === "Success") {
        self.$privateSend.prop("disabled", false);
      }
    });
  },

  clickBlockUser: function() {
    var self = this;
    var target = this.$privateChat.data("id");
    var url = "/" + this.id + "/block/" + target + "/";
    $.get(url);
  },

  clickBackToRoom: function() {
    this.stack.pop();
    this.display();
  }
}
