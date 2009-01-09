/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is the fakeserver.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Joshua Cranmer <Pidgeot18@gmail.com>
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

// Much of the original code is taken from netwerk's httpserver implementation

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var CC = Components.Constructor;

/** The XPCOM thread manager. */
var gThreadManager = null;

const fsDebugNone = 0;
const fsDebugRecv = 1;
const fsDebugRecvSend = 2;
const fsDebugAll = 3;

/**
 * JavaScript constructors for commonly-used classes; precreating these is a
 * speedup over doing the same from base principles.  See the docs at
 * http://developer.mozilla.org/en/docs/Components.Constructor for details.
 */
const ServerSocket = CC("@mozilla.org/network/server-socket;1",
                        "nsIServerSocket",
                        "init");
const BinaryInputStream = CC("@mozilla.org/binaryinputstream;1",
                             "nsIBinaryInputStream",
                             "setInputStream");

// Time out after 3 minutes
const TIMEOUT = 3*60*1000;

/******************************************************************************
 * The main server handling class. The handler parameter is to be handed to the
 * reading object. Currently, concurrent socket connections should probably be
 * avoided, because transactioning information will be overwritten.
 *
 ******************************************************************************
 * Typical usage:
 * var handler = <get handler from somewhere>
 * do_test_pending();
 * var server = new nsMailServer(handler);
 * // Port to use. I tend to like using 1024 + default port number myself.
 * server.start(port);
 *
 * // Set up a connection the server...
 * server.performTest();
 * transaction = server.playTransaction();
 * // Verify that the transaction is correct...
 *
 * server.resetTest();
 * // Set up second test...
 * server.performTest();
 * transaction = server.playTransaction();
 *
 * // Finished with tests
 * server.stop();
 *
 * var thread = gThreadManager.currentThread;
 * while (thread.hasPendingEvents())
 *   thread.processNextEvent(true);
 *
 * do_test_finished();
 *****************************************************************************/
function nsMailServer(handler) {
  if (!gThreadManager)
    gThreadManager = Cc["@mozilla.org/thread-manager;1"].getService();

  this._debug = fsDebugNone;

  /** The port on which this server listens. */
  this._port = undefined;

  /** The socket associated with this. */
  this._socket = null;

  /**
   * True if the socket in this is closed (and closure notifications have been
   * sent and processed if the socket was ever opened), false otherwise.
   */
  this._socketClosed = true;

  this._handler = handler;
  this._readers = [];
  this._test = false;
}
nsMailServer.prototype = {
  onSocketAccepted : function (socket, trans) {
    if (this._debug != fsDebugNone)
      print("Received Connection from " + trans.host + ":" + trans.port);

    const SEGMENT_SIZE = 1024;
    const SEGMENT_COUNT = 1024;
    var input = trans.openInputStream(0, SEGMENT_SIZE, SEGMENT_COUNT)
                     .QueryInterface(Ci.nsIAsyncInputStream);

    var reader = new nsMailReader(this, this._handler, trans, this._debug);
    this._readers.push(reader);

    // Note: must use main thread here, or we might get a GC that will cause
    //       threadsafety assertions.  We really need to fix XPConnect so that
    //       you can actually do things in multi-threaded JS.  :-(
    input.asyncWait(reader, 0, 0, gThreadManager.mainThread);
    this._test = true;
  },

  onStopListening : function (socket, status) {
    if (this._debug != fsDebugNone)
      print("Connection Lost " + status);

    this._socketClosed = true;
  },

  setDebugLevel : function (debug) {
    this._debug = debug;
    if (this._reader)
      this._reader.setDebugLevel(debug);
  },

  start : function (port) {
    if (this._socket)
      throw Cr.NS_ERROR_ALREADY_INITIALIZED;

    this._port = port;
    this._socketClosed = false;

    var socket = new ServerSocket(this._port,
                                  true, // loopback only
                                  -1);  // default number of pending connections

    socket.asyncListen(this);
    this._socket = socket;
  },

  stop : function () {
    if (!this._socket)
      return;

    this._socket.close();
    this._socket = null;

    if (this._readers.some(function (e) { return e.observer.forced })) {
      do_test_finished();
      return;
    }

    // spin an event loop and wait for the socket-close notification
    var thr = gThreadManager.currentThread;
    while (!this._socketClosed)
      // Don't wait for the next event, just in case there isn't one.
      thr.processNextEvent(false);
  },
  stopTest : function () {
    this._test = false;
  },

  // NSISUPPORTS

  //
  // see nsISupports.QueryInterface
  //
  QueryInterface : function (iid) {
    if (iid.equals(Ci.nsIServerSocketListener) ||
        iid.equals(Ci.nsISupports))
      return this;

    throw Cr.NS_ERROR_NO_INTERFACE;
  },


  // NON-XPCOM PUBLIC API

  /**
   * Returns true if this server is not running (and is not in the process of
   * serving any requests still to be processed when the server was last
   * stopped after being run).
   */
  isStopped : function () {
    return this._socketClosed;
  },

  /**
   * Runs the test. It will not exit until the test has finished.
   */
  performTest : function (watchWord) {
    this._watchWord = watchWord;

    var thread = gThreadManager.currentThread;
    while (!this.isTestFinished())
      thread.processNextEvent(false);
  },

  /**
   * Returns true if the current processing test has finished.
   */
  isTestFinished : function() {
    return this._readers.length > 0 && !this._test;
  },

  /**
   * Returns the commands run between the server and client.
   * The return is an object with two variables (us and them), both of which
   * are arrays returning the commands given by each server.
   */
  playTransaction : function() {
    if (this._readers.some(function (e) { return e.observer.forced; }))
      throw "Server timed out!";
    if (this._readers.length == 1)
      return this._readers[0].transaction;
    else
      return this._readers.map(function (e) { return e.transaction; });
  },

  /**
   * Prepares for the next test.
   */
  resetTest : function() {
    this._readers = this._readers.filter(function (reader) {
      return reader._isRunning;
    });
    this._test = true;
  }
};

function readTo(input, count, arr) {
  var old = new BinaryInputStream(input).readByteArray(count);
  Array.prototype.push.apply(arr, old);
}

/******************************************************************************
 * The nsMailReader service, which reads and handles the lines.
 * All specific handling is passed off to the handler, which is responsible
 * for maintaining its own state. The following commands are required for the
 * handler object:
 * onError       Called when handler[command] does not exist with both the
 *               command and rest-of-line as arguments
 * onStartup     Called on initialization with no arguments
 * onMultiline   Called when in multiline with the entire line as an argument
 * onPassword    Called when a password line is expected as the entire argument
 * postCommand   Called after every command with this reader as the argument
 * [command]     An untranslated command with the rest of the line as the
 *               argument. Defined as everything to the first space
 *
 * All functions, except onMultiline, onPassword and postCommand, treat the
 * returned value as the text to be sent to the client; a newline at the end
 * may be added if it does not exist, and all lone newlines are converted to
 * CRLF sequences.
 *
 * The return of postCommand is ignored. The return of onMultiline is a bit
 * complicated: it may or may not return a response string (returning one is
 * necessary to trigger the postCommand handler).
 *
 * This object has the following supplemental functions for use by handlers:
 * closeSocket  Performs a server-side socket closing
 * setMultiline Sets the multiline mode based on the argument
 *****************************************************************************/
function nsMailReader(server, handler, transport, debug) {
  this._debug = debug;
  this._server = server;
  this._buffer = [];
  this._lines = [];
  this._handler = handler;
  this._transport = transport;
  var output = transport.openOutputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0);
  this._output = output;
  this.transaction = { us : [], them : [] };

  // Send response line
  var response = this._handler.onStartup();
  response = response.replace(/([^\r])\n/g,"$1\r\n");
  if (response.charAt(response.length-1) != '\n')
    response = response + "\r\n";
  this.transaction.us.push(response);
  this._output.write(response, response.length);
  this._output.flush();

  this._multiline = false;

  this._isRunning = true;
  
  this.observer = {
    server : server,
    forced : false,
    notify : function (timer) {
      this.forced = true;
      this.server.stopTest();
      this.server.stop();
    },
    QueryInterface : function (iid) {
      if (iid.equals(Ci.nsITimerCallback) || iid.equals(Ci.nsISupports))
        return this;

      throw Cr.NS_ERROR_NO_INTERFACE;
    }
  };
  this.timer = Cc["@mozilla.org/timer;1"].createInstance()
                                         .QueryInterface(Ci.nsITimer);
  this.timer.initWithCallback(this.observer, TIMEOUT,
                              Ci.nsITimer.TYPE_ONE_SHOT);
}
nsMailReader.prototype = {
  _findLines : function () {
    var buf = this._buffer;
    for (var crlfLoc = buf.indexOf(13); crlfLoc >= 0;
        crlfLoc = buf.indexOf(13, crlfLoc + 1)) {
      if (buf[crlfLoc + 1] == 10)
        break;
    }
    if (crlfLoc == -1)
      // We failed to find a newline
      return;

    var line = String.fromCharCode.apply(null, buf.slice(0, crlfLoc));
    this._buffer = buf.slice(crlfLoc + 2);
    this._lines.push(line);
    this._findLines();
  },

  onInputStreamReady : function (stream) {
    if (this.observer.forced)
      return;

    this.timer.cancel();
    try {
      var bytes = stream.available();
    } catch (e) {
      // Someone, not us, has closed the stream. This means we can't get any
      // more data from the stream, so we'll just go and close our socket.
      this._realCloseSocket();
      return;
    }
    readTo(stream, bytes, this._buffer);
    this._findLines();

    while (this._lines.length > 0) {
      var line = this._lines.shift();

      if (this._debug == fsDebugAll)
        print("RECV: " + line);

      var response;
      try {
        if (this._multiline) {
          response = this._handler.onMultiline(line);

          if (response === undefined)
            continue;
        } else if (this._expectPassword) {
          dump("expecting password\n");
          response = this._handler.onPassword(line);

          if (response == undefined)
            continue;
        } else {
          // Record the transaction
          this.transaction.them.push(line);

          // Find the command and splice it out...
          var splitter = line.indexOf(" ");
          var command = splitter == -1 ? line : line.substring(0,splitter);
          var args = splitter == -1 ? "" : line.substring(splitter+1);

          // By convention, commands are uppercase
          command = command.toUpperCase();

          if (this._debug == fsDebugRecv || this._debug == fsDebugRecvSend)
            print("RECV: " + command);

          if (command in this._handler)
            response = this._handler[command](args);
          else
            response = this._handler.onError(command, args);
        }

        this._preventLFMunge = false;
        this._handler.postCommand(this);
      } catch (e) {
        response = this._handler.onServerFault();
        if (e instanceof Error) {
          dump(e.name + ": " + e.message + '\n');
          dump("File: " + e.fileName + " Line: " + e.lineNumber + '\n');
          dump('Stack trace:\n' + e.stack);
        } else {
          dump("Exception caught: " + e + '\n');
        }
      }

      if (!this._preventLFMunge)
        response = response.replace(/([^\r])\n/g,"$1\r\n");

      if (response.charAt(response.length-1) != '\n')
       response = response + "\r\n";

      if (this._debug == fsDebugRecvSend) {
        print("SEND: " + response.split(" ", 1)[0]);
      }
      else if (this._debug == fsDebugAll) {
        var responses = response.split("\n");
        responses.forEach(function (line) { print("SEND: " + line); });
      }

      this.transaction.us.push(response);
      this._output.write(response, response.length);
      this._output.flush();

      if (this._signalStop)
        this._realCloseSocket();
    }

    if (this._isRunning) {
      stream.asyncWait(this, 0, 0, gThreadManager.currentThread);
      this.timer.initWithCallback(this.observer, TIMEOUT,
                                  Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  closeSocket : function () {
    this._signalStop = true;
  },
  _realCloseSocket : function () {
    this._isRunning = false;
    this._transport.close(Cr.NS_OK);
    this._server.stopTest();
  },

  setMultiline : function (multi) {
    this._multiline = multi;
  },

  setExpectPassword : function (expectPassword) {
    this._expectPassword = expectPassword;
  },

  setDebugLevel : function (debug) {
    this._debug = debug;
  },

  preventLFMunge : function () {
    this._preventLFMunge = true;
  },

  get watchWord () {
    return this._server._watchWord;
  },

  stopTest : function () {
    this._server.stopTest();
  },

  QueryInterface : function (iid) {
    if (iid.equals(Ci.nsIInputStreamCallback) ||
        iid.equals(Ci.nsISupports))
      return this;

    throw Cr.NS_ERROR_NO_INTERFACE;
  }
};

/**
 * Creates a new fakeserver listening for loopback traffic on the given port,
 * starts it, runs the server until the server processes a shutdown request,
 * spinning an event loop so that events posted by the server's socket are
 * processed, and returns the server transaction log.
 *
 * This method is primarily intended for use in running this script manually
 * from within xpcshell and running a functional fakeserver without having to
 * deal with entire testing frameworks. For example, it could be connected to
 * from telnet or a non-testing version of mailnews for non-automated tests.
 * Actual testing code should abstain from using this method because the
 * server does not persist for multiple tests and it hogs the main thread when
 * called.
 *
 * Note that running multiple servers using variants of this method probably
 * doesn't work, simply due to how the internal event loop is spun and stopped.
 *
 * @param port
 *   the port on which the server will run, or -1 if there exists no preference
 *   for a specific port; note that attempting to use some values for this
 *   parameter (particularly those below 1024) may cause this method to throw or
 *   may result in the server being prematurely shut down
 * @param handler
 *   the handler (as defined in the documentation comment above nsMailReader) to
 *   use on the server
 */
function server(port, handler) {
  var srv = new nsMailServer(handler);
  srv.start(port);
  srv.performTest();
  return srv.playTransaction();
}
