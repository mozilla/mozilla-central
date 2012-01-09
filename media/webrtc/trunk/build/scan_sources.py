#!/usr/bin/env python
# Copyright (c) 2011 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

from optparse import OptionParser
import os
import re
import sys

"""Header Scanner.

This module will scan a set of input sources for include dependencies.  Use
the command-line switch -Ixxxx to add include paths.  All filenames and paths
are expected and returned with POSIX separators.
"""


debug = False


def DebugPrint(txt):
  if debug: print txt


class PathConverter(object):
  """PathConverter does path manipulates using Posix style pathnames.

  Regardless of the native path type, all inputs and outputs to the path
  functions are with POSIX style separators.
  """
  def ToNativePath(self, pathname):
    return os.path.sep.join(pathname.split('/'))

  def ToPosixPath(self, pathname):
    return '/'.join(pathname.split(os.path.sep))

  def exists(self, pathname):
    ospath = self.ToNativePath(pathname)
    return os.path.exists(ospath)

  def getcwd(self):
    return self.ToPosixPath(os.getcwd())

  def isabs(self, pathname):
    ospath = self.ToNativePath(pathname)
    return os.path.isabs(ospath)

  def isdir(self, pathname):
    ospath = self.ToNativePath(pathname)
    return os.path.isdir(ospath)

  def open(self, pathname):
    ospath = self.ToNativePath(pathname)
    return open(ospath)

  def realpath(self, pathname):
    ospath = self.ToNativePath(pathname)
    ospath = os.path.realpath(ospath)
    return self.ToPosixPath(ospath)


class Resolver(object):
  """Resolver finds and generates relative paths for include files.

  The Resolver object provides a mechanism to to find and convert a source or
  include filename into a relative path based on provided search paths.  All
  paths use POSIX style separator.
  """
  def __init__(self, pathobj=PathConverter()):
    self.search_dirs = []
    self.pathobj = pathobj
    self.cwd = self.pathobj.getcwd()
    self.offs = len(self.cwd)

  def AddOneDirectory(self, pathname):
    """Add an include search path."""
    pathname = self.pathobj.realpath(pathname)
    DebugPrint('Adding DIR: %s' % pathname)
    if pathname not in self.search_dirs:
      if self.pathobj.isdir(pathname):
        self.search_dirs.append(pathname)
      else:
        sys.stderr.write('Not a directory: %s\n' % pathname)
        return False
    return True

  def AddDirectories(self, pathlist):
    """Add list of space separated directories."""
    failed = False
    dirlist = ' '.join(pathlist)
    for dirname in dirlist.split(' '):
      if not self.AddOneDirectory(dirname):
        failed = True
    return not failed

  def GetDirectories(self):
    return self.search_dirs

  def RealToRelative(self, filepath, basepath):
    """Returns a relative path from an absolute basepath and filepath."""
    path_parts = filepath.split('/')
    base_parts = basepath.split('/')
    while path_parts and base_parts and path_parts[0] == base_parts[0]:
      path_parts = path_parts[1:]
      base_parts = base_parts[1:]
    rel_parts = ['..'] * len(base_parts) + path_parts
    return '/'.join(rel_parts)

  def FilenameToRelative(self, filepath):
    """Returns a relative path from CWD to filepath."""
    filepath = self.pathobj.realpath(filepath)
    basepath = self.cwd
    return self.RealToRelative(filepath, basepath)

  def FindFile(self, filename):
    """Search for <filename> across the search directories, if the path is not
       absolute.  Return the filepath relative to the CWD or None. """
    if self.pathobj.isabs(filename):
      if self.pathobj.exists(filename):
        return self.FilenameToRelative(filename)
      return None
    for pathname in self.search_dirs:
      fullname = '%s/%s' % (pathname, filename)
      if self.pathobj.exists(fullname):
        return self.FilenameToRelative(fullname)
    return None


def LoadFile(filename):
  # Catch cases where the file does not exist
  try:
    fd = PathConverter().open(filename)
  except IOError:
    DebugPrint('Exception on file: %s' % filename)
    return ''
  # Go ahead and throw if you fail to read
  return fd.read()


class Scanner(object):
  """Scanner searches for '#include' to find dependencies."""

  def __init__(self, loader=None):
    regex = r'\#[ \t]*include[ \t]*[<"]([^>^"]+)[>"]'
    self.parser = re.compile(regex)
    self.loader = loader
    if not loader:
      self.loader = LoadFile

  def ScanData(self, data):
    """Generate a list of includes from this text block."""
    return self.parser.findall(data)

  def ScanFile(self, filename):
    """Generate a list of includes from this filename."""
    includes = self.ScanData(self.loader(filename))
    DebugPrint('Source %s contains:\n\t%s' % (filename, '\n\t'.join(includes)))
    return includes


class WorkQueue(object):
  """WorkQueue contains the list of files to be scanned.

  WorkQueue contains provides a queue of files to be processed.  The scanner
  will attempt to push new items into the queue, which will be ignored if the
  item is already in the queue.  If the item is new, it will be added to the
  work list, which is drained by the scanner.
  """
  def __init__(self, resolver, scanner=Scanner()):
    self.added_set = set()
    self.todo_list = list()
    self.scanner = scanner
    self.resolver = resolver

  def PushIfNew(self, filename):
    """Add this dependency to the list of not already there."""
    DebugPrint('Adding %s' % filename)
    resolved_name = self.resolver.FindFile(filename)
    if not resolved_name:
      DebugPrint('Failed to resolve %s' % filename)
      return
    DebugPrint('Resolvd as %s' % resolved_name)
    if resolved_name in self.added_set:
      return
    self.todo_list.append(resolved_name)
    self.added_set.add(resolved_name)

  def PopIfAvail(self):
    """Fetch the next dependency to search."""
    if not self.todo_list:
      return None
    return self.todo_list.pop()

  def Run(self):
    """Search through the available dependencies until the list becomes empty.
      The list must be primed with one or more source files to search."""
    scan_name = self.PopIfAvail()
    while scan_name:
      includes = self.scanner.ScanFile(scan_name)
      for include_file in includes:
        self.PushIfNew(include_file)
      scan_name = self.PopIfAvail()
    return sorted(self.added_set)


def Main(argv):
  global debug
  parser = OptionParser()
  parser.add_option('-I', dest='includes', action='append',
                    help='Set include path.')
  parser.add_option('-D', dest='debug', action='store_true',
                    help='Enable debugging output.', default=False)
  (options, files) = parser.parse_args(argv[1:])

  if options.debug:
    debug = Trueglobal_var_name,

  resolver = Resolver()
  if options.includes:
    if not resolver.AddDirectories(options.includes):
      return -1

  workQ = WorkQueue(resolver)
  for filename in files:
    workQ.PushIfNew(filename)

  sorted_list = workQ.Run()
  for pathname in sorted_list:
    sys.stderr.write(pathname + '\n')
  return 0


if __name__ == '__main__':
  sys.exit(Main(sys.argv))
