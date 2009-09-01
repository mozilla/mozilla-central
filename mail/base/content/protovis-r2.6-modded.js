var pv = function () {
/**
 * @namespace The Protovis namespace, <tt>pv</tt>. All public methods and fields
 * should be registered on this object. Note that core Protovis source is
 * surrounded by an anonymous function, so any other declared globals will not
 * be visible outside of core methods. This also allows multiple versions of
 * Protovis to coexist, since each version will see their own <tt>pv</tt>
 * namespace.
 */
var pv = {};

/**
 * Returns a prototype object suitable for extending the given class
 * <tt>f</tt>. Rather than constructing a new instance of <tt>f</tt> to serve as
 * the prototype (which unnecessarily runs the constructor on the created
 * prototype object, potentially polluting it), an anonymous function is
 * generated internally that shares the same prototype:
 *
 * <pre>function g() {}
 * g.prototype = f.prototype;
 * return new g();</pre>
 *
 * For more details, see Douglas Crockford's essay on prototypal inheritance.
 *
 * @param {function} f a constructor.
 * @returns a suitable prototype object.
 * @see Douglas Crockford's essay on <a
 * href="http://javascript.crockford.com/prototypal.html">prototypal
 * inheritance</a>.
 */
pv.extend = function(f) {
  function g() {}
  g.prototype = f.prototype;
  return new g();
};

try {
  eval("pv.parse = function(x) x;"); // native support
} catch (e) {

/**
 * Parses a Protovis specification, which may use JavaScript 1.8 function
 * expresses, replacing those function expressions with proper functions such
 * that the code can be run by a JavaScript 1.6 interpreter. This hack only
 * supports function expressions (using clumsy regular expressions, no less),
 * and not other JavaScript 1.8 features such as let expressions.
 *
 * @param {string} s a Protovis specification (i.e., a string of JavaScript 1.8
 * source code).
 * @returns {string} a conformant JavaScript 1.6 source code.
 */
  pv.parse = function(js) { // hacky regex support
    var re = new RegExp("function(\\s+\\w+)?\\([^)]*\\)\\s*", "mg"), m, i = 0;
    var s = "";
    while (m = re.exec(js)) {
      var j = m.index + m[0].length;
      if (js[j--] != '{') {
        s += js.substring(i, j) + "{return ";
        i = j;
        for (var p = 0; p >= 0 && j < js.length; j++) {
          switch (js[j]) {
            case '"': case '\'': {
              var c = js[j];
              while (++j < js.length && (js[j] != c)) {
                if (js[j] == '\\') j++;
              }
              break;
            }
            case '[': case '(': p++; break;
            case ']': case ')': p--; break;
            case ';':
            case ',': if (p == 0) p--; break;
          }
        }
        s += pv.parse(js.substring(i, --j)) + ";}";
        i = j;
      }
      re.lastIndex = j;
    }
    s += js.substring(i);
    return s;
  };
}

/**
 * Returns the passed-in argument, <tt>x</tt>; the identity function. This method
 * is provided for convenience since it is used as the default behavior for a
 * number of property functions.
 *
 * @param x a value.
 * @returns the value <tt>x</tt>.
 */
pv.identity = function(x) { return x; };

/**
 * Returns an array of numbers, starting at <tt>start</tt>, incrementing by
 * <tt>step</tt>, until <tt>stop</tt> is reached. The stop value is exclusive. If
 * only a single argument is specified, this value is interpeted as the
 * <i>stop</i> value, with the <i>start</i> value as zero. If only two arguments
 * are specified, the step value is implied to be one.
 *
 * <p>The method is modeled after the built-in <tt>range</tt> method from
 * Python. See the Python documentation for more details.
 *
 * @see <a href="http://docs.python.org/library/functions.html#range">Python range</a>.
 * @param {number} [start] the start value.
 * @param {number} stop the stop value.
 * @param {number} [step] the step value.
 * @returns {number[]} an array of numbers.
 */
pv.range = function(start, stop, step) {
  if (arguments.length == 1) {
    stop = start;
    start = 0;
  }
  if (step == undefined) step = 1;
  else if (!step) throw new Error("step must be non-zero");
  var array = [], i = 0, j;
  if (step < 0) {
    while ((j = start + step * i++) > stop) {
      array.push(j);
    }
  } else {
    while ((j = start + step * i++) < stop) {
      array.push(j);
    }
  }
  return array;
};

/**
 * Given two arrays <tt>a</tt> and <tt>b</tt>, returns an array of all possible
 * pairs of elements [a<sub>i</sub>, b<sub>j</sub>]. The outer loop is on array
 * <i>a</i>, while the inner loop is on <i>b</i>, such that the order of
 * returned elements is [a<sub>0</sub>, b<sub>0</sub>], [a<sub>0</sub>,
 * b<sub>1</sub>], ... [a<sub>0</sub>, b<sub>m</sub>], [a<sub>1</sub>,
 * b<sub>0</sub>], [a<sub>1</sub>, b<sub>1</sub>], ... [a<sub>1</sub>,
 * b<sub>m</sub>], ... [a<sub>n</sub>, b<sub>m</sub>]. If either array is empty,
 * an empty array is returned.
 *
 * @param {array} a an array.
 * @param {array} b an array.
 * @returns {array} an array of pairs of elements in <tt>a</tt> and <tt>b</tt>.
 */
pv.cross = function(a, b) {
  var array = [];
  for (var i = 0, n = a.length, m = b.length; i < n; i++) {
    for (var j = 0, x = a[i]; j < m; j++) {
      array.push([x, b[j]]);
    }
  }
  return array;
};

/**
 * Given the specified array of <tt>arrays</tt>, concatenates the arrays into a
 * single array. If the individual arrays are explicitly known, an alternative
 * to blend is to use JavaScript's <tt>concat</tt> method directly. These two
 * equivalent expressions:<ul>
 *
 * <li><tt>pv.blend([[1, 2, 3], ["a", "b", "c"]])</tt>
 * <li><tt>[1, 2, 3].concat(["a", "b", "c"])</tt>
 *
 * </ul>return [1, 2, 3, "a", "b", "c"].
 *
 * @param {array[]} arrays an array of arrays.
 * @returns {array} an array containing all the elements of each array in
 * <tt>arrays</tt>.
 */
pv.blend = function(arrays) {
  return Array.prototype.concat.apply([], arrays);
};

/**
 * Returns all of the property names (keys) of the specified object (a map). The
 * order of the returned array is not defined.
 *
 * @param map an object.
 * @returns {string[]} an array of strings corresponding to the keys.
 * @see #entries
 */
pv.keys = function(map) {
  var array = [];
  for (var key in map) {
    array.push(key);
  }
  return array;
};

/**
 * Returns all of the entries (key-value pairs) of the specified object (a
 * map). The order of the returned array is not defined. Each key-value pair is
 * represented as an object with <tt>key</tt> and <tt>value</tt> attributes,
 * e.g., <tt>{key: "foo", value: 42}</tt>.
 *
 * @param map an object.
 * @returns {array} an array of key-value pairs corresponding to the keys.
 */
pv.entries = function(map) {
  var array = [];
  for (var key in map) {
    array.push({ key: key, value: map[key] });
  }
  return array;
};

/**
 * Returns all of the values (attribute values) of the specified object (a
 * map). The order of the returned array is not defined.
 *
 * @param map an object.
 * @returns {array} an array of objects corresponding to the values.
 * @see #entries
 */
pv.values = function(map) {
  var array = [];
  for (var key in map) {
    array.push(map[key]);
  }
  return array;
};

/**
 * Returns a normalized copy of the specified array, such that the sum of the
 * returned elements sum to one. If the specified array is not an array of
 * numbers, an optional accessor function <tt>f</tt> can be specified to map the
 * elements to numbers. For example, if <tt>array</tt> is an array of objects,
 * and each object has a numeric property "foo", the expression
 *
 * <pre>pv.normalize(array, function(d) d.foo)</pre>
 *
 * returns a normalized array on the "foo" property. If an accessor function is
 * not specified, the identity function is used.
 *
 * @param {array} array an array of objects, or numbers.
 * @param {function} [f] an optional accessor function.
 * @returns {number[]} an array of numbers that sums to one.
 */
pv.normalize = function(array, f) {
  if (!f) f = pv.identity;
  var sum = pv.sum(array, f);
  return array.map(function(d) { return f(d) / sum; });
};

/**
 * Returns the sum of the specified array. If the specified array is not an
 * array of numbers, an optional accessor function <tt>f</tt> can be specified
 * to map the elements to numbers. See {@link #normalize} for an example.
 *
 * @param {array} array an array of objects, or numbers.
 * @param {function} [f] an optional accessor function.
 * @returns {number} the sum of the specified array.
 */
pv.sum = function(array, f) {
  if (!f) f = pv.identity;
  return pv.reduce(array, function(p, d) { return p + f(d); }, 0);
};

/**
 * Returns the maximum value of the specified array. If the specified array is
 * not an array of numbers, an optional accessor function <tt>f</tt> can be
 * specified to map the elements to numbers. See {@link #normalize} for an
 * example.
 *
 * @param {array} array an array of objects, or numbers.
 * @param {function} [f] an optional accessor function.
 * @returns {number} the maximum value of the specified array.
 */
pv.max = function(array, f) {
  if (!f) f = pv.identity;
  return pv.reduce(array, function(p, d) { return Math.max(p, f(d)); }, -Infinity);
};

/**
 * Returns the index of the maximum value of the specified array. If the
 * specified array is not an array of numbers, an optional accessor function
 * <tt>f</tt> can be specified to map the elements to numbers. See
 * {@link #normalize} for an example.
 *
 * @param {array} array an array of objects, or numbers.
 * @param {function} [f] an optional accessor function.
 * @returns {number} the index of the maximum value of the specified array.
 */
pv.max.index = function(array, f) {
  if (!f) f = pv.identity;
  var maxi = -1, maxx = -Infinity;
  for (var i = 0; i < array.length; i++) {
    var x = f(array[i]);
    if (x > maxx) {
      maxx = x;
      maxi = i;
    }
  }
  return maxi;
}

/**
 * Returns the minimum value of the specified array of numbers. If the specified
 * array is not an array of numbers, an optional accessor function <tt>f</tt>
 * can be specified to map the elements to numbers. See {@link #normalize} for
 * an example.
 *
 * @param {array} array an array of objects, or numbers.
 * @param {function} [f] an optional accessor function.
 * @returns {number} the minimum value of the specified array.
 */
pv.min = function(array, f) {
  if (!f) f = pv.identity;
  return pv.reduce(array, function(p, d) { return Math.min(p, f(d)); }, Infinity);
};

/**
 * Returns the index of the minimum value of the specified array. If the
 * specified array is not an array of numbers, an optional accessor function
 * <tt>f</tt> can be specified to map the elements to numbers. See
 * {@link #normalize} for an example.
 *
 * @param {array} array an array of objects, or numbers.
 * @param {function} [f] an optional accessor function.
 * @returns {number} the index of the minimum value of the specified array.
 */
pv.min.index = function(array, f) {
  if (!f) f = pv.identity;
  var mini = -1, minx = Infinity;
  for (var i = 0; i < array.length; i++) {
    var x = f(array[i]);
    if (x < minx) {
      minx = x;
      mini = i;
    }
  }
  return mini;
}

/**
 * Returns the arithmetic mean, or average, of the specified array. If the
 * specified array is not an array of numbers, an optional accessor function
 * <tt>f</tt> can be specified to map the elements to numbers. See
 * {@link #normalize} for an example.
 *
 * @param {array} array an array of objects, or numbers.
 * @param {function} [f] an optional accessor function.
 * @returns {number} the mean of the specified array.
 */
pv.mean = function(array, f) {
  return pv.sum(array, f) / array.length;
};

/**
 * Returns the median of the specified array. If the specified array is not an
 * array of numbers, an optional accessor function <tt>f</tt> can be specified
 * to map the elements to numbers. See {@link #normalize} for an example.
 *
 * @param {array} array an array of objects, or numbers.
 * @param {function} [f] an optional accessor function.
 * @returns {number} the median of the specified array.
 */
pv.median = function(array, f) {
  if (!f) f = pv.identity;
  array = array.map(f).sort(function(a, b) { return a - b; });
  if (array.length % 2) return array[Math.floor(array.length / 2)];
  var i = array.length / 2;
  return (array[i - 1] + array[i]) / 2;
};

if (/\[native code\]/.test(Array.prototype.reduce)) {
/**
 * Applies the specified function <tt>f</tt> against an accumulator and each
 * value of the specified array (from left-ot-right) so as to reduce it to a
 * single value.
 *
 * <p>Array reduce was added in JavaScript 1.8. This implementation uses the native
 * method if provided; otherwise we use our own implementation derived from the
 * JavaScript documentation. Note that we don't want to add it to the Array
 * prototype directly because this breaks certain (bad) for loop idioms.
 *
 * @see <a
 * href="http://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/reduce">Array.reduce</a>.
 * @param {array} array an array.
 * @param {function} [f] a callback function to execute on each value in the array.
 * @param [v] the object to use as the first argument to the first callback.
 * @returns the reduced value.
 */
  pv.reduce = function(array, f, v) {
    var p = Array.prototype;
    return p.reduce.apply(array, p.slice.call(arguments, 1));
  };
} else {
  pv.reduce = function(array, f, v) {
    var len = array.length;
    if (!len && (arguments.length == 2)) {
      throw new Error();
    }

    var i = 0;
    if (arguments.length < 3) {
      while (true) {
        if (i in array) {
          v = array[i++];
          break;
        }
        if (++i >= len) {
          throw new Error();
        }
      }
    }

    for (; i < len; i++) {
      if (i in array) {
        v = f.call(null, v, array[i], i, array);
      }
    }
    return v;
  };
};

/**
 * Returns a map constructed from the specified <tt>keys</tt>, using the function
 * <tt>f</tt> to compute the value for each key. The arguments to the value
 * function are the same as those used in the built-in array <tt>map</tt>
 * function: the key, the index, and the array itself. The callback is invoked
 * only for indexes of the array which have assigned values; it is not invoked
 * for indexes which have been deleted or which have never been assigned values.
 *
 * <p>For example, this expression creates a map from strings to string length:
 *
 * <pre>pv.dict(["one", "three", "seventeen"], function(s) s.length)</pre>
 *
 * The returned value is <tt>{one: 3, three: 5, seventeen: 9}</tt>.
 *
 * @see <a
 * href="http://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/Array/map">Array.map</a>.
 * @param {array} keys an array.
 * @param {function} f a value function.
 * @returns a map from keys to values.
 */
pv.dict = function(keys, f) {
  var m = {};
  for (var i = 0; i < keys.length; i++) {
    if (i in keys) {
      var k = keys[i];
      m[k] = f.call(null, k, i, keys);
    }
  }
  return m;
};

/**
 * Returns a permutation of the specified array, using the specified array of
 * indexes. The returned array contains the corresponding element in
 * <tt>array</tt> for each index in <tt>indexes</tt>, in order. For example,
 *
 * <pre>pv.permute(["a", "b", "c"], [1, 2, 0])</pre>
 *
 * returns <tt>["b", "c", "a"]</tt>. It is acceptable for the array of indexes
 * to be a different length from the array of elements, and for indexes to be
 * duplicated or omitted. The optional accessor function <tt>f</tt> can be used
 * to perform a simultaneous mapping of the array elements.
 *
 * @param {array} array an array.
 * @param {number[]} indexes an array of indexes into <tt>array</tt>.
 * @param {function} [f] an optional accessor function.
 * @returns {array} an array of elements from <tt>array</tt>; a permutation.
 */
pv.permute = function(array, indexes, f) {
  if (!f) f = pv.identity;
  var p = new Array(indexes.length);
  indexes.forEach(function(j, i) { p[i] = f(array[j]); });
  return p;
};

/**
 * Returns a map from key to index for the specified <tt>keys</tt> array. For
 * example,
 *
 * <pre>pv.numerate(["a", "b", "c"])</pre>
 *
 * returns <tt>{a: 0, b: 1, c: 2}</tt>. Note that since JavaScript maps only
 * support string keys, <tt>keys</tt> must contain strings, or other values that
 * naturally map to distinct string values. Alternatively, an optional accessor
 * function <tt>f</tt> can be specified to compute the string key for the given
 * element.
 *
 * @param {array} keys an array, usually of string keys.
 * @param {function} [f] an optional key function.
 * @returns a map from key to index.
 */
pv.numerate = function(keys, f) {
  if (!f) f = pv.identity;
  var map = {};
  keys.forEach(function(x, i) { map[f(x)] = i; });
  return map;
};

/**
 * The comparator function for natural order. This can be used in conjunction with
 * the built-in array <tt>sort</tt> method to sort elements by their natural
 * order, ascending. Note that if no comparator function is specified to the
 * built-in <tt>sort</tt> method, the default order is lexicographic, <i>not</i>
 * natural!
 *
 * @see <a
 * href="http://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/Array/sort">Array.sort</a>.
 * @param a an element to compare.
 * @param b an element to compare.
 * @returns {number} negative if a &lt; b; positive if a &gt; b; otherwise 0.
 */
pv.naturalOrder = function(a, b) {
  return (a < b) ? -1 : ((a > b) ? 1 : 0);
};

/**
 * The comparator function for reverse natural order. This can be used in
 * conjunction with the built-in array <tt>sort</tt> method to sort elements by
 * their natural order, descending. Note that if no comparator function is
 * specified to the built-in <tt>sort</tt> method, the default order is
 * lexicographic, <i>not</i> natural!
 *
 * @see #naturalOrder
 * @param a an element to compare.
 * @param b an element to compare.
 * @returns {number} negative if a &lt; b; positive if a &gt; b; otherwise 0.
 */
pv.reverseOrder = function(b, a) {
  return (a < b) ? -1 : ((a > b) ? 1 : 0);
};

/** @namespace Namespace constants for SVG, XMLNS, and XLINK. */
pv.ns = {
 /**
  * The SVG namespace, "http://www.w3.org/2000/svg".
  *
  * @type string
  */
 svg: "http://www.w3.org/2000/svg",

 /**
  * The XMLNS namespace, "http://www.w3.org/2000/xmlns".
  *
  * @type string
  */
 xmlns: "http://www.w3.org/2000/xmlns",

 /**
  * The XLINK namespace, "http://www.w3.org/1999/xlink".
  *
  * @type string
  */
 xlink: "http://www.w3.org/1999/xlink",
};

/** @namespace Protovis major and minor version numbers. */
pv.version = {
  /**
   * The major version number.
   *
   * @type number
   */
  major: 2,

  /**
   * The minor version number.
   *
   * @type number
   */
  minor: 6
};
/**
 * Returns the {@link pv.Color} for the specified color format string. Colors
 * may have an associated opacity, or alpha channel. Color formats are specified
 * by CSS Color Modular Level 3, using either in RGB or HSL color space. For
 * example:<ul>
 *
 * <li>#f00 // #rgb
 * <li>#ff0000 // #rrggbb
 * <li>rgb(255, 0, 0)
 * <li>rgb(100%, 0%, 0%)
 * <li>hsl(0, 100%, 50%)
 * <li>rgba(0, 0, 255, 0.5)
 * <li>hsla(120, 100%, 50%, 1)
 *
 * </ul>The SVG 1.0 color keywords names are also supported, such as "aliceblue"
 * and yellowgreen". The "transparent" keyword is also supported for a
 * fully-transparent color.
 *
 * <p>If the <tt>format</tt> argument is already an instance of <tt>Color</tt>,
 * the argument is returned with no further processing.
 *
 * @param {string} format the color specification string, e.g., "#f00".
 * @returns {pv.Color} the corresponding <tt>Color</tt>.
 * @see <a href="http://www.w3.org/TR/SVG/types.html#ColorKeywords">SVG color keywords</a>.
 * @see <a href="http://www.w3.org/TR/css3-color/">CSS3 color module</a>.
 */
pv.color = function(format) {
  if (!format || (format == "transparent")) {
    return new pv.Color.Rgb(0, 0, 0, 0);
  }
  if (format instanceof pv.Color) {
    return format;
  }

  /* Handle hsl, rgb. */
  var m1 = /([a-z]+)\((.*)\)/i.exec(format);
  if (m1) {
    var m2 = m1[2].split(","), a = 1;
    switch (m1[1]) {
      case "hsla":
      case "rgba": {
        a = parseFloat(m2[3]);
        break;
      }
    }
    switch (m1[1]) {
      case "hsla":
      case "hsl": {
        var h = parseFloat(m2[0]), // degrees
            s = parseFloat(m2[1]) / 100, // percentage
            l = parseFloat(m2[2]) / 100; // percentage
        return (new pv.Color.Hsl(h, s, l, a)).rgb();
      }
      case "rgba":
      case "rgb": {
        function parse(c) { // either integer or percentage
          var f = parseFloat(c);
          return (c[c.length - 1] == '%') ? Math.round(f * 2.55) : f;
        }
        var r = parse(m2[0]), g = parse(m2[1]), b = parse(m2[2]);
        return new pv.Color.Rgb(r, g, b, a);
      }
    }
  }

  /* Otherwise, assume named colors. TODO allow lazy conversion to RGB. */
  return new pv.Color(format, 1);
};

/**
 * Constructs a color with the specified color format string and opacity. This
 * constructor should not be invoked directly; use {@link pv.color} instead.
 *
 * @class Represents an abstract (possibly translucent) color. The color is
 * divided into two parts: the <tt>color</tt> attribute, an opaque color format
 * string, and the <tt>opacity</tt> attribute, a float in [0, 1]. The color
 * space is dependent on the implementing class; all colors support the
 * {@link #rgb} method to convert to RGB color space for interpolation.
 *
 * <p>See also the <a href="../../api/Color.html">Color guide</a>.
 *
 * @param {string} color an opaque color format string, such as "#f00".
 * @param {number} opacity the opacity, in [0,1].
 * @see pv.color
 */
pv.Color = function(color, opacity) {
  /**
   * An opaque color format string, such as "#f00".
   *
   * @type string
   * @see <a href="http://www.w3.org/TR/SVG/types.html#ColorKeywords">SVG color keywords</a>.
   * @see <a href="http://www.w3.org/TR/css3-color/">CSS3 color module</a>.
   */
  this.color = color;

  /**
   * The opacity, a float in [0, 1].
   *
   * @type number
   */
  this.opacity = opacity;
};

/**
 * Constructs a new RGB color with the specified channel values.
 *
 * @class Represents a color in RGB space.
 *
 * @param {number} r the red channel, an integer in [0,255].
 * @param {number} g the green channel, an integer in [0,255].
 * @param {number} b the blue channel, an integer in [0,255].
 * @param {number} a the alpha channel, a float in [0,1].
 * @extends pv.Color
 */
pv.Color.Rgb = function(r, g, b, a) {
  pv.Color.call(this, a ? ("rgb(" + r + "," + g + "," + b + ")") : "none", a);

  /**
   * The red channel, an integer in [0, 255].
   *
   * @type number
   */
  this.r = r;

  /**
   * The green channel, an integer in [0, 255].
   *
   * @type number
   */
  this.g = g;

  /**
   * The blue channel, an integer in [0, 255].
   *
   * @type number
   */
  this.b = b;

  /**
   * The alpha channel, a float in [0, 1].
   *
   * @type number
   */
  this.a = a;
};
pv.Color.Rgb.prototype = pv.extend(pv.Color);

/**
 * Returns the RGB color equivalent to this color. This method is abstract and
 * must be implemented by subclasses.
 *
 * @returns {pv.Color.Rgb} an RGB color.
 * @function
 * @name pv.Color.prototype.rgb
 */

/**
 * Returns this.
 *
 * @returns {pv.Color.Rgb} this.
 */
pv.Color.Rgb.prototype.rgb = function() { return this; };

/**
 * Constructs a new HSL color with the specified values.
 *
 * @class Represents a color in HSL space.
 *
 * @param {number} h the hue, an integer in [0, 360].
 * @param {number} s the saturation, a float in [0, 1].
 * @param {number} l the lightness, a float in [0, 1].
 * @param {number} a the opacity, a float in [0, 1].
 * @extends pv.Color
 */
pv.Color.Hsl = function(h, s, l, a) {
  pv.Color.call(this, "hsl(" + h + "," + (s * 100) + "%," + (l * 100) + "%)", a);

  /**
   * The hue, an integer in [0, 360].
   *
   * @type number
   */
  this.h = h;

  /**
   * The saturation, a float in [0, 1].
   *
   * @type number
   */
  this.s = s;

  /**
   * The lightness, a float in [0, 1].
   *
   * @type number
   */
  this.l = l;

  /**
   * The opacity, a float in [0, 1].
   *
   * @type number
   */
  this.a = a;
};
pv.Color.Hsl.prototype = pv.extend(pv.Color);

/**
 * Returns the RGB color equivalent to this HSL color.
 *
 * @returns {pv.Color.Rgb} an RGB color.
 */
pv.Color.Hsl.prototype.rgb = function() {
  var h = this.h, s = this.s, l = this.l;

  /* Some simple corrections for h, s and l. */
  h = h % 360; if (h < 0) h += 360;
  s = Math.max(0, Math.min(s, 1));
  l = Math.max(0, Math.min(l, 1));

  /* From FvD 13.37 */
  var m2 = (l < .5) ? (l * (l + s)) : (l + s - l * s);
  var m1 = 2 * l - m2;
  if (s == 0) {
    return new rgb(l, l, l);
  }
  function v(h) {
    if (h > 360) h -= 360;
    else if (h < 0) h += 360;
    if (h < 60) return m1 + (m2 - m1) * h / 60;
    else if (h < 180) return m2;
    else if (h < 240) return m1 + (m2 - m1) * (240 - h) / 60;
    return m1;
  }
  function vv(h) {
    return Math.round(v(h) * 255);
  }

  return new pv.Color.Rgb(vv(h + 120), vv(h), vv(h - 120), this.a);
};
/**
 * Returns a new categorical color encoding using the specified colors.  The
 * arguments to this method are an array of colors; see {@link pv.color}. For
 * example, to create a categorical color encoding using the <tt>species</tt>
 * attribute:
 *
 * <pre>pv.colors("red", "green", "blue").by(function(d) d.species)</pre>
 *
 * The result of this expression can be used as a fill- or stroke-style
 * property. This assumes that the data's <tt>species</tt> attribute is a
 * string.
 *
 * @returns {pv.Colors} a new categorical color encoding.
 * @param {string} colors... categorical colors.
 * @see pv.Colors
 */
pv.colors = function() {
  return pv.Colors(arguments);
};

/**
 * Returns a new categorical color encoding using the specified colors. This
 * constructor is typically not used directly; use {@link pv.colors} instead.
 *
 * @class Represents a categorical color encoding using the specified colors.
 * The returned object can be used as a property function; the appropriate
 * categorical color will be returned by evaluating the current datum, or
 * through whatever other means the encoding uses to determine uniqueness, per
 * the {@link #by} method. The default implementation allocates a distinct color
 * per {@link pv.Mark#childIndex}.
 *
 * @param {string[]} values an array of colors; see {@link pv.color}.
 * @returns {pv.Colors} a new categorical color encoding.
 * @see pv.colors
 */
pv.Colors = function(values) {

  /**
   * @ignore Each set of colors has an associated (numeric) ID that is used to
   * store a cache of assigned colors on the root scene. As unique keys are
   * discovered, a new color is allocated and assigned to the given key.
   *
   * The key function determines how uniqueness is determined. By default,
   * colors are assigned using the mark's childIndex, such that each new mark
   * added is given a new color. Note that derived marks will not inherit the
   * exact color of the prototype, but instead inherit the set of colors.
   */
  function colors(keyf) {
    var id = pv.Colors.count++;

    function color() {
      var key = keyf.apply(this, this.root.scene.data);
      var state = this.root.scene.colors;
      if (!state) this.root.scene.colors = state = {};
      if (!state[id]) state[id] = { count: 0 };
      var color = state[id][key];
      if (color == undefined) {
        color = state[id][key] = values[state[id].count++ % values.length];
      }
      return color;
    }
    return color;
  }

  var c = colors(function() { return this.childIndex; });

  /**
   * Allows a new set of colors to be derived from the current set using a
   * different key function. For instance, to color marks using the value of the
   * field "foo", say:
   *
   * <pre>pv.Colors.category10.by(function(d) d.foo)</pre>
   *
   * For convenience, "index" and "parent.index" keys are predefined.
   *
   * @param {function} v the new key function.
   * @name pv.Colors.prototype.by
   * @function
   * @returns {pv.Colors} a new color scheme
   */
  c.by = colors;

  /**
   * A derivative color encoding using the same colors, but allocating unique
   * colors based on the mark index.
   *
   * @name pv.Colors.prototype.unique
   * @type pv.Colors
   */
  c.unique = c.by(function() { return this.index; });

  /**
   * A derivative color encoding using the same colors, but allocating unique
   * colors based on the parent index.
   *
   * @name pv.Colors.prototype.parent
   * @type pv.Colors
   */
  c.parent = c.by(function() { return this.parent.index; });

  /**
   * The underlying array of colors.
   *
   * @type string[]
   * @name pv.Colors.prototype.values
   */
  c.values = values;

  return c;
};

/** @private */
pv.Colors.count = 0;

/* From Flare. */

/**
 * A 10-color scheme.
 *
 * @type pv.Colors
 */
pv.Colors.category10 = pv.colors(
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
);

/**
 * A 20-color scheme.
 *
 * @type pv.Colors
 */
pv.Colors.category20 = pv.colors(
  "#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78", "#2ca02c",
  "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5",
  "#8c564b", "#c49c94", "#e377c2", "#f7b6d2", "#7f7f7f",
  "#c7c7c7", "#bcbd22", "#dbdb8d", "#17becf", "#9edae5"
);

/**
 * An alternative 19-color scheme.
 *
 * @type pv.Colors
 */
pv.Colors.category19 = pv.colors(
  "#9c9ede", "#7375b5", "#4a5584", "#cedb9c", "#b5cf6b",
  "#8ca252", "#637939", "#e7cb94", "#e7ba52", "#bd9e39",
  "#8c6d31", "#e7969c", "#d6616b", "#ad494a", "#843c39",
  "#de9ed6", "#ce6dbd", "#a55194", "#7b4173"
);
// TODO support arbitrary color stops

/**
 * Returns a linear color ramp from the specified <tt>start</tt> color to the
 * specified <tt>end</tt> color. The color arguments may be specified either as
 * <tt>string</tt>s or as {@link pv.Color}s.
 *
 * @param {string} start the start color; may be a <tt>pv.Color</tt>.
 * @param {string} end the end color; may be a <tt>pv.Color</tt>.
 * @returns {pv.Ramp} a color ramp from <tt>start</tt> to <tt>end</tt>.
 */
pv.ramp = function(start, end) {
  return pv.Ramp(pv.color(start), pv.color(end));
};

/**
 * Constructs a ramp from the specified start color to the specified end
 * color. This constructor should not be invoked directly; use {@link pv.ramp}
 * instead.
 *
 * @class Represents a linear color ramp from the specified <tt>start</tt> color
 * to the specified <tt>end</tt> color. Ramps can be used as property functions;
 * their behavior is equivalent to calling {@link #value}, passing in the
 * current datum as the sample point. If the data is <i>not</i> a float in [0,
 * 1], the {@link #by} method can be used to map the datum to a suitable sample
 * point.
 *
 * @extends Function
 * @param {pv.Color} start the start color.
 * @param {pv.Color} end the end color.
 * @see pv.ramp
 */
pv.Ramp = function(start, end) {
  var s = start.rgb(), e = end.rgb(), f = pv.identity;

  /** @ignore Property function. */
  function ramp() {
    return value(f.apply(this, this.root.scene.data));
  }

  /** @ignore Interpolates between start and end at value t in [0,1]. */
  function value(t) {
    var t = Math.max(0, Math.min(1, t));
    var a = s.a * (1 - t) + e.a * t;
    if (a < 1e-5) a = 0; // avoid scientific notation
    return (s.a == 0) ? new pv.Color.Rgb(e.r, e.g, e.b, a)
        : ((e.a == 0) ? new pv.Color.Rgb(s.r, s.g, s.b, a)
        : new pv.Color.Rgb(
            Math.round(s.r * (1 - t) + e.r * t),
            Math.round(s.g * (1 - t) + e.g * t),
            Math.round(s.b * (1 - t) + e.b * t), a));
  }

  /**
   * Sets the sample function to be the specified function <tt>v</tt>.
   *
   * @param {function} v the new sample function.
   * @name pv.Ramp.prototype.by
   * @function
   * @returns {pv.Ramp} this.
   */
  ramp.by = function(v) { f = v; return this; };

  /**
   * Returns the interpolated color at the specified sample point.
   *
   * @param {number} t the sample point in [0, 1].
   * @name pv.Ramp.prototype.value
   * @function
   * @returns {pv.Color.Rgb} the interpolated color.
   */
  ramp.value = value;

  return ramp;
};
/**
 * Constructs a new mark with default properties. Marks, with the exception of
 * the root panel, are not typically constructed directly; instead, they are
 * added to a panel or an existing mark via {@link pv.Mark#add}.
 *
 * @class Represents a data-driven graphical mark. The <tt>Mark</tt> class is
 * the base class for all graphical marks in Protovis; it does not provide any
 * specific rendering functionality, but together with {@link Panel} establishes
 * the core framework.
 *
 * <p>Concrete mark types include familiar visual elements such as bars, lines
 * and labels. Although a bar mark may be used to construct a bar chart, marks
 * know nothing about charts; it is only through their specification and
 * composition that charts are produced. These building blocks permit many
 * combinatorial possibilities.
 *
 * <p>Marks are associated with <b>data</b>: a mark is generated once per
 * associated datum, mapping the datum to visual <b>properties</b> such as
 * position and color. Thus, a single mark specification represents a set of
 * visual elements that share the same data and visual encoding. The type of
 * mark defines the names of properties and their meaning. A property may be
 * static, ignoring the associated datum and returning a constant; or, it may be
 * dynamic, derived from the associated datum or index. Such dynamic encodings
 * can be specified succinctly using anonymous functions. Special properties
 * called event handlers can be registered to add interactivity.
 *
 * <p>While most properties are <i>variable</i>, some mark types, such as lines
 * and areas, generate a single visual element rather than a distinct visual
 * element per datum. With these marks, some properties may be <b>fixed</b>.
 * Fixed properties can vary per mark, but not <i>per datum</i>! These
 * properties are evaluated solely for the first (0-index) datum, and typically
 * are specified as a constant. However, it is valid to use a function if the
 * property varies between panels or is dynamically generated.
 *
 * <p>Protovis uses <b>inheritance</b> to simplify the specification of related
 * marks: a new mark can be derived from an existing mark, inheriting its
 * properties. The new mark can then override properties to specify new
 * behavior, potentially in terms of the old behavior. In this way, the old mark
 * serves as the <b>prototype</b> for the new mark. Most mark types share the
 * same basic properties for consistency and to facilitate inheritance.
 *
 * <p>See also the <a href="../../api/">Protovis guide</a>.
 */
pv.Mark = function() {};

/**
 * Returns the mark type name. Names should be lower case, with words separated
 * by hyphens. For example, the mark class <tt>FooBar</tt> should return
 * "foo-bar".
 *
 * <p>Note that this method is defined on the constructor, not on the prototype,
 * and thus is a static method. The constructor is accessible through the
 * {@link #type} field.
 *
 * @returns {string} the mark type name, such as "mark".
 */
pv.Mark.toString = function() { return "mark"; };

/**
 * Defines and registers a property method for the property with the given name.
 * This method should be called on a mark class prototype to define each exposed
 * property. (Note this refers to the JavaScript <tt>prototype</tt>, not the
 * Protovis mark prototype, which is the {@link #proto} field.)
 *
 * <p>The created property method supports several modes of invocation: <ol>
 *
 * <li>If invoked with a <tt>Function</tt> argument, this function is evaluated
 * for each associated datum. The return value of the function is used as the
 * computed property value. The context of the function (<tt>this</tt>) is this
 * mark. The arguments to the function are the associated data of this mark and
 * any enclosing panels. For example, a linear encoding of numerical data to
 * height is specified as
 *
 * <pre>m.height(function(d) d * 100);</pre>
 *
 * The expression <tt>d * 100</tt> will be evaluated for the height property of
 * each mark instance. This function is stored in the <tt>$height</tt> field. The
 * return value of the property method (e.g., <tt>m.height</tt>) is this mark
 * (<tt>m</tt>)).<p>
 *
 * <li>If invoked with a non-function argument, the property is treated as a
 * constant, and wrapped with an accessor function. This wrapper function is
 * stored in the equivalent internal (<tt>$</tt>-prefixed) field. The return
 * value of the property method (e.g., <tt>m.height</tt>) is this mark.<p>
 *
 * <li>If invoked from an event handler, the property is set to the specified
 * value on the current instance (i.e., the instance that triggered the event,
 * such as a mouse click). In this case, the value should be a constant and not
 * a function. The return value is this mark. For example, saying
 *
 * <pre>this.fillStyle("red").strokeStyle("black");</pre>
 *
 * from a "click" event handler will set the fill color to red, and the stroke
 * color to black, for any marks that are clicked.<p>
 *
 * <li>If invoked with no arguments, the computed property value for the current
 * mark instance in the scene graph is returned. This facilitates <i>property
 * chaining</i>, where one mark's properties are defined in terms of another's.
 * For example, to offset a mark's location from its prototype, you might say
 *
 * <pre>m.top(function() this.proto.top() + 10);</pre>
 *
 * Note that the index of the mark being evaluated (in the above example,
 * <tt>this.proto</tt>) is inherited from the <tt>Mark</tt> class and set by
 * this mark. So, if the fifth element's top property is being evaluated, the
 * fifth instance of <tt>this.proto</tt> will similarly be queried for the value
 * of its top property. If the mark being evaluated has a different number of
 * instances, or its data is unrelated, the behavior of this method is
 * undefined. In these cases it may be better to index the <tt>scene</tt>
 * explicitly to specify the exact instance.
 *
 * </ol><p>Property names should follow standard JavaScript method naming
 * conventions, using lowerCamel-style capitalization.
 *
 * <p>In addition to creating the property method, every property is registered
 * in the {@link #properties} array on the <tt>prototype</tt>. Although this
 * array is an instance field, it is considered immutable and shared by all
 * instances of a given mark type. The <tt>properties</tt> array can be queried
 * to see if a mark type defines a particular property, such as width or height.
 *
 * @param {string} name the property name.
 */
pv.Mark.prototype.defineProperty = function(name) {
  if (!this.hasOwnProperty("properties")) {
    this.properties = (this.properties || []).concat();
  }
  this.properties.push(name);
  this[name] = function(v) {
      if (arguments.length) {
        if (this.scene) {
          this.scene[this.index][name] = v;
        } else {
          this["$" + name] = (v instanceof Function) ? v : function() { return v; };
        }
        return this;
      }
      return this.scene[this.index][name];
    };
};

/**
 * The constructor; the mark type. This mark type may define default property
 * functions (see {@link #defaults}) that are used if the property is not
 * overriden by the mark or any of its prototypes.
 *
 * @type function
 */
pv.Mark.prototype.type = pv.Mark;

/**
 * The mark prototype, possibly null, from which to inherit property
 * functions. The mark prototype is not necessarily of the same type as this
 * mark. Any properties defined on this mark will override properties inherited
 * either from the prototype or from the type-specific defaults.
 *
 * @type pv.Mark
 */
pv.Mark.prototype.proto = null;

/**
 * The enclosing parent panel. The parent panel is generally null only for the
 * root panel; however, it is possible to create "offscreen" marks that are used
 * only for inheritance purposes.
 *
 * @type pv.Panel
 */
pv.Mark.prototype.parent = null;

/**
 * The child index. -1 if the enclosing parent panel is null; otherwise, the
 * zero-based index of this mark into the parent panel's <tt>children</tt> array.
 *
 * @type number
 */
pv.Mark.prototype.childIndex = -1;

/**
 * The mark index. The value of this field depends on which instance (i.e.,
 * which element of the data array) is currently being evaluated. During the
 * build phase, the index is incremented over each datum; when handling events,
 * the index is set to the instance that triggered the event.
 *
 * @type number
 */
pv.Mark.prototype.index = -1;

/**
 * The scene graph. The scene graph is an array of objects; each object (or
 * "node") corresponds to an instance of this mark and an element in the data
 * array. The scene graph can be traversed to lookup previously-evaluated
 * properties.
 *
 * <p>For instance, consider a stacked area chart. The bottom property of the
 * area can be defined using the <i>cousin</i> instance, which is the current
 * area instance in the previous instantiation of the parent panel. In this
 * sample code,
 *
 * <pre>new pv.Panel()
 *     .width(150).height(150)
 *   .add(pv.Panel)
 *     .data([[1, 1.2, 1.7, 1.5, 1.7],
 *            [.5, 1, .8, 1.1, 1.3],
 *            [.2, .5, .8, .9, 1]])
 *   .add(pv.Area)
 *     .data(function(d) d)
 *     .bottom(function() {
 *         var c = this.cousin();
 *         return c ? (c.bottom + c.height) : 0;
 *       })
 *     .height(function(d) d * 40)
 *     .left(function() this.index * 35)
 *   .root.render();</pre>
 *
 * the bottom property is computed based on the upper edge of the corresponding
 * datum in the previous series. The area's parent panel is instantiated once
 * per series, so the cousin refers to the previous (below) area mark. (Note
 * that the position of the upper edge is not the same as the top property,
 * which refers to the top margin: the distance from the top edge of the panel
 * to the top edge of the mark.)
 *
 * @see #first
 * @see #last
 * @see #sibling
 * @see #cousin
 */
pv.Mark.prototype.scene = null;

/**
 * The root parent panel. This may be null for "offscreen" marks that are
 * created for inheritance purposes only.
 *
 * @type pv.Panel
 */
pv.Mark.prototype.root = null;

/**
 * The data property; an array of objects. The size of the array determines the
 * number of marks that will be instantiated; each element in the array will be
 * passed to property functions to compute the property values. Typically, the
 * data property is specified as a constant array, such as
 *
 * <pre>m.data([1, 2, 3, 4, 5]);</pre>
 *
 * However, it is perfectly acceptable to define the data property as a
 * function. This function might compute the data dynamically, allowing
 * different data to be used per enclosing panel. For instance, in the stacked
 * area graph example (see {@link #scene}), the data function on the area mark
 * dereferences each series.
 *
 * @type array
 * @name pv.Mark.prototype.data
 */
pv.Mark.prototype.defineProperty("data");

/**
 * The visible property; a boolean determining whether or not the mark instance
 * is visible. If a mark instance is not visible, its other properties will not
 * be evaluated. Similarly, for panels no child marks will be rendered.
 *
 * @type boolean
 * @name pv.Mark.prototype.visible
 */
pv.Mark.prototype.defineProperty("visible");

/**
 * The left margin; the distance, in pixels, between the left edge of the
 * enclosing panel and the left edge of this mark. Note that in some cases this
 * property may be redundant with the right property, or with the conjunction of
 * right and width.
 *
 * @type number
 * @name pv.Mark.prototype.left
 */
pv.Mark.prototype.defineProperty("left");

/**
 * The right margin; the distance, in pixels, between the right edge of the
 * enclosing panel and the right edge of this mark. Note that in some cases this
 * property may be redundant with the left property, or with the conjunction of
 * left and width.
 *
 * @type number
 * @name pv.Mark.prototype.right
 */
pv.Mark.prototype.defineProperty("right");

/**
 * The top margin; the distance, in pixels, between the top edge of the
 * enclosing panel and the top edge of this mark. Note that in some cases this
 * property may be redundant with the bottom property, or with the conjunction
 * of bottom and height.
 *
 * @type number
 * @name pv.Mark.prototype.top
 */
pv.Mark.prototype.defineProperty("top");

/**
 * The bottom margin; the distance, in pixels, between the bottom edge of the
 * enclosing panel and the bottom edge of this mark. Note that in some cases
 * this property may be redundant with the top property, or with the conjunction
 * of top and height.
 *
 * @type number
 * @name pv.Mark.prototype.bottom
 */
pv.Mark.prototype.defineProperty("bottom");

/**
 * The cursor property; corresponds to the CSS cursor property. This is
 * typically used in conjunction with event handlers to indicate interactivity.
 *
 * @type string
 * @name pv.Mark.prototype.cursor
 * @see <a href="http://www.w3.org/TR/CSS2/ui.html#propdef-cursor">CSS2 cursor</a>.
 */
pv.Mark.prototype.defineProperty("cursor");

/**
 * The title property; corresponds to the HTML/SVG title property, allowing the
 * general of simple plain text tooltips.
 *
 * @type string
 * @name pv.Mark.prototype.title
 */
pv.Mark.prototype.defineProperty("title");

/**
 * Default properties for all mark types. By default, the data array is a single
 * null element; if the data property is not specified, this causes each mark to
 * be instantiated as a singleton. The visible property is true by default.
 *
 * @type pv.Mark
 */
pv.Mark.defaults = new pv.Mark()
  .data([null])
  .visible(true);

/**
 * Sets the prototype of this mark to the specified mark. Any properties not
 * defined on this mark may be inherited from the specified prototype mark, or
 * its prototype, and so on. The prototype mark need not be the same type of
 * mark as this mark. (Note that for inheritance to be useful, properties with
 * the same name on different mark types should have equivalent meaning.)
 *
 * @param {pv.Mark} proto the new prototype.
 * @return {pv.Mark} this mark.
 */
pv.Mark.prototype.extend = function(proto) {
  this.proto = proto;
  return this;
};

/**
 * Adds a new mark of the specified type to the enclosing parent panel, whilst
 * simultaneously setting the prototype of the new mark to be this mark.
 *
 * @param {function} type the type of mark to add; a constructor, such as
 * <tt>pv.Bar</tt>.
 * @return {pv.Mark} the new mark.
 */
pv.Mark.prototype.add = function(type) {
  return this.parent.add(type).extend(this);
};

/**
 * Constructs a new mark anchor with default properties.
 *
 * @class Represents an anchor on a given mark. An anchor is itself a mark, but
 * without a visual representation. It serves only to provide useful default
 * properties that can be inherited by other marks. Each type of mark can define
 * any number of named anchors for convenience. If the concrete mark type does
 * not define an anchor implementation specifically, one will be inherited from
 * the mark's parent class.
 *
 * <p>For example, the bar mark provides anchors for its four sides: left,
 * right, top and bottom. Adding a label to the top anchor of a bar,
 *
 * <pre>bar.anchor("top").add(pv.Label);</pre>
 *
 * will render a text label on the top edge of the bar; the top anchor defines
 * the appropriate position properties (top and left), as well as text-rendering
 * properties for convenience (textAlign and textBaseline).
 *
 * @extends pv.Mark
 */
pv.Mark.Anchor = function() {
  pv.Mark.call(this);
};
pv.Mark.Anchor.prototype = pv.extend(pv.Mark);

/**
 * The anchor name. The set of supported anchor names is dependent on the
 * concrete mark type; see the mark type for details. For example, bars support
 * left, right, top and bottom anchors.
 *
 * <p>While anchor names are typically constants, the anchor name is a true
 * property, which means you can specify a function to compute the anchor name
 * dynamically. For instance, if you wanted to alternate top and bottom anchors,
 * saying
 *
 * <pre>m.anchor(function() (this.index % 2) ? "top" : "bottom").add(pv.Dot);</pre>
 *
 * would have the desired effect.
 *
 * @type string
 * @name pv.Mark.Anchor.prototype.name
 */
pv.Mark.Anchor.prototype.defineProperty("name");

/**
 * Returns an anchor with the specified name. While anchor names are typically
 * constants, the anchor name is a true property, which means you can specify a
 * function to compute the anchor name dynamically. See the
 * {@link pv.Mark.Anchor#name} property for details.
 *
 * @param {string} name the anchor name; either a string or a property function.
 * @returns {pv.Mark.Anchor} the new anchor.
 */
pv.Mark.prototype.anchor = function(name) {
  var anchorType = this.type;
  while (!anchorType.Anchor) {
    anchorType = anchorType.defaults.proto.type;
  }
  var anchor = new anchorType.Anchor().extend(this).name(name);
  anchor.parent = this.parent;
  anchor.type = this.type;
  return anchor;
};

/**
 * Returns the anchor target of this mark, if it is derived from an anchor;
 * otherwise returns null. For example, if a label is derived from a bar anchor,
 *
 * <pre>bar.anchor("top").add(pv.Label);</pre>
 *
 * then property functions on the label can refer to the bar via the
 * <tt>anchorTarget</tt> method. This method is also useful for mark types
 * defining properties on custom anchors.
 *
 * @returns {pv.Mark} the anchor target of this mark; possibly null.
 */
pv.Mark.prototype.anchorTarget = function() {
  var target = this;
  while (!(target instanceof pv.Mark.Anchor)) {
    target = target.proto;
    if (!target) return null;
  }
  return target.proto;
};

/**
 * Returns the first instance of this mark in the scene graph. This method can
 * only be called when the mark is bound to the scene graph (for example, from
 * an event handler, or within a property function).
 *
 * @returns a node in the scene graph.
 */
pv.Mark.prototype.first = function() {
  return this.scene[0];
};

/**
 * Returns the last instance of this mark in the scene graph. This method can
 * only be called when the mark is bound to the scene graph (for example, from
 * an event handler, or within a property function). In addition, note that mark
 * instances are built sequentially, so the last instance of this mark may not
 * yet be constructed.
 *
 * @returns a node in the scene graph.
 */
pv.Mark.prototype.last = function() {
  return this.scene[this.scene.length - 1];
};

/**
 * Returns the previous instance of this mark in the scene graph, or null if
 * this is the first instance.
 *
 * @returns a node in the scene graph, or null.
 */
pv.Mark.prototype.sibling = function() {
  return (this.index == 0) ? null : this.scene[this.index - 1];
};

/**
 * Returns the current instance in the scene graph of this mark, in the previous
 * instance of the enclsoing parent panel. May return null if this instance
 * could not be found.
 *
 * @returns a node in the scene graph, or null.
 */
pv.Mark.prototype.cousin = function() {
  var p = this.parent, s = p && p.sibling();
  return (s && s.children) ? s.children[this.childIndex][this.index] : null;
};

/**
 * Renders this mark, including recursively rendering all child marks if this is
 * a panel. Rendering consists of two phases: <b>build</b> and <b>update</b>. In
 * the future, the update phase could conceivably be decoupled to allow
 * different rendering engines. Similarly, future work is needed to allow
 * dynamic rebuilding based on interaction. (For example, dynamic expansion of a
 * tree visualization.)
 *
 * <p>In the build phase (see {@link #build}), all properties are evaluated, and
 * the scene graph is generated. However, nothing is rendered.
 *
 * <p>In the update phase (see {@link #update}), the mark is rendered by
 * creating and updating elements and attributes in the SVG image. No properties
 * are evaluated during the update phase; instead the values computed previously
 * in the build phase are simply translated into SVG.
 */
pv.Mark.prototype.render = function() {
  this.build();
  this.update();
};

/**
 * Evaluates properties and computes implied properties. Properties are stored
 * in the {@link #scene} array for each instance of this mark.
 *
 * <p>As marks are built recursively, the {@link #index} property is updated to
 * match the current index into the data array for each mark. Note that the
 * index property is only set for the mark currently being built and its
 * enclosing parent panels. The index property for other marks is unset, but is
 * inherited from the global <tt>Mark</tt> class prototype. This allows mark
 * properties to refer to properties on other marks <i>in the same panel</i>
 * conveniently; however, in general it is better to reference mark instances
 * specifically through the scene graph rather than depending on the magical
 * behavior of {@link #index}.
 *
 * <p>The root scene array has a special property, <tt>data</tt>, which stores
 * the current data stack. The first element in this stack is the current datum,
 * followed by the datum of the enclosing parent panel, and so on. The data
 * stack should not be accessed directly; instead, property functions are passed
 * the current data stack as arguments.
 *
 * <p>The evaluation of the <tt>data</tt> and <tt>visible</tt> properties is
 * special. The <tt>data</tt> property is evaluated first; unlike the other
 * properties, the data stack is from the parent panel, rather than the current
 * mark, since the data is not defined until the data property is evaluated.
 * The <tt>visisble</tt> property is subsequently evaluated for each instance;
 * only if true will the {@link #buildInstance} method be called, evaluating
 * other properties and recursively building the scene graph.
 *
 * <p>If this mark is being re-built, any old instances of this mark that no
 * longer exist (because the new data array contains fewer elements) will be
 * cleared using {@link #clearInstance}.
 *
 * @param parent the instance of the parent panel from the scene graph.
 */
pv.Mark.prototype.build = function(parent) {
  if (!this.scene) {
    this.scene = [];
    if (!this.parent) {
      this.scene.data = [];
    }
  }

  var data = this.get("data");
  var stack = this.root.scene.data;
  stack.unshift(null);
  this.index = -1;

  this.$$data = data; // XXX

  for (var i = 0, d; i < data.length; i++) {
    pv.Mark.prototype.index = ++this.index;
    var s = {};

    /*
     * This is a bit confusing and could be cleaned up. This "scene" stores the
     * previous scene graph; we want to reuse SVG elements that were created
     * previously rather than recreating them, so we extract them. We also want
     * to reuse SVG child elements as well.
     */
    if (this.scene[this.index]) {
      s.svg = this.scene[this.index].svg;
      s.children = this.scene[this.index].children;
    }
    this.scene[this.index] = s;

    s.index = i;
    s.data = stack[0] = data[i];
    s.parent = parent;
    s.visible = this.get("visible");
    if (s.visible) {
      this.buildInstance(s);
    }
  }
  stack.shift();
  delete this.index;
  pv.Mark.prototype.index = -1;

  /* Clear any old instances from the scene. */
  for (var i = data.length; i < this.scene.length; i++) {
    this.clearInstance(this.scene[i]);
  }
  this.scene.length = data.length;

  return this;
};

/**
 * Removes the specified mark instance from the SVG image. This method depends
 * on the <tt>svg</tt> property of the scene graph node. If the specified mark
 * instance was not present in the SVG image (for example, because it was not
 * visible), this method has no effect.
 *
 * @param s a node in the scene graph; the instance of the mark to clear.
 */
pv.Mark.prototype.clearInstance = function(s) {
  if (s.svg) {
    s.parent.svg.removeChild(s.svg);
  }
};

/**
 * Evaluates all of the properties for this mark for the specified instance
 * <tt>s</tt> in the scene graph. The set of properties to evaluate is retrieved
 * from the {@link #properties} array for this mark type (see {@link #type}).
 * After these properties are evaluated, any <b>implied</b> properties may be
 * computed by the mark and set on the scene graph; see {@link #buildImplied}.
 *
 * <p>For panels, this method recursively builds the scene graph for all child
 * marks as well. In general, this method should not need to be overridden by
 * concrete mark types.
 *
 * @param s a node in the scene graph; the instance of the mark to build.
 */
pv.Mark.prototype.buildInstance = function(s) {
  var p = this.type.prototype;
  for (var i = 0; i < p.properties.length; i++) {
    var name = p.properties[i];
    if (!(name in s)) {
      s[name] = this.get(name);
    }
  }
  this.buildImplied(s);
};

/**
 * Computes the implied properties for this mark for the specified instance
 * <tt>s</tt> in the scene graph. Implied properties are those with dependencies
 * on multiple other properties; for example, the width property may be implied
 * if the left and right properties are set. This method can be overridden by
 * concrete mark types to define new implied properties, if necessary.
 *
 * <p>The default implementation computes the implied CSS box model properties.
 * The prioritization of redundant properties is as follows:<ol>
 *
 * <li>If the <tt>width</tt> property is not specified (i.e., null), its value is
 * the width of the parent panel, minus this mark's left and right margins; the
 * left and right margins are zero if not specified.
 *
 * <li>Otherwise, if the <tt>right</tt> margin is not specified, its value is the
 * width of the parent panel, minus this mark's width and left margin; the left
 * margin is zero if not specified.
 *
 * <li>Otherwise, if the <tt>left</tt> property is not specified, its value is
 * the width of the parent panel, minus this mark's width and the right margin.
 *
 * </ol>This prioritization is then duplicated for the <tt>height</tt>,
 * <tt>bottom</tt> and <tt>top</tt> properties, respectively.
 *
 * @param s a node in the scene graph; the instance of the mark to build.
 */
pv.Mark.prototype.buildImplied = function(s) {
  var l = s.left;
  var r = s.right;
  var t = s.top;
  var b = s.bottom;

  /* Assume width and height are zero if not supported by this mark type. */
  var p = this.type.prototype;
  var w = p.width ? s.width : 0;
  var h = p.height ? s.height : 0;

  /* Compute implied width, right and left. */
  var width = s.parent ? s.parent.width : 0;
  if (w == null) {
    w = width - (r = r || 0) - (l = l || 0);
  } else if (r == null) {
    r = width - w - (l = l || 0);
  } else if (l == null) {
    l = width - w - (r = r || 0);
  }

  /* Compute implied height, bottom and top. */
  var height = s.parent ? s.parent.height : 0;
  if (h == null) {
    h = height - (t = t || 0) - (b = b || 0);
  } else if (b == null) {
    b = height - h - (t = t || 0);
  } else if (t == null) {
    t = height - h - (b = b || 0);
  }

  s.left = l;
  s.right = r;
  s.top = t;
  s.bottom = b;

  /* Only set width and height if they are supported by this mark type. */
  if (p.width) s.width = w;
  if (p.height) s.height = h;
};

var property; // XXX

/**
 * Evaluates the property function with the specified name for the current data
 * stack. The data stack, <tt>this.root.scene.data</tt>, contains the current
 * datum, followed by the datum for the enclosing panel, and so on.
 *
 * <p>This method first finds the implementing property function by querying the
 * current mark. If the current mark does not define the property function, the
 * prototype mark is queried, and so on. If none of the mark prototypes define a
 * property function with the given name, the type default function is used. If
 * no default function is provided, this method returns null.
 *
 * <p>The context of the property function is <tt>this</tt> instance (i.e., the
 * leaf-level mark), rather than whatever mark defined the property function.
 * Because of this behavior, a property function may be called on an object of a
 * different "class" (e.g., a Dot inheriting the fill style from a Line). Also
 * note that properties are not inherited statically; inheritance happens at the
 * property function / mark level, not per property value / mark instance. Thus,
 * even if a Dot extends from a Line, if the Line's fill style is defined using
 * a function that generates a random color, the Dot may get a different color.
 *
 * @param {string} name the property name.
 * @returns the evaluated property value.
 */
pv.Mark.prototype.get = function(name) {
  var mark = this;
  while (!mark["$" + name]) {
    mark = mark.proto;
    if (!mark) {
      mark = this.type.defaults;
      while (!mark["$" + name]) {
        mark = mark.proto;
        if (!mark) {
          return null;
        }
      }
      break;
    }
  }
  property = name; // XXX
  return mark["$" + name].apply(this, this.root.scene.data);
};

/**
 * Updates the display, propagating property values computed in the build phase
 * to the SVG image. This method is typically invoked by {@link #render}, but is
 * also invoked after an event handler is triggered to update the display of a
 * specific mark.
 *
 * @see #event
 */
pv.Mark.prototype.update = function() {
  for (var i = 0; i < this.scene.length; i++) {
    this.updateInstance(this.scene[i]);
  }
};

/**
 * Updates the display for the specified mark instance <tt>s</tt> in the scene
 * graph. This implementation handles basic properties for all mark types, such
 * as visibility, cursor and title tooltip. Concrete mark types should override
 * this method to specify how marks are rendered.
 *
 * @param s a node in the scene graph; the instance of the mark to update.
 */
pv.Mark.prototype.updateInstance = function(s) {
  var that = this, v = s.svg;

  /* visible */
  if (!s.visible) {
    if (v) v.setAttribute("display", "none");
    return;
  }
  v.removeAttribute("display");

  /* cursor */
  if (s.cursor) v.style.cursor = s.cursor;

  /* title (Safari only supports xlink:title on anchor elements) */
  var p = v.parentNode;
  if (s.title) {
    if (!v.$title) {
      v.$title = document.createElementNS(pv.ns.svg, "a");
      p.insertBefore(v.$title, v);
      v.$title.appendChild(v);
    }
    v.$title.setAttributeNS(pv.ns.xlink, "title", s.title);
  } else if (v.$title) {
    p.insertBefore(v, v.$title);
    p.removeChild(v.$title);
    delete v.$title;
  }

  /* event */
  function dispatch(type) {
    return function(e) {
        /* TODO set full scene stack. */
        var data = [s.data], p = s;
        while (p = p.parent) {
          data.push(p.data);
        }
        that.index = s.index;
        that.scene = s.parent.children[that.childIndex];
        that.events[type].apply(that, data);
        that.updateInstance(s); // XXX updateInstance, bah!
        delete that.index;
        delete that.scene;
        e.preventDefault();
      };
  };

  /* TODO inherit event handlers. */
  for (var type in this.events) {
    v["on" + type] = dispatch(type);
  }
};

/**
 * Registers an event handler for the specified event type with this mark. When
 * an event of the specified type is triggered, the specified handler will be
 * invoked. The handler is invoked in a similar method to property functions:
 * the context is <tt>this</tt> mark instance, and the arguments are the full
 * data stack. Event handlers can use property methods to manipulate the display
 * properties of the mark:
 *
 * <pre>m.event("click", function() this.fillStyle("red"));</pre>
 *
 * Alternatively, the external data can be manipulated and the visualization
 * redrawn:
 *
 * <pre>m.event("click", function(d) {
 *     data = all.filter(function(k) k.name == d);
 *     vis.render();
 *   });</pre>
 *
 * TODO In the current event handler implementation, only the mark instance that
 * triggered the event is updated, even if the event handler dirties the rest of
 * the scene. While this can be ameliorated by explicitly re-rendering, it would
 * be better and more efficient for the event dispatcher to handle dirtying and
 * redraw automatically.
 *
 * <p>The complete set of event types is defined by SVG; see the reference
 * below. The set of supported event types is:<ul>
 *
 * <li>click
 * <li>mousedown
 * <li>mouseup
 * <li>mouseover
 * <li>mousemove
 * <li>mouseout
 *
 * </ul>Since Protovis does not specify any concept of focus, it does not
 * support key events; these should be handled outside the visualization using
 * standard JavaScript. In the future, support for interaction may be extended
 * to support additional event types, particularly those most relevant to
 * interactive visualization, such as selection.
 *
 * <p>TODO In the current implementation, event handlers are not inherited from
 * prototype marks. They must be defined explicitly on each interactive mark. In
 * addition, only one event handler for a given event type can be defined; when
 * specifying multiple event handlers for the same type, only the last one will
 * be used.
 *
 * @see <a href="http://www.w3.org/TR/SVGTiny12/interact.html#SVGEvents">SVG events</a>.
 * @param {string} type the event type.
 * @param {function} handler the event handler.
 * @returns {pv.Mark} this.
 */
pv.Mark.prototype.event = function(type, handler) {
  if (!this.events) this.events = {};
  this.events[type] = handler;
  return this;
};
/**
 * Constructs a new area mark with default properties. Areas are not typically
 * constructed directly, but by adding to a panel or an existing mark via
 * {@link pv.Mark#add}.
 *
 * @class Represents an area mark: the solid area between two series of
 * connected line segments. Unsurprisingly, areas are used most frequently for
 * area charts.
 *
 * <p>Just as a line represents a polyline, the <tt>Area</tt> mark type
 * represents a <i>polygon</i>. However, an area is not an arbitrary polygon;
 * vertices are paired either horizontally or vertically into parallel
 * <i>spans</i>, and each span corresponds to an associated datum. Either the
 * width or the height must be specified, but not both; this determines whether
 * the area is horizontally-oriented or vertically-oriented.  Like lines, areas
 * can be stroked and filled with arbitrary colors.
 *
 * <p>See also the <a href="../../api/Area.html">Area guide</a>.
 *
 * @extends pv.Mark
 */
pv.Area = function() {
  pv.Mark.call(this);
};
pv.Area.prototype = pv.extend(pv.Mark);
pv.Area.prototype.type = pv.Area;

/**
 * Returns "area".
 *
 * @returns {string} "area".
 */
pv.Area.toString = function() { return "area"; };

/**
 * The width of a given span, in pixels; used for horizontal spans. If the width
 * is specified, the height property should be 0 (the default). Either the top
 * or bottom property should be used to space the spans vertically, typically as
 * a multiple of the index.
 *
 * @type number
 * @name pv.Area.prototype.width
 */
pv.Area.prototype.defineProperty("width");

/**
 * The height of a given span, in pixels; used for vertical spans. If the height
 * is specified, the width property should be 0 (the default). Either the left
 * or right property should be used to space the spans horizontally, typically
 * as a multiple of the index.
 *
 * @type number
 * @name pv.Area.prototype.height
 */
pv.Area.prototype.defineProperty("height");

/**
 * The width of stroked lines, in pixels; used in conjunction with
 * <tt>strokeStyle</tt> to stroke the perimeter of the area. Unlike the
 * {@link Line} mark type, the entire perimeter is stroked, rather than just one
 * edge. The default value of this property is 1.5, but since the default stroke
 * style is null, area marks are not stroked by default.
 *
 * <p>This property is <i>fixed</i>. See {@link pv.Mark}.
 *
 * @type number
 * @name pv.Area.prototype.lineWidth
 */
pv.Area.prototype.defineProperty("lineWidth");

/**
 * The style of stroked lines; used in conjunction with <tt>lineWidth</tt> to
 * stroke the perimeter of the area. Unlike the {@link Line} mark type, the
 * entire perimeter is stroked, rather than just one edge. The default value of
 * this property is null, meaning areas are not stroked by default.
 *
 * <p>This property is <i>fixed</i>. See {@link pv.Mark}.
 *
 * @type string
 * @name pv.Area.prototype.strokeStyle
 * @see pv.color
 */
pv.Area.prototype.defineProperty("strokeStyle");

/**
 * The area fill style; if non-null, the interior of the polygon forming the
 * area is filled with the specified color. The default value of this property
 * is a categorical color.
 *
 * <p>This property is <i>fixed</i>. See {@link pv.Mark}.
 *
 * @type string
 * @name pv.Area.prototype.fillStyle
 * @see pv.color
 */
pv.Area.prototype.defineProperty("fillStyle");

/**
 * Default properties for areas. By default, there is no stroke and the fill
 * style is a categorical color.
 *
 * @type pv.Area
 */
pv.Area.defaults = new pv.Area().extend(pv.Mark.defaults)
    .lineWidth(1.5)
    .fillStyle(pv.Colors.category20);

/**
 * Constructs a new area anchor with default properties.
 *
 * @class Represents an anchor for an area mark. Areas support five different
 * anchors:<ul>
 *
 * <li>top
 * <li>left
 * <li>center
 * <li>bottom
 * <li>right
 *
 * </ul>In addition to positioning properties (left, right, top bottom), the
 * anchors support text rendering properties (text-align, text-baseline). Text is
 * rendered to appear inside the area polygon.
 *
 * <p>To facilitate stacking of areas, the anchors are defined in terms of their
 * opposite edge. For example, the top anchor defines the bottom property, such
 * that the area grows upwards; the bottom anchor instead defines the top
 * property, such that the area grows downwards. Of course, in general it is
 * more robust to use panels and the cousin accessor to define stacked area
 * marks; see {@link pv.Mark#scene} for an example.
 *
 * @extends pv.Mark.Anchor
 */
pv.Area.Anchor = function() {
  pv.Mark.Anchor.call(this);
};
pv.Area.Anchor.prototype = pv.extend(pv.Mark.Anchor);
pv.Area.Anchor.prototype.type = pv.Area;

/**
 * The left property; null for "left" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Area.Anchor.prototype.left
 */ /** @private */
pv.Area.Anchor.prototype.$left = function() {
  var area = this.anchorTarget();
  switch (this.get("name")) {
    case "bottom":
    case "top":
    case "center": return area.left() + area.width() / 2;
    case "right": return area.left() + area.width();
  }
  return null;
};

/**
 * The right property; null for "right" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Area.Anchor.prototype.right
 */ /** @private */
pv.Area.Anchor.prototype.$right = function() {
  var area = this.anchorTarget();
  switch (this.get("name")) {
    case "bottom":
    case "top":
    case "center": return area.right() + area.width() / 2;
    case "left": return area.right() + area.width();
  }
  return null;
};

/**
 * The top property; null for "top" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Area.Anchor.prototype.top
 */ /** @private */
pv.Area.Anchor.prototype.$top = function() {
  var area = this.anchorTarget();
  switch (this.get("name")) {
    case "left":
    case "right":
    case "center": return area.top() + area.height() / 2;
    case "bottom": return area.top() + area.height();
  }
  return null;
};

/**
 * The bottom property; null for "bottom" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Area.Anchor.prototype.bottom
 */ /** @private */
pv.Area.Anchor.prototype.$bottom = function() {
  var area = this.anchorTarget();
  switch (this.get("name")) {
    case "left":
    case "right":
    case "center": return area.bottom() + area.height() / 2;
    case "top": return area.bottom() + area.height();
  }
  return null;
};

/**
 * The text-align property, for horizontal alignment inside the area.
 *
 * @type string
 * @name pv.Area.Anchor.prototype.textAlign
 */ /** @private */
pv.Area.Anchor.prototype.$textAlign = function() {
  switch (this.get("name")) {
    case "left": return "left";
    case "bottom":
    case "top":
    case "center": return "center";
    case "right": return "right";
  }
  return null;
};

/**
 * The text-baseline property, for vertical alignment inside the area.
 *
 * @type string
 * @name pv.Area.Anchor.prototype.textBasline
 */ /** @private */
pv.Area.Anchor.prototype.$textBaseline = function() {
  switch (this.get("name")) {
    case "right":
    case "left":
    case "center": return "middle";
    case "top": return "top";
    case "bottom": return "bottom";
  }
  return null;
};

/**
 * Overrides the default behavior of {@link pv.Mark#buildImplied} such that the
 * width and height are set to zero if null.
 *
 * @param s a node in the scene graph; the instance of the mark to build.
 */
pv.Area.prototype.buildImplied = function(s) {
  if (s.height == null) s.height = 0;
  if (s.width == null) s.width = 0;
  pv.Mark.prototype.buildImplied.call(this, s);
};

/**
 * Override the default update implementation, since the area mark generates a
 * single graphical element rather than multiple distinct elements.
 */
pv.Area.prototype.update = function() {
  if (!this.scene.length) return;

  var s = this.scene[0], v = s.svg;
  if (s.visible) {

    /* Create the <svg:polygon> element, if necesary. */
    if (!v) {
      v = s.svg = document.createElementNS(pv.ns.svg, "polygon");
      s.parent.svg.appendChild(v);
    }

    /* points */
    var p = "";
    for (var i = 0; i < this.scene.length; i++) {
      var si = this.scene[i];
      p += si.left + "," + si.top + " ";
    }
    for (var i = this.scene.length - 1; i >= 0; i--) {
      var si = this.scene[i];
      p += (si.left + si.width) + "," + (si.top + si.height) + " ";
    }
    v.setAttribute("points", p);
  }

  this.updateInstance(s);
};

/**
 * Updates the display for the (singleton) area instance. The area mark
 * generates a single graphical element rather than multiple distinct elements.
 *
 * <p>TODO Recompute points? For efficiency, the points (the span positions) are
 * not recomputed, and therefore cannot be updated automatically from event
 * handlers without an explicit call to rebuild the area.
 *
 * @param s a node in the scene graph; the area to update.
 */
pv.Area.prototype.updateInstance = function(s) {
  var v = s.svg;

  pv.Mark.prototype.updateInstance.call(this, s);
  if (!s.visible) return;

  /* fill, stroke TODO gradient, patterns */
  var fill = pv.color(s.fillStyle);
  v.setAttribute("fill", fill.color);
  v.setAttribute("fill-opacity", fill.opacity);
  var stroke = pv.color(s.strokeStyle);
  v.setAttribute("stroke", stroke.color);
  v.setAttribute("stroke-opacity", stroke.opacity);
  v.setAttribute("stroke-width", s.lineWidth);
};
/**
 * Constructs a new bar mark with default properties. Bars are not typically
 * constructed directly, but by adding to a panel or an existing mark via
 * {@link pv.Mark#add}.
 *
 * @class Represents a bar: an axis-aligned rectangle that can be stroked and
 * filled. Bars are used for many chart types, including bar charts, histograms
 * and Gantt charts. Bars can also be used as decorations, for example to draw a
 * frame border around a panel; in fact, a panel is a special type (a subclass)
 * of bar.
 *
 * <p>Bars can be positioned in several ways. Most commonly, one of the four
 * corners is fixed using two margins, and then the width and height properties
 * determine the extent of the bar relative to this fixed location. For example,
 * using the bottom and left properties fixes the bottom-left corner; the width
 * then extends to the right, while the height extends to the top. As an
 * alternative to the four corners, a bar can be positioned exclusively using
 * margins; this is convenient as an inset from the containing panel, for
 * example. See {@link pv.Mark#buildImplied} for details on the prioritization
 * of redundant positioning properties.
 *
 * <p>See also the <a href="../../api/Bar.html">Bar guide</a>.
 *
 * @extends pv.Mark
 */
pv.Bar = function() {
  pv.Mark.call(this);
};
pv.Bar.prototype = pv.extend(pv.Mark);
pv.Bar.prototype.type = pv.Bar;

/**
 * Returns "bar".
 *
 * @returns {string} "bar".
 */
pv.Bar.toString = function() { return "bar"; };

/**
 * The width of the bar, in pixels. If the left position is specified, the bar
 * extends rightward from the left edge; if the right position is specified, the
 * bar extends leftward from the right edge.
 *
 * @type number
 * @name pv.Bar.prototype.width
 */
pv.Bar.prototype.defineProperty("width");

/**
 * The height of the bar, in pixels. If the bottom position is specified, the
 * bar extends upward from the bottom edge; if the top position is specified,
 * the bar extends downward from the top edge.
 *
 * @type number
 * @name pv.Bar.prototype.height
 */
pv.Bar.prototype.defineProperty("height");

/**
 * The width of stroked lines, in pixels; used in conjunction with
 * <tt>strokeStyle</tt> to stroke the bar's border.
 *
 * @type number
 * @name pv.Bar.prototype.lineWidth
 */
pv.Bar.prototype.defineProperty("lineWidth");

/**
 * The style of stroked lines; used in conjunction with <tt>lineWidth</tt> to
 * stroke the bar's border. The default value of this property is null, meaning
 * bars are not stroked by default.
 *
 * @type string
 * @name pv.Bar.prototype.strokeStyle
 * @see pv.color
 */
pv.Bar.prototype.defineProperty("strokeStyle");

/**
 * The bar fill style; if non-null, the interior of the bar is filled with the
 * specified color. The default value of this property is a categorical color.
 *
 * @type string
 * @name pv.Bar.prototype.fillStyle
 * @see pv.color
 */
pv.Bar.prototype.defineProperty("fillStyle");

/**
 * Default properties for bars. By default, there is no stroke and the fill
 * style is a categorical color.
 *
 * @type pv.Bar
 */
pv.Bar.defaults = new pv.Bar().extend(pv.Mark.defaults)
    .lineWidth(1.5)
    .fillStyle(pv.Colors.category20);

/**
 * Constructs a new bar anchor with default properties.
 *
 * @class Represents an anchor for a bar mark. Bars support five different
 * anchors:<ul>
 *
 * <li>top
 * <li>left
 * <li>center
 * <li>bottom
 * <li>right
 *
 * </ul>In addition to positioning properties (left, right, top bottom), the
 * anchors support text rendering properties (text-align, text-baseline). Text
 * is rendered to appear inside the bar.
 *
 * <p>To facilitate stacking of bars, the anchors are defined in terms of their
 * opposite edge. For example, the top anchor defines the bottom property, such
 * that the bar grows upwards; the bottom anchor instead defines the top
 * property, such that the bar grows downwards. Of course, in general it is more
 * robust to use panels and the cousin accessor to define stacked bars; see
 * {@link pv.Mark#scene} for an example.
 *
 * <p>Bar anchors also "smartly" specify position properties based on whether
 * the derived mark type supports the width and height properties. If the
 * derived mark type does not support these properties (e.g., dots), the
 * position will be centered on the corresponding edge. Otherwise (e.g., bars),
 * the position will be in the opposite side.
 *
 * @extends pv.Mark.Anchor
 */
pv.Bar.Anchor = function() {
  pv.Mark.Anchor.call(this);
};
pv.Bar.Anchor.prototype = pv.extend(pv.Mark.Anchor);
pv.Bar.Anchor.prototype.type = pv.Bar;

/**
 * The left property; null for "left" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Bar.Anchor.prototype.left
 */ /** @private */
pv.Bar.Anchor.prototype.$left = function() {
  var bar = this.anchorTarget();
  switch (this.get("name")) {
    case "bottom":
    case "top":
    case "center": return bar.left() + (this.type.prototype.width ? 0 : (bar.width() / 2));
    case "right": return bar.left() + bar.width();
  }
  return null;
};

/**
 * The right property; null for "right" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Bar.Anchor.prototype.right
 */ /** @private */
pv.Bar.Anchor.prototype.$right = function() {
  var bar = this.anchorTarget();
  switch (this.get("name")) {
    case "bottom":
    case "top":
    case "center": return bar.right() + (this.type.prototype.width ? 0 : (bar.width() / 2));
    case "left": return bar.right() + bar.width();
  }
  return null;
};

/**
 * The top property; null for "top" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Bar.Anchor.prototype.top
 */ /** @private */
pv.Bar.Anchor.prototype.$top = function() {
  var bar = this.anchorTarget();
  switch (this.get("name")) {
    case "left":
    case "right":
    case "center": return bar.top() + (this.type.prototype.height ? 0 : (bar.height() / 2));
    case "bottom": return bar.top() + bar.height();
  }
  return null;
};

/**
 * The bottom property; null for "bottom" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Bar.Anchor.prototype.bottom
 */ /** @private */
pv.Bar.Anchor.prototype.$bottom = function() {
  var bar = this.anchorTarget();
  switch (this.get("name")) {
    case "left":
    case "right":
    case "center": return bar.bottom() + (this.type.prototype.height ? 0 : (bar.height() / 2));
    case "top": return bar.bottom() + bar.height();
  }
  return null;
};

/**
 * The text-align property, for horizontal alignment inside the bar.
 *
 * @type string
 * @name pv.Bar.Anchor.prototype.textAlign
 */ /** @private */
pv.Bar.Anchor.prototype.$textAlign = function() {
  switch (this.get("name")) {
    case "left": return "left";
    case "bottom":
    case "top":
    case "center": return "center";
    case "right": return "right";
  }
  return null;
};

/**
 * The text-baseline property, for vertical alignment inside the bar.
 *
 * @type string
 * @name pv.Bar.Anchor.prototype.textBaseline
 */ /** @private */
pv.Bar.Anchor.prototype.$textBaseline = function() {
  switch (this.get("name")) {
    case "right":
    case "left":
    case "center": return "middle";
    case "top": return "top";
    case "bottom": return "bottom";
  }
  return null;
};

/**
 * Updates the display for the specified bar instance <tt>s</tt> in the scene
 * graph. This implementation handles the fill and stroke style for the bar, as
 * well as positional properties.
 *
 * @param s a node in the scene graph; the instance of the bar to update.
 */
pv.Bar.prototype.updateInstance = function(s) {
  var v = s.svg;
  if (s.visible && !v) {
    v = s.svg = document.createElementNS(pv.ns.svg, "rect");
    s.parent.svg.appendChild(v);
  }

  pv.Mark.prototype.updateInstance.call(this, s);
  if (!s.visible) return;

  /* left, top */
  v.setAttribute("x", s.left);
  v.setAttribute("y", s.top);

  /* If width and height are exactly zero, the rect is not stroked! */
  v.setAttribute("width", Math.max(1E-10, s.width));
  v.setAttribute("height", Math.max(1E-10, s.height));

  /* fill, stroke TODO gradient, patterns */
  var fill = pv.color(s.fillStyle);
  v.setAttribute("fill", fill.color);
  v.setAttribute("fill-opacity", fill.opacity);
  var stroke = pv.color(s.strokeStyle);
  v.setAttribute("stroke", stroke.color);
  v.setAttribute("stroke-opacity", stroke.opacity);
  v.setAttribute("stroke-width", s.lineWidth);
};
/**
 * Constructs a new dot mark with default properties. Dots are not typically
 * constructed directly, but by adding to a panel or an existing mark via
 * {@link pv.Mark#add}.
 *
 * @class Represents a dot; a dot is simply a sized glyph centered at a given
 * point that can also be stroked and filled. The <tt>size</tt> property is
 * proportional to the area of the rendered glyph to encourage meaningful visual
 * encodings. Dots can visually encode up to eight dimensions of data, though
 * this may be unwise due to integrality. See {@link pv.Mark#buildImplied} for
 * details on the prioritization of redundant positioning properties.
 *
 * <p>See also the <a href="../../api/Dot.html">Dot guide</a>.
 *
 * @extends pv.Mark
 */
pv.Dot = function() {
  pv.Mark.call(this);
};
pv.Dot.prototype = pv.extend(pv.Mark);
pv.Dot.prototype.type = pv.Dot;

/**
 * Returns "dot".
 *
 * @returns {string} "dot".
 */
pv.Dot.toString = function() { return "dot"; };

/**
 * The size of the dot, in square pixels. Square pixels are used such that the
 * area of the dot is linearly proportional to the value of the size property,
 * facilitating representative encodings.
 *
 * @see #radius
 * @type number
 * @name pv.Dot.prototype.size
 */
pv.Dot.prototype.defineProperty("size");

/**
 * The shape name. Several shapes are supported:<ul>
 *
 * <li>cross
 * <li>triangle
 * <li>diamond
 * <li>square
 * <li>tick
 * <li>circle
 *
 * </ul>These shapes can be further changed using the {@link #angle} property;
 * for instance, a cross can be turned into a plus by rotating. Similarly, the
 * tick, which is vertical by default, can be rotated horizontally. Note that
 * some shapes (cross and tick) do not have interior areas, and thus do not
 * support fill style meaningfully.
 *
 * <p>TODO It's probably better to use the Rule mark type rather than a
 * tick-shaped Dot. However, the Rule mark doesn't support the width and height
 * properties, so it's a bit clumsy to use. It should be possible to add support
 * for width and height to rule, and then remove the tick shape.
 *
 * @type string
 * @name pv.Dot.prototype.shape
 */
pv.Dot.prototype.defineProperty("shape");

/**
 * The rotation angle, in radians. Used to rotate shapes, such as to turn a
 * cross into a plus.
 *
 * @type number
 * @name pv.Dot.prototype.angle
 */
pv.Dot.prototype.defineProperty("angle");

/**
 * The width of stroked lines, in pixels; used in conjunction with
 * <tt>strokeStyle</tt> to stroke the dot's shape.
 *
 * @type number
 * @name pv.Dot.prototype.lineWidth
 */
pv.Dot.prototype.defineProperty("lineWidth");

/**
 * The style of stroked lines; used in conjunction with <tt>lineWidth</tt> to
 * stroke the dot's shape. The default value of this property is a categorical
 * color.
 *
 * @type string
 * @name pv.Dot.prototype.strokeStyle
 * @see pv.color
 */
pv.Dot.prototype.defineProperty("strokeStyle");

/**
 * The fill style; if non-null, the interior of the dot is filled with the
 * specified color. The default value of this property is null, meaning dots are
 * not filled by default.
 *
 * @type string
 * @name pv.Dot.prototype.fillStyle
 * @see pv.color
 */
pv.Dot.prototype.defineProperty("fillStyle");

/**
 * Default properties for dots. By default, there is no fill and the stroke
 * style is a categorical color. The default shape is "circle" with size 20.
 *
 * @type pv.Dot
 */
pv.Dot.defaults = new pv.Dot().extend(pv.Mark.defaults)
    .size(20)
    .shape("circle")
    .lineWidth(1.5)
    .strokeStyle(pv.Colors.category10);

/**
 * Constructs a new dot anchor with default properties.
 *
 * @class Represents an anchor for a dot mark. Dots support five different
 * anchors:<ul>
 *
 * <li>top
 * <li>left
 * <li>center
 * <li>bottom
 * <li>right
 *
 * </ul>In addition to positioning properties (left, right, top bottom), the
 * anchors support text rendering properties (text-align, text-baseline). Text is
 * rendered to appear outside the dot. Note that this behavior is different from
 * other mark anchors, which default to rendering text <i>inside</i> the mark.
 *
 * <p>For consistency with the other mark types, the anchor positions are
 * defined in terms of their opposite edge. For example, the top anchor defines
 * the bottom property, such that a bar added to the top anchor grows upward.
 *
 * @extends pv.Mark.Anchor
 */
pv.Dot.Anchor = function() {
  pv.Mark.Anchor.call(this);
};
pv.Dot.Anchor.prototype = pv.extend(pv.Mark.Anchor);
pv.Dot.Anchor.prototype.type = pv.Dot;

/**
 * The left property; null for "left" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Dot.Anchor.prototype.left
 */ /** @private */
pv.Dot.Anchor.prototype.$left = function(d) {
  var dot = this.anchorTarget();
  switch (this.get("name")) {
    case "bottom":
    case "top":
    case "center": return dot.left();
    case "right": return dot.left() + dot.radius();
  }
  return null;
};

/**
 * The right property; null for "right" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Dot.Anchor.prototype.right
 */ /** @private */
pv.Dot.Anchor.prototype.$right = function(d) {
  var dot = this.anchorTarget();
  switch (this.get("name")) {
    case "bottom":
    case "top":
    case "center": return dot.right();
    case "left": return dot.right() + dot.radius();
  }
  return null;
};

/**
 * The top property; null for "top" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Dot.Anchor.prototype.top
 */ /** @private */
pv.Dot.Anchor.prototype.$top = function(d) {
  var dot = this.anchorTarget();
  switch (this.get("name")) {
    case "left":
    case "right":
    case "center": return dot.top();
    case "bottom": return dot.top() + dot.radius();
  }
  return null;
};

/**
 * The bottom property; null for "bottom" anchors, non-null otherwise.
 *
 * @type number
 * @name pv.Dot.Anchor.prototype.bottom
 */ /** @private */
pv.Dot.Anchor.prototype.$bottom = function(d) {
  var dot = this.anchorTarget();
  switch (this.get("name")) {
    case "left":
    case "right":
    case "center": return dot.bottom();
    case "top": return dot.bottom() + dot.radius();
  }
  return null;
};

/**
 * The text-align property, for horizontal alignment outside the dot.
 *
 * @type string
 * @name pv.Dot.Anchor.prototype.textAlign
 */ /** @private */
pv.Dot.Anchor.prototype.$textAlign = function(d) {
  switch (this.get("name")) {
    case "left": return "right";
    case "bottom":
    case "top":
    case "center": return "center";
    case "right": return "left";
  }
  return null;
};

/**
 * The text-baseline property, for vertical alignment outside the dot.
 *
 * @type string
 * @name pv.Dot.Anchor.prototype.textBasline
 */ /** @private */
pv.Dot.Anchor.prototype.$textBaseline = function(d) {
  switch (this.get("name")) {
    case "right":
    case "left":
    case "center": return "middle";
    case "top": return "bottom";
    case "bottom": return "top";
  }
  return null;
};

/**
 * Returns the radius of the dot, which is defined to be the square root of the
 * {@link #size} property.
 *
 * @returns {number} the radius.
 */
pv.Dot.prototype.radius = function() {
  return Math.sqrt(this.size());
};

/**
 * Updates the display for the specified dot instance <tt>s</tt> in the scene
 * graph. This implementation handles the fill and stroke style for the dot, as
 * well as positional properties.
 *
 * @param s a node in the scene graph; the instance of the dot to update.
 */
pv.Dot.prototype.updateInstance = function(s) {
  var v = s.svg;

  /* Create the <svg:path> element, if necessary. */
  if (s.visible && !v) {
    v = s.svg = document.createElementNS(pv.ns.svg, "path");
    s.parent.svg.appendChild(v);
  }

  /* visible, cursor, title, event, etc. */
  pv.Mark.prototype.updateInstance.call(this, s);
  if (!s.visible) return;

  /* left, top */
  v.setAttribute("transform", "translate(" + s.left + "," + s.top +")"
      + (s.angle ? " rotate(" + 180 * s.angle / Math.PI + ")" : ""));

  /* fill, stroke TODO gradient, patterns? */
  var fill = pv.color(s.fillStyle);
  v.setAttribute("fill", fill.color);
  v.setAttribute("fill-opacity", fill.opacity);
  var stroke = pv.color(s.strokeStyle);
  v.setAttribute("stroke", stroke.color);
  v.setAttribute("stroke-opacity", stroke.opacity);
  v.setAttribute("stroke-width", s.lineWidth);

  /* shape, size */
  var radius = Math.sqrt(s.size);
  var d;
  switch (s.shape) {
    case "cross": {
      d = "M" + -radius + "," + -radius
          + "L" + radius + "," + radius
          + "M" + radius + "," + -radius
          + "L" + -radius + "," + radius;
      break;
    }
    case "triangle": {
      var h = radius, w = radius * 2 / Math.sqrt(3);
      d = "M0," + h
          + "L" + w +"," + -h
          + " " + -w + "," + -h
          + "Z";
      break;
    }
    case "diamond": {
      radius *= Math.sqrt(2);
      d = "M0," + -radius
          + "L" + radius + ",0"
          + " 0," + radius
          + " " + -radius + ",0"
          + "Z";
      break;
    }
    case "square": {
      d = "M" + -radius + "," + -radius
          + "L" + radius + "," + -radius
          + " " + radius + "," + radius
          + " " + -radius + "," + radius
          + "Z";
      break;
    }
    case "tick": {
      d = "M0,0L0," + -s.size;
      break;
    }
    default: { // circle
      d = "M0," + radius
          + "A" + radius + "," + radius + " 0 1,1 0," + (-radius)
          + "A" + radius + "," + radius + " 0 1,1 0," + radius
          + "Z";
      break;
    }
  }
  v.setAttribute("d", d);
};
/**
 * Constructs a new dot mark with default properties. Images are not typically
 * constructed directly, but by adding to a panel or an existing mark via
 * {@link pv.Mark#add}.
 *
 * @class Represents an image. Images share the same layout and style properties as
 * bars, in conjunction with an external image such as PNG or JPEG. The image is
 * specified via the {@link #url} property. The fill, if specified, appears
 * beneath the image, while the optional stroke appears above the image.
 *
 * <p>TODO Restore support for dynamic images (such as heatmaps). These were
 * supported in the canvas implementation using the pixel buffer API; although
 * SVG does not support pixel manipulation, it is possible to embed a canvas
 * element in SVG using foreign objects.
 *
 * <p>TODO Allow different modes of image placement: "scale" -- scale and
 * preserve aspect ratio, "tile" -- repeat the image, "center" -- center the
 * image, "fill" -- scale without preserving aspect ratio.
 *
 * <p>See {@link pv.Bar} for details on positioning properties.
 *
 * @extends pv.Bar
 */
pv.Image = function() {
  pv.Bar.call(this);
};
pv.Image.prototype = pv.extend(pv.Bar);
pv.Image.prototype.type = pv.Image;

/**
 * Returns "image".
 *
 * @returns {string} "image".
 */
pv.Image.toString = function() { return "image"; };

/**
 * The URL of the image to display. The set of supported image types is
 * browser-dependent; PNG and JPEG are recommended.
 *
 * @type string
 * @name pv.Image.prototype.url
 */
pv.Image.prototype.defineProperty("url");

/**
 * Default properties for images. By default, there is no stroke or fill style.
 *
 * @type pv.Image
 */
pv.Image.defaults = new pv.Image().extend(pv.Bar.defaults)
    .fillStyle(null);

/**
 * Updates the display for the specified image instance <tt>s</tt> in the scene
 * graph. This implementation handles the fill and stroke style for the image,
 * as well as positional properties.
 *
 * <p>Image rendering is a bit more complicated than most marks because it can
 * entail up to four SVG elements: three for the fill, image and stroke, and the
 * fourth an anchor element for the title tooltip. The anchor element is placed
 * around the stroke rect element, if present, and otherwise the image element.
 * Similarly the event handlers and cursor style is placed on the stroke
 * element, if present, and otherwise the image element. Note that since the
 * stroke element is transparent, the <tt>pointer-events</tt> attribute is used
 * to capture events.
 *
 * @param s a node in the scene graph; the instance of the image to update.
 */
pv.Image.prototype.updateInstance = function(s) {
  var v = s.svg;

  /* Create the svg:image element, if necessary. */
  if (s.visible && !v) {
    v = s.svg = document.createElementNS(pv.ns.svg, "image");
    v.setAttribute("preserveAspectRatio", "none");
    s.parent.svg.appendChild(v);
  }

  /*
   * If no stroke is specified, then the event handlers and title anchor element
   * can be placed on the image element. However, if there was previously a
   * title anchor element around the stroke element, we must be careful to
   * remove it. This logic could likely be simplified.
   */
  if (!s.strokeStyle) {
    if (v.$stroke) {
      v.parentNode.removeChild(v.$stroke.$title || v.$stroke);
      delete v.$stroke;
    }

    /* cursor, title, events, etc. */
    pv.Mark.prototype.updateInstance.call(this, s);
  }

  /* visible */
  function display(v) {
    s.visible ? v.removeAttribute("display") : v.setAttribute("display", "none");
  }
  if (v) {
    display(v);
    if (v.$stroke) display(v.$stroke);
    if (v.$fill) display(v.$fill);
  }
  if (!s.visible) return;

  /* left, top, width, height */
  function position(v) {
    v.setAttribute("x", s.left);
    v.setAttribute("y", s.top);
    v.setAttribute("width", s.width);
    v.setAttribute("height", s.height);
  }
  position(v);

  /* fill (via an underlaid svg:rect element) */
  if (s.fillStyle) {
    var f = v.$fill;
    if (!f) {
      f = v.$fill = document.createElementNS(pv.ns.svg, "rect");
      (v.$title || v).parentNode.insertBefore(f, (v.$title || v));
    }
    position(f);
    var fill = pv.color(s.fillStyle);
    f.setAttribute("fill", fill.color);
    f.setAttribute("fill-opacity", fill.opacity);
  } else if (v.$fill) {
    v.$fill.parentNode.removeChild(v.$fill);
    delete v.$fill;
  }

  /* stroke (via an overlaid svg:rect element) */
  if (s.strokeStyle) {
    var f = v.$stroke;

    /*
     * If the $title attribute is set, that means the title anchor element was
     * previously on the image element; now that the stroke style is set, we
     * must delete the old title element to make room for the new one.
     */
    if (v.$title) {
      var p = v.$title.parentNode;
      p.insertBefore(v, v.$title);
      p.removeChild(v.$title);
      delete v.$title;
    }

    /* Create the stroke svg:rect element, if necessary. */
    if (!f) {
      f = v.$stroke = document.createElementNS(pv.ns.svg, "rect");
      f.setAttribute("fill", "none");
      f.setAttribute("pointer-events", "all");
      v.parentNode.insertBefore(f, v.nextSibling);
    }
    position(f);
    var stroke = pv.color(s.strokeStyle);
    f.setAttribute("stroke", stroke.color);
    f.setAttribute("stroke-opacity", stroke.opacity);
    f.setAttribute("stroke-width", s.lineWidth);

    /* cursor, title, events, etc. */
    try {
      s.svg = f;
      pv.Mark.prototype.updateInstance.call(this, s);
    } finally {
      s.svg = v;
    }
  }

  /* url */
  v.setAttributeNS(pv.ns.xlink, "href", s.url);
};
/**
 * Constructs a new label mark with default properties. Labels are not typically
 * constructed directly, but by adding to a panel or an existing mark via
 * {@link pv.Mark#add}.
 *
 * @class Represents a text label, allowing textual annotation of other marks or
 * arbitrary text within the visualization. The character data must be plain
 * text (unicode), though the text can be styled using the {@link #font}
 * property. If rich text is needed, external HTML elements can be overlaid on
 * the canvas by hand.
 *
 * <p>Labels are positioned using the box model, similarly to {@link Dot}. Thus,
 * a label has no width or height, but merely a text anchor location. The text
 * is positioned relative to this anchor location based on the
 * {@link #textAlign}, {@link #textBaseline} and {@link #textMargin} properties.
 * Furthermore, the text may be rotated using {@link #textAngle}.
 *
 * <p>Labels ignore events, so as to not interfere with event handlers on
 * underlying marks, such as bars. In the future, we may support event handlers
 * on labels.
 *
 * <p>See also the <a href="../../api/Label.html">Label guide</a>.
 *
 * @extends pv.Mark
 */
pv.Label = function() {
  pv.Mark.call(this);
};
pv.Label.prototype = pv.extend(pv.Mark);
pv.Label.prototype.type = pv.Label;

/**
 * Returns "label".
 *
 * @returns {string} "label".
 */
pv.Label.toString = function() { return "label"; };

/**
 * The character data to render; a string. The default value of the text
 * property is the identity function, meaning the label's associated datum will
 * be rendered using its <tt>toString</tt>.
 *
 * @type string
 * @name pv.Label.prototype.text
 */
pv.Label.prototype.defineProperty("text");

/**
 * The font format, per the CSS Level 2 specification. The default font is "10px
 * sans-serif", for consistency with the HTML 5 canvas element specification.
 * Note that since text is not wrapped, any line-height property will be
 * ignored. The other font-style, font-variant, font-weight, font-size and
 * font-family properties are supported.
 *
 * @see <a href="http://www.w3.org/TR/CSS2/fonts.html#font-shorthand">CSS2 fonts</a>.
 * @type string
 * @name pv.Label.prototype.font
 */
pv.Label.prototype.defineProperty("font");

/**
 * The rotation angle, in radians. Text is rotated clockwise relative to the
 * anchor location. For example, with the default left alignment, an angle of
 * Math.PI / 2 causes text to proceed downwards. The default angle is zero.
 *
 * @type number
 * @name pv.Label.prototype.textAngle
 */
pv.Label.prototype.defineProperty("textAngle");

/**
 * The text color. The name "textStyle" is used for consistency with "fillStyle"
 * and "strokeStyle", although it might be better to rename this property (and
 * perhaps use the same name as "strokeStyle"). The default color is black.
 *
 * @type string
 * @name pv.Label.prototype.textStyle
 * @see pv.color
 */
pv.Label.prototype.defineProperty("textStyle");

/**
 * The horizontal text alignment. One of:<ul>
 *
 * <li>left
 * <li>center
 * <li>right
 *
 * </ul>The default horizontal alignment is left.
 *
 * @type string
 * @name pv.Label.prototype.textAlign
 */
pv.Label.prototype.defineProperty("textAlign");

/**
 * The vertical text alignment. One of:<ul>
 *
 * <li>top
 * <li>middle
 * <li>bottom
 *
 * </ul>The default vertical alignment is bottom.
 *
 * @type string
 * @name pv.Label.prototype.textBaseline
 */
pv.Label.prototype.defineProperty("textBaseline");

/**
 * The text margin; may be specified in pixels, or in font-dependent units
 * (e.g., ".1ex"). The margin can be used to pad text away from its anchor
 * location, in a direction dependent on the horizontal and vertical alignment
 * properties. For example, if the text is left- and middle-aligned, the margin
 * shifts the text to the right. The default margin is 3 pixels.
 *
 * @type number
 * @name pv.Label.prototype.textMargin
 */
pv.Label.prototype.defineProperty("textMargin");

/**
 * A list of shadow effects to be applied to text, per the CSS Text Level 3
 * text-shadow property. An example specification is "0.1em 0.1em 0.1em
 * rgba(0,0,0,.5)"; the first length is the horizontal offset, the second the
 * vertical offset, and the third the blur radius.
 *
 * @see <a href="http://www.w3.org/TR/css3-text/#text-shadow">CSS3 text</a>.
 * @type string
 * @name pv.Label.prototype.textShadow
 */
pv.Label.prototype.defineProperty("textShadow");

/**
 * Default properties for labels. See the individual properties for the default
 * values.
 *
 * @type pv.Label
 */
pv.Label.defaults = new pv.Label().extend(pv.Mark.defaults)
    .text(pv.identity)
    .font("10px sans-serif")
    .textAngle(0)
    .textStyle("black")
    .textAlign("left")
    .textBaseline("bottom")
    .textMargin(3);

/**
 * Updates the display for the specified label instance <tt>s</tt> in the scene
 * graph. This implementation handles the text formatting for the label, as well
 * as positional properties.
 *
 * @param s a node in the scene graph; the instance of the dot to update.
 */
pv.Label.prototype.updateInstance = function(s) {
  var v = s.svg;

  /* Create the svg:text element, if necessary. */
  if (s.visible && !v) {
    v = s.svg = document.createElementNS(pv.ns.svg, "text");
    v.$text = document.createTextNode("");
    v.appendChild(v.$text);
    s.parent.svg.appendChild(v);
  }

  /* cursor, title, events, visible, etc. */
  pv.Mark.prototype.updateInstance.call(this, s);
  if (!s.visible) return;

  /* left, top, angle */
  v.setAttribute("transform", "translate(" + s.left + "," + s.top + ")"
      + (s.textAngle ? " rotate(" + 180 * s.textAngle / Math.PI + ")" : ""));

  /* text-baseline */
  switch (s.textBaseline) {
    case "middle": {
      v.removeAttribute("y");
      v.setAttribute("dy", ".35em");
      break;
    }
    case "top": {
      v.setAttribute("y", s.textMargin);
      v.setAttribute("dy", ".71em");
      break;
    }
    case "bottom": {
      v.setAttribute("y", "-" + s.textMargin);
      v.removeAttribute("dy");
      break;
    }
  }

  /* text-align */
  switch (s.textAlign) {
    case "right": {
      v.setAttribute("text-anchor", "end");
      v.setAttribute("x", "-" + s.textMargin);
      break;
    }
    case "center": {
      v.setAttribute("text-anchor", "middle");
      v.removeAttribute("x");
      break;
    }
    case "left": {
      v.setAttribute("text-anchor", "start");
      v.setAttribute("x", s.textMargin);
      break;
    }
  }

  /* font, text-shadow TODO centralize font definition? */
  v.$text.nodeValue = s.text;
  var style = "font:" + s.font + ";";
  if (s.textShadow) {
    style += "text-shadow:" + s.textShadow +";";
  }
  v.setAttribute("style", style);

  /* fill */
  var fill = pv.color(s.textStyle);
  v.setAttribute("fill", fill.color);
  v.setAttribute("fill-opacity", fill.opacity);

  /* TODO enable interaction on labels? centralize this definition? */
  v.setAttribute("pointer-events", "none");
};
/**
 * Constructs a new line mark with default properties. Lines are not typically
 * constructed directly, but by adding to a panel or an existing mark via
 * {@link pv.Mark#add}.
 *
 * @class Represents a series of connected line segments, or <i>polyline</i>,
 * that can be stroked with a configurable color and thickness. Each
 * articulation point in the line corresponds to a datum; for <i>n</i> points,
 * <i>n</i>-1 connected line segments are drawn. The point is positioned using
 * the box model. Arbitrary paths are also possible, allowing radar plots and
 * other custom visualizations.
 *
 * <p>Like areas, lines can be stroked and filled with arbitrary colors. In most
 * cases, lines are only stroked, but the fill style can be used to construct
 * arbitrary polygons.
 *
 * <p>See also the <a href="../../api/Line.html">Line guide</a>.
 *
 * @extends pv.Mark
 */
pv.Line = function() {
  pv.Mark.call(this);
};
pv.Line.prototype = pv.extend(pv.Mark);
pv.Line.prototype.type = pv.Line;

/**
 * Returns "line".
 *
 * @returns {string} "line".
 */
pv.Line.toString = function() { return "line"; };

/**
 * The width of stroked lines, in pixels; used in conjunction with
 * <tt>strokeStyle</tt> to stroke the line.
 *
 * @type number
 * @name pv.Line.prototype.lineWidth
 */
pv.Line.prototype.defineProperty("lineWidth");

/**
 * The style of stroked lines; used in conjunction with <tt>lineWidth</tt> to
 * stroke the line. The default value of this property is a categorical color.
 *
 * @type string
 * @name pv.Line.prototype.strokeStyle
 * @see pv.color
 */
pv.Line.prototype.defineProperty("strokeStyle");

/**
 * The line fill style; if non-null, the interior of the line is closed and
 * filled with the specified color. The default value of this property is a
 * null, meaning that lines are not filled by default.
 *
 * @type string
 * @name pv.Line.prototype.fillStyle
 * @see pv.color
 */
pv.Line.prototype.defineProperty("fillStyle");

/**
 * Default properties for lines. By default, there is no fill and the stroke
 * style is a categorical color.
 *
 * @type pv.Line
 */
pv.Line.defaults = new pv.Line().extend(pv.Mark.defaults)
    .lineWidth(1.5)
    .strokeStyle(pv.Colors.category10);

/**
 * Override the default update implementation, since the line mark generates a
 * single graphical element rather than multiple distinct elements.
 */
pv.Line.prototype.update = function() {
  if (!this.scene.length) return;

  /* visible */
  var s = this.scene[0], v = s.svg;
  if (s.visible) {

    /* Create the svg:polyline element, if necessary. */
    if (!v) {
      v = s.svg = document.createElementNS(pv.ns.svg, "polyline");
      s.parent.svg.appendChild(v);
    }

    /* left, top TODO allow points to be changed on events? */
    var p = "";
    for (var i = 0; i < this.scene.length; i++) {
      var si = this.scene[i];
      if (isNaN(si.left)) si.left = 0;
      if (isNaN(si.top)) si.top = 0;
      p += si.left + "," + si.top + " ";
    }
    v.setAttribute("points", p);

    /* cursor, title, events, etc. */
    this.updateInstance(s);
    v.removeAttribute("display");
  } else if (v) {
    v.setAttribute("display", "none");
  }
};

/**
 * Updates the display for the (singleton) line instance. The line mark
 * generates a single graphical element rather than multiple distinct elements.
 *
 * <p>TODO Recompute points? For efficiency, the points are not recomputed, and
 * therefore cannot be updated automatically from event handlers without an
 * explicit call to rebuild the line.
 *
 * @param s a node in the scene graph; the instance of the mark to update.
 */
pv.Line.prototype.updateInstance = function(s) {
  var v = s.svg;

  pv.Mark.prototype.updateInstance.call(this, s);
  if (!s.visible) return;

  /* fill, stroke TODO gradient, patterns */
  var fill = pv.color(s.fillStyle);
  v.setAttribute("fill", fill.color);
  v.setAttribute("fill-opacity", fill.opacity);
  var stroke = pv.color(s.strokeStyle);
  v.setAttribute("stroke", stroke.color);
  v.setAttribute("stroke-opacity", stroke.opacity);
  v.setAttribute("stroke-width", s.lineWidth);
};
/**
 * Constructs a new, empty panel with default properties. Panels, with the
 * exception of the root panel, are not typically constructed directly; instead,
 * they are added to an existing panel or mark via {@link pv.Mark#add}.
 *
 * @class Represents a container mark. Panels allow repeated or nested
 * structures, commonly used in small multiple displays where a small
 * visualization is tiled to facilitate comparison across one or more
 * dimensions. Other types of visualizations may benefit from repeated and
 * possibly overlapping structure as well, such as stacked area charts. Panels
 * can also offset the position of marks to provide padding from surrounding
 * content.
 *
 * <p>All Protovis displays have at least one panel; this is the root panel to
 * which marks are rendered. The box model properties (four margins, width and
 * height) are used to offset the positions of contained marks. The data
 * property determines the panel count: a panel is generated once per associated
 * datum. When nested panels are used, property functions can declare additional
 * arguments to access the data associated with enclosing panels.
 *
 * <p>Panels can be rendered inline, facilitating the creation of sparklines.
 * This allows designers to reuse browser layout features, such as text flow and
 * tables; designers can also overlay HTML elements such as rich text and
 * images.
 *
 * <p>All panels have a <tt>children</tt> array (possibly empty) containing the
 * child marks in the order they were added. Panels also have a <tt>root</tt>
 * field which points to the root (outermost) panel; the root panel's root field
 * points to itself.
 *
 * <p>See also the <a href="../../api/">Protovis guide</a>.
 *
 * @extends pv.Bar
 */
pv.Panel = function() {
  pv.Bar.call(this);

  /**
   * The child marks; zero or more {@link pv.Mark}s in the order they were
   * added.
   *
   * @see #add
   * @type pv.Mark[]
   */
  this.children = [];
  this.root = this;

  /**
   * The internal $dom field is set by the Protovis loader; see lang/init.js. It
   * refers to the script element that contains the Protovis specification, so
   * that the panel knows where in the DOM to insert the generated SVG element.
   *
   * @private
   */
  this.$dom = pv.Panel.$dom;
};
pv.Panel.prototype = pv.extend(pv.Bar);
pv.Panel.prototype.type = pv.Panel;

/**
 * Returns "panel".
 *
 * @returns {string} "panel".
 */
pv.Panel.toString = function() { return "panel"; };

/**
 * The canvas element; either the string ID of the canvas element in the current
 * document, or a reference to the canvas element itself. If null, a canvas
 * element will be created and inserted into the document at the location of the
 * script element containing the current Protovis specification. This property
 * only applies to root panels and is ignored on nested panels.
 *
 * <p>Note: the "canvas" element here refers to a <tt>div</tt> (or other suitable
 * HTML container element), <i>not</i> a <tt>canvas</tt> element. The name of
 * this property is a historical anachronism from the first implementation that
 * used HTML 5 canvas, rather than SVG.
 *
 * @type string
 * @name pv.Panel.prototype.canvas
 */
pv.Panel.prototype.defineProperty("canvas");

/**
 * The reverse property; a boolean determining whether child marks are ordered
 * from front-to-back or back-to-front. SVG does not support explicit
 * z-ordering; shapes are rendered in the order they appear. Thus, by default,
 * child marks are rendered in the order they are added to the panel. Setting
 * the reverse property to false reverses the order in which they are added to
 * the SVG element; however, the properties are still evaluated (i.e., built) in
 * forward order.
 *
 * @type boolean
 * @name pv.Panel.prototype.reverse
 */
pv.Panel.prototype.defineProperty("reverse");

/**
 * Default properties for panels. By default, the margins are zero, the fill
 * style is transparent, and the reverse property is false.
 *
 * @type pv.Panel
 */
pv.Panel.defaults = new pv.Panel().extend(pv.Bar.defaults)
    .top(0).left(0).bottom(0).right(0)
    .fillStyle(null)
    .reverse(false);

/**
 * Adds a new mark of the specified type to this panel. Unlike the normal
 * {@link Mark#add} behavior, adding a mark to a panel does not cause the mark
 * to inherit from the panel. Since the contained marks are offset by the panel
 * margins already, inheriting properties is generally undesirable; of course,
 * it is always possible to change this behavior by calling {@link Mark#extend}
 * explicitly.
 *
 * @param {function} type the type of the new mark to add.
 * @returns {pv.Mark} the new mark.
 */
pv.Panel.prototype.add = function(type) {
  var child = new type();
  child.parent = this;
  child.root = this.root;
  child.childIndex = this.children.length;
  this.children.push(child);
  return child;
};

/**
 * Creates a new canvas (SVG) element with the specified width and height, and
 * inserts it into the current document. If the <tt>$dom</tt> field is set, as
 * for text/javascript+protovis scripts, the SVG element is inserted into the
 * DOM before the script element. Otherwise, the SVG element is inserted into
 * the last child element of the document, as for text/javascript scripts.
 *
 * @param w the width of the canvas to create, in pixels.
 * @param h the height of the canvas to create, in pixels.
 * @return the new canvas (SVG) element.
 */
pv.Panel.prototype.createCanvas = function(w, h) {

  /**
   * Returns the last element in the current document's body. The canvas element
   * is appended to this last element if another DOM element has not already
   * been specified via the <tt>$dom</tt> field.
   */
  function lastElement() {
    var node = document.body;
    while (node.lastChild && node.lastChild.tagName) {
      node = node.lastChild;
    }
    return (node == document.body) ? node : node.parentNode;
  }

  /* Create the SVG element. */
  var c = document.createElementNS(pv.ns.svg, "svg");
  c.setAttribute("width", w);
  c.setAttribute("height", h);

  /* Insert it into the DOM at the appropriate location. */
  this.$dom // script element for text/javascript+protovis
      ? this.$dom.parentNode.insertBefore(c, this.$dom)
      : lastElement().appendChild(c);

  return c;
};

/**
 * Evaluates all of the properties for this panel for the specified instance
 * <tt>s</tt> in the scene graph, including recursively building the scene graph
 * for child marks.
 *
 * @param s a node in the scene graph; the instance of the panel to build.
 * @see Mark#scene
 */
pv.Panel.prototype.buildInstance = function(s) {
  pv.Bar.prototype.buildInstance.call(this, s);

  /*
   * Build each child, passing in the parent (this panel) scene graph node. The
   * child mark's scene is initialized from the corresponding entry in the
   * existing scene graph, such that properties from the previous build can be
   * reused; this is largely to facilitate the recycling of SVG elements.
   */
  for (var i = 0; i < this.children.length; i++) {
    this.children[i].scene = s.children[i] || [];
    this.children[i].build(s);
  }

  /*
   * Once the child marks have been built, the new scene graph nodes are removed
   * from the child marks and placed into the scene graph. The nodes cannot
   * remain on the child nodes because this panel (or a parent panel) may be
   * instantiated multiple times!
   */
  for (var i = 0; i < this.children.length; i++) {
    s.children[i] = this.children[i].scene;
    delete this.children[i].scene;
  }

  /* Delete any expired child scenes, should child marks have been removed. */
  s.children.length = this.children.length;
};

/**
 * Computes the implied properties for this panel for the specified instance
 * <tt>s</tt> in the scene graph. Panels have two implied properties:<ul>
 *
 * <li>The <tt>canvas</tt> property references the DOM element, typically a DIV,
 * that contains the SVG element that is used to display the visualization. This
 * property may be specified as a string, referring to the unique ID of the
 * element in the DOM. The string is converted to a reference to the DOM
 * element. The width and height of the SVG element is inferred from this DOM
 * element. If no canvas property is specified, a new SVG element is created and
 * inserted into the document, using the panel dimensions; see
 * {@link #createCanvas}.
 *
 * <li>The <tt>children</tt> array, while not a property per se, contains the
 * scene graph for each child mark. This array is initialized to be empty, and
 * is populated above in {@link #buildInstance}.
 *
 * </ul>The current implementation creates the SVG element, if necessary, during
 * the build phase; in the future, it may be preferrable to move this to the
 * update phase, although then the canvas property would be undefined. In
 * addition, DOM inspection is necessary to define the implied width and height
 * properties that may be inferred from the DOM.
 *
 * @param s a node in the scene graph; the instance of the panel to build.
 */
pv.Panel.prototype.buildImplied = function(s) {
  if (!s.children) s.children = [];
  if (!s.parent) {
    var c = s.canvas;
    if (c) {
      var d = (typeof c == "string") ? document.getElementById(c) : c;

      /* Clear the container if it's not already associated with this panel. */
      if (d.$panel != this) {
        d.$panel = this;
        delete d.$canvas;
        while (d.lastChild)
          d.removeChild(d.lastChild);
      }

      /* Construct the canvas if not already present. */
      if (!(c = d.$canvas)) {
        d.$canvas = c = document.createElementNS(pv.ns.svg, "svg");
        d.appendChild(c);
      }

      /** Returns the computed style for the given element and property. */
      function css(e, p) {
        return parseFloat(self.getComputedStyle(e, null).getPropertyValue(p));
      }

      /* If width and height weren't specified, inspect the container. */
      var w, h;
      if (s.width == null) {
        w = css(d, "width");
        s.width = w - s.left - s.right;
      } else {
        w = s.width + s.left + s.right;
      }
      if (s.height == null) {
        h = css(d, "height");
        s.height = h - s.top - s.bottom;
      } else {
        h = s.height + s.top + s.bottom;
      }

      c.setAttribute("width", w);
      c.setAttribute("height", h);
      s.canvas = c;
    } else if (s.svg) {
      s.canvas = s.svg.parentNode;
    } else {
      s.canvas = this.createCanvas(
          s.width + s.left + s.right,
          s.height + s.top + s.bottom);
    }
  }
  pv.Bar.prototype.buildImplied.call(this, s);
};

/**
 * Updates the display, propagating property values computed in the build phase
 * to the SVG image. In addition to the SVG element that serves as the canvas,
 * each panel instance has a corresponding <tt>g</tt> (container) element. The
 * <tt>g</tt> element uses the <tt>transform</tt> attribute to offset the location
 * of contained graphical elements.
 */
pv.Panel.prototype.update = function() {
  var appends = [];
  for (var i = 0; i < this.scene.length; i++) {
    var s = this.scene[i];

    /* Create the <svg:g> element, if necessary. */
    var v = s.svg;
    if (!v) {
      v = s.svg = document.createElementNS(pv.ns.svg, "g");
      appends.push(s);
    }

    /* Update this instance, recursively including child marks. */
    this.updateInstance(s);
    if (s.children) { // check visibility
      for (var j = 0; j < this.children.length; j++) {
        var c = this.children[j];
        c.scene = s.children[j];
        c.update();
        delete c.scene;
      }
    }
  }

  /*
   * WebKit appears has a bug where images are not rendered if the <g> element
   * is appended before it contained any elements. Creating the child elements
   * first and then appending them solves the problem and is likely more
   * efficient. Also, it means we can reverse the order easily.
   *
   * TODO It would be nice to support arbitrary z-order here, at least within
   * panel. Of course, the order of children may need to be updated not just on
   * append.
   */
  if (appends.length) {
    if (appends[0].reverse) appends.reverse();
    for (var i = 0; i < appends.length; i++) {
      var s = appends[i];
      (s.parent ? s.parent.svg : s.canvas).appendChild(s.svg);
    }
  }
};

/**
 * Updates the display for the specified panel instance <tt>s</tt> in the scene
 * graph. This implementation handles the fill and stroke style for the panel,
 * as well as any necessary transform to offset the location of contained marks.
 *
 * <p>TODO As a performance optimization, it may also be possible to assign
 * constant property values (or even the most common value for each property) as
 * attributes on the <g> element so they can be inherited.
 *
 * @param s a node in the scene graph; the instance of the panel to update.
 */
pv.Panel.prototype.updateInstance = function(s) {
  var v = s.svg;

  /* visible */
  if (!s.visible) {
    if (v) v.setAttribute("display", "none");
    return;
  }
  v.removeAttribute("display");

  /* fillStyle, strokeStyle */
  var r = v.$rect;
  if (s.fillStyle || s.strokeStyle) {
    if (!r) {
      r = v.$rect = document.createElementNS(pv.ns.svg, "rect");
      v.insertBefore(r, v.firstChild);
    }

    /* If width and height are exactly zero, the rect is not stroked! */
    r.setAttribute("width", Math.max(1E-10, s.width));
    r.setAttribute("height", Math.max(1E-10, s.height));

    /* fill, stroke TODO gradient, patterns */
    var fill = pv.color(s.fillStyle);
    r.setAttribute("fill", fill.color);
    r.setAttribute("fill-opacity", fill.opacity);
    var stroke = pv.color(s.strokeStyle);
    r.setAttribute("stroke", stroke.color);
    r.setAttribute("stroke-opacity", stroke.opacity);
    r.setAttribute("stroke-width", s.lineWidth);
  } else if (r) {
    v.removeChild(r);
    delete v.$rect;
    r = null;
  }

  /* cursor, title, event, etc. */
  if (r) {
    try {
      s.svg = r;
      pv.Mark.prototype.updateInstance.call(this, s);
    } finally {
      s.svg = v;
    }
  }

  /* left, top */
  if (s.left || s.top) {
    v.setAttribute("transform", "translate(" + s.left + "," + s.top +")");
  } else {
    v.removeAttribute("transform");
  }
};
/**
 * Constructs a new rule with default properties. Rules are not typically
 * constructed directly, but by adding to a panel or an existing mark via
 * {@link pv.Mark#add}.
 *
 * @class Represents a horizontal or vertical rule. Rules are frequently used
 * for axes and grid lines. For example, specifying only the bottom property
 * draws horizontal rules, while specifying only the left draws vertical
 * rules. Rules can also be used as thin bars. The visual style is controlled in
 * the same manner as lines.
 *
 * <p>Rules are positioned exclusively using the four margins. The following
 * combinations of properties are supported:<ul>
 *
 * <li>left (vertical)
 * <li>right (vertical)
 * <li>left, bottom, top (vertical)
 * <li>right, bottom, top (vertical)
 * <li>top (horizontal)
 * <li>bottom (horizontal)
 * <li>top, left, right (horizontal)
 * <li>bottom, left, right (horizontal)
 *
 * </ul>TODO If rules supported width (for horizontal) and height (for vertical)
 * properties, it might be easier to place them. Small rules can be used as tick
 * marks; alternatively, a {@link Dot} with the "tick" shape can be used.
 *
 * <p>See also the <a href="../../api/Rule.html">Rule guide</a>.
 *
 * @see pv.Line
 * @extends pv.Mark
 */
pv.Rule = function() {
  pv.Mark.call(this);
};
pv.Rule.prototype = pv.extend(pv.Mark);
pv.Rule.prototype.type = pv.Rule;

/**
 * Returns "rule".
 *
 * @returns {string} "rule".
 */
pv.Rule.toString = function() { return "rule"; };

/**
 * The width of stroked lines, in pixels; used in conjunction with
 * <tt>strokeStyle</tt> to stroke the rule. The default value is 1 pixel.
 *
 * @type number
 * @name pv.Rule.prototype.lineWidth
 */
pv.Rule.prototype.defineProperty("lineWidth");

/**
 * The style of stroked lines; used in conjunction with <tt>lineWidth</tt> to
 * stroke the rule. The default value of this property is black.
 *
 * @type string
 * @name pv.Rule.prototype.strokeStyle
 * @see pv.color
 */
pv.Rule.prototype.defineProperty("strokeStyle");

/**
 * Default properties for rules. By default, a single-pixel black line is
 * stroked.
 *
 * @type pv.Rule
 */
pv.Rule.defaults = new pv.Rule().extend(pv.Mark.defaults)
    .lineWidth(1)
    .strokeStyle("black");

/**
 * Constructs a new rule anchor with default properties.
 *
 * @class Represents an anchor for a rule mark. Rules support five different
 * anchors:<ul>
 *
 * <li>top
 * <li>left
 * <li>center
 * <li>bottom
 * <li>right
 *
 * </ul>In addition to positioning properties (left, right, top bottom), the
 * anchors support text rendering properties (text-align, text-baseline). Text is
 * rendered to appear outside the rule. Note that this behavior is different
 * from other mark anchors, which default to rendering text <i>inside</i> the
 * mark.
 *
 * <p>For consistency with the other mark types, the anchor positions are
 * defined in terms of their opposite edge. For example, the top anchor defines
 * the bottom property, such that a bar added to the top anchor grows upward.
 *
 * @extends pv.Bar.Anchor
 */
pv.Rule.Anchor = function() {
  pv.Bar.Anchor.call(this);
};
pv.Rule.Anchor.prototype = pv.extend(pv.Bar.Anchor);
pv.Rule.Anchor.prototype.type = pv.Rule;

/**
 * The text-align property, for horizontal alignment outside the rule.
 *
 * @type string
 * @name pv.Rule.Anchor.prototype.textAlign
 */ /** @private */
pv.Rule.Anchor.prototype.$textAlign = function(d) {
  switch (this.get("name")) {
    case "left": return "right";
    case "bottom":
    case "top":
    case "center": return "center";
    case "right": return "left";
  }
  return null;
};

/**
 * The text-baseline property, for vertical alignment outside the rule.
 *
 * @type string
 * @name pv.Rule.Anchor.prototype.textBaseline
 */ /** @private */
pv.Rule.Anchor.prototype.$textBaseline = function(d) {
  switch (this.get("name")) {
    case "right":
    case "left":
    case "center": return "middle";
    case "top": return "bottom";
    case "bottom": return "top";
  }
  return null;
};

/**
 * Returns the pseudo-width of the rule in pixels; read-only.
 *
 * @returns {number} the pseudo-width, in pixels.
 */
pv.Rule.prototype.width = function() {
  return this.scene[this.index].width;
};

/**
 * Returns the pseudo-height of the rule in pixels; read-only.
 *
 * @returns {number} the pseudo-height, in pixels.
 */
pv.Rule.prototype.height = function() {
  return this.scene[this.index].height;
};

/**
 * Overrides the default behavior of {@link Mark#buildImplied} to determine the
 * orientation (vertical or horizontal) of the rule.
 *
 * @param s a node in the scene graph; the instance of the rule to build.
 */
pv.Rule.prototype.buildImplied = function(s) {
  s.width = s.height = 0;

  /* Determine horizontal or vertical orientation. */
  var l = s.left, r = s.right, t = s.top, b = s.bottom;
  if (((l == null) && (r == null)) || ((r != null) && (l != null))) {
    s.width = s.parent.width - (l = l || 0) - (r = r || 0);
  } else {
    s.height = s.parent.height - (t = t || 0) - (b = b || 0);
  }

  s.left = l;
  s.right = r;
  s.top = t;
  s.bottom = b;

  pv.Mark.prototype.buildImplied.call(this, s);
};

/**
 * Updates the display for the specified rule instance <tt>s</tt> in the scene
 * graph. This implementation handles the stroke style for the rule, as well as
 * positional properties.
 *
 * @param s a node in the scene graph; the instance of the rule to update.
 */
pv.Rule.prototype.updateInstance = function(s) {
  var v = s.svg;

  /* Create the svg:line element, if necessary. */
  if (s.visible && !v) {
    v = s.svg = document.createElementNS(pv.ns.svg, "line");
    s.parent.svg.appendChild(v);
  }

  /* visible, cursor, title, events, etc. */
  pv.Mark.prototype.updateInstance.call(this, s);
  if (!s.visible) return;

  /* left, top */
  v.setAttribute("x1", s.left);
  v.setAttribute("y1", s.top);
  v.setAttribute("x2", s.left + s.width);
  v.setAttribute("y2", s.top + s.height);

  /* stroke TODO gradient, patterns, dashes */
  var stroke = pv.color(s.strokeStyle);
  v.setAttribute("stroke", stroke.color);
  v.setAttribute("stroke-opacity", stroke.opacity);
  v.setAttribute("stroke-width", s.lineWidth);
};
/**
 * Constructs a new wedge with default properties. Wedges are not typically
 * constructed directly, but by adding to a panel or an existing mark via
 * {@link pv.Mark#add}.
 *
 * @class Represents a wedge, or pie slice. Specified in terms of start and end
 * angle, inner and outer radius, wedges can be used to construct donut charts
 * and polar bar charts as well. If the {@link #angle} property is used, the end
 * angle is implied by adding this value to start angle. By default, the start
 * angle is the previously-generated wedge's end angle. This design allows
 * explicit control over the wedge placement if desired, while offering
 * convenient defaults for the construction of radial graphs.
 *
 * <p>The center point of the circle is positioned using the standard box model.
 * The wedge can be stroked and filled, similar to {link Bar}.
 *
 * <p>See also the <a href="../../api/Wedge.html">Wedge guide</a>.
 *
 * @extends pv.Mark
 */
pv.Wedge = function() {
  pv.Mark.call(this);
};
pv.Wedge.prototype = pv.extend(pv.Mark);
pv.Wedge.prototype.type = pv.Wedge;

/**
 * Returns "wedge".
 *
 * @returns {string} "wedge".
 */
pv.Wedge.toString = function() { return "wedge"; };

/**
 * The start angle of the wedge, in radians. The start angle is measured
 * clockwise from the 3 o'clock position. The default value of this property is
 * the end angle of the previous instance (the {@link Mark#sibling}), or -PI / 2
 * for the first wedge; for pie and donut charts, typically only the
 * {@link #angle} property needs to be specified.
 *
 * @type number
 * @name pv.Wedge.prototype.startAngle
 */
pv.Wedge.prototype.defineProperty("startAngle");

/**
 * The end angle of the wedge, in radians. If not specified, the end angle is
 * implied as the start angle plus the {@link #angle}.
 *
 * @type number
 * @name pv.Wedge.prototype.endAngle
 */
pv.Wedge.prototype.defineProperty("endAngle");

/**
 * The angular span of the wedge, in radians. This property is used if end angle
 * is not specified.
 *
 * @type number
 * @name pv.Wedge.prototype.angle
 */
pv.Wedge.prototype.defineProperty("angle");

/**
 * The inner radius of the wedge, in pixels. The default value of this property
 * is zero; a positive value will produce a donut slice rather than a pie slice.
 * The inner radius can vary per-wedge.
 *
 * @type number
 * @name pv.Wedge.prototype.innerRadius
 */
pv.Wedge.prototype.defineProperty("innerRadius");

/**
 * The outer radius of the wedge, in pixels. This property is required. For
 * pies, only this radius is required; for donuts, the inner radius must be
 * specified as well. The outer radius can vary per-wedge.
 *
 * @type number
 * @name pv.Wedge.prototype.outerRadius
 */
pv.Wedge.prototype.defineProperty("outerRadius");

/**
 * The width of stroked lines, in pixels; used in conjunction with
 * <tt>strokeStyle</tt> to stroke the wedge's border.
 *
 * @type number
 * @name pv.Wedge.prototype.lineWidth
 */
pv.Wedge.prototype.defineProperty("lineWidth");

/**
 * The style of stroked lines; used in conjunction with <tt>lineWidth</tt> to
 * stroke the wedge's border. The default value of this property is null,
 * meaning wedges are not stroked by default.
 *
 * @type string
 * @name pv.Wedge.prototype.strokeStyle
 * @see pv.color
 */
pv.Wedge.prototype.defineProperty("strokeStyle");

/**
 * The wedge fill style; if non-null, the interior of the wedge is filled with
 * the specified color. The default value of this property is a categorical
 * color.
 *
 * @type string
 * @name pv.Wedge.prototype.fillStyle
 * @see pv.color
 */
pv.Wedge.prototype.defineProperty("fillStyle");

/**
 * Default properties for wedges. By default, there is no stroke and the fill
 * style is a categorical color.
 *
 * @type pv.Wedge
 */
pv.Wedge.defaults = new pv.Wedge().extend(pv.Mark.defaults)
    .startAngle(function() {
        var s = this.sibling();
        return s ? s.endAngle : -Math.PI / 2;
      })
    .innerRadius(0)
    .lineWidth(1.5)
    .strokeStyle(null)
    .fillStyle(pv.Colors.category20.unique);

/**
 * Returns the mid-radius of the wedge, which is defined as half-way between the
 * inner and outer radii.
 *
 * @see #innerRadius
 * @see #outerRadius
 * @returns {number} the mid-radius, in pixels.
 */
pv.Wedge.prototype.midRadius = function() {
  return (this.innerRadius() + this.outerRadius()) / 2;
};

/**
 * Returns the mid-angle of the wedge, which is defined as half-way between the
 * start and end angles.
 *
 * @see #startAngle
 * @see #endAngle
 * @returns {number} the mid-angle, in radians.
 */
pv.Wedge.prototype.midAngle = function() {
  return (this.startAngle() + this.endAngle()) / 2;
};

/**
 * Constructs a new wedge anchor with default properties.
 *
 * @class Represents an anchor for a wedge mark. Wedges support five different
 * anchors:<ul>
 *
 * <li>outer
 * <li>inner
 * <li>center
 * <li>start
 * <li>end
 *
 * </ul>In addition to positioning properties (left, right, top bottom), the
 * anchors support text rendering properties (text-align, text-baseline,
 * textAngle). Text is rendered to appear inside the wedge.
 *
 * @extends pv.Mark.Anchor
 */
pv.Wedge.Anchor = function() {
  pv.Mark.Anchor.call(this);
};
pv.Wedge.Anchor.prototype = pv.extend(pv.Mark.Anchor);
pv.Wedge.Anchor.prototype.type = pv.Wedge;

/**
 * The left property; non-null.
 *
 * @type number
 * @name pv.Wedge.Anchor.prototype.left
 */ /** @private */
pv.Wedge.Anchor.prototype.$left = function() {
  var w = this.anchorTarget();
  switch (this.get("name")) {
    case "outer": return w.left() + w.outerRadius() * Math.cos(w.midAngle());
    case "inner": return w.left() + w.innerRadius() * Math.cos(w.midAngle());
    case "start": return w.left() + w.midRadius() * Math.cos(w.startAngle());
    case "center": return w.left() + w.midRadius() * Math.cos(w.midAngle());
    case "end": return w.left() + w.midRadius() * Math.cos(w.endAngle());
  }
  return null;
};

/**
 * The right property; non-null.
 *
 * @type number
 * @name pv.Wedge.Anchor.prototype.right
 */ /** @private */
pv.Wedge.Anchor.prototype.$right = function() {
  var w = this.anchorTarget();
  switch (this.get("name")) {
    case "outer": return w.right() + w.outerRadius() * Math.cos(w.midAngle());
    case "inner": return w.right() + w.innerRadius() * Math.cos(w.midAngle());
    case "start": return w.right() + w.midRadius() * Math.cos(w.startAngle());
    case "center": return w.right() + w.midRadius() * Math.cos(w.midAngle());
    case "end": return w.right() + w.midRadius() * Math.cos(w.endAngle());
  }
  return null;
};

/**
 * The top property; non-null.
 *
 * @type number
 * @name pv.Wedge.Anchor.prototype.top
 */ /** @private */
pv.Wedge.Anchor.prototype.$top = function() {
  var w = this.anchorTarget();
  switch (this.get("name")) {
    case "outer": return w.top() + w.outerRadius() * Math.sin(w.midAngle());
    case "inner": return w.top() + w.innerRadius() * Math.sin(w.midAngle());
    case "start": return w.top() + w.midRadius() * Math.sin(w.startAngle());
    case "center": return w.top() + w.midRadius() * Math.sin(w.midAngle());
    case "end": return w.top() + w.midRadius() * Math.sin(w.endAngle());
  }
  return null;
};

/**
 * The bottom property; non-null.
 *
 * @type number
 * @name pv.Wedge.Anchor.prototype.bottom
 */ /** @private */
pv.Wedge.Anchor.prototype.$bottom = function() {
  var w = this.anchorTarget();
  switch (this.get("name")) {
    case "outer": return w.bottom() + w.outerRadius() * Math.sin(w.midAngle());
    case "inner": return w.bottom() + w.innerRadius() * Math.sin(w.midAngle());
    case "start": return w.bottom() + w.midRadius() * Math.sin(w.startAngle());
    case "center": return w.bottom() + w.midRadius() * Math.sin(w.midAngle());
    case "end": return w.bottom() + w.midRadius() * Math.sin(w.endAngle());
  }
  return null;
};

/**
 * The text-align property, for horizontal alignment inside the wedge.
 *
 * @type string
 * @name pv.Wedge.Anchor.prototype.textAlign
 */ /** @private */
pv.Wedge.Anchor.prototype.$textAlign = function() {
  var w = this.anchorTarget();
  switch (this.get("name")) {
    case "outer": return pv.Wedge.upright(w.midAngle()) ? "right" : "left";
    case "inner": return pv.Wedge.upright(w.midAngle()) ? "left" : "right";
    default: return "center";
  }
};

/**
 * The text-baseline property, for vertical alignment inside the wedge.
 *
 * @type string
 * @name pv.Wedge.Anchor.prototype.textBaseline
 */ /** @private */
pv.Wedge.Anchor.prototype.$textBaseline = function() {
  var w = this.anchorTarget();
  switch (this.get("name")) {
    case "start": return pv.Wedge.upright(w.startAngle()) ? "top" : "bottom";
    case "end": return pv.Wedge.upright(w.endAngle()) ? "bottom" : "top";
    default: return "middle";
  }
};

/**
 * The text-angle property, for text rotation inside the wedge.
 *
 * @type number
 * @name pv.Wedge.Anchor.prototype.textAngle
 */ /** @private */
pv.Wedge.Anchor.prototype.$textAngle = function() {
  var w = this.anchorTarget();
  var a = 0;
  switch (this.get("name")) {
    case "center":
    case "inner":
    case "outer": a = w.midAngle(); break;
    case "start": a = w.startAngle(); break;
    case "end": a = w.endAngle(); break;
  }
  return pv.Wedge.upright(a) ? a : (a + Math.PI);
};

/**
 * Returns true if the specified angle is considered "upright", as in, text
 * rendered at that angle would appear upright. If the angle is not upright,
 * text is rotated 180 degrees to be upright, and the text alignment properties
 * are correspondingly changed.
 *
 * @param {number} angle an angle, in radius.
 * @returns {boolean} true if the specified angle is upright.
 */
pv.Wedge.upright = function(angle) {
  angle = angle % (2 * Math.PI);
  angle = (angle < 0) ? (2 * Math.PI + angle) : angle;
  return (angle < Math.PI / 2) || (angle > 3 * Math.PI / 2);
};

/**
 * Overrides the default behavior of {@link Mark#buildImplied} such that the end
 * angle is computed from the start angle and angle (angular span) if not
 * specified.
 *
 * @param s a node in the scene graph; the instance of the wedge to build.
 */
pv.Wedge.prototype.buildImplied = function(s) {
  pv.Mark.prototype.buildImplied.call(this, s);
  if (s.endAngle == null) {
    s.endAngle = s.startAngle + s.angle;
  }
};

/**
 * Updates the display for the specified wedge instance <tt>s</tt> in the scene
 * graph. This implementation handles the fill and stroke style for the wedge,
 * as well as positional properties.
 *
 * @param s a node in the scene graph; the instance of the bar to update.
 */
pv.Wedge.prototype.updateInstance = function(s) {
  var v = s.svg;

  /* Create the <svg:path> element, if necessary. */
  if (s.visible && !v) {
    v = s.svg = document.createElementNS(pv.ns.svg, "path");
    v.setAttribute("fill-rule", "evenodd");
    s.parent.svg.appendChild(v);
  }

  /* visible, cursor, title, events, etc. */
  pv.Mark.prototype.updateInstance.call(this, s);
  if (!s.visible) return;

  /* left, top */
  v.setAttribute("transform", "translate(" + s.left + "," + s.top +")");

  /*
   * TODO If the angle or endAngle is updated by an event handler, the implied
   * properties won't recompute correctly, so this will lead to potentially
   * buggy redraw. How to re-evaluate implied properties on update?
   */

  /* innerRadius, outerRadius, startAngle, endAngle */
  var r1 = s.innerRadius, r2 = s.outerRadius;
  if (s.angle >= 2 * Math.PI) {
    if (r1) {
      v.setAttribute("d", "M0," + r2
          + "A" + r2 + "," + r2 + " 0 1,1 0," + (-r2)
          + "A" + r2 + "," + r2 + " 0 1,1 0," + r2
          + "M0," + r1
          + "A" + r1 + "," + r1 + " 0 1,1 0," + (-r1)
          + "A" + r1 + "," + r1 + " 0 1,1 0," + r1
          + "Z");
    } else {
      v.setAttribute("d", "M0," + r2
          + "A" + r2 + "," + r2 + " 0 1,1 0," + (-r2)
          + "A" + r2 + "," + r2 + " 0 1,1 0," + r2
          + "Z");
    }
  } else {
    var c1 = Math.cos(s.startAngle), c2 = Math.cos(s.endAngle),
        s1 = Math.sin(s.startAngle), s2 = Math.sin(s.endAngle);
    if (r1) {
      v.setAttribute("d", "M" + r2 * c1 + "," + r2 * s1
          + "A" + r2 + "," + r2 + " 0 "
          + ((s.angle < Math.PI) ? "0" : "1") + ",1 "
          + r2 * c2 + "," + r2 * s2
          + "L" + r1 * c2 + "," + r1 * s2
          + "A" + r1 + "," + r1 + " 0 "
          + ((s.angle < Math.PI) ? "0" : "1") + ",0 "
          + r1 * c1 + "," + r1 * s1 + "Z");
    } else {
      v.setAttribute("d", "M" + r2 * c1 + "," + r2 * s1
          + "A" + r2 + "," + r2 + " 0 "
          + ((s.angle < Math.PI) ? "0" : "1") + ",1 "
          + r2 * c2 + "," + r2 * s2 + "L0,0Z");
    }
  }

  /* fill, stroke TODO gradient, patterns */
  var fill = pv.color(s.fillStyle);
  v.setAttribute("fill", fill.color);
  v.setAttribute("fill-opacity", fill.opacity);
  var stroke = pv.color(s.strokeStyle);
  v.setAttribute("stroke", stroke.color);
  v.setAttribute("stroke-opacity", stroke.opacity);
  v.setAttribute("stroke-width", s.lineWidth);
};
pv.Scales = {};
pv.Scales.epsilon = 1e-30;
pv.Scales.defaultBase = 10;

/**
 * Scale is a base class for scale objects. Scale objects are used to scale the
 * data to a given range. The Scale object initially scales the value to the
 * interval [0, 1]. The values are then mapped to a given range by the range()
 * method.
 */
pv.Scales.Scale = function() {
  // Pixel coordinate minimum
  this._rMin = 0;
  // Pixel coordinate maximum
  this._rMax = 100;
  // Round value?
  this._round = true;
};

/**
 * Sets the range to map the data to.
 */
pv.Scales.Scale.prototype.range = function(a, b) {
  if (a == undefined) {
    // use default values
    // TODO: [0, 100] may not be the best default values.
    // Find better default values, which may be different for each scale type.
  } else if (b == undefined) {
    this._rMin = 0;
    this._rMax = a;
  } else {
    this._rMin = a;
    this._rMax = b;
  }

  return this;
};

// Accessor method for range min
pv.Scales.Scale.prototype.rangeMin = function(x) {
  if (x == undefined) {
    return this._rMin;
  } else {
    this._rMin = x;
    return this;
  }
};

// Accessor method for range max
pv.Scales.Scale.prototype.rangeMax = function(x) {
  if (x == undefined) {
    return this._rMax;
  } else {
    this._rMax = x;
    return this;
  }
};

// Accessor method for round
pv.Scales.Scale.prototype.round = function(x) {
  if (x == undefined) {
    return this._round;
  } else {
    this._round = x;
    return this;
  }
};

//Scales the input to the set range
pv.Scales.Scale.prototype.scale = function(x) {
  var v = this._rMin + (this._rMax-this._rMin) * this.normalize(x);
  return this._round ? Math.round(v) : v;
};

// Returns the inverse scaled value.
pv.Scales.Scale.prototype.invert = function(y) {
  var n = (y - this._rMin) / (this._rMax - this._rMin);
  return this.unnormalize(n);
};
pv.Scale = {};

pv.Scale.linear = function() {
  var min, max, nice = false, s, f = pv.identity;

  /* Property function. */
  function scale() {
    if (s == undefined) {
      if (min == undefined) min = pv.min(this.$$data, f);
      if (max == undefined) max = pv.max(this.$$data, f);
      if (nice) { // TODO Only "nice" bounds set automatically.
        var step = Math.pow(10, Math.round(Math.log(max - min) / Math.log(10)) - 1);
        min = Math.floor(min / step) * step;
        max = Math.ceil(max / step) * step;
      }
      s = range.call(this) / (max - min);
    }
    return (f.apply(this, arguments) - min) * s;
  }

  function range() {
    switch (property) {
      case "height":
      case "top":
      case "bottom": return this.parent.height();
      case "width":
      case "left":
      case "right": return this.parent.width();
      default: return 1;
    }
  }

  scale.by = function(v) { f = v; return this; };
  scale.min = function(v) { min = v; return this; };
  scale.max = function(v) { max = v; return this; };

  scale.nice = function(v) {
    nice = (arguments.length == 0) ? true : v;
    return this;
  };

  scale.range = function() {
    if (arguments.length == 1) {
      o = 0;
      s = arguments[0];
    } else {
      o = arguments[0];
      s = arguments[1] - arguments[0];
    }
    return this;
  };

  return scale;
};
/**
 * QuantitativeScale is a base class for representing quantitative numerical data
 * scales.
 */
pv.Scales.QuantitativeScale = function(min, max, base) {
  pv.Scales.Scale.call(this);

  this._min = min;
  this._max = max;
  this._base = base==undefined ? pv.Scales.defaultBase : base;
};

pv.Scales.QuantitativeScale.prototype = pv.extend(pv.Scales.Scale);

// Accessor method for min
pv.Scales.QuantitativeScale.prototype.min = function(x) {
  if (x == undefined) {
    return this._min;
  } else {
    this._min = x;
    return this;
  }
};

// Accessor method for max
pv.Scales.QuantitativeScale.prototype.max = function(x) {
  if (x == undefined) {
    return this._max;
  } else {
    this._max = x;
    return this;
  }
};

// Accessor method for base
pv.Scales.QuantitativeScale.prototype.base = function(x) {
  if (x == undefined) {
    return this._base;
  } else {
    this._base = x;
    return this;
  }
};

// Checks if the mapped interval contains x
pv.Scales.QuantitativeScale.prototype.contains = function(x) {
  return (x >= this._min && x <= this._max);
};

// Returns the step for the scale
pv.Scales.QuantitativeScale.prototype.step = function(min, max, base) {
  if (!base) base = pv.Scales.defaultBase;
  var exp = Math.round(Math.log(max-min)/Math.log(base)) - 1;

  return Math.pow(base, exp);
};
pv.Scales.dateTime = function(min, max) {
  return new pv.Scales.DateTimeScale(min, max);
}

/**
 * DateTimeScale DateTimeScale scales time data.
 */
pv.Scales.DateTimeScale = function(min, max) {
  pv.Scales.Scale.call(this);

  this._min = min;
  this._max = max;
};

pv.Scales.DateTimeScale.prototype = pv.extend(pv.Scales.Scale);

// Accessor method for min
pv.Scales.DateTimeScale.prototype.min = function(x) {
  if (x == undefined) {
    return this._min;
  } else {
    this._min = x;
    return this;
  }
};

// Accessor method for max
pv.Scales.DateTimeScale.prototype.max = function(x) {
  if (x == undefined) {
    return this._max;
  } else {
    this._max = x;
    return this;
  }
};

// Normalizes DateTimeScale value
pv.Scales.DateTimeScale.prototype.normalize = function(x) {
  var eps = pv.Scales.epsilon;
  var range = this._max - this._min;

  return (range < eps && range > -eps) ? 0 : (x - this._min) / range;
};

// Un-normalizes the value
pv.Scales.DateTimeScale.prototype.unnormalize = function(n) {
  return n * (this._max - this._min) + this._min;
};

// Checks if the mapped interval contains x
pv.Scales.DateTimeScale.prototype.contains = function(x) {
  var t = x.valueOf();
  return (t >= this._min.valueOf() && t <= this._max.valueOf());
};

// Sets min/max values to "nice" values
pv.Scales.DateTimeScale.prototype.nice = function() {
  var span  = this.span(this._min, this._max);
  this._min = this.round(this._min, span, false);
  this._max = this.round(this._max, span, true);
};

/**
 * Calculate a list of rule values covering the time range spaced at a
 * configurable span.
 *
 * @param [forceSpan] If you want to force rule-generation from a span other
 *     than the default calculated by span, pass the value here.
 * @param [beNice] Round the min and max values based on the span in use. If
 *     you are passing a value for forceSpan, you may also want to pass true
 *     for this argument.
 *
 * @return a list of rule values
 */
pv.Scales.DateTimeScale.prototype.ruleValues = function(forceSpan, beNice) {
  var min  = this._min.valueOf(), max = this._max.valueOf();
  var span = (forceSpan == null) ? this.span(this._min, this._max) : forceSpan;
  // We need to boost the step in order to avoid an infinite loop in the first
  //  case where we round.  DST can cause a case where just one step is not
  //  enough to push round far enough.
  var step = Math.floor(this.step(this._min, this._max, span) * 1.5);
  var list = [];

  var d = this._min;
  if (beNice) {
    d = this.round(d, span, false);
    max = this.round(this._max, span, true).valueOf();
  }
  if (span < pv.Scales.DateTimeScale.Span.MONTHS) {
    while (d.valueOf() <= max) {
      list.push(d);
      // we need to round to compensate for daylight savings time...
      d = this.round(new Date(d.valueOf()+step), span, false);
    }
  } else if (span == pv.Scales.DateTimeScale.Span.MONTHS) {
    // TODO: Handle quarters
    step = 1;
    while (d.valueOf() <= max) {
      list.push(d);
      d = new Date(d);
      d.setMonth(d.getMonth() + step);
    }
  } else { // Span.YEARS
    step = 1;
    while (d.valueOf() <= max) {
      list.push(d);
      d = new Date(d);
      d.setFullYear(d.getFullYear() + step);
    }
  }

  return list;
};

// Time Span Constants
pv.Scales.DateTimeScale.Span = {};
pv.Scales.DateTimeScale.Span.YEARS        =  0;
pv.Scales.DateTimeScale.Span.MONTHS       = -1;
pv.Scales.DateTimeScale.Span.DAYS         = -2;
pv.Scales.DateTimeScale.Span.HOURS        = -3;
pv.Scales.DateTimeScale.Span.MINUTES      = -4;
pv.Scales.DateTimeScale.Span.SECONDS      = -5;
pv.Scales.DateTimeScale.Span.MILLISECONDS = -6;
pv.Scales.DateTimeScale.Span.WEEKS        = -10;
pv.Scales.DateTimeScale.Span.QUARTERS     = -11;

// Rounds the date
pv.Scales.DateTimeScale.prototype.round = function(t, span, roundUp) {
  var Span = pv.Scales.DateTimeScale.Span;
  var d = t, bias = roundUp ? 1 : 0;

  if (span >= Span.YEARS) {
    d = new Date(t.getFullYear() + bias, 0);
  } else if (span == Span.MONTHS) {
    d = new Date(t.getFullYear(), t.getMonth() + bias);
  } else if (span == Span.DAYS) {
    d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + bias);
  } else if (span == Span.HOURS) {
    d = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours() + bias);
  } else if (span == Span.MINUTES) {
    d = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes() + bias);
  } else if (span == Span.SECONDS) {
    d = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds() + bias);
  } else if (span == Span.MILLISECONDS) {
    d = new Date(d.time + (roundUp ? 1 : -1));
  } else if (span == Span.WEEKS) {
    bias = roundUp ? 7 - d.getDay() : -d.getDay();
    d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + bias);
  }
  return d;
};

// Returns the span of the given min/max values
pv.Scales.DateTimeScale.prototype.span = function(min, max) {
  var MS_MIN = 60*1000, MS_HOUR = 60*MS_MIN, MS_DAY = 24*MS_HOUR, MS_WEEK = 7*MS_DAY;
  var Span = pv.Scales.DateTimeScale.Span;
  var span = max.valueOf() - min.valueOf();
  var days = span / MS_DAY;

  // TODO: handle Weeks/Quarters
  if (days >= 365*2) return (1 + max.getFullYear()-min.getFullYear());
  else if (days >= 60) return Span.MONTHS;
  else if (span/MS_WEEK > 1) return Span.WEEKS;
  else if (span/MS_DAY > 1) return Span.DAYS;
  else if (span/MS_HOUR > 1) return Span.HOURS;
  else if (span/MS_MIN > 1) return Span.MINUTES;
  else if (span/1000.0 > 1) return Span.SECONDS;
  else return Span.MILLISECONDS;
}

// Returns the step for the scale
pv.Scales.DateTimeScale.prototype.step = function(min, max, span) {
  var Span = pv.Scales.DateTimeScale.Span;

  if (span > Span.YEARS) {
    var exp = Math.round(Math.log(Math.max(1,span-1)/Math.log(10))) - 1;
    return Math.pow(10, exp);
  } else if (span == Span.MONTHS) {
    return 0;
  } else if (span == Span.WEEKS) {
    return 7*24*60*60*1000;
  } else if (span == Span.DAYS) {
    return 24*60*60*1000;
  } else if (span == Span.HOURS) {
    return 60*60*1000;
  } else if (span == Span.MINUTES) {
    return 60*1000;
  } else if (span == Span.SECONDS) {
    return 1000;
  } else {
    return 1;
  }
};
pv.Scales.linear = function(min, max, base) {
  return new pv.Scales.LinearScale(min, max, base);
};

pv.Scales.linear.fromData = function(data, f, base) {
  return new pv.Scales.LinearScale(pv.min(data, f), pv.max(data, f), base);
}

/**
 * LinearScale is a QuantativeScale that spaces values linearly along the scale
 * range. This is the default scale for numeric types.
 */
pv.Scales.LinearScale = function(min, max, base) {
  pv.Scales.QuantitativeScale.call(this, min, max, base);
};

pv.Scales.LinearScale.prototype = pv.extend(pv.Scales.QuantitativeScale);

// Normalizes the value
pv.Scales.LinearScale.prototype.normalize = function(x) {
  var eps = pv.Scales.epsilon;
  var range = this._max - this._min;

  return (range < eps && range > -eps) ? 0 : (x - this._min) / range;
};

// Un-normalizes the value
pv.Scales.LinearScale.prototype.unnormalize = function(n) {
  return n * (this._max - this._min) + this._min;
};

// Sets min/max values to "nice numbers"
pv.Scales.LinearScale.prototype.nice = function() {
  var step = this.step(this._min, this._max, this._base);

  this._min = Math.floor(this._min / step) * step;
  this._max = Math.ceil(this._max / step) * step;

  return this;
};

// Returns a list of rule values
pv.Scales.LinearScale.prototype.ruleValues = function() {
  var step = this.step(this._min, this._max, this._base);

  var start = Math.floor(this._min / step) * step;
  var end = Math.ceil(this._max / step) * step;

  var list = pv.range(start, end+step, step);

  // Remove precision problems
  // TODO move to tick rendering, not scales
  if (step < 1) {
    var exp = Math.round(Math.log(step)/Math.log(this._base));

    for (var i = 0; i < list.length; i++) {
      list[i] = list[i].toFixed(-exp);
    }
  }

  // check end points
  if (list[0] < this._min) list.splice(0, 1);
  if (list[list.length-1] > this._max) list.splice(list.length-1, 1);

  return list;
};
pv.Scales.log = function(min, max, base) {
  return new pv.Scales.LogScale(min, max, base);
};

pv.Scales.log.fromData = function(data, f, base) {
  return new pv.Scales.LogScale(pv.min(data, f), pv.max(data, f), base);
}

/*
 * LogScale is a QuantativeScale that performs a log transformation of the
 * data. The base of the logarithm is determined by the base property.
 */
pv.Scales.LogScale = function(min, max, base) {
  pv.Scales.QuantitativeScale.call(this, min, max, base);

  this.update();
};

// Zero-symmetric log function
pv.Scales.LogScale.log = function(x, b) {
  return x==0 ? 0 : x>0 ? Math.log(x)/Math.log(b) : -Math.log(-x)/Math.log(b);
};

// Adjusted zero-symmetric log function
pv.Scales.LogScale.zlog = function(x, b) {
  var s = (x < 0) ? -1 : 1;
  x = s*x;
  if (x < b) x += (b-x)/b;
  return s * Math.log(x) / Math.log(b);
};

pv.Scales.LogScale.prototype = pv.extend(pv.Scales.QuantitativeScale);

// Accessor method for min
pv.Scales.LogScale.prototype.min = function(x) {
  var value = pv.Scales.QuantitativeScale.prototype.min.call(this, x);

  if (x != undefined) this.update();
  return value;
};

// Accessor method for max
pv.Scales.LogScale.prototype.max = function(x) {
  var value = pv.Scales.QuantitativeScale.prototype.max.call(this, x);

  if (x != undefined) this.update();
  return value;
};

// Accessor method for base
pv.Scales.LogScale.prototype.base = function(x) {
  var value = pv.Scales.QuantitativeScale.prototype.base.call(this, x);

  if (x != undefined) this.update();
  return value;
};

// Normalizes the value
pv.Scales.LogScale.prototype.normalize = function(x) {
  var eps = pv.Scales.epsilon;
  var range = this._lmax - this._lmin;

  return (range < eps && range > -eps) ? 0 : (this._log(x, this._base) - this._lmin) / range;
};

// Un-normalizes the value
pv.Scales.LogScale.prototype.unnormalize = function(n) {
  // TODO: handle case where _log = zlog
  return Math.pow(this._base, n * (this._lmax - this._lmin) + this._lmin);
};

/**
 * Sets min/max values to "nice numbers" For LogScale, we compute "nice" min/max
 * values for the log scale(_lmin, _lmax) first, then calculate the data min/max
 * values from the log min/max values.
 */
pv.Scales.LogScale.prototype.nice = function() {
  var step = 1; //this.step(this._lmin, this._lmax);

  this._lmin = Math.floor(this._lmin / step) * step;
  this._lmax = Math.ceil(this._lmax / step) * step;

  // TODO: handle case where _log = zlog
  this._min = Math.pow(this._base, this._lmin);
  this._max = Math.pow(this._base, this._lmax);

  return this;
};

// Returns a list of rule values
pv.Scales.LogScale.prototype.ruleValues = function() {
  var step = this.step(this._lmin, this._lmax);
  if (step < 1) step = 1; // bound to 1

  var start = Math.floor(this._lmin);
  var end = Math.ceil(this._lmax);

  var list =[];
  var i, j, b;
  for (i = start; i < end; i++) { // for each step
    // add each rule value
    // TODO: handle case where _log = zlog
    b = Math.pow(this._base, i);
    for (j = 1; j < this._base; j++) {
      if (i >= 0) list.push(b*j);
      else list.push((b*j).toFixed(-i));
    }
  }
  list.push(b*this._base); // add max value

  // check end points
  if (list[0] < this._min) list.splice(0, 1);
  if (list[list.length-1] > this._max) list.splice(list.length-1, 1);

  return list;
};

// Update log scale values
pv.Scales.LogScale.prototype.update = function() {
  this._log = (this._min < 0 && this._max > 0) ? pv.Scales.LogScale.zlog : pv.Scales.LogScale.log;
  this._lmin = this._log(this._min, this._base);
  this._lmax = this._log(this._max, this._base);
};
/**
 * Returns a {@link pv.Nest} operator for the specified array. This is a
 * convenience factory method, equivalent to <tt>new pv.Nest(array)</tt>.
 *
 * @see pv.Nest
 * @param {array} array an array of elements to nest.
 * @returns {pv.Nest} a nest operator for the specified array.
 */
pv.nest = function(array) {
  return new pv.Nest(array);
};

/**
 * Constructs a nest operator for the specified array.
 *
 * @class Represents a {@link Nest} operator for the specified array. Nesting
 * allows elements in an array to be grouped into a hierarchical tree
 * structure. The levels in the tree are specified by <i>key</i> functions. The
 * leaf nodes of the tree can be sorted by value, while the internal nodes can
 * be sorted by key. Finally, the tree can be returned either has a
 * multidimensional array via {@link #entries}, or as a hierarchical map via
 * {@link #map}. The {@link #rollup} routine similarly returns a map, collapsing
 * the elements in each leaf node using a summary function.
 *
 * <p>For example, consider the following tabular data structure of Barley
 * yields, from various sites in Minnesota during 1931-2:
 *
 * <pre>{ yield: 27.00, variety: "Manchuria", year: 1931, site: "University Farm" },
 * { yield: 48.87, variety: "Manchuria", year: 1931, site: "Waseca" },
 * { yield: 27.43, variety: "Manchuria", year: 1931, site: "Morris" }, ...</pre>
 *
 * To facilitate visualization, it may be useful to nest the elements first by
 * year, and then by variety, as follows:
 *
 * <pre>var nest = pv.nest(yields)
 *     .key(function(d) d.year)
 *     .key(function(d) d.variety)
 *     .entries();</pre>
 *
 * This returns a nested array. Each element of the outer array is a key-values
 * pair, listing the values for each distinct key:
 *
 * <pre>{ key: 1931, values: [
 *   { key: "Manchuria", values: [
 *       { yield: 27.00, variety: "Manchuria", year: 1931, site: "University Farm" },
 *       { yield: 48.87, variety: "Manchuria", year: 1931, site: "Waseca" },
 *       { yield: 27.43, variety: "Manchuria", year: 1931, site: "Morris" },
 *       ...
 *     ]},
 *   { key: "Glabron", values: [
 *       { yield: 43.07, variety: "Glabron", year: 1931, site: "University Farm" },
 *       { yield: 55.20, variety: "Glabron", year: 1931, site: "Waseca" },
 *       ...
 *     ]},
 *   ]},
 * { key: 1932, values: ... }</pre>
 *
 * Further details, including sorting and rollup, is provided below on the
 * corresponding methods.
 *
 * @param {array} array an array of elements to nest.
 */
pv.Nest = function(array) {
  this.array = array;
  this.keys = [];
};

/**
 * Nests using the specified key function. Multiple keys may be added to the
 * nest; the array elements will be nested in the order keys are specified.
 *
 * @param {function} key a key function; must return a string or suitable map
 * key.
 * @return {pv.Nest} this.
 */
pv.Nest.prototype.key = function(key) {
  this.keys.push(key);
  return this;
};

/**
 * Sorts the previously-added keys. The natural sort order is used by default
 * (see {@link pv.naturalOrder}); if an alternative order is desired,
 * <tt>order</tt> should be a comparator function. If this method is not called
 * (i.e., keys are <i>unsorted</i>), keys will appear in the order they appear
 * in the underlying elements array. For example,
 *
 * <pre>pv.nest(yields)
 *     .key(function(d) d.year)
 *     .key(function(d) d.variety)
 *     .sortKeys()
 *     .entries()</pre>
 *
 * groups yield data by year, then variety, and sorts the variety groups
 * lexicographically (since the variety attribute is a string).
 *
 * <p>Key sort order is only used in conjunction with {@link #entries}, which
 * returns an array of key-values pairs. If the nest is used to construct a
 * {@link #map} instead, keys are unsorted.
 *
 * @param {function} [order] an optional comparator function.
 * @returns {pv.Nest} this.
 */
pv.Nest.prototype.sortKeys = function(order) {
  this.keys[this.keys.length - 1].order = order || pv.naturalOrder;
  return this;
};

/**
 * Sorts the leaf values. The natural sort order is used by default (see
 * {@link pv.naturalOrder}); if an alternative order is desired, <tt>order</tt>
 * should be a comparator function. If this method is not called (i.e., values
 * are <i>unsorted</i>), values will appear in the order they appear in the
 * underlying elements array. For example,
 *
 * <pre>pv.nest(yields)
 *     .key(function(d) d.year)
 *     .key(function(d) d.variety)
 *     .sortValues(function(a, b) a.yield - b.yield)
 *     .entries()</pre>
 *
 * groups yield data by year, then variety, and sorts the values for each
 * variety group by yield.
 *
 * <p>Value sort order, unlike keys, applies to both {@link #entries} and
 * {@link #map}. It has no effect on {@link #rollup}.
 *
 * @param {function} [order] an optional comparator function.
 * @return {pv.Nest} this.
 */
pv.Nest.prototype.sortValues = function(order) {
  this.order = order || pv.naturalOrder;
  return this;
};

/**
 * Returns a hierarchical map of values. Each key adds one level to the
 * hierarchy. With only a single key, the returned map will have a key for each
 * distinct value of the key function; the correspond value with be an array of
 * elements with that key value. If a second key is added, this will be a nested
 * map. For example:
 *
 * <pre>pv.nest(yields)
 *     .key(function(d) d.variety)
 *     .key(function(d) d.site)
 *     .map()</pre>
 *
 * returns a map <tt>m</tt> such that <tt>m[variety][site]</tt> is an array, a subset of
 * <tt>yields</tt>, with each element having the given variety and site.
 *
 * @returns a hierarchical map of values.
 */
pv.Nest.prototype.map = function() {
  var map = {}, values = [];

  /* Build the map. */
  for (var i, j = 0; j < this.array.length; j++) {
    var x = this.array[j];
    var m = map;
    for (i = 0; i < this.keys.length - 1; i++) {
      var k = this.keys[i](x);
      if (!m[k]) m[k] = {};
      m = m[k];
    }
    k = this.keys[i](x);
    if (!m[k]) {
      var a = [];
      values.push(a);
      m[k] = a;
    }
    m[k].push(x);
  }

  /* Sort each leaf array. */
  if (this.order) {
    for (var i = 0; i < values.length; i++) {
      values[i].sort(this.order);
    }
  }

  return map;
};

/**
 * Returns a hierarchical nested array. This method is similar to
 * {@link pv#entries}, but works recursively on the entire hierarchy. Rather
 * than returning a map like {@link #map}, this method returns a nested
 * array. Each element of the array has a <tt>key</tt> and <tt>values</tt>
 * field. For leaf nodes, the <tt>values</tt> array will be a subset of the
 * underlying elements array; for non-leaf nodes, the <tt>values</tt> array will
 * contain more key-values pairs.
 *
 * <p>For an example usage, see the {@link Nest} constructor.
 *
 * @returns a hierarchical nested array.
 */
pv.Nest.prototype.entries = function() {

  /** Recursively extracts the entries for the given map. */
  function entries(map) {
    var array = [];
    for (var k in map) {
      var v = map[k];
      array.push({ key: k, values: (v instanceof Array) ? v : entries(v) });
    };
    return array;
  }

  /** Recursively sorts the values for the given key-values array. */
  function sort(array, i) {
    var o = this.keys[i].order;
    if (o) array.sort(function(a, b) { return o(a.key, b.key); });
    if (++i < this.keys.length) {
      for (var j = 0; j < array.length; j++) {
        sort.call(this, array[j].values, i);
      }
    }
    return array;
  }

  return sort.call(this, entries(this.map()), 0);
};

/**
 * Returns a rollup map. The behavior of this method is the same as
 * {@link #map}, except that the leaf values are replaced with the return value
 * of the specified rollup function <tt>f</tt>. For example,
 *
 * <pre>pv.nest(yields)
 *      .key(function(d) d.site)
 *      .rollup(function(v) pv.median(v, function(d) d.yield))</pre>
 *
 * first groups yield data by site, and then returns a map from site to median
 * yield for the given site.
 *
 * @see #map
 * @param {function} f a rollup function.
 * @returns a hierarhical map, with the leaf values computed by <tt>f</tt>.
 */
pv.Nest.prototype.rollup = function(f) {

  /** Recursively descends to the leaf nodes (arrays) and does rollup. */
  function rollup(map) {
    for (var key in map) {
      var value = map[key];
      if (value instanceof Array) {
        map[key] = f(value);
      } else {
        rollup(value);
      }
    }
    return map;
  }

  return rollup(this.map());
};
pv.Scales.ordinal = function(ordinals) {
  return new pv.Scales.OrdinalScale(ordinals);
};

/**
 * OrdinalScale is a Scale for ordered sequential data.  This supports both
 * numeric and non-numeric data, and simply places each element in sequence
 * using the ordering found in the input data array.
 */
pv.Scales.OrdinalScale = function(ordinals) {
  pv.Scales.Scale.call(this);

  /* Filter the specified ordinals to their unique values. */
  var seen = {};
  this._ordinals = [];
  for (var i = 0; i < ordinals.length; i++) {
    var o = ordinals[i];
    if (seen[o] == undefined) {
      seen[o] = true;
      this._ordinals.push(o);
    }
  }

  this._map = pv.numerate(this._ordinals);
};

pv.Scales.OrdinalScale.prototype = pv.extend(pv.Scales.Scale);

// Accessor method for ordinals
pv.Scales.OrdinalScale.prototype.ordinals = function(ordinals) {
  if (ordinals == undefined) {
    return this._ordinals;
  } else {
    this._ordinals = ordinals;
    this._map = pv.numerate(ordinals);
    return this;
  }
};

// Normalizes the value
pv.Scales.OrdinalScale.prototype.normalize = function(x) {
  var i = this._map[x];

  // if x not an ordinal value(assume x is an index value)
  if (i == undefined) i = x;

  // Not sure if the value should be shifted
  return (i == undefined) ? -1 : (i + 0.5) / this._ordinals.length;
};

// Returns the ordinal values for i
pv.Scales.OrdinalScale.prototype.unnormalize = function(n) {
  var i = Math.floor(n * this._ordinals.length - 0.5);
  return this._ordinals[i];
};

// Returns a list of rule values
pv.Scales.OrdinalScale.prototype.ruleValues = function() {
  return pv.range(0.5, this._ordinals.length-0.5);
};

// Returns the width between rules
pv.Scales.OrdinalScale.prototype.ruleWidth = function() {
  return this.scale(1/this._ordinals.length);
};
pv.Scales.root = function(min, max, base) {
  return new pv.Scales.RootScale(min, max, base);
};

pv.Scales.root.fromData = function(data, f, base) {
  return new pv.Scales.RootScale(pv.min(data, f), pv.max(data, f), base);
}

/**
 * RootScale is a QuantativeScale that performs a root transformation of the
 * data. This could be a square root or any arbitrary power. A root scale may
 * be a many-to-one mapping where the reverse mapping will not be correct.
 */
pv.Scales.RootScale = function(min, max, base) {
  if (min instanceof Array) {
    if (max == undefined) max = 2; // default base for root is 2.
  } else {
    if (base == undefined) base = 2; // default base for root is 2.
  }

  pv.Scales.QuantitativeScale.call(this, min, max, base);

  this.update();
};

// Returns the root value with base b
pv.Scales.RootScale.root = function (x, b) {
  var s = (x < 0) ? -1 : 1;
  return s * Math.pow(s * x, 1 / b);
};

pv.Scales.RootScale.prototype = pv.extend(pv.Scales.QuantitativeScale);

// Accessor method for min
pv.Scales.RootScale.prototype.min = function(x) {
  var value = pv.Scales.QuantitativeScale.prototype.min.call(this, x);
  if (x != undefined) this.update();
  return value;
};

// Accessor method for max
pv.Scales.RootScale.prototype.max = function(x) {
  var value = pv.Scales.QuantitativeScale.prototype.max.call(this, x);
  if (x != undefined) this.update();
  return value;
};

// Accessor method for base
pv.Scales.RootScale.prototype.base = function(x) {
  var value = pv.Scales.QuantitativeScale.prototype.base.call(this, x);
  if (x != undefined) this.update();
  return value;
};

// Normalizes the value
pv.Scales.RootScale.prototype.normalize = function(x) {
  var eps = pv.Scales.epsilon;
  var range = this._rmax - this._rmin;

  return (range < eps && range > -eps) ? 0
    : (pv.Scales.RootScale.root(x, this._base) - this._rmin)
      / (this._rmax - this._rmin);
};

// Un-normalizes the value
pv.Scales.RootScale.prototype.unnormalize = function(n) {
  return Math.pow(n * (this._rmax - this._rmin) + this._rmin, this._base);
};

// Sets min/max values to "nice numbers"
pv.Scales.RootScale.prototype.nice = function() {
  var step = this.step(this._rmin, this._rmax);

  this._rmin = Math.floor(this._rmin / step) * step;
  this._rmax = Math.ceil(this._rmax / step) * step;

  this._min = Math.pow(this._rmin, this._base);
  this._max = Math.pow(this._rmax, this._base);

  return this;
};

// Returns a list of rule values
// The rule values of a root scale should be the powers
// of integers, e.g. 1, 4, 9, ... for base = 2
// TODO: This function needs further testing
pv.Scales.RootScale.prototype.ruleValues = function() {
  var step = this.step(this._rmin, this._rmax);
//  if (step < 1) step = 1; // bound to 1
  // TODO: handle decimal values

  var s;
  var list = pv.range(Math.floor(this._rmin), Math.ceil(this._rmax), step);
  for (var i = 0; i < list.length; i++) {
    s = (list[i] < 0) ? -1 : 1;
    list[i] = s*Math.pow(list[i], this._base);
  }

  // check end points
  if (list[0] < this._min) list.splice(0, 1);
  if (list[list.length-1] > this._max) list.splice(list.length-1, 1);

  return list;
};

// Update root scale values
pv.Scales.RootScale.prototype.update = function() {
  var rt = pv.Scales.RootScale.root;
  this._rmin = rt(this._min, this._base);
  this._rmax = rt(this._max, this._base);
};
  return pv;
}();
