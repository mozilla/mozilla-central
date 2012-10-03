/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file contains helper methods for debugging -- things like logging
 * exception objects, dumping DOM nodes, Events, and generic object dumps.
 */

const EXPORTED_SYMBOLS = ["logObject", "logException", "logElement", "logEvent",
                          "errorWithDebug"];

/**
 * Report on an object to stdout.
 * @param aObj  the object to be dumped
 * @param aName the name of the object, for informational purposes
 */
function logObject(aObj, aName) {
  dump("Dumping Object: " + aName + "\n");
  stringifier.dumpObj(aObj, aName);
}

/**
 * Log an exception to stdout. This function should not be called in
 * expected circumstances.
 * @param aException  the exception to log
 * @param [aRethrow]  set to true to rethrow the exception after logging
 * @param [aMsg]      optional message to log
 */
function logException(aException, aRethrow, aMsg) {
  stringifier.dumpException(aException, aMsg);

  if (aMsg)
    Components.utils.reportError(aMsg);
  Components.utils.reportError(aException);

  if (aRethrow)
    throw aException;
}

/**
 * Log an DOM element to stdout.
 * @param aElement the DOM element to dump
 */
function logElement(aElement) {
  stringifier.dumpDOM(aElement);
}

/**
 * Log an DOM event to stdout.
 * @param aEvent the DOM event object to dump
 */
function logEvent(aEvent) {
  stringifier.dumpEvent(aEvent);
}

/**
 * Dump the current stack and return an Error suitable for throwing.  We return
 *  the new Error so that your code can use a "throw" statement which makes it
 *  obvious to syntactic analysis that there is an exit occuring at that point.
 *
 * Example:
 *   throw errorWithDebug("I did not expect this!");
 *
 * @param aString The message payload for the exception.
 */
function errorWithDebug(aString) {
  dump("PROBLEM: " + aString + "\n");
  dump("CURRENT STACK (and throwing):\n");
  // skip this frame.
  dump(stringifier.getStack(1));
  return new Error(aString);
}

function Stringifier() {};

Stringifier.prototype = {
  dumpObj: function (o, name) {
    this._reset();
    this._append(this.objectTreeAsString(o, true, true, 0));
    dump(this._asString());
  },

  dumpDOM: function(node, level, recursive) {
    this._reset();
    let s = this.DOMNodeAsString(node, level, recursive);
    dump(s);
  },

  dumpEvent: function(event) {
    dump(this.eventAsString(event));
  },

  dumpException: function(exc, message) {
    dump(exc + "\n");
    Components.utils.reportError(exc);
    this._reset();
    if (message)
      this._append("Exception (" + message + ")\n");

    this._append("-- Exception object --\n");
    this._append(this.objectTreeAsString(exc));
    if (exc.stack) {
      this._append("-- Stack Trace --\n");
      this._append(exc.stack); // skip dumpException and logException
    }
    dump(this._asString());
  },

  _reset: function() {
    this._buffer = [];
  },

  _append: function(string) {
    this._buffer.push(string);
  },

  _asString: function() {
    let str = this._buffer.join('');
    this._reset();
    return str;
  },

  getStack: function(skipCount) {
    if (!((typeof Components == "object") &&
          (typeof Components.classes == "object")))
      return "No stack trace available.";
    if (typeof(skipCount) === undefined)
      skipCount = 0;

    let frame = Components.stack.caller;
    let str = "<top>";

    while (frame) {
      if (skipCount > 0) {
        // Skip this frame.
        skipCount -= 1;
      }
      else {
        // Include the data from this frame.
        let name = frame.name ? frame.name : "[anonymous]";
        str += "\n" + name + "@" + frame.filename + ':' + frame.lineNumber;
      }
      frame = frame.caller;
    }
    return str + "\n";
  },

  objectTreeAsString: function(o, recurse, compress, level) {
    let s = "";
    if (recurse === undefined)
      recurse = 0;
    if (level === undefined)
      level = 0;
    if (compress === undefined)
      compress = true;
    let pfx = "";

    for (var junk = 0; junk < level; junk++)
      pfx += (compress) ? "| " : "|  ";

    let tee = (compress) ? "+ " : "+- ";

    if (typeof(o) != "object") {
      s += pfx + tee + " (" + typeof(o) + ") " + o + "\n";
    }
    else {
      for (let i in o) {
        try {
          let t = typeof o[i];
          switch (t) {
            case "function":
              let sfunc = String(o[i]).split("\n");
              if (sfunc[2] == "    [native code]")
                sfunc = "[native code]";
              else
                sfunc = sfunc.length + " lines";
              s += pfx + tee + i + " (function) " + sfunc + "\n";
              break;
            case "object":
              s += pfx + tee + i + " (object) " + o[i] + "\n";
              if (!compress)
                s += pfx + "|\n";
              if ((i != "parent") && (recurse))
                s += this.objectTreeAsString(o[i], recurse - 1,
                                             compress, level + 1);
              break;
            case "string":
              if (o[i].length > 200)
                s += pfx + tee + i + " (" + t + ") " + o[i].length + " chars\n";
              else
                s += pfx + tee + i + " (" + t + ") '" + o[i] + "'\n";
              break;
            default:
              s += pfx + tee + i + " (" + t + ") " + o[i] + "\n";
          }
        } catch (ex) {
          s += pfx + tee + " (exception) " + ex + "\n";
        }
        if (!compress)
          s += pfx + "|\n";
      }
    }
    s += pfx + "*\n";
    return s;
  },

  _repeatStr: function (str, aCount) {
    let res = "";
    while (--aCount >= 0)
      res += str;
    return res;
  },

  DOMNodeAsString: function(node, level, recursive) {
    if (level === undefined)
      level = 0
    if (recursive === undefined)
      recursive = true;
    this._append(this._repeatStr(" ", 2*level) + "<" + node.nodeName + "\n");

    if (node.nodeType == 3) {
        this._append(this._repeatStr(" ", (2*level) + 4) + node.nodeValue + "'\n");
    }
    else {
      if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
          this._append(this._repeatStr(
                         " ", (2*level) + 4) + node.attributes[i].nodeName +
                         "='" + node.attributes[i].nodeValue + "'\n");
        }
      }
      if (node.childNodes.length == 0) {
        this._append(this._repeatStr(" ", (2*level)) + "/>\n");
      }
      else if (recursive) {
        this._append(this._repeatStr(" ", (2*level)) + ">\n");
        for (let i = 0; i < node.childNodes.length; i++) {
          this._append(this.DOMNodeAsString(node.childNodes[i], level + 1));
        }
        this._append(this._repeatStr(" ", 2*level) + "</" + node.nodeName + ">\n");
      }
    }
    return this._asString();
  },

  eventAsString: function (event) {
    this._reset();
    this._append("-EVENT --------------------------\n");
    this._append("type:           " + event.type + "\n");
    this._append("eventPhase:     " + event.eventPhase + "\n");
    if ("charCode" in event) {
      this._append("charCode: " + event.charCode + "\n");
      if ("name" in event)
        this._append("str(charCode):  '" + String.fromCharCode(event.charCode) + "'\n");
    }
    if (("target" in event) && event.target) {
      this._append("target: " + event.target + "\n");
      if ("nodeName" in event.target)
        this._append("target.nodeName: " + event.target.nodeName + "\n");
      if ("getAttribute" in event.target)
        this._append("target.id: " + event.target.getAttribute("id") + "\n");
    }
    if (("currentTarget" in event) && event.currentTarget) {
      this._append("currentTarget: " + event.currentTarget + "\n");
      if ("nodeName" in event.currentTarget)
        this._append("currentTarget.nodeName: "+ event.currentTarget.nodeName + "\n");
      if ("getAttribute" in event.currentTarget)
        this._append("currentTarget.id: "+ event.currentTarget.getAttribute("id") + "\n");
    }
    if (("originalTarget" in event) && event.originalTarget) {
      this._append("originalTarget: " + event.originalTarget + "\n");
      if ("nodeName" in event.originalTarget)
        this._append("originalTarget.nodeName: "+ event.originalTarget.nodeName + "\n");
      if ("getAttribute" in event.originalTarget)
        this._append("originalTarget.id: "+ event.originalTarget.getAttribute("id") + "\n");
    }
    let names = [
        "bubbles",
        "cancelable",
        "detail",
        "button",
        "keyCode",
        "isChar",
        "shiftKey",
        "altKey",
        "ctrlKey",
        "metaKey",
        "clientX",
        "clientY",
        "screenX",
        "screenY",
        "layerX",
        "layerY",
        "isTrusted",
        "timeStamp",
        "currentTargetXPath",
        "targetXPath",
        "originalTargetXPath"
                ];
    for (let i in names) {
      if (names[i] in event)
        this._append(names[i] + ": " + event[names[i]] + "\n");
    }
    this._append("-------------------------------------\n");
    return this._asString();
  }
};

var stringifier = new Stringifier();
