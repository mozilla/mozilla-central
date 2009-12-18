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

Components.utils.import("resource://app/modules/errUtils.js");

/**
 * Url listener that can wrap another listener and trigger a callback, but
 *  definitely calls async_driver to resume asynchronous processing.  Use
 *  |asyncUrlListener| if you just need a url listener that resumes processing
 *  without any additional legwork.
 *
 * @param [aWrapped] The nsIUrlListener to pass all notifications through to.
 *     This gets called prior to the callback (or async resumption).
 * @param [aCallback] The callback to call when the URL stops running.  It will
 *     be provided with the same arguments the method receives.  If you need
 *     to do anything non-trivial, you are strongly advised to just use
 *     async_run to push another function/generator function onto the async
 *     stack rather than trying to maintain a convoluted callback mechanism
 *     yourself.
 * @param [aPromise] The promise to notify on completion.  If not specified, we
 *     simply call async_driver instead.
 */
function AsyncUrlListener(aWrapped, aCallback, aPromise) {
  this.wrapped = aWrapped ? aWrapped.QueryInterface(Ci.nsIUrlListener) : null;
  this.callback = aCallback;
  this.promise = aPromise;
}
AsyncUrlListener.prototype = {
  OnStartRunningUrl: function asyncUrlListener_OnStartRunningUrl(
                         aUrl) {
    if (this.wrapped)
      this.wrapped.OnStartRunningUrl(aUrl);
  },
  OnStopRunningUrl: function asyncUrlListener_OnStopRunningUrl(
                         aUrl, aExitCode) {
    if (this.wrapped)
      this.wrapped.OnStopRunningUrl(aUrl, aExitCode);
    if (this.callback)
      this.callback(aUrl, aExitCode);
    if (this.promise)
      this.promise();
    else
      async_driver();
  }
};

/**
 * nsIUrlListener that calls async_driver when the URL stops running.  Pass this
 *  in as an argument to asynchronous native mechanisms that use a URL listener
 *  to notify when they complete.  If you need to wrap an existing listener
 *  and/or have a callback notified before triggering the async process, create
 *  your own instance of |AsyncUrlListener|.
 */
var asyncUrlListener = new AsyncUrlListener();

var asyncCopyListener = {
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aMsgKey) {},
  GetMessageId: function() {},
  OnStopCopy: function(aStatus) {
    async_driver();
  }
};

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
    // Use the timer variant in case the asynchronous sub-call is able to run
    //  to completion.  If we didn't do this, we might end up trying to re-call
    //  into the same generator that is currently active.  We can obviously
    //  make _async_driver more clever to deal with this if we have a reason.
    return async_driver();
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
  return false;
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
        let asyncStack = [];
        dump("*******************************************\n");
        dump("Generator explosion!\n");
        dump("Unhappiness at: " + ex.fileName + ":" + ex.lineNumber + "\n");
        dump("Because: " + ex + "\n");
        dump("Stack:\n  " + ex.stack.replace("\n", "\n  ", "g") + "\n");
        dump("**** Async Generator Stack source functions:\n");
        for (let i = asyncGeneratorStack.length - 1; i >= 0; i--) {
          dump("  " + asyncGeneratorStack[i][1] + "\n");
          asyncStack.push(asyncGeneratorStack[i][1]);
        }
        dump("*********\n");
        logException(ex);
        mark_failure(["Generator explosion. ex:", ex, "async stack",
                      asyncStack]);
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

/**
 * Functions to run after the last test has completed.
 */
var ASYNC_TEST_RUNNER_FINAL_CLEANUP_HELPERS = [];
function async_test_runner_register_final_cleanup_helper(aHelper) {
  ASYNC_TEST_RUNNER_FINAL_CLEANUP_HELPERS.push(aHelper);
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

DEFAULT_LONGEST_TEST_RUN_CONCEIVABLE_SECS = 600;
function async_run_tests(aTests, aLongestTestRunTimeConceivableInSecs) {
  if (aLongestTestRunTimeConceivableInSecs == null)
    aLongestTestRunTimeConceivableInSecs =
        DEFAULT_LONGEST_TEST_RUN_CONCEIVABLE_SECS;
  do_timeout(aLongestTestRunTimeConceivableInSecs * 1000,
      _async_test_runner_timeout);

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
        mark_test_start(testFunc.name, paramDesc);
        yield async_run({func: testFunc, args: args});
        _async_test_runner_postTest();
        mark_test_end();
      }

    }
    else {
      mark_test_start(test.name);
      yield async_run({func: test});
      _async_test_runner_postTest();
      mark_test_end();
    }
  }

  dump("=== (Done With Tests)\n");

  for each (let [, cleanupHelper] in
            Iterator(ASYNC_TEST_RUNNER_FINAL_CLEANUP_HELPERS)) {
    try {
      cleanupHelper();
    }
    catch (ex) {
      mark_failure(["Problem during asyncTestUtils cleanup helper",
                     cleanupHelper.name, "exception:", ex]);
    }
  }

  mark_all_tests_run();

  do_test_finished();
}

var _async_promises = [];
var _waiting_for_async_promises = false;
/**
 * Create an asynchronous promise, which is basically a 'future' where we don't
 *  care about the result value, but we do care about the side-effects.
 * This allows code that does not need to run-to-completion at the time the user
 *  calls it to allow code that depends on it having run to explicitly wait for
 *  its completion.  Rather than bother with actually exposing the promises, we
 *  just have code with such dependencies to call |wait_for_async_promises| to
 *  ensure that all promises have been fulfilled.
 *
 * For a realistic use-case, this allows messageInjection.js' make_empty_folder
 *  to perform an asynchronous operation (the creation of a folder) but not have
 *  to return an asynchronous result indicator.  This simplifies calling code
 *  and avoids complicating the functions that combine make_empty_folder with
 *  other functionality.  The message injection code is where we end up waiting
 *  on the promises (if required).
 */
function async_create_promise() {
  function promise_completed() {
    _async_promises.splice(_async_promises.indexOf(promise_completed), 1);
    if (_waiting_for_async_promises) {
      async_driver();
      _waiting_for_async_promises = false;
    }
  }
  _async_promises.push(promise_completed);

  return promise_completed;
}

/**
 * Wait for all asynchronous promises to have been fulfilled.
 */
function wait_for_async_promises() {
  if (_async_promises.length) {
    _waiting_for_async_promises = true;
    return false;
  }

  return true;
}
