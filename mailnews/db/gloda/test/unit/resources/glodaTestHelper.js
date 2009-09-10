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
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

// Import the main scripts that mailnews tests need to set up and tear down
load("../../mailnews/resources/mailDirService.js");
load("../../mailnews/resources/mailTestUtils.js");

Components.utils.import("resource://app/modules/errUtils.js");

/**
 * Create a 'me' identity of "me@localhost" for the benefit of Gloda.  At the
 *  time of this writing, Gloda only initializes Gloda.myIdentities and
 *  Gloda.myContact at startup with no event-driven updates.  As such, this
 *  function needs to be called prior to gloda startup.
 */
function createMeIdentity() {
  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let identity = acctMgr.createIdentity;
  identity.email = "me@localhost";
  identity.fullName = "Me";
}
// and run it now...
createMeIdentity();

// -- Set the gloda prefs
const gPrefs = Cc["@mozilla.org/preferences-service;1"]
                 .getService(Ci.nsIPrefBranch);
// yes to indexing
gPrefs.setBoolPref("mailnews.database.global.indexer.enabled", true);
// no to a sweep we don't control
gPrefs.setBoolPref("mailnews.database.global.indexer.perform_initial_sweep",
    false);
// yes to debug output
gPrefs.setBoolPref("mailnews.database.global.logging.dump", true);

// -- Import our modules
Components.utils.import("resource://app/modules/gloda/public.js");
Components.utils.import("resource://app/modules/gloda/indexer.js");
Components.utils.import("resource://app/modules/gloda/datastore.js");
Components.utils.import("resource://app/modules/gloda/collection.js");

// -- Add a logger listener that throws when we give it a warning/error.
Components.utils.import("resource://app/modules/gloda/log4moz.js");
let throwingAppender = new Log4Moz.ThrowingAppender(do_throw);
throwingAppender.level = Log4Moz.Level.Warn;
Log4Moz.repository.rootLogger.addAppender(throwingAppender);

var LOG = Log4Moz.repository.getLogger("gloda.test");

/**
 * davida's patented dump function for what ails you.
 */
function ddumpObject(obj, name, maxDepth, curDepth)
{
  if (curDepth == undefined)
    curDepth = 0;
  if (maxDepth != undefined && curDepth > maxDepth)
    return;

  var i = 0;
  for (prop in obj)
  {
    i++;
    try {
      if (typeof(obj[prop]) == "object")
      {
        if (obj[prop] && obj[prop].length != undefined)
          ddump(name + "." + prop + "=[probably array, length "
                + obj[prop].length + "]");
        else
          ddump(name + "." + prop + "=[" + typeof(obj[prop]) + "] (" +
                obj[prop] + ")");
        ddumpObject(obj[prop], name + "." + prop, maxDepth, curDepth+1);
      }
      else if (typeof(obj[prop]) == "function")
        ddump(name + "." + prop + "=[function]");
      else
        ddump(name + "." + prop + "=" + obj[prop]);
    } catch (e) {
      ddump(name + "." + prop + "-> Exception(" + e + ")");
    }
  }
  if (!i)
    ddump(name + " is empty");
}
/** its kid brother */
function ddump(text)
{
    dump(text + "\n");
}

function dumpExc(e, message) {
  var objDump = getObjectTree(e,1);
  if (typeof(e) == 'object' && 'stack' in e)
      objDump += e.stack;
  if (typeof(message)=='undefined' || !message)
      message='';
  dump(message+'\n-- EXCEPTION START --\n'+objDump+'-- EXCEPTION END --\n');
}

function getObjectTree(o, recurse, compress, level)
{
    var s = "";
    var pfx = "";

    if (typeof recurse == "undefined")
        recurse = 0;
    if (typeof level == "undefined")
        level = 0;
    if (typeof compress == "undefined")
        compress = true;

    for (var i = 0; i < level; i++)
        pfx += (compress) ? "| " : "|  ";

    var tee = (compress) ? "+ " : "+- ";

    if (typeof(o) != 'object') {
        s += pfx + tee + i + " (" + typeof(o) + ") " + o + "\n";
    } else
    for (i in o)
    {
        var t;
        try
        {
            t = typeof o[i];

            switch (t)
            {
                case "function":
                    var sfunc = String(o[i]).split("\n");
                    if (sfunc[2] == "    [native code]")
                        sfunc = "[native code]";
                    else
                        sfunc = sfunc.length + " lines";
                    s += pfx + tee + i + " (function) " + sfunc + "\n";
                    break;

                case "object":
                    s += pfx + tee + i + " (object) " + o[i] + "\n";
                    if (!compress)
                        s += pfx + "|\n";
                    if ((i != "parent") && (recurse))
                        s += getObjectTree(o[i], recurse - 1,
                                             compress, level + 1);
                    break;

                case "string":
                    if (o[i].length > 200)
                        s += pfx + tee + i + " (" + t + ") " +
                            o[i].length + " chars\n";
                    else
                        s += pfx + tee + i + " (" + t + ") '" + o[i] + "'\n";
                    break;

                default:
                    s += pfx + tee + i + " (" + t + ") " + o[i] + "\n";
            }
        }
        catch (ex)
        {
            s += pfx + tee + i + " (exception) " + ex + "\n";
        }

        if (!compress)
            s += pfx + "|\n";

    }

    s += pfx + "*\n";

    return s;
}


/**
 * Inject messages using a POP3 fake-server.
 *
 * @deprecated because the fake-server sometimes does something crazy and we
 *     never really needed it anyways.  I just didn't know about the local
 *     folder addMessage method.  (so sad!)
 */
const INJECT_FAKE_SERVER = 1;
/** Inject messages using freshly created mboxes. */
const INJECT_MBOX = 2;
/** Inject messages using addMessage. */
const INJECT_ADDMESSAGE = 3;
/** Inject messages using the IMAP fakeserver. */
const INJECT_IMAP_FAKE_SERVER = 4;

/**
 * Convert a list of synthetic messages to a form appropriate to feed to the
 *  POP3 fakeserver.
 */
function _synthMessagesToFakeRep(aSynthMessages) {
  return [{fileData: msg.toMessageString(), size: -1} for each
          (msg in aSynthMessages)];
}

function lobotomizeAdaptiveIndexer() {
  // The indexer doesn't need to worry about load; zero his rescheduling time.
  GlodaIndexer._INDEX_INTERVAL = 0;

  let realIdleService = GlodaIndexer._idleService;
  // pretend we are always idle
  GlodaIndexer._idleService = {
    idleTime: 1000,
    addIdleObserver: function() {
      realIdleService.addIdleObserver.apply(realIdleService, arguments);
    },
    removeIdleObserver: function() {
      realIdleService.removeIdleObserver.apply(realIdleService, arguments);
    }
  };

  // Lobotomize the adaptive indexer
  GlodaIndexer._cpuTargetIndexTime = 10000;
  GlodaIndexer._CPU_TARGET_INDEX_TIME_ACTIVE = 10000;
  GlodaIndexer._CPU_TARGET_INDEX_TIME_IDLE = 10000;
  GlodaIndexer._CPU_IS_BUSY_TIME = 10000;
  GlodaIndexer._PAUSE_LATE_IS_BUSY_TIME = 10000;
}

function imsInit() {
  dump("Initializing index message state\n");
  let ims = indexMessageState;

  if (!ims.inited) {
    // Disable new mail notifications
    var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
      .getService(Components.interfaces.nsIPrefBranch);

    prefSvc.setBoolPref("mail.biff.play_sound", false);
    prefSvc.setBoolPref("mail.biff.show_alert", false);
    prefSvc.setBoolPref("mail.biff.show_tray_icon", false);
    prefSvc.setBoolPref("mail.biff.animate_dock_icon", false);

    Gloda.addIndexerListener(messageIndexerListener.onIndexNotification);
    ims.catchAllCollection = Gloda._wildcardCollection(Gloda.NOUN_MESSAGE);
    ims.catchAllCollection.listener = messageCollectionListener;

    // Make the indexer be more verbose about indexing for us...
    GlodaIndexer._unitTestSuperVerbose = true;

    lobotomizeAdaptiveIndexer();

    if (ims.injectMechanism == INJECT_FAKE_SERVER) {
      // -- Pull in the POP3 fake-server / local account helper code
      load("../../test_mailnewslocal/unit/head_maillocal.js");
      // set up POP3 fakeserver to feed things in...
      [ims.daemon, ims.server] = setupServerDaemon();
      // (this will call loadLocalMailAccount())
      ims.incomingServer = createPop3ServerAndLocalFolders();

      ims.pop3Service = Cc["@mozilla.org/messenger/popservice;1"]
                          .getService(Ci.nsIPop3Service);
    }
    else if (ims.injectMechanism == INJECT_MBOX) {
      // we need a local account to stash the mboxes under.
      loadLocalMailAccount();
    }
    else if (ims.injectMechanism == INJECT_ADDMESSAGE) {
      // we need an inbox
      loadLocalMailAccount();
    }
    else if (ims.injectMechanism == INJECT_IMAP_FAKE_SERVER) {
      // Pull in the IMAP fake server code
      load("../../test_imap/unit/head_server.js");

      // set up IMAP fakeserver and incoming server
      ims.daemon = new imapDaemon();
      ims.server = makeServer(ims.daemon, "");
      ims.incomingServer = createLocalIMAPServer();
      // we need a local account for the IMAP server to have its sent messages in
      loadLocalMailAccount();

      // We need an identity so that updateFolder doesn't fail
      let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                      .getService(Ci.nsIMsgAccountManager);
      let localAccount = acctMgr.createAccount();
      let identity = acctMgr.createIdentity();
      localAccount.addIdentity(identity);
      localAccount.defaultIdentity = identity;
      localAccount.incomingServer = gLocalIncomingServer;
      acctMgr.defaultAccount = localAccount;

      // Let's also have another account, using the same identity
      let imapAccount = acctMgr.createAccount();
      imapAccount.addIdentity(identity);
      imapAccount.defaultIdentity = identity;
      imapAccount.incomingServer = ims.incomingServer;

      // The server doesn't support more than one connection
      prefSvc.setIntPref("mail.server.server1.max_cached_connections", 1);
      // We aren't interested in downloading messages automatically
      prefSvc.setBoolPref("mail.server.server1.download_on_biff", false);

      // Set the inbox to not be offline
      ims.imapInbox = ims.incomingServer.rootFolder.getChildNamed("Inbox");
      ims.imapInbox.flags &= ~Ci.nsMsgFolderFlags.Offline;
    }

    ims.inited = true;
  }
}

/**
 * Have gloda index the given synthetic messages, calling the verifier function
 *  (with accumulator field) once the message has been succesfully indexed.
 *
 * We use two mechanisms to do this.  One: we create an open-ended message
 *  collection that gets notified whenever a new message hits the scene.  Two:
 *  we register as a notification listener so that we might know when indexing
 *  has completed.
 *
 * @param aSynthMessages The synthetic messages to introduce to a folder,
 *     resulting in gloda indexing them.
 * @param aVerifier The function to call to verify that the indexing had the
 *     desired result.  Takes arguments aSynthMessage (the synthetic message
 *     just indexed), aGlodaMessage (the gloda message representation of the
 *     indexed message), and aPreviousResult (the value last returned by the
 *     verifier function for this given set of messages, or undefined if it is
 *     the first message.)
 * @param aOnDone The function to call when we complete processing this set of
 *     messages.
 */
function indexMessages(aSynthMessages, aVerifier, aOnDone) {
  let ims = indexMessageState;
  ims.expectMessages(aSynthMessages, aVerifier, aOnDone);

  if (ims.injectMechanism == INJECT_FAKE_SERVER) {
    ims.daemon.setMessages(_synthMessagesToFakeRep(aSynthMessages));
    do_timeout(0, "drivePOP3FakeServer();");
  }
  else if (ims.injectMechanism == INJECT_MBOX) {
    ims.mboxName = "injecty" + ims.nextMboxNumber++;
    writeMessagesToMbox(aSynthMessages, gProfileDir,
                        "Mail", "Local Folders", ims.mboxName);

    let rootFolder = gLocalIncomingServer.rootMsgFolder;
    let subFolder = rootFolder.addSubfolder(ims.mboxName);
    // we need to explicitly kick off indexing...
    updateFolderAndNotify(subFolder, function() {
      // this flag gets lost for reasons I am not entirely clear on, but gloda
      //  really wants it to be there.
      subFolder.setFlag(Ci.nsMsgFolderFlags.Mail);
      GlodaIndexer.indexFolder(subFolder);
    });
  }
  else if (ims.injectMechanism == INJECT_ADDMESSAGE) {
    let localFolder = gLocalInboxFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
    for (let [, msg] in Iterator(aSynthMessages)) {
      localFolder.addMessage(msg.toMboxString());
    }
  }
  else if (ims.injectMechanism == INJECT_IMAP_FAKE_SERVER) {
    let ioService = Cc["@mozilla.org/network/io-service;1"]
                      .getService(Ci.nsIIOService);
    let serverInbox = ims.daemon.getMailbox("INBOX");

    for (let [, msg] in Iterator(aSynthMessages)) {
      // Generate a URI out of the message
      let URI = ioService.newURI("data:text/plain;base64," + btoa(msg.toMessageString()), null, null);
      // Add it to the server
      serverInbox.addMessage(new imapMessage(URI.spec, serverInbox.uidnext++, []));
    }
    // Time to do stuff with the fakeserver
    driveIMAPFakeServer();
  }
}

function injectMessagesUsing(aInjectMechanism) {
  indexMessageState.injectMechanism = aInjectMechanism;
}

var indexMessageState = {
  /** have we been initialized (hooked listeners, etc.) */
  inited: false,
  /** whether we're due for any index notifications */
  expectingIndexNotifications: false,
  /** our catch-all message collection that nets us all messages passing by */
  catchAllCollection: null,
  /** the set of synthetic messages passed in to indexMessages */
  inputMessages: null,
  /** the gloda messages resulting from indexing corresponding to input ones */
  glodaMessages: null,
  /** the user-specified accumulate-style verification func */
  verifier: null,
  /** the result of the last call to the verification function */
  previousValue: undefined,
  /** the function to call once we have indexed all the messages */
  onDone: null,

  injectMechanism: INJECT_ADDMESSAGE,

  /* === Fake Server State === */
  /** nsMailServer instance (if POP3, with POP3_RFC1939 handler) */
  server: null,
  serverStarted: false,
  /** pop3Daemon/imapDaemon instance */
  daemon: null,
  /** incoming pop3/imap server */
  incomingServer: null,
  /** pop3 service (not used for imap) */
  pop3Service: null,
  /** IMAP inbox */
  imapInbox: null,

  /* === MBox Injection State === */
  nextMboxNumber: 0,
  mboxName: null,

  /**
   * Sets up messages to expect index notifications for.
   *
   * @param aSynthMessages The synthetic messages to expect notifications
   *     for. We currently don't do anything with these other than count them,
   *     so pass whatever you want and it will be the 'source message' (1st
   *     argument) to your verifier function.
   * @param aVerifier The function to call to verify that the indexing had the
   *     desired result.  Takes arguments aSynthMessage (the synthetic message
   *     just indexed), aGlodaMessage (the gloda message representation of the
   *     indexed message), and aPreviousResult (the value last returned by the
   *     verifier function for this given set of messages, or undefined if it is
   *     the first message.)
   * @param aOnDone The function to call when we complete processing this set of
   *     messages.
   */
  expectMessages: function indexMessageState_expectMessages(aSynthMessages, aVerifier,
                                                            aOnDone) {
    dump("^^^ setting up " + aSynthMessages.length + " message(s) to expect\n");
    this.inputMessages = aSynthMessages;
    this.expectingIndexNotifications = true;
    this.glodaMessages = [];
    this.verifier = aVerifier;
    this.previousValue = undefined;
    this.onDone = aOnDone;
  },

  /**
   * Listener to handle the completion of the POP3 message retrieval (one way or
   *  the other.)
   */
  urlListener: {
    OnStartRunningUrl: function (url) {
    },
    OnStopRunningUrl: function (url, result) {
      let ims = indexMessageState;
      try {
        // this returns a log of the transaction, but we don't care.  (we
        //  assume that the POP3 stuff works.)
        ims.server.playTransaction();
        // doesn't hurt to break if the POP3 broke though...
        do_check_eq(result, 0);
      }
      catch (e) {
        // If we have an error, clean up nicely before we throw it.
        ims.server.stop();

        var thread = gThreadManager.currentThread;
        while (thread.hasPendingEvents())
          thread.processNextEvent(true);

        do_throw(e);
      }

      // we are expecting the gloda indexer to receive some notification as the
      //  result of the new messages showing up, so we don't actually need to
      //  do anything here.
    }
  }
};

/**
 * Perform POP3 mail fetching, seeing it through to completion.
 */
function drivePOP3FakeServer() {
  let ims = indexMessageState;
dump(">>> enter drivePOP3FakeServer\n");
  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    if (!(ims.serverStarted)) {
      dump("  starting fake server\n");
      ims.server.start(POP3_PORT);
      ims.serverStarted = true;
    }
    else {
      dump("  resetting fake server\n");
      ims.server.resetTest();
    }

    // Now get the mail
    dump("  issuing GetNewMail\n");
    ims.pop3Service.GetNewMail(null, ims.urlListener, gLocalInboxFolder,
                               ims.incomingServer);
    dump("  issuing performTest\n")
    ims.server.performTest();
  }
  catch (e) {
    ims.server.stop();
    do_throw(e);
  }
  finally {
    dump("  draining events\n");
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
dump("<<< exit drivePOP3FakeServer\n");
}

/**
 * Perform an IMAP mail fetch, seeing it through to completion
 */
function driveIMAPFakeServer() {
  dump(">>> enter driveIMAPFakeServer\n");
  let ims = indexMessageState;
  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    dump("  resetting fake server\n");
    ims.server.resetTest();

    // Update the inbox
    dump("  issuing updateFolder\n");
    ims.imapInbox.updateFolder(null);
    // performTest won't work here because that seemingly blocks until the
    // socket is closed, which is something undesirable here
  }
  catch (e) {
    ims.server.stop();
    do_throw(e);
  }
  finally {
    dump("  draining events\n");
    let thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
  dump("<<< exit driveIMAPFakeServer\n");
}


/**
 * Tear down the fake server.  This is very important to avoid things getting
 *  upset during shutdown.  (Namely, XPConnect will get mad about running in
 *  a context without "Components" defined.)
 */
function killFakeServer() {
  dump("Killing fake server\n");
  let ims = indexMessageState;

  ims.incomingServer.closeCachedConnections();

  // No more tests, let everything finish
  ims.server.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}

/**
 * Our catch-all collection listener.  Any time a new message gets indexed,
 *  we should receive an onItemsAdded call.  Any time an existing message
 *  gets reindexed, we should receive an onItemsModified call.  Any time an
 *  existing message actually gets purged from the system, we should receive
 *  an onItemsRemoved call.
 */
var messageCollectionListener = {
  onItemsAdded: function(aItems) {
    dump("@@@ messageCollectionListener.onItemsAdded\n");
    let ims = indexMessageState;
    ims.glodaMessages = ims.glodaMessages.concat(aItems);
    // simulate some other activity clearing out the the current folder's
    // cached database, which used to kill the indexer's enumerator.
    if (++this._numItemsAdded == 3)
      GlodaIndexer._indexingFolder.msgDatabase = null;
  },

  onItemsModified: function(aItems) {
    dump("@@@ messageCollectionListener.onItemsModified\n");
    let ims = indexMessageState;
    ims.glodaMessages = ims.glodaMessages.concat(aItems);
  },

  onItemsRemoved: function(aItems) {
    dump("!!! messageCollectionListener.onItemsRemoved\n");
  },

  _numItemsAdded : 0
};

/**
 * Allow tests to register a callback to be invoked when the indexing completes.
 *   Only one at a time, etc.
 */
function runOnIndexingComplete(aCallback) {
  messageIndexerListener.callbackOnDone = aCallback;
}

/**
 * Gloda indexer listener, used to know when all active indexing jobs have
 *  completed so that we can try and process all the things that should have
 *  been processed.
 */
var messageIndexerListener = {
  callbackOnDone: null,
  onIndexNotification: function(aStatus, aPrettyName, aJobIndex, aJobTotal,
                                aJobItemIndex, aJobItemGoal) {
    dump("((( Index listener notified! aStatus = " + aStatus + "\n");
    // Ignore moving/removing notifications
    if (aStatus == Gloda.kIndexerMoving || aStatus == Gloda.kIndexerRemoving)
      return;

    let ims = indexMessageState;
    // If we shouldn't be receiving notifications and we receive one with aStatus
    // != kIndexerIdle. throw.
    if (!ims.expectingIndexNotifications) {
      if (aStatus == Gloda.kIndexerIdle) {
        dump("((( Ignoring indexing notification since it's just kIndexerIdle.\n");
        return;
      }
      else {
        do_throw("Exception during index notification -- we weren't " +
                 "expecting one.");
      }
    }

    // we only care if indexing has just completed...
    if (aStatus == Gloda.kIndexerIdle) {
      if (messageIndexerListener.callbackOnDone) {
        let callback = messageIndexerListener.callbackOnDone;
        messageIndexerListener.callbackOnDone = null;
        callback();
      }

      // if we haven't seen all the messages we should see, assume that the
      //  rest are on their way, and are just coming in a subsequent job...
      // (Also, the first time we register our listener, we will get a synthetic
      //  idle status; at least if the indexer is idle.)
      let glodaLen = ims.glodaMessages.length, inputLen =
        ims.inputMessages.length;
      if (glodaLen < inputLen) {
        dump("((( indexing is no longer indexing, but we're still expecting " +
             inputLen + " - " + glodaLen + " = " + (inputLen - glodaLen) +
             " more results, ignoring.\n");
        // If we're running IMAP, then update the folder once more
        if (ims.imapInbox)
          ims.imapInbox.updateFolder(null);
        return;
      }

      dump("((( indexer notification (" + ims.glodaMessages.length +
           " messages) about to verify: " +
           (ims.verifier ? ims.verifier.name : "none") + " and complete: " +
           (ims.onDone ? ims.onDone.name : "none") + "\n");
      // If we're verifying messages, we shouldn't be expecting them
      ims.expectingIndexNotifications = false;

      // call the verifier.  (we expect them to generate an exception if the
      //  verification fails, using do_check_*/do_throw; we don't care about
      //  the return value except to propagate forward to subsequent calls.)
      for (let iMessage=0; iMessage < ims.inputMessages.length; iMessage++) {
        if (ims.verifier) {
          try {
            ims.previousValue = ims.verifier(ims.inputMessages[iMessage],
                                             ims.glodaMessages[iMessage],
                                             ims.previousValue);
          }
          catch (ex) {
            do_throw("Exception during verification via " + ims.verifier.name +
                " on message index: " + iMessage + " previous value: " +
                ims.previousValue + " gloda message: " +
                ims.glodaMessages[iMessage] + "\nexception: " + ex);
          }
        }
      }

      dump("((( Verification complete\n");
      if (ims.onDone) {
        try {
          ims.onDone();
        }
        catch (ex) {
          do_throw("Exception calling ims.onDone (" + ims.onDone.name + "): " +
              ex);
        }
      }
    }
    else {
      dump("((( gloda indexing listener notification. indexing: " +
           GlodaIndexer.indexing + " status: " + aStatus + "\n");
    }
  }
};

/**
 * Given a function that generates a set of synthetic messages, feed those
 *  messages to gloda to be indexed, verifying the resulting indexed messages
 *  have the desired properties by calling the provided verification function.
 * This process is executed once for each possible permutation of observation
 *  of the synthetic messages.  (Well, we cap it; brute-force test your logic
 *  on your own time; you should really only be feeding us minimal scenarios.)
 *
 * @param aScenarioMaker A function that, when called, will generate a series
 *   of SyntheticMessage instances.  Each call to this method should generate
 *   a new set of conceptually equivalent, but not identical, messages.  This
 *   allows us to process without having to reset our state back to nothing each
 *   time.  (This is more to try and make sure we run the system with a 'dirty'
 *   state than a bid for efficiency.)
 * @param aVerifier Verifier function, same signature/intent as the same
 *   argument for indexMessages (who we internally end up calling).
 * @param aOnDone The (optional) function to call when we have finished
 *   processing.  Note that this handler is only called when there are no
 *   additional jobs to be queued.  So if you queue up 5 jobs, you can pass in
 *   the same aOnDone handler for all of them, confident in the knowledge that
 *   only the last job will result in the done handler being called.
 */
function indexAndPermuteMessages(aScenarioMaker, aVerifier, aOnDone) {
  let mis = multiIndexState;

  mis.queue.push([aScenarioMaker, aVerifier, aOnDone]);

  // start processing it immediately if we're not doing anything...
  if (!mis.active)
    _multiIndexNext();
}

/**
 * Helper function that does the actual multi-indexing work for each call
 *  made to indexAndPermuteMessages.  Since those calls can stack, the arguments
 *  are queued, and we process them when there is no (longer) a current job.
 *  _permutationIndexed handles the work of trying the subsequent permutations
 *  for each job we de-queue and initiate.
 */
function _multiIndexNext() {
  let mis = multiIndexState;

  if (mis.queue.length) {
    mis.active = true;

    let [aScenarioMaker, aVerifier, aOnDone] = mis.queue.shift();

    let firstSet = aScenarioMaker();

    mis.scenarioMaker = aScenarioMaker;
    mis.verifier = aVerifier;
    // 32 permutations is probably too generous, not to mention an odd choice.
    mis.numPermutations = Math.min(factorial(firstSet.length), 32);
    mis.nextPermutationId = 1;

    mis.onDone = aOnDone;

    indexMessages(firstSet, mis.verifier, _permutationIndexed);
  }
  else {
    mis.active = false;
    if (mis.onDone)
      mis.onDone();
  }
}

/**
 * The onDone handler for indexAndPermuteMessages/_multiIndexNext's use of
 *  indexMessages under the hood.  Generates and initiates processing of then
 *  next permutation if any remain, otherwise deferring to _multiIndexNext to
 *  de-queue the next call/job or close up shop.
 */
function _permutationIndexed() {
  let mis = multiIndexState;
  if (mis.nextPermutationId < mis.numPermutations)
    indexMessages(permute(mis.scenarioMaker(), mis.nextPermutationId++),
                  mis.verifier, _permutationIndexed);
  else
    _multiIndexNext();
}

/**
 * The state global for indexAndPermuteMessages / _multiIndexNext /
 *  _permutationIndexed.
 */
var multiIndexState = {
  scenarioMaker: null,
  verifier: null,
  onDone: null,
  numPermutations: undefined,
  nextPermutationId: undefined,
  active: false,
  queue: []
};

/**
 * A simple factorial function used to calculate the number of permutations
 *  possible for a given set of messages.
 */
function factorial(i, rv) {
  if (i <= 1)
    return rv || 1;
  return factorial(i-1, (rv || 1) * i); // tail-call capable
}

/**
 * Permute an array given a 'permutation id' that is an integer that fully
 *  characterizes the permutation through the decisions that need to be made
 *  at each step.
 *
 * @param aArray Source array that is destructively processed.
 * @param aPermutationId The permutation id.  A permutation id of 0 results in
 *     the original array's sequence being maintained.
 */
function permute(aArray, aPermutationId) {
  let out = [];
  for (let l=aArray.length; l > 0; l--) {
    let offset = aPermutationId % l;
    out.push(aArray[offset]);
    aArray.splice(offset, 1);
    aPermutationId = Math.floor(aPermutationId / l);
  }
  return out;
}

/**
 * Given a SyntheticMessage instance, index it, and then process the contents
 *  of aActionsAndTests which provide "twiddle" functions that mutate the
 *  message and "test" functions that verify that the gloda message is
 *  accordingly updated to reflect the change.
 * This method automatically calls next_test when aActionsAndTests has been
 *  fully processed.
 *
 * @param aSynthMsg The synthetic message to index for testing.
 * @param aActionAndTests A list, where each sub-list is of the form [twiddle
 *     function, test function, twiddleValue, optionalTestValue].  The twiddle
 *     function is called with the nsIMsgDBHdr as its first argument and the
 *     twiddleValue as its second argument.  The test function is called with
 *     the synthetic message as its first argument, the gloda message as its
 *     second argument, and optionalTestValue as its third argument.  If the
 *     list did not contain an optionalTestValue (indicated by only having
 *     three elements in the list), then twiddleValue is passed instead.
 */
function twiddleAndTest(aSynthMsg, aActionsAndTests) {
  let iTwiddling = 0;
  function twiddle_next_attr(smsg, gmsg) {
    let curTwiddling = aActionsAndTests[iTwiddling];
    let twiddleFunc = curTwiddling[0];
    let desiredState = curTwiddling[2];

    // the underlying nsIMsgDBHdr should exist at this point...
    do_check_neq(gmsg.folderMessage, null);
    // prepare
    indexMessageState.expectMessages([gmsg.folderMessage], verify_next_attr);
    // tell the function to perform its mutation to the desired state
    twiddleFunc(gmsg.folderMessage, desiredState);
  }
  function verify_next_attr(smsg, gmsg) {
    let curTwiddling = aActionsAndTests[iTwiddling];
    let verifyFunc = curTwiddling[1];
    let expectedVal = curTwiddling[curTwiddling.length == 3 ? 2 : 3];
    dump("verifying: " + verifyFunc.name + ": " + expectedVal + "\n");
    verifyFunc(smsg, gmsg, expectedVal);

    if (++iTwiddling < aActionsAndTests.length)
      twiddle_next_attr(smsg, gmsg);
    else
      next_test();
  }

  indexMessages([aSynthMsg], twiddle_next_attr);
}

var _defaultExpectationExtractors = {};
_defaultExpectationExtractors[Gloda.NOUN_MESSAGE] = [
  function expectExtract_message_gloda(aGlodaMessage) {
    return aGlodaMessage.headerMessageID;
  },
  function expectExtract_message_synth(aSynthMessage) {
    return aSynthMessage.messageId;
  }
];
_defaultExpectationExtractors[Gloda.NOUN_CONTACT] = [
  function expectExtract_contact_gloda(aGlodaContact) {
    return aGlodaContact.name;
  },
  function expectExtract_contact_name(aName) {
    return aName;
  }
];
_defaultExpectationExtractors[Gloda.NOUN_IDENTITY] = [
  function expectExtract_identity_gloda(aGlodaIdentity) {
    return aGlodaIdentity.value;
  },
  function expectExtract_identity_address(aAddress) {
    return aAddress;
  }
];

function expectExtract_default_toString(aThing) {
  return aThing.toString();
}

/// see {queryExpect} for info on what we do
function QueryExpectationListener(aExpectedSet, aGlodaExtractor, aOrderVerifier) {
  this.expectedSet = aExpectedSet;
  this.glodaExtractor = aGlodaExtractor;
  this.orderVerifier = aOrderVerifier;
  this.completed = false;
  // track our current 'index' in the results for the (optional) order verifier,
  //  but also so we can provide slightly more useful debug output
  this.nextIndex = 0;
}

QueryExpectationListener.prototype = {
  onItemsAdded: function query_expectation_onItemsAdded(aItems, aCollection) {
    for each (let [, item] in Iterator(aItems)) {
      let glodaStringRep;
      try {
        glodaStringRep = this.glodaExtractor(item);
      }
      catch (ex) {
        do_throw("Gloda extractor threw during query expectation for item: " +
                 item + " exception: " + ex);
      }

      // make sure we were expecting this guy
      if (glodaStringRep in this.expectedSet)
        delete this.expectedSet[glodaStringRep];
      else {
        ddumpObject(item, "item", 0);
        ddumpObject(this.expectedSet, "expectedSet", 1);
        dump("glodaStringRep: " + glodaStringRep + "\n");
        do_throw("Query returned unexpected result! gloda rep:" +
                 glodaStringRep);
      }

      if (this.orderVerifier) {
        try {
          this.orderVerifier(this.nextIndex, item, aCollection);
        }
        catch (ex) {
          // if the order was wrong, we could probably go for an output of what
          //  we actually got...
          dump("!!! ORDER PROBLEM, SO ORDER DUMP!\n");
          for each (let [iThing, thing] in Iterator(aItems)) {
            dump(iThing + ": " + thing +
                 (aCollection.stashedColumns ?
                  (". " + aCollection.stashedColumns[thing.id].join(", ")) :
                  "") + "\n");
          }
          throw ex;
        }
      }
      this.nextIndex++;

      // make sure the query's test method agrees with the database about this
      if (!aCollection.query.test(item)) {
        logObject(item);
        do_throw("Query test returned false when it should have been true on " +
                 "extracted: " + glodaStringRep + " item: " + item);
      }
    }
  },
  onItemsModified: function query_expectation_onItemsModified(aItems,
      aCollection) {
  },
  onItemsRemoved: function query_expectation_onItemsRemoved(aItems,
      aCollection) {
  },
  onQueryCompleted: function query_expectation_onQueryCompleted(aCollection) {
    // we may continue to match newly added items if we leave our query as it
    //  is, so let's become explicit to avoid related troubles.
    aCollection.becomeExplicit();

    // expectedSet should now be empty
    for each (let [key, value] in Iterator(this.expectedSet)) {
      dump("I have seen " + this.nextIndex + " results, but not:\n");
      do_throw("Query should have returned " + key + " (" + value + ")");
    }

    dump(">>> queryCompleted, advancing to next test\n");
    next_test();
  },
}

/**
 * Execute the given query, verifying that the result set contains exactly the
 *  contents of the expected set; no more, no less.  Since we expect that the
 *  query will result in gloda objects, but your expectations will not be posed
 *  in terms of gloda objects (though they could be), we rely on extractor
 *  functions to take the gloda result objects and the expected result objects
 *  into the same string.
 * If you don't provide extractor functions, we will use our defaults (based on
 *  the query noun type) if available, or assume that calling toString is
 *  sufficient.
 * Calls next_test automatically once the query completes and the results are
 *  checked.
 *
 * @param aQuery Either a query to execute, or a dict with the following keys:
 *     - queryFunc: The function to call that returns a function.
 *     - queryThis: The 'this' to use for the invocation of queryFunc.
 *     - args: A list (possibly empty) or arguments to precede the traditional
 *         arguments to query.getCollection.
 *     - nounId: The (numeric) noun id of the noun type expected to be returned.
 * @param aExpectedSet The list of expected results from the query.
 * @param aGlodaExtractor The extractor function to take an instance of the
 *     gloda representation and return a string for comparison/equivalence
 *     against that returned by the expected extractor (against the input
 *     instance in aExpectedSet.)  The value returned must be unique for all
 *     of the expected gloda representations of the expected set.  If omitted,
 *     the default extractor for the gloda noun type is used.  If no default
 *     extractor exists, toString is called on the item.
 * @param aExpectedExtractor The extractor function to take an instance from the
 *     values in the aExpectedSet and return a string for comparison/equivalence
 *     against that returned by the gloda extractor.  The value returned must
 *     be unique for all of the values in the expected set.  If omitted, the
 *     default extractor for the presumed input type based on the gloda noun
 *     type used for the query is used, failing over to toString.
 * @param aOrderVerifier Optional function to verify the order the results are
 *     received in.  Function signature should be of the form (aZeroBasedIndex,
 *     aItem, aCollectionResultIsFor).
 * @returns The collection created from the query.
 */
function queryExpect(aQuery, aExpectedSet, aGlodaExtractor,
    aExpectedExtractor, aOrderVerifier) {
  if (aQuery.test)
    aQuery = {queryFunc: aQuery.getCollection, queryThis: aQuery, args: [],
              nounId: aQuery._nounDef.id};

  // - set extractor functions to defaults if omitted
  if (aGlodaExtractor == null) {
    if (_defaultExpectationExtractors[aQuery.nounId] !== undefined)
      aGlodaExtractor = _defaultExpectationExtractors[aQuery.nounId][0];
    else
      aGlodaExtractor = expectExtract_default_toString;
  }
  if (aExpectedExtractor == null) {
    if (_defaultExpectationExtractors[aQuery.nounId] !== undefined)
      aExpectedExtractor = _defaultExpectationExtractors[aQuery.nounId][1];
    else
      aExpectedExtractor = expectExtract_default_toString;
  }

  // - build the expected set
  let expectedSet = {};
  for each (let [, item] in Iterator(aExpectedSet)) {
    try {
      expectedSet[aExpectedExtractor(item)] = item;
    }
    catch (ex) {
      do_throw("Expected extractor threw during query expectation for item: " +
               item + " exception: " + ex);
    }
  }

  // - create the listener...
  aQuery.args.push(new QueryExpectationListener(expectedSet,
                                                aGlodaExtractor,
                                                aOrderVerifier));
  return aQuery.queryFunc.apply(aQuery.queryThis, aQuery.args);
}

/**
 * Call the provided callback once the database has run all the async statements
 *  whose execution was queued prior to this call.
 * @param aCallback The callback to call.  No 'this' provided.
 */
function notifyWhenDatastoreDone(aCallback) {
  // we already have a mechanism to do this by forcing a commit.  arguably,
  //  it would be better to use a mechanism that does not induce an fsync.
  var savedDepth = GlodaDatastore._transactionDepth;
  if (!savedDepth)
    GlodaDatastore._beginTransaction();
  GlodaDatastore.runPostCommit(aCallback);
  // we don't actually need to run things to zero... we can just wait for the
  //  outer transaction to close itself...
  GlodaDatastore._commitTransaction();
  if (savedDepth)
    GlodaDatastore._beginTransaction();
}

var glodaHelperTests = [];
var glodaHelperIterator = null;

function _gh_test_iterator() {
  do_test_pending();

  for (let iTest=0; iTest < glodaHelperTests.length; iTest++) {
    let test = glodaHelperTests[iTest];
    // deal with parameterized tests (via parameterizeTest)
    if (test.length) {
      let [testFunc, parameters] = test;
      for each (let [, parameter] in Iterator(parameters)) {
        dump("====== Test function: " + testFunc.name + " Parameter: " +
             parameter.name + "\n");
        yield testFunc(parameter);
      }
    }
    else {
      dump("====== Test function: " + test.name + "\n");
      yield test();
    }
  }

  if (indexMessageState.injectMechanism == INJECT_FAKE_SERVER ||
      indexMessageState.injectMechanism == INJECT_IMAP_FAKE_SERVER) {
    do_test_pending();
    // Give a bit of time for any remaining notifications to go through.
    do_timeout(500, "killFakeServer()");
  }

  do_test_finished();

  // once the control flow hits the root after do_test_finished, we're done,
  //  so let's just yield something to avoid callers having to deal with an
  //  exception indicating completion.
  yield null;
}

var _next_test_currently_in_test = false;
function next_test() {
  // to avoid crazy messed up stacks, use a time-out to get us to our next thing
  if (_next_test_currently_in_test) {
    do_timeout(0, "next_test()");
    return;
  }

  _next_test_currently_in_test = true;
  try {
    glodaHelperIterator.next();
  }
  catch (ex) {
    dumpExc(ex);
    do_throw("Caught an exception during execution of next_test: " + ex + ": " + ex.stack);
  }
  _next_test_currently_in_test = false;
}

DEFAULT_LONGEST_TEST_RUN_CONCEIVABLE_SECS = 180;

/**
 * Purely decorative function to help explain to people reading lists of tests
 *  using glodaHelperRunTests what is going on.  We just return a tuple of our
 *  arguments and _gh_test_iterator understands what to do with this, namely
 *  to run the test once for each element in the aParameters list.  If the
 *  elements in the aParameters list have a 'name' attribute, it will get
 *  printed out to help figure out what is actually happening.
 */
function parameterizeTest(aTestFunc, aParameters) {
  return [aTestFunc, aParameters];
}

/**
 * Test driving logic that takes a list of tests to run.  Every completed test
 *  needs to call (or cause to be called) next_test.
 *
 * @param aTests A list of test functions to call.
 * @param aLongestTestRunTimeConceivableInSecs Optional parameter
 * @param aDontInitIMS Optional parameter. If this is specified then the index
 *                     message state is not initialized
 */
function glodaHelperRunTests(aTests, aLongestTestRunTimeConceivableInSecs,
                             aDontInitIMS) {
  if (aLongestTestRunTimeConceivableInSecs == null)
    aLongestTestRunTimeConceivableInSecs =
        DEFAULT_LONGEST_TEST_RUN_CONCEIVABLE_SECS;
  do_timeout(aLongestTestRunTimeConceivableInSecs * 1000,
      "do_throw('Timeout running test, and we want you to have the log.');");

  if (!aDontInitIMS)
    imsInit();
  // even if we don't want to init IMS, we want to avoid anything adaptive
  //  happening.
  else
    lobotomizeAdaptiveIndexer();
  glodaHelperTests = aTests;
  glodaHelperIterator = _gh_test_iterator();
  next_test();
}

/**
 * Wipe out almost everything from the clutches of the GlodaCollectionManager.
 * By default, it is caching things and knows about all the non-GC'ed
 *  collections.  Tests may want to ensure that their data is loaded from disk
 *  rather than relying on the cache, and so, we exist.
 * The exception to everything is that Gloda's concept of myContact and
 *  myIdentities needs to have its collections still be reachable or invariants
 *  are in danger of being "de-invarianted".
 * The other exception to everything are any catch-all-collections used by our
 *  testing/indexing process.  We don't scan for them, we just hard-code their
 *  addition if they exist.
 */
function nukeGlodaCachesAndCollections() {
  // explode if the GlodaCollectionManager somehow doesn't work like we think it
  //  should.  (I am reluctant to put this logic in there, especially because
  //  knowledge of the Gloda contact/identity collections simply can't be known
  //  by the colleciton manager.)
  if ((GlodaCollectionManager._collectionsByNoun === undefined) ||
      (GlodaCollectionManager._cachesByNoun === undefined))
    // we don't check the Gloda contact/identities things because they might not
    //  get initialized if there are no identities, which is the case for our
    //  unit tests right now...
    do_throw("Try and remember to update the testing infrastructure when you " +
             "change things!");

  // we can just blow away the known collections
  GlodaCollectionManager._collectionsByNoun = {};
  // but then we have to put the myContact / myIdentities junk back
  if (Gloda._myContactCollection) {
    GlodaCollectionManager.registerCollection(Gloda._myContactCollection);
    GlodaCollectionManager.registerCollection(Gloda._myIdentitiesCollection);
  }
  // don't forget our testing catch-all collection!
  if (indexMessageState.catchAllCollection) {
    // empty it out in case it has anything in it
    indexMessageState.catchAllCollection.clear();
    // and now we can register it
    GlodaCollectionManager.registerCollection(
        indexMessageState.catchAllCollection);
  }

  // caches aren't intended to be cleared, but we also don't want to lose our
  //  caches, so we need to create new ones from the ashes of the old ones.
  let oldCaches = GlodaCollectionManager._cachesByNoun;
  GlodaCollectionManager._cachesByNoun = {};
  for each (let cache in oldCaches) {
    GlodaCollectionManager.defineCache(cache._nounDef, cache._maxCacheSize);
  }
}

/**
 * Given an IMAP folder, marks it offline and downloads its messages.
 *
 * @param aFolder an IMAP message folder
 * @param aSynthMessages see indexMessageState.expectMessages
 * @param aVerifier see indexMessageState.expectMessages
 * @param aDone see indexMessageState.expectMessages
 */
function imapDownloadAllMessages(aFolder, aSynthMessages, aVerifier, aDone) {
  // Let the message state know that we're expecting messages
  indexMessageState.expectMessages(aSynthMessages, aVerifier, aDone);
  aFolder.setFlag(Ci.nsMsgFolderFlags.Offline);
  aFolder.downloadAllForOffline(null, null);
  // The indexer listener is going to call aDone, so our job is done here
}
