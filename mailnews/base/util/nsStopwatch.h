#ifndef _nsStopwatch_h_
#define _nsStopwatch_h_

#include "nsIStopwatch.h"

#include "msgCore.h"

#define NS_STOPWATCH_CID \
{0x6ef7eafd, 0x72d0, 0x4c56, {0x94, 0x09, 0x67, 0xe1, 0x6d, 0x0f, 0x25, 0x5b}}

#define NS_STOPWATCH_CONTRACTID "@mozilla.org/stopwatch;1"

#undef  IMETHOD_VISIBILITY
#define IMETHOD_VISIBILITY NS_VISIBILITY_DEFAULT

class NS_MSG_BASE nsStopwatch : public nsIStopwatch
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSISTOPWATCH

  nsStopwatch();
  virtual ~nsStopwatch();
private:
  /// Wall-clock start time in seconds since unix epoch.
  double fStartRealTimeSecs;
  /// Wall-clock stop time in seconds since unix epoch.
  double fStopRealTimeSecs;
  /// CPU-clock start time in seconds (of CPU time used since app start)
  double fStartCpuTimeSecs;
  /// CPU-clock stop time in seconds (of CPU time used since app start)
  double fStopCpuTimeSecs;
  /// Total wall-clock time elapsed in seconds. 
  double fTotalRealTimeSecs;
  /// Total CPU time elapsed in seconds.
  double fTotalCpuTimeSecs;

  /// Is the timer running?
  bool fRunning;
  
  static double GetRealTime();
  static double GetCPUTime();
};

#endif // _nsStopwatch_h_
