#include "msgCore.h"
#include "nsIOutputStream.h"
#include "nsAutoPtr.h"
#include "nsCOMPtr.h"
#include "zlib.h"

class NS_MSG_BASE nsMsgCompressOStream : public nsIOutputStream
{
public:
  nsMsgCompressOStream();
  ~nsMsgCompressOStream();

  NS_DECL_ISUPPORTS

  NS_DECL_NSIOUTPUTSTREAM

  nsresult InitOutputStream(nsIOutputStream *rawStream);

protected:
  nsCOMPtr<nsIOutputStream> m_oStream;
  nsAutoArrayPtr<char> m_zbuf;
  z_stream m_zstream;
};

