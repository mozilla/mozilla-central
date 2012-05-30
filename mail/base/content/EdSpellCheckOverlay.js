/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Override openURL to open in a content tab within Thunderbird.
 *
 * @param url the URL to open
 */
function openURL(url) {
  openContentTab(url, "tab", "^https://addons.mozilla.org");
}
