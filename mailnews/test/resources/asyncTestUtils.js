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
 * Delete one or more synthetic messages.  If using SyntheticMessageSets, call
 *  once for each SyntheticMessageSet.  Otherwise, we take synthetic message
 *  instances that are assumed to live in gTestFolder.  The arguments can be one
 *  or more synthetic message instances or a singe list of synthetic messages.
 *  (Synthetic messages are from messageGenerator.js, SyntheticMessageSets are
 *  from messageModifier.js)
 *
 * Usage example using a SyntheticMessageSet (which defines the folder):
 *  yield async_delete_messages(syntheticMessageSet);
 *  yield async_delete_messages(new SyntheticMessageSet(folder, [synMsg]);
 * Usage example assuming gTestFolder:
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

  if (synMessages.length == 0)
    do_throw("You need to tell us to delete at least one thing!");

  // SyntheticMessageSet case
  if (synMessages[0].synMessages) {
    let messageSet = synMessages[0];
    // because synthetic message sets
    return async_run({func: function () {
        for (let [folder, xpcomHdrArray] in
             messageSet.foldersWithXpcomHdrArrays) {
          folder.deleteMessages(xpcomHdrArray, null, false, true,
                                asyncCopyListener, true);
          yield false;
        }
      },
    });
  }
  // a list of synthetic messages case
  else {
    let msgDatabase = gTestFolder.msgDatabase;
    let hdrArr = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    synMessages.forEach(function (synMsg) {
      hdrArr.appendElement(msgDatabase.getMsgHdrForMessageID(synMsg.messageId),
                           false);
    });
    gTestFolder.deleteMessages(hdrArr, null, false, true, asyncCopyListener,
                               true);
    return false;
  }
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
    asyncGeneratorStack.push([result, aArgs.func.name]);
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
 * Note: This function actually schedules the real driver to run after a
 *  timeout. This is to ensure that if you call us from a notification event
 *  that all the other things getting notified get a chance to do their work
 *  before we actually continue execution.  It also keeps our stack traces
 *  cleaner.
 */
function async_driver() {
  do_timeout_function(0, _async_driver);
}

// the real driver!
function _async_driver() {
  let curGenerator;
  while (asyncGeneratorStack.length) {
    curGenerator = asyncGeneratorStack[asyncGeneratorStack.length-1][0];
    try {
      while (curGenerator.next()) {
      }
      return false;
    }
    catch (ex) {
      if (ex != StopIteration) {
        dump("*******************************************\n");
        dump("Generator explosion!\n");
        dump("Unhappiness at: " + ex.fileName + ":" + ex.lineNumber + "\n");
        dump("Because: " + ex + "\n");
        dump("**** Async Generator Stack source functions:\n");
        for (let i = asyncGeneratorStack.length - 1; i >= 0; i--) {
          dump("  " + asyncGeneratorStack[i][1] + "\n");
        }
        do_throw(ex);
      }
      asyncGeneratorStack.pop();
    }
  }
  return true;
}

var ASYNC_TEST_RUNNER_HELPERS = [];
/**
 * If you are test helper code using asyncTestUtils, then you might want to
 *  provide a helper object.  We will let you do things after each test
 *  completes, and if a test times out, etc.
 *
 * @param aHelper A helper object which may have the following functions:
 * - postTest: This gets called after each test completes.
 * - onTimeout: This gets called if a test times out.
 */
function async_test_runner_register_helper(aHelper) {
  ASYNC_TEST_RUNNER_HELPERS.push(aHelper);
}

function _async_test_runner_postTest() {
  for each (let [, helper] in Iterator(ASYNC_TEST_RUNNER_HELPERS)) {
    if (helper.postTest)
      helper.postTest();
  }
}

function _async_test_runner_timeout() {
  for each (let [, helper] in Iterator(ASYNC_TEST_RUNNER_HELPERS)) {
    try {
      if (helper.onTimeout)
        helper.onTimeout();
    }
    catch (ex) {
      dump("warning: helper failure: (" + ex.fileName + ":" + ex.lineNumber +
           "): " + ex + "\n");
    }
  }
  do_throw('Timeout running test, and we want you to have the log.');
}

/**
 * Purely decorative function to help explain to people reading lists of tests
 *  using async_run_tests what is going on.  We just return a tuple of our
 *  arguments and _async_test_runner understands what to do with this, namely
 *  to run the test once for each element in the aParameters list.  If the
 *  elements in the aParameters list have a 'name' attribute, it will get
 *  printed out to help figure out what is actually happening.
 */
function parameterizeTest(aTestFunc, aParameters) {
  return [aTestFunc, aParameters];
}

DEFAULT_LONGEST_TEST_RUN_CONCEIVABLE_SECS = 60;
function async_run_tests(aTests, aLongestTestRunTimeConceivableInSecs) {
  if (aLongestTestRunTimeConceivableInSecs == null)
    aLongestTestRunTimeConceivableInSecs =
        DEFAULT_LONGEST_TEST_RUN_CONCEIVABLE_SECS;
  do_timeout(aLongestTestRunTimeConceivableInSecs * 1000,
      "_async_test_runner_timeout();");

  do_test_pending();

  async_run({func: _async_test_runner, args: [aTests]});
}

function _async_test_runner(aTests) {
  for each (let [, test] in Iterator(aTests)) {
    // parameterized?
    if (test.length) {
      let [testFunc, parameters] = test;
      for each (let [, parameter] in Iterator(parameters)) {
        let paramDesc, args;
        if (typeof(parameter) == "object") {
          if (parameter.length) {
            paramDesc = parameter.toString();
            args = parameter;
          }
          else {
            paramDesc = parameter.name;
            args = [parameter];
          }
        }
        else {
          paramDesc = parameter.toString();
          args = [parameter];
        }
        dump("=== Running test: " + testFunc.name + " Parameter: " +
             paramDesc + "\n");
        yield async_run({func: testFunc, args: args});
        _async_test_runner_postTest();
      }

    }
    else {
      dump("=== Running test: " + test.name + "\n");
      yield async_run({func: test});
      _async_test_runner_postTest();
    }
  }

  dump("=== (Done With Tests)\n");
  do_test_finished();
}
