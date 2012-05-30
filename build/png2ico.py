#!/usr/bin/env python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

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
