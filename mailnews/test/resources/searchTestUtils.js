/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 
 // Contains various functions commonly used in testing mailnews search

/**
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
 * @param aCustomId: id string for the custom action, if aAttrib is Custom
 * @param aArbitraryHeader  for OtherHeader case, header.
 * @param aHdrProperty      for HdrProperty and Uint32HdrProperty case
 *
 */

function TestSearch(aFolder, aValue, aAttrib, aOp, aHitCount, onDone, aCustomId,
                    aArbitraryHeader, aHdrProperty)
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
  else if (aAttrib == Ci.nsMsgSearchAttrib.MsgStatus ||
           aAttrib == Ci.nsMsgSearchAttrib.FolderFlag ||
           aAttrib == Ci.nsMsgSearchAttrib.Uint32HdrProperty)
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
  if (aAttrib == Ci.nsMsgSearchAttrib.Custom)
    searchTerm.customId = aCustomId;
  else if (aAttrib == Ci.nsMsgSearchAttrib.OtherHeader)
    searchTerm.arbitraryHeader = aArbitraryHeader;
  else if (aAttrib == Ci.nsMsgSearchAttrib.HdrProperty ||
           aAttrib == Ci.nsMsgSearchAttrib.Uint32HdrProperty)
    searchTerm.hdrProperty = aHdrProperty;

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
