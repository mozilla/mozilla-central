// This is a crash test for Bug 556351

#include "nsIServiceManager.h"
#include "nsIComponentManager.h"
#include "nsIComponentRegistrar.h"
#include "nsCOMPtr.h"
#include "nsIMimeConverter.h"
#include "nsServiceManagerUtils.h"
#include "nsMsgMimeCID.h"

#include "prshma.h"
#include "prsystem.h"

#include "TestHarness.h"

nsresult
mime_encoder_output_fn(const char *buf, int32_t size, void *closure)
{
  return NS_OK;
}

nsresult
do_test(const char *aBuffer, const uint32_t aSize)
{
  nsresult rv;
  MimeEncoderData *encodeData = nullptr;
  int32_t written = 0;

  nsCOMPtr<nsIMimeConverter> converter =
    do_GetService(NS_MIME_CONVERTER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = converter->QPEncoderInit(mime_encoder_output_fn, nullptr, &encodeData);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = converter->EncoderWrite(encodeData, aBuffer, aSize, &written);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = converter->EncoderDestroy(encodeData, false);
  return rv;
}

int main(int argc, char **argv)
{
  ScopedXPCOM xpcom("TestMimeCrash");
  if (xpcom.failed())
    return 1;

  // We cannot use malloc() since this crashes depends on memory allocation.
  // By using mmap()/PR_MemMap(), end of buffer that is last in the page
  // sets LF.

  uint32_t bufsize = PR_GetPageSize();
  PRFileMap *fm = PR_OpenAnonFileMap(".", bufsize, PR_PROT_READWRITE);
  if (!fm)
    return 1;
  char *addr = (char *) PR_MemMap(fm, 0, bufsize);
  if (!addr)
    return 1;
  memset(addr, '\r', bufsize);

  nsresult rv = do_test(addr, bufsize);

  PR_MemUnmap(addr, bufsize);
  PR_CloseFileMap(fm);

  if (NS_FAILED(rv)) {
    fail("cannot use nsIMimeConverter error=%08x\n", rv);
    return -1;
  }

  passed("no crash");

  return 0;
}
