/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for more complicated nsIAbCard functions.
 *
 * XXX At the moment these just check the functions basically work i.e. can set
 * up all the parameters correctly. We'll have to extend them as we develop
 * the address book more, especially looking towards standards etc.
 */

// Main function for the this test so we can check both personal and
// collected books work correctly in an easy manner.
function run_test() {
  // Test setup - copy the data file into place
  var testAB = do_get_file("../mailnews/addrbook/test/unit/data/cardForEmail.mab");

  // Copy the file to the profile directory for a PAB
  testAB.copyTo(gProfileDir, kPABData.fileName);

  // Test - Get the directory
  var abManager = Components.classes["@mozilla.org/abmanager;1"]
                            .getService(Components.interfaces.nsIAbManager);

  var AB = abManager.getDirectory(kPABData.URI);

  var childCards = AB.childCards;
  var fullCard = null;
  var tempCard;

  while (childCards.hasMoreElements())
  {
    tempCard = childCards.getNext();

    // We want the one with the right email...
    if (tempCard instanceof Components.interfaces.nsIAbCard &&
        tempCard.primaryEmail == "PrimaryEmail1@test.invalid")
      fullCard = tempCard;
  }

  do_check_true(fullCard != null);

  // Test - VCard.

  do_check_eq(fullCard.translateTo("vcard"),
              "begin%3Avcard%0D%0Afn%3ADisplayName1%0D%0An%3ALastName1%3BFirstName1%0D%0Aorg%3AOrganization1%3BDepartment1%0D%0Aadr%3AWorkAddress21%3B%3BWorkAddress1%3BWorkCity1%3BWorkState1%3BWorkZipCode1%3BWorkCountry1%0D%0Aemail%3Binternet%3APrimaryEmail1%40test.invalid%0D%0Atitle%3AJobTitle1%0D%0Atel%3Bwork%3AWorkPhone1%0D%0Atel%3Bfax%3AFaxNumber1%0D%0Atel%3Bpager%3APagerNumber1%0D%0Atel%3Bhome%3AHomePhone1%0D%0Atel%3Bcell%3ACellularNumber1%0D%0Anote%3ANotes1%0D%0Aurl%3Ahttp%3A//WebPage21%0D%0Aversion%3A2.1%0D%0Aend%3Avcard%0D%0A%0D%0A");

  // Test - XML

  do_check_eq(fullCard.translateTo("xml"),
              "<GeneratedName>\nDisplayName1</GeneratedName>\n<table><tr><td><section><labelrow><label>Display Name: </label><DisplayName>DisplayName1</DisplayName></labelrow><labelrow><label>Nickname: </label><NickName>NickName1</NickName></labelrow><PrimaryEmail>PrimaryEmail1@test.invalid</PrimaryEmail><SecondEmail>SecondEmail1@test.invalid</SecondEmail><labelrow><label>Screen Name: </label><_AimScreenName>ScreenName1</_AimScreenName></labelrow></section></td></tr><tr><td><section><sectiontitle>Phone</sectiontitle><labelrow><label>Work: </label><WorkPhone>WorkPhone1</WorkPhone></labelrow><labelrow><label>Home: </label><HomePhone>HomePhone1</HomePhone></labelrow><labelrow><label>Fax: </label><FaxNumber>FaxNumber1</FaxNumber></labelrow><labelrow><label>Pager: </label><PagerNumber>PagerNumber1</PagerNumber></labelrow><labelrow><label>Mobile: </label><CellularNumber>CellularNumber1</CellularNumber></labelrow></section><section><sectiontitle>Other</sectiontitle><labelrow><label>Custom 1: </label><Custom1>Custom11</Custom1></labelrow><labelrow><label>Custom 2: </label><Custom2>Custom21</Custom2></labelrow><labelrow><label>Custom 3: </label><Custom3>Custom31</Custom3></labelrow><labelrow><label>Custom 4: </label><Custom4>Custom41</Custom4></labelrow><Notes>Notes1</Notes></section></td><td><section><sectiontitle>Home</sectiontitle><HomeAddress>HomeAddress11</HomeAddress><HomeAddress2>HomeAddress21</HomeAddress2><HomeCity>HomeCity1</HomeCity>, <HomeState>HomeState1</HomeState> <HomeZipCode>HomeZipCode1</HomeZipCode><HomeCountry>HomeCountry1</HomeCountry><WebPage2>http://WebPage11</WebPage2></section><section><sectiontitle>Work</sectiontitle><JobTitle>JobTitle1</JobTitle><Department>Department1</Department><Company>Organization1</Company><WorkAddress>WorkAddress1</WorkAddress><WorkAddress2>WorkAddress21</WorkAddress2><WorkCity>WorkCity1</WorkCity>, <WorkState>WorkState1</WorkState> <WorkZipCode>WorkZipCode1</WorkZipCode><WorkCountry>WorkCountry1</WorkCountry><WebPage1>http://WebPage21</WebPage1></section></td></tr></table>");

  // Test - base 64

  // btoa is only available for xpcom components or via window.btoa, so we
  // can't use it here.
  do_check_eq(fullCard.translateTo("base64xml"),
              "PD94bWwgdmVyc2lvbj0iMS4wIj8+Cjw/eG1sLXN0eWxlc2hlZXQgdHlwZT0idGV4dC9jc3MiIGhyZWY9ImNocm9tZTovL21lc3NhZ2Vib2R5L2NvbnRlbnQvYWRkcmVzc2Jvb2svcHJpbnQuY3NzIj8+CjxkaXJlY3Rvcnk+Cjx0aXRsZSB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCI+QWRkcmVzcyBCb29rPC90aXRsZT4KPEdlbmVyYXRlZE5hbWU+CkRpc3BsYXlOYW1lMTwvR2VuZXJhdGVkTmFtZT4KPHRhYmxlPjx0cj48dGQ+PHNlY3Rpb24+PGxhYmVscm93PjxsYWJlbD5EaXNwbGF5IE5hbWU6IDwvbGFiZWw+PERpc3BsYXlOYW1lPkRpc3BsYXlOYW1lMTwvRGlzcGxheU5hbWU+PC9sYWJlbHJvdz48bGFiZWxyb3c+PGxhYmVsPk5pY2tuYW1lOiA8L2xhYmVsPjxOaWNrTmFtZT5OaWNrTmFtZTE8L05pY2tOYW1lPjwvbGFiZWxyb3c+PFByaW1hcnlFbWFpbD5QcmltYXJ5RW1haWwxQHRlc3QuaW52YWxpZDwvUHJpbWFyeUVtYWlsPjxTZWNvbmRFbWFpbD5TZWNvbmRFbWFpbDFAdGVzdC5pbnZhbGlkPC9TZWNvbmRFbWFpbD48bGFiZWxyb3c+PGxhYmVsPlNjcmVlbiBOYW1lOiA8L2xhYmVsPjxfQWltU2NyZWVuTmFtZT5TY3JlZW5OYW1lMTwvX0FpbVNjcmVlbk5hbWU+PC9sYWJlbHJvdz48L3NlY3Rpb24+PC90ZD48L3RyPjx0cj48dGQ+PHNlY3Rpb24+PHNlY3Rpb250aXRsZT5QaG9uZTwvc2VjdGlvbnRpdGxlPjxsYWJlbHJvdz48bGFiZWw+V29yazogPC9sYWJlbD48V29ya1Bob25lPldvcmtQaG9uZTE8L1dvcmtQaG9uZT48L2xhYmVscm93PjxsYWJlbHJvdz48bGFiZWw+SG9tZTogPC9sYWJlbD48SG9tZVBob25lPkhvbWVQaG9uZTE8L0hvbWVQaG9uZT48L2xhYmVscm93PjxsYWJlbHJvdz48bGFiZWw+RmF4OiA8L2xhYmVsPjxGYXhOdW1iZXI+RmF4TnVtYmVyMTwvRmF4TnVtYmVyPjwvbGFiZWxyb3c+PGxhYmVscm93PjxsYWJlbD5QYWdlcjogPC9sYWJlbD48UGFnZXJOdW1iZXI+UGFnZXJOdW1iZXIxPC9QYWdlck51bWJlcj48L2xhYmVscm93PjxsYWJlbHJvdz48bGFiZWw+TW9iaWxlOiA8L2xhYmVsPjxDZWxsdWxhck51bWJlcj5DZWxsdWxhck51bWJlcjE8L0NlbGx1bGFyTnVtYmVyPjwvbGFiZWxyb3c+PC9zZWN0aW9uPjxzZWN0aW9uPjxzZWN0aW9udGl0bGU+T3RoZXI8L3NlY3Rpb250aXRsZT48bGFiZWxyb3c+PGxhYmVsPkN1c3RvbSAxOiA8L2xhYmVsPjxDdXN0b20xPkN1c3RvbTExPC9DdXN0b20xPjwvbGFiZWxyb3c+PGxhYmVscm93PjxsYWJlbD5DdXN0b20gMjogPC9sYWJlbD48Q3VzdG9tMj5DdXN0b20yMTwvQ3VzdG9tMj48L2xhYmVscm93PjxsYWJlbHJvdz48bGFiZWw+Q3VzdG9tIDM6IDwvbGFiZWw+PEN1c3RvbTM+Q3VzdG9tMzE8L0N1c3RvbTM+PC9sYWJlbHJvdz48bGFiZWxyb3c+PGxhYmVsPkN1c3RvbSA0OiA8L2xhYmVsPjxDdXN0b200PkN1c3RvbTQxPC9DdXN0b200PjwvbGFiZWxyb3c+PE5vdGVzPk5vdGVzMTwvTm90ZXM+PC9zZWN0aW9uPjwvdGQ+PHRkPjxzZWN0aW9uPjxzZWN0aW9udGl0bGU+SG9tZTwvc2VjdGlvbnRpdGxlPjxIb21lQWRkcmVzcz5Ib21lQWRkcmVzczExPC9Ib21lQWRkcmVzcz48SG9tZUFkZHJlc3MyPkhvbWVBZGRyZXNzMjE8L0hvbWVBZGRyZXNzMj48SG9tZUNpdHk+SG9tZUNpdHkxPC9Ib21lQ2l0eT4sIDxIb21lU3RhdGU+SG9tZVN0YXRlMTwvSG9tZVN0YXRlPiA8SG9tZVppcENvZGU+SG9tZVppcENvZGUxPC9Ib21lWmlwQ29kZT48SG9tZUNvdW50cnk+SG9tZUNvdW50cnkxPC9Ib21lQ291bnRyeT48V2ViUGFnZTI+aHR0cDovL1dlYlBhZ2UxMTwvV2ViUGFnZTI+PC9zZWN0aW9uPjxzZWN0aW9uPjxzZWN0aW9udGl0bGU+V29yazwvc2VjdGlvbnRpdGxlPjxKb2JUaXRsZT5Kb2JUaXRsZTE8L0pvYlRpdGxlPjxEZXBhcnRtZW50PkRlcGFydG1lbnQxPC9EZXBhcnRtZW50PjxDb21wYW55Pk9yZ2FuaXphdGlvbjE8L0NvbXBhbnk+PFdvcmtBZGRyZXNzPldvcmtBZGRyZXNzMTwvV29ya0FkZHJlc3M+PFdvcmtBZGRyZXNzMj5Xb3JrQWRkcmVzczIxPC9Xb3JrQWRkcmVzczI+PFdvcmtDaXR5PldvcmtDaXR5MTwvV29ya0NpdHk+LCA8V29ya1N0YXRlPldvcmtTdGF0ZTE8L1dvcmtTdGF0ZT4gPFdvcmtaaXBDb2RlPldvcmtaaXBDb2RlMTwvV29ya1ppcENvZGU+PFdvcmtDb3VudHJ5PldvcmtDb3VudHJ5MTwvV29ya0NvdW50cnk+PFdlYlBhZ2UxPmh0dHA6Ly9XZWJQYWdlMjE8L1dlYlBhZ2UxPjwvc2VjdGlvbj48L3RkPjwvdHI+PC90YWJsZT48L2RpcmVjdG9yeT4K");
}
