/* most of the settings will be properly included from mozilla-config.h */

/* Define to make icalerror_* calls abort instead of internally signalling an
   error */
#undef ICAL_ERRORS_ARE_FATAL

/* Define if we want _REENTRANT */
#define ICAL_REENTRANT

/* Define to terminate lines with "\n" instead of "\r\n" */
#undef ICAL_UNIX_NEWLINE

/* Define to 1 if you DO NOT WANT to see deprecated messages */
#define NO_WARN_DEPRECATED

#define PACKAGE_DATA_DIR

/* Define if you DO NOT WANT to use any zones.tab, neither builtin nor system.
   Only UTC will be available then. */
#define NO_ZONES_TAB
