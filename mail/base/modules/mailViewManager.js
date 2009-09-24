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
 * The Original Code is mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Scott MacGregor <mscott@netscape.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Karsten Düsterloh <mnyromyr@tprac.de>
 *   Andrew Sutherland <asutherland@asutherland.org>
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

const EXPORTED_SYMBOLS = ['MailViewManager', 'MailViewConstants'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

var nsMsgSearchScope  = Ci.nsMsgSearchScope;
var nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
var nsMsgSearchOp     = Ci.nsMsgSearchOp;

var nsMsgMessageFlags = Ci.nsMsgMessageFlags;

/**
 * Put the MailViewConstants in an object so we can export them to
 *  msgViewPickerOverlay in one blob without contaminating everyone's address
 *  space who might want to import us.
 */
var MailViewConstants = {
  // tag views have kViewTagMarker + their key as value
  kViewItemAll: 0,
  kViewItemUnread: 1,
  kViewItemTags: 2, // former labels used values 2-6
  kViewItemNotDeleted: 3,
  // not a real view! a sentinel value to pop up a dialog
  kViewItemVirtual: 7,
  // not a real view! a sentinel value to pop up a dialog
  kViewItemCustomize: 8,
  kViewItemFirstCustom: 9,

  kViewCurrent: "current-view",
  kViewCurrentTag: "current-view-tag",
  kViewTagMarker: ":",
};

/**
 * MailViews are view 'filters' implemented using search terms.  DBViewWrapper
 *  uses the SearchSpec class to combine the search terms of the mailview with
 *  those of the virtual folder (if applicable) and the quicksearch (if
 *  applicable).
 */
var MailViewManager = {
  _views: {},
  _customMailViews: Cc["@mozilla.org/messenger/mailviewlist;1"]
                      .getService(Components.interfaces.nsIMsgMailViewList),

  /**
   * Define one of the built-in mail-views.  If you want to define your own
   *  view, you need to define a custom view using nsIMsgMailViewList.
   *
   * We define our own little view definition abstraction because some day this
   *  functionality may want to be generalized to be usable by gloda as well.
   *
   * @param aViewDef The view definition, three attributes are required:
   * - name: A string name for the view, for debugging purposes only.  This
   *         should not be localized!
   * - index: The index to assign to the view.
   * - makeTerms: A function to invoke that returns a list of search terms.
   */
  defineView: function MailViewManager_defineView(aViewDef) {
    this._views[aViewDef.index] = aViewDef;
  },

  /**
   * Wrap a custom view into our cute little view abstraction.  We do not cache
   *  these because views should not change often enough for it to matter from
   *  a performance perspective, but they will change enough to make stale
   *  caches a potential issue.
   */
  _wrapCustomView: function MailViewManager_wrapCustomView(aCustomViewIndex) {
    let mailView = this._customMailViews.getMailViewAt(aCustomViewIndex);
    return {
      name: mailView.prettyName, // since the user created it it's localized
      index: aCustomViewIndex,
      makeTerms: function(aSession, aData) {
        return mailView.searchTerms;
      }
    };
  },

  _findCustomViewByName: function MailViewManager_findCustomViewByName(aName) {
    let count = this._customMailViews.mailViewCount;
    for (let i = 0; i < count; i++) {
      let mailView = this._customMailViews.getMailViewAt(i);
      if (mailView.mailViewName == aName)
        return this._wrapCustomView(i);
    }
    throw Exception("No custom view with name: " + aName);
  },

  /**
   * Return the view definition associated with the given view index.
   *
   * @param aViewIndex If the value is an integer it references the built-in
   *      view with the view index from MailViewConstants, or if the index
   *      is >= MailViewConstants.kViewItemFirstCustom, it is a reference to
   *      a custom view definition.  If the value is a string, it is the name
   *      of a custom view.  The string case is mainly intended for testing
   *      purposes.
   */
  getMailViewByIndex: function MailViewManager_getMailViewByIndex(aViewIndex) {
    if (typeof(aViewIndex) == "string")
      return this._findCustomViewByName(aViewIndex);
    if (aViewIndex < MailViewConstants.kViewItemFirstCustom)
      return this._views[aViewIndex];
    else
      return this._wrapCustomView(aViewIndex -
                                  MailViewConstants.kViewItemFirstCustom);
  },
};

MailViewManager.defineView({
  name: "all mail", // debugging assistance only! not localized!
  index: MailViewConstants.kViewItemAll,
  makeTerms: function(aSession, aData) {
    return null;
  }
});

MailViewManager.defineView({
  name: "new mail / unread", // debugging assistance only! not localized!
  index: MailViewConstants.kViewItemUnread,
  makeTerms: function(aSession, aData) {
    let term = aSession.createTerm();
    let value = term.value;

    value.status = nsMsgMessageFlags.Read;
    value.attrib = nsMsgSearchAttrib.MsgStatus;
    term.value = value;
    term.attrib = nsMsgSearchAttrib.MsgStatus;
    term.op = nsMsgSearchOp.Isnt;
    term.booleanAnd = true;

    return [term];
  }
});

MailViewManager.defineView({
  name: "tags", // debugging assistance only! not localized!
  index: MailViewConstants.kViewItemTags,
  makeTerms: function(aSession, aKeyword) {
    let term = aSession.createTerm();
    let value = term.value;

    value.str = aKeyword;
    value.attrib = nsMsgSearchAttrib.Keywords;
    term.value = value;
    term.attrib = nsMsgSearchAttrib.Keywords;
    term.op = nsMsgSearchOp.Contains;
    term.booleanAnd = true;

    return [term];
  }
});

MailViewManager.defineView({
  name: "not deleted", // debugging assistance only! not localized!
  index: MailViewConstants.kViewItemNotDeleted,
  makeTerms: function(aSession, aKeyword) {
    let term = aSession.createTerm();
    let value = term.value;

    value.status = nsMsgMessageFlags.IMAPDeleted;
    value.attrib = nsMsgSearchAttrib.MsgStatus;
    term.value = value;
    term.attrib = nsMsgSearchAttrib.MsgStatus;
    term.op = nsMsgSearchOp.Isnt;
    term.booleanAnd = true;

    return [term];
  }
});
