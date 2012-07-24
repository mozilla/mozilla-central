var setupModule = function () {
  controller = mozmill.getBrowserController();
}

var teardownModule = function () {
  controller.startUserShutdown(1000, true);
  controller.window.Application.restart();
}
