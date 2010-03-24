#include "nsILocalFile.h"
#include "nsMsgFileStream.h"
#include "nsInt64.h"
#include "prerr.h"
#include "prerror.h"

/* From nsDebugImpl.cpp: */
static nsresult
ErrorAccordingToNSPR()
{
    PRErrorCode err = PR_GetError();
    switch (err) {
      case PR_OUT_OF_MEMORY_ERROR:              return NS_ERROR_OUT_OF_MEMORY;
      case PR_WOULD_BLOCK_ERROR:                return NS_BASE_STREAM_WOULD_BLOCK;
      case PR_FILE_NOT_FOUND_ERROR:             return NS_ERROR_FILE_NOT_FOUND;
      case PR_READ_ONLY_FILESYSTEM_ERROR:       return NS_ERROR_FILE_READ_ONLY;
      case PR_NOT_DIRECTORY_ERROR:              return NS_ERROR_FILE_NOT_DIRECTORY;
      case PR_IS_DIRECTORY_ERROR:               return NS_ERROR_FILE_IS_DIRECTORY;
      case PR_LOOP_ERROR:                       return NS_ERROR_FILE_UNRESOLVABLE_SYMLINK;
      case PR_FILE_EXISTS_ERROR:                return NS_ERROR_FILE_ALREADY_EXISTS;
      case PR_FILE_IS_LOCKED_ERROR:             return NS_ERROR_FILE_IS_LOCKED;
      case PR_FILE_TOO_BIG_ERROR:               return NS_ERROR_FILE_TOO_BIG;
      case PR_NO_DEVICE_SPACE_ERROR:            return NS_ERROR_FILE_NO_DEVICE_SPACE;
      case PR_NAME_TOO_LONG_ERROR:              return NS_ERROR_FILE_NAME_TOO_LONG;
      case PR_DIRECTORY_NOT_EMPTY_ERROR:        return NS_ERROR_FILE_DIR_NOT_EMPTY;
      case PR_NO_ACCESS_RIGHTS_ERROR:           return NS_ERROR_FILE_ACCESS_DENIED;
      default:                                  return NS_ERROR_FAILURE;
    }
}

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
    return ErrorAccordingToNSPR();
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
    return ErrorAccordingToNSPR();
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
    return ErrorAccordingToNSPR();

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
    return ErrorAccordingToNSPR();
  
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
    return ErrorAccordingToNSPR();
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
    return ErrorAccordingToNSPR();

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



