/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsPgpMimeProxy.h"
#include "nspr.h"
#include "plstr.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "mozilla/Services.h"
#include "nsIRequest.h"
#include "nsIStringBundle.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIURI.h"
#include "mimexpcom.h"
#include "nsMsgUtils.h"

#include "nsMsgMimeCID.h"

#include "mimecth.h"
#include "mimemoz2.h"
#include "nspr.h"
#include "plstr.h"
#include "nsIPgpMimeProxy.h"
#include "nsComponentManagerUtils.h"

static NS_DEFINE_CID(kMimeObjectClassAccessCID, NS_MIME_OBJECT_CLASS_ACCESS_CID);

#define MIME_SUPERCLASS mimeEncryptedClass
MimeDefClass(MimeEncryptedPgp, MimeEncryptedPgpClass,
             mimeEncryptedPgpClass, &MIME_SUPERCLASS);

#define kCharMax 1024

extern "C" MimeObjectClass *
MIME_PgpMimeCreateContentTypeHandlerClass(
                                    const char *content_type,
                                    contentTypeHandlerInitStruct *initStruct)
{
  MimeObjectClass *objClass = (MimeObjectClass *) &mimeEncryptedPgpClass;

  initStruct->force_inline_display = false;

  return objClass;
}

static void *MimePgpe_init(MimeObject *,
                           int (*output_fn) (const char *, int32_t, void *),
                           void *);
static int MimePgpe_write (const char *, int32_t, void *);
static int MimePgpe_eof (void *, bool);
static char* MimePgpe_generate (void *);
static void MimePgpe_free (void *);

#define PGPMIME_PROPERTIES_URL        "chrome://messenger/locale/pgpmime.properties"
#define PGPMIME_STR_NOT_SUPPORTED_ID  "pgpMimeNeedsAddon"
#define PGPMIME_URL_PREF              "mail.pgpmime.addon_url"

static void PgpMimeGetNeedsAddonString(nsCString &aResult)
{
  aResult.AssignLiteral("???");

  nsCOMPtr<nsIStringBundleService> stringBundleService =
    mozilla::services::GetStringBundleService();

  nsCOMPtr<nsIStringBundle> stringBundle;
  nsresult rv = stringBundleService->CreateBundle(PGPMIME_PROPERTIES_URL,
                                                  getter_AddRefs(stringBundle));
  if (NS_FAILED(rv))
    return;

  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return;

  nsCString url;
  if (NS_FAILED(prefs->GetCharPref("mail.pgpmime.addon_url",
                                   getter_Copies(url))))
    return;

  NS_ConvertUTF8toUTF16 url16(url);
  const PRUnichar *formatStrings[] = { url16.get() };

  nsString result;
  rv = stringBundle->FormatStringFromName(NS_LITERAL_STRING(PGPMIME_STR_NOT_SUPPORTED_ID).get(),
                                          formatStrings, 1, getter_Copies(result));
  if (NS_FAILED(rv))
    return;
  aResult = NS_ConvertUTF16toUTF8(result);
}

static int
MimeEncryptedPgpClassInitialize(MimeEncryptedPgpClass *clazz)
{
  MimeObjectClass    *oclass = (MimeObjectClass *)    clazz;
  MimeEncryptedClass *eclass = (MimeEncryptedClass *) clazz;

  NS_ASSERTION(!oclass->class_initialized, "oclass is not initialized");
  eclass->crypto_init          = MimePgpe_init;
  eclass->crypto_write         = MimePgpe_write;
  eclass->crypto_eof           = MimePgpe_eof;
  eclass->crypto_generate_html = MimePgpe_generate;
  eclass->crypto_free          = MimePgpe_free;

  return 0;
}

class MimePgpeData : public nsISupports
{
public:
  NS_DECL_ISUPPORTS

  int (*output_fn) (const char *buf, int32_t buf_size, void *output_closure);
  void *output_closure;
  MimeObject *self;

  nsCOMPtr<nsIPgpMimeProxy> mimeDecrypt;

  MimePgpeData()
    : output_fn(nullptr),
      output_closure(nullptr)
  {
  }

  virtual ~MimePgpeData()
  {
  }
};

NS_IMPL_ISUPPORTS0(MimePgpeData)

static void*
MimePgpe_init(MimeObject *obj,
              int (*output_fn) (const char *buf, int32_t buf_size,
                                void *output_closure),
              void *output_closure)
{
  if (!(obj && obj->options && output_fn))
    return nullptr;

  MimePgpeData* data = new MimePgpeData();
  NS_ENSURE_TRUE(data, nullptr);

  data->self = obj;
  data->output_fn = output_fn;
  data->output_closure = output_closure;
  data->mimeDecrypt = nullptr;

  nsresult rv;
  data->mimeDecrypt = do_CreateInstance(NS_PGPMIMEPROXY_CONTRACTID, &rv);
  if (NS_FAILED(rv))
    return data;

  char *ct = MimeHeaders_get(obj->headers, HEADER_CONTENT_TYPE, false, false);

  rv = (ct ? data->mimeDecrypt->SetContentType(nsDependentCString(ct))
        : data->mimeDecrypt->SetContentType(EmptyCString()));

  PR_Free(ct);

  if (NS_FAILED(rv))
    return nullptr;

  mime_stream_data *msd = (mime_stream_data *) (data->self->options->stream_closure);
  nsIChannel *channel = msd->channel;

  nsCOMPtr<nsIURI> uri;
  if (channel)
    channel->GetURI(getter_AddRefs(uri));

  if (NS_FAILED(data->mimeDecrypt->SetMimeCallback(output_fn, output_closure, uri)))
    return nullptr;

  return data;
}

static int
MimePgpe_write(const char *buf, int32_t buf_size, void *output_closure)
{
  MimePgpeData* data = (MimePgpeData *) output_closure;

  if (!data || !data->output_fn)
    return -1;

  if (!data->mimeDecrypt)
    return 0;

  return (NS_SUCCEEDED(data->mimeDecrypt->Write(buf, buf_size)) ? 0 : -1);
}

static int
MimePgpe_eof(void* output_closure, bool abort_p)
{
  MimePgpeData* data = (MimePgpeData *) output_closure;

  if (!data || !data->output_fn)
    return -1;

  if (NS_FAILED(data->mimeDecrypt->Finish()))
    return -1;

  data->mimeDecrypt = nullptr;
  return 0;
}

static char*
MimePgpe_generate(void *output_closure)
{
  const char htmlMsg[] = "<html><body><b>GEN MSG<b></body></html>";
  char* msg = (char *) PR_MALLOC(strlen(htmlMsg) + 1);
  if (msg)
    PL_strcpy(msg, htmlMsg);

  return msg;
}

static void
MimePgpe_free(void *output_closure)
{
}


////////////////////////////////////////////////////////////////////////////
NS_IMPL_ISUPPORTS5(nsPgpMimeProxy,
                              nsIPgpMimeProxy,
                              nsIRequestObserver,
                              nsIStreamListener,
                              nsIRequest,
                              nsIInputStream)

// nsPgpMimeProxy implementation
nsPgpMimeProxy::nsPgpMimeProxy()
  : mInitialized(false),
    mDecryptor(nullptr),
    mLoadGroup(nullptr),
    mLoadFlags(LOAD_NORMAL),
    mCancelStatus(NS_OK)
{
  NS_INIT_ISUPPORTS();
}

nsPgpMimeProxy::~nsPgpMimeProxy()
{
  Finalize();
}

nsresult
nsPgpMimeProxy::Finalize()
{
  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::SetMimeCallback(MimeDecodeCallbackFun outputFun,
                        void* outputClosure,
                        nsIURI* myUri)
{
  if (!outputFun || !outputClosure)
    return NS_ERROR_NULL_POINTER;

  mOutputFun     = outputFun;
  mOutputClosure = outputClosure;
  mInitialized   = true;

  mStreamOffset = 0;
  mByteBuf.Truncate();

  if (mDecryptor)
    return mDecryptor->OnStartRequest((nsIRequest*) this, myUri);

  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::Init()
{
  mByteBuf.Truncate();

  nsresult rv;
  nsCOMPtr<nsIPrefBranch> pbi(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return rv;

  mDecryptor = do_CreateInstance(PGPMIME_JS_DECRYPTOR_CONTRACTID, &rv);
  if (NS_FAILED(rv))
    mDecryptor = nullptr;

  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::Write(const char *buf, uint32_t buf_size)
{
  NS_ENSURE_TRUE(mInitialized, NS_ERROR_NOT_INITIALIZED);

  mByteBuf.Assign(buf, buf_size);
  mStreamOffset = 0;

  if (mDecryptor)
    return mDecryptor->OnDataAvailable((nsIRequest*) this, nullptr, (nsIInputStream*) this,
                                      0, buf_size);

  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::Finish() {
  NS_ENSURE_TRUE(mInitialized, NS_ERROR_NOT_INITIALIZED);

  if (mDecryptor) {
    return mDecryptor->OnStopRequest((nsIRequest*) this, nullptr, NS_OK);
  }
  else {
    nsCString temp;
    temp.Append("Content-Type: text/html\r\nCharset: UTF-8\r\n\r\n<html><body>");
    temp.Append("<BR><text=\"#000000\" bgcolor=\"#FFFFFF\" link=\"#FF0000\" vlink=\"#800080\" alink=\"#0000FF\">");
    temp.Append("<center><table BORDER=1 ><tr><td><CENTER>");

    nsCString tString;
    PgpMimeGetNeedsAddonString(tString);
    temp.Append(tString);
    temp.Append("</CENTER></td></tr></table></center><BR></body></html>\r\n");

    PR_SetError(0,0);
    int status = mOutputFun(temp.get(), temp.Length(), mOutputClosure);
    if (status < 0) {
      PR_SetError(status, 0);
      mOutputFun = nullptr;
      return NS_ERROR_FAILURE;
    }
  }

  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::GetDecryptor(nsIStreamListener **aDecryptor)
{
  NS_IF_ADDREF(*aDecryptor = mDecryptor);
  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::SetDecryptor(nsIStreamListener *aDecryptor)
{
  mDecryptor = aDecryptor;

  return NS_OK;
}


NS_IMETHODIMP
nsPgpMimeProxy::GetContentType(nsACString &aContentType)
{
  aContentType = mContentType;
  return NS_OK;
}


NS_IMETHODIMP
nsPgpMimeProxy::SetContentType(const nsACString &aContentType)
{
  mContentType = aContentType;

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIRequest methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPgpMimeProxy::GetName(nsACString &result)
{
  result = "pgpmimeproxy";
  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::IsPending(bool *result)
{
  NS_ENSURE_TRUE(mInitialized, NS_ERROR_NOT_INITIALIZED);

  *result = NS_SUCCEEDED(mCancelStatus);
  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::GetStatus(nsresult *status)
{
  NS_ENSURE_TRUE(mInitialized, NS_ERROR_NOT_INITIALIZED);

  *status = mCancelStatus;
  return NS_OK;
}

// NOTE: We assume that OnStopRequest should not be called if
// request is canceled. This may be wrong!
NS_IMETHODIMP
nsPgpMimeProxy::Cancel(nsresult status)
{
  NS_ENSURE_TRUE(mInitialized, NS_ERROR_NOT_INITIALIZED);

  // Need a non-zero status code to cancel
  if (NS_SUCCEEDED(status))
    return NS_ERROR_FAILURE;

  if (NS_SUCCEEDED(mCancelStatus))
    mCancelStatus = status;

  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::Suspend(void)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsPgpMimeProxy::Resume(void)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsPgpMimeProxy::GetLoadGroup(nsILoadGroup * *aLoadGroup)
{
  NS_IF_ADDREF(*aLoadGroup = mLoadGroup);
  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::SetLoadGroup(nsILoadGroup* aLoadGroup)
{
  mLoadGroup = aLoadGroup;
  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::GetLoadFlags(nsLoadFlags *aLoadFlags)
{
  *aLoadFlags = mLoadFlags;
  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::SetLoadFlags(nsLoadFlags aLoadFlags)
{
  mLoadFlags = aLoadFlags;
  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIInputStream methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPgpMimeProxy::Available(uint64_t* _retval)
{
  NS_ENSURE_ARG(_retval);

  NS_ENSURE_TRUE(mInitialized, NS_ERROR_NOT_INITIALIZED);

  *_retval = (mByteBuf.Length() > mStreamOffset) ?
              mByteBuf.Length() - mStreamOffset : 0;

  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::Read(char* buf, uint32_t count,
                         uint32_t *readCount)
{
  NS_ENSURE_TRUE(mInitialized, NS_ERROR_NOT_INITIALIZED);

  if (!buf || !readCount)
    return NS_ERROR_NULL_POINTER;

  int32_t avail = (mByteBuf.Length() > mStreamOffset) ?
                   mByteBuf.Length() - mStreamOffset : 0;

  uint32_t readyCount = ((uint32_t) avail > count) ? count : avail;

  if (readyCount) {
    memcpy(buf, mByteBuf.get()+mStreamOffset, readyCount);
    *readCount = readyCount;
  }

  mStreamOffset += *readCount;

  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::ReadSegments(nsWriteSegmentFun writer,
                          void * aClosure, uint32_t count,
                          uint32_t *readCount)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsPgpMimeProxy::IsNonBlocking(bool *aNonBlocking)
{
  NS_ENSURE_TRUE(mInitialized, NS_ERROR_NOT_INITIALIZED);

  *aNonBlocking = true;
  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::Close()
{
  NS_ENSURE_TRUE(mInitialized, NS_ERROR_NOT_INITIALIZED);

  mStreamOffset = 0;
  mByteBuf.Truncate();

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIStreamListener methods
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPgpMimeProxy::OnStartRequest(nsIRequest *aRequest, nsISupports *aContext)
{
  return NS_OK;
}

NS_IMETHODIMP
nsPgpMimeProxy::OnStopRequest(nsIRequest* aRequest, nsISupports* aContext,
                             nsresult aStatus)
{
  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIStreamListener method
///////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsPgpMimeProxy::OnDataAvailable(nsIRequest* aRequest, nsISupports* aContext,
                              nsIInputStream *aInputStream,
                              uint64_t aSourceOffset,
                              uint32_t aLength)
{
  NS_ENSURE_TRUE(mInitialized, NS_ERROR_NOT_INITIALIZED);

  NS_ENSURE_ARG(aInputStream);
  NS_ENSURE_ARG_MIN(aLength, 0);

  char buf[kCharMax];
  uint32_t readCount, readMax;

  while (aLength > 0) {
    readMax = (aLength < kCharMax) ? aLength : kCharMax;

    nsresult rv;
    rv = aInputStream->Read((char *) buf, readMax, &readCount);
    NS_ENSURE_SUCCESS(rv, rv);

    int status = mOutputFun(buf, readCount, mOutputClosure);
    if (status < 0) {
      PR_SetError(status, 0);
      mOutputFun = nullptr;
      return NS_ERROR_FAILURE;
    }

    aLength -= readCount;
  }

  return NS_OK;
}
