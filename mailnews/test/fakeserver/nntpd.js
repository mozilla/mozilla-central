/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
// This file implements test NNTP servers

Components.utils.import("resource:///modules/mimeParser.jsm");

var EXPORTED_SYMBOLS = [
  'nntpDaemon',
  'newsArticle',
  'NNTP_POSTABLE',
  'NNTP_REAL_LENGTH',
  'NNTP_RFC977_handler',
  'NNTP_RFC2980_handler',
  'NNTP_RFC3977_handler',
  'NNTP_Giganews_handler',
  'NNTP_RFC4643_extension'
];

function nntpDaemon(flags) {
  this._groups = {};
  this._messages = {};
  this._flags = flags;
}
nntpDaemon.prototype = {
  addGroup : function(group, postable) {
    var flags = 0;
    if (postable)
      flags |= NNTP_POSTABLE;
    this._groups[group] = { keys : [], flags : flags, nextKey : 1};
  },
  addArticle : function (article) {
   this._messages[article.messageID] = article;
   for each (var group in article.groups) {
     if (group in this._groups) {
       var key = this._groups[group].nextKey++;
       this._groups[group][key] = article;
       this._groups[group]['keys'].push(key);
     }
   }
  },
  addArticleToGroup : function(article, group, key) {
    this._groups[group][key] = article;
    this._messages[article.messageID] = article;
    this._groups[group]['keys'].push(key);
    if (this._groups[group].nextKey <= key)
      this._groups[group].nextKey = key+1;
  },
  getGroup : function(group) {
    if (this._groups.hasOwnProperty(group))
      return this._groups[group];
    return null;
  },
  getGroupStats : function (group) {
    if (group['keys'].length == 0)
      return [0, 0, 0];
    var min = 1<<30;
    var max = 0;
    group['keys'].forEach(function (key) {
        if (key < min) min = key;
        if (key > max) max = key;
      });

    var length;
    if (hasFlag(this._flags, NNTP_REAL_LENGTH))
      length = group['keys'].length;
    else
      length = max-min+1;

    return [length, min, max];
  },
  getArticle : function (msgid) {
    if (msgid in this._messages)
      return this._messages[msgid];
    return null;
  }
}

function newsArticle(text) {
  this.headers = {};
  this.body = "";
  this.messageID = "";
  this.fullText = text;

  var headerMap;
  [headerMap, this.body] = MimeParser.extractHeadersAndBody(text);
  for (var [header, values] of headerMap) {
    var value = values[0];
    this.headers[header] = value;
    if (header == "message-id") {
      var start = value.indexOf('<');
      var end = value.indexOf('>', start);
      this.messageID = value.substring(start, end+1);
    } else if (header == "newsgroups") {
      this.groups = value.split(/[ \t]*,[ \t]*/);
    }
  }

  // Add in non-existent fields
  if (!("lines" in this.headers))
  {
    let lines = this.body.split('\n').length;
    this.headers["lines"] = lines;
  }
}

/**
 * This function converts an NNTP wildmat into a regular expression.
 *
 * I don't know how accurate it is wrt i18n characters, but its primary usage
 * right now is just XPAT, where i18n effects are utterly unspecified, so I am
 * not too concerned.
 *
 * This also neglects cases where special characters are in [] blocks.
 */
function wildmat2regex(wildmat) {
  // Special characters in regex that aren't special in wildmat
  wildmat = wildmat.replace(/[$+.()|{}^]/, function (str) {
      return "\\" + str;
  });
  wildmat = wildmat.replace(/(\\*)([*?])/, function (str, p1, p2) {
    // TODO: This function appears to be wrong on closer inspection.
    if (p1.length % 2 == 0)
      return p2 == '*' ? '.*' : '.';
    return str;
  });
  return new RegExp(wildmat);
}

// NNTP FLAGS
const NNTP_POSTABLE = 0x0001;

const NNTP_REAL_LENGTH = 0x0100;

function hasFlag(flags, flag) {
  return (flags & flag) == flag;
}

////////////////////////////////////////////////////////////////////////////////
//                              NNTP TEST SERVERS                             //
////////////////////////////////////////////////////////////////////////////////
// To be comprehensive about testing and fallback, we define these varying    //
// levels of RFC-compliance:                                                  //
// * RFC 977 solely (there's not a lot there!)                                //
// * RFC 977 + 2980 (note that there are varying levels of this impl)         //
// * RFC 3977 bare bones                                                      //
// * RFC 3977 full                                                            //
// * RFC 3977 + post-3977 extensions                                          //
// * Giganews (Common newsserver for ISP stuff; highest importance)           //
// * INN 2.4 (Gold standard common implementation; second highest importance) //
// Note too that we want various levels of brokenness:                        //
// * Perm errors that require login                                           //
// * "I can't handle that" (e.g., news.mozilla.org only supports XOVER for    //
//   searching with XHDR)                                                     //
// * Naive group counts, missing articles                                     //
// * Limitations on what can be posted                                        //
////////////////////////////////////////////////////////////////////////////////


// This handler implements the bare minimum required by RFC 977. Actually, not
// even that much: IHAVE and SLAVE are not implemented, as those two are
// explicitly server implementations.
function NNTP_RFC977_handler(daemon) {
  this._daemon = daemon;
  this.closing = false;
  this.resetTest();
}
NNTP_RFC977_handler.prototype = {
  resetTest : function() {
    this.extraCommands = "";
    this.articleKey = null;
    this.group = null;
  },
  ARTICLE : function (args) {
     var info = this._selectArticle(args, 220);
     if (info[0] == null)
       return info[1];

     var response = info[1]+'\n';
     response += info[0].fullText.replace("(?=\n).", "..");
     response += ".";
     return response;
  },
  BODY : function (args) {
     var info = this._selectArticle(args, 222);
     if (info[0] == null)
       return info[1];

     var response = info[1]+'\n';
     response += info[0].body.replace("(?=\n).","..");
     response += ".";
     return response;
  },
  GROUP : function(args) {
    var group = this._daemon.getGroup(args);
    if (group == null)
      return "411 no such news group";

    this.group = group;
    this.articleKey = 0 in this.group.keys ? this.group.keys[0] : null;

    var stats = this._daemon.getGroupStats(group);
    return "211 " + stats[0] + " " + stats[1] + " " + stats[2] + " " + args +
           " group selected";
  },
  HEAD : function (args) {
     var info = this._selectArticle(args, 221);
     if (info[0] == null)
       return info[1];

     var response = info[1]+'\n';
     for (let header in info[0].headers)
       response += header + ": " + info[0].headers[header] + "\n";
     response += ".";
     return response;
  },
  HELP : function (args) {
    var response = "100 Why certainly, here is my help:\n";
    response += "Mozilla fake NNTP RFC 977 testing server";
    response += "Commands supported:\n";
    response += "\tARTICLE <message-id> | [nnn]\n";
    response += "\tBODY\n";
    response += "\tGROUP group\n";
    response += "\tHEAD\n";
    response += "\tHELP\n";
    response += "\tLAST\n";
    response += "\tLIST\n";
    response += "\tNEWGROUPS\n";
    response += "\tNEWNEWS\n";
    response += "\tNEXT\n";
    response += "\tPOST\n";
    response += "\tQUIT\n";
    response += "\tSTAT\n";
    response += this.extraCommands;
    response += ".";
    return response;
  },
  LAST : function (args) {
    if (this.group == null)
      return "412 no newsgroup selected";
    if (this.articleKey == null)
      return "420 no current article has been selected";
    return "502 Command not implemented";
  },
  LIST : function (args) {
    var response = "215 list of newsgroup follows\n";
    for (let group in this._daemon._groups) {
      var stats = this._daemon.getGroupStats(this._daemon._groups[group]);
      response += group + " " + stats[1] + " " + stats[0] + " " +
                  (hasFlag(group.flags, NNTP_POSTABLE) ? "y" : "n") + "\n";
    }
    response += ".";
    return response;
  },
  NEWGROUPS : function (args) {
    return "502 Command not implemented";
  },
  NEWNEWS : function (args) {
    return "502 Command not implemented";
  },
  NEXT : function (args) {
    if (this.group == null)
      return "412 no newsgroup selected";
    if (this.articleKey == null)
      return "420 no current article has been selected";
    return "502 Command not implemented";
  },
  POST : function(args) {
    this.posting = true;
    this.post = "";
    return "340 Please continue";
  },
  QUIT : function(args) {
    this.closing = true;
    return "205 closing connection - goodbye!";
  },
  STAT : function (args) {
     var info = this._selectArticle(args, 223);
     return info[1];
  },
  LISTGROUP : function (args) {
    // Yes, I know this isn't RFC 977, but I doubt that mailnews will ever drop
    // its requirement for this, so I'll stuff it in here anyways...
    var group = (args == "" ? this.group : this._daemon.getGroup(args));
    if (group == null)
      return "411 This newsgroup does not exist";

    var response = "211 Articles follow:\n";
    for each (var key in group['keys'])
      response += key + "\n";
    response += ".\n";
    return response;
  },


  onError : function (command, args) {
    return "500 command not recognized";
  },
  onServerFault: function (e) {
    return "500 internal server error: " + e;
  },
  onStartup : function () {
    this.closing = false;
    this.group = null;
    this.article = null;
    this.posting = false;
    return "200 posting allowed";
  },
  onMultiline : function (line) {
    if (line == ".") {
      if (this.posting) {
        var article = new newsArticle(this.post);
        this._daemon.addArticle(article);
        this.posting = false;
        return "240 Wonderful article, your style is gorgeous!";
      }
    }

    if (this.posting) {
      if (line.startsWith('.'))
        line = line.substring(1);

      this.post += line+'\n';
    }

    return undefined;
  },
  postCommand : function (reader) {
    if (this.closing)
      reader.closeSocket();
    reader.setMultiline(this.posting);
  },

  /**
   * Selects an article based on args.
   *
   * Returns an array of objects consisting of:
   * # The selected article (or null if non was selected
   * # The first line response
   */
  _selectArticle : function (args, responseCode) {
    var art, key;
    if (args == "") {
      if (this.group == null)
        return [null, "412 no newsgroup has been selected"];
      if (this.articleKey == null)
        return [null, "420 no current article has been selected"];

      art = this.group[this.articleKey];
      key = this.articleKey;
    } else if (args.startsWith('<')) {
      art = this._daemon.getArticle(args);
      key = 0;

      if (art == null)
        return [null, "430 no such article found"];
    } else {
      if (this.group == null)
        return [null, "412 no newsgroup has been selected"];

      key = parseInt(args);
      if (key in this.group) {
        this.articleKey = key;
        art = this.group[key];
      } else {
        return [null, "423 no such article number in this group"];
      }
    }

    var respCode = responseCode + " " + key + " " + art.messageID +
      " article selected";
    return [art, respCode];
  }
}

/**
 * Utility method to define a subclass
 *
 * @param sub   The function object of the subclass
 * @param super The function object of the superclass
 * @param def   The object definition of the subclass prototype.
 */
function subclass(sub, sup, def) {
  sub.prototype = new sup();
  for (let obj in def) {
    sub.prototype[obj] = def[obj];
  }
}
function subconstructor(sub, sup) {
  sup.apply(sub, Array.prototype.slice.call(arguments, 2));
  sub.parent = new Object();
  sub.parent.__noSuchMethod__ = function (name, args) {
    return sup.prototype[name].apply(sub, args);
  }
}
function NNTP_RFC2980_handler(daemon) {
  subconstructor(this, NNTP_RFC977_handler, daemon);
}
subclass(NNTP_RFC2980_handler, NNTP_RFC977_handler, {
//NNTP_RFC2980_handler.prototype = new NNTP_RFC977_handler();
//var subprototype = {
  DATE : function (args) {
    return "502 Command not implemented";
  },
  LIST : function (args) {
    var index = args.indexOf(" ");
    var command = index == -1 ? args : args.substring(0,index);
    args = index == -1 ? "" : args.substring(index+1);
    command = command.toUpperCase();
    if ("LIST_"+command in this)
      return this["LIST_"+command](args);
    return this.parent.LIST(command+" "+args);
  },
  LIST_ACTIVE : function (args) {
    return this.parent.LIST(args);
  },
  MODE : function (args) {
    if (args == "READER")
      return this.onStartup();
    return "500 What do you think you're trying to pull here?";
  },
  XHDR : function (args) {
    if (!this.group)
      return "412 No group selected";

    args = args.split(" ");
    var header = args[0].toLowerCase();
    var found = false;
    var response = "221 Headers abound\n";
    for each (let key in this._filterRange(args[1], this.group.keys)) {
      if (!(header in this.group[key].headers))
        continue;
      found = true;
      response += key + " " +this.group[key].headers[header] + '\n';
    }
    if (!found)
      return "420 No such article";
    response += '.';
    return response;
  },
  XOVER : function (args) {
    if (!this.group)
      return "412 No group selected";

    args = args.split(/ +/, 3);
    var response = "224 List of articles\n";
    for each (let key in this._filterRange(args[0], this.group.keys)) {
      response += key + "\t";
      var article = this.group[key];
      response += article.headers["subject"] + "\t" +
                  article.headers["from"] + "\t" +
                  article.headers["date"] + "\t" +
                  article.headers["message-id"] + "\t" +
                  (article.headers["references"] ? article.headers["references"]
                                                : "") + "\t" +
                  article.fullText.replace(/\r?\n/,'\r\n').length + "\t" +
                  article.body.split(/\r?\n/).length + "\t" +
                  article.headers["xref"] + "\n";
    }
    response += '.\n';
    return response;
  },
  XPAT : function (args) {
    if (!this.group)
      return "412 No group selected";

    /* XPAT header range ... */
    args = args.split(/ +/, 3);
    let header = args[0].toLowerCase();
    let regex = wildmat2regex(args[2]);

    let response = "221 Results follow\n";
    for each (let key in this._filterRange(args[1], this.group.keys)) {
      let article = this.group[key];
      if (header in article.headers && regex.test(article.headers[header])) {
        response += key + ' ' + article.headers[header] + '\n';
      }
    }
    return response + '.';
  },

  _filterRange: function (range, keys) {
    let dash = range.indexOf('-');
    let low, high;
    if (dash < 0) {
      low = high = parseInt(range);
    } else {
      low = parseInt(range.substring(0, dash));
      if (dash < range.length - 1)
        high = range.substring(dash + 1);
      else
        high = 1.0 / 0.0; // Everything is less than this
    }
    return keys.filter(function (e) { return low <= e && e <= high; });
  }
});

function NNTP_Giganews_handler(daemon) {
  subconstructor(this, NNTP_RFC2980_handler, daemon);
}
subclass(NNTP_Giganews_handler, NNTP_RFC2980_handler, {
  XHDR : function (args) {
    var header = args.split(" ")[0].toLowerCase();
    if (header in ["subject", "from", "xref", "date", "message-id",
                   "references"]) {
      return this.parent.XHDR(args);
    }
    return "503 unsupported header field";
  }
});

function NNTP_RFC4643_extension(daemon) {
  subconstructor(this, NNTP_RFC2980_handler, daemon);

  this.extraCommands += "\tAUTHINFO USER\n";
  this.extraCommands += "\tAUTHINFO PASS\n";
}
subclass(NNTP_RFC4643_extension, NNTP_RFC2980_handler, {
  expectedUsername : "testnews",
  expectedPassword : "newstest",
  requireBoth : true,
  authenticated: false,
  usernameReceived: false,

  AUTHINFO : function (args) {
    if (this.authenticated)
      return "502 Command unavailable";

    var argSplit = args.split(" ");
    var action = argSplit[0];
    var param = argSplit[1];

    if (action == "user") {
      if (this.usernameReceived)
        return "502 Command unavailable";

      var expectUsername = this.lastGroupTried
        ? this._daemon.groupCredentials[this.lastGroupTried][0]
        : this.expectedUsername;
      if (param != expectUsername)
        return "481 Authentication failed";

      this.usernameReceived = true;
      if (this.requireBoth)
        return "381 Password required";

      this.authenticated = this.lastGroupTried ? this.lastGroupTried : true;
      return "281 Authentication Accepted";
    }
    else if (action == "pass") {
      if (!this.requireBoth || !this.usernameReceived)
        return "482 Authetication commands issued out of sequence";
      
      this.usernameReceived = false;

      var expectPassword = this.lastGroupTried
        ? this._daemon.groupCredentials[this.lastGroupTried][1]
        : this.expectedPassword;
      if (param != expectPassword)
        return "481 Authentication failed";

      this.authenticated = this.lastGroupTried ? this.lastGroupTried : true;
      return "281 Authentication Accepted";
    }
    return "502 Invalid Command";
  },
  LIST : function (args) {
    if (this.authenticated) {
      return this.parent.LIST(args);
    }
    return "480 Authentication required";
  },
  GROUP : function (args) {
    if ((this._daemon.groupCredentials != null && this.authenticated == args)
        || (this._daemon.groupCredentials == null && this.authenticated))
      return this.parent.GROUP(args);
    if (this._daemon.groupCredentials != null)
      this.lastGroupTried = args;
    return "480 Authentication required";
  }
});
