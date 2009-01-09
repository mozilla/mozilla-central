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
  function SMTP_RFC2822_handler(daemon, authMechanisms, username, password) {
  this._daemon = daemon;
  this.closing = false;
  this._authMechanisms = authMechanisms ? authMechanisms : "PLAIN";
  this._username = username ? username : "testsmtp";
  this._password = password ? password : "smtptest";
  // 0 = not logged in, 1 = waiting username, 2 = waiting password,
  // 3 = logged in
  this._authState = 0;
  this._expectPassword = false;
}
SMTP_RFC2822_handler.prototype = {
  EHLO: function (args) {
    return "250-foo.com greets bar.com\n250-8BITMIME\n250-SIZE\n250-AUTH " +
           this._authMechanisms + "\n250 HELP";
  },
  AUTH: function (args) {
    var splitArgs = args.split(" ");
    dump(args + " " + splitArgs[0] + "\n");

    switch (splitArgs[0]) {
    case "PLAIN": {
      if (splitArgs[1] != btoa("\u0000" + this._username + "\u0000" + this._password))
        return "535 authentication failed";

      this._authState = 3;

      return "235 authentication successful";
    }
    case "LOGIN": {
      this._authState = 1;
      this._expectPassword = true;
      return "334 " + btoa("Username:");
    }
    default:
      return "504 Invalid authentication mechanism"
    }

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
  onPassword: function (line) {
    this._expectPassword = false;

    switch (this._authState) {
      case 1: {
        if (line != btoa(this._username)) {
          this._authState = 0;
          return "535 authentication failed";
        }
        this._authState = 2;
        this._expectPassword = true;
        return "334 " + btoa("Password:");
      }
      case 2: {
        if (line != btoa(this._password)) {
          this._authState = 0;
          return "535 authentication failed";
        }
        this._authState = 3;
        return "235 authentication successful";
      }
    }
    return "500 not recognized\n";
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
    obj.setExpectPassword(this._expectPassword);
  }
}
