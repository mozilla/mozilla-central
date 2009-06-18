// This file implements test IMAP servers

////////////////////////////////////////////////////////////////////////////////
//                          IMAP DAEMON ORGANIZATION                          //
////////////////////////////////////////////////////////////////////////////////
// The large numbers of RFCs all induce some implicit assumptions as to the   //
// organization of an IMAP server. Ideally, we'd like to be as inclusive as   //
// possible so that we can guarantee that it works for every type of server.  //
// Unfortunately, such all-accepting setups make generic algorithms hard to   //
// use; given their difficulty in a generic framework, it seems unlikely that //
// a server would implement such characteristics. It also seems likely that   //
// if mailnews had a problem with the implementation, then most clients would //
// see similar problems, so as to make the server widely unusable. In any     //
// case, if someone complains about not working on bugzilla, it can be added  //
// to the test suite.                                                         //
// So, with that in mind, this is the basic layout of the daemon:             //
// DAEMON                                                                     //
// + Namespaces: parentless mailboxes whose names are the namespace name. The //
//     type of the namespace is specified by the type attribute.              //
// + Mailboxes: imapMailbox objects with several properties. If a mailbox     //
// | |   property begins with a '_', then it should not be seralized  because //
// | |   it can be discovered from other means; in particular, a '_' does not //
// | |   necessarily mean that it is a private property that should not be    //
// | |   accessed. The parent of a top-level mailbox is null, not "".         //
// | + I18N names: RFC 3501 specifies a modified UTF-7 form for names.        //
// | |     However, a draft RFC makes the names UTF-8; it is expected to be   //
// | |     completed and implemented "soon". Therefore, the correct usage is  //
// | |     to specify the mailbox names as one normally does in JS and the    //
// | |     protocol will take care of conversion itself.                      //
// | + Case-sensitivity: RFC 3501 takes no position on this issue, only that  //
// | |     a case-insensitive server must treat the base-64 parts of mailbox  //
// | |     names as case-sensitive. The draft UTF8 RFC says nothing on this   //
// | |     topic, but Crispin recommends using Unicode case-insensitivity. We //
// | |     therefore treat names in such manner (if the case-insensitive flag //
// | |     is set), in technical violation of RFC 3501.                       //
// | + Flags: Flags are (as confirmed by Crispin) case-insensitive. Internal  //
// |       flag equality, though, uses case-sensitive checks. Therefore they  //
// |       should be normalized to a title-case form (e.g., \Noselect).       //
// + Synchronization: On certain synchronizing commands, the daemon will call //
// |   a synchronizing function to allow manipulating code the chance to      //
// |   perform various (potentially expensive) actions.                       //
// + Messages: A message is represented internally as an annotated URI.       //
////////////////////////////////////////////////////////////////////////////////
function imapDaemon(flags, syncFunc) {
  this._flags = flags;

  this.namespaces = [];
  this.root = new imapMailbox("", null, {type : IMAP_NAMESPACE_PERSONAL});
  this.uidvalidity = Math.round(Date.now()/1000);
  this.inbox = new imapMailbox("INBOX", null, this.uidvalidity++);
  this.root.addMailbox(this.inbox);
  this.namespaces.push(this.root);

  this.syncFunc = syncFunc;
}
imapDaemon.prototype = {
  synchronize : function (mailbox, update) {
    if (this.syncFunc)
      this.syncFunc.call(null, this);
    if (update) {
      for each (var message in mailbox._messages) {
        message.recent = false;
      }
    }
  },
  getNamespace : function (name) {
    for each (var namespace in this.namespaces) {
      if (name.indexOf(namespace.name) == 0 &&
          name[namespace.name.length] == namespace.delimiter)
        return namespace;
    }
    return this.root;
  },
  createNamespace : function (name, type) {
    var newbox = this.createMailbox(name, {type : type});
    this.namespaces.push(newbox);
  },
  getMailbox : function (name) {
    if (name == "")
      return this.root;
    // INBOX is case-insensitive, no matter what
    if (name.substr(0, 5).toUpperCase() == "INBOX")
      name = "INBOX" + name.substr(5);
    // We want to find a child who has the same name, but we don't quite know
    // what the delimiter is. The convention is that different namespaces use a
    // name starting with '#', so that's how we'll work it out.
    if (name[0] == '#') {
      var root = null;
      for each (var mailbox in this.root._children) {
        if (mailbox.name.indexOf(name) == 0 &&
            name[mailbox.name.length] == mailbox.delimiter) {
          root = mailbox;
          break;
        }
      }
      if (!mailbox)
        return null;
      
      // Now we continue like normal
      var names = name.split(mailbox.delimiter);
      names.splice(0, 1);
      for each (var part in names) {
        mailbox = mailbox.getChild(part);
        if (!mailbox)
          return null;
      }
      return mailbox;
    } else {
      // This is easy, just split it up using the inbox's delimiter
      var names = name.split(this.inbox.delimiter);
      var mailbox = this.root;

      for each (var part in names) {
        mailbox = mailbox.getChild(part);
        if (!mailbox)
          return null;
      }
      return mailbox;
    }
  },
  createMailbox : function (name, oldBox) {
    var namespace = this.getNamespace(name);
    if (namespace.name != "")
      name = name.substring(namespace.name.length+1);
    var prefixes = name.split(namespace.delimiter);
    if (prefixes[prefixes.length-1] == '')
      var subName = prefixes.splice(prefixes.length - 2, 2)[0];
    else
      var subName = prefixes.splice(prefixes.length - 1, 1)[0];
    var box = namespace;
    for each (var component in prefixes) {
      box = box.getChild(component);
      // Yes, we won't autocreate intermediary boxes
      if (box == null || box.flags.indexOf('\\Noinferiors') != -1)
        return false;
    }
    // If this is an imapMailbox...
    if (oldBox && oldBox._children) {
      // Only delete now so we don't screw ourselves up if creation fails
      this._deleteMailbox(oldBox);
      mailbox._parent = box == this.root ? null : box;
      box.addMailbox(oldBox);

      // And if oldBox is an INBOX, we need to recreate that
      if (oldBox.name == "INBOX") {
        this.inbox = new imapMailbox("INBOX", null, this.uidvalidity++);
        this.root.addMailbox(this.inbox);
      }
      oldBox.name = subName;
    } else if (oldBox) {
      // oldBox is a regular {} object, so it contains mailbox data but is not
      // a mailbox itself. Pass it into the constructor and let that deal with
      // it...
      var childBox = new imapMailbox(subName, box == this.root ? null : box,
                                     oldBox);
      box.addMailbox(childBox);
      // And return the new mailbox, since this is being used by people setting
      // up the daemon.
      return childBox;
    } else {
      var creatable = hasFlag(this._flags, IMAP_FLAG_NEEDS_DELIMITER) ?
                      name[name.length - 1] == namespace.delimiter :
                      true;
      var childBox = new imapMailbox(subName, box == this.root ? null : box,
        { flags : creatable ? [] : ['\\Noinferiors'],
          uidvalidity : this.uidvalidity++ });
      box.addMailbox(childBox);
    }
    return true;
  },
  deleteMailbox : function (mailbox) {
    if (mailbox._children.length == 0) {
      // We don't preserve the subscribed state for deleted mailboxes
      var parentBox = mailbox._parent == null ? this.root : mailbox._parent;
      parentBox._children.splice(parentBox._children.indexOf(mailbox), 1);
    } else {
      // clear mailbox
      mailbox._messages = [];
      mailbox.flags.push("\\Noselect");
    }
  }
}

function imapMailbox(name, parent, state) {
  this.name = name;
  this._parent = parent;
  this._children = [];
  this._messages = [];
  this._updates = [];

  // Shorthand for uidvalidity
  if (typeof state == "number") {
    this.uidvalidity = state;
    state = {};
  }

  if (!state)
    state = {};

  for (var prop in state)
    this[prop] = state[prop];

  this.setDefault("subscribed", false);
  this.setDefault("delimiter", "/");
  this.setDefault("flags", []);
  this.setDefault("uidnext", 1);
  this.setDefault("msgflags", ["\\Seen", "\\Answered", "\\Flagged",
                               "\\Deleted", "\\Draft"]);
  this.setDefault("permflags", ["\\Seen", "\\Answered", "\\Flagged",
                                "\\Deleted", "\\Draft", "\\*"]);
}
imapMailbox.prototype = {
  setDefault : function(prop, def) {
    this[prop] = prop in this ? this[prop] : def;
  },
  addMailbox : function (mailbox) {
    this._children.push(mailbox);
  },
  getChild : function (name) {
    var equal;
    for each (var mailbox in this._children) {
      if (name == mailbox.name)
        return mailbox;
    }
    return null;
  },
  matchKids : function (pattern) {
    if (pattern == "")
      return this._parent ? this._parent.matchKids("") : [this];

    var portions = pattern.split(this.delimiter);
    var matching = [this];
    for each (var folder in portions) {
      if (folder.length == 0)
        continue;

      let generator = folder.indexOf("*") >= 0 ? "allChildren" : "_children";
      let possible = matching.reduce(function (arr, elem) {
        return arr.concat(elem[generator]);
      }, []);

      if (folder == '*' || folder == '%') {
        matching = possible;
        continue;
      }

      let parts = folder.split(/[*%]/).filter(function (str) {
          return str.length > 0;
      });
      matching = possible.filter(function (mailbox) {
        let index = 0, name = mailbox.fullName;
        for each (var part in parts) {
          index = name.indexOf(part, index);
          if (index == -1)
            return false;
        }
        return true;
      });
    }
    return matching;
  },
  get fullName () {
    return (this._parent ? this._parent.fullName + this.delimiter : "") +
           this.name;
  },
  get displayName() {
    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                      .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "x-imap4-modified-utf7";
    return converter.ConvertFromUnicode(this.fullName.replace(
      /([\\"])/g, '\\$1')) + converter.Finish();
  },
  get allChildren() {
    return this._children.reduce(function (arr, elem) {
      return arr.concat(elem._allChildrenInternal);
    }, []);
  },
  get _allChildrenInternal() {
    return this._children.reduce(function (arr, elem) {
      return arr.concat(elem._allChildrenInternal);
    }, [this]);
  },
  addMessage : function (message) {
    this._messages.push(message);
    if (message.uid >= this.uidnext)
      this.uidnext = message.uid + 1;
    if (this._updates.indexOf("EXISTS") == -1)
      this._updates.push("EXISTS");
  },
  get _highestuid () {
    if ("__highestuid" in this)
      return this.__highestuid;
    var highest = 0;
    for each (var message in this._messages)
      if (message.uid > highest)
        highest = message.uid;
    this.__highestuid = highest;
    return highest;
  },
  expunge : function () {
    var response = "";
    for (var i = 0; i < this._messages.length; i++) {
      if (this._messages[i].flags.indexOf("\\Deleted") >= 0) {
        response += "* " + (i + 1) + " EXPUNGE\0";
        this._messages.splice(i--, 1);
      }
    }
    if (response.length > 0)
      delete this.__highestuid;
    return response;
  }
}

var gIOService;
function imapMessage(URI, uid, flags) {
  this._URI = URI;
  this.uid = uid;
  this.flags = flags;
  this.recent = false;
}
imapMessage.prototype = {
  get channel() {
    if (!gIOService)
      gIOService = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService);
    return gIOService.newChannel(this._URI, null, null);
  },
  setFlag : function (flag) {
   if (this.flags.indexOf(flag) == -1)
     this.flags.push(flag);
  },
  getText : function (start, length) {
    if (!start)
      start = 0;
    if (!length)
      length = -1;
    var channel = this.channel;
    var istream = channel.open();
    var bstream = Cc["@mozilla.org/binaryinputstream;1"]
                    .createInstance(Ci.nsIBinaryInputStream);
    bstream.setInputStream(istream);
    var str = bstream.readBytes(start);
    if (str.length != start)
      throw "Erm, we didn't just pass through 8-bit";
    length = length == -1 ? istream.available() : length;
    if (length > istream.available())
      length = istream.available();
    str = bstream.readBytes(length);
    return str;
  },
  getPart : function (partNum, wantHeaders) {
    // Long explanation of what's going on here:
    // Most of the confusing parts are due to the foibles of libmime.
    // The first thing we do is select how we want the output--raw for when we
    // just need to spit back data, header-land for when we need to actually
    // look at stuff.
    // Next we form the URIs to feed the converter. However, libmime doesn't do
    // part numbers the same way that IMAP does it: where we want 4.2.2.1 in the
    // example, libmime wants 1.4.2.1.2.1. This means we have to collect the
    // headers first to find where the message/rfc822's exist. Yuck.
    // After that, we run the mime converter. Unfortunately, it only acts async,
    // so we do some ugly stuff to make it all sync.
    var converter = Cc["@mozilla.org/streamconv;1?from=message/rfc822&to=*/*"]
                      .createInstance(Ci.nsIMimeStreamConverter)
                      .QueryInterface(Ci.nsIStreamConverter);
    converter.SetMimeOutputType(wantHeaders ? 1 : 11);

    if (partNum == "") {
      var URI = this._URI;
    } else {
      throw "Can't get subparts!";
    }
    
    if (!gIOService)
      gIOService = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService);
    var channel = gIOService.newChannel(URI, null, null);
    var requestListener = {
       onStreamComplete : function(loader, context, status, length, result) {
         this.answer = String.fromCharCode.apply(null, result);
         this.complete = true;
       },
       complete: false
    };
    var sl = Cc["@mozilla.org/network/stream-loader;1"]
               .createInstance(Ci.nsIStreamLoader);
    sl.init(requestListener);
    converter.asyncConvertData("message/rfc822", "text/plain", sl, channel);

    channel.asyncOpen(converter, null);
    while (!requestListener.complete)
      gThreadManager.currentThread.processNextEvent(true);

    if (wantHeaders) {
      // It's an XML string... we now need to parse it
      var dmParser = Cc["@mozilla.org/xmlextras/domparser;1"]
                       .createInstance(Ci.nsIDOMParser)
                       .QueryInterface(Ci.nsIDOMParserJS);
      var doc = dmParser.parseFromString(requestListener.answer, "text/xml");
      var children = doc.documentElement.firstChild.childNodes;
      var headers = {}
      for (var i=0; i < children.length; i++) {
        var element = children.item(i);
        headers[element.getAttribute("field")] = element.lastChild.nodeValue;
      }

      return headers;
    }
    
    return requestListener.answer;
  }
}
// IMAP FLAGS
// If you don't specify any flag, no flags are set.
/**
 * This flag represents whether or not the daemon is case-insensitive.
 */
const IMAP_FLAG_CASE_INSENSITIVE = 1;
/**
 * This flag represents whether or not CREATE hierarchies need a delimiter.
 *
 * If this flag is off, <tt>CREATE a<br />CREATE a/b</tt> fails where 
 * <tt>CREATE a/<br />CREATE a/b</tt> would succeed (assuming the delimiter is
 * '/').
 */
const IMAP_FLAG_NEEDS_DELIMITER = 2;

function hasFlag(flags, flag) {
  return (flags & flag) == flag;
}

// IMAP Namespaces
const IMAP_NAMESPACE_PERSONAL = 0;
const IMAP_NAMESPACE_OTHER_USERS = 1;
const IMAP_NAMESPACE_SHARED = 2;

// IMAP server helpers
const IMAP_STATE_NOT_AUTHED = 0;
const IMAP_STATE_AUTHED = 1;
const IMAP_STATE_SELECTED = 2;

function parseCommand(text, partial) {
  if (partial) {
    var args = partial.args;
    var current = partial.current;
    var stack = partial.stack;
    current.push(partial.text);
  } else {
    var args = [];
    var current = args;
    var stack = [];
  }
  var atom = '';
  while (text.length > 0) {
    let c = text[0];

    if (c == '"') {
      let index = 1;
      let s = '';
      while (index < text.length && text[index] != '"') {
        if (text[index] == '\\') {
          index++;
          if (text[index] != '"' && text[index] != '\\')
            throw "Expected quoted character";
        }
        s += text[index++];
      }
      if (index == text.length)
        throw "Expected DQUOTE";
      current.push(s);
      text = text.substring(index+1);
      continue;
    } else if (c == '{') {
      let end = text.indexOf('}');
      if (end == -1)
        throw "Expected CLOSE_BRACKET";
      if (end+1 != text.length)
        throw "Expected CRLF";
      let length = parseInt(text.substring(1, end));
      let state = {};
      // Usable state
      throw { length : length, current : current, args : args, stack : stack,
              text : '' };
    } else if (c == '(') {
      stack.push(current);
      current = [];
    } else if (c == ')') {
      if (atom.length > 0) {
        current.push(atom);
        atom = '';
      }
      let hold = current;
      current = stack.pop();
      if (current == undefined)
        throw "Unexpected CLOSE_PAREN";
      current.push(hold);
    } else if (c == ' ') {
      if (atom.length > 0) {
        current.push(atom);
        atom = '';
      }
    } else if (text.substring(0,3).toUpperCase() == "NIL" &&
               (text.length == 3 || text[3] == ' ')) {
      current.push(null);
      text = text.substring(4);
      continue;
    } else {
      atom += c;
    }
    text = text.substring(1);
  }
  if (stack.length != 0)
    throw "Expected CLOSE_PAREN!";
  if (atom.length > 0)
    args.push(atom);
  return args;
}

function formatArg(argument, spec) {
  // Get NILs out of the way quickly
  var nilAccepted = false;
  if (spec[0] == 'n' && spec[1] != 'u') {
    spec = spec.substring(1);
    nilAccepted = true;
  }
  if (argument == null) {
    if (!nilAccepted)
      throw "Unexpected NIL!";

    return null;
  }

  // array!
  if (spec[0] == '(') {
    // typeof array is object. Don't ask me why.
    if (typeof argument != "object")
      throw "Expected list!";
    // Strip the '(' and ')'...
    spec = spec.substring(1, spec.length - 1);
    // ... and apply to the rest
    return argument.map(function (item) { return formatArg(item, spec); });
  }

  // or!
  var pipe = spec.indexOf('|');
  if (pipe > 0) {
    var first = spec.substring(0, pipe);
    try {
      return formatArg(argument, first);
    } catch (e) {
      return formatArg(argument, spec.substring(pipe + 1));
    }
  }

  // By now, we know that the input should be generated from an atom or string.
  if (typeof argument != "string")
    throw "Expected argument of type " + spec + "!";

  if (spec == "atom") {
    argument = argument.toUpperCase(); 
  } else if (spec == "mailbox") {
    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                      .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "x-imap4-modified-utf7";
    argument = converter.ConvertToUnicode(argument);
  } else if (spec == "string") {
    // Do nothing
  } else if (spec == "flag") {
    argument = argument.toLowerCase();
    if (!('a' <= argument[0] && argument[0] <= 'z') &&
        !('A' <= argument[0] && argument[0] <= 'Z')) {
      argument = argument[0] + argument[1].toUpperCase() + argument.substr(2);
    } else {
      argument = argument[0].toUpperCase() + argument.substr(1);
    }
  } else if (spec == "number") {
    if (argument == parseInt(argument))
      argument = parseInt(argument);
  } else if (spec == "date") {
    if (!(/^\d{1,2}-[A-Z][a-z]{2}-\d{4}( \d{2}(:\d{2}){2} [+-]\d{4})?$/.test(
          argument)))
     throw "Expected date!";
    argument = new Date(Date.parse(argument.replace(/-(?!\d{4}$)/g, ' ')));
  } else {
    throw "Unknown spec " + spec;
  }

  return argument;
}

////////////////////////////////////////////////////////////////////////////////
//                              IMAP TEST SERVERS                             //
////////////////////////////////////////////////////////////////////////////////
// Because of IMAP and the LEMONADE RFCs, we have a myriad of different       //
// server configurations that we should ideally be supporting. We handle them //
// by defining a core RFC 3501 implementation and then have different server  //
// extensions subclass the server through functions below. However, we also   //
// provide standard configurations for best handling.                         //
// Configurations:                                                            //
// * Barebones RFC 3501                                                       //
// * Cyrus                                                                    //
// * UW IMAP                                                                  //
// * Courier                                                                  //
// * Exchange                                                                 //
// * Dovecot                                                                  //
// * Zimbra                                                                   //
// KNOWN DEVIATIONS FROM RFC 3501:                                            //
// + The autologout timer is 3 minutes, not 30 minutes. A test with a logout  //
//   of 30 minutes would take a very long time if it failed.                  //
// + SEARCH and STARTTLS are not supported, nor is all of FETCH.              //
// + Concurrent mailbox access is probably compliant with a rather liberal    //
//   implentation of RFC 3501, although probably not what one would expect,   //
//   and certainly not what the Dovecot IMAP server tests expect.             //
////////////////////////////////////////////////////////////////////////////////

/* IMAP Fakeserver operates in a different manner than the rest of fakeserver
 * because of some differences in the protocol. Commands are dispatched through
 * onError, which parses the message into components. Like other fakeserver
 * implementations, the command property will be called, but this time with an
 * argument that is an array of data items instead of a string representing the
 * rest of the line.
 */
function IMAP_RFC3501_handler(daemon) {
  this._daemon = daemon;
  this.closing = false;
  this._state = IMAP_STATE_NOT_AUTHED;
  this._authenticating = undefined;
}
IMAP_RFC3501_handler.prototype = {
  onStartup : function () {
    return "* OK IMAP4rev1 Fakeserver started up";
  },

  ////////////////////////////////////
  // CENTRALIZED DISPATCH FUNCTIONS //
  ////////////////////////////////////

  // IMAP sends commands in the form of "tag command args", but fakeserver
  // parsing tries to call the tag, which doesn't exist. Instead, we use this
  // error method to do the actual command dispatch. Mailnews uses numbers for
  // tags, which won't impede on actual commands.
  onError : function (tag, realLine) {
    this._tag = tag;
    var space = realLine.indexOf(" ");
    var command = space == -1 ? realLine : realLine.substring(0, space);
    realLine = space == -1 ? "" : realLine.substring(space+1);

    // Now parse realLine into an array of atoms, etc.
    try {
      var args = parseCommand(realLine);
    } catch (state if typeof state == "object") {
      this._partial = state;
      this._partial.command = command;
      this._multiline = true;
      return "+ More!";
    } catch (ex) {
      return this._tag + " BAD " + ex;
    }

    // If we're here, we have a command with arguments. Dispatch!
    return this._dispatchCommand(command, args);
  },
  onMultiline : function (line) {
    // A multiline arising form a literal being passed
    if (this._partial) {
      // There are two cases to be concerned with:
      // 1. The CRLF is internal or end (we want more)
      // 1a. The next line is the actual command stuff!
      // 2. The CRLF is in the middle (rest of the line is args)
      if (this._partial.length >= line.length + 2) { // Case 1
        this._partial.text += line + '\r\n';
        this._partial.length -= line.length + 2;
        return undefined;
      } else if (this._partial.length != 0) {
        this._partial.text += line.substring(0, this._partial.length);
        line = line.substring(this._partial.length);
      }
      var command = this._partial.command;
      var args;
      try {
        args = parseCommand(line, this._partial);
      } catch (state if typeof state == "object") {
        // Yet another literal coming around...
        this._partial = state;
        this._partial.command = command;
        return "+ I'll be needing more text";
      } catch (ex) {
        this._multiline = false;
        return this.tag + " BAD parse error: " + ex;
      }

      this._partial = undefined;
      this._multiline = false;
      return this._dispatchCommand(command, args);
    }
    if (this._authenticating) {
      line = atob(line);
      if (line == "*") {
        this._authenticating = undefined;
        this._multiline = false;
        return this._tag + " BAD okay, I won't authenticate you.";
      }
      // Challenge handling?
      this._authenticating = undefined;
      this._state = IMAP_STATE_AUTHED;
      this._multiline = false;
      return this._tag + " OK I just authenticated you. Happy now?";
    }
    return undefined;
  },
  _dispatchCommand : function (command, args) {
    command = command.toUpperCase();
    if (command in this) {
      this._lastCommand = command;
      // Are we allowed to execute this command?
      if (this._enabledCommands[this._state].indexOf(command) == -1)
        return this._tag + " BAD illegal command for current state";
      
      try {
        // Format the arguments nicely
        args = this._treatArgs(args, command);

        // Finally, run the thing
        var response = this[command](args);
      } catch (e if typeof e == "string") {
        var response = e;
      }
    } else {
      var response = "BAD parse error: command not implemented";
    }

    // Add status updates
    if (this._selectedMailbox) {
      for each (var update in this._selectedMailbox._updates) {
        var line;
        switch (update) {
        case "EXISTS":
          line = "* " + this._selectedMailbox._messages.length + " EXISTS";
          break;
        }
        response = line + '\0' + response;
      }
    }

    var lines = response.split(/\u0000/);
    response = "";
    for each (var line in lines) {
      if (line[0] != '+' && line[0] != '*')
        response += this._tag + " ";
      response += line + "\r\n";
    }
    return response;
  },
  _treatArgs : function (args, command) {
    var format = this._argFormat[command];
    var treatedArgs = [];
    for (var i = 0; i < format.length; i++) {
      var spec = format[i];

      if (spec == "...") {
        treatedArgs = treatedArgs.concat(args);
        args = [];
        break;
      }

      if (args.length == 0)
        throw "BAD not enough arguments";

      if (spec[0] == '[') {
        // We have an optional argument. See if the format matches and move on
        // if it doesn't. Ideally, we'd rethink our decision if a later
        // application turns out to be wrong, but that's ugly to do
        // iteratively. Should any IMAP extension require it, we'll have to
        // come back and change this assumption, though.
        spec = spec.substr(1, spec.length - 2);
        try {
          var out = formatArg(args[0], spec);
        } catch (e) {
          continue;
        }
        treatedArgs.push(out);
        args.shift();
        continue;
      }
      try {
        treatedArgs.push(formatArg(args.shift(), spec));
      } catch (e) {
        throw "BAD " + e;
      }
    }
    if (args.length != 0)
      throw "BAD Too many arguments";
    return treatedArgs;
  },
  _enabledCommands : {
    // IMAP_STATE_NOT_AUTHED
    0: ['CAPABILITY', 'NOOP', 'LOGOUT', 'STARTTLS', 'AUTHENTICATE', 'LOGIN'],
    // IMAP_STATE_AUTHED
    1: ['CAPABILITY', 'NOOP', 'LOGOUT', 'SELECT', 'EXAMINE', 'CREATE', 'DELETE',
        'RENAME', 'SUBSCRIBE', 'UNSUBSCRIBE', 'LIST', 'LSUB', 'STATUS',
        'APPEND'],
    // IMAP_STATE_SELECTED
    2: ['CAPABILITY', 'NOOP', 'LOGOUT', 'SELECT', 'EXAMINE', 'CREATE', 'DELETE',
        'RENAME', 'SUBSCRIBE', 'UNSUBSCRIBE', 'LIST', 'LSUB', 'STATUS',
        'APPEND', 'CHECK', 'CLOSE', 'EXPUNGE', 'SEARCH', 'FETCH', 'STORE',
        'COPY', 'UID']
  },
  // Format explanation:
  // atom -> UPPERCASE
  // string -> don't touch!
  // mailbox -> Apply ->UTF16 transformation with case-insensitivity stuff
  // flag -> Titlecase (or \Titlecase, $Titlecase, etc.)
  // date -> Make it a JSDate object
  // number -> Make it a number, if possible
  // ( ) -> list, apply flags as specified
  // [ ] -> optional argument.
  // x|y -> either x or y format.
  // ... -> variable args, don't parse
  _argFormat : {
    CAPABILITY : [],
    NOOP : [],
    LOGOUT : [],
    STARTTLS : [],
    AUTHENTICATE : ["atom"],
    LOGIN : ["string", "string"],
    SELECT : ["mailbox"],
    EXAMINE : ["mailbox"],
    CREATE : ["mailbox"],
    DELETE : ["mailbox"],
    RENAME : ["mailbox", "mailbox"],
    SUBSCRIBE : ["mailbox"],
    UNSUBSCRIBE : ["mailbox"],
    LIST : ["mailbox", "mailbox"],
    LSUB : ["mailbox", "mailbox"],
    STATUS : ["mailbox", "(atom)"],
    APPEND : ["mailbox", "[(flag)]", "[date]", "string"],
    CHECK : [],
    CLOSE : [],
    EXPUNGE : [],
    SEARCH : ["atom", "..."],
    FETCH : ["number", "atom|(atom|(atom))"],
    STORE : ["number", "atom", "flag|(flag)"],
    COPY : ["number", "mailbox"],
    UID : ["atom", "..."]
  },

  //////////////////////////
  //  PROTOCOL COMMANDS   //
  // (ordered as in spec) //
  //////////////////////////
  CAPABILITY : function (args) {
    return "* CAPABILITY IMAP4rev1 " + this._capabilities.join(" ") + "\0" +
           "OK CAPABILITY completed";
  },
  _capabilities : [/*"LOGINDISABLED", "STARTTLS",*/ "AUTH=PLAIN"],
  LOGOUT : function (args) {
    this.closing = true;
    if (this._selectedMailbox)
      this._daemon.synchronize(this._selectedMailbox, !this._readOnly);
    return "* BYE IMAP4rev1 Logging out\0OK LOGOUT completed";
  },
  NOOP : function (args) {
    return "OK NOOP completed";
  },
  STARTTLS : function (args) {
    return "BAD maild doesn't support TLS ATM";
  },
  AUTHENTICATE : function (args) {
    // TODO: check the args
    this._authenticating = args;
    this._multiline = true;
    return "+";
  },
  LOGIN : function (args) {
    this._state = IMAP_STATE_AUTHED;
    return "OK authenticated";
  },

  SELECT : function (args) {
    var box = this._daemon.getMailbox(args[0]);
    if (!box)
      return "NO no such mailbox";
    
    if (this._selectedMailbox)
      this._daemon.synchronize(this._selectedMailbox, !this._readOnly);
    this._state = IMAP_STATE_SELECTED;
    this._selectedMailbox = box;
    this._readOnly = false;
    
    var response = "* FLAGS (" + box.msgflags.join(" ") + ")\0";
    response += "* " + box._messages.length + " EXISTS\0* ";
    response += box._messages.reduce(function (count, message) {
      return count + (message.recent ? 1 : 0);
    }, 0);
    response += " RECENT\0";
    for (var i = 0; i < box._messages.length; i++) {
      if (box._messages[i].flags.indexOf("\\Seen") == -1) {
        response += "* OK [UNSEEN " + (i + 1) + "]\0";
        break;
      }
    }
    response += "* OK [PERMANENTFLAGS (" + box.permflags.join(" ") + ")]\0";
    response += "* OK [UIDNEXT " + box.uidnext + "]\0";
    response += "* OK [UIDVALIDITY " + box.uidvalidity + "]\0";
    return response + "OK [READ-WRITE] SELECT completed";
  },
  EXAMINE : function (args) {
    var box = this._daemon.getMailbox(args[0]);
    if (!box)
      return "NO no such mailbox";

    if (this._selectedMailbox)
      this._daemon.synchronize(this._selectedMailbox, !this._readOnly);
    this._state = IMAP_STATE_SELECTED;
    this._selectedMailbox = box;
    this._readOnly = true;

    var response = "* FLAGS (" + box.msgflags.join(" ") + ")\0";
    response += "* " + box._messages.length + " EXISTS\0* ";
    response += box._messages.reduce(function (count, message) {
      return count + (message.recent ? 1 : 0);
    }, 0);
    response += " RECENT\0";
    for (var i = 0; i < box._messages.length; i++) {
      if (box._messages[i].flags.indexOf("\\Seen") == -1) {
        response += "* OK [UNSEEN " + (i + 1) + "]\0";
        break;
      }
    }
    response += "* OK [PERMANENTFLAGS (" + box.permflags.join(" ") + ")]\0";
    response += "* OK [UIDNEXT " + box.uidnext + "]\0";
    response += "* OK [UIDVALIDITY " + box.uidvalidity + "]\0";
    return response + "OK [READ-ONLY] EXAMINE completed";
  },
  CREATE : function (args) {
    if (this._daemon.getMailbox(args[0]))
      return "NO mailbox already exists";
    if (!this._daemon.createMailbox(args[0]))
      return "NO cannot create mailbox";
    return "OK CREATE completed";
  },
  DELETE : function (args) {
    var mbox = this._daemon.getMailbox(args[0]);
    if (!mbox || mbox.name == "")
      return "NO no such mailbox";
    if (mbox._children.length > 0 && "\\Noselect" in mbox.flags)
      return "NO cannot delete mailbox";
    this._daemon.deleteMailbox(mbox);
    return "OK DELETE completed";
  },
  RENAME : function (args) {
    var mbox = this._daemon.getMailbox(args[0]);
    if (!mbox || mbox.name == "")
      return "NO no such mailbox";
    if (!this._daemon.createMailbox(args[1], mbox))
      return "NO cannot rename mailbox";
    return "OK RENAME completed";
  },
  SUBSCRIBE : function (args) {
    var mailbox = this._daemon.getMailbox(args[0]);
    if (!mailbox || mailbox.subscribed)
      return "NO error in subscribing";
    mailbox.subscribed = true;
    return "OK SUBSCRIBE completed";
  },
  UNSUBSCRIBE : function (args) {
    var mailbox = this._daemon.getMailbox(args[0]);
    if (!mailbox || !mailbox.subscribed)
      return "NO error in unsubscribing";
    mailbox.subscribed = false;
    return "OK SUBSCRIBE completed";
  },
  LIST : function (args) {
    var base = this._daemon.getMailbox(args[0]);
    if (!base)
      return "NO no such mailbox";
    var people = base.matchKids(args[1]);
    var response = "";
    for each (var box in people)
      response += '* LIST (' + box.flags.join(" ") + ') "' + box.delimiter +
                  '" "' + box.displayName + '"\0';
    return response + "OK LIST completed";
  },
  LSUB : function (args) {
    var base = this._daemon.getMailbox(args[0]);
    if (!base)
      return "NO no such mailbox";
    var people = base.matchKids(args[1]);
    var response = "";
    for each (var box in people) {
      if (box.subscribed)
        response += '* LSUB (' + box.flags.join(" ") + ') "' + box.delimiter +
                    '" "' + box.displayName + '"\0';
    }
    return response + "OK LSUB completed";
  },
  STATUS : function (args) {
    var box = this._daemon.getMailbox(args[0]);
    if (!box)
      return "NO no such mailbox exists";
    var parts = [];
    for each (var status in args[1]) {
      var line = status + " ";
      switch (status) {
      case "MESSAGES":
        line += box._messages.length;
        break;
      case "RECENT":
        line += box._messages.reduce(function (count, message) {
          return count + (message.recent ? 1 : 0);
        }, 0);
        break;
      case "UIDNEXT":
        line += box.uidnext;
        break;
      case "UIDVALIDITY":
        line += box.uidvalidity;
        break;
      case "UNSEEN":
        line += box._messages.reduce(function (count, message) {
          return count + (message.flags.indexOf('\\Seen') == -1 ? 1 : 0);
        }, 0);
        break;
      default:
        return "BAD unknown status flag: " + status;
      }
      parts.push(line);
    }
    return "* STATUS \"" + args[0] + "\" (" + parts.join(' ') +
           ")\0OK STATUS completed";
  },
  APPEND : function (args) {
    var mailbox = this._daemon.getMailbox(args[0]);
    if (!mailbox)
      return "NO [TRYCREATE] no such mailbox";
    if (args.length == 3) {
      if (args[1] instanceof Date) {
        var flags = [];
        var date = args[1];
      } else {
        var flags = args[1];
        var date = Date.now();
      }
      var text = args[2];
    } else if (args.length == 4) {
      var flags = args[1];
      var date = args[2];
      var text = args[3];
    } else {
      var flags = [];
      var date = Date.now();
      var text = args[1];
    }
    var msg = new imapMessage("data:text/plain," + encodeURI(text),
                              mailbox.uidnext++, flags);
    msg.recent = true;
    msg.date = date;
    mailbox.addMessage(msg);
    return "OK APPEND complete";
  },
  CHECK : function (args) {
    this._daemon.synchronize(this._selectedMailbox, false);
    return "OK CHECK completed";
  },
  CLOSE : function (args) {
    this._selectedMailbox.expunge();
    this._daemon.synchronize(this._selectedMailbox, !this._readOnly);
    this._selectedMailbox = null;
    this._state = IMAP_STATE_AUTHED;
    return "OK CLOSE completed";
  },
  EXPUNGE : function (args) {
    // Will be either empty or LF-terminated already
    var response = this._selectedMailbox.expunge();
    this._daemon.synchronize(this._selectedMailbox);
    return response + "OK EXPUNGE completed";
  },
  SEARCH : function (args, uid) {
    return "BAD not here yet";
  },
  FETCH : function (args, uid) {
    // Step 1: Get the messages to fetch
    var ids = [];
    var messages = this._parseSequenceSet(args[0], uid, ids);

    // Step 2: Ensure that the fetching items are in a neat format
    if (typeof args[1] == "string") {
      if (args[1] in this.fetchMacroExpansions)
        args[1] = this.fetchMacroExpansions[args[1]];
      else
        args[1] = [args[1]];
    }
    if (uid && args[1].indexOf("UID") == -1)
      args[1].push("UID");
    
    // Step 2.1: Preprocess the item fetch stack
    var items = [], prefix = undefined;
    for each (var item in args[1]) {
      if (item.indexOf('[') > 0 && item.indexOf(']') == -1) {
        // We want to append everything into an item until we find a ']'
        prefix = item + ' ';
        continue;
      }
      if (prefix !== undefined) {
        if (typeof item != "string" || item.indexOf(']') == -1) {
          prefix += (typeof item == "string" ? item : '(' + item.join(' ') + ')')
                  + ' ';
          continue;
        }
        // Replace superfluous space with a ' '
        prefix[prefix.length - 1] = ']';
        item = prefix;
        prefix = undefined;
      }
      item = item.toUpperCase();
      if (items.indexOf(item) == -1)
        items.push(item);
    }

    // Step 3: Fetch time!
    var response = "";
    for (var i = 0; i < messages.length; i++) {
      response += "* " + ids[i] + " FETCH (";
      var parts = [];
      for each (var item in items) {

        // Brief explanation: an item like BODY[]<> can't be hardcoded easily,
        // so we go for the initial alphanumeric substring, passing in the
        // actual string as an optional second part.
        var front = item.split(/[^A-Z0-9]/, 1)[0];
        var functionName = "_FETCH_" + front;
        if (!(functionName in this))
          return "BAD can't fetch " + front;
        try {
          parts.push(this[functionName](messages[i], item));
        } catch (ex) {
          
          return "BAD error in fetching: "+ex;
        }
      }
      response += parts.join(" ") + ')\0';
    }
    return response + "OK FETCH completed";
  },
  STORE : function (args, uid) {
    var ids = [];
    var messages = this._parseSequenceSet(args[0], uid, ids);

    args[1] = args[1].toUpperCase();
    var silent = args[1].indexOf('.SILENT') > 0;
    if (silent)
      args[1] = args[1].substring(0, args[1].indexOf('.'));

    if (typeof args[2] != "object")
      args[2] = [args[2]];

    var response = "";
    for (var i = 0; i < messages.length; i++) {
      var message = messages[i];
      switch (args[1]) {
      case "FLAGS":
        message.flags = args[2];
        break;
      case "+FLAGS":
        for each (var flag in args[2])
          message.setFlag(flag);
        break;
      case "-FLAGS":
        for each (var flag in args[2]) {
          var index;
          if ((index = message.flags.indexOf(flag)) != -1)
            message.flags.splice(index, 1);
        }
        break;
      default:
        return "BAD change what now?";
      }
      response += "* " + ids[i] + " FETCH (FLAGS (";
      response += message.flags.join(' ');
      response += '))\0';
    }
    if (silent)
      response = "";
    return response + 'OK STORE completed';
  },
  COPY : function (args, uid) {
    var messages = this._parseSequenceSet(args[0], uid);

    var dest = this._daemon.getMailbox(args[1]);
    if (!dest)
      return "NO [TRYCREATE] what mailbox?";
    
    for each (var message in messages) {
      let newMessage = new imapMessage(message._URI, dest.uidnext++,
                                       message.flags);
      newMessage.recent = false;
      dest.addMessage(newMessage);
    }

    return "OK COPY completed";
  },
  UID : function (args) {
    var name = args.shift();
    if (["FETCH", "STORE", "SEARCH", "COPY"].indexOf(name) == -1)
      return "BAD illegal command " + name;
    args = this._treatArgs(args, name);
    return this[name](args, true);
  },

  postCommand : function (obj) {
    if (this.closing)
      obj.closeSocket();
    if (this.sendingLiteral)
      obj.preventLFMunge();
    obj.setMultiline(this._multiline);
    if (this._lastCommand == obj.watchWord)
      obj.stopTest();
  },
  onServerFault : function () {
    return ("_tag" in this ? this._tag : '*') + ' BAD Internal server fault.';
  },

  ////////////////////////////////////
  // FETCH sub commands and helpers //
  ////////////////////////////////////
  fetchMacroExpansions : {
    ALL: ["FLAGS", "INTERNALDATE", "RFC822.SIZE", /*"ENVELOPE"*/],
    FAST: ["FLAGS", "INTERNALDATE", "RFC822.SIZE"],
    FULL: ["FLAGS", "INTERNALDATE", "RFC822.SIZE", /*"ENVELOPE", "BODY"*/]
  },
  _parseSequenceSet : function (set, uid, ids /*optional*/) {
    if (typeof set == "number") {
      if (uid) {
        for (var i = 0; i < this._selectedMailbox._messages.length; i++) {
          var message = this._selectedMailbox._messages[i];
          if (message.uid == set) {
            if (ids)
              ids.push(i + 1);
            return [message];
          }
        }
        return [];
      } else {
        if (!(set - 1 in this._selectedMailbox._messages))
          return [];
        if (ids)
          ids.push(set);
        return [this._selectedMailbox._messages[set - 1]];
      }
    }

    var daemon = this;
    function part2num(part) {
      if (part == '*') {
        if (uid)
          return daemon._selectedMailbox._highestuid;
        else
          return daemon._selectedMailbox._messages.length;
      }
      return parseInt(part);
    }

    var elements = set.split(/,/);
    set = [];
    for each (var part in elements) {
      if (part.indexOf(':') == -1) {
        set.push(part2num(part));
      } else {
        var range = part.split(/:/);
        range[0] = part2num(range[0]);
        range[1] = part2num(range[1]);
        if (range[0] > range[1]) {
          let temp = range[1];
          range[1] = range[0];
          range[0] = temp;
        }
        for (let i = range[0]; i <= range[1]; i++)
          set.push(i);
      }
    }
    set.sort();
    for (var i = set.length - 1; i > 0; i--) {
      if (set[i] == set[i - 1])
        set.splice(i, 0);
    }
  
    if (!ids)
      ids = [];
    if (uid) {
      var messages = this._selectedMailbox._messages.filter(function (msg, i) {
        if (set.indexOf(msg.uid) == -1)
          return false;
        ids.push(i + 1);
        return true;
      });
    } else {
      var messages = [];
      for each (var id in set) {
        if (id - 1 in this._selectedMailbox._messages) {
          ids.push(id);
          messages.push(this._selectedMailbox._messages[id - 1]);
        }
      }
    }
    return messages;
  },
  _FETCH_BODY : function (message, query) {
    if (query == "BODY")
      throw "No BODYSTRUCTURE or BODY yet";
    // parts = [ name, section, empty, {, partial, empty } ]
    var parts = query.split(/[[\]<>]/);

    if (parts[0] != "BODY.PEEK" && !this._readOnly)
      message.setFlag("\\Seen");
   
    if (parts[3])
      parts[3] = parts[3].split(/\./).map(function (e) { return parseInt(e); });

    if (parts[1].length == 0) {
      // Easy case: we have BODY[], just send the message...
      var response = "BODY[]";
      if (parts[3]) {
        response += "<" + parts[3][0] + ">";
        var text = message.getText(parts[3][0], parts[3][1]);
      } else {
        var text = message.getText();
      }
      response += " {" + text.length + "}\r\n";
      response += text;
      return response;
    }

    // What's inside the command?
    var data = /((?:\d+\.)*\d+)(?:\.([^ ]+))?/.exec(parts[1]);
    if (data) {
      var partNum = data[1];
      query = data[2];
    } else {
      var partNum = "";
      if (parts[1].indexOf(" ") > 0)
        query = parts[1].substring(0, parts[1].indexOf(" "));
      else
        query = parts[1];
    }
    if (parts[1].indexOf(" ") > 0)
      var queryArgs = parseCommand(parts[1].substr(parts[1].indexOf(" ")))[0];
    else
      var queryArgs = [];

    //var raw = query == "TEXT" || query == "";
    // Now we have three parameters representing the part number (empty for top-
    // level), the subportion representing what we want to find (empty for the
    // body), and an array of arguments if we have a subquery. If we made an
    // error here, it will pop until it gets to FETCH, which will just pop at a
    // BAD response, which is what should happen if the query is malformed.
    // Now we dump it all off onto imapMessage to mess with.
    var information = message.getPart(partNum, false);
    
    // Start off the response
    var response = "BODY[" + parts[1] + "]";
    if (parts[3])
      response += "<" + parts[3][0] + ">";
    response += " ";

    var reconverter = Cc["@mozilla.org/messenger/mimeconverter;1"]
                        .createInstance(Ci.nsIMimeConverter);
    var data = "";
    var lines = information.split(/\r\n|\n/);
    switch (query) {
    case "":
    case "TEXT":
    case "HEADER":
    case "MIME":
      throw "Not yet supported!";
    case "HEADER.FIELDS":
      var joinList = [];
      /*for each (let header in queryArgs) {
        if (header in information) {
          joinList.push(reconverter.encodeMimePartIIStr_UTF8(
            header + ': ' + information[header],
            false,
            "UTF-8",
            header.length + 2,
            72));
        }
      }*/
      var wantFold = false;
      for each (let line in lines) {
        // End of headers
        if (line == '')
          break;
        if (line[0] == ' ' || line[0] == '\t') {
          if (wantFold)
            joinList.push(line);
          continue;
        }
        wantFold = false;
        var header = line.substring(0, line.indexOf(':'));
        if (queryArgs.indexOf(header.toUpperCase()) >= 0) {
          joinList.push(line);
          wantFold = true;
        }
      }
      data = joinList.join('\r\n');
      break;
    case "HEADER.FIELDS.NOT":
    default:
      throw "Can't do BODY[" + query + "]";
    }

    response += '{' + data.length + '}\r\n';
    response += data;
    return response;
  },
  //_FETCH_BODYSTRUCTURE,
  //_FETCH_ENVELOPE,
  _FETCH_FLAGS : function (message) {
    var response = "FLAGS (";
    response += message.flags.join(" ");
    if (message.recent)
      response += " \\Recent";
    response += ")";
    return response;
  },
  _FETCH_INTERNALDATE : function (message) {
    var response = "INTERNALDATE \"";
    response += message.date.toLocaleFormat("%d-%b-%Y %H:%M:%S %z");
    response += "\"";
    return response;
  },
  _FETCH_RFC822 : function (message, query) {
    if (query == "RFC822")
      return this._FETCH_BODY(message, "BODY[]").replace("BODY[]", "RFC822");
    if (query == "RFC822.HEADER")
      return this._FETCH_BODY(message, "BODY.PEEK[HEADER]")
                 .replace("BODY[HEADER]", "RFC822.HEADER");
    if (query == "RFC822.TEXT")
      return this._FETCH_BODY(message, "BODY[TEXT]")
                 .replace("BODY[TEXT]", "RFC822.TEXT");
    
    if (query == "RFC822.SIZE") {
      var channel = message.channel;
      var length = channel.contentLength;
      if (length == -1) {
        var inputStream = channel.open();
        length = inputStream.available();
        inputStream.close();
      }
      return "RFC822.SIZE " + length;
    } else {
      throw "Unknown item "+query;
    }
  },
  _FETCH_UID : function (message) {
    return "UID " + message.uid;
  }
}

////////////////////////////////////////////////////////////////////////////////
//                            IMAP4 RFC extensions                            //
////////////////////////////////////////////////////////////////////////////////
// Since there are so many extensions to IMAP, and since these extensions are //
// not strictly hierarchial (e.g., an RFC 2342-compliant server can also be   //
// RFC 3516-compliant, but a server might only implement one of them), they   //
// must be handled differently from other fakeserver implementations.         //
// An extension is defined as follows: it is an object (not a function and    //
// prototype pair!). This object is "mixed" into the handler via the helper   //
// function mixinExtension, which applies appropriate magic to make the       //
// handler compliant to the extension. Functions are added untransformed, but //
// both arrays and objects are handled by appending the values onto the       //
// original state of the handler. Semantics apply as for the base itself.     //
////////////////////////////////////////////////////////////////////////////////

var configurations = {
  Cyrus: ["RFC2342"],
  UW: ["RFC2342"],
  Dovecot: [],
  Zimbra: ["RFC2342"],
  Exchange: ["RFC2342"],
  LEMONADE: ["RFC2342"]
};

function mixinExtension(handler, extension) {
  if (extension.preload)
    extension.preload(handler);

  for (var property in extension) {
    if (property == 'preload')
      continue;
    if (typeof extension[property] == "function") {
      // This is a function, so we add it to the handler
      handler[property] = extension[property];
    } else if (extension[property] instanceof Array) {
      // This is an array, so we append the values
      if (!(property in handler))
        handler[property] = [];
      handler[property] = handler[property].concat(extension[property]);
    } else {
      // This is an object, so we add in the values
      if (property in handler)
        // Hack to make arrays et al. work recursively
        mixinExtension(handler[property], extension[property]);
      else
        handler[property] = extension[property];
    }
  }
}

// RFC 2342: IMAP4 Namespace
var IMAP_RFC2342_extension = {
  NAMESPACE : function (args) {
    var namespaces = [[], [], []];
    for each (var namespace in this._daemon.namespaces)
      namespaces[namespace.type].push(namespace);

    var response = "* NAMESPACE";
    for each (var type in namespaces) {
      if (type.length == 0) {
        response += " NIL";
        continue;
      }
      response += " (";
      for each (var namespace in type) {
        response += "(\"";
        response += namespace.displayName;
        response += "\" \"";
        response += namespace.delimiter;
        response += "\")";
      }
      response += ")";
    }
    return response;
  },
  _capabilities : ["NAMESPACE"],
  _argFormat : { NAMESPACE : [] },
  // Enabled in AUTHED and SELECTED states
  _enabledCommands : { 1 : ["NAMESPACE"], 2 : ["NAMESPACE"] }
};

// RFC 4315: UIDPLUS
var IMAP_RFC4315_extension = {
  preload: function (toBeThis) {
    toBeThis._preRFC4315UID = toBeThis.UID;
    toBeThis._preRFC4315APPEND = toBeThis.APPEND;
    toBeThis._preRFC4315COPY = toBeThis.COPY;
  },
  UID: function (args) {
    // XXX: UID EXPUNGE is not supported.
    return this._preRFC4315UID(args);
  },
  APPEND: function (args) {
    let response = this._preRFC4315APPEND(args);
    if (response.indexOf("OK") == 0) {
      let mailbox = this._daemon.getMailbox(args[0]);
      let uid = mailbox.uidnext - 1;
      response = "OK [APPENDUID " + uid + "]" + response.substring(2);
    }
    return response;
  },
  COPY: function (args) {
    let mailbox = this._daemon.getMailbox(args[0]);
    if (mailbox)
      var first = mailbox.uidnext;
    let response = this._preRFC4315COPY(args);
    if (response.indexOf("OK") == 0) {
      let last = mailbox.uidnext - 1;
      response = "OK [COPYUID " + first + ":" + last + "]" +
                  response.substring(2);
    }
    return response;
  },
  _capabilities: ["UIDPLUS"]
};
