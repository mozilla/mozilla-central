#!/usr/bin/env python
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is mozilla.org code.
#
# The Initial Developer of the Original Code is
# the Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2011
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Siddharth Agarwal <sid.bugzilla@gmail.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

import png
import sys
import StringIO
import struct
import ctypes

# ref: http://msdn.microsoft.com/en-us/library/ms997538
class ICONDIR(ctypes.LittleEndianStructure):
    _pack_ = 1
    _fields_ = [("idReserved", ctypes.c_ushort),
                ("idType", ctypes.c_ushort),
                ("idCount", ctypes.c_ushort)]

class ICONDIRENTRY(ctypes.LittleEndianStructure):
    _pack_ = 1
    _fields_ = [("bWidth", ctypes.c_byte),
                ("bHeight", ctypes.c_byte),
                ("bColorCount", ctypes.c_byte),
                ("bReserved", ctypes.c_byte),
                ("wPlanes", ctypes.c_ushort),
                ("wBitCount", ctypes.c_ushort),
                ("dwBytesInRes", ctypes.c_ulong),
                ("dwImageOffset", ctypes.c_ulong)]

# R, G, B, A, so 4 columns per pixel
COLS_PP = 4

def main(infile, left, top, size, outfile):
    img = png.Reader(filename=infile)
    pixels = list(img.asRGBA()[2])
    # Take the subarray out. This is the ugliest but probably most efficient way
    # to do it
    outpixels = [[0] * (size * COLS_PP) for x in xrange(size)]
    for row in xrange(size):
        for col in xrange(size * COLS_PP):
            outpixels[row][col] = pixels[top + row][left * COLS_PP + col]

    # Set up a 32bpp RGBA PNG.
    writer = png.Writer(size=(size, size), bitdepth=8, alpha=True)
    # Write to a memory buffer
    outpng = StringIO.StringIO()
    writer.write(outpng, outpixels)
    outpngbuf = outpng.getvalue()
    outpng.close()

    # Set up an icon header
    icondir = ICONDIR()
    icondir.idReserved = 0
    # Icons are type 1
    icondir.idType = 1
    icondir.idCount = 1

    iconentry = ICONDIRENTRY()
    iconentry.bWidth = size
    iconentry.bHeight = size
    # Truecolor images have color count set to 0
    iconentry.bColorCount = 0
    iconentry.bReserved = 0
    # PNGs have 1 color plane
    iconentry.wPlanes = 1
    # We're RGBA, so 32 bits per pixel
    iconentry.wBitCount = 32
    # Length of the buffer
    iconentry.dwBytesInRes = len(outpngbuf)
    # The data will be right after the icondir and iconentry
    iconentry.dwImageOffset = ctypes.sizeof(icondir) + ctypes.sizeof(iconentry)

    # Time to write everything out
    out = open(outfile, "wb")
    out.write(icondir)
    out.write(iconentry)
    out.write(outpngbuf)
    out.close()

if __name__ == "__main__":
    # Convert left, top and size into integers
    main(*([sys.argv[1]] + [int(val) for val in sys.argv[2:5]] + [sys.argv[5]]))
