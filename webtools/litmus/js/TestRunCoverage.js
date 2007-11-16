var coverageCells;
var resultsCells;

/* We alternate looking up coverage and results as we work our
 * way down the page.
 */

function beginCoverageLookup() {
    coverageCells = document.getElementsByClassName('coverage-loading');
    resultsCells = document.getElementsByClassName('results-loading');
    if (coverageCells.length>0) {
      getCoverage();        
    }
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
        } else {
            coverageCell.setAttribute('class','coverage');    
        }
        coverageCell.innerHTML = '<a href="test_run_report.cgi?test_run_id=' +
                                  test_run.test_run_id + '">' +
                                  test_run.coverage + '%</a>';
    }
    if (resultsCells.length>0) {
      getResults();
    } else if (coverageCells.length>0) {
      getCoverage();        
    } 
}

function getResults() {
    var resultsCell = resultsCells.shift();
    if (resultsCell) {
        var test_run_id = resultsCell.id.match(/\d+/); 
        var url = 'json.cgi?results=1&test_run_id=' + test_run_id;
        fetchJSON(url,updateResults,1);
    }
}

function updateResults(data) {
    test_run=data;
    
    var resultsCell = document.getElementById('results_'+test_run.test_run_id);
    if (resultsCell) {
        resultsCell.setAttribute('class','results');    
        resultsCell.innerHTML = 'Pass: <a href="search_results.cgi?test_run_id=' +
                                 test_run.test_run_id + '&amp;result_status=pass">' +
                                 test_run.num_pass + '</a> / Fail: <a href="search_results.cgi?test_run_id=' +
                                 test_run.test_run_id + '&amp;result_status=fail">' +
                                 test_run.num_fail + '</a> / Unclear: <a href="search_results.cgi?test_run_id=' +
                                 test_run.test_run_id + '&amp;result_status=unclear">' +
                                 test_run.num_unclear + '</a><br/>Results with Comments: <a href="search_results.cgi?test_run_id=' +
                                 test_run.test_run_id + '&amp;has_comments=1">' +
                                 test_run.num_comments + '</a>';
    }
    if (coverageCells.length>0) {
      getCoverage();        
    } else if (resultsCells.length>0) {
      getResults();
    }
}
