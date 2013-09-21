/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function FeedItem()
{
  this.mDate = new Date().toString();
  this.mUnicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                           createInstance(Ci.nsIScriptableUnicodeConverter);
  this.mParserUtils = Cc["@mozilla.org/parserutils;1"].
                      getService(Ci.nsIParserUtils);
}

FeedItem.prototype =
{
  // Currently only for IETF Atom.  RSS2 with GUIDs should do this too.
  isStoredWithId: false,
  // Only for IETF Atom.
  xmlContentBase: null,
  id: null,
  feed: null,
  description: null,
  content: null,
  enclosures: [],
  // TO DO: this needs to be localized.
  title: "(no subject)",
  author: "anonymous",
  mURL: null,
  characterSet: "",

  ENCLOSURE_BOUNDARY_PREFIX: "--------------", // 14 dashes
  ENCLOSURE_HEADER_BOUNDARY_PREFIX: "------------", // 12 dashes
  MESSAGE_TEMPLATE: '\n' +
    '<html>\n' +
    '  <head>\n' +
    '    <title>%TITLE%</title>\n' +
    '    <base href="%BASE%">\n' +
    '  </head>\n' +
    '  <body id="msgFeedSummaryBody" selected="false">\n' +
    '    %CONTENT%\n' +
    '  </body>\n' +
    '</html>\n',

  get url()
  {
    return this.mURL;
  },

  set url(aVal)
  {
    try
    {
      this.mURL = Services.io.newURI(aVal, null, null).spec;
    }
    catch(ex)
    {
      // The url as published or constructed can be a non url.  It's used as a
      // feeditem identifier in feeditems.rdf, as a messageId, and as an href
      // and for the content-base header.  Save as is; ensure not null.
      this.mURL = aVal ? aVal : "";
    }
  },

  get date()
  {
    return this.mDate;
  },

  set date (aVal)
  {
    this.mDate = aVal;
  },

  get identity ()
  {
    return this.feed.name + ": " + this.title + " (" + this.id + ")"
  },

  get messageID()
  {
    let messageID = this.id || this.mURL || this.title;

    FeedUtils.log.trace("FeedItem.messageID: id - " + this.id);
    FeedUtils.log.trace("FeedItem.messageID: mURL - " + this.mURL);
    FeedUtils.log.trace("FeedItem.messageID: title - " + this.title);

    // Escape occurrences of message ID meta characters <, >, and @.
    messageID.replace(/</g, "%3C");
    messageID.replace(/>/g, "%3E");
    messageID.replace(/@/g, "%40");
    messageID = messageID + "@" + "localhost.localdomain";

    FeedUtils.log.trace("FeedItem.messageID: messageID - " + messageID);
    return messageID;
  },

  get itemUniqueURI()
  {
    return this.isStoredWithId && this.id ? this.createURN(this.id) :
                                            this.createURN(this.mURL || this.id);
  },

  get contentBase()
  {
    if(this.xmlContentBase)
      return this.xmlContentBase
    else
      return this.mURL;
  },

  store: function()
  {
    this.mUnicodeConverter.charset = this.characterSet;

    // this.title and this.content contain HTML.
    // this.mUrl and this.contentBase contain plain text.

    let stored = false;
    let resource = this.findStoredResource();
    if (resource == null)
    {
      resource = FeedUtils.rdf.GetResource(this.itemUniqueURI);
      if (!this.content)
      {
        FeedUtils.log.trace("FeedItem.store: " + this.identity +
                            " no content; storing");
        this.content = this.description || this.title;
      }

      FeedUtils.log.trace("FeedItem.store: " + this.identity +
                          " store both remote/no content and content items");
      let content = this.MESSAGE_TEMPLATE;
      content = content.replace(/%TITLE%/, this.title);
      content = content.replace(/%BASE%/, this.htmlEscape(this.contentBase));
      content = content.replace(/%CONTENT%/, this.content);
      // XXX store it elsewhere, f.e. this.page.
      this.content = content;
      this.writeToFolder();
      this.markStored(resource);
      stored = true;
    }
    this.markValid(resource);
    return stored;
  },

  findStoredResource: function()
  {
    // Checks to see if the item has already been stored in its feed's
    // message folder.
    FeedUtils.log.trace("FeedItem.findStoredResource: " + this.identity +
                        " checking to see if stored");

    let server = this.feed.server;
    let folder = this.feed.folder;

    if (!folder)
    {
      FeedUtils.log.debug("FeedItem.findStoredResource: " + this.feed.name +
                          " folder doesn't exist; creating as child of " +
                          server.rootMsgFolder.prettyName + "\n");
      this.feed.createFolder();
      FeedUtils.log.debug("FeedItem.findStoredResource: " + this.identity +
                          " not stored (folder didn't exist)");
      return null;
    }

    let ds = FeedUtils.getItemsDS(server);
    let itemURI = this.itemUniqueURI;
    let itemResource = FeedUtils.rdf.GetResource(itemURI);

    let downloaded = ds.GetTarget(itemResource, FeedUtils.FZ_STORED, true);

    // Backward compatibility: we might have stored this item before
    // isStoredWithId has been turned on for RSS 2.0 (bug 354345).
    // Check whether this item has been stored with its URL.
    if (!downloaded && this.mURL && itemURI != this.mURL)
    {
      itemResource = FeedUtils.rdf.GetResource(this.mURL);
      downloaded = ds.GetTarget(itemResource, FeedUtils.FZ_STORED, true);
    }

    // Backward compatibility: the item may have been stored
    // using the previous unique URI algorithm.
    // (bug 410842 & bug 461109)
    if (!downloaded)
    {
      itemResource = FeedUtils.rdf.GetResource((this.isStoredWithId && this.id) ?
                                               ("urn:" + this.id) :
                                               (this.mURL || ("urn:" + this.id)));
      downloaded = ds.GetTarget(itemResource, FeedUtils.FZ_STORED, true);
    }

    if (!downloaded ||
        downloaded.QueryInterface(Ci.nsIRDFLiteral).Value == "false")
    {
      // HACK ALERT: before we give up, try to work around an entity
      // escaping bug in RDF. See Bug #258465 for more details.
      itemURI = itemURI.replace(/&lt;/g, '<');
      itemURI = itemURI.replace(/&gt;/g, '>');
      itemURI = itemURI.replace(/&quot;/g, '"');
      itemURI = itemURI.replace(/&amp;/g, '&');

      FeedUtils.log.trace("FeedItem.findStoredResource: failed to find item," +
                          " trying entity replacement version - " + itemURI);
      itemResource = FeedUtils.rdf.GetResource(itemURI);
      downloaded = ds.GetTarget(itemResource, FeedUtils.FZ_STORED, true);

      if (downloaded)
      {
        FeedUtils.log.trace("FeedItem.findStoredResource: " + this.identity +
                            " stored");
        return itemResource;
      }

      FeedUtils.log.trace("FeedItem.findStoredResource: " + this.identity +
                          " not stored");
      return null;
    }
    else
    {
      FeedUtils.log.trace("FeedItem.findStoredResource: " + this.identity +
                          " stored");
      return itemResource;
    }
  },

  markValid: function(resource)
  {
    let ds = FeedUtils.getItemsDS(this.feed.server);

    let newTimeStamp = FeedUtils.rdf.GetLiteral(new Date().getTime());
    let currentTimeStamp = ds.GetTarget(resource,
                                        FeedUtils.FZ_LAST_SEEN_TIMESTAMP,
                                        true);
    if (currentTimeStamp)
      ds.Change(resource, FeedUtils.FZ_LAST_SEEN_TIMESTAMP,
                currentTimeStamp, newTimeStamp);
    else
      ds.Assert(resource, FeedUtils.FZ_LAST_SEEN_TIMESTAMP,
                newTimeStamp, true);

    if (!ds.HasAssertion(resource, FeedUtils.FZ_FEED,
                         FeedUtils.rdf.GetResource(this.feed.url), true))
      ds.Assert(resource, FeedUtils.FZ_FEED,
                FeedUtils.rdf.GetResource(this.feed.url), true);

    if (ds.hasArcOut(resource, FeedUtils.FZ_VALID))
    {
      let currentValue = ds.GetTarget(resource, FeedUtils.FZ_VALID, true);
      ds.Change(resource, FeedUtils.FZ_VALID,
                currentValue, FeedUtils.RDF_LITERAL_TRUE);
    }
    else
      ds.Assert(resource, FeedUtils.FZ_VALID, FeedUtils.RDF_LITERAL_TRUE, true);
  },

  markStored: function(resource)
  {
    let ds = FeedUtils.getItemsDS(this.feed.server);

    if (!ds.HasAssertion(resource, FeedUtils.FZ_FEED,
                         FeedUtils.rdf.GetResource(this.feed.url), true))
      ds.Assert(resource, FeedUtils.FZ_FEED,
                FeedUtils.rdf.GetResource(this.feed.url), true);

    let currentValue;
    if (ds.hasArcOut(resource, FeedUtils.FZ_STORED))
    {
      currentValue = ds.GetTarget(resource, FeedUtils.FZ_STORED, true);
      ds.Change(resource, FeedUtils.FZ_STORED, 
                currentValue, FeedUtils.RDF_LITERAL_TRUE);
    }
    else
      ds.Assert(resource, FeedUtils.FZ_STORED,
                FeedUtils.RDF_LITERAL_TRUE, true);
  },

  mimeEncodeSubject: function(aSubject, aCharset)
  {
    // This routine sometimes throws exceptions for mis-encoded data so
    // wrap it with a try catch for now.
    let newSubject;
    try
    {
      newSubject = mailServices.mimeConverter.encodeMimePartIIStr_UTF8(aSubject,
                     false,
                     aCharset, 9, 72);
    }
    catch (ex)
    {
      newSubject = aSubject;
    }

    return newSubject;
  },

  writeToFolder: function()
  {
    FeedUtils.log.trace("FeedItem.writeToFolder: " + this.identity +
                        " writing to message folder " + this.feed.name);
    this.mUnicodeConverter.charset = this.characterSet;

    // Convert the title to UTF-16 before performing our HTML entity
    // replacement reg expressions.
    let title = this.title;

    // The subject may contain HTML entities.  Convert these to their unencoded
    // state. i.e. &amp; becomes '&'.
    title = this.mParserUtils.convertToPlainText(
        title,
        Ci.nsIDocumentEncoder.OutputSelectionOnly |
        Ci.nsIDocumentEncoder.OutputAbsoluteLinks,
        0);

    // Compress white space in the subject to make it look better.  Trim
    // leading/trailing spaces to prevent mbox header folding issue at just
    // the right subject length.
    title = title.replace(/[\t\r\n]+/g, " ").trim();

    this.title = this.mimeEncodeSubject(title, this.characterSet);

    // If the date looks like it's in W3C-DTF format, convert it into
    // an IETF standard date.  Otherwise assume it's in IETF format.
    if (this.mDate.search(/^\d\d\d\d/) != -1)
      this.mDate = new Date(this.mDate).toUTCString();

    // Escape occurrences of "From " at the beginning of lines of
    // content per the mbox standard, since "From " denotes a new
    // message, and add a line break so we know the last line has one.
    this.content = this.content.replace(/([\r\n]+)(>*From )/g, "$1>$2");
    this.content += "\n";

    // The opening line of the message, mandated by standards to start
    // with "From ".  It's useful to construct this separately because
    // we not only need to write it into the message, we also need to
    // use it to calculate the offset of the X-Mozilla-Status lines from
    // the front of the message for the statusOffset property of the
    // DB header object.
    let openingLine = 'From - ' + this.mDate + '\n';

    let source =
      openingLine +
      'X-Mozilla-Status: 0000\n' +
      'X-Mozilla-Status2: 00000000\n' +
      'X-Mozilla-Keys:                                                                                \n' +
      'Date: ' + this.mDate + '\n' +
      'Message-Id: <' + this.messageID + '>\n' +
      'From: ' + this.author + '\n' +
      'MIME-Version: 1.0\n' +
      'Subject: ' + this.title + '\n' +
      'Content-Transfer-Encoding: 8bit\n' +
      'Content-Base: ' + this.mURL + '\n';

    if (this.enclosures.length)
    {
      let boundaryID = source.length;
      source += 'Content-Type: multipart/mixed; boundary="' +
                this.ENCLOSURE_HEADER_BOUNDARY_PREFIX + boundaryID + '"' + '\n\n' +
                'This is a multi-part message in MIME format.\n' +
                this.ENCLOSURE_BOUNDARY_PREFIX + boundaryID + '\n' +
                'Content-Type: text/html; charset=' + this.characterSet + '\n' +
                'Content-Transfer-Encoding: 8bit\n' +
                this.content;

      this.enclosures.forEach(function(enclosure) {
        source += enclosure.convertToAttachment(boundaryID);
      });

      source += this.ENCLOSURE_BOUNDARY_PREFIX + boundaryID + '--' + '\n\n\n';
    }
    else
      source += 'Content-Type: text/html; charset=' + this.characterSet + '\n' +
                this.content;

    FeedUtils.log.trace("FeedItem.writeToFolder: " + this.identity +
                        " is " + source.length + " characters long");

    // Get the folder and database storing the feed's messages and headers.
    let folder = this.feed.folder.QueryInterface(Ci.nsIMsgLocalMailFolder);
    let msgFolder = folder.QueryInterface(Ci.nsIMsgFolder);
    msgFolder.gettingNewMessages = true;
    // Source is a unicode string, we want to save a char * string in
    // the original charset. So convert back.
    let msgDBHdr = folder.addMessage(this.mUnicodeConverter.ConvertFromUnicode(source));
    msgDBHdr.OrFlags(Ci.nsMsgMessageFlags.FeedMsg);
    msgFolder.gettingNewMessages = false;
  },

  htmlEscape: function(s)
  {
    s = s.replace(/&/g, "&amp;");
    s = s.replace(/>/g, "&gt;");
    s = s.replace(/</g, "&lt;");
    s = s.replace(/'/g, "&#39;");
    s = s.replace(/"/g, "&quot;");
    return s;
  },

  createURN: function(aName)
  {
    // Returns name as a URN in the 'feeditem' namespace. The returned URN is
    // (or is intended to be) RFC2141 compliant.
    // The builtin encodeURI provides nearly the exact encoding functionality
    // required by the RFC.  The exceptions are that NULL characters should not
    // appear, and that #, /, ?, &, and ~ should be escaped.
    // NULL characters are removed before encoding.

    let name = aName.replace(/\0/g, "");
    let encoded = encodeURI(name);
    encoded = encoded.replace(/\#/g, "%23");
    encoded = encoded.replace(/\//g, "%2f");
    encoded = encoded.replace(/\?/g, "%3f");
    encoded = encoded.replace(/\&/g, "%26");
    encoded = encoded.replace(/\~/g, "%7e");

    return FeedUtils.FZ_ITEM_NS + encoded;
  }
};


// A feed enclosure is to RSS what an attachment is for e-mail.  We make
// enclosures look like attachments in the UI.
function FeedEnclosure(aURL, aContentType, aLength, aTitle)
{
  this.mURL = aURL;
  this.mContentType = aContentType;
  this.mLength = aLength;
  this.mTitle = aTitle;

  // Generate a fileName from the URL.
  if (this.mURL)
  {
    try
    {
      this.mFileName = Services.io.newURI(this.mURL, null, null).
                                   QueryInterface(Ci.nsIURL).
                                   fileName;
    }
    catch(ex)
    {
      this.mFileName = this.mURL;
    }
  }
}

FeedEnclosure.prototype =
{
  mURL: "",
  mContentType: "",
  mLength: 0,
  mFileName: "",
  mTitle: "",
  ENCLOSURE_BOUNDARY_PREFIX: "--------------", // 14 dashes

  // Returns a string that looks like an e-mail attachment which represents
  // the enclosure.
  convertToAttachment: function(aBoundaryID)
  {
    return '\n' +
      this.ENCLOSURE_BOUNDARY_PREFIX + aBoundaryID + '\n' +
      'Content-Type: ' + this.mContentType +
                     '; name="' + (this.mTitle || this.mFileName) +
                     (this.mLength ? '"; size=' + this.mLength : '"') + '\n' +
      'X-Mozilla-External-Attachment-URL: ' + this.mURL + '\n' +
      'Content-Disposition: attachment; filename="' + this.mFileName + '"\n\n' +
      'This MIME attachment is stored separately from the message.\n';
  }
};
