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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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

EXPORTED_SYMBOLS = ['GlodaExplicitAttr'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");

Cu.import("resource://gloda/modules/utils.js");
Cu.import("resource://gloda/modules/gloda.js");

const EXT_BUILTIN = "built-in";
const FA_TAG = "TAG";
const FA_STAR = "STAR";
const FA_READ = "READ";

/**
 * The Gloda Fundamental Attribute provider is a special-case attribute
 *  provider; it provides attributes that the rest of the providers should be
 *  able to assume exist.  Also, it may end up accessing things at a lower level
 *  than most extension providers should do.  In summary, don't mimic this code
 *  unless you won't complain when your code breaks.
 */
let GlodaExplicitAttr = {
  _log: null,

  _init: function gloda_explattr_init() {
    this._log =  Log4Moz.Service.getLogger("gloda.explattr");
  
    try {
      this.defineAttributes();
    }
    catch (ex) {
      this._log.error("Error in init: " + ex);
      throw ex;
    }
  },

  _attrTag: null,
  _attrStar: null,
  _attrRead: null,
  
  defineAttributes: function() {
    // Tag
    this._attrTag = Gloda.defineAttr(this, Gloda.kAttrExplicit,
                        Gloda.BUILT_IN, FA_TAG,
                        Gloda.NOUN_MESSAGE, Gloda.NOUN_DATE, Gloda.NOUN_TAG,
                        "%{subject} was tagged %{parameter} on %{object}");
    // Star
    this._attrStar = Gloda.defineAttr(this, Gloda.kAttrExplicit,
                        Gloda.BUILT_IN, FA_STAR,
                        Gloda.NOUN_MESSAGE, Gloda.NOUN_BOOLEAN, null,
                        "%{subject} has a star state of %{object}");
    // Read/Unread
    this._attrRead = Gloda.defineAttr(this, Gloda.kAttrExplicit,
                        Gloda.BUILT_IN, FA_READ,
                        Gloda.NOUN_MESSAGE, Gloda.NOUN_BOOLEAN, null,
                        "%{subject} has a read state of %{object}");
    
  },
  
  process: function Gloda_explattr_process(aGlodaMessage, aMsgHdr) {
    let attribs = [];
    
    // -- Tag
    let keywords = aMsgHdr.getStringProperty("keywords");
    
    return attribs;
  },
};
GlodaExplicitAttr._init();
