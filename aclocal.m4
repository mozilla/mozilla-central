dnl
dnl Local autoconf macros used with mozilla
dnl The contents of this file are under the Public Domain.
dnl 

builtin(include, mozilla/build/autoconf/glib.m4)dnl
builtin(include, mozilla/build/autoconf/libIDL.m4)dnl
builtin(include, mozilla/build/autoconf/nspr.m4)dnl
builtin(include, mozilla/build/autoconf/nss.m4)dnl
builtin(include, mozilla/build/autoconf/pkg.m4)dnl
builtin(include, mozilla/build/autoconf/freetype2.m4)dnl
builtin(include, mozilla/build/autoconf/codeset.m4)dnl
builtin(include, mozilla/build/autoconf/altoptions.m4)dnl

# Read the user's .mozconfig script.  We can't do this in
# configure.in: autoconf puts the argument parsing code above anything
# expanded from configure.in, and we need to get the configure options
# from .mozconfig in place before that argument parsing code.
MOZ_READ_MOZCONFIG(mozilla)
