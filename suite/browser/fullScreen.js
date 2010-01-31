/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Joe Hewitt <hewitt@netscape.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

var FullScreen =
{
  toggle: function()
  {
    var show = window.fullScreen;
    // show/hide all menubars, toolbars, and statusbars (except the full screen toolbar)
    this.showXULChrome("toolbar", show);
    this.showXULChrome("statusbar", show);

    var toolbox = getNavToolbox();
    if (show)
      toolbox.removeAttribute("inFullscreen");
    else
      toolbox.setAttribute("inFullscreen", true);

    var controls = document.getElementsByAttribute("fullscreencontrol", "true");
    for (let i = 0; i < controls.length; ++i)
      controls[i].hidden = show;
  },

  showXULChrome: function(aTag, aShow)
  {
    var XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    var els = document.getElementsByTagNameNS(XULNS, aTag);

    var i;
    for (i = 0; i < els.length; ++i) {
      // XXX don't interfere with previously collapsed toolbars
      if (els[i].getAttribute("fullscreentoolbar") == "true") {
        if (!aShow) {
          var toolbarMode = els[i].getAttribute("mode");
          if (toolbarMode != "text") {
            els[i].setAttribute("saved-mode", toolbarMode);
            els[i].setAttribute("saved-iconsize",
                                els[i].getAttribute("iconsize"));
            els[i].setAttribute("mode", "icons");
            els[i].setAttribute("iconsize", "small");
          }

          // XXX See bug 202978: we disable the context menu
          // to prevent customization while in fullscreen, which
          // causes menu breakage.
          els[i].setAttribute("saved-context",
                              els[i].getAttribute("context"));
          els[i].removeAttribute("context");

          // Set the inFullscreen attribute to allow specific styling
          // in fullscreen mode
          els[i].setAttribute("inFullscreen", true);
        }
        else {
          function restoreAttr(attrName) {
            var savedAttr = "saved-" + attrName;
            if (els[i].hasAttribute(savedAttr)) {
              var savedValue = els[i].getAttribute(savedAttr);
              els[i].setAttribute(attrName, savedValue);
              els[i].removeAttribute(savedAttr);
            }
          }

          restoreAttr("mode");
          restoreAttr("iconsize");
          restoreAttr("context"); // XXX see above

          els[i].removeAttribute("inFullscreen");
        }
      } else if (els[i].getAttribute("type") == "menubar") {
        if (aShow)
          els[i].removeAttribute("autohide");
        else
          els[i].setAttribute("autohide", "true");
      } else {
        // use moz-collapsed so it doesn't persist hidden/collapsed,
        // so that new windows don't have missing toolbars
        if (aShow)
          els[i].removeAttribute("moz-collapsed");
        else
          els[i].setAttribute("moz-collapsed", "true");
      }
    }
  }

};
