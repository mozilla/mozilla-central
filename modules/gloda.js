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
    
    this._log = Log4Moz.Service.getLogger("Gloda.NS");
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
  getIdentitiesForFullMailAddresseses:
      function gloda_ns_getIdentitiesForMailAddresses(aMailAddresses) {
    let parsed = GlodaUtils.parseMailAddresses(aMailAddress);
    
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
                                                 "");
      }
      identities.push(identity);
    }
    
    return identities;
  },
  
  getIdentityForFullMailAddress:
      function gloda_ns_getIdentityForFullMailAddress(aMailAddress) {
    let identities = this.getIdentitiesForFullMailAddresseses(aMailAddress);
    if (identities.length != 1)
      throw Error("Expected exactly 1 address, got " + identities.length + ".");    
    
    return identities[0];
  },
  
  kAttrFundamental: 0,
  kAttrOptimization: 1,
  kAttrDerived: 2,
  kAttrExplicit: 3,
  kAttrImplicit: 4,
  
  /** A date, encoded as a PRTime */
  NOUN_DATE: 10,
  NOUN_TAG: 50,
  NOUN_CONVERSATION: 101,
  NOUN_MESSAGE: 102,
  NOUN_CONTACT: 103,
  NOUN_IDENTITY: 104,
  
  /** Attribute providers in the sequence to process them. */
  _attrProviderOrder: [],
  /** Maps attribute providers to the list of attributes they provide */
  _attrProviders: {},
  /** Maps (attribute def) compound names to the GlodaAttributeDef objects. */
  _attributes: {},
  
  _initAttributes: function gloda_ns_initAttributes() {
    this._attributes = GlodaDatastore.getAllAttributes();
  },
  
  /**
   * @param aProvider
   * @param aAttrType
   * @param aPluginName
   * @param aAttrName
   * @param aSubjectType
   * @param aObjectType
   * @param aParameterType
   */
  defineAttr: function gloda_ns_defineAttr(aProvider, aAttrType,
                                           aPluginName, aAttrName,
                                           aSubjectType, aObjectType,
                                           aParameterType,
                                           aExplanationFormat) {
    // provider tracking
    if (!(aProvider in this._attrProviders)) {
      this._attrProviderOrder.push(aProvider);
      this._attrProviders[aProvider] = [];
    } 
    
    let compoundName = aPluginName + ":" + aAttrName;
    let attr = null;
    if (compoundName in this._attributes) {
      // the existence of the GlodaAttributeDef means that either it has
      //  already been fully defined, or has been loaded from the database but
      //  not yet 'bound' to a provider (and had important meta-info that
      //  doesn't go in the db copied over)
      attr = this._attributes[compoundName];
      if (attr.provider != null) {
        return attr;
      }
      
      // we are behind the abstraction veil and can set these things
      attr._provider = aProvider;
      attr._subjectType = aSubjectType;
      attr._objectType = aObjectType;
      attr._parameterType = aParameterType;
      attr._explanationFormat = aExplanationFormat;
      
      this._attrProviders[aProvider].push(attr);
      return attr; 
    }
    
    // Being here means the attribute def does not exist in the database.
    // Of course, we only want to create something in the database if the
    //  parameter is forever un-bound (type is null).
    let attrID = null;
    if (aParameterType == null) {
      attrID = GlodaDatastore.createAttributeDef(aAttrType, aPluginName,
                                                 aAttrName, null);
    }
    
    attr = new GlodaAttributeDef(GlodaDatastore, attrID, compoundName,
                                 aProvider, aAttrType, aPluginName, aAttrName,
                                 aSubjectType, aObjectType, aParameterType,
                                 aExplanationFormat);
    this._attributes[compoundName] = attr;
    this._attrProviders[aProvider].push(attr);
    return attr;
  },
  
  processMessage: function gloda_ns_processMessage(aMessage, aMsgHdr) {
    // For now, we are ridiculously lazy and simply nuke all existing attributes
    //  before applying the new attributes.
    aMessage.clearAttributes();
    
    let allAttribs = [];
  
    for(let i = 0; i < this._attributeProviderOrder.length; i++) {
      let attribs = this._attributeProviderOrder[i].process(aMessage, aMsgHdr);
      allAttribs = allAttribs.concat(attribs);
    }
    
    let outAttribs = [];
    
    for(let iAttrib=0; iAttrib < attribs.length; iAttrib++) {
      let attribDesc = attribs[iAttrib];
      
      // is it an (attributedef / attribute def id, value) tuple?
      if (attribDesc.length == 2) {
        // if it's already an attrib id, we can use the tuple outright
        if (typeof attribDesc[0] == number)
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
        outAttribs.push([attribID, attribDesc[2]);
      }
    }
    
    GlodaDatastore.insertMessageAttributes(aMessage, outAttribs);
  },
};

Gloda._init();
