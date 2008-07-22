// This file implements test NNTP servers

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
    this._groups[group] = { keys : [], flags : flags};
  },
  addArticleToGroup : function(article, group, key) {
    this._groups[group][key] = article;
    this._messages[article.messageID] = article;
    this._groups[group]['keys'].push(key);
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

  var lines = text.split("\n"), passedHeaders = false;
  for each(var line in lines) {
    if (!passedHeaders) {
      if (line.length == 0) {
        passedHeaders = true;
        continue;
      }
      var parts = text.split(":[ \t]*");
      this.headers[parts[0]] = parts[1];
      switch (parts[0].toLowerCase()) {
        case "message-id":
          this.messageID = parts[1];
      }
    } else {
      this.body += line + "\n";
    }
  }
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
// * INN 2.4 (Gold standard common implementation; highest importance)        //
// * Giganews (Common newsserver for ISP stuff; second highest importance)    //
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
  this.group = null;
  this.article = null;
}
NNTP_RFC977_handler.prototype = {
  ARTICLE : function (args) {
     var art;
     if (args == "") {
       if (this.article == null)
         return "420 no current article has been selected";

       art = this.article;
     } else if (args.charAt(0) == '<') {
       art = this._daemon.getArticle(args);
       if (art == null)
         return "430 no such article found";
     } else {
       if (this.group == null)
         return "412 no newsgroup has been selected";

       var index = Integer.parseInt(args);
       if (index in this.group.keys) {
         this.article = this.group.keys[index];
         art = this.article;
       } else {
         return "423 no such article number in this group";
       }
     }

     var response = "220 " + art.key + " " + art.messageID +
                    " article retrieved - head and body follows.\n";
     for (var header in art.headers) {
       response += header + ": " + art.headers[header] + "\n";
     }
     response += art.body.replace("(?=\n).", "..");
     response += ".";
     return response;
  },
  BODY : function (args) {
     var art;
     if (args == "") {
       if (this.article == null)
         return "420 no current article has been selected";

       art = this.article;
     } else if (args.charAt(0) == '<') {
       art = this._daemon.getArticle(args);
       if (article == null)
         return "430 no such article found";
     } else {
       if (this.group == null)
         return "412 no newsgroup has been selected";

       var index = Integer.parseInt(args);
       if (index in this.group.keys) {
         this.article = this.group.keys[index];
         art = this.article;
       } else {
         return "423 no such article number in this group";
       }
     }

     var response = "222 "+art.key+" "+art.messageID+
                    " article retrieved - body follows.\n";
     response += "\n";
     response += art.body.replace("(?=\n).","..");
     response += ".";
     return response;
  },
  GROUP : function(args) {
    var group = this._daemon.getGroup(args);
    if (group == null)
      return "411 no such news group";

    this.article = null;

    var stats = this._daemon.getGroupStats(group);
    return "211 " + stats[0] + " " + stats[1] + " " + stats[2] + " " + args +
           " group selected";
  },
  HEAD : function (args) {
     var art;
     if (args == "") {
       if (this.article == null)
         return "420 no current article has been selected";

       art = this.article;
     } else if (args.charAt(0) == '<') {
       art = this._daemon.getArticle(args);
       if (art == null)
         return "430 no such article found";
     } else {
       if (this.group == null)
         return "412 no newsgroup has been selected";

       var index = Integer.parseInt(args);
       if (index in this.group.keys) {
         this.article = this.group.keys[index];
         art = this.article;
       } else {
         return "423 no such article number in this group";
       }
     }

     var response = "221 " + art.key + " " + art.messageID +
                    " article retrieved - head follows.\n";
     for (var header in art.headers) {
       response += header + ": " + article.headers[header] + "\n";
     }
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
    response += ".";
    return response;
  },
  LAST : function (args) {
    if (group == null)
      return "412 no newsgroup selected";
    if (article == null)
      return "420 no current article has been selected";
    return "502 Command not implemented";
  },
  LIST : function (args) {
    var response = "215 list of newsgroup follows\n";
    for (group in this._daemon._groups) {
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
    if (group == null)
      return "412 no newsgroup selected";
    if (article == null)
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
     var art;
     if (args == "") {
       if (this.article == null)
         return "420 no current article has been selected";

       art = this.article;
     } else if (args.charAt(0) == '<') {
       art = this._daemon.getArticle(args);
       if (article == null)
         return "430 no such article found";
     } else {
       if (this.group == null)
         return "412 no newsgroup has been selected";

       var index = Integer.parseInt(args);
       if (index in this.group.keys) {
         this.article = this.group.keys[index];
         art = this.article;
       } else {
         return "423 no such article number in this group";
       }
     }

     return "223 " + art.key + " " + art.messageID +
            " article retrieved - request text separately.";
  },
  LISTGROUP : function (args) {
    // Yes, I know this isn't RFC 977, but I doubt that mailnews will ever drop
    // its requirement for this, so I'll stuff it in here anyways...
    var group = (args == "" ? this.group : this._daemon.getGroup(args));
    if (group == null)
      return "411 This newsgroup does not exist";

    var response = "211 Articles follow:\n";
    for (var key in group['keys'])
      response += key + "\n";
    response += ".\n";
    return response;
  },


  onError : function (command, args) {
    return "500 command not recognized";
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
        this.posting = false;
        return "240 Wonderful article, your style is gorgeous!";
      }
    }

    if (this.posting) {
      if (line[0] == '.')
        line = line.substring(1);

      this.post += line+'\n';
    }

    return undefined;
  },
  postCommand : function (obj) {
    if (this.closing)
      obj.closeSocket();
    obj.setMultiline(this.posting);
  }
}
