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

EXPORTED_SYMBOLS = ['Gloda'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/log4moz.js");

Cu.import("resource://app/modules/gloda/datastore.js");
Cu.import("resource://app/modules/gloda/datamodel.js");
Cu.import("resource://app/modules/gloda/collection.js");
Cu.import("resource://app/modules/gloda/connotent.js");
Cu.import("resource://app/modules/gloda/query.js");
Cu.import("resource://app/modules/gloda/utils.js");

/**
 * Provides the user-visible (and extension visible) global database
 *  functionality.  There is currently a dependency/ordering
 *  problem in that the concept of 'gloda' also includes some logic that is
 *  contributed by built-in extensions, if you will.  Those built-in extensions
 *  (fundattr.js, explattr.js) also import this file.  To avoid a circular
 *  dependency, those built-in extensions are loaded by everybody.js.  The
 *  simplest/best solution is probably to move everybody.js to be gloda.js and
 *  have it re-export only 'Gloda'.  gloda.js (this file) can then move to be
 *  gloda_int.js (or whatever our eventual naming scheme is), which built-in
 *  extensions can explicitly rely upon.
 *
 * === Concepts
 *
 * == Nouns
 *
 * Inspired by reasonable uses of triple-stores, I have tried to leverage
 *  existing model and terminology rather than rolling out own for everything.
 *  The idea with triple-stores is that you have a subject, a predicate, and an
 *  object.  For example, if we are talking about a message, that is the
 *  subject, the predicate could roughly be sent-by, and the object a person.
 *  We can generalize this idea to say that the subject and objects are nouns.
 * Since we want to be more flexible than only dealing with messages, we
 *  therefore introduce the concept of nouns as an organizing principle.
 *
 * == Attributes
 *
 * Our attributes definitions are basically our predicates.  When we define
 *  an attribute, it's a label with a bunch of meta-data.  Our attribute
 *  instances are basically a 'triple' in a triple-store.  The attributes
 *  are stored in database rows that imply a specific noun-type (ex: the
 *  messageAttributes table), with an ID identifying the message which is our
 *  subject, an attribute ID which identifies the attribute definition in use
 *  (and therefore the predicate), plus an object ID (given context aka the
 *  noun type by the attribute's meta-data) which identifies the 'object'.
 *
 * == But...
 *
 * Things aren't entirely as clear as they could be right now, terminology/
 *  concept/implementation-wise.  Some work is probably still in order.
 *
 * === Implementation
 *
 * == Nouns
 *
 * So, we go and define the nouns that are roughly the classes in our data
 *  model.  Every 'class' we define in datamodel.js is a noun that gets defined
 *  here in the Gloda core.  We provide sufficient meta-data about the noun to
 *  serialize/deserialize its representation from our database representation.
 *  Nouns do not have to be defined in this class, but can also be contributed
 *  by external code.
 * We have a concept of 'first class' nouns versus non-first class nouns.  The
 *  distinction is meant to be whether we can store meta-information about those
 *  nouns using attributes.  Right now, only message are real first-class nouns,
 *  but we want to expand that to include contacts and eventually events and
 *  tasks as lightning-integration occurs.  In practice, we are stretching the
 *  definition of first-class nouns slightly to include things we can't store
 *  meta-data about, but want to be able to query about.  We do want to resolve
 *  this.
 *
 * == Attributes
 *
 * Attributes are defined by "attribute providers" who are responsible for
 *  taking an instance of a first-class noun (for which they are registered)
 *  plus perhaps some other meta-data, and returning a list of attributes
 *  extracted from that noun.  For now, this means messages.  Attribute
 *  providers may create new data records as a side-effect of the indexing
 *  process, although we have not yet fully dealt with the problem of deleting
 *  these records should they become orphaned in the database due to the
 *  purging of a message and its attributes.
 * All of the 'core' gloda attributes are provided by the fundattr.js and
 *  explattr.js providers.
 *
 * === (Notable) Future Work
 *
 * == Attributes
 *
 * Attribute mechanisms currently lack any support for 'overriding' attributes
 *  provided by other attribute providers.  For example, the fundattr provider
 *  tells us who a message is 'from' based on the e-mail address present.
 *  However, other plugins may actually know better.  For example, the bugzilla
 *  daemon e-mails based on bug activity although the daemon gets the credit
 *  as the official sender.  A bugzilla plugin can easily extract the actual
 *  person/e-mail addressed who did something on the bug to cause the
 *  notification to be sent.  In practice, we would like that person to be
 *  the 'sender' of the bugmail.  But we can't really do that right, yet.
 *
 * @namespace
 */
var Gloda = {
  /**
   * Initialize logging, the datastore (SQLite database), the core nouns and
   *  attributes, and the contact and identities that belong to the presumed
   *  current user (based on accounts).
   *
   * Additional nouns and the core attribute providers are initialized by the
   *  everybody.js module which ensures all of those dependencies are loaded
   *  (and initialized).
   */
  _init: function gloda_ns_init() {
    this._initLogging();
    this._json = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
    GlodaDatastore._init(this._json, this._nounIDToDef);
    this._initAttributes();
    this._initMyIdentities();
  },

  _log: null,
  /**
   * Initialize logging; the error console window gets Warning/Error, and stdout
   *  (via dump) gets everything.
   */
  _initLogging: function gloda_ns_initLogging() {
    let formatter = new Log4Moz.BasicFormatter();
    let root = Log4Moz.Service.rootLogger;
    root.level = Log4Moz.Level.Debug;

    let enableConsoleLogging = false;
    let enableDumpLogging = false;
    let considerNetLogging = false;

    try {
      // figure out if event-driven indexing should be enabled...
      let prefService = Cc["@mozilla.org/preferences-service;1"].
                          getService(Ci.nsIPrefService);
      let branch = prefService.getBranch("mailnews.database.global.logging.");
      enableConsoleLogging = branch.getBoolPref("console");
      enableDumpLogging = branch.getBoolPref("dump");
      enableNetLogging = branch.getBoolPref("net");
    } catch (ex) {}

    if (enableConsoleLogging) {
      let capp = new Log4Moz.ConsoleAppender(formatter);
      capp.level = Log4Moz.Level.Warn;
      root.addAppender(capp);
    }

    if (enableDumpLogging) {
      let dapp = new Log4Moz.DumpAppender(formatter);
      dapp.level = Log4Moz.Level.All;
      root.addAppender(dapp);
    }
    
    if (considerNetLogging) {
      let file = Cc["@mozilla.org/file/directory_service;1"]
                    .getService(Ci.nsIProperties)
                    .get("TmpD", Ci.nsIFile);
      file.append("chainsaw.ptr");
      if (file.exists()) {
        let data = GlodaUtils.loadFileToString(file);
        data = data.trim();
        let [host, port] = data.split(":");
        let xf = new Log4Moz.XMLFormatter();
        let sapp = new Log4Moz.SocketAppender(host, Number(port), xf);
        sapp.level = Log4Moz.Level.All;
        root.addAppender(sapp);
      }
    }

    this._log = Log4Moz.Service.getLogger("gloda.NS");
    this._log.info("Logging Initialized");
  },

  kIndexerIdle: 0,
  kIndexerIndexing: 1,
  kIndexerMoving: 2,
  kIndexerRemoving: 3,

  /** Synchronous activities performed, you can drive us more. */
  kWorkSync: 0,
  /**
   * Asynchronous activity performed, you need to relinquish flow control and
   *  trust us to call callbackDriver later.
   */
  kWorkAsync: 1,
  /**
   * We are all done with our task, close us and figure out something else to do.
   */
  kWorkDone: 2,
  /**
   * We are not done with our task, but we think it's a good idea to take a
   *  breather.
   */
  kWorkPause: 3,
  /**
   * We are done with our task, and have a result that we are returning.  This
   *  should only be used by your callback handler's doneWithResult method.
   *  Ex: you are passed aCallbackHandle, and you do
   *  "yield aCallbackHandle.doneWithResult(myResult);".
   */
  kWorkDoneWithResult: 4,

  /**
   * Lookup a gloda message from an nsIMsgDBHdr.
   *
   * @param aMsgHdr The header of the message you want the gloda message for.
   *
   * @return the gloda messages that corresponds to the provided nsIMsgDBHdr
   *    if one exists, null if one cannot be found.
   */
  getMessageCollectionForHeader: function gloda_ns_getMessageForHeader(aMsgHdr,
      aListener, aData) {
    let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
    query.folder(aMsgHdr.folder).messageKey(aMsgHdr.messageKey);
    return query.getCollection(aListener, aData);
  },
  
  getMessageContent: function gloda_ns_getMessageContent(aGlodaMessage,
      aMimeMsg) {
    let content = new GlodaContent();
    
    let meta = {subject: aMimeMsg.get("subject")};
    
    let bodyLines = aMimeMsg.bodyPlain.split(/\r?\n/);
    
    // get the provider list in reverse order, mainly because we want more
    //  specific content processors to get a chance before the default one
    let attributeProviders =
      this._attrProviderOrderByNoun[this.NOUN_MESSAGE].concat().reverse();
    for each (let [, attrProvider] in Iterator(attributeProviders)) {
      if (attrProvider.contentWhittle) {
        try {
          attrProvider.contentWhittle(aGlodaMessage, meta, bodyLines, content);
        }
        catch (ex) {
          this._log.warn("Content whittler exception " + ex.fileName + ":" +
            ex.lineNumber + ": " + ex);
        }
      }
    }
    
    return content;
  },
  
  getFolderForFolder: function gloda_ns_getFolderForFolder(aMsgFolder) {
    return GlodaDatastore._mapFolder(aMsgFolder);
  },
  
  /**
   * Given one or more full mail addresses (ex: "Bob Smith" <bob@smith.com>),
   *  return a list of the identities that corresponds to each mail address,
   *  creating them as required.
   */
  getOrCreateMailIdentities:
      function gloda_ns_getOrCreateMailIdentities(aCallbackHandle) {
    let addresses = {};
    let resultLists = [];
    
    for (let iArg = 1; iArg < arguments.length; iArg++) {
      let aMailAddresses = arguments[iArg];
      let parsed = GlodaUtils.parseMailAddresses(aMailAddresses);
      
      let resultList = [];
      resultLists.push(resultList);
      
      let identities = [];
      for (let iAddress = 0; iAddress < parsed.count; iAddress++) {
        let address = parsed.addresses[iAddress];
        if (address in addresses)
          addresses[address].push(resultList);
        else
          addresses[address] = [parsed.names[iAddress], resultList];
      }
    }

    let query = this.newQuery(this.NOUN_IDENTITY);
    query.kind("email");
    query.value.apply(query, [address for (address in addresses)]);
    let collection = query.getCollection(aCallbackHandle);
    yield this.kWorkAsync;

    // put the identities in the appropriate result lists
    for each (let [, identity] in Iterator(collection.items)) {
      let nameAndResultLists = addresses[identity.value];
      this._log.debug(" found identity for '" + nameAndResultLists[0] + "' (" +
                      identity.value + ")");
      // index 0 is the name, skip it
      for (let iResList = 1; iResList < nameAndResultLists.length; iResList++) {
        nameAndResultLists[iResList].push(identity);
      }
      delete addresses[identity.value];
    }
    
    // create the identities that did not exist yet
    for each (let [address, nameAndResultLists] in Iterator(addresses)) {
      let name = nameAndResultLists[0];
      
      this._log.debug(" creating contact for '" + name + "' (" + address + ")");

      // try and find an existing address book contact.
      let card = GlodaUtils.getCardForEmail(address);
      // XXX when we have the address book GUID stuff, we need to use that to
      //  find existing contacts... (this will introduce a new query phase
      //  where we batch all the GUIDs for an async query)
      // XXX when the address book supports multiple e-mail addresses, we
      //  should also just create identities for any that don't yet exist
      
      // if there is no name, just use the e-mail (the ab indexer actually
      //  processes the card's displayName for synchronization, so we don't
      //  need to do that.)
      if (!name)
        name = address;

      let contact = GlodaDatastore.createContact(null, null, name, 0, 0);

      // we must create the identity.  use a blank description because there's
      //  nothing to differentiate it from other identities, as this contact
      //  only has one initially (us).
      // XXX when we have multiple e-mails and there is a meaning associated
      //  with each e-mail, try and use that to populate the description.
      // XXX we are creating the identity here before we insert the contact.
      //  conceptually it is good for us to be creating the identity before
      //  exposing it to the address-book indexer, but we could get our id's
      //  in a bad way from not deferring the identity insertion until after
      //  the contact insertion.
      let identity = GlodaDatastore.createIdentity(contact.id, contact,
        "email", address, /* description */ "", /* relay? */ false);
      contact._identities = [identity];
      
      // give the address book indexer a chance if we have a card.
      // (it will fix-up the name based on the card as appropriate)
      if (card)
        yield aCallbackHandle.pushAndGo(
          Gloda.grokNounItem(contact, card, true, aCallbackHandle));
      else // grokNounItem will issue the insert for us...
        GlodaDatastore.insertContact(contact);

      for (let iResList = 1; iResList < nameAndResultLists.length; iResList++) {
        nameAndResultLists[iResList].push(identity);
      }
    }

    yield aCallbackHandle.doneWithResult(resultLists);
  },

  /**
   * Dictionary of the user's known identities; key is the identity id, value
   *  is the actual identity.  This is populated by _initMyIdentities based on
   *  the accounts defined.
   */
  myIdentities: {},
  /**
   * The contact corresponding to the current user.  We are assuming that only
   *  a single user/human being uses the current profile.  This is known to be
   *  a flawed assumption, but is the best first approximation available.
   *
   * @TODO attempt to deal with multile people using the same profile
   */
  myContact: null,
  /**
   * Populate myIdentities with all of our identities.  Currently we do this
   *  by assuming that there is one human/user per profile, and that all of the
   *  accounts defined in the profile belong to them.  The single contact is
   *  stored on myContact.
   *
   * @TODO deal with account addition/modification/removal
   * @TODO attempt to deal with multiple people using the same profile
   */
  _initMyIdentities: function gloda_ns_initMyIdentities() {
    let myContact = null;
    let myIdentities = {};
    let myEmailAddresses = {}; // process each email at most once; stored here

    let fullName = null;
    let existingIdentities = [];
    let identitiesToCreate = [];

    let msgAccountManager = Cc["@mozilla.org/messenger/account-manager;1"].
                            getService(Ci.nsIMsgAccountManager);
    let numIdentities = msgAccountManager.allIdentities.Count();

    // nothing to do if there are no accounts/identities.
    if (!numIdentities)
      return;

    for (let iIdentity = 0; iIdentity < numIdentities; iIdentity++) {
      let msgIdentity = msgAccountManager.allIdentities.GetElementAt(iIdentity)
                                         .QueryInterface(Ci.nsIMsgIdentity);

      if (fullName === null)
        fullName = msgIdentity.fullName;

      let emailAddress = msgIdentity.email;
      let replyTo = msgIdentity.replyTo;

      // find the identities if they exist, flag to create them if they don't
      if (emailAddress) {
        parsed = GlodaUtils.parseMailAddresses(emailAddress);
        if (!(parsed.addresses[0] in myEmailAddresses)) {
          let identity = GlodaDatastore.getIdentity("email",
                                                    parsed.addresses[0]);
          if (identity)
            existingIdentities.push(identity);
          else
            identitiesToCreate.push(parsed.addresses[0]);
          myEmailAddresses[parsed.addresses[0]] = true;
        }
      }
      if (replyTo) {
        parsed = GlodaUtils.parseMailAddresses(replyTo);
        if (!(parsed.addresses[0] in myEmailAddresses)) {
          let identity = GlodaDatastore.getIdentity("email",
                                                    parsed.addresses[0]);
          if (identity)
            existingIdentities.push(identity);
          else
            identitiesToCreate.push(parsed.addresses[0]);
          myEmailAddresses[parsed.addresses[0]] = true;
        }
      }
    }

    // we need to establish the identity.contact portions of the relationship
    for each (let [,identity] in Iterator(existingIdentities)) {
      identity._contact = GlodaDatastore.getContactByID(identity.contactID);
    }
    
    if (existingIdentities.length) {
      // just use the first guy's contact
      myContact = existingIdentities[0].contact;
    }
    else {
      // create a new contact
      myContact = GlodaDatastore.createContact(null, null, fullName || "Me",
                                               0, 0);
      GlodaDatastore.insertContact(myContact);
    }

    if (identitiesToCreate.length) {
      for (let iIdentity = 0; iIdentity < identitiesToCreate.length;
          iIdentity++) {
        let emailAddress = identitiesToCreate[iIdentity];
        // XXX this won't always be of type "email" as we add new account types
        // XXX the blank string could be trying to differentiate; we do have
        //  enough info to do it.
        let identity = GlodaDatastore.createIdentity(myContact.id, myContact,
                                                     "email",
                                                     emailAddress,
                                                     "", false);
        existingIdentities.push(identity);
      }
    }

    for (let iIdentity = 0; iIdentity < existingIdentities.length;
        iIdentity++) {
      let identity = existingIdentities[iIdentity];
      myIdentities[identity.id] = identity;
    }

    this.myContact = myContact;
    this.myIdentities = myIdentities;
    myContact._identities = [identity for each (identity in myIdentities)];
    
    // we need contacts to make these objects reachable via the collection
    //  manager.
    this._myContactCollection = this.explicitCollection(this.NOUN_CONTACT,
                                                        [this.myContact]);
    this._myIdentitiesCollection =
      this.explicitCollection(this.NOUN_IDENTITY, this.myContact._identities);
  },

  /**
   * An attribute that is a defining characteristic of the subject.
   */
  kAttrFundamental: 0,
  /**
   * An attribute that is an optimization derived from two or more fundamental
   *  attributes and exists solely to improve database query performance.
   */
  kAttrOptimization: 1,
  /**
   * An attribute that is derived from the content of the subject.  For example,
   *  a message that references a bugzilla bug could have a "derived" attribute
   *  that captures the bugzilla reference.  This is not
   */
  kAttrDerived: 2,
  /**
   * An attribute that is the result of an explicit and intentional user action
   *  upon the subject.  For example, a tag placed on a message by a user (or
   *  at the user's request by a filter) is explicit.
   */
  kAttrExplicit: 3,
  /**
   * An attribute that is indirectly the result of a user's behaviour.  For
   *  example, if a user consults a message multiple times, we may conclude that
   *  the user finds the message interesting.  It is "implied", if you will,
   *  that the message is interesting.
   */
  kAttrImplicit: 4,

  /**
   * This attribute is not 'special'; it is stored as a (thing id, attribute id,
   *  attribute id) tuple in the database rather than on thing's row or on
   *  thing's fulltext row.  (Where "thing" could be a message or any other
   *  first class noun.)
   */
  kSpecialNotAtAll: GlodaDatastore.kSpecialNotAtAll,
  /**
   * This attribute is stored as a numeric column on the row for the noun.  The
   *  attribute definition should include this value as 'special' and the
   *  column name that stores the attribute as 'specialColumnName'.
   */
  kSpecialColumn: GlodaDatastore.kSpecialColumn,
  kSpecialColumnChildren: GlodaDatastore.kSpecialColumnChildren,
  kSpecialColumnParent: GlodaDatastore.kSpecialColumnParent,
  /**
   * This attribute is stored as a string column on the row for the noun.  It
   *  differs from kSpecialColumn in that it is a string and thus uses different
   *  query mechanisms.
   */
  kSpecialString: GlodaDatastore.kSpecialString,
  /**
   * This attribute is stored as a fulltext column on the fulltext table for
   *  the noun.  The attribute defintion should include this value as 'special'
   *  and the column name that stores the table as 'specialColumnName'.
   */
  kSpecialFulltext: GlodaDatastore.kSpecialFulltext,

  /**
   * The extensionName used for the attributes defined by core gloda plugins
   *  such as fundattr.js and explattr.js.
   */
  BUILT_IN: "built-in",


  /*
   * The following are explicit noun IDs.  While most extension-provided nouns
   *  will have dynamically allocated id's that are looked up by name, these
   *  id's can be relied upon to exist and be accessible via these
   *  pseudo-constants.  It's not really clear that we need these, although it
   *  does potentially simplify code to not have to look up all of their nouns
   *  at initialization time.
   */
  /**
   * Boolean values, expressed as 0/1 in the database and non-continuous for
   *  constraint purposes.  Like numbers, such nouns require their attributes
   *  to provide them with context, lacking any of their own.
   * Having this as a noun type may be a bad idea; a change of nomenclature
   *  (so that we are not claiming a boolean value is a noun, but still using
   *  it in the same way) or implementation to require each boolean noun
   *  actually be its own noun may be in order.
   */
  NOUN_BOOLEAN: 1,
  /**
   * A number, which could mean an integer or floating point values.  We treat
   *  these as continuous, meaning that queries on them can have ranged
   *  constraints expressed on them.  Lacking any inherent context, numbers
   *  depend on their attributes to parameterize them as required.
   * Same deal as with NOUN_BOOLEAN, we may need to change this up conceptually.
   */
  NOUN_NUMBER: 2,
  /**
   * A (non-fulltext) string.
   * Same deal as with NOUN_BOOLEAN, we may need to change this up conceptually.
   */
  NOUN_STRING: 3,
  /** A date, encoded as a PRTime, represented as a js Date object. */
  NOUN_DATE: 10,
  /**
   * Fulltext search support, somewhat magical.  This is only intended to be
   *  used for kSpecialFulltext attributes, and exclusively as a constraint
   *  mechanism.  The values are always represented as strings.  It is presumed
   *  that the user of this functionality knows how to generate SQLite FTS3
   *  style MATCH queries, or is okay with us just gluing them together with
   *  " OR " when used in an or-constraint case.  Gloda's query mechanism
   *  currently lacks the ability to to compile Gloda-style and-constraints
   *  into a single MATCH query, but it will turn out okay, just less
   *  efficiently than it could.
   */
  NOUN_FULLTEXT: 20,
  /**
   * Represents a MIME Type.  We currently lack any human-intelligible
   *  descriptions of mime types.
   */
  NOUN_MIME_TYPE: 40, 
  /**
   * Captures a message tag as well as when the tag's presence was observed,
   *  hoping to approximate when the tag was applied.  It's a somewhat dubious
   *  attempt to not waste our opporunity to store a value along with the tag.
   *  (The tag is actually stored as an attribute parameter on the attribute
   *  definition, rather than a value in the attribute 'instance' for the
   *  message.)
   */
  NOUN_TAG: 50,
  /**
   * Doesn't actually work owing to a lack of an object to represent a folder.
   *  We do expose the folderURI and folderID of a message, but need to map that
   *  to a good abstraction.  Probably something thin around a SteelFolder or
   *  the like; we would contribute the functionality to easily move from a
   *  folder to the list of gloda messages in that folder, as well as the
   *  indexing preferences for that folder.
   * @TODO folder noun and related abstraction
   */
  NOUN_FOLDER: GlodaFolder.prototype.NOUN_ID, // 100
  /**
   * All messages belong to a conversation.  See datamodel.js for the
   *  definition of the GlodaConversation class.
   */
  NOUN_CONVERSATION: GlodaConversation.prototype.NOUN_ID, // 101
  /**
   * A one-to-one correspondence with underlying (indexed) nsIMsgDBHdr
   *  instances.  See datamodel.js for the definition of the GlodaMessage class.
   */
  NOUN_MESSAGE: GlodaMessage.prototype.NOUN_ID, // 102
  /**
   * Corresponds to a human being, who may have multiple electronic identities
   *  (a la NOUN_IDENTITY).  There is no requirement for association with an
   *  address book contact, although when the address book contact exists,
   *  we want to be associated with it.  See datamodel.js for the definition
   *  of the GlodaContact class.
   */
  NOUN_CONTACT: GlodaContact.prototype.NOUN_ID, // 103
  /**
   * A single identity of a contact, who may have one or more.  E-mail accounts,
   *  instant messaging accounts, social network site accounts, etc. are each
   *  identities.  See datamodel.js for the definition of the GlodaIdentity
   *  class.
   */
  NOUN_IDENTITY: GlodaIdentity.prototype.NOUN_ID, // 104

  /**
   * Parameterized identities, for use in the from-me, to-me, cc-me optimization
   *  cases.  Not for reuse without some thought.  These nouns use the parameter
   *  to store the 'me' identity that we are talking about, and the value to
   *  store the identity of the other party.  So in both the from-me and to-me
   *  cases involving 'me' and 'foo@bar', the 'me' identity is always stored via
   *  the attribute parameter, and the 'foo@bar' identity is always stored as
   *  the attribute value.  See fundattr.js for more information on this, but
   *  you probably shouldn't be touching this unless you are fundattr.
   */
  NOUN_PARAM_IDENTITY: 200,

  /** Next Noun ID to hand out, these don't need to be persisted (for now). */
  _nextNounID: 1000,

  /**
   * Maps noun names to noun IDs.
   */
  _nounNameToNounID: {},
  /**
   * Maps noun IDs to noun definition dictionaries.  (Noun definition
   *  dictionaries provided to us at the time a noun was defined, plus some
   *  additional stuff we put in there.)
   */
  _nounIDToDef: {},
  
  _managedToJSON: function gloda_ns_managedToJSON(aItem) {
    return aItem.id;
  },

  /**
   * Define a noun.  Takes a dictionary with the following keys/values:
   *
   * @param name The name of the noun.  This is not a display name (anything
   *     being displayed needs to be localized, after all), but simply the
   *     canonical name for debugging purposes and for people to pass to
   *     lookupNoun.  The suggested convention is lower-case-dash-delimited,
   *     with names being singular (since it's a single noun we are referring
   *     to.)
   * @param class The 'class' to which an instance of the noun will belong (aka
   *     will pass an instanceof test).
   * @param allowsArbitraryAttrs Is this a 'first class noun'/can it be a subject, AKA can
   *     this noun have attributes stored on it that relate it to other things?
   *     For example, a message is first-class; we store attributes of
   *     messages.  A date is not first-class now, nor is it likely to be; we
   *     will not store attributes about a date, although dates will be the
   *     objects of other subjects.  (For example: we might associate a date
   *     with a calendar event, but the date is an attribute of the calendar
   *     event and not vice versa.)
   * @param usesParameter A boolean indicating whether this noun requires use
   *     of the 'parameter' BLOB storage field on the attribute bindings in the
   *     database to persist itself.  Use of parameters should be limited
   *     to a reasonable number of values (16-32 is okay, more than that is
   *     pushing it and 256 should be considered an absolute upper bound)
   *     because of the database organization.  When false, your toParamAndValue
   *     function is expected to return null for the parameter and likewise your
   *     fromParamAndValue should expect ignore and generally ignore the
   *     argument.
   * @param toParamAndValue A function that takes an instantiated noun
   *     instance and returns a 2-element list of [parameter, value] where
   *     parameter may only be non-null if you passed a usesParameter of true.
   *     Parameter may be of any type (BLOB), and value must be numeric (pass
   *     0 if you don't need the value).
   */
  defineNoun: function gloda_ns_defineNoun(aNounDef, aNounID) {
    this._log.info("Defining noun: " + aNounDef.name);
    if (aNounID === undefined)
      aNounID = this._nextNounID++;
    aNounDef.id = aNounID;
    // if it has a table, you can query on it.  seems straight-forward.
    if (aNounDef.tableName) {
      [aNounDef.queryClass, aNounDef.nullQueryClass,
       aNounDef.explicitQueryClass, aNounDef.wildcardQueryClass] =
          GlodaQueryClassFactory(aNounDef);
      aNounDef._dbMeta = {};
      aNounDef.class.prototype.NOUN_DEF = aNounDef;
      aNounDef.toJSON = this._managedToJSON;
      
      aNounDef.specialLoadAttribs = [];

      // - define the 'id' constrainer
      let idConstrainer = function() {
        let constraint = [GlodaDatastore.kConstraintIdIn, null];
        for (let iArg = 0; iArg < arguments.length; iArg++) {
          constraint.push(arguments[iArg]);
        }
        this._constraints.push(constraint);
        return this;
      };
      aNounDef.queryClass.prototype.id = idConstrainer;
    }
    if (aNounDef.cache) {
      let cacheCost = aNounDef.cacheCost || 1024;
      let cacheBudget = aNounDef.cacheBudget || 128 * 1024;
      let cacheSize = Math.floor(cacheBudget / cacheCost);
      if (cacheSize)
        GlodaCollectionManager.defineCache(aNounDef, cacheSize);
    }
    aNounDef.attribsByBoundName = {};
    aNounDef.domExposeAttribsByBoundName = {};
    
    aNounDef.objectNounOfAttributes = [];

    this._nounNameToNounID[aNounDef.name] = aNounID;
    this._nounIDToDef[aNounID] = aNounDef;
    aNounDef.actions = [];
    
    this._attrProviderOrderByNoun[aNounDef.id] = [];
    this._attrOptimizerOrderByNoun[aNounDef.id] = [];
    this._attrProvidersByNoun[aNounDef.id] = {};
  },

  /**
   * Lookup a noun (ID) suitable for passing to defineAttribute's various
   *  noun arguments.  Throws an exception if the noun with the given name
   *  cannot be found; the assumption is that you can't live without the noun.
   */
  lookupNoun: function gloda_ns_lookupNoun(aNounName) {
    if (aNounName in this._nounNameToNounID)
      return this._nounNameToNounID[aNounName];

    throw Error("Unable to locate noun with name '" + aNounName + "', but I " +
                "do know about: " +
                [propName for
                 (propName in this._nounNameToNounID)].join(", "));
  },

  /**
   * Lookup a noun def given a name.
   */
  lookupNounDef: function gloda_ns_lookupNoun(aNounName) {
    return this._nounIDToDef[this.lookupNoun(aNounName)];
  },

  
  /**
   * Define an action on a noun.  During the prototype stage, this was conceived
   *  of as a way to expose all the constraints possible given a noun.  For
   *  example, if you have an identity or a contact, you could use this to
   *  see all the messages sent from/to a given contact.  It was likewise
   *  thought potentially usable for future expansion.  For example, you could
   *  also decide to send an e-mail to a contact when you have the contact
   *  instance available.
   * Outside of the 'expmess' checkbox-happy prototype, this functionality is
   *  not used.  As such, this functionality should be considered in flux and
   *  subject to changes.  Also, very open to specific suggestsions motivated
   *  by use cases.
   * One conceptual issue raised by this mechanism is the interaction of actions
   *  with facts like "this message is read".  We currently implement the 'fact'
   *  by defining an attribute with a 'boolean' noun type.  To deal with this,
   *  in various places we pass-in the attribute as well as the noun value.
   *  Since the relationships for booleans and integers in these cases is
   *  standard and well-defined, this works out pretty well, but suggests we
   *  need to think things through.
   *
   * @param aNounID The ID of the noun you want to define an action on.
   * @param aActionMeta The dictionary describing the noun.  The dictionary
   *     should have the following fields:
   * - actionType: a string indicating the type of action.  Currently, only
   *   "filter" is a legal value.
   * - actionTarget: the noun ID of the noun type on which this action is
   *   applicable.  For example,
   *
   * The following should be present for actionType=="filter";
   * - shortName: The name that should be used to display this constraint.  For
   *   example, a checkbox-heavy UI might display a checkbox for each constraint
   *   using shortName as the label.
   * - makeConstraint: A function that takes the attribute that is the source
   *   of the noun and the noun instance as arguments, and returns APV-style
   *   constraints.  Since the APV-style query mechanism is now deprecated,
   *   this signature is deprecated.  Probably the way to update this would be
   *   to pass in the query instance that constraints should be contributed to.
   */
  defineNounAction: function gloda_ns_defineNounAction(aNounID, aActionMeta) {
    let nounDef = this._nounIDToDef[aNounID];
    nounDef.actions.push(aActionMeta);
  },

  /**
   * Retrieve all of the actions (as defined using defineNounAction) for the
   *  given noun type (via noun ID) with the given action type (ex: filter).
   */
  getNounActions: function gloda_ns_getNounActions(aNounID, aActionType) {
    let nounDef = this._nounIDToDef[aNounID];
    if (!nounDef)
      return [];
    return [action for each ([i, action] in Iterator(nounDef.actions))
            if (!aActionType || (action.actionType == aActionType))];
  },

  /** Attribute providers in the sequence to process them. */
  _attrProviderOrderByNoun: {},
  /** Attribute providers that provide optimizers, in the sequence to proc. */
  _attrOptimizerOrderByNoun: {},
  /** Maps attribute providers to the list of attributes they provide */
  _attrProviders: {},
  /**
   * Maps nouns to their attribute providers to a list of the attributes they
   *  provide for the noun.
   */
  _attrProvidersByNoun: {},

  /**
   * Define the core nouns (that are not defined elsewhere) and a few noun
   *  actions.  Core nouns could be defined in other files, assuming dependency
   *  issues are resolved via the everybody.js mechanism or something else.
   *  Right now, noun_tag defines the tag noun.  If we broke more of these out,
   *  we would probably want to move the 'class' code from datamodel.js, the
   *  SQL table def and helper code from datastore.js (and this code) to their
   *  own noun_*.js files.  There are some trade-offs to be made, and I think
   *  we can deal with those once we start to integrate lightning/calendar and
   *  our noun space gets large and more heterogeneous.
   */
  _initAttributes: function gloda_ns_initAttributes() {
    this.defineNoun({
      name: "bool",
      class: Boolean, allowsArbitraryAttrs: false,
      toParamAndValue: function(aBool) {
        return [null, aBool ? 1 : 0];
      }}, this.NOUN_BOOLEAN);
    this.defineNoun({
      name: "number",
      class: Number, allowsArbitraryAttrs: false, continuous: true,
      toParamAndValue: function(aNum) {
        return [null, aNum];
      }}, this.NOUN_NUMBER);
    this.defineNoun({
      name: "string",
      class: String, allowsArbitraryAttrs: false,
      toParamAndValue: function(aString) {
        return [null, aString];
      }}, this.NOUN_STRING);
    this.defineNoun({
      name: "date",
      class: Date, allowsArbitraryAttrs: false, continuous: true,
      toParamAndValue: function(aDate) {
        return [null, aDate.valueOf() * 1000];
      }}, this.NOUN_DATE);
    this.defineNoun({
      name: "fulltext",
      class: String, allowsArbitraryAttrs: false, continuous: false,
      // as noted on NOUN_FULLTEXT, we just pass the string around.  it never
      //  hits the database, so it's okay.
      toParamAndValue: function(aString) {
        return [null, aString];
      }}, this.NOUN_FULLTEXT);

    this.defineNoun({
      name: "folder",
      class: GlodaFolder,
      allowsArbitraryAttrs: false,
      toParamAndValue: function(aFolderOrGlodaFolder) {
        if (aFolderOrGlodaFolder instanceof GlodaFolder)
          return [null, aFolderOrGlodaFolder.id];
        else
          return [null, GlodaDatastore._mapFolder(aFolderOrGlodaFolder).id];
      }}, this.NOUN_FOLDER);
    this.defineNoun({
      name: "conversation",
      class: GlodaConversation,
      allowsArbitraryAttrs: false,
      cache: true, cacheCost: 512,
      tableName: "conversations",
      attrTableName: "messageAttributes", attrIDColumnName: "conversationID",
      datastore: GlodaDatastore,
      objFromRow: GlodaDatastore._conversationFromRow,
      toParamAndValue: function(aConversation) {
        if (aConversation instanceof GlodaConversation)
          return [null, aConversation.id];
        else // assume they're just passing the id directly
          return [null, aConversation];
      }}, this.NOUN_CONVERSATION);
    this.defineNoun({
      name: "message",
      class: GlodaMessage,
      allowsArbitraryAttrs: true,
      cache: true, cacheCost: 2048,
      tableName: "messages",
      attrTableName: "messageAttributes", attrIDColumnName: "messageID",
      datastore: GlodaDatastore, objFromRow: GlodaDatastore._messageFromRow,
      dbAttribAdjuster: GlodaDatastore.adjustMessageAttributes,
      objInsert: GlodaDatastore.insertMessage,
      objUpdate: GlodaDatastore.updateMessage,
      toParamAndValue: function(aMessage) {
        if (aMessage instanceof GlodaMessage)
          return [null, aMessage.id];
        else // assume they're just passing the id directly
          return [null, aMessage];
      }}, this.NOUN_MESSAGE);
    this.defineNoun({
      name: "contact",
      class: GlodaContact,
      allowsArbitraryAttrs: true,
      cache: true, cacheCost: 128,
      tableName: "contacts",
      attrTableName: "contactAttributes", attrIDColumnName: "contactID",
      datastore: GlodaDatastore, objFromRow: GlodaDatastore._contactFromRow,
      dbAttribAdjuster: GlodaDatastore.adjustAttributes,
      objInsert: GlodaDatastore.insertContact,
      objUpdate: GlodaDatastore.updateContact,
      toParamAndValue: function(aContact) {
        if (aContact instanceof GlodaContact)
          return [null, aContact.id];
        else // assume they're just passing the id directly
          return [null, aContact];
      }}, this.NOUN_CONTACT);
    this.defineNoun({
      name: "identity",
      class: GlodaIdentity,
      allowsArbitraryAttrs: false,
      cache: true, cacheCost: 128,
      usesUniqueValue: true,
      tableName: "identities",
      datastore: GlodaDatastore, objFromRow: GlodaDatastore._identityFromRow,
      toParamAndValue: function(aIdentity) {
        if (aIdentity instanceof GlodaIdentity)
          return [null, aIdentity.id];
        else // assume they're just passing the id directly
          return [null, aIdentity];
      }}, this.NOUN_IDENTITY);

    // parameterized identity is just two identities; we store the first one
    //  (whose value set must be very constrainted, like the 'me' identities)
    //  as the parameter, the second (which does not need to be constrained)
    //  as the value.
    this.defineNoun({
      name: "parameterized-identity",
      class: null,
      allowsArbitraryAttrs: false,
      computeDelta: function(aCurValues, aOldValues) {
        let oldMap = {};
        for each (let [, tupe] in Iterator(aOldValues)) {
          let [originIdentity, targetIdentity] = tupe;
          let targets = oldMap[originIdentity];
          if (targets === undefined)
            targets = oldMap[originIdentity] = {};
          targets[targetIdentity] = true;
        }
        
        let added = [], removed = [];
        for each (let [, tupe] in Iterator(aCurValues)) {
          let [originIdentity, targetIdentity] = tupe;
          let targets = oldMap[originIdentity];
          if ((targets === undefined) || !(targetIdentity in targets))
            added.push(tupe);
          else
            delete targets[targetIdentity];
        }
        
        for each (let [originIdentity, targets] in Iterator(oldMap)) {
          for (let targetIdentity in targets) {
            removed.push([originIdentity, targetIdentity]);
          }
        }
        
        return [added, removed];
      },
      contributeObjDependencies: function(aJsonValues, aReferencesByNounID,
          aInverseReferencesByNounID) {
        // nothing to do with a zero-length list
        if (aJsonValues.length == 0)
          return false;
      
        let nounIdentityDef = Gloda._nounIDToDef[Gloda.NOUN_IDENTITY]
        let references = aReferencesByNounID[nounIdentityDef.id];
        if (references === undefined)
          references = aReferencesByNounID[nounIdentityDef.id] = {};
        
        for each (let [, tupe] in Iterator(aJsonValues)) {
          let [originIdentityID, targetIdentityID] = tupe;
          if (!(originIdentityID in references))
            references[originIdentityID] = null;
          if (!(targetIdentityID in references))
            references[targetIdentityID] = null;
        }
        
        return true;
      },
      resolveObjDependencies: function(aJsonValues, aReferencesByNounID,
          aInverseReferencesByNounID) {
        let references =
          aReferencesByNounID[Gloda.NOUN_IDENTITY];
        
        let results = [];
        for each (let [, tupe] in Iterator(aJsonValues)) {
          let [originIdentityID, targetIdentityID] = tupe;
          results.push([references[originIdentityID],
                        references[targetIdentityID]]);
        }
        
        return results;
      },
      toJSON: function (aIdentityTuple) {
        return [aIdentityTuple[0].id, aIdentityTuple[1].id];
      },
      toParamAndValue: function(aIdentityTuple) {
        return [aIdentityTuple[0].id, aIdentityTuple[1].id];
      }}, this.NOUN_PARAM_IDENTITY);

    GlodaDatastore.getAllAttributes();
  },

  /**
   * Create accessor functions to 'bind' an attribute to underlying normalized
   *  attribute storage, as well as creating the appropriate query object
   *  constraint helper functions.  This name is somewhat of a misnomer because
   *  special attributes are not 'bound' (because specific/non-generic per-class
   *  code provides the properties) but still depend on this method to
   *  establish their constraint helper methods.
   *
   * @XXX potentially rename to not suggest binding is required.
   */
  _bindAttribute: function gloda_ns_bindAttr(aAttrDef, aSubjectNounDef) {
    let objectNounDef = aAttrDef.objectNounDef;

    // -- the query constraint helpers
    if (aSubjectNounDef.queryClass !== undefined) {
      let constrainer;
      // non-strings can use IN
      if (aAttrDef.special == this.kSpecialFulltext) {
        constrainer = function() {
          let constraint = [GlodaDatastore.kConstraintFulltext, aAttrDef];
          for (let iArg = 0; iArg < arguments.length; iArg++) {
            constraint.push(arguments[iArg]);
          }
          this._constraints.push(constraint);
          return this;
        };
      }
      else if (aAttrDef.special != this.kSpecialString) {
        constrainer = function() {
          let constraint = [GlodaDatastore.kConstraintIn, aAttrDef];
          for (let iArg = 0; iArg < arguments.length; iArg++) {
            constraint.push(arguments[iArg]);
          }
          this._constraints.push(constraint);
          return this;
        };
      }
      else { // strings need to use equals for escaping reasons
        // (we could introduce an 'escaped' in that we manually escape though)
        constrainer = function() {
          let constraint = [GlodaDatastore.kConstraintEquals, aAttrDef];
          for (let iArg = 0; iArg < arguments.length; iArg++) {
            constraint.push(arguments[iArg]);
          }
          this._constraints.push(constraint);
          return this;
        };
      }

      aSubjectNounDef.queryClass.prototype[aAttrDef.boundName] = constrainer;

      // - ranged value helper: fooRange
      if (objectNounDef.continuous) {
        // takes one or more tuples of [lower bound, upper bound]
        let rangedConstrainer = function() {
          let constraint = [GlodaDatastore.kConstraintRanges, aAttrDef];
          for (let iArg = 0; iArg < arguments.length; iArg++ ) {
            constraint.push(arguments[iArg]);
          }
          this._constraints.push(constraints);
          return this;
        }

        aSubjectNounDef.queryClass.prototype[aAttrDef.boundName + "Range"] =
          rangedConstrainer;
      }

      // - string LIKE helper for special on-row attributes: fooLike
      // (it is impossible to store a string as an indexed attribute, which is
      //  why we do this for on-row only.)
      if (aAttrDef.special == this.kSpecialString) {
        let likeConstrainer = function() {
          let constraint = [GlodaDatastore.kConstraintStringLike, aAttrDef];
          for (let iArg = 0; iArg < arguments.length; iArg++) {
            constraint.push(arguments[iArg]);
          }
          this._constraints.push(constraint);
          return this;
        }

        aSubjectNounDef.queryClass.prototype[aAttrDef.boundName + "Like"] =
          likeConstrainer;
      }
    }
  },

  /**
   * Define an attribute and all its meta-data.  Takes a single dictionary as
   *  its argument, with the following required properties:
   *
   * @param provider The object instance providing a 'process' method.
   * @param extensionName The name of the extension providing these attributes.
   * @param attributeType The type of attribute, one of the values from the
   *     kAttr* enumeration.
   * @param attributeName The name of the attribute, which also doubles as the
   *     bound property name if you pass 'bind' a value of true.  You are
   *     responsible for avoiding collisions, which presumably will mean
   *     checking/updating a wiki page in the future, or just prefixing your
   *     attribute name with your extension name or something like that.
   * @param bind Should this attribute be 'bound' as a convenience attribute
   *     on the subject's object (true/false)?  For example, with an
   *     attributeName of "foo" and passing true for 'bind' with a subject noun
   *     of NOUN_MESSAGE, GlodaMessage instances will expose a "foo" getter
   *     that returns the value of the attribute.  If 'singular' is true, this
   *     means an instance of the object class corresponding to the noun type or
   *     null if the attribute does not exist.  If 'singular' is false, this
   *     means a list of instances of the object class corresponding to the noun
   *     type, where the list may be empty if no instances of the attribute are
   *     present.
   * @param bindName Optional override of attributeName for purposes of the
   *     binding property's name.
   * @param singular Is the attribute going to happen at most once (true),
   *     or potentially multiple times (false).  This affects whether
   *     the binding  returns a list or just a single item (which is null when
   *     the attribute is not present).
   * @param subjectNouns A list of object types (NOUNs) that this attribute can
   *     be set on.  Each element in the list should be one of the NOUN_*
   *     constants or a dynamically registered noun type.
   * @param objectNoun The object type (one of the NOUN_* constants or a
   *     dynamically registered noun types) that is the 'object' in the
   *     traditional RDF triple.  More pragmatically, in the database row used
   *     to represent an attribute, we store the subject (ex: message ID),
   *     attribute ID, and an integer which is the integer representation of the
   *     'object' whose type you are defining right here.
   */
  defineAttribute: function gloda_ns_defineAttribute(aAttrDef) {
    // ensure required properties exist on aAttrDef
    if (!("provider" in aAttrDef) ||
        !("extensionName" in aAttrDef) ||
        !("attributeType" in aAttrDef) ||
        !("attributeName" in aAttrDef) ||
        !("singular" in aAttrDef) ||
        !("subjectNouns" in aAttrDef) ||
        !("objectNoun" in aAttrDef))
      // perhaps we should have a list of required attributes, perchance with
      //  and explanation of what it holds, and use that to be friendlier?
      throw Error("You omitted a required attribute defining property, please" +
                  " consult the documentation as penance.")

    // return if the attribute has already been defined
    if (aAttrDef.dbDef) {
      return aAttrDef;
    }

    // provider tracking
    if (!(aAttrDef.provider.providerName in this._attrProviders)) {
      this._attrProviders[aAttrDef.provider.providerName] = [];
    }

    let compoundName = aAttrDef.extensionName + ":" + aAttrDef.attributeName;
    let attrDBDef;
    if (compoundName in GlodaDatastore._attributeDBDefs) {
      // the existence of the GlodaAttributeDBDef means that either it has
      //  already been fully defined, or has been loaded from the database but
      //  not yet 'bound' to a provider (and had important meta-info that
      //  doesn't go in the db copied over)
      attrDBDef = GlodaDatastore._attributeDBDefs[compoundName];
    }
    // we need to create the attribute definition in the database
    else {
      let attrID = null;
      attrID = GlodaDatastore._createAttributeDef(aAttrDef.attributeType,
                                                  aAttrDef.extensionName,
                                                  aAttrDef.attributeName,
                                                  null);
    
      attrDBDef = new GlodaAttributeDBDef(GlodaDatastore, attrID, compoundName,
        aAttrDef.attributeType, aAttrDef.extensionName, aAttrDef.attributeName);
      GlodaDatastore._attributeDBDefs[compoundName] = attrDBDef;
      GlodaDatastore._attributeIDToDBDefAndParam[attrID] = [attrDBDef, null];
    }
    
    aAttrDef.dbDef = attrDBDef;
    attrDBDef.attrDef = aAttrDef;
    
    aAttrDef.id = aAttrDef.dbDef.id;

    if ("bindName" in aAttrDef)
      aAttrDef.boundName = aAttrDef.bindName;
    else
      aAttrDef.boundName = aAttrDef.attributeName;
    
    aAttrDef.objectNounDef = this._nounIDToDef[aAttrDef.objectNoun];
    aAttrDef.objectNounDef.objectNounOfAttributes.push(aAttrDef);

    for (let iSubject = 0; iSubject < aAttrDef.subjectNouns.length;
           iSubject++) {
      let subjectType = aAttrDef.subjectNouns[iSubject];
      let subjectNounDef = this._nounIDToDef[subjectType];
      this._bindAttribute(aAttrDef, subjectNounDef);

      // update the provider maps...
      if (this._attrProviderOrderByNoun[subjectType]
              .indexOf(aAttrDef.provider) == -1) {
        this._attrProviderOrderByNoun[subjectType].push(aAttrDef.provider);
        if (aAttrDef.provider.optimize)
          this._attrOptimizerOrderByNoun[subjectType].push(aAttrDef.provider);
        this._attrProvidersByNoun[subjectType][aAttrDef.provider] = [];
      }
      this._attrProvidersByNoun[subjectType][aAttrDef.provider].push(aAttrDef);
      
      subjectNounDef.attribsByBoundName[aAttrDef.boundName] = aAttrDef;
      if (aAttrDef.domExpose)
        subjectNounDef.domExposeAttribsByBoundName[aAttrDef.boundName] =
          aAttrDef;
      
      if (aAttrDef.special & this.kSpecialColumn)
        subjectNounDef.specialLoadAttribs.push(aAttrDef);
      
      // if this is a parent column attribute, make note of it so that if we
      //  need to do an inverse references lookup, we know what column we are
      //  issuing against.
      if (aAttrDef.special === this.kSpecialColumnParent) {
        subjectNounDef.parentColumnAttr = aAttrDef;
      }
      
      if (aAttrDef.objectNounDef.tableName ||
          aAttrDef.objectNounDef.contributeObjDependencies) {
        subjectNounDef.hasObjDependencies = true;
      }
    }
    
    this._attrProviders[aAttrDef.provider.providerName].push(aAttrDef);
    return aAttrDef;
  },

  /**
   * Retrieve the attribute provided by the given extension with the given
   *  attribute name.  The original idea was that plugins would effectively
   *  name-space attributes, helping avoid collisions.  Since we are leaning
   *  towards using binding heavily, this doesn't really help, as the collisions
   *  will just occur on the attribute name instead.  Also, this can turn
   *  extensions into liars as name changes/moves to core/etc. happen.
   * @TODO consider removing the extension name argument parameter requirement
   */
  getAttrDef: function gloda_ns_getAttrDef(aPluginName, aAttrName) {
    let compoundName = aPluginName + ":" + aAttrName;
    return GlodaDatastore._attributeDBDefs[compoundName];
  },

  /**
   * Define a SQL table for plug-ins.  This is intended to be used by
   *  extensions/plug-ins whose storage needs exceed those provided by the
   *  attribute parameter (on the attribute definition)/attribute value (on the
   *  attribute instance) idiom.  (This includes extensions whose parameter
   *  usage would exceed acceptable cardinality.)  They can create a table
   *  to store information on their nouns, using their row id (commonly "id")
   *  as the attribute value.
   * The current implementation was for a prototype and this should not be
   *  interpreted as our final approach.  Our goal is just to make it easy to
   *  add your own data-type and have it interact with the rest of the gloda
   *  schema.  We don't really want to be a be-all, end-all JS ORM (object
   *  relational mapper), though we started down that road.
   *
   * The argument should be a dictionary with the following keys:
   * @param name The table name; don't conflict with other things!
   * @param columns A list of [column name, sqlite type] tuples.  You should
   *     always include a definition like ["id", "INTEGER PRIMARY KEY"] for
   *     now.
   * @param indices A dictionary of lists of column names, where the key name
   *     becomes the index name.  Ex: {foo: ["bar"]} results in an index on
   *     the column "bar" where the index is named "foo".
   */
  defineTable: function gloda_ns_defineTable(aTableDef) {
    return GlodaDatastore.createTableIfNotExists(aTableDef);
  },

  /**
   * Create a new query instance for the given noun-type.  This provides
   *  a generic way to provide constraint-based queries of any first-class
   *  nouns supported by the system.
   *
   * The idea is that every attribute on an object can be used to express
   *  a constraint on the query object.  Constraints implicitly 'AND' together,
   *  but providing multiple arguments to a constraint function results in an
   *  'OR'ing of those values.  Additionally, you can call or() on the returned
   *  query to create an alternate query that is effectively a giant OR against
   *  all the constraints you create on the main query object (or any other
   *  alternate queries returned by or()).  (Note: there is no nesting of these
   *  alternate queries. query.or().or() is equivalent to query.or())
   * For each attribute, there is a constraint with the same name that takes
   *  one or more arguments.  The arguments represent a set of OR values that
   *  objects matching the query can have.  (If you want the constraint
   *  effectively ANDed together, just invoke the constraint function
   *  multiple times.)  For example, newQuery(NOUN_PERSON).age(25) would
   *  constraint to all the people aged 25, while age(25, 26) would constrain
   *  to all the people age 25 or 26.
   * For each attribute with a 'continuous' noun, there is a constraint with the
   *  attribute name with "Range" appended.  It takes two arguments which are an
   *  inclusive lower bound and an inclusive lower bound for values in the
   *  range.  If you would like an open-ended range on either side, pass null
   *  for that argument.  If you would like to specify multiple ranges that
   *  should be ORed together, simply pass additional (pairs of) arguments.
   *  For example, newQuery(NOUN_PERSON).age(25,100) would constraint to all
   *  the people who are >= 25 and <= 100.  Likewise age(25, null) would just
   *  return all the people who are 25 or older.  And age(25,30,35,40) would
   *  return people who are either 25-30 or 35-30.
   * There are also full-text constraint columns.  In a nutshell, their
   *  arguments are the strings that should be passed to the SQLite FTS3
   *  MATCH clause.
   */
  newQuery: function gloda_ns_newQuery(aNounID) {
    let nounDef = this._nounIDToDef[aNounID];
    return new nounDef.queryClass();
  },

  /**
   * Create a collection/query for the given noun-type that only matches the
   *  provided items.  This is to be used when you have an explicit set of items
   *  that you would still like to receive updates for.
   */
  explicitCollection: function gloda_ns_explicitCollection(aNounID, aItems) {
    let nounDef = this._nounIDToDef[aNounID];
    let collection = new GlodaCollection(nounDef, aItems, null, null)
    let query = new nounDef.explicitQueryClass(collection);
    collection.query = query;
    GlodaCollectionManager.registerCollection(collection);
    return collection;
  },

  /**
   * Debugging 'wildcard' collection creation support.  A wildcard collection
   *  will 'accept' any new item instances presented to the collection manager
   *  as new.  The result is that it allows you to be notified as new items
   *  as they are indexed, existing items as they are loaded from the database,
   *  etc.
   * Because the items are added to the collection without limit, this will
   *  result in a leak if you don't do something to clean up after the
   *  collection.  (Forgetting about the collection will suffice, as it is still
   *  weakly held.)
   */
  _wildcardCollection: function gloda_ns_wildcardCollection(aNounID, aItems) {
    let nounDef = this._nounIDToDef[aNounID];
    let collection = new GlodaCollection(nounDef, aItems, null, null)
    let query = new nounDef.wildcardQueryClass(collection);
    collection.query = query;
    GlodaCollectionManager.registerCollection(collection);
    return collection;
  },

  /**
   * Populate a gloda representation of an item given the thus-far built
   *  representation, the previous representation, and one or more raw
   *  representations.
   *
   * The result of the processing ends up with attributes in 3 different forms:
   * - Database attribute rows (to be added and removed).
   * - In-memory representation.
   * - JSON-able representation.
   */
  grokNounItem: function gloda_ns_grokNounItem(aItem, aRawReps, aIsNew,
      aCallbackHandle, aDoCache) {
    let itemNounDef = this._nounIDToDef[aItem.NOUN_ID];
    let attribsByBoundName = itemNounDef.attribsByBoundName;
    
    this._log.info(" ** grokNounItem: " + itemNounDef.name);
    
    let addDBAttribs = [];
    let removeDBAttribs = [];
    
    let jsonDict = {};
    
    let aOldItem;
    if (aIsNew) // there is no old item if we are new.
      aOldItem = {};
    else {
      aOldItem = aItem;
      // we want to create a clone of the existing item so that we can know the
      //  deltas that happened for indexing purposes
      aItem = aItem._clone();
    }
  
    // Have the attribute providers directly set properties on the aItem
    let attrProviders = this._attrProviderOrderByNoun[aItem.NOUN_ID];
    for (let iProvider = 0; iProvider < attrProviders.length; iProvider++) {
      this._log.info("  * provider: " + attrProviders[iProvider].providerName);
      yield aCallbackHandle.pushAndGo(
        attrProviders[iProvider].process(aItem, aRawReps, aIsNew,
                                         aCallbackHandle));
    }
    
    let attrOptimizers = this._attrOptimizerOrderByNoun[aItem.NOUN_ID];
    for (let iProvider = 0; iProvider < attrOptimizers.length; iProvider++) {
      this._log.info("  * optimizer: " + attrOptimizers[iProvider].providerName);
      yield aCallbackHandle.pushAndGo(
        attrOptimizers[iProvider].optimize(aItem, aRawReps, aIsNew,
                                           aCallbackHandle));
    }
    
    this._log.info(" ** done with providers.");
  
    // Iterate over the attributes on the item
    for each (let [key, value] in Iterator(aItem)) {
      // ignore keys that start with underscores, they are private and not
      //  persisted by our attribute mechanism.  (they are directly handled by
      //  the object implementation.)
      if (key[0] == "_")
        continue;
      // find the attribute definition that corresponds to this key
      let attrib = attribsByBoundName[key];
      // if there's no attribute, that's not good, but not horrible.
      if (attrib === undefined) {
        this._log.warn("new proc ignoring attrib: " + key);
        continue;
      }

      let attribDB = attrib.dbDef;
      let objectNounDef = attrib.objectNounDef;
      
      // - translate for our JSON rep
      if (attrib.singular) {
        if (objectNounDef.toJSON)
          jsonDict[attrib.id] = objectNounDef.toJSON(value);
        else
          jsonDict[attrib.id] = value; 
      }
      else {
        if (objectNounDef.toJSON) {
          toJSON = objectNounDef.toJSON;
          jsonDict[attrib.id] = [toJSON(subValue) for each
                           ([, subValue] in Iterator(value))] ;
        }
        else
          jsonDict[attrib.id] = value;
      }
      
      // perform a delta analysis against the old value, if we have one
      let oldValue = aOldItem[key];
      if (oldValue !== undefined) {
        // in the singular case if they don't match, it's one add and one remove
        if (attrib.singular) {
          // test for identicality, failing that, see if they have explicit
          //  equals support.
          if ((value !== oldValue) &&
              (!value.equals || !value.equals(oldValue))) {
            addDBAttribs.push(attribDB.convertValuesToDBAttributes([value])[0]);
            removeDBAttribs.push(
              attribDB.convertValuesToDBAttributes([oldValue])[0]);
          }
        }
        // in the plural case, we have to figure the deltas accounting for
        //  possible changes in ordering (which is insignificant from an
        //  indexing perspective)
        // some nouns may not meet === equivalence needs, so must provide a
        //  custom computeDelta method to help us out
        else if (objectNounDef.computeDelta) {
          let [valuesAdded, valuesRemoved] = 
            objectNounDef.computeDelta(value, oldValue);
          // convert the values to database-style attribute rows
          addDBAttribs.push.apply(addDBAttribs,
            attribDB.convertValuesToDBAttributes(valuesAdded));
          removeDBAttribs.push.apply(removeDBAttribs,
            attribDB.convertValuesToDBAttributes(valuesRemoved));
        }
        else {
          // build a map of the previous values; we will delete the values as
          //  we see them so that we will know what old values are no longer
          //  present in the current set of values.
          let oldValueMap = {};
          for each (let [, anOldValue] in Iterator(oldValue)) {
            // remember, the key is just the toString'ed value, so we need to
            //  store and use the actual value as the value!
            oldValueMap[anOldValue] = anOldValue;
          }
          // traverse the current values...
          let valuesAdded = [];
          for each (let [, curValue] in Iterator(value)) {
            if (curValue in oldValueMap)
              delete oldValueMap[curValue];
            else
              valuesAdded.push(curValue);
          }
          // anything still on oldValueMap was removed.
          let valuesRemoved = [val for each (val in oldValueMap)];
          // convert the values to database-style attribute rows
          addDBAttribs.push.apply(addDBAttribs,
            attribDB.convertValuesToDBAttributes(valuesAdded));
          removeDBAttribs.push.apply(removeDBAttribs,
            attribDB.convertValuesToDBAttributes(valuesRemoved));
        }
      
        // replace the old value with the new values... (the 'old' item is
        //  canonical)
        aOldItem[key] = value; 
      }
      // no old value, all values are new
      else {
        // the 'old' item is still the canonical one; update it
        if (!aIsNew)
          aOldItem[key] = value;
        // add the db reps on the new values
        if (attrib.singular)
          value = [value];
        addDBAttribs.push.apply(addDBAttribs,
                                attribDB.convertValuesToDBAttributes(value));
      }
    }
    
    // Iterate over any remaining values in old items for purge purposes.
    for each (let [key, value] in Iterator(aOldItem)) {
      // ignore keys that start with underscores, they are private and not
      //  persisted by our attribute mechanism.  (they are directly handled by
      //  the object implementation.)
      if (key[0] == "_")
        continue;
      // ignore things we saw in the new guy
      if (key in aItem)
        continue;
      
      // find the attribute definition that corresponds to this key
      let attrib = attribsByBoundName[key];
      // if there's no attribute, that's not good, but not horrible.
      if (attrib === undefined) {
        continue;
      }
      let attribDB = attrib.dbDef;
      removeDBAttribs.push.apply(removeDBAttribs,
                                 attribDB.convertValuesToDBAttributes(value));
      // delete these from the old item, as the old item is canonical, and
      //  should no longer have these values
      delete aOldItem[key];
    }
    
    aItem._jsonText = this._json.encode(jsonDict);
    this._log.debug("  json text: " + aItem._jsonText);
    
    if (aIsNew) {
      this._log.debug(" inserting item");
      itemNounDef.objInsert.call(itemNounDef.datastore, aItem);
    }
    else {
      this._log.debug(" updating item");
      itemNounDef.objUpdate.call(itemNounDef.datastore, aItem);
    }
    
    this._log.debug(" adjusting attributes, add: " + addDBAttribs + " rem: " +
        removeDBAttribs);
    itemNounDef.dbAttribAdjuster.call(itemNounDef.datastore, aItem,
      addDBAttribs, removeDBAttribs);
    
    // Cache ramifications...
    if (aDoCache === undefined || aDoCache) {
      if (aIsNew)
        GlodaCollectionManager.itemsAdded(aItem.NOUN_ID, [aItem]);
      else
        GlodaCollectionManager.itemsModified(aOldItem.NOUN_ID, [aOldItem]);
    }
    
    this._log.debug(" done grokking.");
    
    yield this.kWorkDone;
  },
};

/* and initialize the Gloda object/NS before we return... */
try {
  Gloda._init();
}
catch (ex) {
  Gloda._log.debug("Exception during Gloda init (" + ex.fileName + ":" +
                   ex.lineNumber + "): " + ex);
};
/* but don't forget that we effectively depend on everybody.js too, and
   currently on our importer to be importing that if they need us fully armed
   and operational. */
