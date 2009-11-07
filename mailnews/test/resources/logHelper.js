/*
 * Makes everything awesome if you are Andrew.  Some day it will make everything
 *  awesome if you are not awesome too.
 *
 * Right now the most meaningful thing to know is that if XPCOM failures happen
 *  (and get reported to the error console), this will induce a unit test
 *  failure.  You should think this is awesome no matter whether you are Andrew
 *  or not.
 */

Components.utils.import("resource://app/modules/gloda/log4moz.js");
// We need loadFileToString and honestly this is no crazier a dependency than
//  gloda's Log4Moz
Components.utils.import("resource://app/modules/gloda/utils.js");

var _testLogger;
var _xpcshellLogger;
var _testLoggerContexts = [];
var _testLoggerActiveContext;

var _logHelperInterestedListeners = false;

/**
 * Let other test helping code decide whether to register for potentially
 *  expensive notifications based on whether anyone can even hear those
 *  results.
 */
function logHelperHasInterestedListeners() {
  return _logHelperInterestedListeners;
}

/**
 * Tunnel nsIScriptErrors that show up on the error console to Log4Moz.  We could
 *  send everything but I think only script errors are likely of much concern.
 *  Also, this nicely avoids infinite recursions no matter what you do since
 *  what we publish is not going to end up as an nsIScriptError.
 *
 * This is based on my (asuth') exmmad extension.
 */
let _errorConsoleTunnel = {
  initialize: function () {
    this.consoleService = Cc["@mozilla.org/consoleservice;1"]
                            .getService(Ci.nsIConsoleService);
    this.consoleService.registerListener(this);

    // we need to unregister our listener at shutdown if we don't want explosions
    this.observerService = Cc["@mozilla.org/observer-service;1"]
                             .getService(Ci.nsIObserverService);
    this.observerService.addObserver(this, "quit-application", false);
  },

  shutdown: function () {
    this.consoleService.unregisterListener(this);
    this.observerService.removeObserver(this, "quit-application");
    this.consoleService = null;
    this.observerService = null;
  },

  observe: function (aMessage, aTopic, aData) {
    if (aTopic == "quit-application") {
      this.shutdown();
      return;
    }

    // meh, let's just use mark_failure for now.
    // and let's avoid feedback loops (happens in mozmill)
    if ((aMessage instanceof Components.interfaces.nsIScriptError) &&
        (aMessage.errorMessage.indexOf("Error console says") == -1))
      mark_failure(["Error console says", aMessage]);
  }
};

/**
 * Initialize logging.  The idea is to:
 *
 * - Always create a dump appender on 'test'.
 * - Check if there's a desire to use a logsploder style network connection
 *    based on the presence of an appropriate file in 'tmp'.  This should be
 *    harmless in cases where there is not such a file.
 *
 * We will wrap the interesting xpcshell functions if we believe there is an
 *  endpoint that cares about these things (such as logsploder).
 */
function _init_log_helper() {
  let rootLogger = Log4Moz.repository.rootLogger;
  rootLogger.level = Log4Moz.Level.All;

  // - dump on test
  _testLogger = Log4Moz.repository.getLogger("test.test");
  let formatter = new Log4Moz.BasicFormatter();
  let dapp = new Log4Moz.DumpAppender(formatter);
  dapp.level = Log4Moz.Level.All;
  _testLogger.addAppender(dapp);

  // - silent category for xpcshell stuff that already gets dump()ed
  _xpcshellLogger = Log4Moz.repository.getLogger("xpcshell");

  // - logsploder
  let file = Cc["@mozilla.org/file/directory_service;1"]
               .getService(Ci.nsIProperties)
               .get("TmpD", Ci.nsIFile);
  file.append("logsploder.ptr");
  if (file.exists()) {
    _logHelperInterestedListeners = true;

    let data = GlodaUtils.loadFileToString(file);
    data = data.trim();
    let [host, port] = data.split(":");
    let jf = new Log4Moz.JSONFormatter();
    let sapp = new Log4Moz.SocketAppender(host, Number(port), jf);
    // this goes on the root so it can see all
    rootLogger.addAppender(sapp);
  }

  // Create a console listener reporting thinger in all cases.  Since XPCOM
  //  failures will show up via the error console, this allows our test to fail
  //  in more situations where we might otherwise silently be cool with bad
  //  things happening.
  _errorConsoleTunnel.initialize();

  if (_logHelperInterestedListeners) {
    _wrap_xpcshell_functions();

    // Send a message telling the listeners about the test file being run.
    _xpcshellLogger.info({
      _jsonMe: true,
      _isContext: true,
      _specialContext: "lifecycle",
      _id: "start",
      testFile: _TEST_FILE,
    });
  }
}
_init_log_helper();

function _cleanup_log_helper() {
  let rootLogger = Log4Moz.repository.rootLogger;
  for each (let [, appender] in Iterator(rootLogger.appenders)) {
    if ("closeStream" in appender)
      appender.closeStream();
  }
  rootLogger._appenders = [];
}

/**
 * Mark the start of a test.  This creates nice console output as well as
 *  setting up logging contexts so that use of other helpers in here like
 *  mark_action get associated with the context.
 *
 * This will likely only be used by the test driver framework, such as
 *  asyncTestUtils.js.  However, |mark_sub_test_start| is for user test code.
 */
function mark_test_start(aName, aParameter, aDepth) {
  if (aDepth == null)
    aDepth = 0;

  // clear out any existing contexts
  mark_test_end(aDepth);

  let term = (aDepth == 0) ? "test" : "subtest";
  _testLoggerActiveContext = _testLogger.newContext({
    type: term,
    name: aName,
    parameter: aParameter
  });
  if (_testLoggerContexts.length) {
    _testLoggerActiveContext._contextDepth = _testLoggerContexts.length;
    _testLoggerActiveContext._contextParentId =
      _testLoggerContexts[_testLoggerContexts.length-1]._id;
  }
  _testLoggerContexts.push(_testLoggerActiveContext);

  _testLogger.info(_testLoggerActiveContext,
                   "Starting " + term + ": " + aName +
                   (aParameter ? (", " + aParameter) : ""));
}

/**
 * Mark the end of a test started by |mark_test_start|.
 */
function mark_test_end(aPopTo) {
  if (aPopTo === undefined)
    aPopTo = 0;
  // clear out any existing contexts
  while (_testLoggerContexts.length > aPopTo) {
    let context = _testLoggerContexts.pop();
    context.finish();
    _testLogger.info(context, "Finished " + context.type + ": " + context.name +
                     (context.parameter ? (", " + context.parameter) : ""));
  }
}

/**
 * For user test code and test support code to mark sub-regions of tests.
 *
 * @param aName The name of the (sub) test.
 * @param [aParameter=null] The parameter if the test is being parameterized.
 * @param [aNest=false] Should this nest inside other sub-tests?  If you omit or
 *     pass false, we will close out any existing sub-tests.  If you pass true,
 *     we nest inside the previous test/sub-test and rely on you to call
 *     |mark_sub_test_end|.  Sub tests can lost no longer than their parent.
 *     You should strongly consider using the aNest parameter if you are
 *     test support code.
 */
function mark_sub_test_start(aName, aParameter, aNest) {
  let depth = aNest ? _testLoggerContexts.length : 1;
  mark_test_start(aName, aParameter, depth);
}

/**
 * Mark the end of a sub-test.  Because sub-tests can't outlive their parents,
 *  there is no ambiguity about what sub-test we are closing out.
 */
function mark_sub_test_end() {
  if (_testLoggerContexts.length <= 1)
    return;
  mark_test_end(_testLoggerContexts.length - 1);
}

/**
 * Express that all tests were run to completion.  This helps the listener
 *  distinguish between succesful termination and abort-style termination where
 *  the process just keeled over and on one told us.
 *
 * This also tells us to clean up.
 */
function mark_all_tests_run() {
  // make sure all tests get closed out
  mark_test_end();

  _xpcshellLogger.info({
    _jsonMe: true,
    _isContext: true,
    _specialContext: "lifecycle",
    _id: "finish",
    done: true,
  });

  _cleanup_log_helper();
}

function _explode_flags(aFlagWord, aFlagDefs) {
  let flagList = [];

  for each (let [flagName, flagVal] in Iterator(aFlagDefs)) {
    if (flagVal & aFlagWord)
      flagList.push(flagName);
  }

  return flagList;
}

let _registered_json_normalizers = [];

/**
 * Like __simple_obj_copy but it does not assume things are objects.  This is
 *  used by obj copying for aray copyiong.
 */
function __simple_value_copy(aObj, aDepthAllowed) {
  if (aObj == null || typeof(aObj) != "object")
    return aObj;
  return __simple_obj_copy(aObj, aDepthAllowed);
}

/**
 * Simple object copier to limit accidentally JSON-ing a ridiculously complex
 *  object graph or getting tripped up by prototypes.
 *
 * @param aObj Input object.
 * @param aDepthAllowed How many times we are allowed to recursively call
 *     ourselves.
 */
function __simple_obj_copy(aObj, aDepthAllowed) {
  let oot = {};
  let nextDepth = aDepthAllowed - 1;
  for each (let [key, value] in Iterator(aObj)) {
    if (value == null) {
      oot[key] = null;
    }
    else if (typeof(value) != "object") {
      oot[key] = value;
    }
    // steal control flow if no more depth is allowed
    else if (!aDepthAllowed) {
      oot[key] = "truncated, string rep: " + value.toString();
    }
    // array?  we don't count that as depth for now.
    else if ("length" in value) {
      oot[key] = [__simple_value_copy(v, nextDepth) for each
                   ([, v] in Iterator(value))];
    }
    // it's another object! woo!
    else {
      oot[key] = _normalize_for_json(value, nextDepth, true);
    }
  }

  // let's take advantage of the object's native toString now
  oot._stringRep = aObj.toString();

  return oot;
}

const _INTERESTING_MESSAGE_HEADER_PROPERTIES = {
  "gloda-id": 0,
  "gloda-dirty": 0,
  "msgOffset": 0,
  "offlineMsgSize": 0,
};


/**
 * Given an object, attempt to normalize it into an interesting JSON
 *  representation.
 *
 * We transform generally interesting mail objects like:
 * - nsIMsgFolder
 * - nsIMsgDBHdr
 */
function _normalize_for_json(aObj, aDepthAllowed, aJsonMeNotNeeded) {
  if (aDepthAllowed === undefined)
    aDepthAllowed = 2;

  // if it's a simple type just return it direct
  if (typeof(aObj) != "object")
    return aObj;
  else if (aObj == null)
    return aObj;

  // === Mail Specific ===
  // (but common and few enough to not split out)
  if (aObj instanceof Ci.nsIMsgFolder) {
    let flags = aObj.flags;
    return {
      type: "folder",
      name: aObj.prettiestName,
      uri: aObj.URI,
      flags: _explode_flags(aObj.flags,
                            Ci.nsMsgFolderFlags),
    };
  }
  else if (aObj instanceof Ci.nsIMsgDBHdr) {
    let properties = {};
    for each (let [name, propType] in
              Iterator(_INTERESTING_MESSAGE_HEADER_PROPERTIES)) {
      if (propType == 0)
        properties[name] = (aObj.getStringProperty(name) != "") ?
                             aObj.getUint32Property(name) : null;
      else
        properties[name] = aObj.getStringProperty(name);
    }
    return {
      type: "msgHdr",
      name: aObj.folder.URI + "#" + aObj.messageKey,
      subject: aObj.mime2DecodedSubject,
      from: aObj.mime2DecodedAuthor,
      to: aObj.mime2DecodedRecipients,
      messageKey: aObj.messageKey,
      messageId: aObj.messageId,
      flags: _explode_flags(aObj.flags,
                            Ci.nsMsgMessageFlags),
      interestingProperties: properties,
    };
  }
  // === Generic ===
  // Although straight JS exceptions should serialize pretty well, we can
  //  improve things by making "stack" more friendly.
  else if (aObj instanceof Error) {
    return {
      message: aObj.message,
      fileName: aObj.fileName,
      lineNumber: aObj.lineNumber,
      name: aObj.name,
      stack: aObj.stack ? aObj.stack.split(/\n\r?/g) : null,
      _stringRep: aObj.message,
    };
  }
  else if (aObj instanceof Ci.nsIStackFrame) {
    return {
      type: "stackFrame",
      name: aObj.name,
      fileName: aObj.filename, // intentionally lower-case
      lineNumber: aObj.lineNumber,
    };
  }
  else if (aObj instanceof Ci.nsIScriptError) {
    return {
      type: "stackFrame",
      name: aObj.errorMessage,
      category: aObj.category,
      fileName: aObj.sourceName,
      lineNumber: aObj.lineNumber,
    };
  }
  else {
    for each (let [, [checkType, handler]] in
              Iterator(_registered_json_normalizers)) {
      if (aObj instanceof checkType)
        return handler(aObj);
    }
  }

  let simple_obj = __simple_obj_copy(aObj, aDepthAllowed);
  if (!aJsonMeNotNeeded)
    simple_obj.__proto__ = _fake_json_proto;
  return simple_obj;
}

function register_json_normalizer(aType, aHandler) {
  _registered_json_normalizers.push([aType, aHandler]);
}

/**
 * Helper for |mark_action| that creates json-transportable representation so
 *  cool UI on the other end can do something.
 */
function _MarkAction(aWho, aWhat, aArgs) {
  this.type = "action";
  this.who = aWho;
  this.what = aWhat;
  this.args = aArgs;
}
_MarkAction.prototype = {
  _jsonMe: true,
  toString: function() {
    let argStr;
    if (this.args) {
      argStr = ":";
      for each (let [, arg] in Iterator(this.args)) {
        if (arg != null && (typeof(arg) == "object") && ("type" in arg)) {
          if ("name" in arg)
            argStr += " " + arg.type + ": " + arg.name;
          else
            argStr += " " + arg.type;
        }
        else
          argStr += " " + arg;
      }
    }
    else
      argStr = "";
    return this.who + " " + this.what + argStr;
  }
};

/**
 * Report performance of an action (by testing code).  You would use this rather
 *  than dump because we attempt to do interesting and useful logging things.
 *  In the future, this may mean prettier logs when buildbot runs a test and it
 *  fails, but right now it means great fun for people who use logsploder and
 *  just nicely formatted text for people looking at the console output.
 *
 * @param aWho Think of this like a logger handle... it might be soon.
 * @param aWhat What did you do?
 * @param aArgs A list of arguments, which could each be something like an
 *     nsIMsgFolder or nsIMsgDBHdr or something like that.  It uses
 *     |_normalize_for_json| which can handle some native objects, be extended
 *     to handle more, and does a fair job on straight JS objects.
 */
function mark_action(aWho, aWhat, aArgs) {
  let logger = Log4Moz.repository.getLogger("test." + aWho);

  aArgs = [_normalize_for_json(arg) for each ([, arg] in Iterator(aArgs))];
  logger.info(_testLoggerActiveContext, new _MarkAction(aWho, aWhat, aArgs));
}

/*
 * Wrap the xpcshell test functions that do interesting things.  The idea is
 *  that we clobber these only if we're going to value-add; that decision
 *  gets made up top in the initialization function.
 *
 * Since eq/neq fall-through to do_throw in the explosion case, we don't handle
 *  that since the scoping means that we're going to see the resulting
 *  do_throw.
 */

var _orig_do_throw;
var _orig_do_check_neq;
var _orig_do_check_eq;
// do_check_true is implemented in terms of do_check_eq
// do_check_false is implemented in terms of do_check_eq

function _CheckAction(aSuccess, aLeft, aRight, aStack) {
  this.type = "check";
  this.success = aSuccess;
  this.left = _normalize_for_json(aLeft);
  this.right = _normalize_for_json(aRight);
  this.stack = _normalize_for_json(aStack);
}
_CheckAction.prototype = {
  _jsonMe: true,
  // we don't need a toString because we should not go out to the console
};

/**
 * Representation of a failure from do_throw.
 */
function _Failure(aText, aStack) {
  this.type = "failure";
  this.text = aText;
  this.stack = _normalize_for_json(aStack);
}
_Failure.prototype = {
  _jsonMe: true,
};

let _fake_json_proto = {
  _jsonMe: true,
};

function mark_failure(aRichString) {
  let args = [_testLoggerActiveContext];
  let text = "";
  for each (let [i, richThing] in Iterator(aRichString)) {
    text += (i ? " " : "") + richThing;
    if (richThing == null || typeof(richThing) != "object")
      args.push(richThing);
    else {
      let jsonThing = _normalize_for_json(richThing);
      // hook things up to be json serialized.
      if (!("_jsonMe" in jsonThing))
        jsonThing.__proto__ = _fake_json_proto;
      args.push(jsonThing);
    }
  }
  _xpcshellLogger.info.apply(_xpcshellLogger, args);

  do_throw(text, Components.stack.caller);
}

function _wrapped_do_throw(text, stack) {
  if (!stack)
    stack = Components.stack.caller;

  // We need to use an info because otherwise explosion loggers can get angry
  //  and they may be indiscriminate about what they subscribe to.
  _xpcshellLogger.info(_testLoggerActiveContext,
                        new _Failure(text, stack));

  return _orig_do_throw(text, stack);
}

function _wrapped_do_check_neq(left, right, stack) {
  if (!stack)
    stack = Components.stack.caller;

  _xpcshellLogger.info(_testLoggerActiveContext,
                       new _CheckAction(left != right,
                                        left, right, stack));

  return _orig_do_check_neq(left, right, stack);
}

function _wrapped_do_check_eq(left, right, stack) {
  if (!stack)
    stack = Components.stack.caller;

  _xpcshellLogger.info(_testLoggerActiveContext,
                       new _CheckAction(left == right,
                                        left, right, stack));

  return _orig_do_check_eq(left, right, stack);
}

function _wrap_xpcshell_functions() {
  _orig_do_throw = do_throw;
  do_throw = _wrapped_do_throw;
  _orig_do_check_neq = do_check_neq;
  do_check_neq = _wrapped_do_check_neq;
  _orig_do_check_eq = do_check_eq;
  do_check_eq = _wrapped_do_check_eq;
}
