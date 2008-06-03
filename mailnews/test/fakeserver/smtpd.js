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
    dump("got ELHO\n");
    return "250-foo.com greets bar.com\n250-8BITMIME\n250-SIZE\n250-AUTH PLAIN LOGIN EXTERNAL GSSAPI CRAM-MD5 MSN\n250 HELP";
  },
  AUTH: function (args) {
    dump("AUTH " + args + "\n");
    return "250 ok";
  },
  MAIL: function (args) {
    dump("mail\n");
    return "250 ok";
  },
  RCPT: function(args) {
    dump(" RCPT\n");
    return "250 ok";
  },
  DATA: function(args) {
    dump("DATA\n");
    this.posting = true;
    return "354 ok\n";
  },
  RSET: function (args) {
    dump("RSET\n");
    return "250 ok\n";
  },
  VRFY: function (args) {
    dump("VRFY\n");
    return "250 ok\n";
  },
  EXPN: function (args) {
    dump("EXPN\n");
    return "250 ok\n";
  },
  HELP: function (args) {
    dump("HELP\n");
    return "211 ok\n";
  },
  NOOP: function (args) {
    dump("NOOP\n");
    return "250 ok\n";
  },
  QUIT: function (args) {
    dump(" got QUIT\n");
    this.closing = true;
    dump(this.post + "\n");
    return "221 done";
  },
  onStartup: function () {
    dump("started\n");
    this.closing = false;
    return "220 ok";
  },
  onError: function (command, args) {
    dump("unrecognized " + command + " args " + args + "\n");
    return "500 not recognized\n";
  },
  onMultiline : function(line) {
    dump("line: " + line + "\n");
    if (line == ".") {
      if (this.posting) {
        this.posting = false;
        return "250 Wonderful article, your style is gorgeous!";
	    }
    }

    if (this.posting) {
	    if (line[0] == '.')
        line = line.substring(1);
	    this.post += line+'\n';
    }
    return "250 OK";
  },

  postCommand: function (obj) {
    if (this.closing)
	    obj.closeSocket();
    obj.setMultiline(this.posting);
  }
}
