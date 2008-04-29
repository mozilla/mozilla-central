from time import strftime,localtime

def formatBytes(bytes, sigDigits=3):
    # Force a float calculation
    bytes=float(str(bytes) + '.0')

    if bytes > 1024**3:
        formattedBytes = setSigDigits(bytes / 1024**3, sigDigits) + 'G'
    elif bytes > 1024**2:
        formattedBytes = setSigDigits(bytes / 1024**2, sigDigits) + 'M'
    elif bytes > 1024**1:
        formattedBytes = setSigDigits(bytes / 1024, sigDigits) + 'K'
    else:
        formattedBytes = setSigDigits(bytes, sigDigits)
    return str(formattedBytes) + 'B'

def formatCount(number, sigDigits=3):
    number=float(str(number) + '.0')
    return str(setSigDigits(number, sigDigits))
    
def setSigDigits(num, sigDigits=3):
    if num == 0:
        return '0'
    elif num < 10**(sigDigits-5):
        return '%.5f' % num
    elif num < 10**(sigDigits-4):
        return '%.4f' % num
    elif num < 10**(sigDigits-3):
        return '%.3f' % num
    elif num < 10**(sigDigits-2):
        return '%.2f' % num
    elif num < 10**(sigDigits-1):
        return '%.1f' % num
    return '%(num)d' % {'num': num}

def tinderboxPrint(testName,
                   testTitle,
                   numResult,
                   units,
                   printName,
                   printResult,
                   unitsSuffix=""):
#    time = strftime("%Y:%m:%d:%H:%M:%S", localtime());
    output = "TinderboxPrint:"
    output += "<abbr title=\"" + testTitle + "\">"
    output += printName + "</abbr>:"
    output += "%s\n" % str(printResult)
    output += unitsSuffix
    return output
