/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * A list of first names for use by MessageGenerator to create deterministic,
 *  reversible names.  To keep things easily reversible, if you add names, make
 *  sure they have no spaces in them!
 */
const FIRST_NAMES = [
  "Andy", "Bob", "Chris", "David", "Emily", "Felix",
  "Gillian", "Helen", "Idina", "Johnny", "Kate", "Lilia",
  "Martin", "Neil", "Olof", "Pete", "Quinn", "Rasmus",
  "Sarah", "Troels", "Ulf", "Vince", "Will", "Xavier",
  "Yoko", "Zig"
  ];

/**
 * A list of last names for use by MessageGenerator to create deterministic,
 *  reversible names.  To keep things easily reversible, if you add names, make
 *  sure they have no spaces in them!
 */
const LAST_NAMES = [
  "Anway", "Bell", "Clarke", "Davol", "Ekberg", "Flowers",
  "Gilbert", "Hook", "Ivarsson", "Jones", "Kurtz", "Lowe",
  "Morris", "Nagel", "Orzabal", "Price", "Quinn", "Rolinski",
  "Stanley", "Tennant", "Ulvaeus", "Vannucci", "Wiggs", "Xavier",
  "Young", "Zig"
  ];

/**
 * A list of adjectives used to construct a deterministic, reversible subject
 *  by MessageGenerator.  To keep things easily reversible, if you add more,
 *  make sure they have no spaces in them!  Also, make sure your additions
 *  don't break the secret Monty Python reference!
 */
const SUBJECT_ADJECTIVES = [
  "Big", "Small", "Huge", "Tiny",
  "Red", "Green", "Blue", "My",
  "Happy", "Sad", "Grumpy", "Angry",
  "Awesome", "Fun", "Lame", "Funky",
  ];

/**
 * A list of nouns used to construct a deterministic, reversible subject
 *  by MessageGenerator.  To keep things easily reversible, if you add more,
 *  make sure they have no spaces in them!  Also, make sure your additions
 *  don't break the secret Monty Python reference!
 */
const SUBJECT_NOUNS = [
  "Meeting", "Party", "Shindig", "Wedding",
  "Document", "Report", "Spreadsheet", "Hovercraft",
  "Aardvark", "Giraffe", "Llama", "Velociraptor",
  "Laser", "Ray-Gun", "Pen", "Sword",
  ];

/**
 * A list of suffixes used to construct a deterministic, reversible subject
 *  by MessageGenerator.  These can (clearly) have spaces in them.  Make sure
 *  your additions don't break the secret Monty Python reference!
 */
const SUBJECT_SUFFIXES = [
  "Today", "Tomorrow", "Yesterday", "In a Fortnight",
  "Needs Attention", "Very Important", "Highest Priority", "Full Of Eels",
  "In The Lobby", "On Your Desk", "In Your Car", "Hiding Behind The Door",
  ];

/**
 * Base class for MIME Part representation.
 */
function SyntheticPart(aProperties) {
  if (aProperties) {
    if ("contentType" in aProperties)
      this._contentType = aProperties.contentType;
    if ("charset" in aProperties)
      this._charset = aProperties.charset;
    if ("format" in aProperties)
      this._format = aProperties.format;
    if ("filename" in aProperties)
      this._filename = aProperties.filename;
    if ("boundary" in aProperties)
      this._boundary = aProperties.boundary;
    if ("encoding" in aProperties)
      this._encoding = aProperties.encoding;
    if ("contentId" in aProperties)
      this._contentId = aProperties.contentId;
    if ("disposition" in aProperties)
      this._forceDisposition = aProperties.disposition;
    if ("extraHeaders" in aProperties)
      this._extraHeaders = aProperties.extraHeaders;
  }
}
SyntheticPart.prototype = {
  _forceDisposition: null,
  get contentTypeHeaderValue() {
    let s = this._contentType;
    if (this._charset)
      s += '; charset=' + this._charset;
    if (this._format)
      s += '; format=' + this._format;
    if (this._filename)
      s += ';\r\n name="' + this._filename +'"';
    if (this._contentTypeExtra) {
      for (let [key, value] in Iterator(this._contentTypeExtra))
        s += ';\r\n ' + key + '="' + value + '"';
    }
    if (this._boundary)
      s += ';\r\n boundary="' + this._boundary + '"';
    return s;
  },
  get hasTransferEncoding() {
    return this._encoding;
  },
  get contentTransferEncodingHeaderValue() {
    return this._encoding;
  },
  get hasDisposition() {
    return this._forceDisposition || this._filename;
  },
  get contentDispositionHeaderValue() {
    let s = '';
    if (this._forceDisposition)
      s += this._forceDisposition;
    else if (this._filename)
      s += 'attachment;\r\n filename="' + this._filename + '"';
    return s;
  },
  get hasContentId() {
    return this._contentId;
  },
  get contentIdHeaderValue() {
    return '<' + this._contentId + '>';
  },
  get hasExtraHeaders() {
    return this._extraHeaders;
  },
  get extraHeaders() {
    return this._extraHeaders;
  },
};

/**
 * Leaf MIME part, defaulting to text/plain.
 */
function SyntheticPartLeaf(aBody, aProperties) {
  SyntheticPart.call(this, aProperties);
  this.body = aBody;
}
SyntheticPartLeaf.prototype = {
  __proto__: SyntheticPart.prototype,
  _contentType: 'text/plain',
  _charset: 'ISO-8859-1',
  _format: 'flowed',
  _encoding: '7bit',
  toMessageString: function() {
    return this.body;
  },
  prettyString: function MimeMessage_prettyString(aIndent) {
    return "Leaf: " + this._contentType;
  },
};

/**
 * A part that tells us to produce NO output in a multipart section.  So if our
 *  separator is "--BOB", we might produce "--BOB\n--BOB--\n" instead of having
 *  some headers and actual content in there.
 * This is not a good idea and probably not legal either, but it happens and
 *  we need to test for it.
 */
function SyntheticDegeneratePartEmpty() {
}
SyntheticDegeneratePartEmpty.prototype = {
  prettyString: function SyntheticDegeneratePartEmpty_prettyString(aIndent) {
    return "Degenerate Empty Part";
  }
};

/**
 * Multipart (multipart/*) MIME part base class.
 */
function SyntheticPartMulti(aParts, aProperties) {
  SyntheticPart.call(this, aProperties);

  this._boundary = '--------------CHOPCHOP' + this.BOUNDARY_COUNTER;
  this.BOUNDARY_COUNTER_HOME.BOUNDARY_COUNTER += 1;
  this.parts = (aParts != null) ? aParts : [];
}
SyntheticPartMulti.prototype = {
  __proto__: SyntheticPart.prototype,
  BOUNDARY_COUNTER: 0,
  toMessageString: function() {
    let s = "This is a multi-part message in MIME format.\r\n";
    for (let [,part] in Iterator(this.parts)) {
      s += "--" + this._boundary + "\r\n";
      if (part instanceof SyntheticDegeneratePartEmpty)
        continue;
      s += "Content-Type: " + part.contentTypeHeaderValue + '\r\n';
      if (part.hasTransferEncoding)
        s += 'Content-Transfer-Encoding: ' +
             part.contentTransferEncodingHeaderValue + '\r\n';
      if (part.hasDisposition)
        s += 'Content-Disposition: ' + part.contentDispositionHeaderValue +
             '\r\n';
      if (part.hasContentId)
        s += 'Content-ID: ' + part.contentIdHeaderValue + '\r\n';
      if (part.hasExtraHeaders)
        for each (let [k, v] in Iterator(part.extraHeaders))
          s += k + ': ' + v + '\r\n';
      s += '\r\n';
      s += part.toMessageString() + '\r\n\r\n';
    }
    s += "--" + this._boundary + '--';
    return s;
  },
  prettyString: function(aIndent) {
    let nextIndent = (aIndent != null) ? (aIndent + "  ") : "";

    let s = "Container: " + this._contentType;

    for (let iPart = 0; iPart < this.parts.length; iPart++) {
      let part = this.parts[iPart];
      s += "\n" + nextIndent + (iPart+1) + " " + part.prettyString(nextIndent);
    }

    return s;
  }
};
SyntheticPartMulti.prototype.BOUNDARY_COUNTER_HOME = SyntheticPartMulti.prototype;

/**
 * Multipart mixed (multipart/mixed) MIME part.
 */
function SyntheticPartMultiMixed() {
  SyntheticPartMulti.apply(this, arguments);
}
SyntheticPartMultiMixed.prototype = {
  __proto__: SyntheticPartMulti.prototype,
  _contentType: 'multipart/mixed',
};

/**
 * Multipart mixed (multipart/mixed) MIME part.
 */
function SyntheticPartMultiParallel() {
  SyntheticPartMulti.apply(this, arguments);
}
SyntheticPartMultiParallel.prototype = {
  __proto__: SyntheticPartMulti.prototype,
  _contentType: 'multipart/parallel',
};

/**
 * Multipart digest (multipart/digest) MIME part.
 */
function SyntheticPartMultiDigest() {
  SyntheticPartMulti.apply(this, arguments);
}
SyntheticPartMultiDigest.prototype = {
  __proto__: SyntheticPartMulti.prototype,
  _contentType: 'multipart/digest',
};

/**
 * Multipart alternative (multipart/alternative) MIME part.
 */
function SyntheticPartMultiAlternative() {
  SyntheticPartMulti.apply(this, arguments);
}
SyntheticPartMultiAlternative.prototype = {
  __proto__: SyntheticPartMulti.prototype,
  _contentType: 'multipart/alternative',
};

/**
 * Multipart related (multipart/related) MIME part.
 */
function SyntheticPartMultiRelated() {
  SyntheticPartMulti.apply(this, arguments);
}
SyntheticPartMultiRelated.prototype = {
  __proto__: SyntheticPartMulti.prototype,
  _contentType: 'multipart/related',
};

const PKCS_SIGNATURE_MIME_TYPE = 'application/x-pkcs7-signature';
/**
 * Multipart signed (multipart/signed) SMIME part.  This is helperish and makes
 *  up a gibberish signature.  We wrap the provided parts in the standard
 *  signature idiom
 *
 * @param aPart The content part to wrap. Only one part!  Use a multipart if
 *     you need to cram extra stuff in there.
 * @param aProperties Properties, propagated to SyntheticPart, see that.
 */
function SyntheticPartMultiSignedSMIME(aPart, aProperties) {
  SyntheticPartMulti.call(this, [aPart], aProperties);
  this.parts.push(new SyntheticPartLeaf(
    "I am not really a signature but let's hope no one figures it out.",
    {
      contentType: PKCS_SIGNATURE_MIME_TYPE,
      name: 'smime.p7s',
    }));
}
SyntheticPartMultiSignedSMIME.prototype = {
  __proto__: SyntheticPartMulti.prototype,
  _contentType: 'multipart/signed',
  _contentTypeExtra: {
    protocol: PKCS_SIGNATURE_MIME_TYPE,
    micalg: 'SHA1'
  },
};

const PGP_SIGNATURE_MIME_TYPE = 'application/pgp-signature';
/**
 * Multipart signed (multipart/signed) PGP part.  This is helperish and makes
 *  up a gibberish signature.  We wrap the provided parts in the standard
 *  signature idiom
 *
 * @param aPart The content part to wrap. Only one part!  Use a multipart if
 *     you need to cram extra stuff in there.
 * @param aProperties Properties, propagated to SyntheticPart, see that.
 */
function SyntheticPartMultiSignedPGP(aPart, aProperties) {
  SyntheticPartMulti.call(this, [aPart], aProperties);
  this.parts.push(new SyntheticPartLeaf(
    "I am not really a signature but let's hope no one figures it out.",
    {
      contentType: PGP_SIGNATURE_MIME_TYPE,
    }));
}
SyntheticPartMultiSignedPGP.prototype = {
  __proto__: SyntheticPartMulti.prototype,
  _contentType: 'multipart/signed',
  _contentTypeExtra: {
    protocol: PGP_SIGNATURE_MIME_TYPE,
    micalg: 'pgp-sha1'
  },
};


const _DEFAULT_META_STATES = {
  junk: false,
  read: false,
};

/**
 * A synthetic message, created by the MessageGenerator.  Captures both the
 *  ingredients that went into the synthetic message as well as the rfc822 form
 *  of the message.
 *
 * @param [aHeaders] A dictionary of rfc822 header payloads.  The key should be
 *     capitalized as you want it to appear in the output.  This requires
 *     adherence to convention of this class.  You are best to just use the
 *     helpers provided by this class.
 * @param [aBodyPart] An instance of one of the many Synthetic part types
 *     available in this file.
 * @param [aMetaState] A dictionary of meta-state about the message that is only
 *     relevant to the messageInjection logic and perhaps some testing logic.
 * @param [aMetaState.junk=false] Is the method junk?
 */
function SyntheticMessage(aHeaders, aBodyPart, aMetaState) {
  // we currently do not need to call SyntheticPart's constructor...
  this.headers = aHeaders || {};
  this.bodyPart = aBodyPart || new SyntheticPartLeaf("");
  this.metaState = aMetaState || {};
  for each (let [key, value] in Iterator(_DEFAULT_META_STATES)) {
    if (!(key in this.metaState))
      this.metaState[key] = value;
  }
}

SyntheticMessage.prototype = {
  __proto__: SyntheticPart.prototype,
  _contentType: 'message/rfc822',
  _charset: null,
  _format: null,
  _encoding: null,

  /** @returns the Message-Id header value. */
  get messageId() { return this._messageId; },
  /**
   * Sets the Message-Id header value.
   *
   * @param aMessageId A unique string without the greater-than and less-than,
   *     we add those for you.
   */
  set messageId(aMessageId) {
    this._messageId = aMessageId;
    this.headers["Message-Id"] = "<" + aMessageId + ">";
  },

  /** @returns the message Date header value. */
  get date() { return this._date; },
  /**
   * Sets the Date header to the given javascript Date object.
   *
   * @param aDate The date you want the message to claim to be from.
   */
  set date(aDate) {
    this._date = aDate;
    let dateParts = aDate.toString().split(" ");
    this.headers["Date"] = dateParts[0] + ", " + dateParts[2] + " " +
                           dateParts[1] + " " + dateParts[3] + " " +
                           dateParts[4] + " " + dateParts[5].substring(3);
  },

  /** @returns the message subject */
  get subject() { return this._subject; },
  /**
   * Sets the message subject.
   *
   * @param aSubject A string sans newlines or other illegal characters.
   */
  set subject(aSubject) {
    this._subject = aSubject;
    this.headers["Subject"] = aSubject;
  },

  /**
   * Given a tuple containing [a display name, an e-mail address], returns a
   *  string suitable for use in a to/from/cc header line.
   *
   * @param aNameAndAddress A list with two elements.  The first should be the
   *     display name (sans wrapping quotes).  The second element should be the
   *     e-mail address (sans wrapping greater-than/less-than).
   */
  _formatMailFromNameAndAddress: function(aNameAndAddress) {
    // if the name is encoded, do not put it in quotes!
    return (aNameAndAddress[0].startsWith("=") ?
              (aNameAndAddress[0] + " ") :
              ('"' + aNameAndAddress[0] + '" ')) +
           '<' + aNameAndAddress[1] + '>';
  },

  /**
   * Given a mailbox, parse out name and email. The mailbox
   * can (per rfc 2822) be of two forms:
   *  1) Name <me@example.org>
   *  2) me@example.org
   * @return a tuple of name, email
   **/
  _parseMailbox: function(mailbox) {
    let matcher = mailbox.match(/(.*)<(.+@.+)>/);
    if (!matcher) // no match -> second form
      return ["", mailbox];

    let name = matcher[1].trim();
    let email = matcher[2].trim();
    return [name, email];
  },

  /** @returns the name-and-address tuple used when setting the From header. */
  get from() { return this._from; },
  /**
   * Sets the From header using the given tuple containing [a display name,
   *  an e-mail address].
   *
   * @param aNameAndAddress A list with two elements.  The first should be the
   *     display name (sans wrapping quotes).  The second element should be the
   *     e-mail address (sans wrapping greater-than/less-than).
   *     Can also be a string, should then be a valid raw From: header value.
   */
  set from(aNameAndAddress) {
    if (typeof aNameAndAddress === "string") {
      this._from = this._parseMailbox(aNameAndAddress);
      this.headers["From"] = aNameAndAddress;
      return;
    }
    this._from = aNameAndAddress;
    this.headers["From"] = this._formatMailFromNameAndAddress(aNameAndAddress);
  },

  /** @returns The display name part of the From header. */
  get fromName() { return this._from[0]; },
  /** @returns The e-mail address part of the From header (no display name). */
  get fromAddress() { return this._from[1]; },

  /**
   * For our header storage, we may need to pre-add commas, this does it.
   *
   * @param aList A list of strings that is mutated so that every string in the
   *     list except the last one has a comma appended to it.
   */
  _commaize: function(aList) {
    for (let i=0; i < aList.length - 1; i++)
      aList[i] = aList[i] + ",";
    return aList;
  },

  /**
   * @returns the comma-ized list of name-and-address tuples used to set the To
   *     header.
   */
  get to() { return this._to; },
  /**
   * Sets the To header using a list of tuples containing [a display name,
   *  an e-mail address].
   *
   * @param aNameAndAddress A list of name-and-address tuples.  Each tuple is a
   *     list with two elements.  The first should be the
   *     display name (sans wrapping quotes).  The second element should be the
   *     e-mail address (sans wrapping greater-than/less-than).
   *     Can also be a string, should then be a valid raw To: header value.
   */
  set to(aNameAndAddresses) {
    if (typeof aNameAndAddresses === "string") {
      this._to = [];
      let people = aNameAndAddresses.split(",");
      for (let i = 0; i < people.length; i++) {
        this._to.push(this._parseMailbox(people[i]));
      }

      this.headers["To"] = aNameAndAddresses;
      return;
    }
    this._to = aNameAndAddresses;
    this.headers["To"] = this._commaize(
                           [this._formatMailFromNameAndAddress(nameAndAddr)
                            for each (nameAndAddr in aNameAndAddresses)]);
  },
  /** @returns The display name of the first intended recipient. */
  get toName() { return this._to[0][0]; },
  /** @returns The email address (no display name) of the first recipient. */
  get toAddress() { return this._to[0][1]; },

  /**
   * @returns The comma-ized list of name-and-address tuples used to set the Cc
   *     header.
   */
  get cc() { return this._cc; },
  /**
   * Sets the Cc header using a list of tuples containing [a display name,
   *  an e-mail address].
   *
   * @param aNameAndAddress A list of name-and-address tuples.  Each tuple is a
   *     list with two elements.  The first should be the
   *     display name (sans wrapping quotes).  The second element should be the
   *     e-mail address (sans wrapping greater-than/less-than).
   *     Can also be a string, should then be a valid raw Cc: header value.
   */
  set cc(aNameAndAddresses) {
    if (typeof aNameAndAddresses === "string") {
      this._cc = [];
      let people = aNameAndAddresses.split(",");
      for (let i = 0; i < people.length; i++) {
        this._cc.push(this._parseMailbox(people[i]));
      }
      this.headers["Cc"] = aNameAndAddresses;
      return;
    }
    this._cc = aNameAndAddresses;
    this.headers["Cc"] = this._commaize(
                           [this._formatMailFromNameAndAddress(nameAndAddr)
                            for each (nameAndAddr in aNameAndAddresses)]);
  },

  get bodyPart() {
    return this._bodyPart;
  },
  set bodyPart(aBodyPart) {
    this._bodyPart = aBodyPart;
    this.headers["Content-Type"] = this._bodyPart.contentTypeHeaderValue;
  },

  /**
   * Normalizes header values, which may be strings or arrays of strings, into
   *  a suitable string suitable for appending to the header name/key.
   *
   * @returns a normalized string representation of the header value(s), which
   *     may include spanning multiple lines.
   */
  _formatHeaderValues: function(aHeaderValues) {
    // may not be an array
    if (!(aHeaderValues instanceof Array))
      return aHeaderValues;
    // it's an array!
    if (aHeaderValues.length == 1)
      return aHeaderValues[0];
    return aHeaderValues.join("\r\n\t");
  },

  /**
   * @returns a string uniquely identifying this message, at least as long as
   *     the messageId is set and unique.
   */
  toString: function() {
    return "msg:" + this._messageId;
  },

  /**
   * Convert the message and its hierarchy into a "pretty string".  The message
   *  and each MIME part get their own line.  The string never ends with a
   *  newline.  For a non-multi-part message, only a single line will be
   *  returned.
   * Messages have their subject displayed, everyone else just shows their
   *  content type.
   */
  prettyString: function MimeMessage_prettyString(aIndent) {
    if (aIndent === undefined)
      aIndent = "";
    let nextIndent = aIndent + "  ";

    let s = "Message: " + this.subject;
    s += "\n" + nextIndent + "1 " + this.bodyPart.prettyString(nextIndent);

    return s;
  },

  /**
   * @returns this messages in rfc822 format, or something close enough.
   */
  toMessageString: function() {
    let lines = [headerKey + ": " + this._formatHeaderValues(headerValues)
                 for each ([headerKey, headerValues] in Iterator(this.headers))];

    return lines.join("\r\n") + "\r\n\r\n" + this.bodyPart.toMessageString() +
      "\r\n";
  },

  toMboxString: function() {
    return "From " + this._from[1] + "\r\n" + this.toMessageString() + "\r\n";
  },

  /**
   * @returns this message in rfc822 format in a string stream.
   */
  toStream: function () {
    let stream = Cc["@mozilla.org/io/string-input-stream;1"]
                   .createInstance(Ci.nsIStringInputStream);
    let str = this.toMessageString();
    stream.setData(str, str.length);
    return stream;
  },

  /**
   * Writes this message to an mbox stream.  This means adding a "From " line
   *  and making sure we've got a trailing newline.
   */
  writeToMboxStream: function (aStream) {
    let str = this.toMboxString();
    aStream.write(str, str.length);
  }
};

/**
 * Write a list of messages to a folder
 *
 * @param aMessages The list of SyntheticMessages instances to write.
 * @param aFolder The folder to write to.
 */
function addMessagesToFolder (aMessages, aFolder)
{
  let localFolder = aFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  for (let [, message] in Iterator(aMessages))
    localFolder.addMessage(message.toMboxString());
}

/**
 * Provides mechanisms for creating vaguely interesting, but at least valid,
 *  SyntheticMessage instances.
 */
function MessageGenerator() {
  this._clock = new Date(2000, 1, 1);
  this._nextNameNumber = 0;
  this._nextSubjectNumber = 0;
  this._nextMessageIdNum = 0;
}

MessageGenerator.prototype = {
  /**
   * The maximum number of unique names makeName can produce.
   */
  MAX_VALID_NAMES: FIRST_NAMES.length * LAST_NAMES.length,
  /**
   * The maximum number of unique e-mail address makeMailAddress can produce.
   */
  MAX_VALID_MAIL_ADDRESSES: FIRST_NAMES.length * LAST_NAMES.length,
  /**
   * The maximum number of unique subjects makeSubject can produce.
   */
  MAX_VALID_SUBJECTS: SUBJECT_ADJECTIVES.length * SUBJECT_NOUNS.length *
                      SUBJECT_SUFFIXES,

  /**
   * Generate a consistently determined (and reversible) name from a unique
   *  value.  Currently up to 26*26 unique names can be generated, which
   *  should be sufficient for testing purposes, but if your code cares, check
   *  against MAX_VALID_NAMES.
   *
   * @param aNameNumber The 'number' of the name you want which must be less
   *     than MAX_VALID_NAMES.
   * @returns The unique name corresponding to the name number.
   */
  makeName: function(aNameNumber) {
    let iFirst = aNameNumber % FIRST_NAMES.length;
    let iLast = (iFirst + Math.floor(aNameNumber / FIRST_NAMES.length)) %
                LAST_NAMES.length;

    return FIRST_NAMES[iFirst] + " " + LAST_NAMES[iLast];
  },

  /**
   * Generate a consistently determined (and reversible) e-mail address from
   *  a unique value; intended to work in parallel with makeName.  Currently
   *  up to 26*26 unique addresses can be generated, but if your code cares,
   *  check against MAX_VALID_MAIL_ADDRESSES.
   *
   * @param aNameNumber The 'number' of the mail address you want which must be
   *     less than MAX_VALID_MAIL_ADDRESSES.
   * @returns The unique name corresponding to the name mail address.
   */
  makeMailAddress: function(aNameNumber) {
    let iFirst = aNameNumber % FIRST_NAMES.length;
    let iLast = (iFirst + Math.floor(aNameNumber / FIRST_NAMES.length)) %
                LAST_NAMES.length;

    return FIRST_NAMES[iFirst].toLowerCase() + "@" +
           LAST_NAMES[iLast].toLowerCase() + ".invalid";
  },

  /**
   * Generate a pair of name and e-mail address.
   *
   * @param aNameNumber The optional 'number' of the name and mail address you
   *     want.  If you do not provide a value, we will increment an internal
   *     counter to ensure that a new name is allocated and that will not be
   *     re-used.  If you use our automatic number once, you must use it always,
   *     unless you don't mind or can ensure no collisions occur between our
   *     number allocation and your uses.  If provided, the number must be
   *     less than MAX_VALID_NAMES.
   * @return A list containing two elements.  The first is a name produced by
   *     a call to makeName, and the second an e-mail address produced by a
   *     call to makeMailAddress.  This representation is used by the
   *     SyntheticMessage class when dealing with names and addresses.
   */
  makeNameAndAddress: function(aNameNumber) {
    if (aNameNumber === undefined)
      aNameNumber = this._nextNameNumber++;
    return [this.makeName(aNameNumber), this.makeMailAddress(aNameNumber)];
  },

  /**
   * Generate and return multiple pairs of names and e-mail addresses.  The
   *  names are allocated using the automatic mechanism as documented on
   *  makeNameAndAddress.  You should accordingly not allocate / hard code name
   *  numbers on your own.
   *
   * @param aCount The number of people you want name and address tuples for.
   * @returns a list of aCount name-and-address tuples.
   */
  makeNamesAndAddresses: function(aCount) {
    let namesAndAddresses = [];
    for (let i=0; i < aCount; i++)
      namesAndAddresses.push(this.makeNameAndAddress());
    return namesAndAddresses;
  },

  /**
   * Generate a consistently determined (and reversible) subject from a unique
   *  value.  Up to MAX_VALID_SUBJECTS can be produced.
   *
   * @param aSubjectNumber The subject number you want generated, must be less
   *     than MAX_VALID_SUBJECTS.
   * @returns The subject corresponding to the given subject number.
   */
  makeSubject: function(aSubjectNumber) {
    if (aSubjectNumber === undefined)
      aSubjectNumber = this._nextSubjectNumber++;
    let iAdjective = aSubjectNumber % SUBJECT_ADJECTIVES.length;
    let iNoun = (iAdjective + Math.floor(aSubjectNumber /
                                         SUBJECT_ADJECTIVES.length)) %
                SUBJECT_NOUNS.length;
    let iSuffix = (iNoun + Math.floor(aSubjectNumber /
                   (SUBJECT_ADJECTIVES.length * SUBJECT_NOUNS.length))) %
                  SUBJECT_SUFFIXES.length;
    return SUBJECT_ADJECTIVES[iAdjective] + " " +
           SUBJECT_NOUNS[iNoun] + " " +
           SUBJECT_SUFFIXES[iSuffix];
  },

  /**
   * Fabricate a message-id suitable for the given synthetic message.  Although
   *  we don't use the message yet, in theory it would let us tailor the
   *  message id to the server that theoretically might be sending it.  Or some
   *  such.
   *
   * @param The synthetic message you would like us to make up a message-id for.
   *     We don't set the message-id on the message, that's up to you.
   * @returns a Message-id suitable for the given message.
   */
  makeMessageId: function(aSynthMessage) {
    let msgId = this._nextMessageIdNum + "@made.up.invalid";
    this._nextMessageIdNum++;
    return msgId;
  },

  /**
   * Generates a valid date which is after all previously issued dates by this
   *  method, ensuring an apparent ordering of time consistent with the order
   *  in which code is executed / messages are generated.
   * If you need a precise time ordering or precise times, make them up
   *  yourself.
   *
   * @returns A made-up time in JavaScript Date object form.
   */
  makeDate: function() {
    let date = this._clock;
    // advance time by an hour
    this._clock = new Date(date.valueOf() + 60 * 60 * 1000);
    return date;
  },

  /**
   * Create a SyntheticMessage.  All arguments are optional, but allow
   *  additional control.  With no arguments specified, a new name/address will
   *  be generated that has not been used before, and sent to a new name/address
   *  that has not been used before.
   *
   * @param aArgs An object with any of the following attributes provided:
   * @param [aArgs.age] A dictionary with potential attributes 'minutes',
   *     'hours', 'days', 'weeks' to specify the message be created that far in
   *     the past.
   * @param [aArgs.attachments] A list of dictionaries suitable for passing to
   *     syntheticPartLeaf, plus a 'body' attribute that has already been
   *     encoded.  Line chopping is on you FOR NOW.
   * @param [aArgs.body] A dictionary suitable for passing to SyntheticPart plus
   *     a 'body' attribute that has already been encoded (if encoding is
   *     required).  Line chopping is on you FOR NOW.  Alternately, use
   *     bodyPart.
   * @param [aArgs.bodyPart] A SyntheticPart to uses as the body.  If you
   *     provide an attachments value, this part will be wrapped in a
   *     multipart/mixed to also hold your attachments.  (You can put
   *     attachments in the bodyPart directly if you want and not use
   *     attachments.)
   * @param [aArgs.callerData] A value to propagate to the callerData attribute
   *     on the resulting message.
   * @param [aArgs.cc] A list of cc recipients (name and address pairs).  If
   *     omitted, no cc is generated.
   * @param [aArgs.from] The name and value pair this message should be from.
   *     Defaults to the first recipient if this is a reply, otherwise a new
   *     person is synthesized via |makeNameAndAddress|.
   * @param [aArgs.inReplyTo] the SyntheticMessage this message should be in
   *     reply-to.  If that message was in reply to another message, we will
   *     appropriately compensate for that.  If a SyntheticMessageSet is
   *     provided we will use the first message in the set.
   * @param [aArgs.replyAll] a boolean indicating whether this should be a
   *     reply-to-all or just to the author of the message.  (er, to-only, not
   *     cc.)
   * @param [aArgs.subject] subject to use; you are responsible for doing any
   *     encoding before passing it in.
   * @param [aArgs.to] The list of recipients for this message, defaults to a
   *     set of toCount newly created persons.
   * @param [aArgs.toCount=1] the number of people who the message should be to.
   * @param [aArgs.clobberHeaders] An object whose contents will overwrite the
   *     contents of the headers object.  This should only be used to construct
   *     illegal header values; general usage should use another explicit
   *     mechanism.
   * @param [aArgs.junk] Should this message be flagged as junk for the benefit
   *     of the messageInjection helper so that it can know to flag the message
   *     as junk?  We have no concept of marking a message as definitely not
   *     junk at this point.
   * @param [aArgs.read] Should this message be marked as already read?
   * @returns a SyntheticMessage fashioned just to your liking.
   */
  makeMessage: function(aArgs) {
    aArgs = aArgs || {};
    let msg = new SyntheticMessage();

    if (aArgs.inReplyTo) {
      // If inReplyTo is a SyntheticMessageSet, just use the first message in
      //  the set because the caller may be using them.
      let srcMsg = aArgs.inReplyTo.synMessages ?
                     aArgs.inReplyTo.synMessages[0] :
                     aArgs.inReplyTo;

      msg.parent = srcMsg;
      msg.parent.children.push(msg);

      msg.subject = (srcMsg.subject.startsWith("Re: ")) ? srcMsg.subject
                    : ("Re: " + srcMsg.subject);
      if (aArgs.replyAll)
        msg.to = [srcMsg.from].concat(srcMsg.to.slice(1));
      else
        msg.to = [srcMsg.from];
      msg.from = srcMsg.to[0];

      // we want the <>'s.
      msg.headers["In-Reply-To"] = srcMsg.headers["Message-Id"];
      msg.headers["References"] = (srcMsg.headers["References"] || []).concat(
                                   [srcMsg.headers["Message-Id"]]);
    }
    else {
      msg.parent = null;

      msg.subject = aArgs.subject || this.makeSubject();
      msg.from = aArgs.from || this.makeNameAndAddress();
      msg.to = aArgs.to || this.makeNamesAndAddresses(aArgs.toCount || 1);
      if (aArgs.cc)
        msg.cc = aArgs.cc;
    }

    msg.children = [];
    msg.messageId = this.makeMessageId(msg);
    if (aArgs.age) {
      let age = aArgs.age;
      // start from 'now'
      let ts = new Date().valueOf();
      if (age.minutes)
        ts -= age.minutes * 60 * 1000;
      if (age.hours)
        ts -= age.hours * 60 * 60 * 1000;
      if (age.days)
        ts -= age.days * 24 * 60 * 60 * 1000;
      if (age.weeks)
        ts -= age.weeks * 7 * 24 * 60 * 60 * 1000;
      msg.date = new Date(ts);
    }
    else {
      msg.date = this.makeDate();
    }

    if ("clobberHeaders" in aArgs) {
      for each (let [key, value] in Iterator(aArgs.clobberHeaders)) {
        msg.headers[key] = value;
        // clobber helper...
        if (key == "From")
          msg._from = ["", ""];
        if (key == "To")
          msg._to = [["", ""]];
        if (key == "Cc")
          msg._cc = [["", ""]];
      }
    }

    if ("junk" in aArgs && aArgs.junk)
      msg.metaState.junk = true;
    if ("read" in aArgs && aArgs.read)
      msg.metaState.read = true;

    let bodyPart;
    if (aArgs.bodyPart)
      bodyPart = aArgs.bodyPart;
    else if (aArgs.body)
      bodyPart = new SyntheticPartLeaf(aArgs.body.body, aArgs.body);
    else // different messages should have a chance at different bodies
      bodyPart = new SyntheticPartLeaf("Hello " + msg.toName + "!");

    // if it has any attachments, create a multipart/mixed to be the body and
    //  have it be the parent of the existing body and all the attachments
    if (aArgs.attachments) {
      let parts = [bodyPart];
      for each (let [,attachDesc] in Iterator(aArgs.attachments))
        parts.push(new SyntheticPartLeaf(attachDesc.body, attachDesc));
      bodyPart = new SyntheticPartMultiMixed(parts);
    }

    msg.bodyPart = bodyPart;

    msg.callerData = aArgs.callerData;

    return msg;
  },

  /**
   * Create an encrypted SMime message. It's just a wrapper around makeMessage,
   * that sets the right content-type. Use like makeMessage.
   */
  makeEncryptedSMimeMessage:
      function MessageGenerate_makeEncryptedSMimeMessage(aOptions) {
    if (!aOptions)
      aOptions = {};
    aOptions.clobberHeaders = {
      'Content-Transfer-Encoding': 'base64',
      'Content-Disposition': 'attachment; filename="smime.p7m"',
    }
    if (!aOptions.body)
      aOptions.body = {};
    aOptions.body.contentType = 'application/pkcs7-mime; name="smime.p7m"';
    let msg = this.makeMessage(aOptions);
    return msg;
  },

  MAKE_MESSAGES_DEFAULTS: {
    count: 10,
  },
  MAKE_MESSAGES_PROPAGATE: ['attachments', 'body', 'cc', 'from', 'inReplyTo',
                            'subject', 'to', 'clobberHeaders', 'junk', 'read'],
  /**
   * Given a set definition, produce a list of synthetic messages.
   *
   * The set definition supports the following attributes:
   *  count: The number of messages to create.
   *  age: As used by makeMessage.
   *  age_incr: Similar to age, but used to increment the values in the age
   *      dictionary (assuming a value of zero if omitted).
   *  @param [aSetDef.msgsPerThread=1] The number of messages per thread.  If
   *      you want to create direct-reply threads, you can pass a value for this
   *      and have it not be one.  If you need fancier reply situations,
   *      directly use a scenario or hook us up to support that.
   *
   * Also supported are the following attributes as defined by makeMessage:
   *  attachments, body, from, inReplyTo, subject, to, clobberHeaders, junk
   *
   * If omitted, the following defaults are used, but don't depend on this as we
   *  can change these at any time:
   * - count: 10
   */
  makeMessages: function MessageGenerator_makeMessages(aSetDef) {
    let messages = [];

    let args = {};
    // zero out all the age_incr fields in age (if present)
    if (aSetDef.age_incr) {
      args.age = {};
      for (let [unit, delta] in Iterator(aSetDef.age_incr))
        args.age[unit] = 0;
    }
    // copy over the initial values from age (if present)
    if (aSetDef.age) {
      args.age = args.age || {};
      for (let [unit, value] in Iterator(aSetDef.age))
        args.age[unit] = value;
    }
    // just copy over any attributes found from MAKE_MESSAGES_PROPAGATE
    for each (let [, propAttrName] in Iterator(this.MAKE_MESSAGES_PROPAGATE)) {
      if (aSetDef[propAttrName])
        args[propAttrName] = aSetDef[propAttrName];
    }

    let count = aSetDef.count || this.MAKE_MESSAGES_DEFAULTS.count;
    let messagsPerThread = aSetDef.msgsPerThread || 1;
    let lastMessage = null;
    for (let iMsg = 0; iMsg < count; iMsg++) {
      // primitive threading support...
      if (lastMessage && (iMsg % messagsPerThread != 0))
        args.inReplyTo = lastMessage;
      else if (!("inReplyTo" in aSetDef))
        args.inReplyTo = null;
      lastMessage = this.makeMessage(args);
      messages.push(lastMessage);

      if (aSetDef.age_incr) {
        for (let [unit, delta] in Iterator(aSetDef.age_incr))
          args.age[unit] += delta;
      }
    }

    return messages;
  },
};

/**
 * Repository of generative message scenarios.  Uses the magic bindMethods
 *  function below to allow you to reference methods/attributes without worrying
 *  about how those methods will get the right 'this' pointer if passed as
 *  simply a function argument to someone.  So if you do:
 *  foo = messageScenarioFactory.method, followed by foo(...), it will be
 *  equivalent to having simply called messageScenarioFactory.method(...).
 *  (Normally this would not be the case when using JavaScript.)
 *
 * @param aMessageGenerator The optional message generator we should use.
 *     If you don't pass one, we create our own.  You would want to pass one so
 *     that if you also create synthetic messages directly via the message
 *     generator then the two sources can avoid duplicate use of the same
 *     names/addresses/subjects/message-ids.
 */
function MessageScenarioFactory(aMessageGenerator) {
  if(!aMessageGenerator)
    aMessageGenerator = new MessageGenerator();
  this._msgGen = aMessageGenerator;
}

MessageScenarioFactory.prototype = {
  /** Create a chain of direct-reply messages of the given length. */
  directReply: function(aNumMessages) {
    aNumMessages = aNumMessages || 2;
    let messages = [this._msgGen.makeMessage()];
    for (let i = 1; i < aNumMessages; i++) {
      messages.push(this._msgGen.makeMessage({inReplyTo: messages[i-1]}));
    }
    return messages;
  },

  /** Two siblings (present), one parent (missing). */
  siblingsMissingParent: function() {
    let missingParent = this._msgGen.makeMessage();
    let msg1 = this._msgGen.makeMessage({inReplyTo: missingParent});
    let msg2 = this._msgGen.makeMessage({inReplyTo: missingParent});
    return [msg1, msg2];
  },

  /** Present parent, missing child, present grand-child. */
  missingIntermediary: function() {
    let msg1 = this._msgGen.makeMessage();
    let msg2 = this._msgGen.makeMessage({inReplyTo: msg1});
    let msg3 = this._msgGen.makeMessage({inReplyTo: msg2});
    return [msg1, msg3];
  },

  /**
   * The root message and all non-leaf nodes have aChildrenPerParent children,
   *  for a total of aHeight layers.  (If aHeight is 1, we have just the root;
   *  if aHeight is 2, the root and his aChildrePerParent children.)
   */
  fullPyramid: function(aChildrenPerParent, aHeight) {
    let msgGen = this._msgGen;
    let root = msgGen.makeMessage();
    let messages = [root];
    function helper(aParent, aRemDepth) {
      for (let iChild = 0; iChild < aChildrenPerParent; iChild++) {
        let child = msgGen.makeMessage({inReplyTo: aParent});
        messages.push(child);
        if (aRemDepth)
          helper(child, aRemDepth - 1);
      }
    }
    if (aHeight > 1)
      helper(root, aHeight - 2);
    return messages;
  }
};

/**
 * Decorate the given object's methods will python-style method binding.  We
 *  create a getter that returns a method that wraps the call, providing the
 *  actual method with the 'this' of the object that was 'this' when the getter
 *  was called.
 * Note that we don't follow the prototype chain; we only process the object you
 *  immediately pass to us.  This does not pose a problem for the 'this' magic
 *  because we are using a getter and 'this' in js always refers to the object
 *  in question (never any part of its prototype chain).  As such, you probably
 *  want to invoke us on your prototype object(s).
 *
 * @param The object on whom we want to perform magic binding.  This should
 *     probably be your prototype object.
 */
function bindMethods(aObj) {
  for (let [name, ubfunc] in Iterator(aObj)) {
    // the variable binding needs to get captured...
    let realFunc = ubfunc;
    function getterFunc() {
      // 'this' is magic and not from the enclosing scope.  we are assuming the
      //  getter will receive a valid 'this', and so
      let realThis = this;
      return function() { return realFunc.apply(realThis, arguments); };
    }
    delete aObj[name];
    aObj.__defineGetter__(name, getterFunc);
  }
}

bindMethods(MessageScenarioFactory.prototype);
