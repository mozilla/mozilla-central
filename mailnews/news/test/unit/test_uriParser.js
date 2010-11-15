// Tests nsINntpUrl parsing.


let tests = [
  // news://host/-based URIs
  { uri: "news://localhost/?newgroups",
    newsAction: Ci.nsINntpUrl.ActionListNewGroups
  },
  // news://host/group-based
  { uri: "news://news.server.example/example.group.this",
    newsAction: Ci.nsINntpUrl.ActionGetNewNews,
    group: "example.group.this"
  },
  { uri: "news://news.server.example/*",
    newsAction: Ci.nsINntpUrl.ActionListGroups
  },
  { uri: "news://news.server.example/news.*",
    newsAction: Ci.nsINntpUrl.ActionListGroups
  },
  { uri: "news://localhost/some.group?list-ids",
    newsAction: Ci.nsINntpUrl.ActionListIds,
    group: "some.group"
  },
  { uri: "news://localhost/some.group?search/XPAT From 1-5 [Ww][Hh][Oo]",
    newsAction: Ci.nsINntpUrl.ActionSearch,
    group: "some.group"
  },

  // news://host/message-based URIs
  { uri: "news://localhost/message-id@some-host.invalid",
    newsAction: Ci.nsINntpUrl.ActionFetchArticle,
    messageID: "message-id@some-host.invalid"
  },
  { uri: "news://localhost/message-id@some-host.invalid?part=1.4",
    newsAction: Ci.nsINntpUrl.ActionFetchPart,
    messageID: "message-id@some-host.invalid"
  },
  { uri: "news://localhost/message-id@some-host.invalid?cancel",
    newsAction: Ci.nsINntpUrl.ActionCancelArticle,
    messageID: "message-id@some-host.invalid"
  },
];

function run_test() {
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
}
