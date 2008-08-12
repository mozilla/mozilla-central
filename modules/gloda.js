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

Cu.import("resource://gloda/modules/log4moz.js");

Cu.import("resource://gloda/modules/datastore.js");
Cu.import("resource://gloda/modules/datamodel.js");
Cu.import("resource://gloda/modules/collection.js");
Cu.import("resource://gloda/modules/query.js");
Cu.import("resource://gloda/modules/utils.js");

/**
 * 
 */
let Gloda = {
  _init: function gloda_ns_init() {
    this._initLogging();
    GlodaDatastore._init();
    this._initAttributes();
  },
  
  _log: null,
  _initLogging: function gloda_ns_initLogging() {
    let formatter = new Log4Moz.BasicFormatter();
    let root = Log4Moz.Service.rootLogger;
    root.level = Log4Moz.Level.Debug;

    let capp = new Log4Moz.ConsoleAppender(formatter);
    capp.level = Log4Moz.Level.Warn;
    root.addAppender(capp);

    let dapp = new Log4Moz.DumpAppender(formatter);
    dapp.level = Log4Moz.Level.All;
    root.addAppender(dapp);
    
    this._log = Log4Moz.Service.getLogger("gloda.NS");
    this._log.info("Logging Initialized");
  },
  
  getMessageForHeader: function gloda_ns_getMessageForHeader(aMsgHdr) {
    let message = GlodaDatastore.getMessageFromLocation(aMsgHdr.folder.URI,
                                                        aMsgHdr.messageKey);
    if (message === null) {
      message = GlodaDatastore.getMessageByMessageID(aMsgHdr.messageId);
      this._log.info("Fell back to locating message by id; actual message " +
                     "key is: " + aMsgHdr.messageKey + " database key: " +
                     message.messageKey);
    }
    
    return message;
  },
  
  /**
   * Given a full mail address (ex: "Bob Smith" <bob@smith.com>), return the
   *  identity that corresponds to that mail address, creating it if required.
   */
  getIdentitiesForFullMailAddresses:
      function gloda_ns_getIdentitiesForMailAddresses(aMailAddresses) {
    let parsed = GlodaUtils.parseMailAddresses(aMailAddresses);
    
    let identities = [];
    for (let iAddress=0; iAddress < parsed.count; iAddress++) {
      let identity = GlodaDatastore.getIdentity("email",
                                                parsed.addresses[iAddress]);
      
      if (identity === null) {
        let name = parsed.names[iAddress];
        let mailAddr = parsed.addresses[iAddress];
        
        // fall-back to the mail address if the name is empty
        if ((name === null) || (name == ""))
          name = mailAddr;
          
        // we must create a contact
        let contact = GlodaDatastore.createContact(null, null, name);
        
        // we must create the identity.  use a blank description because there's
        //  nothing to differentiate it from other identities, as this contact
        //  only has one initially (us).
        identity = GlodaDatastore.createIdentity(contact.id, contact, "email",
                                                 mailAddr,
                                                 "", false);
      }
      identities.push(identity);
    }
    
    return identities;
  },
  
  getIdentityForFullMailAddress:
      function gloda_ns_getIdentityForFullMailAddress(aMailAddress) {
    let identities = this.getIdentitiesForFullMailAddresses(aMailAddress);
    if (identities.length != 1) {
      this._log.info("Expected exactly 1 address, got " + identities.length +
                     " for address: " + aMailAddress);
      return null;
    }    
    
    return identities[0];
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
  
  BUILT_IN: "built-in",
  
  NOUN_BOOLEAN: 1,
  /** A date, encoded as a PRTime, represented as a js Date object. */
  NOUN_DATE: 10,
  NOUN_TAG: 50,
  NOUN_FOLDER: 100,
  NOUN_CONVERSATION: 101,
  NOUN_MESSAGE: 102,
  NOUN_CONTACT: 103,
  NOUN_IDENTITY: 104,
  
  /** Next Noun ID to hand out, these don't need to be persisted (for now). */
  _nextNounID: 1000,

  _nounNameToNounID: {},
  _nounIDToMeta: {},
  
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
   * @param firstClass Is this a 'first class noun'/can it be a subject, AKA can
   *     this noun have attributes stored on it that relate it to other things?  For
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
   * @param fromParamAndValue A function that takes a parameter value and the
   *     object value and should return an instantiated noun instance. 
   * @param toParamAndValue A function that takes an instantiated noun
   *     instance and returns a 2-element list of [parameter, value] where
   *     parameter may only be non-null if you passed a usesParameter of true.
   *     Parameter may be of any type (BLOB), and value must be numeric (pass
   *     0 if you don't need the value).
   */
  defineNoun: function gloda_ns_defineNoun(aNounMeta, aNounID) {
    if (aNounID === undefined)
      aNounID = this._nextNounID++;
    aNounMeta.id = aNounID;
    if (aNounMeta.firstClass) {
      [aNounMeta.queryClass, aNounMeta.explicitQueryClass] =
        GlodaQueryClassFactory(aNounMeta);
    }
    this._nounNameToNounID[aNounMeta.name] = aNounID; 
    this._nounIDToMeta[aNounID] = aNounMeta;
    aNounMeta.actions = [];
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
  
  defineNounAction: function gloda_ns_defineNounAction(aNounID, aActionMeta) {
    let nounMeta = this._nounIDToMeta[aNounID];
    nounMeta.actions.push(aActionMeta);
  },
  
  getNounActions: function gloda_ns_getNounActions(aNounID, aActionType) {
    let nounMeta = this._nounIDToMeta[aNounID];
    if (!nounMeta)
      return [];
    return [action for each (action in nounMeta.actions)
            if (!aActionType || (action.actionType == aActionType))];
  },
  
  /** Attribute providers in the sequence to process them. */
  _attrProviderOrder: [],
  /** Maps attribute providers to the list of attributes they provide */
  _attrProviders: {},
  
  _initAttributes: function gloda_ns_initAttributes() {
    this.defineNoun({class: Boolean, firstClass: false,
      fromParamAndValue: function(aParam, aVal) {
        if(aVal != 0) return true; else return false;
      },
      toParamAndValue: function(aBool) {
        return [null, aBool ? 1 : 0];
      }}, this.NOUN_BOOLEAN);
    this.defineNoun({class: Date, firstClass: false, continuous: true,
      fromParamAndValue: function(aParam, aPRTime) {
        return new Date(aPRTime / 1000);
      },
      toParamAndValue: function(aDate) {
        return [null, aDate.valueOf() * 1000];
      }}, this.NOUN_DATE);

    this.defineNoun({class: null,
      firstClass: false,
      fromParamAndValue: function(aParam, aID) {
        return GlodaDatastore._mapFolderID(aID);
      },
      toParamAndValue: function(aFolderURI) {
        return [null, GlodaDatastore._mapFolderURI(aFolderURI)];
      }}, this.NOUN_FOLDER);
    // TODO: use some form of (weak) caching layer... it is reasonably likely
    //  that there will be a high degree of correlation in many cases, and
    //  unless the UI is extremely clever and does its cleverness before
    //  examining the data, we will probably hit the correlation.
    this.defineNoun({class: GlodaConversation,
      firstClass: false,
      tableName: "conversations",
      attrTableName: "messageAttributes", attrIDColumnName: "conversationID",
      fromParamAndValue: function(aParam, aID) {
        return GlodaDatastore.getConversationByID(aID);
      },
      toParamAndValue: function(aConversation) {
        if (aConversation instanceof GlodaConversation)
          return [null, aConversation.id];
        else // assume they're just passing the id directly
          return [null, aConversation];
      }}, this.NOUN_CONVERSATION);
    this.defineNoun({class: GlodaMessage,
      firstClass: true,
      tableName: "messages",
      attrTableName: "messageAttributes", attrIDColumnName: "messageID",
      datastore: GlodaDatastore, objFromRow: GlodaDatastore._messageFromRow,
      fromParamAndValue: function(aParam, aID) {
        return GlodaDatastore.getMessageByID(aID);
      },
      toParamAndValue: function(aMessage) {
        if (aMessage instanceof GlodaMessage)
          return [null, aMessage.id];
        else // assume they're just passing the id directly
          return [null, aMessage];
      }}, this.NOUN_MESSAGE);
    this.defineNoun({class: GlodaContact,
      firstClass: false,
      fromParamAndValue: function(aParam, aID) {
        return GlodaDatastore.getContactByID(aID);
      },
      toParamAndValue: function(aContact) {
        if (aContact instanceof GlodaContact)
          return [null, aContact.id];
        else // assume they're just passing the id directly
          return [null, aContact];
      }}, this.NOUN_CONTACT);
    this.defineNoun({class: GlodaIdentity,
      firstClass: false,
      fromParamAndValue: function(aParam, aID) {
        return GlodaDatastore.getIdentityByID(aID);
      },
      toParamAndValue: function(aIdentity) {
        if (aIdentity instanceof GlodaIdentity)
          return [null, aIdentity.id];
        else // assume they're just passing the id directly
          return [null, aIdentity];
      }}, this.NOUN_IDENTITY);
  
    GlodaDatastore.getAllAttributes();
    
    /* boolean actions, these are parameterized by the attribute they operate
       in the context of.  They are also (not coincidentally), ugly. */
    Gloda.defineNounAction(Gloda.NOUN_BOOLEAN, {actionType: "filter",
      actionTarget: Gloda.NOUN_MESSAGE,
      shortName: "true",
      makeConstraint: function(aAttrDef, aIdentity) {
        return [aAttrDef, null, 1];
      },
      });
    Gloda.defineNounAction(Gloda.NOUN_BOOLEAN, {actionType: "filter",
      actionTarget: Gloda.NOUN_MESSAGE,
      shortName: "false",
      makeConstraint: function(aAttrDef, aIdentity) {
        return [aAttrDef, null, 0];
      },
      });
  },
  
  
  _bindAttribute: function gloda_ns_bindAttr(aAttr, aSubjectType, aObjectType,
                                             aSingular, aDoBind, aBindName) {
    if (!(aSubjectType in this._nounIDToMeta))
      throw Error("Invalid subject type: " + aSubjectType);
    
    let nounMeta = this._nounIDToMeta[aObjectType];
    let subjectNounMeta = this._nounIDToMeta[aSubjectType];
    
    // -- the on-object bindings
    if (aDoBind) {
      let storageName = "__" + aBindName;
      let getter;
      // should we memoize the value as a getter per-instance?
      if (aSingular) {
        getter = function() {
          let val = this[storageName];
          if (val !== undefined)
            return val;
          let instances = this.getAttributeInstances(aAttr);
          if (instances.length > 0)
            val = nounMeta.fromParamAndValue(instances[0][1], instances[0][2]);
          else
            val = null;
          //this[storageName] = val;
          this.__defineGetter__(aBindName, function() val);
          return val;
        }
      } else {
        getter = function() {
          let values = this[storageName];
          if (values !== undefined)
            return values;
          let instances = this.getAttributeInstances(aAttr);
          if (instances.length > 0) {
            values = [];
            for (let iInst=0; iInst < instances.length; iInst++) {
              values.push(nounMeta.fromParamAndValue(instances[iInst][1],
                                                     instances[iInst][2]));
            }
          }
          else {
            values = instances; // empty is empty
          }
          //this[storageName] = values;
          this.__defineGetter__(aBindName, function() values);
          return values;
        }
      }
  
      let subjectProto = subjectNounMeta.class.prototype;
      subjectProto.__defineGetter__(aBindName, getter);
      // no setters for now; manipulation comes later, and will require the attr
      //  definer to provide the actual logic, since we need to affect reality,
      //  not just the data-store.  we may also just punt that all off onto
      //  STEEL...

      aAttr._boundName = aBindName;
    }
    
    // -- the query constraint helpers 
    if (subjectNounMeta.queryClass !== undefined) {
      let constrainer = function() {
        // all the arguments provided end up being ORed together
        let our_ors = [];
        for(let iArg=0; iArg < arguments.length; iArg++) {
          let argument = arguments[iArg];
          our_ors.push([aAttr].concat(nounMeta.toParamAndValue(argument)));
        }
        // but the constraints are ANDed together
        this._constraints.push(our_ors);
        return this;
      };

      subjectNounMeta.queryClass.prototype[aBindName] = constrainer;
      
      if (nounMeta.continuous) {
        let rangedConstrainer = function() {
          // all the arguments provided end up being ORed together
          let our_ors = [];
          for(let iArg=0; iArg < arguments.length; iArg +=2 ) {
            let pv1 = nounMeta.toParamAndValue(arguments[iArg]);
            let pv2 = nounMeta.toParamAndValue(arguments[iArg+1]);
            our_ors.push([aAttr, pv1[0], pv[1], pv2[1]]);
          }
          // but the constraints are ANDed together
          this._constraints.push(our_ors);
          return this;
        }
        
        subjectNounMeta.queryClass.prototype[aBindName + "Range"] =
          rangedConstrainer;
      }
    }

    aAttr._singular = aSingular;
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
   * @param explanation A string (hopefully retrieved from a string bundle) that
   *     is used to provide a textual explanation of what this attribute means.
   *     Strings may contain "%{subject}" to expand a textual representation
   *     of the attribute's subject, "%{object}" to expand a textual
   *     representation of the object, and "%{parameter}" to expand a textual
   *     representation of the parameter.
   */
  defineAttribute: function gloda_ns_defineAttribute(aAttrDef) {
    // ensure required properties exist on aAttrDef
    if (!("provider" in aAttrDef) ||
        !("extensionName" in aAttrDef) ||
        !("attributeType" in aAttrDef) ||
        !("attributeName" in aAttrDef) ||
        !("bind" in aAttrDef) ||
        !("singular" in aAttrDef) ||
        !("subjectNouns" in aAttrDef) ||
        !("objectNoun" in aAttrDef) ||
        !("explanation" in aAttrDef))
      // perhaps we should have a list of required attributes, perchance with
      //  and explanation of what it holds, and use that to be friendlier?
      throw Error("You omitted a required attribute defining property, please" +
                  " consult the documentation as penance.")

    // provider tracking
    if (!(aAttrDef.provider.providerName in this._attrProviders)) {
      this._attrProviderOrder.push(aAttrDef.provider);
      this._attrProviders[aAttrDef.provider.providerName] = [];
    } 
    
    let bindName;
    if ("bindName" in aAttrDef)
      bindName = aAttrDef.bindName;
    else
      bindName = aAttrDef.attributeName;
    
    let compoundName = aAttrDef.extensionName + ":" + aAttrDef.attributeName;
    let attr = null;
    if (compoundName in GlodaDatastore._attributes) {
      // the existence of the GlodaAttributeDef means that either it has
      //  already been fully defined, or has been loaded from the database but
      //  not yet 'bound' to a provider (and had important meta-info that
      //  doesn't go in the db copied over)
      attr = GlodaDatastore._attributes[compoundName];
      if (attr.provider !== null) {
        return attr;
      }
      
      // we are behind the abstraction veil and can set these things
      attr._provider = aAttrDef.provider;
      attr._subjectTypes = aAttrDef.subjectNouns;
      attr._objectType = aAttrDef.objectNoun;
      attr._explanationFormat = aAttrDef.explanation;
      attr._specialColumnName = aAttrDef.specialColumnName || null;
      
      for (let iSubject=0; iSubject < aAttrDef.subjectNouns.length;
           iSubject++) {
        let subjectType = aAttrDef.subjectNouns[iSubject];
        this._bindAttribute(attr, subjectType, aAttrDef.objectNoun,
                            aAttrDef.singular, aAttrDef.bind, bindName);
      }
      
      this._attrProviders[aAttrDef.provider.providerName].push(attr);
      return attr; 
    }
    
    let objectNounMeta = this._nounIDToMeta[aAttrDef.objectNoun];
    
    // Being here means the attribute def does not exist in the database.
    // Of course, we only want to create something in the database if the
    //  parameter is forever un-used (noun does not 'usesParameter')
    let attrID = null;
    if (!objectNounMeta.usesParameter) {
      attrID = GlodaDatastore._createAttributeDef(aAttrDef.attributeType,
                                                  aAttrDef.extensionName,
                                                  aAttrDef.attributeName,
                                                  null);
    }
    
    attr = new GlodaAttributeDef(GlodaDatastore, attrID, compoundName,
                                 aAttrDef.provider, aAttrDef.attributeType,
                                 aAttrDef.extensionName, aAttrDef.attributeName,
                                 aAttrDef.subjectNouns, aAttrDef.objectNoun,
                                 aAttrDef.explanation);
    GlodaDatastore._attributes[compoundName] = attr;

    for (let iSubject=0; iSubject < aAttrDef.subjectNouns.length;
         iSubject++) {
      let subjectType = aAttrDef.subjectNouns[iSubject];
      this._bindAttribute(attr, subjectType, aAttrDef.objectNoun,
                          aAttrDef.singular, aAttrDef.bind, bindName);
    }

    this._attrProviders[aAttrDef.provider.providerName].push(attr);
    if (!objectNounMeta.usesParameter)
      GlodaDatastore._attributeIDToDef[attrID] = [attr, null];
    return attr;
  },
  
  getAttrDef: function gloda_ns_getAttrDef(aPluginName, aAttrName) {
    let compoundName = aPluginName + ":" + aAttrName;
    return GlodaDatastore._attributes[compoundName];
  },
  
  /**
   * Define a table for plug-ins.  The argument should be a dictionary with
   *  the following keys:
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
   * Create a new query for the given noun-type.
   */
  newQuery: function gloda_ns_newQuery(aNounID) {
    let nounMeta = this._nounIDToMeta[aNounID];
    return new nounMeta.queryClass();
  },
  
  /**
   * Create a collection/query for the given noun-type that only matches the
   *  provided items.  This is to be used when you have an explicit set of items
   *  that you would still like to receive updates for. 
   */
  explicitCollection: function gloda_ns_explicitCollection(aNounID, aItems) {
    let nounMeta = this._nounIDToMeta[aNounID];
    let collection = new GlodaCollection(aItems, null, null)
    let query = new nounMeta.explicitQueryClass(collection);
    collection.query = query;
    GlodaCollectionManager.registerCollection(collection);
    return colleciton;
  },
  
  processMessage: function gloda_ns_processMessage(aMessage, aMsgHdr,
                                                   aMimeMsg) {
    // For now, we are ridiculously lazy and simply nuke all existing attributes
    //  before applying the new attributes.
    aMessage._datastore.clearMessageAttributes(aMessage);
    
    let allAttribs = [];
  
    for(let i = 0; i < this._attrProviderOrder.length; i++) {
      let attribs = this._attrProviderOrder[i].process(aMessage, aMsgHdr,
                                                       aMimeMsg);
      allAttribs = allAttribs.concat(attribs);
    }
    
    let outAttribs = [];
    
    for(let iAttrib=0; iAttrib < allAttribs.length; iAttrib++) {
      let attribDesc = allAttribs[iAttrib];
      
      // is it an (attributedef / attribute def id, value) tuple?
      if (attribDesc.length == 2) {
        // if it's already an attrib id, we can use the tuple outright
        if (typeof attribDesc[0] == "number")
          outAttribs.push(attribDesc);
        else
          outAttribs.push([attribDesc[0].id, attribDesc[1]]);
      }
      // it must be an (attrib, parameter value, attrib value) tuple
      else {
        let attrib = attribDesc[0];
        let parameterValue = attribDesc[1];
        let attribID;
        if (parameterValue != null)
          attribID = attrib.bindParameter(parameterValue);
        else
          attribID = attrib.id;
        outAttribs.push([attribID, attribDesc[2]]);
      }
    }
    
    this._log.debug("about to insert: " + outAttribs);
    
    GlodaDatastore.insertMessageAttributes(aMessage, outAttribs);
  },
  
  queryMessagesAPV: function gloda_ns_queryMessagesAPV(aAPVs) {
    return GlodaDatastore.queryMessagesAPV(aAPVs);
  },
};

Gloda._init();
