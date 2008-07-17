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
    if (message == null) {
      message = GlodaDatastore.getMessageByMessageID(aMsgHdr.messageId);
      this._log.warn("Fell back to locating message by id; actual message " +
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
      
      if (identity == null) {
        // we must create a contact
        let contact = GlodaDatastore.createContact(null, null,
                                                   parsed.names[iAddress]);
        
        // we must create the identity.  use a blank description because there's
        //  nothing to differentiate it from other identities, as this contact
        //  only has one initially (us).
        identity = GlodaDatastore.createIdentity(contact.id, contact, "email",
                                                 parsed.addresses[iAddress],
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
      this._log.error("Expected exactly 1 address, got " + identities.length +
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
  NOUN_CONVERSATION: 101,
  NOUN_MESSAGE: 102,
  NOUN_CONTACT: 103,
  NOUN_IDENTITY: 104,
  
  /** Next Noun ID to hand out, these don't need to be persisted (for now). */
  _nextNounID: 1000,

  _nounNameToNounID: {},
  _nounIDToMeta: {},
  
  defineNoun: function gloda_ns_defineNoun(aNounMeta) {
    let nounID = this._nextNounID++;
    this._nounNameToNounID[aNounDef.name] = nounID; 
    this._nounIDToMeta[nounID] = aNounMeta;
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
                [propName for each
                 (propName in this._nounNameToNounID)].join(", ")); 
  },
  
  /** Attribute providers in the sequence to process them. */
  _attrProviderOrder: [],
  /** Maps attribute providers to the list of attributes they provide */
  _attrProviders: {},
  
  _initAttributes: function gloda_ns_initAttributes() {
    this._nounIDToMeta[this.NOUN_BOOLEAN] = {class: Boolean, firstClass: false,
      fromAttributeValue: function(aVal) {
        if(aVal != 0) return true; else return false;
      }};
    this._nounIDToMeta[this.NOUN_DATE] = {class: Date, firstClass: false,
      fromAttributeValue: function(aPRTime) {
        return new Date(aPRTime / 1000);
      }};

    // TODO: use some form of (weak) caching layer... it is reasonably likely
    //  that there will be a high degree of correlation in many cases, and
    //  unless the UI is extremely clever and does its cleverness before
    //  examining the data, we will probably hit the correlation.
    this._nounIDToMeta[this.NOUN_CONVERSATION] = {class: GlodaConversation,
      firstClass: false,
      fromAttributeValue: function(aID) {
        return GlodaDatastore.getConversationByID(aID);
      }};
    this._nounIDToMeta[this.NOUN_MESSAGE] = {class: GlodaMessage,
      firstClass: true,
      fromAttributeValue: function(aID) {
        return GlodaDatastore.getMessageByID(aID);
      }};
    this._nounIDToMeta[this.NOUN_CONTACT] = {class: GlodaContact,
      firstClass: false,
      fromAttributeValue: function(aID) {
        return GlodaDatastore.getContactByID(aID);
      }};
    this._nounIDToMeta[this.NOUN_IDENTITY] = {class: GlodaIdentity,
      firstClass: false,
      fromAttributeValue: function(aID) {
        return GlodaDatastore.getIdentityByID(aID);
      }};
  
    GlodaDatastore.getAllAttributes();
  },
  
  
  _bindAttribute: function gloda_ns_bindAttr(aAttr, aSubjectType, aObjectType,
                                             aSingular, aBindName) {
    if (!(aSubjectType in this._nounIDToMeta))
      throw Error("Invalid subject type: " + aSubjectType);
    
    let objectCoerce = this._nounIDToMeta[aObjectType].fromAttributeValue;
    
    let storageName = "__" + aBindName;
    let getter;
    // should we memoize the value as a getter per-instance?
    if (aSingular) {
      getter = function() {
        if (this[storageName] != undefined)
          return this[storageName];
        let instances = this.getAttributeInstances(aAttr);
        let val;
        if (instances.length > 0)
          val = objectCoerce(instances[0][2]);
        else
          val = null;
        this[storageName] = val;
        return val;
      }
    } else {
      getter = function() {
        if (this[storageName] != undefined)
          return this[storageName];
        let instances = this.getAttributeInstances(aAttr);
        let values;
        if (instances.length > 0) {
          values = [];
          for (let iInst=0; iInst < instances.length; iInst++) {
            values.push(objectCoerce(instances[iInst][2]));
          }
        }
        else {
          values = instances; // empty is empty
        }
        this[storageName] = values;
        return values;
      }
    }
  
    let subjectProto = this._nounIDToMeta[aSubjectType].class.prototype;
    subjectProto.__defineGetter__(aBindName, getter);
    // no setters for now; manipulation comes later, and will require the attr
    //  definer to provide the actual logic, since we need to affect reality,
    //  not just the data-store.  we may also just punt that all off onto
    //  STEEL...
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
   * @param parameterNoun The object type (NOUN_* or dynamic) or 'null' that
   *     parameterizes this attribute.  The attribute ID we mentioned on the
   *     'objectNoun' could actually be one of many possible attribute IDs
   *     spawned by a single attribute definition.  For each parameter for each
   *     attribute, we add an extra row to the attributes table, resulting in
   *     a new attribute ID.  The parameter can actually be represented as a
   *     BLOB allowing slightly more choices, although implementation realities
   *     demand that the number of parameters per attribute be kept reasonably
   *     small (preferably no more than 32, definitely no more than 256).
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
        !("parameterNoun" in aAttrDef) ||
        !("explanation" in aAttrDef))
      // perhaps we should have a list of required attributes, perchance with
      //  and explanation of what it holds, and use that to be friendlier?
      throw Error("You omitted a required attribute defining property, please" +
                  " consult the documentation as penance.")

    // provider tracking
    if (!(aAttrDef.provider in this._attrProviders)) {
      this._attrProviderOrder.push(aAttrDef.provider);
      this._attrProviders[aAttrDef.provider] = [];
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
      attr._parameterType = aAttrDef.parameterNoun;
      attr._explanationFormat = aAttrDef.explanation;
      
      if (aAttrDef.bind) {
        for (let iSubject=0; iSubject < aAttrDef.subjectNouns.length;
             iSubject++) {
          let subjectType = aAttrDef.subjectNouns[iSubject];
          this._bindAttribute(attr, subjectType, aAttrDef.objectNoun,
                              aAttrDef.singular, bindName);
        }
      }
      
      this._attrProviders[aAttrDef.provider].push(attr);
      return attr; 
    }
    
    // Being here means the attribute def does not exist in the database.
    // Of course, we only want to create something in the database if the
    //  parameter is forever un-bound (type is null).
    let attrID = null;
    if (aAttrDef.parameterNoun == null) {
      attrID = GlodaDatastore._createAttributeDef(aAttrDef.attributeType,
                                                  aAttrDef.extensionName,
                                                  aAttrDef.attributeName,
                                                  null);
    }
    
    attr = new GlodaAttributeDef(GlodaDatastore, attrID, compoundName,
                                 aAttrDef.provider, aAttrDef.attributeType,
                                 aAttrDef.extensionName, aAttrDef.attributeName,
                                 aAttrDef.subjectNouns, aAttrDef.objectNoun,
                                 aAttrDef.parameterNoun, aAttrDef.explanation);
    GlodaDatastore._attributes[compoundName] = attr;

    if (aAttrDef.bind) {
      for (let iSubject=0; iSubject < aAttrDef.subjectNouns.length;
           iSubject++) {
        let subjectType = aAttrDef.subjectNouns[iSubject];
        this._bindAttribute(attr, subjectType, aAttrDef.objectNoun,
                            aAttrDef.singular, bindName);
      }
    }

    this._attrProviders[aAttrDef.provider].push(attr);
    if (aAttrDef.parameterNoun == null)    
      GlodaDatastore._attributeIDToDef[attrID] = [attr, null];
    return attr;
  },
  
  getAttrDef: function gloda_ns_getAttrDef(aPluginName, aAttrName) {
    let compoundName = aPluginName + ":" + aAttrName;
    return GlodaDatastore._attributes[compoundName];
  },
  
  processMessage: function gloda_ns_processMessage(aMessage, aMsgHdr) {
    // For now, we are ridiculously lazy and simply nuke all existing attributes
    //  before applying the new attributes.
    aMessage._datastore.clearMessageAttributes(aMessage);
    
    let allAttribs = [];
  
    for(let i = 0; i < this._attrProviderOrder.length; i++) {
      let attribs = this._attrProviderOrder[i].process(aMessage, aMsgHdr);
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
    
    this._log.debug("Attributes: " + outAttribs);
    
    GlodaDatastore.insertMessageAttributes(aMessage, outAttribs);
  },
  
  queryMessagesAPV: function gloda_ns_queryMessagesAPV(aAPVs) {
    return GlodaDatastore.queryMessagesAPV(aAPVs);
  },
};

Gloda._init();
