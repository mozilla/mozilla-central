/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

/**
 * This module handles migrating mail-specific preferences, etc. Migration has
 * traditionally been a part of msgMail3PaneWindow.js, but separating the code
 * out into a module makes unit testing much easier.
 */

var EXPORTED_SYMBOLS = ["MailMigrator"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/XPCOMUtils.jsm");

var MailMigrator = {
  /**
   * Switch the given fonts to the given encodings, but only if the current fonts
   * are defaults.
   */
  _switchDefaultFonts: function MailMigrator__switchDefaultFonts(aFonts,
                                                                 aEncodings) {
    for each (let [, encoding] in Iterator(aEncodings)) {
      let serifPref = "font.name.serif." + encoding;
      let sansPref = "font.name.sans-serif." + encoding;
      let variableSizePref = "font.size.variable." + encoding;
      // This is expected to be one of sans-serif or serif, and determines what
      // we'll link the variable font size to.
      let isSansDefault = this._prefBranch.getCharPref("font.default." + encoding) ==
                            "sans-serif";

      if (!this._prefBranch.prefHasUserValue(serifPref)) {
        this._prefBranch.setCharPref(serifPref, aFonts.serif);
        if (!isSansDefault)
          this._prefBranch.setIntPref(variableSizePref, aFonts.variableSize);
      }

      if (!this._prefBranch.prefHasUserValue(sansPref)) {
        this._prefBranch.setCharPref(sansPref, aFonts.sans);
        if (isSansDefault)
          this._prefBranch.setIntPref(variableSizePref, aFonts.variableSize);
      }

      let monospacePref = "font.name.monospace." + encoding;
      let fixedSizePref = "font.size.fixed." + encoding;
      if (!this._prefBranch.prefHasUserValue(monospacePref)) {
        this._prefBranch.setCharPref(monospacePref, aFonts.monospace);
        this._prefBranch.setIntPref(fixedSizePref, aFonts.fixedSize);
      }
    }
  },

  /**
   * Migrate to ClearType fonts (Cambria, Calibri and Consolas) on Windows Vista
   * and above.
   */
  migrateToClearTypeFonts: function MailMigrator_migrateToClearTypeFonts() {
    // Windows...
    if ("@mozilla.org/windows-registry-key;1" in Components.classes) {
      // Only migrate on Vista (Windows version 6.0) and above
      let sysInfo = Cc["@mozilla.org/system-info;1"]
                      .getService(Ci.nsIPropertyBag2);
      if (sysInfo.getPropertyAsDouble("version") >= 6.0) {
        let fontPrefVersion =
          this._prefBranch.getIntPref("mail.font.windows.version");
        if (!fontPrefVersion) {
          let fonts = {
            serif: "Cambria",
            sans: "Calibri",
            monospace: "Consolas",
            variableSize: 17,
            fixedSize: 14,
          };
          // Encodings to switch to the new fonts for.
          let encodings = ["x-unicode", "x-western"];

          this._switchDefaultFonts(fonts, encodings);

          this._prefBranch.setIntPref("mail.font.windows.version", 1);
        }
      }
    }
  },

  /**
   * Migrate whatever is defined in this module.
   */
  migrateMail: function MailMigrator_migrateMail() {
    this.migrateToClearTypeFonts();
  }
};

XPCOMUtils.defineLazyServiceGetter(MailMigrator, "_prefBranch",
                                   "@mozilla.org/preferences-service;1",
                                   "nsIPrefBranch");
