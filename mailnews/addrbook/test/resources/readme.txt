This resources (mailnews/test/resources) directory contains various support
files for the testing of mailnews.

---------------------------
xpcshell Test Support Files
---------------------------

abSetup.js
----------

Provides a basic directory service which will store address books in
(objdir)/dist/bin/addrbook. Also has kPABData and kCABData objects with the
default address book setups in them. Once imported, everything is available.

abCleanup.js
------------

Provides the cleanup() function for closing down the address book and then
removing the remaining files. Relies on abSetup.js.

