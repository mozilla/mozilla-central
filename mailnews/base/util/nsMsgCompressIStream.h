/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsIAsyncInputStream.h"
#include "nsIInputStream.h"
#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "zlib.h"

class NS_MSG_BASE nsMsgCompressIStream : public nsIAsyncInputStream
{
public:
  nsMsgCompressIStream();
  ~nsMsgCompressIStream();

  NS_DECL_THREADSAFE_ISUPPORTS
    
  NS_DECL_NSIINPUTSTREAM
  NS_DECL_NSIASYNCINPUTSTREAM

  nsresult InitInputStream(nsIInputStream *rawStream);

protected:
  nsresult DoInflation();
  nsCOMPtr<nsIInputStream> m_iStream;
  nsAutoArrayPtr<char> m_zbuf;
  nsAutoArrayPtr<char> m_databuf;
  char *m_dataptr;
  uint32_t m_dataleft;
  bool m_inflateAgain;
  z_stream m_zstream;
};

