/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ["Services"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyServiceGetter(Services, "accounts",
                                   "@mozilla.org/chat/accounts-service;1",
                                   "imIAccountsService");
XPCOMUtils.defineLazyServiceGetter(Services, "core",
                                   "@mozilla.org/chat/core-service;1",
                                   "imICoreService");
XPCOMUtils.defineLazyServiceGetter(Services, "cmd",
                                   "@mozilla.org/chat/commands-service;1",
                                   "imICommandsService");
XPCOMUtils.defineLazyServiceGetter(Services, "contacts",
                                   "@mozilla.org/chat/contacts-service;1",
                                   "imIContactsService");
XPCOMUtils.defineLazyServiceGetter(Services, "conversations",
                                   "@mozilla.org/chat/conversations-service;1",
                                   "imIConversationsService");
XPCOMUtils.defineLazyServiceGetter(Services, "tags",
                                   "@mozilla.org/chat/tags-service;1",
                                   "imITagsService");
XPCOMUtils.defineLazyServiceGetter(Services, "logs",
                                   "@mozilla.org/chat/logger;1",
                                   "imILogger");
