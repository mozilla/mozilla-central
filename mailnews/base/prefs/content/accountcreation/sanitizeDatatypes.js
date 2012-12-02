/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This is a generic input validation lib. Use it when you process
 * data from the network.
 *
 * Just a few functions which verify, for security purposes, that the
 * input variables (strings, if nothing else is noted) are of the expected
 * type and syntax.
 *
 * The functions take a string (unless noted otherwise) and return
 * the expected datatype in JS types. If the value is not as expected,
 * they throw exceptions.
 */

Components.utils.import("resource:///modules/hostnameUtils.jsm");

var sanitize =
{
  integer : function(unchecked)
  {
    if (typeof(unchecked) == "number" && !isNaN(unchecked))
      return unchecked;

    var r = parseInt(unchecked);
    if (isNaN(r))
      throw new MalformedException("no_number.error", unchecked);

    return r;
  },

  integerRange : function(unchecked, min, max)
  {
    var int = this.integer(unchecked);
    if (int < min)
      throw new MalformedException("number_too_small.error", unchecked);

    if (int > max)
      throw new MalformedException("number_too_large.error", unchecked);

    return int;
  },

  boolean : function(unchecked)
  {
    if (typeof(unchecked) == "boolean")
      return unchecked;

    if (unchecked == "true")
      return true;

    if (unchecked == "false")
      return false;

    throw new MalformedException("boolean.error", unchecked);
  },

  string : function(unchecked)
  {
    return String(unchecked);
  },

  nonemptystring : function(unchecked)
  {
    if (!unchecked)
      throw new MalformedException("string_empty.error", unchecked);

    return this.string(unchecked);
  },

  /**
   * Allow only letters, numbers, "-" and "_".
   *
   * Empty strings not allowed (good idea?).
   */
  alphanumdash : function(unchecked)
  {
    var str = this.nonemptystring(unchecked);
    if (!/^[a-zA-Z0-9\-\_]*$/.test(str))
      throw new MalformedException("alphanumdash.error", unchecked);

    return str;
  },

  /**
   * DNS hostnames like foo.bar.example.com
   * Allow only letters, numbers, "-" and "."
   * Empty strings not allowed.
   * Currently does not support IDN (international domain names).
   */
  hostname : function(unchecked)
  {
    let str = cleanUpHostName(this.nonemptystring(unchecked));

    // Allow placeholders. TODO move to a new hostnameOrPlaceholder()
    // The regex is "anything, followed by one or more (placeholders than
    // anything)".  This doesn't catch the non-placeholder case, but that's
    // handled down below.
    if (/^[a-zA-Z0-9\-\.]*(%[A-Z0-9]+%[a-zA-Z0-9\-\.]*)+$/.test(str))
      return str;

    if (!isLegalHostNameOrIP(str))
      throw new MalformedException("hostname_syntax.error", unchecked);

    return str.toLowerCase();
  },
  /**
   * A non-chrome URL that's safe to request.
   */
  url : function (unchecked)
  {
    var str =  this.string(unchecked);
    if (str.substr(0, 4) != "http" && str.substr(0, 5) != "https")
      throw new MalformedException("url_scheme.error", unchecked);

    var uri;
    try {
      uri = ioService().newURI(str, null, null);
      uri = uri.QueryInterface(Ci.nsIURL);
    } catch (e) {
      throw new MalformedException("url_parsing.error", unchecked);
    }

    if (uri.scheme != "http" && uri.scheme != "https")
      throw new MalformedException("url_scheme.error", unchecked);

    return uri.spec;
  },

  /**
   * A value which should be shown to the user in the UI as label
   */
  label : function(unchecked)
  {
    return this.string(unchecked);
  },

  /**
   * Allows only certain values as input, otherwise throw.
   *
   * @param unchecked {Any} The value to check
   * @param allowedValues {Array} List of values that |unchecked| may have.
   * @param defaultValue {Any} (Optional) If |unchecked| does not match
   *       anything in |mapping|, a |defaultValue| can be returned instead of
   *       throwing an exception. The latter is the default and happens when
   *       no |defaultValue| is passed.
   * @throws MalformedException
   */
  enum : function(unchecked, allowedValues, defaultValue)
  {
    for each (var allowedValue in allowedValues)
    {
      if (allowedValue == unchecked)
        return allowedValue;
    }
    // value is bad
    if (typeof(defaultValue) == "undefined")
      throw new MalformedException("allowed_value.error", unchecked);
    return defaultValue;
  },

  /**
   * Like enum, allows only certain (string) values as input, but allows the
   * caller to specify another value to return instead of the input value. E.g.,
   * if unchecked == "foo", return 1, if unchecked == "bar", return 2,
   * otherwise throw. This allows to translate string enums into integer enums.
   *
   * @param unchecked {Any} The value to check
   * @param mapping {Object} Associative array. property name is the input
   *       value, property value is the output value. E.g. the example above
   *       would be: { foo: 1, bar : 2 }.
   *       Use quotes when you need freaky characters: "baz-" : 3.
   * @param defaultValue {Any} (Optional) If |unchecked| does not match
   *       anything in |mapping|, a |defaultValue| can be returned instead of
   *       throwing an exception. The latter is the default and happens when
   *       no |defaultValue| is passed.
   * @throws MalformedException
   */
  translate : function(unchecked, mapping, defaultValue)
  {
    for (var inputValue in mapping)
    {
      if (inputValue == unchecked)
        return mapping[inputValue];
    }
    // value is bad
    if (typeof(defaultValue) == "undefined")
      throw new MalformedException("allowed_value.error", unchecked);
    return defaultValue;
  }
};

function MalformedException(msgID, uncheckedBadValue)
{
  var stringBundle = getStringBundle(
      "chrome://messenger/locale/accountCreationUtil.properties");
  var msg = stringBundle.GetStringFromName(msgID);
  if (kDebug)
    msg += " (bad value: " + new String(uncheckedBadValue) + ")";
  Exception.call(this, msg);
}
extend(MalformedException, Exception);
