var reg = {
  load: function() {
    this._div = document.getElementById('time');
    var sel = document.getElementById('UserTz').value;
    var tz;

    if (sel == '') {
      tz = new Date().getTimezoneOffset() / 60;
      if (tz > 0)
        tz -= (tz * 2);
      else
        tz = Math.abs(tz);
    }
    else
      tz = sel;

    this._tz = tz;
    document.getElementById('UserTz').value = tz;
    window.setInterval('reg.update()', 500);
    this.update();
    if (document.getElementById('map'))
      this.mapInit();
  },

  update: function() {
    var d = new Date();
    var str = new Date(d.getUTCFullYear(), d.getUTCMonth(),
                       d.getUTCDate(), d.getUTCHours(),
                       d.getUTCMinutes(), d.getUTCSeconds());    

    var foo = new Date(str.getTime() + (3600000 * this._tz));
    this._div.innerHTML = foo.toLocaleString();
  },
  
  tzup: function() {
    var sel = document.getElementById('UserTz').value;
    this._tz = sel;
    this.update();
  },

  mapInit: function() {
    if (GBrowserIsCompatible()) {
      this.map = new GMap2(document.getElementById('map'));
      this.map.setCenter(new GLatLng(37.4419, -122.1419), 13);
    }
  }
};