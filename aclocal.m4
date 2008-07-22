dnl
dnl Local autoconf macros used with mozilla
dnl The contents of this file are under the Public Domain.
dnl 

builtin(include, mozilla/build/autoconf/glib.m4)dnl
builtin(include, mozilla/build/autoconf/gtk.m4)dnl
builtin(include, mozilla/build/autoconf/libIDL.m4)dnl
builtin(include, mozilla/build/autoconf/libIDL-2.m4)dnl
builtin(include, mozilla/build/autoconf/nspr.m4)dnl
builtin(include, mozilla/build/autoconf/nss.m4)dnl
builtin(include, mozilla/build/autoconf/libart.m4)dnl
builtin(include, mozilla/build/autoconf/pkg.m4)dnl
builtin(include, mozilla/build/autoconf/freetype2.m4)dnl
builtin(include, mozilla/build/autoconf/codeset.m4)dnl
dnl
define(MOZ_TOPSRCDIR,mozilla)dnl MOZ_TOPSRCDIR is used in altoptions.m4
builtin(include, mozilla/build/autoconf/altoptions.m4)dnl
