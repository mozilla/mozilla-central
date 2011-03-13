// Wanted delay (in ms) to let UI fully update.
// 375: hopefully enough (on slow test environments).
var gDelay = 375;

var tab1, tab2;

function focus_in_navbar()
{
  var parent = document.activeElement.parentNode;
  while (parent && parent.id != "nav-bar")
    parent = parent.parentNode;

  return parent != null;
}

function test()
{
  waitForExplicitFinish();

  // Ftr, SeaMonkey doesn't support animation (yet).
  tab1 = gBrowser.addTab("about:blank");
  tab2 = gBrowser.addTab("about:blank");

  EventUtils.synthesizeMouseAtCenter(tab1, {});
  setTimeout(step2, gDelay);
}

function step2()
{
  is(gBrowser.selectedTab, tab1, "1st click on tab1 selects tab");
  isnot(document.activeElement, tab1, "1st click on tab1 does not activate tab");

  EventUtils.synthesizeMouseAtCenter(tab1, {});
  setTimeout(step3, gDelay);
}

function step3()
{
  is(gBrowser.selectedTab, tab1, "2nd click on selected tab1 keeps tab selected");
  // SeaMonkey differs from Firefox.
  is(document.activeElement, tab1, "2nd click on selected tab1 activates tab");

  // Ftr, SeaMonkey doesn't support tabsontop (yet).
  ok(true, "focusing URLBar then sending Tab(s) until out of nav-bar.");
  document.getElementById("urlbar").focus();
  while (focus_in_navbar())
    EventUtils.synthesizeKey("VK_TAB", { });
  is(gBrowser.selectedTab, tab1, "tab key to selected tab1 keeps tab selected");
  is(document.activeElement, tab1, "tab key to selected tab1 activates tab");

  EventUtils.synthesizeMouseAtCenter(tab1, {});
  setTimeout(step4, gDelay);
}

function step4()
{
  is(gBrowser.selectedTab, tab1, "3rd click on activated tab1 keeps tab selected");
  is(document.activeElement, tab1, "3rd click on activated tab1 keeps tab activated");

  EventUtils.synthesizeMouseAtCenter(tab2, {});
  setTimeout(step5, gDelay);
}

function step5()
{
  // The tabbox selects a tab within a setTimeout in a bubbling mousedown event
  // listener, and focuses the current tab if another tab previously had focus.
  is(gBrowser.selectedTab, tab2, "click on tab2 while tab1 is activated selects tab");
  is(document.activeElement, tab2, "click on tab2 while tab1 is activated activates tab");

  ok(true, "focusing content then sending middle-button mousedown to tab2.");
  content.focus();
  EventUtils.synthesizeMouseAtCenter(tab2, {button: 1, type: "mousedown"});
  setTimeout(step6, gDelay);
}

function step6()
{
  is(gBrowser.selectedTab, tab2, "middle-button mousedown on selected tab2 keeps tab selected");
  // SeaMonkey differs from Firefox.
  is(document.activeElement, tab2, "middle-button mousedown on selected tab2 activates tab");

  gBrowser.removeTab(tab2);
  gBrowser.removeTab(tab1);

  finish();
}
