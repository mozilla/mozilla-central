/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * In this file we clean up the address books created during the tests.
 *
 * Note: This file relies on abSetup.js being loaded.
 */

var abs = [ kPABData.fileName,
            kCABData.fileName ];

function cleanup()
{
  // If you've removed anything from a database in your test,
  // be sure to clear any references to the removed objects
  // and call gc() before you call this cleanup() function
  // otherwise the forceClosed() call will remove mork objects
  // underneath us and by the time GC happens things go screwy
  try {
    // Get the top-level directory
    var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                        .getService(Components.interfaces.nsIRDFService);

    var childNodes = rdf.GetResource("moz-abdirectory:///")
                        .QueryInterface(Components.interfaces.nsIAbDirectory)
                        .childNodes;

    // and iterate through it, shutting down MDB databases where appropriate
    while (childNodes.hasMoreElements()) {
      var ab = childNodes.getNext();
      if (ab instanceof Components.interfaces.nsIAbMDBDirectory) {
        try {
          var database = ab.database;
          if (database)
            database.forceClosed();
        }
        catch (e) {
          // If the file wasn't found, then it doesn't matter.
        }
      }
    }

    // Now remove the directory
    if (profileDir.exists())
      profileDir.remove(true);
  }
  catch (e) {
    throw "FAILED to clean up AB tests: " + e;
  }
}
