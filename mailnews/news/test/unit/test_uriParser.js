// Tests nsINntpUrl parsing.

Components.utils.import("resource://gre/modules/Services.jsm");

var localserver;
let tests = [
  // news://host/-based URIs
  { uri: "news://localhost/?newgroups",
    get server() { return localserver; },
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionListNewGroups
  },
  // news://host/group-based
  { uri: "news://news.server.example/example.group.this",
    server: null,
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionGetNewNews,
    group: "example.group.this"
  },
  { uri: "news://news.server.example/*",
    server: null,
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionListGroups
  },
  { uri: "news://news.server.example/news.*",
    server: null,
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionListGroups
  },
  { uri: "news://localhost/test.filter?list-ids",
    get server() { return localserver; },
    get folder() { return localserver.rootFolder.getChildNamed("test.filter"); },
    newsAction: Ci.nsINntpUrl.ActionListIds,
    group: "test.filter"
  },
  { uri: "news://localhost/some.group?search/XPAT From 1-5 [Ww][Hh][Oo]",
    get server() { return localserver; },
    newsAction: Ci.nsINntpUrl.ActionSearch,
    group: "some.group"
  },

  // news://host/message-based URIs
  { uri: "news://localhost/message-id@some-host.invalid",
    get server() { return localserver; },
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionFetchArticle,
    messageID: "message-id@some-host.invalid",
    group: "",
    key: 0xffffffff
  },
  { uri: "news://localhost/message-id@some-host.invalid?part=1.4",
    get server() { return localserver; },
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionFetchPart,
    messageID: "message-id@some-host.invalid"
  },
  { uri: "news://localhost/message-id@some-host.invalid?cancel",
    get server() { return localserver; },
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionCancelArticle,
    messageID: "message-id@some-host.invalid"
  },
  { uri: "news://localhost/message-id@some-host.invalid?group=foo&key=123",
    get server() { return localserver; },
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionFetchArticle,
    messageID: "message-id@some-host.invalid",
    group: "foo",
    key: 123
  },

  // No-authority uris
  { uri: "news:rec.games.pinball",
    server: null,
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionGetNewNews,
    group: "rec.games.pinball",
    host: ""
  },
  { uri: "news:message-id@some-host.invalid",
    server: null,
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionFetchArticle,
    messageID: "message-id@some-host.invalid",
    group: "",
    key: 0xffffffff
  },

  // news-message://host/group#key
  { uri: "news-message://localhost/test.simple.subscribe#1",
    newsAction: Ci.nsINntpUrl.ActionFetchArticle,
    group: "test.simple.subscribe",
    key: 1
  },

  // nntp://host/group
  { uri: "nntp://localhost/test.filter",
    get server() { return localserver; },
    get folder() { return localserver.rootFolder.getChildNamed("test.filter"); },
    newsAction: Ci.nsINntpUrl.ActionGetNewNews,
    group: "test.filter"
  },
  { uri: "nntp://localhost/i.dont.exist",
    get server() { return localserver; },
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionGetNewNews,
    group: "i.dont.exist"
  },
  { uri: "nntp://news.example.invalid/i.dont.exist",
    server: null,
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionGetNewNews,
    group: "i.dont.exist"
  },

  // nntp://host/group/key
  { uri: "nntp://localhost/test.filter/123",
    get server() { return localserver; },
    get folder() { return localserver.rootFolder.getChildNamed("test.filter"); },
    newsAction: Ci.nsINntpUrl.ActionFetchArticle,
    group: "test.filter",
    key: 123
  },
  { uri: "nntp://localhost/i.dont.exist/123",
    get server() { return localserver; },
    folder: null,
    newsAction: Ci.nsINntpUrl.ActionFetchArticle,
    group: "i.dont.exist",
    key: 123
  },
];

let invalid_uris = [
  "news-message://localhost/test.simple.subscribe#hello",
  "nntp://localhost/",
  "nntp://localhost/a.group/hello",
  "nntp://localhost/a.group/0",
  "nntp:a.group"
];

function run_test() {
  // We're not running the server, just setting it up
  localserver = setupLocalServer(119);
  let nntpService = Cc["@mozilla.org/messenger/nntpservice;1"]
                      .getService(Components.interfaces.nsIProtocolHandler);
  for each (let test in tests) {
    dump("Checking URL " + test.uri + "\n");
    let url = nntpService.newURI(test.uri, null, null);
    url.QueryInterface(Ci.nsIMsgMailNewsUrl);
    url.QueryInterface(Ci.nsINntpUrl);
    for (let prop in test) {
      if (prop == "uri")
        continue;
      do_check_eq(url[prop], test[prop]);
    }
  }

  for each (let fail in invalid_uris) {
    try {
      dump("Checking URL " + fail + " for failure\n");
      nntpService.newURI(fail, null, null);
      do_check_true(false);
    } catch (e) {
      do_check_eq(e.result, Components.results.NS_ERROR_MALFORMED_URI);
    }
  }

  // The password migration is async, so trigger an event to prevent the logon
  // manager from trying to migrate after shutdown has started.
  let thread = Services.tm.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}
