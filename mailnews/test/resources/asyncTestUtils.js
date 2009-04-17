/*
 * This file provides support for writing mailnews tests using generators so
 *  your test code can be simple and straight-forward.  We provide both the
 *  core routines to do this (async_run, async_driver), as well as helper
 *  routines specialized to
 *
 * Here's some example-ish code:
 *
 * function run_test() {
 *   do_test_pending();
 *   async_run({func: test_some_stuff});
 * }
 *
 * function test_some_stuff() {
 *   yield async_run({func: something_async});
 *   yield async_run({func: something_that_maybe_is_async});
 *   something_that_is_definitely_not_async();
 *   do_test_finished();
 * }
 */

var asyncCopyListener = {
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aMsgKey) {},
  GetMessageId: function() {},
  OnStopCopy: function(aStatus) {
    async_driver();
  }
};

/**
 * Delete one or synthetic messages from gTestFolder.  The arguments can be one
 *  or more synthetic message instances or a singe list of synthetic messages.
 *  (Synthetic messages are from messageGenerator.js)
 *
 * Usage example:
 *  yield async_delete_messages(synMsg);
 *  yield async_delete_messages(synMsg1, synMsg2);
 *  yield async_delete_messages([synMsg1, synMsg2]);
 */
function async_delete_messages() {
  let synMessages;
  if (arguments.length > 1)
    synMessages = arguments;
  else if (arguments[0].length)
    synMessages = arguments[0];
  else
    synMessages = [arguments[0]];

  let msgDatabase = gTestFolder.msgDatabase;
  var array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  synMessages.forEach(function (synMsg) {
    let hdr = msgDatabase.getMsgHdrForMessageID(synMsg.messageId);
    array.appendElement(hdr, false);
  });

  gTestFolder.deleteMessages(array, null, false, true, asyncCopyListener, true);

  return false;
}


var asyncGeneratorStack = [];

/**
 * Run a function that may or may not be a generator.  All functions, generator
 *  or not, must return false if they do not want the async_driver to run the
 *  next logical work step.  Returning no value (undefined) or true indicates to
 *  the async_driver that it should execute the next work step.  You would
 *  return false if your function initiates an asynchronous operation and will
 *  ensure that async_driver is called when the async operation completes. (This
 *  is how many of the functions in this file work.)
 *
 * The argument is a dictionary which can have the following keys, with 'func'
 *  being required:
 * - func: The function to call.
 * - dis: The 'this' to use when calling the function.
 * - args: A list of arguments to pass to the function.
 *
 * Usage example:
 *  yield async_run({func: a_normal_function});
 *  yield async_run({func: a_generator_function});
 *  yield async_run({dis: Foo, func: Foo.func, args: [1, 2, 3]});
 */
function async_run(aArgs) {
  let result = aArgs.func.apply(aArgs.dis || null, aArgs.args || []);
  if (result && result.next) {
    asyncGeneratorStack.push(result);
    return _async_driver();
  }
  else {
    if (result === undefined)
      return true;
    else
      return result;
  }
}

/**
 * Function to kick off/resume asynchronous processing.  Any function invoked by
 *  async_run that returns/yields false at any point is responsible for ensuring
 *  async_driver() is called again once the async operation completes.
 *
 * Note: This function actually schedules the real driver to run after a timeout.
 *  This is to ensure that if you call us from a notification event that all the
 *  other things getting notified get a chance to do their work before we actually
 *  continue execution.  It also keeps our stack traces cleaner.
 */
function async_driver() {
  do_timeout_function(0, _async_driver);
}

// the real driver!
function _async_driver() {
  let curGenerator;
  while ((curGenerator = asyncGeneratorStack[asyncGeneratorStack.length-1])) {
    try {
      while (curGenerator.next()) {
      }
      return false;
    }
    catch (ex) {
      if (ex != StopIteration) {
        do_throw(ex);
      }
      asyncGeneratorStack.pop();
    }
  }
  return true;
}
