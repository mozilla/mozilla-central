load("../../../resources/mailShutdown.js");

if (_server)
  _server.QueryInterface(Components.interfaces.nsISubscribableServer)
         .subscribeCleanup();
