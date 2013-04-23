/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/XPCOMUtils.jsm");

const HINT_EXACT_MATCH = Components.interfaces.calICalendarSearchProvider.HINT_EXACT_MATCH;
let search = Components.classes["@mozilla.org/calendar/calendarsearch-service;1"]
                       .getService(Components.interfaces.calICalendarSearchService);

function run_test() {
    test_found();
    test_failure();
    test_cancel();
}

function test_found() {
    search.getProviders({}).forEach(search.removeProvider, search);

    do_check_eq(search.getProviders({}).length, 0);

    let provider1 = {
        id: 1,
        searchForCalendars: function() {}
    };

    let provider2 = {
        id: 2,
        called: false,
        searchForCalendars: function(aStr, aHint, aMax, aListener) {
            do_check_false(this.called)
            this.called = true;

            do_check_eq(aStr, "str");
            do_check_eq(aHint, HINT_EXACT_MATCH);
            do_check_eq(aMax, 0);

            let mockCalendar = {
                id: "test"
            };

            aListener.onResult(null, [mockCalendar]);
        }
    };
    provider2.wrappedJSObject = provider2;

    search.addProvider(provider1);
    do_check_eq(search.getProviders({}).length, 1);
    search.addProvider(provider2);
    do_check_eq(search.getProviders({}).length, 2);
    search.removeProvider(provider1);
    do_check_eq(search.getProviders({}).length, 1);
    do_check_eq(search.getProviders({})[0].wrappedJSObject.id, 2);

    let listener = {
        called: false,
        onResult: function(request, result) {
            do_check_false(this.called);
            this.called = true;

            do_check_eq(result.length, 1);
            do_check_eq(result[0].id, "test");

        }
    };

    let op = search.searchForCalendars("str", HINT_EXACT_MATCH, 0, listener);
    do_check_true(listener.called);
    do_check_true(provider2.called);
}

function test_failure() {
    search.getProviders({}).forEach(search.removeProvider, search);

    let provider = {
        searchForCalendars: function(aStr, aHint, aMax, aListener) {
            throw "error";
        }
    };

    let listener = {
        called: false,
        onResult: function(request, result) {
            do_check_false(this.called);
            this.called = true;
            do_check_eq(result.length, 0);
        }
    };

    search.addProvider(provider);

    let op = search.searchForCalendars("str", HINT_EXACT_MATCH, 0, listener);
    do_check_true(listener.called);
}

function test_cancel() {
    search.getProviders({}).forEach(search.removeProvider, search);

    let provider = {
        QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calICalendarSearchProvider, Components.interfaces.calIOperation]),
        searchForCalendars: function(aStr, aHint, aMax, aListener) {

            Services.tm.currentThread.dispatch({run: function() {
                dump("Cancelling search...");
                op.cancel();
            }}, Components.interfaces.nsIEventTarget.DISPATCH_NORMAL);

            // No listener call, we emulate a long running search
            // Do return the operation though
            return this;
        },

        isPending: true,
        cancelCalled: false,
        status: Components.results.NS_OK,
        cancel: function() {
            this.cancelCalled = true;
        },
    };

    let listener = {
        called: false,
        onResult: function(request, result) {
            do_check_eq(result, null);

            // If an exception occurs, the operation is not added to the opgroup
            do_check_false(provider.cancelCalled);
            do_test_finished();
        }
    };

    search.addProvider(provider);

    do_test_pending();
    let op = search.searchForCalendars("str", HINT_EXACT_MATCH, 0, listener);
}
