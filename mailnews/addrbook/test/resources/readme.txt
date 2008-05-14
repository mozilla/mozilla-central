This resources (mailnews/test/resources) directory contains various support
files for the testing of mailnews.

---------------------------
xpcshell Test Support Files
---------------------------

Profile Directory setup and clean up scripts are in mailnews/test/resources
and are included automatically by the head_addrbook.js and tail_addrbook.js
files.

abSetup.js
----------

Has kPABData and kCABData objects with the default address book setups in them.

---------------------
General Support Files
---------------------

abLists1.mab
------------

An address book with 5 cards and 3 lists. The cards only have the email and
prefer mail format set:

test1@invalid.com  unknown
test2@invalid.com  unknown
test3@invalid.com  unknown
test4@invalid.com  plain text
test5@invalid.com  html

There are 3 lists, TestList1, TestList2 and TestList3. They have the following
cards:

TestList1:

test1@invalid.com
test2@invalid.com
test3@invalid.com

TestList2:

test4@invalid.com

TestList3:

test5@invalid.com


abLists2.mab
------------

The same as abLists1.mab, but with com.invalid instead of invalid.com, and ListTestX instead of TestListX.
