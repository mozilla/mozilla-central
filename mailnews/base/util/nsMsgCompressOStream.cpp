#include "nsMsgCompressOStream.h"
#include "prio.h"
#include "prmem.h"

#define BUFFER_SIZE 16384

nsMsgCompressOStream::nsMsgCompressOStream() :
  m_zbuf(nsnull)
{
}

nsMsgCompressOStream::~nsMsgCompressOStream()
{
  Close();
}

NS_IMPL_THREADSAFE_ISUPPORTS1(nsMsgCompressOStream, nsIOutputStream)

nsresult nsMsgCompressOStream::InitOutputStream(nsIOutputStream *rawStream)
{
  // protect against repeat calls
  if (m_oStream)
    return NS_ERROR_UNEXPECTED;

  // allocate some memory for a buffer
  m_zbuf = new char[BUFFER_SIZE];
  if (!m_zbuf)
    return NS_ERROR_OUT_OF_MEMORY;

  // set up the zlib object
  m_zstream.zalloc = Z_NULL;
  m_zstream.zfree = Z_NULL;
  m_zstream.opaque = Z_NULL;

  // http://zlib.net/manual.html is rather silent on the topic, but
  // perl's Compress::Raw::Zlib manual says:
  // -WindowBits [...]
  //  To compress an RFC 1951 data stream, set WindowBits to -MAX_WBITS.
  if (deflateInit2(&m_zstream, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 
                   -MAX_WBITS, MAX_MEM_LEVEL, Z_DEFAULT_STRATEGY) != Z_OK)
    return NS_ERROR_FAILURE;

  m_oStream = rawStream;

  return NS_OK;
}

/* void close (); */
NS_IMETHODIMP nsMsgCompressOStream::Close()
{
  if (m_oStream)
  {
    m_oStream = nsnull;
    deflateEnd(&m_zstream);
  }
  m_zbuf = nsnull;

  return NS_OK;
}

NS_IMETHODIMP
nsMsgCompressOStream::Write(const char *buf, PRUint32 count, PRUint32 *result)
{
  if (!m_oStream)
    return NS_BASE_STREAM_CLOSED;

  m_zstream.next_in = (Bytef *) buf;
  m_zstream.avail_in = count;

  // keep looping until the buffer doesn't get filled
  do
  {
    m_zstream.next_out = (Bytef *) m_zbuf.get();
    m_zstream.avail_out = BUFFER_SIZE;
    // Using "Z_SYNC_FLUSH" may cause excess flushes if the calling
    // code does a lot of small writes.  An option with the IMAP
    // protocol is to check the buffer for "\n" at the end, but
    // in the interests of keeping this generic, don't optimise
    // yet.  An alternative is to require ->Flush always, but that
    // is likely to break callers.
    int zr = deflate(&m_zstream, Z_SYNC_FLUSH);
    if (zr == Z_STREAM_END || zr == Z_BUF_ERROR)
      zr = Z_OK; // not an error for our purposes
    if (zr != Z_OK)
      return NS_ERROR_FAILURE;

    PRUint32 out_size = BUFFER_SIZE - m_zstream.avail_out;
    const char *out_buf = m_zbuf;

    // push everything in the buffer before repeating
    while (out_size)
    {
      PRUint32 out_result;
      nsresult rv = m_oStream->Write(out_buf, out_size, &out_result);
      NS_ENSURE_SUCCESS(rv, rv);
      if (!out_result)
	return NS_BASE_STREAM_CLOSED;
      out_size -= out_result;
      out_buf += out_result;
    }

  // http://www.zlib.net/manual.html says:
  // If deflate returns with avail_out == 0, this function must be 
  // called again with the same value of the flush parameter and
  // more output space (updated avail_out), until the flush is 
  // complete (deflate returns with non-zero avail_out). 
  } while (!m_zstream.avail_out);

  *result = count;

  return NS_OK;
}

NS_IMETHODIMP
nsMsgCompressOStream::Flush(void)
{
  if (!m_oStream)
    return NS_BASE_STREAM_CLOSED;
  
  return m_oStream->Flush();
}

NS_IMETHODIMP
nsMsgCompressOStream::WriteFrom(nsIInputStream *inStr, PRUint32 count, PRUint32 *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMsgCompressOStream::WriteSegments(nsReadSegmentFun reader, void * closure, PRUint32 count, PRUint32 *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* boolean isNonBlocking (); */
NS_IMETHODIMP nsMsgCompressOStream::IsNonBlocking(PRBool *aNonBlocking)
{
  *aNonBlocking = PR_FALSE;
  return NS_OK;
}

