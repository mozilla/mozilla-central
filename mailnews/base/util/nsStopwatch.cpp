#include <stdio.h>
#include <time.h>
#ifdef XP_UNIX
#include <unistd.h>
#include <sys/times.h>
#include <errno.h>
#endif
#ifdef XP_WIN
#include "windows.h"
#endif

#include "nsIClassInfoImpl.h"

#include "nsStopwatch.h"

/*
 * This basis for the logic in this file comes from (will used to come from):
 *  (mozilla/)modules/libutil/public/stopwatch.cpp.
 *  
 * It was no longer used in the mozilla tree, and is being migrated to
 * comm-central where we actually have a need for it.  ("Being" in the sense
 * that it will not be removed immediately from mozilla-central.)
 * 
 * Simplification and general clean-up has been performed and the fix for
 * bug 96669 has been integrated.
 */

NS_DECL_CLASSINFO(nsStopwatch)
NS_IMPL_ISUPPORTS1_CI(nsStopwatch, nsIStopwatch)

#ifdef WINCE
#error "WINCE apparently does not provide the clock support we require."
#endif

#ifdef XP_UNIX
/** the number of ticks per second */
static double gTicks = 0;
#elif defined(WIN32)
// a tick every 100ns, 10 per us, 10 * 1000 per ms, 10 * 1000 * 1000 per sec.
#define TICKS_PER_SECOND 10000000.0
// subtract off to get to the unix epoch
#define UNIX_EPOCH_IN_FILE_TIME 116444736000000000L
#endif // XP_UNIX

nsStopwatch::nsStopwatch()
 : fTotalRealTimeSecs(0.0)
 , fTotalCpuTimeSecs(0.0)
 , fRunning(false)
{
#ifdef XP_UNIX
  // idempotent in the event of a race under all coherency models
  if (!gTicks)
  {
    gTicks = (clock_t)sysconf(_SC_CLK_TCK);
    // in event of failure, pick an arbitrary value so we don't divide by zero.
    if (errno)
      gTicks = 1000000L;
  }
#endif
}

nsStopwatch::~nsStopwatch()
{
}

NS_IMETHODIMP nsStopwatch::Start()
{
  fTotalRealTimeSecs = 0.0;
  fTotalCpuTimeSecs = 0.0;
  return Resume();
}

NS_IMETHODIMP nsStopwatch::Stop()
{
  fStopRealTimeSecs = GetRealTime();
  fStopCpuTimeSecs  = GetCPUTime();
  if (fRunning)
  {
    fTotalCpuTimeSecs  += fStopCpuTimeSecs  - fStartCpuTimeSecs;
    fTotalRealTimeSecs += fStopRealTimeSecs - fStartRealTimeSecs;
  }
  fRunning = false;
  return NS_OK;
}

NS_IMETHODIMP nsStopwatch::Resume()
{
  if (!fRunning)
  {
    fStartRealTimeSecs = GetRealTime();
    fStartCpuTimeSecs  = GetCPUTime();
  }
  fRunning = true;
  return NS_OK;
}

NS_IMETHODIMP nsStopwatch::GetCpuTimeSeconds(double *result)
{
  NS_ENSURE_ARG_POINTER(result);
  *result = fTotalCpuTimeSecs;
  return NS_OK;
}

NS_IMETHODIMP nsStopwatch::GetRealTimeSeconds(double *result)
{
  NS_ENSURE_ARG_POINTER(result);
  *result = fTotalRealTimeSecs;
  return NS_OK;
}

double nsStopwatch::GetRealTime()
{
#if defined(XP_UNIX)
  struct tms cpt;
  return (double)times(&cpt) / gTicks;
#elif defined(WIN32)
  union     {FILETIME ftFileTime;
             __int64  ftInt64;
            } ftRealTime; // time the process has spent in kernel mode
  SYSTEMTIME st;
  GetSystemTime(&st);
  SystemTimeToFileTime(&st,&ftRealTime.ftFileTime);
  return (double)(ftRealTime.ftInt64 - UNIX_EPOCH_IN_FILE_TIME) /
                 TICKS_PER_SECOND;
#endif
}

double nsStopwatch::GetCPUTime()
{
#if defined(XP_UNIX)
  struct tms cpt;
  times(&cpt);
  return (double)(cpt.tms_utime+cpt.tms_stime) / gTicks;
#elif defined(WIN32)

  DWORD       ret;
  FILETIME    ftCreate,       // when the process was created
              ftExit;         // when the process exited

  union     {FILETIME ftFileTime;
             __int64  ftInt64;
            } ftKernel; // time the process has spent in kernel mode

  union     {FILETIME ftFileTime;
             __int64  ftInt64;
            } ftUser;   // time the process has spent in user mode

  HANDLE hProcess = GetCurrentProcess();
  ret = GetProcessTimes (hProcess, &ftCreate, &ftExit,
                                   &ftKernel.ftFileTime,
                                   &ftUser.ftFileTime);
  if (ret != PR_TRUE)
  {
    ret = GetLastError ();
#ifdef DEBUG
    printf("%s 0x%lx\n"," Error on GetProcessTimes", (int)ret);
#endif
  }

  /*
   * Process times are returned in a 64-bit structure, as the number of
   * 100 nanosecond ticks since 1 January 1601.  User mode and kernel mode
   * times for this process are in separate 64-bit structures.
   * To convert to floating point seconds, we will:
   *
   *          Convert sum of high 32-bit quantities to 64-bit int
   */
  return (double) (ftKernel.ftInt64 + ftUser.ftInt64) / TICKS_PER_SECOND;
#endif
}
