#!/bin/sh

# Set up settings and paths for finding files.
if [ -z "$DEBUG" ]; then DEBUG=0; fi
if [ -z "$PERL" ]; then PERL=perl; fi
if [ -z "$FEDIR" ]; then FEDIR=$PWD/..; fi
if [ -z "$CONFIGDIR" ]; then CONFIGDIR=$FEDIR/../../config; fi
if [ -z "$XPIFILES" ]; then XPIFILES=$PWD/resources; fi
if [ -z "$XPIROOT" ]; then XPIROOT=$PWD/xpi-tree; fi
if [ -z "$JARROOT" ]; then JARROOT=$PWD/jar-tree; fi
if [ -z "$LOCALEDIR" ]; then LOCALEDIR=$FEDIR/locales; fi
if [ -z "$AB_CD" ]; then AB_CD=en-US; fi

# Display all the settings and paths if we're in debug mode.
if [ $DEBUG -ge 1 ]; then
	echo "\$DEBUG     = $DEBUG"
	echo "\$PERL      = $PERL"
	echo "\$CONFIGDIR = $CONFIGDIR"
	echo "\$XPIFILES  = $XPIFILES"
	echo "\$XPIROOT   = $XPIROOT"
	echo "\$JARROOT   = $JARROOT"
	echo "\$FEDIR     = $FEDIR"
	echo "\$LOCALEDIR = $LOCALEDIR"
	echo "\$AB_CD     = $AB_CD"
fi

## Simple function to display all the parameters/arguments to itself.
function showParams()
{
  I=0
  for P in "$@"; do
    I=$((I+1))
    echo PARAM $I: "$P"
  done
}

## Call this with lots of parameters to run a command, log errors, and abort
## if it fails. Supports redirection if '>' and '<' are passed as arguments,
## e.g.:
##   safeCommand cmd arg1 arg2 '<' input.file '>' output-file
##
## Note: only a single input and single output redirection is supported.
##
function safeCommand()
{
  local -a CMD
  CMD_COUNT=$((0))
  INF=""
  OUTF=""
  LASTP=""
  for P in "$@"; do
    if [ "$LASTP" = "<" ]; then
      if [ -n "$INF" ]; then
        echo "ERROR: Multiple input files passed to safeCommand()." >&2
        exit 2
      fi
      INF="$P"
    elif [ "$LASTP" = ">" ]; then
      if [ -n "$OUTF" ]; then
        echo "ERROR: Multiple output files passed to safeCommand()." >&2
        exit 2
      fi
      OUTF="$P"
    elif [ "$P" = ">" -o "$P" = "<" ]; then
      echo >/dev/null
    else
      CMD[$CMD_COUNT]="$P"
      CMD_COUNT=$((CMD_COUNT+1))
    fi
    LASTP="$P"
  done
  
  if [ $DEBUG -ge 2 ]; then
    echo
    showParams "${CMD[@]}"
    echo 'INPUT  :' "$INF"
    echo 'OUTPUT :' "$OUTF"
  fi
  
  touch log.stdout log.stderr
  if [ -z "$INF" -a -z "$OUTF" ]; then
    "${CMD[@]}" 1>log.stdout 2>log.stderr
  elif [ -z "$INF" ]; then
    "${CMD[@]}" 1> "$OUTF" 2>log.stderr
  elif [ -z "$OUTF" ]; then
    "${CMD[@]}" < "$INF" 1>log.stdout 2>log.stderr
  else
    "${CMD[@]}" < "$INF" 1> "$OUTF" 2>log.stderr
  fi
  
  EC=$?
  if [ $DEBUG -ge 2 ]; then
    echo 'RESULT :' $EC
  fi
  if [ "$EC" != "0" ]; then
    echo "ERROR ($EC)"
    cat log.stdout
    cat log.stderr
    rm -f log.stdout log.stderr
    exit 1
  fi
  rm -f log.stdout log.stderr
  return $EC
}


## Begin real program ##


# Clean up XPI and JAR build directories.
if [ "$1" = "clean" ]; then
  echo -n "Cleaning up files"
  echo -n .
  rm -rf "$XPIROOT"
  echo -n .
  rm -rf "$JARROOT"
  echo   ". done."
  
  exit
fi


# Check that requested language is in all-locales file (i.e. exists and it
# allowed to be used). Fall back to en-US if not.
# FIXME: THIS DOES NOT WORK WITH CYGWIN.
grep -sx "$AB_CD" "$LOCALEDIR/all-locales" > /dev/null
if [ $? != 0 ]; then
  AB_CD=en-US
fi
if [ $DEBUG -ge 1 ]; then echo "Language   = $AB_CD"; fi


# Set up where the actual localisation files are to be found; below $LOCALEDIR
# for en-US, in l10n/ repository for other languages.
if [ "$AB_CD" = "en-US" ]; then
  L10NDIR="$LOCALEDIR/$AB_CD"
else
  L10NDIR="$FEDIR/../../../l10n/$AB_CD/extensions/irc"
fi
if [ $DEBUG -ge 1 ]; then echo "L10n dir   = $L10NDIR"; fi


# Check directory setup.
if ! [ -d "$CONFIGDIR" ]; then
  echo "ERROR: mozilla/config directory (CONFIGDIR) not found."
  exit 1
fi
if ! [ -d "$FEDIR" ]; then
  echo "ERROR: Base ChatZilla directory (FEDIR) not found."
  exit 1
fi
if ! [ -d "$L10NDIR" ]; then
  echo "ERROR: Directory with localized files for $AB_CD language (L10NDIR) not found."
  exit 1
fi


# Extract version number.
VERSION=`grep "const __cz_version" "$FEDIR/xul/content/static.js" | sed "s|.*\"\([^\"]\{1,\}\)\".*|\1|"`
if [ -z "$VERSION" ]; then
  echo "ERROR: Unable to get version number."
  exit 1
fi


echo Beginning build of ChatZilla $VERSION...


# Set up XPI name using version and language.
if [ "$AB_CD" = "en-US" ]; then
  XPINAME="chatzilla-$VERSION.xpi"
else
  XPINAME="chatzilla-$AB_CD-$VERSION.xpi"
  echo "  NOTE: Building $AB_CD language."
fi


# Check for an existing XPI file and print a warning.
if [ -r "$XPINAME" ]; then
  echo "  WARNING: output XPI will be overwritten."
fi


# Check for required directory layouts.
echo -n "  Checking XPI structure"
echo -n .
if ! [ -d xpi-tree ]; then mkdir xpi-tree; fi
echo -n .
if ! [ -d xpi-tree/chrome ]; then mkdir xpi-tree/chrome; fi
echo -n .
if ! [ -d xpi-tree/chrome/icons ]; then mkdir xpi-tree/chrome/icons; fi
echo -n .
if ! [ -d xpi-tree/chrome/icons/default ]; then mkdir xpi-tree/chrome/icons/default; fi
echo -n .
if ! [ -d xpi-tree/components ]; then mkdir xpi-tree/components; fi
echo   ".           done"

echo -n "  Checking JAR structure"
echo -n .
if ! [ -d jar-tree ]; then mkdir jar-tree; fi
echo   ".               done"


# Make Firefox updates.
echo -n "  Updating Firefox Extension files"
echo -n .
safeCommand $PERL $CONFIGDIR/preprocessor.pl -DCHATZILLA_VERSION=$VERSION "$XPIFILES/install.rdf" '>' "$XPIROOT/install.rdf"
echo -n .
safeCommand cp "$XPIFILES/chatzilla-window.ico" "$XPIROOT/chrome/icons/default/chatzilla-window.ico"
echo -n .
safeCommand cp "$XPIFILES/chatzilla-window.xpm" "$XPIROOT/chrome/icons/default/chatzilla-window.xpm"
echo -n .
safeCommand cp "$XPIFILES/chatzilla-window16.xpm" "$XPIROOT/chrome/icons/default/chatzilla-window16.xpm"
echo   ".  done"


# Make Mozilla Suite updates.
echo -n "  Updating Mozilla Extension files"
echo -n .
safeCommand sed "s|@REVISION@|$VERSION|g" '<' "$XPIFILES/install.js" '>' "$XPIROOT/install.js"
echo -n .
safeCommand mv "$FEDIR/xul/content/contents.rdf" "$FEDIR/xul/content/contents.rdf.in"
safeCommand sed "s|\(chrome:displayName=\)\"[^\"]\{1,\}\"|\1\"ChatZilla $VERSION\"|g" '<' "$FEDIR/xul/content/contents.rdf.in" '>' "$FEDIR/xul/content/contents.rdf"
safeCommand rm "$FEDIR/xul/content/contents.rdf.in"
echo   ".    done"


# Create JAR.
echo -n "  Constructing JAR package"
echo -n .
OLDPWD=`pwd`
cd "$CONFIGDIR"
echo -n .

safeCommand $PERL make-jars.pl -v -z zip -p preprocessor.pl -s "$FEDIR" -d "$JARROOT" '<' "$FEDIR/jar.mn"
echo -n .
safeCommand $PERL make-jars.pl -v -z zip -p preprocessor.pl -s "$FEDIR/sm" -d "$JARROOT" '<' "$FEDIR/sm/jar.mn"
echo -n .
safeCommand $PERL make-jars.pl -v -z zip -p preprocessor.pl -s "$FEDIR/ff" -d "$JARROOT" '<' "$FEDIR/ff/jar.mn"
echo -n .
safeCommand $PERL preprocessor.pl -DAB_CD="$AB_CD" "$LOCALEDIR/jar.mn" '>' "$LOCALEDIR/jar.mn.pp"
safeCommand $PERL make-jars.pl -v -z zip -p preprocessor.pl -s "$LOCALEDIR" -d "$JARROOT" -c "$L10NDIR" -- "-DAB_CD=\"$AB_CD\" -DMOZILLA_LOCALE_VERSION=\"\"" '<' "$LOCALEDIR/jar.mn.pp"
safeCommand rm "$LOCALEDIR/jar.mn.pp"
echo -n .
cd "$OLDPWD"
echo   ".        done"


# Make XPI.
echo -n "  Constructing XPI package"
echo -n .
safeCommand cp -v "$JARROOT/chatzilla.jar" "$XPIROOT/chrome/"
echo -n .
safeCommand cp -v "$FEDIR/js/lib/chatzilla-service.js" "$XPIROOT/components/"
echo -n .
safeCommand chmod 664 "$XPIROOT/chrome/chatzilla.jar"
echo -n .
safeCommand chmod 664 "$XPIROOT/components/chatzilla-service.js"
echo -n .
OLDPWD=`pwd`
cd "$XPIROOT"
safeCommand zip -vr ../$XPINAME . -i "*" -x "log*"
cd "$OLDPWD"
echo   ".         done"


echo "Build of ChatZilla $VERSION...         ALL DONE"
