/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsMailDirProvider to check we get the right directories and
 * files.
 */

function run_test() {
  const items = [ { key: "MailD", value: "Mail" },
                  { key: "IMapMD", value: "ImapMail" },
                  { key: "NewsD", value: "News" },
                  { key: "MFCaF", value: "panacea.dat" } ];

  items.forEach(function(item) {
    var dir = dirSvc.get(item.key, nsIFile);
    dump(profileDir.path + " " + dir.path + "\n");
    do_check_true(profileDir.equals(dir.parent));

    do_check_eq(dir.leafName, item.value);
  });
};
