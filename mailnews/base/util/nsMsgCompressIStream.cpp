#include "nsMsgCompressIStream.h"
#include "nsStreamUtils.h"
#include "prio.h"
#include "prmem.h"

#define BUFFER_SIZE 16384

nsMsgCompressIStream::nsMsgCompressIStream() :
  m_dataptr(nsnull),
  m_dataleft(0),
  m_inflateAgain(PR_FALSE)
{
}

nsMsgCompressIStream::~nsMsgCompressIStream()
{
  Close();
}

NS_IMPL_THREADSAFE_ISUPPORTS2(nsMsgCompressIStream, nsIInputStream,
                              nsIAsyncInputStream)

nsresult nsMsgCompressIStream::InitInputStream(nsIInputStream *rawStream)
{
  // protect against repeat calls
  if (m_iStream)
    return NS_ERROR_UNEXPECTED;

  // allocate some memory for buffering
  m_zbuf = new char[BUFFER_SIZE];
  if (!m_zbuf)
    return NS_ERROR_OUT_OF_MEMORY;

  // allocate some memory for buffering
  m_databuf = new char[BUFFER_SIZE];
  if (!m_databuf)
    return NS_ERROR_OUT_OF_MEMORY;

  // set up zlib object
  m_zstream.zalloc = Z_NULL;
  m_zstream.zfree = Z_NULL;
  m_zstream.opaque = Z_NULL;

  // http://zlib.net/manual.html is rather silent on the topic, but 
  // perl's Compress::Raw::Zlib manual says:
  // -WindowBits
  //  To compress an RFC 1951 data stream, set WindowBits to -MAX_WBITS.
  if (inflateInit2(&m_zstream, -MAX_WBITS) != Z_OK)
    return NS_ERROR_FAILURE;

  m_iStream = rawStream;

  return NS_OK;
}

nsresult nsMsgCompressIStream::DoInflation()
{
  // if there's something in the input buffer of the zstream, process it.
  m_zstream.next_out = (Bytef *) m_databuf.get();
  m_zstream.avail_out = BUFFER_SIZE;
  int zr = inflate(&m_zstream, Z_SYNC_FLUSH);

  // inflate() should normally be called until it returns 
  // Z_STREAM_END or an error, and Z_BUF_ERROR just means
  // unable to progress any further (possible if we filled
  // an output buffer exactly)
  if (zr == Z_BUF_ERROR || zr == Z_STREAM_END)
    zr = Z_OK;

  // otherwise it's an error
  if (zr != Z_OK) 
    return NS_ERROR_FAILURE;

  // http://www.zlib.net/manual.html says:
  // If inflate returns Z_OK and with zero avail_out, it must be called 
  // again after making room in the output buffer because there might be
  // more output pending. 
  m_inflateAgain = m_zstream.avail_out ? PR_FALSE : PR_TRUE;

  // set the pointer to the start of the buffer, and the count to how
  // based on how many bytes are left unconsumed.
  m_dataptr = m_databuf;
  m_dataleft = BUFFER_SIZE - m_zstream.avail_out;

  return NS_OK;
}

/* void close (); */
NS_IMETHODIMP nsMsgCompressIStream::Close()
{
  return CloseWithStatus(NS_OK);
}

NS_IMETHODIMP nsMsgCompressIStream::CloseWithStatus(nsresult reason)
{
  nsresult rv = NS_OK;

  if (m_iStream)
  {
    // pass the status through to our wrapped stream
    nsCOMPtr <nsIAsyncInputStream> asyncInputStream = do_QueryInterface(m_iStream);
    if (asyncInputStream)
      rv = asyncInputStream->CloseWithStatus(reason);

    // tidy up
    m_iStream = nsnull;
    inflateEnd(&m_zstream);
  }

  // clean up all the buffers
  m_zbuf = nsnull;
  m_databuf = nsnull;
  m_dataptr = nsnull;
  m_dataleft = 0;

  return rv;
}

/* unsigned long available (); */
NS_IMETHODIMP nsMsgCompressIStream::Available(PRUint32 *aResult)
{
  if (!m_iStream) 
    return NS_BASE_STREAM_CLOSED;

  // check if there's anything still in flight
  if (!m_dataleft && m_inflateAgain)
  {
    nsresult rv = DoInflation();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // we'll be returning this many to the next read, guaranteed
  if (m_dataleft)
  {
    *aResult = m_dataleft;
    return NS_OK;
  }

  // this value isn't accurate, but will give a good true/false 
  // indication for idle purposes, and next read will fill
  // m_dataleft, so we'll have an accurate count for the next call.
  return m_iStream->Available(aResult);
}

/* [noscript] unsigned long read (in charPtr aBuf, in unsigned long aCount); */
NS_IMETHODIMP nsMsgCompressIStream::Read(char * aBuf, PRUint32 aCount, PRUint32 *aResult)
{
  if (!m_iStream) 
  {
    *aResult = 0;
    return NS_OK;
  }
  
  // There are two stages of buffering:
  // * m_zbuf contains the compressed data from the remote server
  // * m_databuf contains the uncompressed raw bytes for consumption
  //   by the local client.
  // 
  // Each buffer will only be filled when the following buffers
  // have been entirely consumed.
  //
  // m_dataptr and m_dataleft are respectively a pointer to the
  // unconsumed portion of m_databuf and the number of bytes
  // of uncompressed data remaining in m_databuf.
  //
  // both buffers have a maximum size of BUFFER_SIZE, so it is
  // possible that multiple inflate passes will be required to
  // consume all of m_zbuf.
  while (!m_dataleft)
  {
    // get some more data if we don't already have any
    if (!m_inflateAgain) 
    {
      PRUint32 bytesRead;
      nsresult rv = m_iStream->Read(m_zbuf, (PRUint32)BUFFER_SIZE, &bytesRead);
      NS_ENSURE_SUCCESS(rv, rv);
      if (!bytesRead)
        return NS_BASE_STREAM_CLOSED;
      m_zstream.next_in = (Bytef *) m_zbuf.get();
      m_zstream.avail_in = bytesRead;
    }

    nsresult rv = DoInflation();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  *aResult = NS_MIN(m_dataleft, aCount);

  if (*aResult)
  {
    memcpy(aBuf, m_dataptr, *aResult);
    m_dataptr += *aResult;
    m_dataleft -= *aResult;
  }

  return NS_OK;
}

/* [noscript] unsigned long readSegments (in nsWriteSegmentFun aWriter, in voidPtr aClosure, in unsigned long aCount); */
NS_IMETHODIMP nsMsgCompressIStream::ReadSegments(nsWriteSegmentFun aWriter, void * aClosure, PRUint32 aCount, PRUint32 *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgCompressIStream::AsyncWait(nsIInputStreamCallback *callback, PRUint32 flags, PRUint32 amount, nsIEventTarget *target)
{
  if (!m_iStream)
    return NS_BASE_STREAM_CLOSED;

  nsCOMPtr <nsIAsyncInputStream> asyncInputStream = do_QueryInterface(m_iStream);
  if (asyncInputStream)
    return asyncInputStream->AsyncWait(callback, flags, amount, target);

  return NS_OK;
}

/* boolean isNonBlocking (); */
NS_IMETHODIMP nsMsgCompressIStream::IsNonBlocking(PRBool *aNonBlocking)
{
  *aNonBlocking = PR_FALSE;
  return NS_OK;
}

