var coverageCells;

function beginCoverageLookup() {
    coverageCells = document.getElementsByClassName('coverage');
    getCoverage();
}

function getCoverage() {
    var coverageCell = coverageCells.shift();
    if (coverageCell) {
        var test_run_id = coverageCell.id.match(/\d+/); 
        var url = 'json.cgi?coverage=1&test_run_id=' + test_run_id;
        fetchJSON(url,updateCoverage,1);
    }
}

function updateCoverage(data) {
    test_run=data;
    
    var coverageCell = document.getElementById('coverage_'+test_run.test_run_id);
    if (coverageCell) {
        if (test_run.coverage == 100) {
            coverageCell.setAttribute('class','coverage-complete');    
        }
        coverageCell.innerHTML = '<a href="test_run_report.cgi?test_run_id=' +
                                  test_run.test_run_id + '">' +
                                  test_run.coverage + '%</a>';
    }
    getCoverage();
}