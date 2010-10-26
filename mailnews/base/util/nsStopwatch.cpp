#include "nsStopwatch.h"

#include <stdio.h>
#include <time.h>
#if defined(XP_UNIX) || defined(XP_OS2)
#include <unistd.h>
#include <sys/times.h>
#include <sys/time.h>
#include <errno.h>
#elif defined(XP_WIN)
#include "windows.h"
#endif // elif defined(XP_WIN)

#include "nsMemory.h"
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

NS_IMPL_ISUPPORTS1(nsStopwatch, nsIStopwatch)

#ifdef WINCE
#error "WINCE apparently does not provide the clock support we require."
#elif defined(XP_UNIX) || defined(XP_OS2)
/** the number of ticks per second */
static double gTicks = 0;
#define MICRO_SECONDS_TO_SECONDS_MULT static_cast<double>(1.0e-6)
#elif defined(WIN32)
#ifdef DEBUG
#include "nsPrintfCString.h"
#endif
// 1 tick per 100ns = 10 per us = 10 * 1,000 per ms = 10 * 1,000 * 1,000 per sec.
#define WIN32_TICK_RESOLUTION static_cast<double>(1.0e-7)
// subtract off to get to the unix epoch
#define UNIX_EPOCH_IN_FILE_TIME 116444736000000000L
#endif // elif defined(WIN32)

nsStopwatch::nsStopwatch()
 : fTotalRealTimeSecs(0.0)
 , fTotalCpuTimeSecs(0.0)
 , fRunning(false)
{
#if defined(XP_UNIX) || defined(XP_OS2)
  // idempotent in the event of a race under all coherency models
  if (!gTicks)
  {
    // we need to clear errno because sysconf's spec says it leaves it the same
    //  on success and only sets it on failure.
    errno = 0;
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
#if defined(XP_UNIX) || defined(XP_OS2)
  struct timeval t;
  gettimeofday(&t, NULL);
  return t.tv_sec + t.tv_usec * MICRO_SECONDS_TO_SECONDS_MULT;
#elif defined(WIN32)
  union     {FILETIME ftFileTime;
             __int64  ftInt64;
            } ftRealTime; // time the process has spent in kernel mode
  SYSTEMTIME st;
  GetSystemTime(&st);
  SystemTimeToFileTime(&st, &ftRealTime.ftFileTime);
  return (ftRealTime.ftInt64 - UNIX_EPOCH_IN_FILE_TIME) * WIN32_TICK_RESOLUTION;
#else
#error "nsStopwatch not supported on this platform."
#endif
}

double nsStopwatch::GetCPUTime()
{
#if defined(XP_UNIX) || defined(XP_OS2)
  struct tms cpt;
  times(&cpt);
  return (double)(cpt.tms_utime+cpt.tms_stime) / gTicks;
#elif defined(WIN32)

  FILETIME    ftCreate,       // when the process was created
              ftExit;         // when the process exited

  union     {FILETIME ftFileTime;
             __int64  ftInt64;
            } ftKernel; // time the process has spent in kernel mode

  union     {FILETIME ftFileTime;
             __int64  ftInt64;
            } ftUser;   // time the process has spent in user mode

  HANDLE hProcess = GetCurrentProcess();
#ifdef DEBUG
  BOOL ret =
#endif
    GetProcessTimes(hProcess, &ftCreate, &ftExit,
                              &ftKernel.ftFileTime, &ftUser.ftFileTime);
#ifdef DEBUG
  if (!ret)
    NS_ERROR(nsPrintfCString("GetProcessTimes() failed, error=0x%lx.", GetLastError()).get());
#endif

  /*
   * Process times are returned in a 64-bit structure, as the number of
   * 100 nanosecond ticks since 1 January 1601.  User mode and kernel mode
   * times for this process are in separate 64-bit structures.
   * Add them and convert the result to seconds.
   */
  return (ftKernel.ftInt64 + ftUser.ftInt64) * WIN32_TICK_RESOLUTION;
#else
#error "nsStopwatch not supported on this platform."
#endif
}
