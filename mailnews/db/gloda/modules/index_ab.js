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

const EXPORTED_SYMBOLS = ['GlodaABIndexer', 'GlodaABAttrs'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/log4moz.js");

Cu.import("resource://app/modules/gloda/utils.js");
Cu.import("resource://app/modules/gloda/datastore.js");
Cu.import("resource://app/modules/gloda/gloda.js");
Cu.import("resource://app/modules/gloda/collection.js");

Cu.import("resource://app/modules/gloda/indexer.js");

Cu.import("resource://app/modules/gloda/noun_freetag.js");


var GlodaABIndexer = {
  _log: null,

  name: "index_ab",
  enable: function() {
    if (this._log == null)
      this._log =  Log4Moz.repository.getLogger("gloda.index_ab");

    let abManager = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);
    abManager.addAddressBookListener(this,
                                     Ci.nsIAbListener.itemAdded |
                                       Ci.nsIAbListener.itemChanged |
                                       Ci.nsIAbListener.directoryItemRemoved);
  },

  disable: function() {
    let abManager = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);
    abManager.removeAddressBookListener(this);
  },

  // it's a getter so we can reference 'this'
  get workers() {
    return [
      ["ab-card", {
         worker: this._worker_index_card,
       }],
    ];
  },

  _worker_index_card: function(aJob, aCallbackHandle) {
    let card = aJob.id;

    if (card.primaryEmail) {
      // load the identity
      let query = Gloda.newQuery(Gloda.NOUN_IDENTITY);
      query.kind("email");
      // we currently normalize all e-mail addresses to be lowercase
      query.value(card.primaryEmail.toLowerCase());
      let identityCollection = query.getCollection(aCallbackHandle);
      yield Gloda.kWorkAsync;

      if (identityCollection.items.length) {
        let identity = identityCollection.items[0];
        // force the identity to know it has an associated ab card.
        identity._hasAddressBookCard = true;

        this._log.debug("Found identity, processing card.");
        yield aCallbackHandle.pushAndGo(
            Gloda.grokNounItem(identity.contact, card, false, false,
                               aCallbackHandle));
        this._log.debug("Done processing card.");
      }
    }

    yield GlodaIndexer.kWorkDone;
  },

  initialSweep: function() {
  },

  /* ------ nsIAbListener ------ */
  /**
   * When an address book card is added, update the cached GlodaIdentity
   *  object's cached idea of whether the identity has an ab card.
   */
  onItemAdded: function ab_indexer_onItemAdded(aParentDir, aItem) {
    if (!(aItem instanceof Ci.nsIAbCard))
      return;

    this._log.debug("Received Card Add Notification");
    let identity = GlodaCollectionManager.cacheLookupOneByUniqueValue(
      Gloda.NOUN_IDENTITY, "email@" + aItem.primaryEmail.toLowerCase());
    if (identity)
      identity._hasAddressBookCard = true;
  },
  /**
   * When an address book card is added, update the cached GlodaIdentity
   *  object's cached idea of whether the identity has an ab card.
   */
  onItemRemoved: function ab_indexer_onItemRemoved(aParentDir, aItem) {
    if (!(aItem instanceof Ci.nsIAbCard))
      return;

    this._log.debug("Received Card Removal Notification");
    let identity = GlodaCollectionManager.cacheLookupOneByUniqueValue(
      Gloda.NOUN_IDENTITY, "email@" + aItem.primaryEmail.toLowerCase());
    if (identity)
      identity._hasAddressBookCard = false;

  },
  onItemPropertyChanged: function ab_indexer_onItemPropertyChanged(aItem,
      aProperty, aOldValue, aNewValue) {
    if (aProperty == null && aItem instanceof Ci.nsIAbCard) {
      this._log.debug("Received Card Change Notification");

      let card = aItem; // instanceof already QueryInterface'd for us.
      let job = new IndexingJob("ab-card", card);
      GlodaIndexer.indexJob(job);
    }
  }
};
GlodaIndexer.registerIndexer(GlodaABIndexer);

var GlodaABAttrs = {
  providerName: "gloda.ab_attr",
  _log: null,

  init: function() {
    this._log =  Log4Moz.repository.getLogger("gloda.abattrs");

    try {
      this.defineAttributes();
    }
    catch (ex) {
      this._log.error("Error in init: " + ex);
      throw ex;
    }
  },

  defineAttributes: function() {
    /* ***** Contacts ***** */
    this._attrIdentityContact = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "identities",
      singular: false,
      special: Gloda.kSpecialColumnChildren,
      //specialColumnName: "contactID",
      storageAttributeName: "_identities",
      subjectNouns: [Gloda.NOUN_CONTACT],
      objectNoun: Gloda.NOUN_IDENTITY,
      }); // tested-by: test_attributes_fundamental
    this._attrContactName = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "name",
      singular: true,
      special: Gloda.kSpecialString,
      specialColumnName: "name",
      subjectNouns: [Gloda.NOUN_CONTACT],
      objectNoun: Gloda.NOUN_STRING,
      }); // tested-by: test_attributes_fundamental
    this._attrContactPopularity = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "popularity",
      singular: true,
      special: Gloda.kSpecialColumn,
      specialColumnName: "popularity",
      subjectNouns: [Gloda.NOUN_CONTACT],
      objectNoun: Gloda.NOUN_NUMBER,
      }); // not-tested
    this._attrContactFrecency = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "frecency",
      singular: true,
      special: Gloda.kSpecialColumn,
      specialColumnName: "frecency",
      subjectNouns: [Gloda.NOUN_CONTACT],
      objectNoun: Gloda.NOUN_NUMBER,
      }); // not-tested

    /* ***** Identities ***** */
    this._attrIdentityContact = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "contact",
      singular: true,
      special: Gloda.kSpecialColumnParent,
      specialColumnName: "contactID", // the column in the db
      idStorageAttributeName: "_contactID",
      valueStorageAttributeName: "_contact",
      subjectNouns: [Gloda.NOUN_IDENTITY],
      objectNoun: Gloda.NOUN_CONTACT,
      }); // tested-by: test_attributes_fundamental
    this._attrIdentityKind = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "kind",
      singular: true,
      special: Gloda.kSpecialString,
      specialColumnName: "kind",
      subjectNouns: [Gloda.NOUN_IDENTITY],
      objectNoun: Gloda.NOUN_STRING,
      }); // tested-by: test_attributes_fundamental
    this._attrIdentityValue = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "value",
      singular: true,
      special: Gloda.kSpecialString,
      specialColumnName: "value",
      subjectNouns: [Gloda.NOUN_IDENTITY],
      objectNoun: Gloda.NOUN_STRING,
      }); // tested-by: test_attributes_fundamental

    /* ***** Contact Meta ***** */
    // Freeform tags; not explicit like thunderbird's fundamental tags.
    //  we differentiate for now because of fundamental implementation
    //  differences.
    this._attrFreeTag = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrExplicit,
                        attributeName: "freetag",
                        bind: true,
                        bindName: "freeTags",
                        singular: false,
                        subjectNouns: [Gloda.NOUN_CONTACT],
                        objectNoun: Gloda.lookupNoun("freetag"),
                        parameterNoun: null,
                        }); // not-tested
    // we need to find any existing bound freetag attributes, and use them to
    //  populate to FreeTagNoun's understanding
    for (let freeTagName in this._attrFreeTag.parameterBindings) {
      this._log.debug("Telling FreeTagNoun about: " + freeTagName);
      FreeTagNoun.getFreeTag(freeTagName);
    }
  },

  process: function(aContact, aCard, aIsNew, aCallbackHandle) {
    if (aContact.NOUN_ID != Gloda.NOUN_CONTACT) {
      this._log.warning("Somehow got a non-contact: " + aContact);
      return; // this will produce an exception; we like.
    }

    // update the name
    if (aCard.displayName && aCard.displayName != aContact.name)
      aContact.name = aCard.displayName;

    aContact.freeTags = [];

    let tags = null;
    try {
      tags = aCard.getProperty("Categories", null);
    } catch (ex) {
      this._log.error("Problem accessing property: " + ex);
    }
    if (tags) {
      for each (let [iTagName, tagName] in Iterator(tags.split(","))) {
        tagName = tagName.trim();
        if (tagName) {
          aContact.freeTags.push(FreeTagNoun.getFreeTag(tagName));
        }
      }
    }

    yield Gloda.kWorkDone;
  }
};
