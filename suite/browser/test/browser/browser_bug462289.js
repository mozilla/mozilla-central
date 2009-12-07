var tab1, tab2;

function test() {
  waitForExplicitFinish();

  tab1 = gBrowser.addTab();
  tab2 = gBrowser.addTab();
  executeSoon(step1);
}

function step1() {
  EventUtils.synthesizeMouse(tab1, 9, 9, {});
  executeSoon(step2);
}

function step2()
{
  is(gBrowser.selectedTab, tab1, "mouse on tab selects tab");
  isnot(document.activeElement, tab1, "mouse on tab not activeElement");

  EventUtils.synthesizeMouse(tab1, 9, 9, {});
  executeSoon(step3);
}

function step3()
{
  todo_is(document.activeElement, tab1, "mouse on tab again activeElement");

  document.getElementById("urlbar").inputField.focus();
  EventUtils.synthesizeKey("VK_TAB", { });

  let osString = Components.classes["@mozilla.org/xre/app-info;1"]
                           .getService(Ci.nsIXULRuntime).OS;
  if (osString != "Linux" || document.activeElement == tab1) {
    // Expected behavior.
    is(document.activeElement, tab1, "tab key to tab activeElement");
  } else {
    // Linux intermittent failure.
    // Check local name too to help diagnose bug 491624.
    todo_is(document.activeElement.localName, "tab",
            "tab key to tab activeElement (bug 491624: name = " +
              document.activeElement.localName + ")");
    todo_is(document.activeElement, tab1,
            "tab key to tab activeElement (bug 491624: object = " +
              document.activeElement + ")");
  }

  EventUtils.synthesizeMouse(tab1, 9, 9, {});
  executeSoon(step4);
}

function step4()
{
  is(document.activeElement, tab1, "mouse on tab while focused still activeElement");

  EventUtils.synthesizeMouse(tab2, 9, 9, {});
  executeSoon(step5);
}

function step5()
{
  is(document.activeElement, tab2, "mouse on another tab while focused still activeElement");

  gBrowser.removeTab(tab1);
  gBrowser.removeTab(tab2);

  finish();
}
