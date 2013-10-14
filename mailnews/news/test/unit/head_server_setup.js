Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://testing-common/mailnews/localAccountUtils.js");

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var CC = Components.Constructor;

// Ensure the profile directory is set up
do_get_profile();

var gDEPTH = "../../../../";

// Import the servers
Components.utils.import("resource://testing-common/mailnews/maild.js");
Components.utils.import("resource://testing-common/mailnews/nntpd.js");

const kSimpleNewsArticle =
  "From: John Doe <john.doe@example.com>\n"+
  "Date: Sat, 24 Mar 1990 10:59:24 -0500\n"+
  "Newsgroups: test.subscribe.simple\n"+
  "Subject: H2G2 -- What does it mean?\n"+
  "Message-ID: <TSS1@nntp.invalid>\n"+
  "\n"+
  "What does the acronym H2G2 stand for? I've seen it before...\n";

// The groups to set up on the fake server.
// It is an array of tuples, where the first element is the group name and the
// second element is whether or not we should subscribe to it.
var groups = [
  ["misc.test", false],
  ["test.empty", false],
  ["test.subscribe.empty", true],
  ["test.subscribe.simple", true],
  ["test.filter", true]
];
// Sets up the NNTP daemon object for use in fake server
function setupNNTPDaemon() {
  var daemon = new nntpDaemon();

  groups.forEach(function (element) {
    daemon.addGroup(element[0]);
  });

  var auto_add = do_get_file("postings/auto-add/");
  var files = [];
  var enumerator = auto_add.directoryEntries;
  while (enumerator.hasMoreElements())
    files.push(enumerator.getNext().QueryInterface(Ci.nsIFile));

  files.sort(function (a, b) {
    if (a.leafName == b.leafName) return 0;
    return a.leafName < b.leafName ? -1 : 1;
  });

  files.forEach(function (file) {
      var fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                      .createInstance(Ci.nsIFileInputStream);
      var sstream = Cc["@mozilla.org/scriptableinputstream;1"]
                      .createInstance(Ci.nsIScriptableInputStream);
      fstream.init(file, -1, 0, 0);
      sstream.init(fstream);

      var post = "";
      for (let part = sstream.read(4096); part.length > 0;) {
        post += part;
        part = sstream.read(4096);
      }
      sstream.close();
      fstream.close();
      daemon.addArticle(new newsArticle(post));
  });

  var article = new newsArticle(kSimpleNewsArticle);
  daemon.addArticleToGroup(article, "test.subscribe.simple", 1);

  return daemon;
}

function makeServer(handler, daemon) {
  function createHandler(d) {
    return new handler(d);
  }
  return new nsMailServer(createHandler, daemon);
}

// Enable strict threading
Services.prefs.setBoolPref("mail.strict_threading", true);


// Make sure we don't try to use a protected port. I like adding 1024 to the
// default port when doing so...
const NNTP_PORT = 1024+119;

var _server = null;

function subscribeServer(incomingServer) {
  // Subscribe to newsgroups
  incomingServer.QueryInterface(Ci.nsINntpIncomingServer);
  groups.forEach(function (element) {
      if (element[1])
        incomingServer.subscribeToNewsgroup(element[0]);
    });
  // Only allow one connection
  incomingServer.maximumConnectionsNumber = 1;
}

// Sets up the client-side portion of fakeserver
function setupLocalServer(port) {
  if (_server != null)
    return _server;
  let server = localAccountUtils.create_incoming_server("nntp", port,
							null, null);
  subscribeServer(server);

  _server = server;

  return server;
}

const URLCreator = MailServices.nntp.QueryInterface(Ci.nsIProtocolHandler);

// Sets up a protocol object and prepares to run the test for the news url
function setupProtocolTest(port, newsUrl, incomingServer) {
  var url;
  if (newsUrl instanceof Ci.nsIMsgMailNewsUrl) {
    url = newsUrl;
  } else {
    url = URLCreator.newURI(newsUrl, null, null);
  }

  var newsServer = incomingServer;
  if (!newsServer)
    newsServer = setupLocalServer(port);

  var listener = {
    onStartRequest : function () {},
    onStopRequest : function ()  {
      if (!this.called) {
        this.called = true;
        newsServer.closeCachedConnections();
        this.called = false;
      }
    },
    onDataAvailable : function () {},
    QueryInterface : function (iid) {
      if (iid.equals(Ci.nsIStreamListener) ||
          iid.equals(Ci.nsISupports))
        return this;

      throw Cr.NS_ERROR_NO_INTERFACE;
    }
  }
  listener.called = false;
  newsServer.loadNewsUrl(url, null, listener);
}

function create_post(baseURL, file) {
  var url = URLCreator.newURI(baseURL, null, null);
  url.QueryInterface(Ci.nsINntpUrl);

  var post = Cc["@mozilla.org/messenger/nntpnewsgrouppost;1"]
               .createInstance(Ci.nsINNTPNewsgroupPost);
  post.postMessageFile = do_get_file(file);
  url.messageToPost = post;
  return url;
}

function resetFolder(folder) {
  var headerEnum = folder.messages;
  var headers = [];
  while (headerEnum.hasMoreElements())
    headers.push(headerEnum.getNext().QueryInterface(Ci.nsIMsgDBHdr));

  var db = folder.msgDatabase;
  db.dBFolderInfo.knownArtsSet = "";
  for each (var header in headers) {
    db.DeleteHeader(header, null, true, false);
  }
  dump("resetting folder\n");
  folder.msgDatabase = null;
}

function do_check_transaction(real, expected) {
  // real.them may have an extra QUIT on the end, where the stream is only
  // closed after we have a chance to process it and not them. We therefore
  // excise this from the list
  if (real.them[real.them.length-1] == "QUIT")
    real.them.pop();

  do_check_eq(real.them.join(","), expected.join(","));
  dump("Passed test " + test + "\n");
}

function make_article(file) {
  var fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                  .createInstance(Ci.nsIFileInputStream);
  var sstream = Cc["@mozilla.org/scriptableinputstream;1"]
                  .createInstance(Ci.nsIScriptableInputStream);
  fstream.init(file, -1, 0, 0);
  sstream.init(fstream);

  var post = "";
  for (let part = sstream.read(4096); part.length > 0;) {
    post += part;
    part = sstream.read(4096);
  }
  sstream.close();
  fstream.close();
  return new newsArticle(post);
}

var articleTextListener = {
  data: "",
  finished: false,

  QueryInterface:
    XPCOMUtils.generateQI([Ci.nsIStreamListener, Ci.nsIRequestObserver]),

  // nsIRequestObserver
  onStartRequest: function(aRequest, aContext) {
  },
  onStopRequest: function(aRequest, aContext, aStatusCode) {
    do_check_eq(aStatusCode, 0);

    // Reduce any \r\n to just \n so we can do a good comparison on any
    // platform.
    this.data = this.data.replace(/\r\n/g, "\n");
    this.finished = true;
  },

  // nsIStreamListener
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    let scriptStream = Cc["@mozilla.org/scriptableinputstream;1"]
                         .createInstance(Ci.nsIScriptableInputStream);

    scriptStream.init(aInputStream);

    this.data += scriptStream.read(aCount);
  }
};
