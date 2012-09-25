/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MailNewsTypes_h__
#define MailNewsTypes_h__

#include "msgCore.h"
#include "MailNewsTypes2.h"

/* nsMsgKey is a unique ID for a particular message in a folder.  If you want
   a handle to a message that will remain valid even after resorting the folder
   or otherwise changing their indices, you want one of these rather than a
   nsMsgViewIndex. nsMsgKeys don't survive local mail folder compression, however.
 */
const nsMsgKey nsMsgKey_None = 0xffffffff;

/* nsMsgViewIndex
 *
 * A generic index type from which other index types are derived.  All nsMsgViewIndex
 * derived types are zero based.
 *
 * The following index types are currently supported:
 *  - nsMsgViewIndex - an index into the list of messages or folders or groups,
 *    where zero is the first one to show, one is the second, etc...
 *  - AB_SelectionIndex
 *  - AB_NameCompletionIndex
 */

const nsMsgViewIndex nsMsgViewIndex_None = 0xFFFFFFFF;

#endif
