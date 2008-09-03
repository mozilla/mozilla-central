
const FIRST_NAMES = [
  "Andy", "Bob", "Chris", "David", "Emily", "Felix",
  "Gillian", "Helen", "Idina", "Johnny", "Kate", "Lilia",
  "Martin", "Neil", "Olof", "Pete", "Quinn", "Rasmus",
  "Sarah", "Troels", "Ulf", "Vince", "Will", "Xavier",
  "Yoko", "Zig"
  ];

const LAST_NAMES = [
  "Anway", "Bell", "Clarke", "Davol", "Ekberg", "Flowers",
  "Gilbert", "Hook", "Ivarsson", "Jones", "Kurtz", "Lowe",
  "Morris", "Nagel", "Orzabal", "Price", "Quinn", "Rolinski",
  "Stanley", "Tennant", "Ulvaeus", "Vannucci", "Wiggs", "Xavier",
  "Young", "Zig"
  ];

const SUBJECT_ADJECTIVES = [
  "Big", "Small", "Huge", "Tiny",
  "Red", "Green", "Blue", "My",
  "Happy", "Sad", "Grumpy", "Angry",
  "Awesome", "Fun", "Lame", "Funky",
  ];
const SUBJECT_NOUNS = [
  "Meeting", "Party", "Shindig", "Wedding",
  "Document", "Report", "Spreadsheet", "Hovercraft",
  "Aardvark", "Giraffe", "Llama", "Velociraptor",
  "Laser", "Ray-Gun", "Pen", "Sword",
  ];
const SUBJECT_SUFFIXES = [
  "Today", "Tomorrow", "Yesterday", "In a Fortnight",
  "Needs Attention", "Very Important", "Highest Priority", "Full Of Eels",
  "In The Lobby", "On Your Desk", "In Your Car", "Hiding Behind The Door",
  ];
                           

/**
 * A synthetic message, created by the MessageGenerator.  Captures both the
 *  ingredients that went into the synthetic message as well as the rfc822 form
 *  of the message.
 */
function SyntheticMessage(aHeaders, aBody) {
  this.headers = aHeaders || {};
  this.body = aBody || "";
}

SyntheticMessage.prototype = {
  get messageId() { return this._messageId; },
  set messageId(aMessageId) {
    this._messageId = aMessageId;
    this.headers["Message-Id"] = "<" + aMessageId + ">";
  },
  
  get date() { return this._date; },
  set date(aDate) {
    this._date = aDate;
    let dateParts = aDate.toString().split(" ");
    this.headers["Date"] = dateParts[0] + ", " + dateParts[2] + " " +
                           dateParts[1] + " " + dateParts[3] + " " +
                           dateParts[4] + " " + dateParts[5].substring(3);
  },
  
  get subject() { return this._subject; },
  set subject(aSubject) {
    this._subject = aSubject;
    this.headers["Subject"] = aSubject;
  },
  
  _formatMailFromNameAndAddress: function(aNameAndAddress) {
    return '"' + aNameAndAddress[0] + '" ' + 
           '<' + aNameAndAddress[1] + '>';    
  },
  
  get from() { return this._from; },
  set from(aNameAndAddress) {
    this._from = aNameAndAddress;
    this.headers["From"] = this._formatMailFromNameAndAddress(aNameAndAddress);
  },

  get fromName() { return this._from[0]; },
  get fromAddress() { return this._from[1]; },
  
  /**
   * For our header storage, we may need to pre-add commas.
   */
  _commaize: function(aList) {
    for (let i=0; i < aList.length - 1; i++)
      aList[i] = aList[i] + ",";
    return aList;
  },
  
  get to() { return this._to; },
  set to(aNameAndAddresses) {
    this._to = aNameAndAddresses;
    this.headers["To"] = this._commaize(
                           [this._formatMailFromNameAndAddress(nameAndAddr)
                            for each (nameAndAddr in aNameAndAddresses)]);
  },
  // just the first to...
  get toName() { return this.to[0][0]; },
  get toAddress() { return this._to[0][1]; },
  
  get cc() { return this._cc; },
  set cc(aNameAndAddresses) {
    this._to = aNameAndAddresses;
    this.headers["Cc"] = this._commaize(
                           [this._formatMailFromNameAndAddress(nameAndAddr)
                            for each (nameAndAddr in aNameAndAddresses)]);
  },
  
  _formatHeaderValues: function(aHeaderValues) {
    // may not be an array
    if (!(aHeaderValues instanceof Array))
      return aHeaderValues;
    // it's an array!
    if (aHeaderValues.length == 1)
      return aHeaderValues[0];
    return aHeaderValues.join("\n\t");
  },
  
  toString: function() {
    return "msg:" + this._messageId;
  },
  
  toMessageString: function() {
    let lines = [headerKey + ": " + this._formatHeaderValues(headerValues)
                 for each ([headerKey, headerValues] in Iterator(this.headers))];
    
    return lines.join("\n") + "\n\n" + this.body + "\n";
  }
}


function MessageGenerator() {
  this._clock = new Date(2000, 1, 1);
  this._nextNameNumber = 0;
  this._nextSubjectNumber = 0;
  this._nextMessageIdNum = 0;
}

MessageGenerator.prototype = {
  /**
   * Generate a consistently determined (and reversible) name from a unique
   *  value.  Currently up to 26*26 unique names can be generated, which
   *  should be sufficient for testing purposes.
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
   *  up to 26*26 unique addresses can be generated.
   */
  makeMailAddress: function(aNameNumber) {
    let iFirst = aNameNumber % FIRST_NAMES.length;
    let iLast = (iFirst + Math.floor(aNameNumber / FIRST_NAMES.length)) %
	      LAST_NAMES.length;
		
    return FIRST_NAMES[iFirst].toLowerCase() + "@" +
           LAST_NAMES[iLast].toLowerCase() + ".nul";
  },
  
  /**
   * Generate a pair of name and e-mail address.
   */
  makeNameAndAddress: function(aNameNumber) {
    if (aNameNumber === undefined)
      aNameNumber = this._nextNameNumber++;
    return [this.makeName(aNameNumber), this.makeMailAddress(aNameNumber)];
  },

  makeNamesAndAddresses: function(aCount) {
    let namesAndAddresses = [];
    for (let i=0; i < aCount; i++)
      namesAndAddresses.push(this.makeNameAndAddress());
    return namesAndAddresses;
  },
  
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
   */
  makeMessageId: function(aSynthMessage) {
    let msgId = this._nextMessageIdNum + "@made.up";
    this._nextMessageIdNum++;
    return msgId;
  },
  
  makeDate: function() {
    let date = this._clock;
    // advance time by an hour
    this._clock = new Date(date.valueOf() + 60 * 60 * 1000);
    return date;
  },
  
  makeMessage: function(aInReplyTo, aArgs) {
    aArgs = aArgs || {};
    let msg = new SyntheticMessage();
    
    if (aInReplyTo) {
      let srcMsg = aInReplyTo;
      
      msg.subject = (srcMsg.subject.substring(0, 3) == "Re: ") ? srcMsg.subject
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
      msg.subject = this.makeSubject();
      msg.from = this.makeNameAndAddress();
      msg.to = this.makeNamesAndAddresses(aArgs.toCount || 1);
    }
    
    msg.messageId = this.makeMessageId(msg);
    msg.date = this.makeDate();
    
    msg.body = "I am an e-mail.";
    
    return msg;
  }
}

function MessageScenarioFactory(aMessageGenerator) {
  if(!aMessageGenerator)
    aMessageGenerator = new MessageGenerator();
  this._msgGen = aMessageGenerator;
}

MessageScenarioFactory.prototype = {
  directReply: function() {
    let msg1 = this._msgGen.makeMessage();
    let msg2 = this._msgGen.makeMessage(msg1);
    return [msg1, msg2];
  },
  
  siblingsMissingParent: function() {
    let missingParent = this._msgGen.makeMessage();
    let msg1 = this._msgGen.makeMessage(missingParent);
    let msg2 = this._msgGen.makeMessage(missingParent);
    return [msg1, msg2];
  },
  
  missingIntermediary: function() {
    let msg1 = this._msgGen.makeMessage();
    let msg2 = this._msgGen.makeMessage(msg1);
    let msg3 = this._msgGen.makeMessage(msg2);
    return [msg1, msg3];
  }
}

/**
 * Decorate the given object's methods will python-style method binding.  We
 *  create a getter that returns a method that wraps the call, providing the
 *  actual method with the 'this' of the object that was 'this' when the getter
 *  was called.
 */
function bindMethods(aObj) {
  for (let [name, ubfunc] in Iterator(aObj)) {
    // the variable binding needs to get captured...
    let realFunc = ubfunc;
    let getterFunc = function() {
      // 'this' is magic and not from the enclosing scope.  we are assuming the
      //  getter will receive a valid 'this', and so
      let realThis = this;
      return function() { return realFunc.call(realThis, arguments); };
    }
    delete aObj[name];
    aObj.__defineGetter__(name, getterFunc);
  }
}

bindMethods(MessageScenarioFactory.prototype);
