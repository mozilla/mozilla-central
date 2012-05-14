(function () {
    var a = "0";
    let (a = function() { ++a; }) {
        a();
    }
    "" + a;
})();
