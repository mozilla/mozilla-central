/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
        let chan = cal.getIOService().newChannel(nextUri, null, null);
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
