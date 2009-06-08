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

  NS_DECL_ISUPPORTS
    
  NS_DECL_NSIINPUTSTREAM
  NS_DECL_NSIASYNCINPUTSTREAM

  nsresult InitInputStream(nsIInputStream *rawStream);

protected:
  nsresult DoInflation();
  nsCOMPtr<nsIInputStream> m_iStream;
  nsAutoArrayPtr<char> m_zbuf;
  nsAutoArrayPtr<char> m_databuf;
  char *m_dataptr;
  PRUint32 m_dataleft;
  PRBool m_inflateAgain;
  z_stream m_zstream;
};

