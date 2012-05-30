/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var AboutSupportOverlay = {
  openInNewTab: function AboutSupportOverlay_openInNewTab() {
    let tabmail = document.getElementById("tabmail");
    tabmail.openTab("contentTab",
                    {contentPage: "about:support",
                     clickHandler: "specialTabs.aboutClickHandler(event);" });
  }
};
