/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsMsgCompose functions relating to listeners.
 */

const MsgComposeContractID = "@mozilla.org/messengercompose/compose;1";
const MsgComposeParamsContractID = "@mozilla.org/messengercompose/composeparams;1";
const nsIMsgCompose = Components.interfaces.nsIMsgCompose;
const nsIMsgComposeParams = Components.interfaces.nsIMsgComposeParams;

var testnum = 0;

function run_test() {
  try {
    var msgCompose = Components.classes[MsgComposeContractID]
                               .createInstance(nsIMsgCompose);

    ++testnum; // Test 1 - Check we can initalize with fewest specified
               // parameters and don't fail/crash like we did in bug 411646

    // Set up some params
    var params = Components.classes[MsgComposeParamsContractID]
                           .createInstance(nsIMsgComposeParams);

    msgCompose.Initialize(null, params);
  }
  catch (e) {
    throw "FAILED in test #" + testnum + ": i is " + i + " : " + e;
  }
};
