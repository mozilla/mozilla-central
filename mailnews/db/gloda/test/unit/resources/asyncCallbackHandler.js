/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Implements GlodaIndexer._callbackHandle's interface adapted to our async
 *  test driver.  This allows us to run indexing workers directly in tests
 *  or support code.
 *
 * We do not do anything with the context stack or recovery.  Use the actual
 *  indexer callback handler for that!
 *
 * Actually, we do very little at all right now.  This will fill out as needs
 *  arise.
 */
let asyncCallbackHandle = {
  pushAndGo: function asyncCallbackHandle_push(aIterator, aContext) {
    asyncGeneratorStack.push([
      _asyncCallbackHandle_glodaWorkerAdapter(aIterator),
      "callbackHandler pushAndGo"]);
    return async_driver();
  }
};

function _asyncCallbackHandle_glodaWorkerAdapter(aIter) {
  while(true) {
    switch(aIter.next()) {
      case GlodaIndexer.kWorkSync:
        yield true;
        break;
      case GlodaIndexer.kWorkDone:
      case GlodaIndexer.kWorkDoneWithResult:
        return;
      default:
        yield false;
        break;
    }
  }
}
