/**
 * This routine will allow the easy processing of
 * messages through the fake POP3 server into the local
 * folder. It uses a single global defined as:
 *
 *  gPOP3Pump:        the main access to the routine
 *  gPOP3Pump.run()   function to run to load the messages
 *  gPOP3Pump.files:  (in) an array of message files to load
 *  gPOP3Pump.onDone: function to execute after completion
 *  gPOP3Pump.fakeServer:  (out) the POP3 incoming server
 *
 * adapted from test_pop3GetNewMail.js
 *
 * Original Author: Kent James <kent@caspia.com>
 *
 */

Components.utils.import("resource:///modules/mailServices.js");

// We can be executed from multiple depths
// Provide understandable error message
if (typeof gDEPTH == "undefined")
  do_throw("gDEPTH must be defined when using IMAPpump.js");

// Import the pop3 server scripts
if (typeof nsMailServer == 'undefined')
  load(gDEPTH + "mailnews/fakeserver/maild.js");
if (typeof AuthPLAIN == 'undefined')
  load(gDEPTH + "mailnews/fakeserver/auth.js")
if (typeof pop3Daemon == 'undefined')
  load(gDEPTH + "mailnews/fakeserver/pop3d.js");

// Add mailTestUtils for create_incoming_server
load(gDEPTH + "mailnews/resources/mailTestUtils.js");

function POP3Pump()
{
  // public attributes
  this.fakeServer = null;
  this.onDone = null;
  this.files = null;

  // local private variables

  this.kPOP3_PORT = 1024 + 110;
  this._server = null;
  this._daemon = null;
  this._incomingServer = null;
  this._pop3Service = null;
  this._firstFile = true;
  this._tests = [];
  this._finalCleanup = false;
  this._expectedResult = 0;
}

POP3Pump.prototype._urlListener =
{
  OnStartRunningUrl: function OnStartRunningUrl(url) {},
  OnStopRunningUrl: function OnStopRunningUrl(aUrl, aResult)
  {
    if (aResult != 0)
    {
      // If we have an error, clean up nicely.
      gPOP3Pump._server.stop();

      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);
    }
    do_check_eq(aResult, gPOP3Pump._expectedResult);

    // Let OnStopRunningUrl return cleanly before doing anything else.
    do_timeout(0, _checkPumpBusy);
  }
};

// Setup the daemon and server
// If the debugOption is set, then it will be applied to the server.
POP3Pump.prototype._setupServerDaemon = function _setupServerDaemon(aDebugOption)
{
  this._daemon = new pop3Daemon();
  function createHandler(d) {
    return new POP3_RFC1939_handler(d);
  }
  this._server = new nsMailServer(createHandler, this._daemon);
  if (aDebugOption)
    this._server.setDebugLevel(aDebugOption);
  return [this._daemon, this._server];
};

POP3Pump.prototype._createPop3ServerAndLocalFolders =
  function _createPop3ServerAndLocalFolders()
{
  if (typeof gLocalInboxFolder == 'undefined')
    loadLocalMailAccount();

  if (!this.fakeServer)
    this.fakeServer = create_incoming_server("pop3", this.kPOP3_PORT,
                                             "fred", "wilma");

  return this.fakeServer;
};

POP3Pump.prototype._checkBusy = function _checkBusy()
{
  if (this._tests.length == 0 && !this._finalCleanup)
  {
    this._incomingServer.closeCachedConnections();

    // No more tests, let everything finish
    this._server.stop();
    this._finalCleanup = true;
    do_timeout(20, _checkPumpBusy);
    return;
  }

  if (this._finalCleanup)
  {
    if (gThreadManager.currentThread.hasPendingEvents())
      do_timeout(20, _checkPumpBusy);
    else
    {
      // exit this module
      do_test_finished();
      do_timeout(0, this.onDone);
    }
    return;
  }

  // If the server hasn't quite finished, just delay a little longer.
  if (this._incomingServer.serverBusy ||
      (this._incomingServer instanceof Ci.nsIPop3IncomingServer &&
       this._incomingServer.runningProtocol))
  {
    do_timeout(20, _checkPumpBusy);
    return;
  }

  this._testNext();
};

POP3Pump.prototype._testNext = function _testNext()
{
  let thisFiles = this._tests.shift();
  if (!thisFiles)
    this._checkBusy();  // exit

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try
  {
    if (this._firstFile)
    {
      this._firstFile = false;

      // Start the fake POP3 server
      this._server.start(this.kPOP3_PORT);
    }
    else
    {
      this._server.resetTest();
    }

    // Set up the test
    this._daemon.setMessages(thisFiles);

    // Now get the mail
    this._pop3Service.GetNewMail(null, this._urlListener, gLocalInboxFolder,
                                 this._incomingServer);

    this._server.performTest();
  } catch (e)
  {
    this._server.stop();

    do_throw(e);
  } finally
  {
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
};

POP3Pump.prototype.run = function run(aExpectedResult)
{
  do_test_pending();
  // Disable new mail notifications
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);

  this._server = this._setupServerDaemon();
  this._daemon = this._server[0];
  this._server = this._server[1];

  this._firstFile = true;
  this._finalCleanup = false;

  if (aExpectedResult)
    this._expectedResult = aExpectedResult;

  // In the default configuration, only a single test is accepted
  // by this routine. But the infrastructure exists to support
  // multiple tests, as this was in the original files. We leave that
  // infrastructure in place, so that if desired this routine could
  // be easily copied and modified to make multiple passes through
  // a POP3 server.

  this._tests[0] = this.files;

  this._pop3Service = MailServices.pop3;
  this._testNext();
};

var gPOP3Pump = new POP3Pump();
gPOP3Pump._incomingServer = gPOP3Pump._createPop3ServerAndLocalFolders();

function _checkPumpBusy() { gPOP3Pump._checkBusy(); }
