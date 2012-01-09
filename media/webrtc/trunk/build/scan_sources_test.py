#!/usr/bin/env python
# Copyright (c) 2011 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

import os
import scan_sources
import unittest


class MockSimplePath(object):
  def exists(self, pathname):
    return True

  def getcwd(self):
    return '.'

  def isdir(self, pathname):
    return True

  def realpath(self, pathname):
    return pathname


class MockScanner(object):
  def __init__(self, filelists):
    self.filelists = filelists

  def ScanFile(self, filename):
    if not self.filelists:
      return []
    return self.filelists.pop()


class MockResolver(object):
  def FindFile(self, filename):
    return filename


class ScannerUnitTest(unittest.TestCase):

  def testScanData(self):
    scanner = scan_sources.Scanner()
    test = """
#This is not an include
#include is <bogus>
#include <x1>
 #include "x2"
#include     <x3>
#include     "x4"
# include     <x5>
# include  "x6"
# include "x7"
Not
"""
    results = scanner.ScanData(test)
    self.assertEqual(results, ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7'])

  def testResolverAddDirectories(self):
    resolver = scan_sources.Resolver(MockSimplePath())
    resolver.AddDirectories(['Dir1 Dir2', 'Dir3', 'Dir4', 'Dir5'])
    results = resolver.GetDirectories()
    self.assertEqual(results, ['Dir1','Dir2','Dir3','Dir4','Dir5'])

  def testResolverRelative(self):
    resolver = scan_sources.Resolver()
    tests = [
        ('/foo/bar','/foo/bar/file1','file1'),
        ('/foo/bar/extra', '/foo/bar/file2', '../file2'),
        ('/foo/bar', '/foo/bar/extra/file3', 'extra/file3'),
    ]
    for (base, full, rel) in tests:
      self.assertEqual(rel, resolver.RealToRelative(full, base))

  def testWorkQ(self):
    filelists = [['file1', 'file4', 'file2'], ['file3'], ['file5', 'file2']]
    resolver = MockResolver()
    scanner = MockScanner(filelists)
    workq = scan_sources.WorkQueue(resolver, scanner)
    workq.PushIfNew('file3')
    result = workq.Run()

    flat = set([item for item in [sublist for sublist in filelists]])
    flat = [item for item in flat]

    flat = sorted(flat)
    result = sorted(flat)
    self.assertEqual(flat, result)

if __name__ == '__main__':
  unittest.main()
