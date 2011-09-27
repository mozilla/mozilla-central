# $Id: Makefile.inc 1732 2007-01-13 19:34:04Z peter $

libyasm_a_SOURCES += modules/objfmts/macho/macho-objfmt.c

YASM_MODULES += objfmt_macho objfmt_macho32 objfmt_macho64

EXTRA_DIST += modules/objfmts/macho/tests/Makefile.inc

include modules/objfmts/macho/tests/Makefile.inc
