/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsSyncRunnableHelpers_h
#define nsSyncRunnableHelpers_h

#include "nsThreadUtils.h"

#include "nsIStreamListener.h"
#include "nsIInterfaceRequestor.h"
#include "nsIImapMailFolderSink.h"
#include "nsIImapServerSink.h"
#include "nsIImapProtocolSink.h"
#include "nsIImapMessageSink.h"

// The classes in this file proxy method calls to the main thread
// synchronously. The main thread must not block on this thread, or a
// deadlock condition can occur.

class StreamListenerProxy : public nsIStreamListener
{
public:
  StreamListenerProxy(nsIStreamListener* receiver)
    : mReceiver(receiver)
  { }

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIREQUESTOBSERVER
  NS_DECL_NSISTREAMLISTENER

private:
  nsCOMPtr<nsIStreamListener> mReceiver;
};

class ImapMailFolderSinkProxy : public nsIImapMailFolderSink
{
public:
  ImapMailFolderSinkProxy(nsIImapMailFolderSink* receiver)
    : mReceiver(receiver)
  {
    NS_ASSERTION(receiver, "Don't allow receiver is nullptr");
  }

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIIMAPMAILFOLDERSINK

private:
  nsCOMPtr<nsIImapMailFolderSink> mReceiver;
};

class ImapServerSinkProxy : public nsIImapServerSink
{
public:
  ImapServerSinkProxy(nsIImapServerSink* receiver)
    : mReceiver(receiver)
  { }

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIIMAPSERVERSINK

private:
  nsCOMPtr<nsIImapServerSink> mReceiver;
};


class ImapMessageSinkProxy: public nsIImapMessageSink
{
public:
  ImapMessageSinkProxy(nsIImapMessageSink* receiver)
    : mReceiver(receiver)
  { }

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIIMAPMESSAGESINK

private:
  nsCOMPtr<nsIImapMessageSink> mReceiver;
};

class ImapProtocolSinkProxy : public nsIImapProtocolSink
{
public:
  ImapProtocolSinkProxy(nsIImapProtocolSink* receiver)
    : mReceiver(receiver)
  { }

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIIMAPPROTOCOLSINK

private:
  nsCOMPtr<nsIImapProtocolSink> mReceiver;
};
#endif // nsSyncRunnableHelpers_h
