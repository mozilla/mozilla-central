# Copyright (c) 2011 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

import logging
import os
import signal
import subprocess
import sys
import time


class NotImplementedError(Exception):
  pass


class TimeoutError(Exception):
  pass


def _print_line(line, flush=True):
  # Printing to a text file (including stdout) on Windows always winds up
  # using \r\n automatically.  On buildbot, this winds up being read by a master
  # running on Linux, so we manually convert crlf to '\n'
  print line.rstrip() + '\n',
  if flush:
    sys.stdout.flush()


def RunSubprocessInBackground(proc):
  """Runs a subprocess in the background. Returns a handle to the process."""
  logging.info("running %s in the background" % " ".join(proc))
  return subprocess.Popen(proc)


def RunSubprocess(proc, timeout=0, detach=False, background=False):
  """ Runs a subprocess, until it finishes or |timeout| is exceeded and the
  process is killed with taskkill.  A |timeout| <= 0  means no timeout.

  Args:
    proc: list of process components (exe + args)
    timeout: how long to wait before killing, <= 0 means wait forever
    detach: Whether to pass the DETACHED_PROCESS argument to CreateProcess
        on Windows.  This is used by Purify subprocesses on buildbot which
        seem to get confused by the parent console that buildbot sets up.
  """

  logging.info("running %s, timeout %d sec" % (" ".join(proc), timeout))
  if detach:
    # see MSDN docs for "Process Creation Flags"
    DETACHED_PROCESS = 0x8
    p = subprocess.Popen(proc, creationflags=DETACHED_PROCESS)
  else:
    # For non-detached processes, manually read and print out stdout and stderr.
    # By default, the subprocess is supposed to inherit these from its parent,
    # however when run under buildbot, it seems unable to read data from a
    # grandchild process, so we have to read the child and print the data as if
    # it came from us for buildbot to read it.  We're not sure why this is
    # necessary.
    # TODO(erikkay): should we buffer stderr and stdout separately?
    p = subprocess.Popen(proc, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

  logging.info("started subprocess")

  # How long to wait (in seconds) before printing progress log messages.
  progress_delay = 300
  progress_delay_time = time.time() + progress_delay
  did_timeout = False
  if timeout > 0:
    wait_until = time.time() + timeout
  while p.poll() is None and not did_timeout:
    if not detach:
      line = p.stdout.readline()
      while line and not did_timeout:
        _print_line(line)
        line = p.stdout.readline()
        if timeout > 0:
          did_timeout = time.time() > wait_until
    else:
      # When we detach, blocking on reading stdout doesn't work, so we sleep
      # a short time and poll.
      time.sleep(0.5)
      if time.time() >= progress_delay_time:
        # Force output on a periodic basis to avoid getting killed off by the
        # buildbot.
        # TODO(erikkay): I'd prefer a less obtrusive 'print ".",' with a flush
        # but because of how we're doing subprocesses, this doesn't appear to
        # work reliably.
        logging.info("%s still running..." % os.path.basename(proc[0]))
        progress_delay_time = time.time() + progress_delay
    if timeout > 0:
      did_timeout = time.time() > wait_until

  if did_timeout:
    logging.info("process timed out")
  else:
    logging.info("process ended, did not time out")

  if did_timeout:
    if IsWindows():
      subprocess.call(["taskkill", "/T", "/F", "/PID", str(p.pid)])
    else:
      # Does this kill all children, too?
      os.kill(p.pid, signal.SIGINT)
    logging.error("KILLED %d" % p.pid)
    # Give the process a chance to actually die before continuing
    # so that cleanup can happen safely.
    time.sleep(1.0)
    logging.error("TIMEOUT waiting for %s" % proc[0])
    raise TimeoutError(proc[0])
  elif not detach:
    for line in p.stdout.readlines():
      _print_line(line, False)
    if not IsMac():   # stdout flush fails on Mac
      logging.info("flushing stdout")
      p.stdout.flush()

  logging.info("collecting result code")
  result = p.poll()
  if result:
    logging.error("%s exited with non-zero result code %d" % (proc[0], result))
  return result


def IsLinux():
  return sys.platform.startswith('linux')


def IsMac():
  return sys.platform.startswith('darwin')


def IsWindows():
  return sys.platform == 'cygwin' or sys.platform.startswith('win')


def PlatformNames():
  """Return an array of string to be used in paths for the platform
  (e.g. suppressions, gtest filters, ignore files etc.)
  The first element of the array describes the 'main' platform
  """
  if IsLinux():
    return ['linux']
  if IsMac():
    return ['mac']
  if IsWindows():
    return ['win32']
  raise NotImplementedError('Unknown platform "%s".' % sys.platform)


def PutEnvAndLog(env_name, env_value):
  os.putenv(env_name, env_value)
  logging.info('export %s=%s', env_name, env_value)
