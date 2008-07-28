// Import the servers
do_import_script("../mailnews/test/fakeserver/maild.js")
do_import_script("../mailnews/test/fakeserver/nntpd.js")

// Generic mailnews resource scripts
do_import_script("../mailnews/test/resources/mailDirService.js")

// The groups to set up on the fake server.
// It is an array of tuples, where the first element is the group name and the
// second element is whether or not we should subscribe to it.
var groups = [
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

  var auto_add = do_get_file("../mailnews/news/test/postings/auto-add/");
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

  var article = new newsArticle("From: John Doe <john.doe@example.com>\n"+
      "Date: Sat, 24 Mar 1990 10:59:24 -0500\n"+
      "Newsgroups: test.subscribe.simple\n"+
      "Subject: H2G2 -- What does it mean?\n"+
      "Message-ID: <TSS1@nntp.test>\n"+
      "\n"+
      "What does the acronym H2G2 stand for? I've seen it before...\n");
  daemon.addArticleToGroup(article, "test.subscribe.simple", 1);

  return daemon;
}

// Enable strict threading
var prefs = Cc["@mozilla.org/preferences-service;1"]
              .getService(Ci.nsIPrefBranch);
prefs.setBoolPref("mail.strict_threading", true);


// Make sure we don't try to use a protected port. I like adding 1024 to the
// default port when doing so...
const NNTP_PORT = 1024+119;

var _server = null;

// Sets up the client-side portion of fakeserver
function setupLocalServer(port) {
  if (_server != null)
    return _server;
  var acctmgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  
  var server = acctmgr.createIncomingServer(null, "localhost", "nntp");
  server.port = port;
  server.valid = false;

  var account = acctmgr.createAccount();
  account.incomingServer = server;
  server.valid = true;

  // Subscribe to certain posts
  server.QueryInterface(Ci.nsINntpIncomingServer);
  groups.forEach(function (element) {
      if (element[1])
        server.subscribeToNewsgroup(element[0]);
    });

  _server = server;
  
  return server;
}

const URLCreator = Cc["@mozilla.org/messenger/messageservice;1?type=news"]
                     .getService(Ci.nsINntpService)
                     .QueryInterface(Ci.nsIProtocolHandler);

// Sets up a protocol object and prepares to run the test for the news url
function setupProtocolTest(port, newsUrl) {
  var url;
  if (newsUrl instanceof Ci.nsIMsgMailNewsUrl) { 
    url = newsUrl;
  } else {
    url = URLCreator.newURI(newsUrl, null, null);
  }
  server = setupLocalServer(port);
  
  var connection = {};
  server.getNntpConnection(url, null, connection);
  connection = connection.value;
  
  var listener = {
    onStartRequest : function () {},
    onStopRequest : function ()  {
      if (!this.called) {
        this.called = true;
        connection.CloseConnection();
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

  connection.Initialize(url, null);
  connection.LoadNewsUrl(url, listener);
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
  var headerEnum = folder.getMessages(null);
  var headers = [];
  while (headerEnum.hasMoreElements())
    headers.push(headerEnum.getNext().QueryInterface(Ci.nsIMsgDBHdr));

  var db = folder.getMsgDatabase(null);
  db.dBFolderInfo.knownArtsSet = "";
  for each (var header in headers) {
    db.DeleteHeader(header, null, true, false);
  }
}
