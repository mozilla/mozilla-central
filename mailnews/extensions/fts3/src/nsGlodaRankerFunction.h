#ifndef _nsGlodaRankerFunction_h_
#define _nsGlodaRankerFunction_h_

#include "mozIStorageFunction.h"

/**
 * Basically a port of the example FTS3 ranking function to mozStorage's
 * view of the universe.  This might get fancier at some point.
 */
class nsGlodaRankerFunction : public mozIStorageFunction
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_MOZISTORAGEFUNCTION

  nsGlodaRankerFunction();
private:
  ~nsGlodaRankerFunction();
};

#endif // _nsGlodaRankerFunction_h_
