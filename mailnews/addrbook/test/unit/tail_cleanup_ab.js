/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * In this file we clean up the address books created during the tests.
 */

var abs = [ kPABData.fileName,
            kCABData.fileName ];

try {
  // Now remove the directory
  if (profileDir.exists())
    profileDir.remove(true);
}
catch (e) {
  throw "FAILED to clean up AB tests: " + e;
}
