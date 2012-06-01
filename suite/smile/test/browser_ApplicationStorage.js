function test() {
  // test for existence of values
  var hasItem = Application.storage.has("smile-test-missing");
  is(hasItem, false, "Check 'Application.storage.has' for nonexistent item");
  Application.storage.set("smile-test", "dummy");
  hasItem = Application.storage.has("smile-test");
  is(hasItem, true, "Check 'Application.storage.has' for existing item");

  // test getting nonexistent and existing values
  var itemValue = Application.storage.get("smile-test-missing", "default");
  is(itemValue, "default", "Check 'Application.storage.get' for nonexistent item");
  itemValue = Application.storage.get("smile-test", "default");
  is(itemValue, "dummy", "Check 'Application.storage.get' for existing item");

  // test for overwriting an existing value
  Application.storage.set("smile-test", "smarty");
  itemValue = Application.storage.get("smile-test", "default");
  is(itemValue, "smarty", "Check 'Application.storage.get' for overwritten item");

  // check for change event when setting a value
  waitForExplicitFinish();
  Application.storage.events.addListener("change", onStorageChange);
  Application.storage.set("smile-test", "change event");
}

function onStorageChange(evt) {
  is(evt.data, "smile-test", "Check 'Application.storage.set' fired a change event");
  Application.storage.events.removeListener("change", onStorageChange);
  finish();
}
