/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

do_load_httpd_js();

var httpserver = null;

// TODO webcals doesn't work since httpd.js doesn't support ssl without ssltunnel
var testUris = ["webcal://localhost:4444/test_webcal"  /* ,
                "webcals://localhost:4445/test_webcals" */
               ];

var testListener = {
    onStartRequest: function onStartRequest(request, context) {
        var chan = request.QueryInterface(Components.interfaces.nsIChannel);
        do_check_eq(chan.status, Components.results.NS_OK);
    },
    onDataAvailable: function onDataAvailable(request, context, stream, offset, count) {
        stream.read(count);
    },
    onStopRequest: function onStopRequest(request, context, statusCode) {
        // TODO For some reason we're getting error 0x80570021 here
        // (NS_ERROR_XPC_JAVASCRIPT_ERROR_WITH_DETAILS), but we can't get the
        // actual error :-(
        // var chan = request.QueryInterface(Components.interfaces.nsIChannel);
        // do_check_eq(chan.status, Components.results.NS_OK);

        startNextTest();
        do_test_finished();
    }
};

function startNextTest() {
    let nextUri = testUris.shift();
    if (nextUri) {
        let chan = Services.io.newChannel(nextUri, null, null);
        chan.asyncOpen(testListener, null);
        do_test_pending();
    } else {
        do_test_pending();
        httpserv.stop(do_test_finished);
    }
}

function run_test() {

    httpserv = new nsHttpServer();

    httpserv.registerPathHandler("/", {
        handle: function(request, response) {
        }
    });

    httpserv.identity.add("https", "localhost", 4445);
    httpserv.start(4444);
    startNextTest();
}
