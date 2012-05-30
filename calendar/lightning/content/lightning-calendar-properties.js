/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var common_onLoad = onLoad;
var common_onAcceptDialog = onAcceptDialog;

onLoad = function ltn_onLoad() {
    gCalendar = window.arguments[0].calendar;
    ltnInitMailIdentitiesRow();
    common_onLoad();
};

onAcceptDialog = function ltn_onAcceptDialog() {
    ltnSaveMailIdentitySelection();
    return common_onAcceptDialog();
};
