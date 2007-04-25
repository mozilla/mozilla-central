#include "nsILocalFile.h"
#include "nsMsgFileStream.h"
#include "nsInt64.h"

nsMsgFileStream::nsMsgFileStream() 
{
  mFileDesc = nsnull;
}

nsMsgFileStream::~nsMsgFileStream()
{
  if (mFileDesc)
    PR_Close(mFileDesc);
}

NS_IMPL_ISUPPORTS3(nsMsgFileStream, nsIInputStream, nsIOutputStream, nsISeekableStream)

nsresult nsMsgFileStream::InitWithFile(nsILocalFile *file)
{
  return file->OpenNSPRFileDesc(PR_RDWR|PR_CREATE_FILE, 0664, &mFileDesc);
}

NS_IMETHODIMP
nsMsgFileStream::Seek(PRInt32 whence, PRInt64 offset)
{
  if (mFileDesc == nsnull)
    return NS_BASE_STREAM_CLOSED;
  
  nsInt64 cnt = PR_Seek64(mFileDesc, offset, (PRSeekWhence)whence);
  if (cnt == nsInt64(-1)) {
    return NS_ErrorAccordingToNSPR();
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgFileStream::Tell(PRInt64 *result)
{
  if (mFileDesc == nsnull)
    return NS_BASE_STREAM_CLOSED;
  
  nsInt64 cnt = PR_Seek64(mFileDesc, 0, PR_SEEK_CUR);
  if (cnt == nsInt64(-1)) {
    return NS_ErrorAccordingToNSPR();
  }
  *result = cnt;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgFileStream::SetEOF()
{
  if (mFileDesc == nsnull)
    return NS_BASE_STREAM_CLOSED;
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void close (); */
NS_IMETHODIMP nsMsgFileStream::Close()
{
  nsresult rv = NS_OK;
  if (mFileDesc && (PR_Close(mFileDesc) == PR_FAILURE))
        rv = NS_BASE_STREAM_OSERROR;
    mFileDesc = nsnull;
  return rv;
}

/* unsigned long available (); */
NS_IMETHODIMP nsMsgFileStream::Available(PRUint32 *aResult)
{
  if (!mFileDesc) 
    return NS_BASE_STREAM_CLOSED;
  
  PRInt32 avail = PR_Available(mFileDesc);
  if (avail == -1)
    return NS_ErrorAccordingToNSPR();

  *aResult = avail;
  return NS_OK;
}

/* [noscript] unsigned long read (in charPtr aBuf, in unsigned long aCount); */
NS_IMETHODIMP nsMsgFileStream::Read(char * aBuf, PRUint32 aCount, PRUint32 *aResult)
{
  if (!mFileDesc) 
  {
    *aResult = 0;
    return NS_OK;
  }
  
  PRInt32 bytesRead = PR_Read(mFileDesc, aBuf, aCount);
  if (bytesRead == -1)
    return NS_ErrorAccordingToNSPR();
  
  *aResult = bytesRead;
  return NS_OK;
}

/* [noscript] unsigned long readSegments (in nsWriteSegmentFun aWriter, in voidPtr aClosure, in unsigned long aCount); */
NS_IMETHODIMP nsMsgFileStream::ReadSegments(nsWriteSegmentFun aWriter, void * aClosure, PRUint32 aCount, PRUint32 *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* boolean isNonBlocking (); */
NS_IMETHODIMP nsMsgFileStream::IsNonBlocking(PRBool *aNonBlocking)
{
  *aNonBlocking = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgFileStream::Write(const char *buf, PRUint32 count, PRUint32 *result)
{
  if (mFileDesc == nsnull)
    return NS_BASE_STREAM_CLOSED;
  
  PRInt32 cnt = PR_Write(mFileDesc, buf, count);
  if (cnt == -1) {
    return NS_ErrorAccordingToNSPR();
  }
  *result = cnt;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgFileStream::Flush(void)
{
  if (mFileDesc == nsnull)
    return NS_BASE_STREAM_CLOSED;
  
  PRInt32 cnt = PR_Sync(mFileDesc);
  if (cnt == -1) 
    return NS_ErrorAccordingToNSPR();

  return NS_OK;
}

NS_IMETHODIMP
nsMsgFileStream::WriteFrom(nsIInputStream *inStr, PRUint32 count, PRUint32 *_retval)
{
  NS_NOTREACHED("WriteFrom (see source comment)");
  return NS_ERROR_NOT_IMPLEMENTED;
  // File streams intentionally do not support this method.
  // If you need something like this, then you should wrap
  // the file stream using nsIBufferedOutputStream
}

NS_IMETHODIMP
nsMsgFileStream::WriteSegments(nsReadSegmentFun reader, void * closure, PRUint32 count, PRUint32 *_retval)
{
  NS_NOTREACHED("WriteSegments (see source comment)");
  return NS_ERROR_NOT_IMPLEMENTED;
  // File streams intentionally do not support this method.
  // If you need something like this, then you should wrap
  // the file stream using nsIBufferedOutputStream
}



