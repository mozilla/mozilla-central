/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var common_initCustomizePage = initCustomizePage;
var common_doCreateCalendar = doCreateCalendar;

initCustomizePage = function ltn_initCustomizePage() {
    common_initCustomizePage();
    ltnInitMailIdentitiesRow();
};

doCreateCalendar = function ltn_doCreateCalendar() {
    common_doCreateCalendar();
    ltnSaveMailIdentitySelection();
    return true;
};

