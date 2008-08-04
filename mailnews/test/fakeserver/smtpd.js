/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
// This file implements test SMTP servers

function smtpDaemon(flags) {
  this._messages = {};
}
smtpDaemon.prototype = {
}

///////////////////////////////////////////////////////////////////////////////
//                              SMTP TEST SERVERS                            //
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////


// This handler implements the bare minimum required by RFC 2822.
function SMTP_RFC2822_handler(daemon) {
  this._daemon = daemon;
  this.closing = false;
}
SMTP_RFC2822_handler.prototype = {
  EHLO: function (args) {
    return "250-foo.com greets bar.com\n250-8BITMIME\n250-SIZE\n250-AUTH PLAIN\n250 HELP";
  },
  AUTH: function (args) {
    return "235 authentication successful";
  },
  MAIL: function (args) {
    return "250 ok";
  },
  RCPT: function(args) {
    return "250 ok";
  },
  DATA: function(args) {
    this.expectingData = true;
    this.post = "";
    return "354 ok\n";
  },
  RSET: function (args) {
    return "250 ok\n";
  },
  VRFY: function (args) {
    return "250 ok\n";
  },
  EXPN: function (args) {
    return "250 ok\n";
  },
  HELP: function (args) {
    return "211 ok\n";
  },
  NOOP: function (args) {
    return "250 ok\n";
  },
  QUIT: function (args) {
    this.closing = true;
    return "221 done";
  },
  onStartup: function () {
    this.closing = false;
    return "220 ok";
  },
  onError: function (command, args) {
    return "500 not recognized\n";
  },
  onMultiline: function(line) {
    if (line == ".") {
      if (this.expectingData) {
        this.expectingData = false;
        return "250 Wonderful article, your style is gorgeous!";
	    }
    }

    if (this.expectingData) {
	    if (line[0] == '.')
        line = line.substring(1);
      // This uses CR LF to match with the specification
	    this.post += line + '\r\n';
    }
    return undefined;
  },
  postCommand: function(obj) {
    if (this.closing)
      obj.closeSocket();
    obj.setMultiline(this.expectingData);
  }
}
