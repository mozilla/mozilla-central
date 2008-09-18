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
              "PD94bWwgdmVyc2lvbj0iMS4wIj8+Cjw/eG1sLXN0eWxlc2hlZXQgdHlwZT0idGV4dC9jc3MiIGhyZWY9ImNocm9tZTovL21lc3Nlbmdlci9jb250ZW50L2FkZHJlc3Nib29rL3ByaW50LmNzcyI/Pgo8ZGlyZWN0b3J5Pgo8dGl0bGUgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwiPkFkZHJlc3MgQm9vazwvdGl0bGU+CjxHZW5lcmF0ZWROYW1lPgpEaXNwbGF5TmFtZTE8L0dlbmVyYXRlZE5hbWU+Cjx0YWJsZT48dHI+PHRkPjxzZWN0aW9uPjxsYWJlbHJvdz48bGFiZWw+RGlzcGxheSBOYW1lOiA8L2xhYmVsPjxEaXNwbGF5TmFtZT5EaXNwbGF5TmFtZTE8L0Rpc3BsYXlOYW1lPjwvbGFiZWxyb3c+PGxhYmVscm93PjxsYWJlbD5OaWNrbmFtZTogPC9sYWJlbD48Tmlja05hbWU+Tmlja05hbWUxPC9OaWNrTmFtZT48L2xhYmVscm93PjxQcmltYXJ5RW1haWw+UHJpbWFyeUVtYWlsMUB0ZXN0LmludmFsaWQ8L1ByaW1hcnlFbWFpbD48U2Vjb25kRW1haWw+U2Vjb25kRW1haWwxQHRlc3QuaW52YWxpZDwvU2Vjb25kRW1haWw+PGxhYmVscm93PjxsYWJlbD5TY3JlZW4gTmFtZTogPC9sYWJlbD48X0FpbVNjcmVlbk5hbWU+U2NyZWVuTmFtZTE8L19BaW1TY3JlZW5OYW1lPjwvbGFiZWxyb3c+PC9zZWN0aW9uPjwvdGQ+PC90cj48dHI+PHRkPjxzZWN0aW9uPjxzZWN0aW9udGl0bGU+UGhvbmU8L3NlY3Rpb250aXRsZT48bGFiZWxyb3c+PGxhYmVsPldvcms6IDwvbGFiZWw+PFdvcmtQaG9uZT5Xb3JrUGhvbmUxPC9Xb3JrUGhvbmU+PC9sYWJlbHJvdz48bGFiZWxyb3c+PGxhYmVsPkhvbWU6IDwvbGFiZWw+PEhvbWVQaG9uZT5Ib21lUGhvbmUxPC9Ib21lUGhvbmU+PC9sYWJlbHJvdz48bGFiZWxyb3c+PGxhYmVsPkZheDogPC9sYWJlbD48RmF4TnVtYmVyPkZheE51bWJlcjE8L0ZheE51bWJlcj48L2xhYmVscm93PjxsYWJlbHJvdz48bGFiZWw+UGFnZXI6IDwvbGFiZWw+PFBhZ2VyTnVtYmVyPlBhZ2VyTnVtYmVyMTwvUGFnZXJOdW1iZXI+PC9sYWJlbHJvdz48bGFiZWxyb3c+PGxhYmVsPk1vYmlsZTogPC9sYWJlbD48Q2VsbHVsYXJOdW1iZXI+Q2VsbHVsYXJOdW1iZXIxPC9DZWxsdWxhck51bWJlcj48L2xhYmVscm93Pjwvc2VjdGlvbj48c2VjdGlvbj48c2VjdGlvbnRpdGxlPk90aGVyPC9zZWN0aW9udGl0bGU+PGxhYmVscm93PjxsYWJlbD5DdXN0b20gMTogPC9sYWJlbD48Q3VzdG9tMT5DdXN0b20xMTwvQ3VzdG9tMT48L2xhYmVscm93PjxsYWJlbHJvdz48bGFiZWw+Q3VzdG9tIDI6IDwvbGFiZWw+PEN1c3RvbTI+Q3VzdG9tMjE8L0N1c3RvbTI+PC9sYWJlbHJvdz48bGFiZWxyb3c+PGxhYmVsPkN1c3RvbSAzOiA8L2xhYmVsPjxDdXN0b20zPkN1c3RvbTMxPC9DdXN0b20zPjwvbGFiZWxyb3c+PGxhYmVscm93PjxsYWJlbD5DdXN0b20gNDogPC9sYWJlbD48Q3VzdG9tND5DdXN0b200MTwvQ3VzdG9tND48L2xhYmVscm93PjxOb3Rlcz5Ob3RlczE8L05vdGVzPjwvc2VjdGlvbj48L3RkPjx0ZD48c2VjdGlvbj48c2VjdGlvbnRpdGxlPkhvbWU8L3NlY3Rpb250aXRsZT48SG9tZUFkZHJlc3M+SG9tZUFkZHJlc3MxMTwvSG9tZUFkZHJlc3M+PEhvbWVBZGRyZXNzMj5Ib21lQWRkcmVzczIxPC9Ib21lQWRkcmVzczI+PEhvbWVDaXR5PkhvbWVDaXR5MTwvSG9tZUNpdHk+LCA8SG9tZVN0YXRlPkhvbWVTdGF0ZTE8L0hvbWVTdGF0ZT4gPEhvbWVaaXBDb2RlPkhvbWVaaXBDb2RlMTwvSG9tZVppcENvZGU+PEhvbWVDb3VudHJ5PkhvbWVDb3VudHJ5MTwvSG9tZUNvdW50cnk+PFdlYlBhZ2UyPmh0dHA6Ly9XZWJQYWdlMTE8L1dlYlBhZ2UyPjwvc2VjdGlvbj48c2VjdGlvbj48c2VjdGlvbnRpdGxlPldvcms8L3NlY3Rpb250aXRsZT48Sm9iVGl0bGU+Sm9iVGl0bGUxPC9Kb2JUaXRsZT48RGVwYXJ0bWVudD5EZXBhcnRtZW50MTwvRGVwYXJ0bWVudD48Q29tcGFueT5Pcmdhbml6YXRpb24xPC9Db21wYW55PjxXb3JrQWRkcmVzcz5Xb3JrQWRkcmVzczE8L1dvcmtBZGRyZXNzPjxXb3JrQWRkcmVzczI+V29ya0FkZHJlc3MyMTwvV29ya0FkZHJlc3MyPjxXb3JrQ2l0eT5Xb3JrQ2l0eTE8L1dvcmtDaXR5PiwgPFdvcmtTdGF0ZT5Xb3JrU3RhdGUxPC9Xb3JrU3RhdGU+IDxXb3JrWmlwQ29kZT5Xb3JrWmlwQ29kZTE8L1dvcmtaaXBDb2RlPjxXb3JrQ291bnRyeT5Xb3JrQ291bnRyeTE8L1dvcmtDb3VudHJ5PjxXZWJQYWdlMT5odHRwOi8vV2ViUGFnZTIxPC9XZWJQYWdlMT48L3NlY3Rpb24+PC90ZD48L3RyPjwvdGFibGU+PC9kaXJlY3Rvcnk+Cg==");
}
