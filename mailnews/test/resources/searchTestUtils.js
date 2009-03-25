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
 * Kent James <kent@caspia.com>.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
 
 // Contains various functions commonly used in testing mailnews search

/*
 * TestSearch: Class to test number of search hits
 *
 * @param aFolder:   the folder to search
 * @param aValue:    value used for the search
 *                   The interpretation of aValue depends on aAttrib. It
 *                   defaults to string, but for certain attributes other
 *                   types are used.
 *                   WARNING: not all attributes have been tested.
 *
 * @param aAttrib:   attribute for the search (Ci.nsMsgSearchAttrib.Size, etc.)
 * @param aOp:       operation for the search (Ci.nsMsgSearchOp.Contains, etc.)
 * @param aHitCount: expected number of search hits
 * @param onDone:    function to call on completion of search
 *
 */

function TestSearch(aFolder, aValue, aAttrib, aOp, aHitCount, onDone)
{
  var searchListener =
  { 
    onSearchHit: function(dbHdr, folder) { hitCount++; },
    onSearchDone: function(status)
    { 
      print("Finished search does " + aHitCount + " equal " + hitCount + "?");
      searchSession = null;
      do_check_eq(aHitCount, hitCount);
      if (onDone)
        onDone();
    },
    onNewSearch: function() {hitCount = 0;}
  };

  // define and initiate the search session
  
  var hitCount;
  var searchSession = Cc["@mozilla.org/messenger/searchSession;1"]
                        .createInstance(Ci.nsIMsgSearchSession);
  searchSession.addScopeTerm(Ci.nsMsgSearchScope.offlineMail, aFolder);
  var searchTerm = searchSession.createTerm();
  searchTerm.attrib = aAttrib;
  
  var value = searchTerm.value;
  // This is tricky - value.attrib must be set before actual values
  value.attrib = aAttrib;
  if (aAttrib == Ci.nsMsgSearchAttrib.JunkPercent)
    value.junkPercent = aValue;
  else if (aAttrib == Ci.nsMsgSearchAttrib.Priority)
    value.priority = aValue;
  else if (aAttrib == Ci.nsMsgSearchAttrib.Date)
    value.date = aValue;
  else if (aAttrib == Ci.nsMsgSearchAttrib.MsgStatus)
    value.status = aValue;
  else if (aAttrib == Ci.nsMsgSearchAttrib.MessageKey)
    value.msgKey = aValue;
  else if (aAttrib == Ci.nsMsgSearchAttrib.Size)
    value.size = aValue;
  else if (aAttrib == Ci.nsMsgSearchAttrib.AgeInDays)
    value.age = aValue;
  else if (aAttrib == Ci.nsMsgSearchAttrib.Size)
    value.size = aValue;
  else if (aAttrib == Ci.nsMsgSearchAttrib.Label)
    value.label = aValue;
  else if (aAttrib == Ci.nsMsgSearchAttrib.JunkStatus)
    value.junkStatus = aValue;
  else if (aAttrib == Ci.nsMsgSearchAttrib.HasAttachmentStatus)
    value.status = Ci.nsMsgMessageFlags.Attachment;
  else
    value.str = aValue;
  searchTerm.value = value;
  searchTerm.op = aOp;
  searchTerm.booleanAnd = false;
  searchSession.appendTerm(searchTerm);
  searchSession.registerListener(searchListener);
  searchSession.search(null);
}

/*
 * Test search validity table Available and Enabled settings
 *
 * @param aScope:  search scope (Ci.nsMsgSearchScope.offlineMail, etc.)
 * @param aOp:     search operation (Ci.nsMsgSearchOp.Contains, etc.)
 * @param aAttrib: search attribute (Ci.nsMsgSearchAttrib.Size, etc.)
 * @param aValue:  expected value (true/false) for Available and Enabled
 */
 const gValidityManager = Cc['@mozilla.org/mail/search/validityManager;1']
                          .getService(Ci.nsIMsgSearchValidityManager);

function testValidityTable(aScope, aOp, aAttrib, aValue)
{
  var validityTable = gValidityManager.getTable(aScope);
  var isAvailable = validityTable.getAvailable(aAttrib, aOp);
  var isEnabled = validityTable.getEnabled(aAttrib, aOp);
  if (aValue)
  {
    do_check_true(isAvailable);
    do_check_true(isEnabled);
  }
  else
  {
    do_check_false(isAvailable);
    do_check_false(isEnabled);
  }
}
