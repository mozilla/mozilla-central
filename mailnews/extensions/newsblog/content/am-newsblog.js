/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gServer;

function onInit(aPageId, aServerId)
{
  var accountName = document.getElementById("server.prettyName");
  var title = document.getElementById("am-newsblog-title");
  var defaultTitle = title.getAttribute("defaultTitle");

  var titleValue;
  if (accountName.value)
    titleValue = defaultTitle + " - <" + accountName.value + ">";
  else
    titleValue = defaultTitle;

  title.setAttribute("title", titleValue);
  document.title = titleValue;

  onCheckItem("server.biffMinutes", ["server.doBiff"]);
}

function onPreInit(account, accountValues)
{
  gServer = account.incomingServer;
}
