/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MILLISECONDS_PER_HOUR   = 60 * 60 * 1000;
const MICROSECONDS_PER_DAY    = 1000 * MILLISECONDS_PER_HOUR * 24;

function onLoad()
{
  var upperDateBox = document.getElementById("upperDate");
  // focus the upper bound control - this is where we expect most users to enter
  // a date
  upperDateBox.focus();

  // and give it an initial date - "yesterday"
  var initialDate = new Date();
  initialDate.setHours( 0 );
  initialDate.setTime( initialDate.getTime() - MILLISECONDS_PER_HOUR );
    // note that this is sufficient - though it is at the end of the previous day,
    // we convert it to a date string, and then the time part is truncated
  upperDateBox.value = convertDateToString( initialDate );
  upperDateBox.select();  // allows to start overwriting immediately
}

function onAccept()
{
  // get the times as entered by the user
  var lowerDateString = document.getElementById( "lowerDate" ).value;
  // the fallback for the lower bound, if not entered, is the "beginning of
  // time" (1970-01-01), which actually is simply 0 :)
  var prLower = lowerDateString ? convertStringToPRTime( lowerDateString ) : 0;

  var upperDateString = document.getElementById( "upperDate" ).value;
  var prUpper;
  if ( upperDateString == "" )
  {
    // for the upper bound, the fallback is "today".
    var dateThisMorning = new Date();
    dateThisMorning.setMilliseconds( 0 );
    dateThisMorning.setSeconds( 0 );
    dateThisMorning.setMinutes( 0 );
    dateThisMorning.setHours( 0 );
    // Javascript time is in milliseconds, PRTime is in microseconds
    prUpper = dateThisMorning.getTime() * 1000;
  }
  else
    prUpper = convertStringToPRTime( upperDateString );

  // for the upper date, we have to do a correction:
  // if the user enters a date, then she means (hopefully) that all messages sent
  // at this day should be marked, too, but the PRTime calculated from this would
  // point to the beginning of the day. So we need to increment it by
  // [number of micro seconds per day]. This will denote the first microsecond of
  // the next day then, which is later used as exclusive boundary
  prUpper += MICROSECONDS_PER_DAY;

  markInDatabase( prLower, prUpper );

  return true;  // allow closing
}

/** marks all headers in the database, whose time is between the two
  given times, as read.
  @param lower
    PRTime for the lower bound - this boundary is inclusive
  @param upper
    PRTime for the upper bound - this boundary is exclusive
*/
function markInDatabase( lower, upper )
{
  var messageFolder;
  var messageDatabase;
  // extract the database
  if ( window.arguments && window.arguments[0] )
  {
    messageFolder = window.arguments[0];
    messageDatabase = messageFolder.msgDatabase;
  }

  if ( !messageDatabase )
  {
    dump( "markByDate::markInDatabase: there /is/ no database to operate on!\n" );
    return;
  }

  // the headers which are going to be marked
  var headers = Components.classes["@mozilla.org/array;1"].createInstance( Components.interfaces.nsIMutableArray );
  var searchSession = Components.classes["@mozilla.org/messenger/searchSession;1"].createInstance( Components.interfaces.nsIMsgSearchSession );
  var searchTerms = Components.classes["@mozilla.org/array;1"].createInstance( Components.interfaces.nsIMutableArray );
  searchSession.addScopeTerm( Components.interfaces.nsMsgSearchScope.offlineMail, messageFolder );

  const nsMsgSearchAttrib = Components.interfaces.nsMsgSearchAttrib;
  const nsMsgSearchOp = Components.interfaces.nsMsgSearchOp;

  var searchTerm = searchSession.createTerm();
  searchTerm.attrib = nsMsgSearchAttrib.Date;
  searchTerm.op = nsMsgSearchOp.IsBefore;
  var value = searchTerm.value;
  value.attrib = nsMsgSearchAttrib.Date;
  value.date = upper;
  searchTerm.value = value;
  searchTerms.appendElement( searchTerm, false );

  if ( lower )
  {
    searchTerm = searchSession.createTerm();
    searchTerm.booleanAnd = true;
    searchTerm.attrib = nsMsgSearchAttrib.Date;
    searchTerm.op = nsMsgSearchOp.IsAfter;
    value = searchTerm.value;
    value.attrib = nsMsgSearchAttrib.Date;
    value.date = lower;
    searchTerm.value = value;
    searchTerms.appendElement( searchTerm, false );
  }

  var filterEnumerator = messageDatabase.getFilterEnumerator( searchTerms );
  
  if ( filterEnumerator )
  {
    var keepGoing;
    var numMatches = {};
    do
    {
      keepGoing = messageDatabase.nextMatchingHdrs(filterEnumerator, 0, 0, headers, numMatches);
    }
    while ( keepGoing );
  }

  if ( headers.length )
    messageFolder.markMessagesRead( headers, true );
}
