/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
// This file implements test POP3 servers

function readFile(fileName) {
  var file = do_get_file("data/" + fileName, true); // allow nonexistent
  // also allow files from general locations
  if (!file || !file.exists())
    file = do_get_file(fileName);

  // If these fail, there is a problem with the test
  do_check_neq(file, null);
  do_check_true(file.exists());

  var ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);

  var fileURI = ioService.newFileURI(file);

  var fileStream = ioService.newChannelFromURI(fileURI).open();

  var inputStream = Cc["@mozilla.org/scriptableinputstream;1"]
                      .createInstance(Ci.nsIScriptableInputStream);
  inputStream.init(fileStream);

  var fileData = "";

  do {
    var chunk = inputStream.read(512);
    if (chunk.length)
      fileData += chunk;
  } while (chunk.length != 0);

  return fileData;
}

function pop3Daemon(flags) {
  this._messages = [];
}
pop3Daemon.prototype = {
  _messages: null,
  _totalMessageSize: 0,

  /**
   * Set the messages that the POP3 daemon will provide to its clients.
   * 
   * @param messages An array of either 1) strings that are filenames whose
   *     contents will be loaded from the files or 2) objects with a "fileData"
   *     attribute whose value is the content of the file.
   */
  setMessages: function(messages) {
    this._messages = [];
    this._totalMessageSize = 0;

    function addMessage(element) {
      // if it's a string, then it's a file-name.
      if (typeof element == "string")
        this._messages.push( { fileData: readFile(element), size: -1 });
      // otherwise it's an object as dictionary already
      else
        this._messages.push(element);
    }
    messages.forEach(addMessage, this);

    for (var i = 0; i < this._messages.length; ++i) {
      this._messages[i].size = this._messages[i].fileData.length;
      this._totalMessageSize += this._messages[i].size;
    }
  },
  getTotalMessages: function() {
    return this._messages.length;
  },
  getTotalMessageSize: function() {
    return this._totalMessageSize;
  }
};

///////////////////////////////////////////////////////////////////////////////
//                              POP3 TEST SERVERS                            //
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////


const kStateAuthAwaitingUser = 1;
const kStateAuthAwaitingPassword = 2;
const kStateTransaction = 3;

// This handler implements the bare minimum required by RFC 1939.
function POP3_RFC1939_handler(daemon) {
  this._daemon = daemon;
  this.closing = false;
}
POP3_RFC1939_handler.prototype = {
  expectedUsername: "fake",
  expectedPassword: "server",
  _state: kStateAuthAwaitingUser,

  USER: function (args) {
    if (this._state != kStateAuthAwaitingUser)
      return "-ERR invalid state";

    if (args == this.expectedUsername) {
      this._state = kStateAuthAwaitingPassword;
      return "+OK user recognized";
    }

    return "-ERR sorry, no such mailbox";
  },
  PASS: function (args) {
    if (this._state != kStateAuthAwaitingPassword)
      return "-ERR invalid state";

    if (args == this.expectedPassword) {
      this._state = kStateTransaction;
      return "+OK maildrop locked and ready";
    }

    this._state = kStateAuthAwaitingUser;
    return "-ERR invalid password";
  },
  STAT: function (args) {
    if (this._state != kStateTransaction)
      return "-ERR invalid state";

    return "+OK " + this._daemon.getTotalMessages() + " " +
           this._daemon.getTotalMessageSize();
  },
  LIST: function (args) {
    if (this._state != kStateTransaction)
      return "-ERR invalid state";

    var result = "+OK " + this._daemon._messages.length + " messages\r\n";
    for (var i = 0; i < this._daemon._messages.length; ++i)
      result += (i + 1) + " " + this._daemon._messages[i].size + "\r\n";

    result += ".";
    return result;
  },
  RETR: function (args) {
    if (this._state != kStateTransaction)
      return "-ERR invalid state";

    var result = "+OK " + this._daemon._messages[args - 1].size + "\r\n";
    result += this._daemon._messages[args - 1].fileData;
    result += ".";
    return result;
  },
  DELE: function (args) {
    if (this._state != kStateTransaction)
      return "-ERR invalid state";
    return "+OK";
  },
  NOOP: function (args) {
    if (this._state != kStateTransaction)
      return "-ERR invalid state";
    return "+OK";
  },
  RSET: function (args) {
    if (this._state != kStateTransaction)
      return "-ERR invalid state";
    this._state = kStateAuthAwaitingUser;
    return "+OK";
  },
  QUIT: function (args) {
    // Let the client close the socket
    //this.closing = true;
    return "+OK fakeserver signing off";
  },
  onStartup: function () {
    this.closing = false;
    this._state = kStateAuthAwaitingUser;
    return "+OK Fake POP3 server ready";
  },
  onError: function (command, args) {
    return "-ERR";
  },
  onMultiline: function(line) {
    if (line == ".") {
      if (this.expectingData) {
        this.expectingData = false;
        return "250 Wonderful article, your style is gorgeous!";
      }
    }

    if (this.data) {
      if (line[0] == '.')
        line = line.substring(1);
      this.post += line+'\n';
    }
    return undefined;
  },
  postCommand: function(obj) {
    if (this.closing)
      obj.closeSocket();
    obj.setMultiline(this.expectingData);
  }
};
