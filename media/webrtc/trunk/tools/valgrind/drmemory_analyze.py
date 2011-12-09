#!/usr/bin/python
# Copyright (c) 2011 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# drmemory_analyze.py

''' Given a Dr. Memory output file, parses errors and uniques them.'''

import logging
import optparse
import os
import re
import subprocess
import sys
import time

class _StackTraceLine(object):
  def __init__(self, line, address, binary):
    self.raw_line_ = line
    self.address = address
    self.binary = binary
  def __str__(self):
    return self.raw_line_

class DrMemoryAnalyze:
  ''' Given a set of Dr.Memory output files, parse all the errors out of
  them, unique them and output the results.'''

  def __init__(self, source_dir, files):
    '''Reads in a set of files.

    Args:
      source_dir: Path to top of source tree for this build
      files: A list of filenames.
    '''

    self.reports = []
    self.used_suppressions = []
    for file in files:
      self.ParseReportFile(file)

  def ReadLine(self):
    self.line_ = self.cur_fd_.readline()
    self.stack_trace_line_ = None

  def ReadSection(self):
    result = [self.line_]
    self.ReadLine()
    while len(self.line_.strip()) > 0:
      result.append(self.line_)
      self.ReadLine()
    return result

  def ParseReportFile(self, filename):
    self.cur_fd_ = open(filename, 'r')

    while True:
      self.ReadLine()
      if (self.line_ == ''): break
      if re.search("FINAL SUMMARY:", self.line_):
        # No more reports since this point.
        break
      tmp = []
      match = re.search("^Error #[0-9]+: (.*)", self.line_)
      if match:
        self.line_ = match.groups()[0].strip() + "\n"
        tmp.extend(self.ReadSection())
        self.reports.append(tmp)
      elif self.line_.startswith("ASSERT FAILURE"):
        self.reports.append(self.line_.strip())

    while True:
      self.ReadLine();
      if (self.line_ == ''): break

      if re.search("SUPPRESSIONS USED:", self.line_):
        self.ReadLine()
        while self.line_.strip() != "":
          line = self.line_.strip()
          (count, name) = re.match(" *([0-9]+)x: (.*)", line).groups()
          self.used_suppressions.append("%7s %s" % (count, name))
          self.ReadLine()
        break

    self.cur_fd_.close()

  def Report(self, check_sanity):
    sys.stdout.flush()
    #TODO(timurrrr): support positive tests / check_sanity==True

    if self.used_suppressions:
      print "-----------------------------------------------------"
      # TODO(timurrrr): sum up the counts from different wrappers (e.g. ui_tests)
      # or does it work now already? Or add the memcheck-like per-test printing.
      print "Suppressions used:\n  count name\n%s" % (
                "\n".join(self.used_suppressions))
      print "-----------------------------------------------------"
      sys.stdout.flush()

    if len(self.reports) > 0:
      logging.error("Found %i error reports" % len(self.reports))
      for report_list in self.reports:
        report = ''
        for line in report_list:
          report += str(line)
        logging.error('\n' + report)
      logging.error("Total: %i error reports" % len(self.reports))
      return -1
    logging.info("PASS: No error reports found")
    return 0

if __name__ == '__main__':
  '''For testing only. The DrMemoryAnalyze class should be imported instead.'''
  retcode = 0
  parser = optparse.OptionParser("usage: %prog [options] <files to analyze>")
  parser.add_option("", "--source_dir",
                    help="path to top of source tree for this build"
                    "(used to normalize source paths in baseline)")

  (options, args) = parser.parse_args()
  if len(args) == 0:
    parser.error("no filename specified")
  filenames = args

  analyzer = DrMemoryAnalyze(options.source_dir, filenames)
  retcode = analyzer.Report(False)

  sys.exit(retcode)
