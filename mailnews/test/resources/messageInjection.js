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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
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

var gMessageGenerator, gMessageScenarioFactory;

/*
 * IMAP port is 1167
 */

/**
 * @param aInjectionConfig.mode One of "local", "pop", "imap".
 * @param [aInjectionConfig.offline] Should the folder be marked offline (and
 *     fully downloaded)?  Only relevant for IMAP.
 *
 * @return {nsIMsgFolder} The Inbox folder.  You do not have to use this to
 *     put messages in; you can create one (or more) using |make_empty_folder|.
 */
function configure_message_injection(aInjectionConfig) {
  let mis = _messageInjectionSetup;
  mis.injectionConfig = aInjectionConfig;

  // Disable new mail notifications
  var prefSvc = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefBranch);

  prefSvc.setBoolPref("mail.biff.play_sound", false);
  prefSvc.setBoolPref("mail.biff.show_alert", false);
  prefSvc.setBoolPref("mail.biff.show_tray_icon", false);
  prefSvc.setBoolPref("mail.biff.animate_dock_icon", false);


  // we need to pull in the notification service so we get events?
  mis.mfnService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                     .getService(Ci.nsIMsgFolderNotificationService);


  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  if (mis.injectionConfig.mode == "pop") {
    // -- Pull in the POP3 fake-server / local account helper code
    load("../../test_mailnewslocal/unit/head_maillocal.js");
    // set up POP3 fakeserver to feed things in...
    [mis.daemon, mis.server] = setupServerDaemon();
    // (this will call loadLocalMailAccount())
    mis.incomingServer = createPop3ServerAndLocalFolders();

    // do not log transactions; it's just a memory leak to us
    mis.server._logTransactions = false;

    mis.rootFolder = mis.incomingServer.rootMsgFolder;
    mis.inboxFolder = mis.rootFolder.getChildNamed("Inbox");

    mis.pop3Service = Cc["@mozilla.org/messenger/popservice;1"]
      .getService(Ci.nsIPop3Service);

    mis.server.start(POP3_PORT);
  }
  else if (mis.injectionConfig.mode == "local") {
    // This does createIncomingServer() and createAccount(), sets the server as
    //  the account's server, then sets the server
    try {
      acctMgr.createLocalMailAccount();
    }
    catch (ex) {
      // This will fail if someone already called this.  Like in the mozmill
      //  case.
    }

    let localAccount = acctMgr.FindAccountForServer(acctMgr.localFoldersServer);

    // We need an identity or we get angry warnings.
    let identity = acctMgr.createIdentity();
    localAccount.addIdentity(identity);
    localAccount.defaultIdentity = identity;

    mis.incomingServer = acctMgr.localFoldersServer;
    // Note: Inbox is not created automatically when there is no deferred server,
    // so we need to create it.
    mis.rootFolder = mis.incomingServer.rootMsgFolder;
    mis.inboxFolder = mis.rootFolder.addSubfolder("Inbox");
    // a local inbox should have a Mail flag!
    mis.inboxFolder.setFlag(Ci.nsMsgFolderFlags.Mail);
    mis.inboxFolder.setFlag(Ci.nsMsgFolderFlags.Inbox);
    _messageInjectionSetup.notifyListeners("onRealFolderCreated",
                                           [mis.inboxFolder]);

    // Force an initialization of the Inbox folder database.
    let unused = mis.inboxFolder.prettiestName;
  }
  else if (mis.injectionConfig.mode == "imap") {
    const gPrefs = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
    // Disable autosync in favor of our explicitly forcing downloads of all
    //  messages in a folder.  This is being done speculatively because when we
    //  didn't do this we got tripped up by the semaphore being in use and
    //  concern over inability to hang a listener off of the completion of the
    //  download.  (Although I'm sure there are various ways we could do it.)
    gPrefs.setBoolPref("mail.server.default.autosync_offline_stores", false);
    // Set the offline property based on the configured setting.  This will
    //  affect newly created folders.
    gPrefs.setBoolPref("mail.server.default.offline_download",
                       mis.injectionConfig.offline);

    // Pull in the IMAP fake server code
    load("../../test_imap/unit/head_server.js");

    // set up IMAP fakeserver and incoming server
    mis.daemon = new imapDaemon();
    mis.server = makeServer(mis.daemon, "");
    mis.incomingServer = createLocalIMAPServer();
    //mis.server._debug = 3;

    // do not log transactions; it's just a memory leak to us
    mis.server._logTransactions = false;

    // we need a local account for the IMAP server to have its sent messages in
    acctMgr.createLocalMailAccount();

    // We need an identity so that updateFolder doesn't fail
    let localAccount = acctMgr.createAccount();
    let identity = acctMgr.createIdentity();
    localAccount.addIdentity(identity);
    localAccount.defaultIdentity = identity;
    localAccount.incomingServer = mis.incomingServer;
    acctMgr.defaultAccount = localAccount;

    // Let's also have another account, using the same identity
    let imapAccount = acctMgr.createAccount();
    imapAccount.addIdentity(identity);
    imapAccount.defaultIdentity = identity;
    imapAccount.incomingServer = mis.incomingServer;

    // The server doesn't support more than one connection
    prefSvc.setIntPref("mail.server.server1.max_cached_connections", 1);
    // We aren't interested in downloading messages automatically
    prefSvc.setBoolPref("mail.server.server1.download_on_biff", false);

    mis.rootFolder = mis.incomingServer.rootMsgFolder;

    mis.inboxFolder = mis.rootFolder.getChildNamed("Inbox");
    // make sure the inbox's offline state is correct. (may be excessive now
    //  that we set the pref above?)
    if (mis.injectionConfig.offline)
      mis.inboxFolder.setFlag(Ci.nsMsgFolderFlags.Offline);
    else
      mis.inboxFolder.clearFlag(Ci.nsMsgFolderFlags.Offline);
    _messageInjectionSetup.notifyListeners("onRealFolderCreated",
                                           [mis.inboxFolder]);

    mis.mainThread = Cc["@mozilla.org/thread-manager;1"]
                       .getService()
                       .mainThread;
    mis.imapService = Cc["@mozilla.org/messenger/imapservice;1"]
                        .getService(Ci.nsIImapService);

    mis.handleUriToRealFolder = {};
    mis.handleUriToFakeFolder = {};
    mis.realUriToFakeFolder = {};
    mis.realUriToFakeFolder[mis.inboxFolder.URI] =
      mis.daemon.getMailbox("INBOX");
  }
  else {
    do_throw("Illegal injection config option: " + mis.injectionConfig.mode);
  }

  mis.trashFolder = mis.rootFolder.getFolderWithFlags(
                      Ci.nsMsgFolderFlags.Trash);
  mark_action("messageInjection", "trash folder is", [mis.trashFolder]);
  mis.junkHandle = null;
  mis.junkFolder = null;

  return mis.inboxFolder;
}

function message_injection_is_local() {
  return _messageInjectionSetup.injectionConfig.mode == "local";
}

async_test_runner_register_final_cleanup_helper(_cleanup_message_injection);

function _cleanup_message_injection() {
  let mis = _messageInjectionSetup;

  if (mis.injectionConfig.mode == "pop" ||
      mis.injectionConfig.mode == "imap") {
    mis.incomingServer.closeCachedConnections();

    // No more tests, let everything finish.
    // (This spins its own event loop...)
    mis.server.stop();
  }

  // Clean out mis; we don't just null the global because it's conceivable we
  //  might still have some closures floating about.
  for each (let key in Iterator(mis, true))
    delete mis[key];
}

const _messageInjectionSetup = {
  _nextUniqueFolderId: 0,

  injectionConfig: {
    mode: "none",
  },
  listeners: [],
  notifyListeners: function(aHandlerName, aArgs) {
    for each (let [, listener] in Iterator(this.listeners)) {
      if (aHandlerName in listener)
        listener[aHandlerName].apply(listener, aArgs);
    }
  },

  /**
   * The nsIMsgIncomingServer
   */
  incomingServer: null,

  /**
   * The incoming server's (synthetic) root message folder.
   */
  rootFolder: null,

  /**
   * The nsIMsgFolder that is the inbox.
   */
  inboxFolder: null,

  /**
   * Fakeserver daemon, if applicable.
   */
  daemon: null,
  /**
   * Fakeserver server instance, if applicable.
   */
  server: null,
};

/**
 * Register a listener to be notified when interesting things happen involving
 *  calls made to the message injection API.
 *
 * @param aListener.onVirtualFolderCreated Called when a virtual folder is
 *     created using |make_virtual_folder|.  The argument is the nsIMsgFolder
 *     that defines the virtual folder.
 */
function register_message_injection_listener(aListener) {
  _messageInjectionSetup.listeners.push(aListener);
}

/**
 * Convert a list of synthetic messages to a form appropriate to feed to the
 *  POP3 fakeserver.
 */
function _synthMessagesToFakeRep(aSynthMessages) {
  return [{fileData: msg.toMessageString(), size: -1} for each
          (msg in aSynthMessages)];
}


SEARCH_TERM_MAP_HELPER = {
  subject: Components.interfaces.nsMsgSearchAttrib.Subject,
  body: Components.interfaces.nsMsgSearchAttrib.Body,
  from: Components.interfaces.nsMsgSearchAttrib.Sender,
  to: Components.interfaces.nsMsgSearchAttrib.To,
  cc: Components.interfaces.nsMsgSearchAttrib.CC,
  recipient: Components.interfaces.nsMsgSearchAttrib.ToOrCC,
  involves: Components.interfaces.nsMsgSearchAttrib.AllAddresses,
  age: Components.interfaces.nsMsgSearchAttrib.AgeInDays,
  tags: Components.interfaces.nsMsgSearchAttrib.Keywords,
};

/**
 * Create and return an empty folder.  If you want to delete this folder
 *  you must call |delete_folder| to kill it!  If you want to rename it, you
 *  must implement a method called rename_folder and then call it.
 *
 * @param [aFolderName] A folder name with no support for hierarchy at this
 *     time.  A name of the form "gabba#" will be autogenerated if you do not
 *     provide one.
 * @param [aSpecialFlags] A list of nsMsgFolderFlags bits to set.
 * @return A folder handle thing that you can pass in to our methods that
 *     expect actual folders.
 */
function make_empty_folder(aFolderName, aSpecialFlags) {
  if (aFolderName == null)
    aFolderName = "gabba" + _messageInjectionSetup._nextUniqueFolderId++;
  let testFolder;

  let mis = _messageInjectionSetup;

  if (mis.injectionConfig.mode == "local") {
    testFolder = mis.rootFolder.addSubfolder(aFolderName);
    // it seems dumb that we have to set this.
    testFolder.setFlag(Ci.nsMsgFolderFlags.Mail);
    if (aSpecialFlags) {
      for each (let [, flag] in Iterator(aSpecialFlags)) {
        testFolder.setFlag(flag);
      }
    }
    _messageInjectionSetup.notifyListeners("onRealFolderCreated",
                                           [testFolder]);
  }
  else if (mis.injectionConfig.mode == "imap") {
    let promise_completed = async_create_promise();

    testFolder = mis.rootFolder.URI + "/" + aFolderName;

    // Tell the IMAP service to create the folder, adding a listener that
    //  hooks up the 'handle' URI -> actual folder mapping.
    mis.imapService.createFolder(
      mis.mainThread,
      mis.rootFolder,
      aFolderName,
      new AsyncUrlListener(mis.rootFolder, function() {
        // get the newly created nsIMsgFolder folder
        let msgFolder = mis.rootFolder.getChildNamed(aFolderName);

        // XXX there is a bug that causes folders to be reported as ImapPublic
        //  when there is no namespace support by the IMAP server.  This is
        //  a temporary workaround.
        msgFolder.clearFlag(Ci.nsMsgFolderFlags.ImapPublic);
        msgFolder.setFlag(Ci.nsMsgFolderFlags.ImapPersonal);

        if (aSpecialFlags) {
          for each (let [, flag] in Iterator(aSpecialFlags)) {
            msgFolder.setFlag(flag);
          }
        }

        // get a reference to the fake server folder
        let fakeFolder = mis.daemon.getMailbox(aFolderName);
        // establish the mapping
        mis.handleUriToRealFolder[testFolder] = msgFolder;
        mis.handleUriToFakeFolder[testFolder] = fakeFolder;
        mis.realUriToFakeFolder[msgFolder.URI] = fakeFolder;

        // notify listeners
        _messageInjectionSetup.notifyListeners("onRealFolderCreated",
                                               [msgFolder]);
      }, promise_completed));
   }
  else if (_messageInjectionSetup.injectionConfig.mode == "pop") {
    throw new Error("You cannot create new folders for POP, I assume.\n");
  }

  return testFolder;
}

/**
 * Get/create the junk folder.
 */
function get_junk_folder() {
  let mis = _messageInjectionSetup;

  if (!mis.junkHandle)
    mis.junkHandle = make_empty_folder("Junk", [Ci.nsMsgFolderFlags.Junk]);

  return mis.junkHandle;
}

/**
 * Create and return a virtual folder.
 *
 * @param aFolders The real folders this virtual folder should draw from.
 * @param aSearchDef The search definition to use to build the list of search
 *     terms that populate this virtual folder.  Keys should be stuff from
 *     SEARCH_TERM_MAP_HELPER and values should be strings to search for within
 *     those attribute things.
 * @param aBooleanAnd Should the search terms be and-ed together.
 * @param [aName] Name to use.
 */
function make_virtual_folder(aFolders, aSearchDef, aBooleanAnd, aName) {
  let mis = _messageInjectionSetup;
  let name = aName ? aName : "virt" + mis._nextUniqueFolderId++;

  let terms = [];
  let termCreator = Components.classes["@mozilla.org/messenger/searchSession;1"]
                              .createInstance(Ci.nsIMsgSearchSession);
  for each (let [key, val] in Iterator(aSearchDef)) {
    let term = termCreator.createTerm();
    let value = term.value;
    value.str = val;
    term.value = value;
    term.attrib = SEARCH_TERM_MAP_HELPER[key];
    term.op = Components.interfaces.nsMsgSearchOp.Contains;
    term.booleanAnd = Boolean(aBooleanAnd);
    terms.push(term);
  }
  // create an ALL case if we didn't add any terms
  if (terms.length == 0) {
    let term = termCreator.createTerm();
    term.matchAll = true;
    terms.push(term);
  }

  let wrapped = VirtualFolderHelper.createNewVirtualFolder(
    name, mis.rootFolder, aFolders, terms,
    /* online */ false);
  _messageInjectionSetup.notifyListeners("onVirtualFolderCreated",
                                         [wrapped.virtualFolder]);
  return wrapped.virtualFolder;
}

/**
 * Mark the folder as offline and force all of its messages to be downloaded.
 *  This is an asynchronous operation that will call async_driver once the
 *  download is completed.
 */
function make_folder_and_contents_offline(aFolderHandle) {
  let mis = _messageInjectionSetup;
  if (mis.injectionConfig.mode != "imap")
    return true;

  let msgFolder = get_real_injection_folder(aFolderHandle);
  msgFolder.setFlag(Ci.nsMsgFolderFlags.Offline);
  msgFolder.downloadAllForOffline(asyncUrlListener, null);
  return false;
}

/**
 * Create a new local folder, populating it with messages according to the set
 *  definition provided.
 *
 * @param aSynSetDefs A synthetic set definition, as appropriate to pass to
 *     make_new_sets_in_folder.
 * @return A list whose first element is the nsIMsgLocalMailFolder created and
 *     whose subsequent items are the SyntheticMessageSets used to populate the
 *     folder (as returned by make_new_sets_in_folder).
 */
function make_folder_with_sets(aSynSetDefs) {
  let msgFolder = make_empty_folder();
  let results = make_new_sets_in_folder(msgFolder, aSynSetDefs);
  // results may be referenced by add_sets_to_folders in an async fashion, so
  //  don't change it.
  results = results.concat();
  results.unshift(msgFolder);
  return results;
}

/**
 * Create multiple new local folders, populating them with messages according to
 *  the set definitions provided.  Differs from make_folder_with_sets by taking
 *  the number of folders to create and return the list of created folders as
 *  the first element in the returned list.  This method is simple enough that
 *  the limited code duplication is deemed acceptable in support of readability.
 *
 * @param aSynSetDefs A synthetic set definition, as appropriate to pass to
 *     make_new_sets_in_folder.
 * @return A list whose first element is the nsIMsgLocalMailFolder created and
 *     whose subsequent items are the SyntheticMessageSets used to populate the
 *     folder (as returned by make_new_sets_in_folder).
 */
function make_folders_with_sets(aFolderCount, aSynSetDefs) {
  let msgFolders = [];
  for (let i = 0; i < aFolderCount; i++)
    msgFolders.push(make_empty_folder());
  let results = make_new_sets_in_folders(msgFolders, aSynSetDefs);
  // results may be referenced by add_sets_to_folders in an async fashion, so
  //  don't change it.
  results = results.concat();
  results.unshift(msgFolders);
  return results;
}

/**
 * Given one or more existing local folder, create new message sets and add them
 *  to the folders using
 *
 * @param aMsgFolders A single nsIMsgLocalMailFolder or a list of them.  The
 *     synthetic messages will be added to the folder(s).
 * @param aSynSetDefs Either an integer describing the number of sets of
 *     messages to create (using default parameters), or a list of set
 *     definition objects as defined by MessageGenerator.makeMessages.
 * @return A list of SyntheticMessageSet objects, each corresponding to the
 *     entry in aSynSetDefs (or implied if an integer was passed).
 */
function make_new_sets_in_folders(aMsgFolders, aSynSetDefs) {
  // is it just a count of the number of plain vanilla sets to create?
  if (typeof(aSynSetDefs) == "number") {
    let setCount = aSynSetDefs;
    aSynSetDefs = [];
    for (let iSet = 0; iSet < setCount; iSet++)
      aSynSetDefs.push({});
  }
  // now it must be a list of set descriptors

  // - create the synthetic message sets
  let messageSets = [];
  for each (let [, synSetDef] in Iterator(aSynSetDefs)) {
    let messages = gMessageGenerator.makeMessages(synSetDef);
    messageSets.push(new SyntheticMessageSet(messages));
  }

  // - add the messages to the folders (interleaving them)
  add_sets_to_folders(aMsgFolders, messageSets);

  return messageSets;
}
/** singular folder alias for single-folder users' readability */
let make_new_sets_in_folder = make_new_sets_in_folders;

/**
 * An iterator that generates an infinite sequence of its argument.  So
 *  _looperator(1, 2, 3) will generate the iteration stream: [1, 2, 3, 1, 2, 3,
 *  1, 2, 3, ...].  For use by add_sets_across_folders.
 */
function _looperator(aList) {
  if (aList.length == 0)
    throw Exception("aList must have at least one item!");

  let i = 0, length = aList.length;
  while (true) {
    yield aList[i];
    i = (i + 1) % length;
  }
}

/**
 * Spreads the messages in aMessageSets across the folders in aMsgFolders.  Each
 *  message set is spread in a round-robin fashion across all folders.  At the
 *  same time, each message-sets insertion is interleaved with the other message
 *  sets.  This distributes message across multiple folders for useful
 *  cross-folder threading testing (via the round robin) while also hopefully
 *  avoiding making things pathologically easy for the code under test (by way
 *  of the interleaving.)
 *
 * For example, given the following 2 input message sets:
 *  message set 'lower': [a b c d e f]
 *  message set 'upper': [A B C D E F G H]
 *
 * across 2 folders:
 *  folder 1: [a A c C e E G]
 *  folder 2: [b B d D f F H]
 * across 3 folders:
 *  folder 1: [a A d D G]
 *  folder 2: [b B e E H]
 *  folder 3: [c C f F]
 *
 * @param aMsgFolders An nsIMsgLocalMailFolder to add the message sets to or a
 *     list of them.
 * @param aMessageSets A list of SyntheticMessageSets.
 *
 * @return true if we were able to do the injection synchronously (e.g. for
 *     a localstore account), false if we kicked off an asynchronous process
 *     (e.g. for an imap account) and we will call |async_driver| when
 *     we are done.  This is consistent with asyncTestUtils support.
 */
function add_sets_to_folders(aMsgFolders, aMessageSets) {
  if ((typeof(aMsgFolders) == "string") || !('length' in aMsgFolders))
    aMsgFolders = [aMsgFolders];

  let mis = _messageInjectionSetup;

  let iterFolders, folderList;
  let ioService, popMessages, msgHdrs;

  _messageInjectionSetup.notifyListeners("onInjectingMessages", []);

  // -- Pre-loop
  if (mis.injectionConfig.mode == "local") {
    for each (let [, folder] in Iterator(aMsgFolders)) {
      if (!(folder instanceof Components.interfaces.nsIMsgLocalMailFolder))
        throw Exception("All folders in aMsgFolders must be local folders!");
    }
    folderList = aMsgFolders;
  }
  else if (mis.injectionConfig.mode == "imap") {
    // no protection is possible because of our dependency on promises,
    //  although we could check that the fake URL is one we handed out.
    folderList = aMsgFolders;

    ioService = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService);
  }
  else if (mis.injectionConfig.mode == "pop") {
    for each (let [, folder] in Iterator(aMsgFolders)) {
      if (folder.URI != mis.inboxFolder.URI)
        throw new Exception("We only support the Inbox for POP injection");
    }
    folderList = aMsgFolders;

    // ugh, so this is really a degenerate case where everything we do is
    //  overkill, but let's try this at least.
    popMessages = [];
  }
  else {
    do_throw("Message injection is not configured!");
  }
  iterFolders = _looperator(aMsgFolders);

  if (mis.injectionConfig.mode == "local") {
    let iPerSet = 0, folder = iterFolders.next();
    // loop, incrementing our subscript until all message sets are out of messages
    let didSomething;
    do {
      didSomething = false;
      // for each message set, if it is not out of messages, add the message
      for each (let [, messageSet] in Iterator(aMessageSets)) {
        if (iPerSet < messageSet.synMessages.length) {
          let synMsg = messageSet._trackMessageAddition(folder, iPerSet);
          folder.gettingNewMessages = true;
          folder.addMessage(synMsg.toMboxString());
          // if we need to mark the message as junk grab the header and do so
          // (The message set can mark the whole set as junk, but not just
          //  specific messages.)
          if (synMsg.metaState.junk) {
            let msgHdr = messageSet.getMsgHdr(iPerSet);
            msgHdr.setStringProperty("junkscore", "100");
          }
          folder.gettingNewMessages = false;
          folder.hasNewMessages = true;
          didSomething = true;
        }
      }
      iPerSet++;
      folder = iterFolders.next();
    } while (didSomething);

    // make sure that junk filtering gets a turn
    // XXX we probably need to be doing more in terms of filters here,
    //  although since filters really want to be run on the inbox, there
    //  are separate potential semantic issues involved.
    for each (let [, folder] in Iterator(aMsgFolders)) {
      folder.callFilterPlugins(null);
    }
  }
  else if (mis.injectionConfig.mode == "imap") {
    // we need to call updateFolder on all the folders, not just the first
    //  one...
    return async_run({func: function() {
      yield wait_for_async_promises();

      let iPerSet = 0, folder = iterFolders.next();
      let didSomething;
      do {
        didSomething = false;
        for each (let [, messageSet] in Iterator(aMessageSets)) {
          if (iPerSet < messageSet.synMessages.length) {
            didSomething = true;

            let realFolder = mis.handleUriToRealFolder[folder];
            let fakeFolder = mis.handleUriToFakeFolder[folder];
            let synMsg = messageSet._trackMessageAddition(realFolder, iPerSet);
            let msgURI =
              ioService.newURI("data:text/plain;base64," +
                               btoa(synMsg.toMessageString()),
                               null, null);
            let imapMsg = new imapMessage(msgURI.spec, fakeFolder.uidnext++, []);
            // If the message's meta-state indicates it is junk, set that flag.
            // There is also a NotJunk flag, but we're not playing with that
            //  right now; as long as nothing is ever marked as junk, the junk
            //  classifier won't run, so it's moot for now.
            if (synMsg.metaState.junk)
              imapMsg.setFlag("Junk");
            fakeFolder.addMessage(imapMsg);
          }
        }
        iPerSet++;
        folder = iterFolders.next();
      } while (didSomething);

      for (let iFolder = 0; iFolder < aMsgFolders.length; iFolder++) {
        let realFolder = mis.handleUriToRealFolder[aMsgFolders[iFolder]];
        mark_action("messageInjection", "forcing update of folder",
                    [realFolder]);
        updateFolderAndNotify(realFolder, async_driver);
        yield false;

        // compel download of the messages if appropriate
        if (realFolder.flags & Ci.nsMsgFolderFlags.Offline) {
          mark_action("messageInjection", "offlining messages", [realFolder]);
          realFolder.downloadAllForOffline(asyncUrlListener, null);
          yield false;
        }
      }
    }});
  }
  else if (mis.injectionConfig.mode == "pop") {
    let iPerSet = 0, folder = iterFolders.next();
    // loop, incrementing our subscript until all message sets are out of messages
    let didSomething;
    do {
      didSomething = false;
      // for each message set, if it is not out of messages, add the message
      for each (let [, messageSet] in Iterator(aMessageSets)) {
        if (iPerSet < messageSet.synMessages.length) {
          popMessages.push(messageSet._trackMessageAddition(folder, iPerSet));
          didSomething = true;
        }
      }
      iPerSet++;
      folder = iterFolders.next();
    } while (didSomething);

    ims.daemon.setMessages(_synthMessagesToFakeRep(popMessages));
    ims.pop3Service.GetNewMail(null, asyncUrlListener, mis.inboxFolder,
                               mis.incomingServer);
    return false; // wait for the url listener to be notified
  }

  return true;
};
/** singular function name for understandability of single-folder users */
let add_sets_to_folder = add_sets_to_folders;

function get_real_injection_folder(aFolderHandle) {
  let mis = _messageInjectionSetup;
  if (mis.injectionConfig.mode == "imap") {
    return mis.handleUriToRealFolder[aFolderHandle];
  }
  return aFolderHandle;
}

/**
 * Helper function for any of the convenience functions that integrate
 *  message injection.
 */
function wait_for_message_injection() {
  let mis = _messageInjectionSetup;
  if (mis.injectionConfig.mode == "imap" ||
      mis.injectionConfig.mode == "pop")
    return false;
  else
    return true;
}

/**
 * Asynchronously move messages in the given set to the destination folder.
 *
 * The IMAP case is much more complex, at least in the unit testing world:
 * XXX We have to force an update of the source folder because the fake
 *  server only allows one connection and that one connection currently
 *  is focused on destFolder; we have to force an update of srcFolder to
 *  get the move to actually hit the IMAP server.
 */
function async_move_messages(aSynMessageSet, aDestFolder) {
  mark_action("messageInjection", "moving messages", aSynMessageSet.msgHdrList);
  return async_run({func: function () {
      // we need to make sure all folder promises are fulfilled
      yield wait_for_async_promises();
      // and then we can make sure we have the actual folder
      let realDestFolder = get_real_injection_folder(aDestFolder);

      let copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                          .getService(Ci.nsIMsgCopyService);
      for (let [folder, xpcomHdrArray] in
           aSynMessageSet.foldersWithXpcomHdrArrays) {
        mark_action("messageInjection",
                    "moving messages",
                    ["from", folder, "to", realDestFolder]);
        copyService.CopyMessages(folder, xpcomHdrArray,
                                 realDestFolder, /* move */ true,
                                 asyncCopyListener, null,
                                 /* do not allow undo, leaks */ false);
        // update the synthetic message set's folder entry...
        aSynMessageSet._folderSwap(folder, realDestFolder);
        yield false;

        // IMAP special case per function doc...
        if (!message_injection_is_local()) {
          mark_action("messageInjection",
                      "forcing update of folder so IMAP move issued",
                      [folder]);
          // update the source folder to force it to issue the move
          updateFolderAndNotify(folder, async_driver);
          yield false;

          mark_action("messageInjection",
                      "forcing update of folder so IMAP moved header seen",
                      [realDestFolder]);
          // update the dest folder to see the new header.
          updateFolderAndNotify(realDestFolder, async_driver);
          yield false;

          // compel download of messages in dest folder if appropriate
          if (realDestFolder.flags & Ci.nsMsgFolderFlags.Offline) {
            mark_action("messageInjection", "offlining messages",
                        [realDestFolder]);
            realDestFolder.downloadAllForOffline(asyncUrlListener, null);
            yield false;
          }
        }
      }
    },
  });
}

/**
 * Empty the trash.
 */
function async_empty_trash() {
  _messageInjectionSetup.trashFolder.emptyTrash(null, asyncUrlListener);
  return false;
}

/**
 * Delete the given folder, removing the storage.  We do not move it to the
 *  trash.
 */
function async_delete_folder(aFolder) {
  let realFolder = get_real_injection_folder(aFolder);
  mark_action("messageInjection", "deleting folder", [realFolder]);
  realFolder.parent.propagateDelete(realFolder, true, null);
  return true;
}
