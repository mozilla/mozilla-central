# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla Thunderbird about dialog.
#
# The Initial Developer of the Original Code is
# Blake Ross (blaker@netscape.com).
# Portions created by the Initial Developer are Copyright (C) 2002
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the LGPL or the GPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

function onLoad() {
  document.getElementById("userAgent").value = navigator.userAgent;

  document.documentElement.getButton("extra2").setAttribute("hidden", true);

  document.documentElement.getButton("accept").focus();
#ifdef XP_MACOSX
  // The dialog may not be sized at this point, and we need its width to
  // calculate its position.
  window.sizeToContent();
  window.moveTo((screen.availWidth / 2) - (window.outerWidth / 2),
                screen.availHeight / 5);
#endif
}

function onUnload(aEvent) {
  if (aEvent.target != document)
    return;
  document.getElementById("creditsIframe").setAttribute("src", "");
}

function switchPage(aEvent) {
  let iframe = document.getElementById("creditsIframe");
  let item = aEvent.target;

  // If the user clicked a menuitem, that's the credits option from the menu
  // so switch to the credits page.
  if (item.localName == "menuitem") {
    iframe.setAttribute("src", "chrome://messenger/content/credits.xhtml");

    document.getElementById("aboutMenu").setAttribute("hidden", true);
    document.documentElement.getButton("extra2").removeAttribute("hidden");

    document.getElementById("modes").setAttribute("selectedIndex", 1);
  }
  // If its a button, it is the back button, so switch back to the main page.
  else if (item.localName == "button") {
    iframe.setAttribute("src", "");

    document.getElementById("aboutMenu").removeAttribute("hidden");
    document.documentElement.getButton("extra2").setAttribute("hidden", true);

    document.getElementById("modes").setAttribute("selectedIndex", 0);
  }
}

function loadAbout(type)
{
  let tabmail = document.getElementById("tabmail");
  if (!tabmail) {
    // Try opening new tabs in an existing 3pane window
    let mail3PaneWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                    .getService(Components.interfaces.nsIWindowMediator)
                                    .getMostRecentWindow("mail:3pane");
    if (mail3PaneWindow) {
      tabmail = mail3PaneWindow.document.getElementById("tabmail");
      mail3PaneWindow.focus();
    }
  }

  if (tabmail)
    tabmail.openTab("contentTab", {contentPage: "about:" + type});
  else
    window.openDialog("chrome://messenger/content/", "_blank",
                      "chrome,dialog=no,all", null,
                      { tabType: "contentTab",
                        tabParams: {contentPage: "about:" + type} });
}
