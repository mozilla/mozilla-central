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
 * The Original Code is the Thunderbird Feature Configurator.
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://app/modules/errUtils.js");
Cu.import("resource://gre/modules/iteratorUtils.jsm");
Cu.import("resource://gre/modules/DownloadUtils.jsm");

var gPrefBranch = Cc["@mozilla.org/preferences-service;1"]
                    .getService(Ci.nsIPrefBranch);


var ToolbarConfigurator = {
  /**
   * Set the sync preferences based on the radio buttons.
   *
   * @param aSyncStatus the requested sync status.
   */
  useNewToolbar: function tb_useNewToolbar(aUseNew) {
    try {
      if (!aUseNew) {
        // We want the customized one, or if it doesn't exist, the old one.
        let currentset = this.newbar.hasAttribute("prev-currentset") ?
                           this.newbar.getAttribute("prev-currentset") :
                           this.fakebar.getAttribute("currentset");
        if (currentset.trim() == "")
          currentset = this.fakebar.getAttribute("defaultset")
        let bits = currentset.split(",");
        // mail-bar2 could have "search-container", "gloda-search", or both.
        // We don't want both, we can only support one (and it has to be
        // "gloda-search").
        let foundSearch = false;
        let newbits = [];
        for each (let [, bit] in Iterator(bits)) {
          switch (bit) {
            case "search-container":
            case "gloda-search":
              newbits.push("gloda-search");
              foundSearch = true;
              break;
            default:
              newbits.push(bit);
          }
        }
        let newcurrentset = newbits.join(",");
        // this makes it show up
        this.newbar.currentSet = newcurrentset;
        // this makes it persist…
        this.newbar.setAttribute("currentset", newcurrentset);
        labelalign = this.newbar.hasAttribute("prev-labelalign") ?
                       this.newbar.getAttribute("prev-labelalign") :
                       this.fakebar.hasAttribute("labelalign") ?
                         this.fakebar.getAttribute("labelalign") :
                         "bottom";
        this.newbar.parentNode.setAttribute("labelalign", labelalign);

        let iconsize = this.newbar.hasAttribute("prev-iconsize") ?
                         this.newbar.getAttribute("prev-iconsize") :
                         this.fakebar.hasAttribute("iconsize") ?
                           this.fakebar.getAttribute("iconsize") :
                           "large";
        this.newbar.setAttribute("iconsize", iconsize);

        iconsize = this.newbar.hasAttribute("prev-parenticonsize") ?
                     this.newbar.getAttribute("prev-parenticonsize") :
                     this.fakebar.hasAttribute("parenticonsize") ?
                       this.fakebar.getAttribute("parenticonsize") :
                       "large";
        this.newbar.parentNode.setAttribute("iconsize", iconsize);
      }
      else {
        // Save off what we currently have to the fakebar, in case the user
        // customized it.
        this.newbar.setAttribute("prev-currentset",
                                 this.newbar.getAttribute("currentset"));
        this.newbar.setAttribute("prev-labelalign",
                                 this.newbar.parentNode
                                     .getAttribute("labelalign"));
        this.newbar.setAttribute("prev-iconsize",
                                 this.newbar.getAttribute("iconsize"));
        this.newbar.setAttribute("prev-parenticonsize",
                                 this.newbar.parentNode
                                     .getAttribute("iconsize"));

        // reset to factory defaults (TB3)
        let defaultset = this.newbar.getAttribute("defaultset")
        // this makes it show up
        this.newbar.currentSet = defaultset;
        // this makes it persist ...
        this.newbar.setAttribute("currentset", defaultset);
        this.newbar.parentNode.setAttribute("labelalign", "end");
        if (Application.platformIsMac) {
          this.newbar.setAttribute("iconsize", "small");
          this.newbar.parentNode.setAttribute("iconsize", "small");
        }
        else {
          this.newbar.setAttribute("iconsize", "large");
          this.newbar.parentNode.setAttribute("iconsize", "large");
        }
      }
      this.dom.persist("mail-bar3", "currentset");
      parent.gSubpageData.isNewToolbar = aUseNew;
    } catch (e) {
      logException(e);
    }
  },

  onLoad: function tb_onLoad() {
    let self = this;

    this.dom = parent.gSubpageData.dom;
    this.fakebar = parent.gSubpageData.fakebar;
    this.newbar = parent.gSubpageData.newbar;

    if (parent.gSubpageData.isNewToolbar)
      $("#toolbar-new").attr("checked", true);
    else
      $("#toolbar-original").attr("checked", true);

    $("input[name='toolbar']").change(function() {
      self.useNewToolbar($(this).val() == "new");
    });
  },
}
